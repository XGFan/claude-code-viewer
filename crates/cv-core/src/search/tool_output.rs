//! Brute-force tool-output scan over source files and persisted `tool-results/*.txt`.
//!
//! Files are scanned in parallel (rayon). JSONL lines are prefiltered with an
//! ASCII-case-insensitive search for the JSON-escaped longest positive term (text is stored as
//! raw UTF-8, F14); candidate lines are parsed and every term / exclusion is verified on the
//! decoded tool_result text plus `toolUseResult.stdout`. Matching is ASCII-case-insensitive, like
//! the LIKE fallback.
//!
//! Hits: `node_id` is the tool_result entry uuid (`resolve_jump` maps it to the display node);
//! a persisted `.txt` hit has an empty `node_id` and is located by `tool_use_id`. One hit per
//! tool call and Session (copies and `.txt` duplicates of an inline preview collapse).

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use aho_corasick::AhoCorasick;
use rayon::prelude::*;
use serde::Deserialize;

use super::query::ParsedQuery;
use super::snippet;
use crate::assemble::{self, LoadedFile, nodes};
use crate::error::CoreResult;
use crate::model::{
    FileRole, SearchGroup, SearchHit, SearchRequest, SearchRole, SessionSummary,
    ToolOutputSearchEvent,
};
use crate::parse::parse_bytes;
use crate::raw::{RawEntry, lenient};

/// Interval between `Groups` / `Progress` events.
const EMIT_EVERY: Duration = Duration::from_millis(200);
/// Lines between cancel checks inside one file.
const CANCEL_CHECK_LINES: usize = 4096;
const DEFAULT_HITS_PER_SESSION: u32 = 5;

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
    /// `persisted_outputs.tool_use_id` of a [`ScanTargetKind::PersistedOutput`] file.
    pub tool_use_id: Option<String>,
}

/// Emits `Progress` and `Groups` about every 200 ms and a final `Done`; honours `cancel`.
/// `sessions` are the Sessions passing the request filters (targets of other Sessions are
/// skipped). Each `Groups` event carries only hits found since the previous one: `hit_count`
/// and `hits` add up per Session, with at most `hits_per_session` hits in total.
pub fn run_tool_output_scan(
    targets: Vec<ScanTarget>,
    sessions: &[SessionSummary],
    r: &SearchRequest,
    q: &ParsedQuery,
    cancel: &AtomicBool,
    sink: &mut dyn FnMut(ToolOutputSearchEvent),
) -> CoreResult<()> {
    let started = Instant::now();
    let by_id: HashMap<&str, &SessionSummary> =
        sessions.iter().map(|s| (s.id.as_str(), s)).collect();
    let targets: Vec<ScanTarget> = targets
        .into_iter()
        .filter(|t| by_id.contains_key(t.session_id.as_str()))
        .collect();
    let total = targets.len() as u32;
    let Some(m) = Matchers::new(q) else {
        sink(ToolOutputSearchEvent::Done {
            elapsed_ms: 0.0,
            cancelled: false,
        });
        return Ok(());
    };
    let time = r.time_range.clone();
    let in_range = move |ts: Option<f64>| {
        let (Some(tr), Some(ts)) = (&time, ts) else {
            return true;
        };
        tr.from_ms.is_none_or(|f| ts >= f) && tr.to_ms.is_none_or(|t| ts <= t)
    };
    let cap = if r.hits_per_session == 0 {
        DEFAULT_HITS_PER_SESSION
    } else {
        r.hits_per_session
    };
    let mut agg = Aggregator {
        cap,
        sessions: HashMap::new(),
    };
    // (session id, agent id) → the agent's JSONL; its `.meta.json` names the agent type.
    let agent_files: HashMap<(String, String), PathBuf> = targets
        .iter()
        .filter(|t| t.kind == ScanTargetKind::Jsonl)
        .filter_map(|t| {
            let a = t.agent_id.clone()?;
            Some(((t.session_id.clone(), a), t.path.clone()))
        })
        .collect();
    let agent_files = &agent_files;
    let mut done = 0u32;
    std::thread::scope(|scope| {
        let (tx, rx) = crossbeam_channel::unbounded::<(String, Vec<SearchHit>)>();
        let m = &m;
        let in_range = &in_range;
        scope.spawn(move || {
            targets.par_iter().for_each_with(tx, |tx, t| {
                let hits = if cancel.load(Ordering::Relaxed) {
                    Vec::new()
                } else {
                    let mut hits = scan_target(t, m, cancel);
                    hits.retain(|h| in_range(h.timestamp_ms));
                    if let (Some(a), false) = (&t.agent_id, hits.is_empty()) {
                        let agent_type = agent_files
                            .get(&(t.session_id.clone(), a.clone()))
                            .and_then(|p| {
                                std::fs::read_to_string(p.with_extension("meta.json")).ok()
                            })
                            .and_then(|j| assemble::subagent::parse_meta(Some(&j)).agent_type);
                        for h in &mut hits {
                            h.agent_type = agent_type.clone();
                        }
                    }
                    hits
                };
                let _ = tx.send((t.session_id.clone(), hits));
            });
        });
        let mut last_emit = Instant::now();
        loop {
            match rx.recv_timeout(Duration::from_millis(50)) {
                Ok((sid, hits)) => {
                    done += 1;
                    agg.add(sid, hits);
                }
                Err(crossbeam_channel::RecvTimeoutError::Timeout) => {}
                Err(crossbeam_channel::RecvTimeoutError::Disconnected) => break,
            }
            if last_emit.elapsed() >= EMIT_EVERY {
                last_emit = Instant::now();
                sink(ToolOutputSearchEvent::Progress {
                    files_done: done,
                    files_total: total,
                });
                if let Some(groups) = agg.take_groups(&by_id) {
                    sink(ToolOutputSearchEvent::Groups { groups });
                }
            }
        }
    });
    sink(ToolOutputSearchEvent::Progress {
        files_done: done,
        files_total: total,
    });
    if let Some(groups) = agg.take_groups(&by_id) {
        sink(ToolOutputSearchEvent::Groups { groups });
    }
    sink(ToolOutputSearchEvent::Done {
        elapsed_ms: started.elapsed().as_secs_f64() * 1e3,
        cancelled: cancel.load(Ordering::Relaxed),
    });
    Ok(())
}

