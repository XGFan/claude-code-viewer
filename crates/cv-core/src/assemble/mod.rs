//! Session assembly: turns the append-mostly event log of a Session into normalized nodes
//! (plan §3.4). The engine loads files and sidecars; this module only computes.

pub mod branch;
pub mod content;
pub mod find;
pub mod jump;
pub mod nodes;
pub mod prompt;
pub mod skeleton;
pub mod subagent;
pub mod summarize;
pub mod tree;
pub mod workflow;

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::error::{CoreError, CoreResult};
use crate::model::{
    AgentId, FileRole, ForkOrigin, NodeId, SubagentRun, TitleSource, TokenTotals, Transcript,
    TranscriptRequest, WorkflowRun,
};
use crate::parse::EntryRecord;

/// One parsed source file of a Session.
#[derive(Debug)]
pub struct LoadedFile {
    pub path: PathBuf,
    pub role: FileRole,
    /// `None` for main files.
    pub agent_id: Option<String>,
    /// Records in file order.
    pub records: Vec<EntryRecord>,
}

/// Cheap in-memory uuid graph of a Session's main file(s) (§3.4 steps 1–4): enough to compute
/// aggregates, the Main Line and `main_set` without building display nodes.
#[derive(Clone, Debug, Default)]
pub struct SessionSkeleton {
    /// uuid-bearing entries after the merge (largest file first, first occurrence wins within a
    /// file, union by uuid across files), in merged file order.
    pub nodes: Vec<SkeletonNode>,
    /// uuid → index into `nodes`.
    pub by_uuid: HashMap<String, usize>,
    /// Duplicate uuids dropped by the merge.
    pub duplicate_uuids: u32,
    /// `leafUuid` of every `last-prompt` entry, in file order.
    pub last_prompt_leaves: Vec<String>,
    /// Last `custom-title` / `ai-title` values.
    pub custom_title: Option<String>,
    pub ai_title: Option<String>,
    /// Main Line leaf → root, reversed (root first); empty for an empty Session.
    pub main_path: Vec<usize>,
}

/// One uuid-bearing entry in a [`SessionSkeleton`].
#[derive(Clone, Debug, Default)]
pub struct SkeletonNode {
    pub uuid: String,
    /// Effective parent per §3.4 step 2 + A1 (index into `SessionSkeleton::nodes`).
    pub parent: Option<usize>,
    pub entry_type: String,
    pub subtype: Option<String>,
    pub timestamp_ms: Option<f64>,
    /// Assistant `message.id`.
    pub message_id: Option<String>,
    /// Global file order (file index in merge order, then byte offset).
    pub order: (u32, u64),
    pub is_meta: bool,
    pub is_compact_summary: bool,
    pub is_tool_result: bool,
    /// Carries `forkedFrom` (fork-inherited).
    pub forked: bool,
}

/// Derived facts of a Session written to the `sessions` table (§3.4 steps 8–10).
/// Token and count figures are **main-file only** (A8); the engine adds subagent figures.
#[derive(Clone, Debug, PartialEq)]
pub struct SessionAggregates {
    pub title: String,
    pub title_source: TitleSource,
    pub first_prompt: Option<String>,
    pub cwd: Option<String>,
    pub git_branch: Option<String>,
    pub created_ms: Option<f64>,
    pub last_active_ms: f64,
    pub duration_ms: f64,
    /// Human/command prompts + distinct assistant `message.id`s.
    pub message_count: u32,
    pub tool_call_count: u32,
    /// Counted once per `message.id` (max of each usage field).
    pub tokens: TokenTotals,
    pub models: Vec<String>,
    pub primary_model: Option<String>,
    pub versions: Vec<String>,
    pub leaf_uuid: Option<String>,
    pub root_uuid: Option<String>,
    /// From `forkedFrom`.
    pub fork_origin_id: Option<String>,
    pub fork_point_uuid: Option<String>,
    pub is_empty: bool,
    pub duplicate_uuids: u32,
}

impl Default for SessionAggregates {
    fn default() -> Self {
        SessionAggregates {
            title: String::new(),
            title_source: TitleSource::Untitled,
            first_prompt: None,
            cwd: None,
            git_branch: None,
            created_ms: None,
            last_active_ms: 0.0,
            duration_ms: 0.0,
            message_count: 0,
            tool_call_count: 0,
            tokens: TokenTotals::default(),
            models: Vec::new(),
            primary_model: None,
            versions: Vec::new(),
            leaf_uuid: None,
            root_uuid: None,
            fork_origin_id: None,
            fork_point_uuid: None,
            is_empty: true,
            duplicate_uuids: 0,
        }
    }
}

