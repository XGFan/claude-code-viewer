//! Search: query parsing, FTS5 trigram / LIKE search and the tool-output scan.

pub mod fts;
pub mod query;
pub mod snippet;
pub mod tool_output;

pub use fts::run_fts;
pub use query::{ParsedQuery, parse_query};
pub use tool_output::{ScanTarget, ScanTargetKind, run_tool_output_scan};
