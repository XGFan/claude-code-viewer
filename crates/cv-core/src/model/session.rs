use serde::{Deserialize, Serialize};
use specta::Type;
use specta_typescript::Number;

use super::common::{LiveState, NodeId, ProjectId, SessionId, TimeRange, TokenTotals};

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: ProjectId,
    pub path: String,
    pub display_name: String,
    /// The project directory no longer exists on disk.
    pub missing: bool,
    pub session_count: u32,
    pub live_count: u32,
    #[specta(type = Number)]
    pub last_active_ms: f64,
}

#[derive(Serialize, Deserialize, Type, Clone, Copy, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SessionSort {
    #[default]
    LastActive,
    Created,
    Messages,
    /// Sorts by output tokens (main + subagents).
    Tokens,
}

/// Stats drill-down filter; days and week-hours are bucketed in local time.
#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Drill {
    /// `day` is `YYYY-MM-DD`.
    Day {
        day: String,
    },
    /// `weekday` 0 = Monday.
    WeekHour {
        weekday: u32,
        hour: u32,
    },
    Tool {
        name: String,
    },
    AgentType {
        agent_type: String,
    },
    Model {
        model: String,
    },
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionQuery {
    /// Empty = all projects.
    pub project_ids: Vec<ProjectId>,
    pub sort: SessionSort,
    pub descending: bool,
    pub live_only: bool,
    pub time_range: Option<TimeRange>,
    pub drill: Option<Drill>,
}

#[derive(Serialize, Deserialize, Type, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TitleSource {
    Custom,
    Ai,
    FirstPrompt,
    Untitled,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ForkOrigin {
    pub session_id: SessionId,
    pub title: Option<String>,
    pub fork_point_id: Option<NodeId>,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: SessionId,
    pub project_id: ProjectId,
    pub title: String,
    pub title_source: TitleSource,
    #[specta(type = Number)]
    pub created_ms: f64,
    #[specta(type = Number)]
    pub last_active_ms: f64,
    pub message_count: u32,
    pub tool_call_count: u32,
    pub subagent_count: u32,
    /// Main + all subagents.
    pub tokens: TokenTotals,
    pub git_branch: Option<String>,
    pub live: Option<LiveState>,
    pub fork_origin: Option<ForkOrigin>,
    pub primary_model: Option<String>,
}

#[derive(Serialize, Deserialize, Type, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FileRole {
    Main,
    Subagent,
    WorkflowSubagent,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SourceFile {
    pub path: String,
    #[specta(type = Number)]
    pub size: f64,
    pub role: FileRole,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ForkChild {
    pub session_id: SessionId,
    pub title: String,
    #[specta(type = Number)]
    pub created_ms: f64,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionDetail {
    pub summary: SessionSummary,
    pub cwd: Option<String>,
    pub project_path: String,
    pub project_missing: bool,
    #[specta(type = Number)]
    pub duration_ms: f64,
    pub models: Vec<String>,
    pub tokens_main: TokenTotals,
    pub tokens_subagents: TokenTotals,
    pub versions: Vec<String>,
    pub files: Vec<SourceFile>,
    pub forks: Vec<ForkChild>,
    pub failed_lines: u32,
    /// `claude --resume <id>`.
    pub resume_command: String,
}
