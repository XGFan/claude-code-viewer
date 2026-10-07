//! Shared app state managed by tauri.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

use cv_core::{CoreResult, Engine, EngineConfig, paths};
use parking_lot::{Mutex, RwLock};

use crate::settings::Settings;
use crate::worker::JobSender;

pub struct AppState {
    /// Swapped as a whole by `set_data_root`.
    pub engine: RwLock<Arc<Engine>>,
    /// Cancel flags of running tool-output searches, by search id.
    pub searches: Mutex<HashMap<u32, Arc<AtomicBool>>>,
    pub jobs: JobSender,
    next_search_id: AtomicU32,
}

/// Opens the Engine on the data root resolved from `settings` > `$CLAUDE_CONFIG_DIR` > `~/.claude`.
pub fn open_engine(settings: &Settings) -> CoreResult<Engine> {
    let root = paths::resolve_data_root(settings.data_root.as_deref().map(Path::new));
    Engine::open(EngineConfig {
        data_root: root.path,
        data_root_source: root.source,
        cache_dir: paths::default_cache_dir(),
    })
}

impl AppState {
    pub fn new(engine: Engine, jobs: JobSender) -> Self {
        AppState {
            engine: RwLock::new(Arc::new(engine)),
            searches: Mutex::new(HashMap::new()),
            jobs,
            next_search_id: AtomicU32::new(1),
        }
    }

    pub fn engine(&self) -> Arc<Engine> {
        self.engine.read().clone()
    }

    /// Registers a new tool-output search and returns its id and cancel flag.
    pub fn start_search(&self) -> (u32, Arc<AtomicBool>) {
        let id = self.next_search_id.fetch_add(1, Ordering::Relaxed);
        let cancel = Arc::new(AtomicBool::new(false));
        self.searches.lock().insert(id, cancel.clone());
        (id, cancel)
    }

    pub fn finish_search(&self, id: u32) {
        self.searches.lock().remove(&id);
    }

    /// Cancels every running search (their Engine is about to be replaced).
    pub fn cancel_all_searches(&self) {
        for flag in self.searches.lock().values() {
            flag.store(true, Ordering::Relaxed);
        }
    }

    pub fn cancel_search(&self, id: u32) {
        if let Some(flag) = self.searches.lock().get(&id) {
            flag.store(true, Ordering::Relaxed);
        }
    }
}