/// Per-agent figures read by the engine from the index (`messages` / `tool_calls` / `subagents`).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct AgentStats {
    pub message_count: u32,
    pub tool_call_count: u32,
    pub tokens: TokenTotals,
    pub started_ms: Option<f64>,
    pub ended_ms: Option<f64>,
    pub model: Option<String>,
}

/// One `<sid>/subagents/**/agent-<id>.meta.json` (raw; parsed in `subagent.rs`).
#[derive(Clone, Debug, PartialEq)]
pub struct SubagentMetaFile {
    pub agent_id: AgentId,
    pub role: FileRole,
    /// Set for `<sid>/subagents/workflows/<runId>/agent-*`.
    pub workflow_run_id: Option<String>,
    /// The agent transcript (`agent-<id>.jsonl`), if present.
    pub transcript_path: Option<PathBuf>,
    /// Contents of the `.meta.json`, if present.
    pub meta_json: Option<String>,
}

/// One Workflow Run's sidecar files (raw; parsed in `workflow.rs`).
#[derive(Clone, Debug, PartialEq)]
pub struct WorkflowFiles {
    pub run_id: String,
    /// Contents of `<sid>/workflows/<runId>.json`, if present.
    pub workflow_json: Option<String>,
    /// Contents of `<sid>/subagents/workflows/<runId>/journal.jsonl`, if present.
    pub journal_jsonl: Option<String>,
}

/// Everything assembly needs besides the main files; gathered by the engine.
#[derive(Clone, Debug, Default)]
pub struct SessionSidecar {
    pub subagent_metas: Vec<SubagentMetaFile>,
    pub workflows: Vec<WorkflowFiles>,
    /// A8: per-agent figures from the index.
    pub agent_stats: HashMap<AgentId, AgentStats>,
    /// Origin Session from the index (via `forkedFrom`, or the shared-`root_uuid` fallback of §3.4 step 8).
    pub fork_origin: Option<ForkOrigin>,
}

/// A fully assembled Session, cached by the engine (LRU) and queried by `transcript`, `tool_detail`,
/// `image`, `find` and `jump`.
#[derive(Debug, Default)]
pub struct AssembledSession {
    pub session_id: String,
    /// `<project dir>/<session id>/` (holds `subagents/`, `tool-results/`, `workflows/`).
    pub session_dir: PathBuf,
    /// Set by the engine: Σ(size, mtime) of the source and sidecar files.
    pub revision: f64,
    pub skeleton: SessionSkeleton,
    pub main_files: Vec<LoadedFile>,
    pub sidecar: SessionSidecar,
    pub subagents: Vec<SubagentRun>,
    pub workflows: Vec<WorkflowRun>,
    pub orphan_subagent_ids: Vec<AgentId>,
    /// Any entry uuid (fragment, absorbed tool_result, satellite) → display node id.
    pub display_id: HashMap<String, NodeId>,
}

/// Builds the skeleton of the main file(s) (§3.4 steps 1–4).
pub fn build_skeleton(_main_files: &[LoadedFile]) -> SessionSkeleton {
    SessionSkeleton::default()
}

/// Computes main-file aggregates (§3.4 steps 8–10).
pub fn summarize(_s: &SessionSkeleton) -> SessionAggregates {
    SessionAggregates::default()
}

/// Assembles a Session for display.
pub fn assemble(
    session_id: &str,
    session_dir: &Path,
    main_files: Vec<LoadedFile>,
    sidecar: SessionSidecar,
) -> AssembledSession {
    AssembledSession {
        session_id: session_id.to_owned(),
        session_dir: session_dir.to_path_buf(),
        main_files,
        sidecar,
        ..AssembledSession::default()
    }
}

/// Produces the transcript for the requested scope and branch choices. `agent_file` is the
/// Subagent Run's file when `r.scope` is `Subagent`.
pub fn transcript(
    _s: &AssembledSession,
    _r: &TranscriptRequest,
    _agent_file: Option<&LoadedFile>,
) -> CoreResult<Transcript> {
    Err(CoreError::NotImplemented("transcript"))
}
