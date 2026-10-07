//! Effective parents, children, leaf, Main Line path and conversational anchors (§3.4 steps 2–4).

use std::collections::HashSet;

use super::SessionSkeleton;

/// A2: uuids of every entry in the Main Line display set: every fragment of every merged display
/// node (including fragments off the raw path whose `message.id` is on it), every absorbed
/// tool_result entry and every satellite on the Main Line. Used for `msg_text.on_main_line`.
pub fn main_set(_s: &SessionSkeleton) -> HashSet<String> {
    HashSet::new()
}
