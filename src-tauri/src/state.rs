//! Shared app state managed by tauri.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

use cv_core::Engine;
use parking_lot::{Mutex, RwLock};

pub struct AppState {
    /// Swapped as a whole by `set_data_root`.
    pub engine: RwLock<Arc<Engine>>,
    /// Cancel flags of running tool-output searches, by search id.
    pub searches: Mutex<HashMap<u32, Arc<AtomicBool>>>,
    next_search_id: AtomicU32,
}

impl AppState {
    pub fn new(engine: Engine) -> Self {
        AppState {
            engine: RwLock::new(Arc::new(engine)),
            searches: Mutex::new(HashMap::new()),
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

    pub fn cancel_search(&self, id: u32) {
        if let Some(flag) = self.searches.lock().get(&id) {
            flag.store(true, Ordering::Relaxed);
        }
    }
}
