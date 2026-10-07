//! Full tool input/output (including persisted `tool-results/<basename>`) and image data.

use super::{AssembledSession, LoadedFile};
use crate::error::{CoreError, CoreResult};
use crate::model::{ImageData, ImageRequest, ToolDetail, ToolDetailRequest};

/// `ToolPart::Output` of a persisted result reads `<session_dir>/tool-results/<basename>` and
/// rejects names containing `/` or `..`.
pub fn tool_detail(
    _s: &AssembledSession,
    _r: &ToolDetailRequest,
    _agent_file: Option<&LoadedFile>,
) -> CoreResult<ToolDetail> {
    Err(CoreError::NotImplemented("tool_detail"))
}

pub fn image(
    _s: &AssembledSession,
    _r: &ImageRequest,
    _agent_file: Option<&LoadedFile>,
) -> CoreResult<ImageData> {
    Err(CoreError::NotImplemented("image"))
}
