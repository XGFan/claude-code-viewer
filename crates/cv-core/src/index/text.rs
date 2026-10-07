//! Full-text document extraction and the FTS backlog (plan §4 "What gets indexed").

use std::collections::HashSet;
use std::sync::atomic::AtomicBool;

use rusqlite::Connection;

use crate::error::{CoreError, CoreResult};
use crate::parse::EntryRecord;

/// `msg_text.role`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum DocRole {
    User = 0,
    Assistant = 1,
    ToolInput = 2,
}

/// One row of `msg_text`.
#[derive(Clone, Debug, PartialEq)]
pub struct TextDoc {
    pub node_uuid: String,
    pub block_idx: u32,
    pub role: DocRole,
    pub ts_ms: Option<f64>,
    pub agent_id: Option<String>,
    /// Capped: 64 KB for prompts and assistant text, 16 KB for tool inputs.
    pub body: String,
}

/// Searchable documents of one entry (human/command prompts, assistant text, tool inputs).
pub fn extract_docs(_rec: &EntryRecord, _agent_id: Option<&str>) -> Vec<TextDoc> {
    Vec::new()
}

/// Indexes `[text_offset, parsed_offset)` of every file with a backlog. `main_set` returns the
/// Main Line uuid set of a session (A2) so `on_main_line` is set at insert time; `progress`
/// receives (bytes done, bytes total).
pub fn index_pending(
    _conn: &mut Connection,
    _main_set: &mut dyn FnMut(&str) -> HashSet<String>,
    _progress: &dyn Fn(u64, u64),
    _cancel: &AtomicBool,
) -> CoreResult<()> {
    Err(CoreError::NotImplemented("index_pending"))
}
