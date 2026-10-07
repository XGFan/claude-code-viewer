//! DDL and schema version (plan §4).

/// `PRAGMA user_version`; any mismatch deletes and recreates the index.
pub const SCHEMA_VERSION: u32 = 1;
