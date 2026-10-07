//! Engine facade: the only API src-tauri calls. Blocking; callers run it off the main thread.

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;

use crate::error::{CoreError, CoreResult};
use crate::index::schema::SCHEMA_VERSION;
use crate::model::{
    AppInfo, DataRootSource, Diagnostics, FindRequest, FindResult, ImageData, ImageRequest,
    IndexStatus, JumpRequest, JumpTarget, LiveChanged, ProjectSummary, SearchRequest,
    SearchResponse, SessionDetail, SessionQuery, SessionSummary, Stats, StatsRequest, ToolDetail,
    ToolDetailRequest, ToolOutputSearchEvent, Transcript, TranscriptRequest,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EngineConfig {
    /// Read-only Claude Code data root (ADR-0002).
    pub data_root: PathBuf,
    pub data_root_source: DataRootSource,
    /// App-owned cache dir holding `index.sqlite` (ADR-0003).
    pub cache_dir: PathBuf,
}

/// Session ids affected by a scan or a filesystem batch.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ChangeSet {
    pub changed: Vec<String>,
    pub removed: Vec<String>,
    pub projects_changed: bool,
}

#[derive(Debug)]
pub struct Engine {
    cfg: EngineConfig,
}

impl Engine {
    /// Creates the cache dir. Never writes under the data root.
    pub fn open(cfg: EngineConfig) -> CoreResult<Self> {
        std::fs::create_dir_all(&cfg.cache_dir)?;
        Ok(Engine { cfg })
    }

    pub fn app_info(&self) -> AppInfo {
        AppInfo {
            version: env!("CARGO_PKG_VERSION").to_owned(),
            data_root: self.cfg.data_root.display().to_string(),
            data_root_source: self.cfg.data_root_source,
            data_root_exists: self.cfg.data_root.is_dir(),
            cache_dir: self.cfg.cache_dir.display().to_string(),
            schema_version: SCHEMA_VERSION,
        }
    }

    pub fn index_status(&self) -> IndexStatus {
        IndexStatus::default()
    }

    /// Phase 1: stat walk + metadata parse of changed files.
    pub fn scan_all(&self, _p: &dyn Fn(&IndexStatus)) -> CoreResult<ChangeSet> {
        Err(CoreError::NotImplemented("scan_all"))
    }

    /// Phase 2: full-text backlog.
    pub fn index_text_backlog(
        &self,
        _p: &dyn Fn(&IndexStatus),
        _cancel: &AtomicBool,
    ) -> CoreResult<()> {
        Err(CoreError::NotImplemented("index_text_backlog"))
    }

    /// Applies a debounced filesystem batch.
    pub fn apply_changes(&self, _paths: &[PathBuf]) -> CoreResult<ChangeSet> {
        Err(CoreError::NotImplemented("apply_changes"))
    }

    /// Returns the new Live Session snapshot when it changed since the last poll.
    pub fn poll_live(&self) -> CoreResult<Option<LiveChanged>> {
        Err(CoreError::NotImplemented("poll_live"))
    }

    /// Drops and rebuilds the index.
    pub fn rebuild(&self) -> CoreResult<()> {
        Err(CoreError::NotImplemented("rebuild"))
    }

    pub fn list_projects(&self) -> CoreResult<Vec<ProjectSummary>> {
        Err(CoreError::NotImplemented("list_projects"))
    }

    pub fn list_sessions(&self, _q: &SessionQuery) -> CoreResult<Vec<SessionSummary>> {
        Err(CoreError::NotImplemented("list_sessions"))
    }

    pub fn get_session(&self, _id: &str) -> CoreResult<SessionDetail> {
        Err(CoreError::NotImplemented("get_session"))
    }

    pub fn get_transcript(&self, _r: &TranscriptRequest) -> CoreResult<Transcript> {
        Err(CoreError::NotImplemented("get_transcript"))
    }

    pub fn get_tool_detail(&self, _r: &ToolDetailRequest) -> CoreResult<ToolDetail> {
        Err(CoreError::NotImplemented("get_tool_detail"))
    }

    pub fn get_image(&self, _r: &ImageRequest) -> CoreResult<ImageData> {
        Err(CoreError::NotImplemented("get_image"))
    }

    pub fn resolve_jump(&self, _r: &JumpRequest) -> CoreResult<JumpTarget> {
        Err(CoreError::NotImplemented("resolve_jump"))
    }

    pub fn find_in_session(&self, _r: &FindRequest) -> CoreResult<FindResult> {
        Err(CoreError::NotImplemented("find_in_session"))
    }

    pub fn search(&self, _r: &SearchRequest) -> CoreResult<SearchResponse> {
        Err(CoreError::NotImplemented("search"))
    }

    /// Streams tool-output hits into `sink` until done or `cancel` is set.
    pub fn search_tool_output(
        &self,
        _r: &SearchRequest,
        _cancel: &AtomicBool,
        _sink: &mut dyn FnMut(ToolOutputSearchEvent),
    ) -> CoreResult<()> {
        Err(CoreError::NotImplemented("search_tool_output"))
    }

    pub fn stats(&self, _r: &StatsRequest) -> CoreResult<Stats> {
        Err(CoreError::NotImplemented("stats"))
    }

    pub fn diagnostics(&self) -> CoreResult<Diagnostics> {
        Err(CoreError::NotImplemented("diagnostics"))
    }

    /// Main file (or the agent file when `agent_id` is set) of a Session, for "在 Finder 中显示".
    pub fn session_file_path(
        &self,
        _session_id: &str,
        _agent_id: Option<&str>,
    ) -> CoreResult<PathBuf> {
        Err(CoreError::NotImplemented("session_file_path"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_creates_cache_dir_and_reports_app_info() {
        let tmp = tempfile::tempdir().unwrap();
        let cache_dir = tmp.path().join("cache");
        let engine = Engine::open(EngineConfig {
            data_root: tmp.path().join("missing-root"),
            data_root_source: DataRootSource::Default,
            cache_dir: cache_dir.clone(),
        })
        .unwrap();
        assert!(cache_dir.is_dir());
        let info = engine.app_info();
        assert!(!info.data_root_exists);
        assert_eq!(info.schema_version, SCHEMA_VERSION);
    }
}
