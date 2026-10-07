//! Format-compatibility diagnostics from `files`, `diag_counts` and version aggregation.

use rusqlite::Connection;

use crate::error::{CoreError, CoreResult};
use crate::model::Diagnostics;

pub fn compute(_conn: &Connection) -> CoreResult<Diagnostics> {
    Err(CoreError::NotImplemented("diagnostics"))
}
