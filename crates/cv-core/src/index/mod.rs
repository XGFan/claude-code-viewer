//! SQLite index: a disposable mirror cache in the app's Caches folder (ADR-0003).
//! Opened with WAL and `synchronous=NORMAL`; rebuilt (never migrated) when
//! `PRAGMA user_version` or `meta.data_root` differ.

pub mod reader;
pub mod schema;
pub mod text;
pub mod writer;

use std::path::{Path, PathBuf};

use crate::error::{CoreError, CoreResult};

/// Writer connection + read pool.
#[derive(Debug)]
pub struct Index {
    pub path: PathBuf,
}

impl Index {
    /// Opens (or recreates) the index at `path` for `data_root`.
    pub fn open(_path: &Path, _data_root: &Path) -> CoreResult<Self> {
        Err(CoreError::NotImplemented("index"))
    }
}
