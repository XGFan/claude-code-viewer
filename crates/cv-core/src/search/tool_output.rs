//! Brute-force tool-output scan over source files and persisted `tool-results/*.txt`.

use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

use super::query::ParsedQuery;
use crate::error::{CoreError, CoreResult};
use crate::model::ToolOutputSearchEvent;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ScanTargetKind {
    /// A main or subagent JSONL file.
    Jsonl,
    /// A `tool-results/<name>.txt` file; hits map to a tool_use_id via `persisted_outputs`.
    PersistedOutput,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ScanTarget {
    pub session_id: String,
    pub agent_id: Option<String>,
    pub path: PathBuf,
    pub kind: ScanTargetKind,
}

/// Emits `Groups` about every 200 ms and a final `Done`; honours `cancel`.
pub fn run_tool_output_scan(
    _root: &Path,
    _targets: Vec<ScanTarget>,
    _q: &ParsedQuery,
    _cancel: &AtomicBool,
    _sink: &mut dyn FnMut(ToolOutputSearchEvent),
) -> CoreResult<()> {
    Err(CoreError::NotImplemented("search_tool_output"))
}
