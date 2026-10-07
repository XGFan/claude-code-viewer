//! `PromptOrigin` classification; `<command-name>` and `<task-notification>` parsing.

use crate::model::PromptOrigin;
use crate::raw::RawEntry;

/// Title / first-prompt length cap in characters (§3.4 step 9).
pub const TITLE_CHARS: usize = 120;

/// Text of a user message: the plain string content, or its `text` blocks joined by `\n`.
pub fn user_text(e: &RawEntry) -> String {
    if let Some(t) = e.content_text() {
        return t.to_owned();
    }
    let mut out = String::new();
    for b in e.blocks() {
        if b.block_type() == "text"
            && let Some(t) = b.text_str()
        {
            if !out.is_empty() {
                out.push('\n');
            }
            out.push_str(&t);
        }
    }
    out
}

/// Classifies a user entry that is neither a tool result nor a compact summary.
pub fn classify(e: &RawEntry, text: &str) -> PromptOrigin {
    if e.is_meta == Some(true) {
        return PromptOrigin::Meta;
    }
    let t = text.trim_start();
    let origin_kind = e.origin.as_ref().and_then(|o| o.kind.as_deref());
    if origin_kind == Some("task-notification") || t.starts_with("<task-notification>") {
        return PromptOrigin::TaskNotification {
            task_id: tag(t, "task-id"),
            tool_use_id: tag(t, "tool-use-id"),
            status: tag(t, "status"),
            summary: tag(t, "summary"),
        };
    }
    if (t.starts_with("<command-name>") || t.starts_with("<command-message>"))
        && let Some(name) = tag(t, "command-name")
    {
        return PromptOrigin::Command {
            name,
            args: tag(t, "command-args").unwrap_or_default(),
        };
    }
    if t.starts_with("<local-command-stdout>")
        || t.starts_with("<local-command-stderr>")
        || t.starts_with("<bash-stdout>")
        || t.starts_with("<bash-stderr>")
    {
        return PromptOrigin::CommandOutput;
    }
    if t.starts_with("<local-command-caveat>") || t.starts_with("<system-reminder>") {
        return PromptOrigin::Meta;
    }
    PromptOrigin::Human
}

/// A human or command prompt typed by the user: counts as a message, can head a Branch and
/// supplies the title. Excludes other origins (`peer`, …), meta, outputs and notifications.
pub fn is_human(e: &RawEntry, origin: &PromptOrigin) -> bool {
    let kind_ok = match e.origin.as_ref().and_then(|o| o.kind.as_deref()) {
        None | Some("human") => true,
        Some(_) => false,
    };
    kind_ok && matches!(origin, PromptOrigin::Human | PromptOrigin::Command { .. })
}

/// [`is_human`] for any entry: a `user` entry that is not a tool result or compact summary and
/// classifies as a human or command prompt. Shared by assembly, the index and text extraction.
pub fn is_human_prompt(e: &RawEntry) -> bool {
    if e.entry_type() != "user" || e.is_tool_result() || e.is_compact_summary == Some(true) {
        return false;
    }
    let text = user_text(e);
    is_human(e, &classify(e, &text))
}

/// Title form of a prompt: `"name args"` for a command, else the text; whitespace collapsed,
/// truncated to [`TITLE_CHARS`] characters.
pub fn title_text(origin: &PromptOrigin, text: &str) -> String {
    let raw = match origin {
        PromptOrigin::Command { name, args } => format!("{name} {args}"),
        _ => text.to_owned(),
    };
    let collapsed = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    truncate_chars(&collapsed, TITLE_CHARS)
}

/// First `n` characters of `s`.
pub fn truncate_chars(s: &str, n: usize) -> String {
    match s.char_indices().nth(n) {
        Some((i, _)) => s[..i].to_owned(),
        None => s.to_owned(),
    }
}

/// Inner text of the first `<name>…</name>` in `s`, trimmed; `None` when absent or empty.
pub fn tag(s: &str, name: &str) -> Option<String> {
    let open = format!("<{name}>");
    let close = format!("</{name}>");
    let start = s.find(&open)? + open.len();
    let end = s[start..].find(&close)? + start;
    let v = s[start..end].trim();
    (!v.is_empty()).then(|| v.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(json: &str) -> RawEntry {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn classifies_commands_notifications_and_outputs() {
        let e = entry(r#"{"type":"user","message":{"content":"x"}}"#);
        let cmd = "<command-message>release</command-message>\n<command-name>/release</command-name>\n<command-args>v1.2.0</command-args>";
        let o = classify(&e, cmd);
        assert_eq!(
            o,
            PromptOrigin::Command {
                name: "/release".into(),
                args: "v1.2.0".into()
            }
        );
        assert_eq!(title_text(&o, cmd), "/release v1.2.0");
        assert!(is_human(&e, &o));

        let n = "<task-notification>\n<task-id>a1</task-id>\n<tool-use-id>toolu_1</tool-use-id>\n<status>completed</status>\n<summary>done</summary>\n</task-notification>";
        match classify(&e, n) {
            PromptOrigin::TaskNotification {
                task_id,
                tool_use_id,
                status,
                summary,
            } => {
                assert_eq!(task_id.as_deref(), Some("a1"));
                assert_eq!(tool_use_id.as_deref(), Some("toolu_1"));
                assert_eq!(status.as_deref(), Some("completed"));
                assert_eq!(summary.as_deref(), Some("done"));
            }
            o => panic!("unexpected {o:?}"),
        }
        assert_eq!(
            classify(&e, "<local-command-stdout>ok</local-command-stdout>"),
            PromptOrigin::CommandOutput
        );
        let meta = entry(r#"{"type":"user","isMeta":true}"#);
        assert_eq!(classify(&meta, "hi"), PromptOrigin::Meta);
        let peer = entry(r#"{"type":"user","origin":{"kind":"peer"}}"#);
        assert!(!is_human(&peer, &classify(&peer, "hi")));
    }

    #[test]
    fn title_collapses_whitespace_and_truncates() {
        let t = title_text(
            &PromptOrigin::Human,
            &format!("  a\n\nb {}", "x".repeat(200)),
        );
        assert!(t.starts_with("a b x"));
        assert_eq!(t.chars().count(), TITLE_CHARS);
    }
}
