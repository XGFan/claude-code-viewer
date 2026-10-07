//! Query parser: whitespace AND, `"phrase"`, `-exclude`.

use crate::error::{CoreError, CoreResult};

/// Literal substring terms (phrases keep their inner spaces).
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ParsedQuery {
    pub include: Vec<String>,
    pub exclude: Vec<String>,
}

/// An all-exclusion query is `InvalidQuery`.
pub fn parse_query(_q: &str) -> CoreResult<ParsedQuery> {
    Err(CoreError::NotImplemented("parse_query"))
}
