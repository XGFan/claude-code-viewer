//! ⌘F within a Session: searches the full text of nodes, tool inputs and outputs.

use super::{AssembledSession, LoadedFile};
use crate::error::{CoreError, CoreResult};
use crate::model::{FindRequest, FindResult};

pub fn find(
    _s: &AssembledSession,
    _r: &FindRequest,
    _agent_file: Option<&LoadedFile>,
) -> CoreResult<FindResult> {
    Err(CoreError::NotImplemented("find"))
}