/// Prefilters and per-term verifiers (all ASCII-case-insensitive).
struct Matchers {
    /// Longest positive term, JSON-escaped (for JSONL lines).
    json: AhoCorasick,
    /// Longest positive term as is (for `.txt` files).
    raw: AhoCorasick,
    include: Vec<AhoCorasick>,
    exclude: Vec<AhoCorasick>,
    terms: Vec<String>,
}

impl Matchers {
    fn new(q: &ParsedQuery) -> Option<Self> {
        let longest = q.include.iter().max_by_key(|t| t.len())?;
        let escaped = serde_json::to_string(longest).ok()?;
        let escaped = escaped[1..escaped.len() - 1].to_owned();
        let one = |t: &String| snippet::matcher(std::slice::from_ref(t));
        Some(Matchers {
            json: snippet::matcher(&[escaped])?,
            raw: one(longest)?,
            include: q.include.iter().map(one).collect::<Option<_>>()?,
            exclude: q.exclude.iter().filter_map(one).collect(),
            terms: q.include.clone(),
        })
    }

    fn verify(&self, text: &str) -> bool {
        self.include.iter().all(|m| m.is_match(text))
            && !self.exclude.iter().any(|m| m.is_match(text))
    }
}

/// Per-Session hit bookkeeping between emits.
struct Aggregator {
    cap: u32,
    sessions: HashMap<String, SessionHits>,
}

#[derive(Default)]
struct SessionHits {
    /// (agent id, tool_use id or node id) already counted.
    seen: HashSet<(Option<String>, String)>,
    emitted: u32,
    pending: Vec<SearchHit>,
    pending_count: u32,
}

impl Aggregator {
    fn add(&mut self, sid: String, hits: Vec<SearchHit>) {
        if hits.is_empty() {
            return;
        }
        let s = self.sessions.entry(sid).or_default();
        for h in hits {
            let key = (
                h.agent_id.clone(),
                h.tool_use_id.clone().unwrap_or_else(|| h.node_id.clone()),
            );
            if !s.seen.insert(key) {
                continue;
            }
            s.pending_count += 1;
            if s.emitted + (s.pending.len() as u32) < self.cap {
                s.pending.push(h);
            }
        }
    }

