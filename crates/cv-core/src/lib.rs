//! Claude Viewer core: tolerant parsing, assembly, index, search and stats over a Claude Code
//! data root. Strictly read-only on the data root (ADR-0002); no tauri dependency.

pub mod assemble;
pub mod diag;
pub mod engine;
pub mod error;
pub mod index;
pub mod known;
pub mod live;
pub mod model;
pub mod parse;
pub mod paths;
pub mod raw;
pub mod scan;
pub mod search;
pub mod stats;

pub use engine::{ChangeSet, Engine, EngineConfig};
pub use error::{CoreError, CoreResult};
