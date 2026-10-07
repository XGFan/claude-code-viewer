//! Stats panel aggregation (local-time day / week×hour buckets, A13).

use rusqlite::Connection;

use crate::error::{CoreError, CoreResult};
use crate::model::{Stats, StatsRequest};

pub fn compute(_conn: &Connection, _r: &StatsRequest) -> CoreResult<Stats> {
    Err(CoreError::NotImplemented("stats"))
}
