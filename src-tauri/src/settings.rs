//! The app's own settings (`~/Library/Application Support/dev.joy.claude-viewer/settings.json`).

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

pub const SETTINGS_FILE: &str = "settings.json";

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Data root override; `None` = `$CLAUDE_CONFIG_DIR` or `~/.claude`.
    pub data_root: Option<String>,
}

pub fn settings_path() -> PathBuf {
    cv_core::paths::default_settings_dir().join(SETTINGS_FILE)
}

/// Missing or unreadable settings fall back to defaults.
pub fn load() -> Settings {
    std::fs::read(settings_path())
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}
