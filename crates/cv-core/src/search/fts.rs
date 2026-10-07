//! FTS5 trigram search with LIKE fallback for terms shorter than 3 characters.

use rusqlite::Connection;

use crate::error::{CoreError, CoreResult};
use crate::model::{SearchRequest, SearchResponse};

/// `live` is the current Live Session id set (for `live_only`).
pub fn run_fts(
    _conn: &Connection,
    _r: &SearchRequest,
    _live: &[String],
) -> CoreResult<SearchResponse> {
    Err(CoreError::NotImplemented("search"))
}