    /// Groups with hits since the last call, newest Session first.
    fn take_groups(&mut self, by_id: &HashMap<&str, &SessionSummary>) -> Option<Vec<SearchGroup>> {
        let mut groups = Vec::new();
        for (sid, s) in &mut self.sessions {
            if s.pending_count == 0 {
                continue;
            }
            let Some(summary) = by_id.get(sid.as_str()) else {
                continue;
            };
            let hits = std::mem::take(&mut s.pending);
            s.emitted += hits.len() as u32;
            groups.push(SearchGroup {
                session: (*summary).clone(),
                hit_count: std::mem::take(&mut s.pending_count),
                hits,
            });
        }
        groups.sort_by(|a, b| {
            b.session
                .last_active_ms
                .total_cmp(&a.session.last_active_ms)
        });
        (!groups.is_empty()).then_some(groups)
    }
}

fn scan_target(t: &ScanTarget, m: &Matchers, cancel: &AtomicBool) -> Vec<SearchHit> {
    match t.kind {
        ScanTargetKind::Jsonl => scan_jsonl(t, m, cancel),
        ScanTargetKind::PersistedOutput => scan_txt(t, m).into_iter().collect(),
    }
}

#[derive(Deserialize)]
struct Stdout {
    #[serde(default, deserialize_with = "lenient::string")]
    stdout: Option<String>,
}

fn scan_jsonl(t: &ScanTarget, m: &Matchers, cancel: &AtomicBool) -> Vec<SearchHit> {
    let Ok(buf) = std::fs::read(&t.path) else {
        tracing::warn!(path = %t.path.display(), "读取会话文件失败");
        return Vec::new();
    };
    let mut hits = Vec::new();
    let mut start = 0usize;
    for (n, nl) in memchr::memchr_iter(b'\n', &buf).enumerate() {
        if n % CANCEL_CHECK_LINES == 0 && cancel.load(Ordering::Relaxed) {
            return Vec::new();
        }
        let line = &buf[start..nl];
        start = nl + 1;
        if !m.json.is_match(line) {
            continue;
        }
        let Ok(e) = serde_json::from_slice::<RawEntry>(line) else {
            continue;
        };
        if e.entry_type() != "user" {
            continue;
        }
        let Some(uuid) = e.uuid.clone() else { continue };
        let stdout = e
            .tool_use_result
            .as_deref()
            .filter(|r| r.get().starts_with('{'))
            .and_then(|r| serde_json::from_str::<Stdout>(r.get()).ok())
            .and_then(|s| s.stdout)
            .unwrap_or_default();
        for b in e
            .blocks()
            .iter()
            .filter(|b| b.block_type() == "tool_result")
        {
            let (mut text, _) = nodes::result_content(b.content.as_deref());
            if !stdout.is_empty() && !text.contains(stdout.as_str()) {
                text.push('\n');
                text.push_str(&stdout);
            }
            if !m.verify(&text) {
                continue;
            }
            hits.push(SearchHit {
                node_id: uuid.clone(),
                agent_id: t.agent_id.clone(),
                agent_type: None,
                tool_use_id: b.tool_use_id.clone(),
                role: SearchRole::ToolOutput,
                timestamp_ms: e.timestamp_ms(),
                on_main_line: true,
                snippet: snippet::window(&text, &m.terms),
            });
        }
    }
    if t.agent_id.is_none() && !hits.is_empty() {
        // Main file: the Main Line set of this file (A2) labels hits in abandoned Branches.
        let file = LoadedFile {
            path: t.path.clone(),
            role: FileRole::Main,
            agent_id: None,
            records: parse_bytes(&buf, 0).records,
        };
        let main = assemble::tree::main_set(&assemble::build_skeleton(std::slice::from_ref(&file)));
        for h in &mut hits {
            h.on_main_line = main.contains(&h.node_id);
        }
    }
    hits
}

fn scan_txt(t: &ScanTarget, m: &Matchers) -> Option<SearchHit> {
    let bytes = std::fs::read(&t.path).ok()?;
    if !m.raw.is_match(&bytes) {
        return None;
    }
    let text = String::from_utf8_lossy(&bytes);
    if !m.verify(&text) {
        return None;
    }
    let mtime = std::fs::metadata(&t.path)
        .and_then(|md| md.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as f64);
    Some(SearchHit {
        node_id: String::new(),
        agent_id: t.agent_id.clone(),
        agent_type: None,
        tool_use_id: t.tool_use_id.clone(),
        role: SearchRole::ToolOutput,
        timestamp_ms: mtime,
        on_main_line: true,
        snippet: snippet::window(&text, &m.terms),
    })
}
