//! Resolves a search hit to a display target (scope, branch choices, agent path, hidden flag).

use super::AssembledSession;
use crate::error::{CoreError, CoreResult};
use crate::model::{JumpRequest, JumpTarget};

pub fn jump(_s: &AssembledSession, _r: &JumpRequest) -> CoreResult<JumpTarget> {
    Err(CoreError::NotImplemented("jump"))
}
