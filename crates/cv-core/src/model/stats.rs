use serde::{Deserialize, Serialize};
use specta::Type;
use specta_typescript::Number;

use super::common::{ProjectId, TimeRange};

/// Days and week-hours are bucketed in local time (`chrono::Local`, DST-correct).
#[derive(Serialize, Deserialize, Type, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatsRequest {
    pub time_range: Option<TimeRange>,
    /// Empty = all projects.
    pub project_ids: Vec<ProjectId>,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatsOverview {
    pub sessions: u32,
    /// Main-file messages only (same definition as `message_count`).
    pub messages: u32,
    /// Main + subagents.
    #[specta(type = Number)]
    pub output_tokens: f64,
    pub active_days: u32,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DailyModelTokens {
    pub day: String,
    pub model: String,
    #[specta(type = Number)]
    pub input: f64,
    #[specta(type = Number)]
    pub output: f64,
    #[specta(type = Number)]
    pub cache_read: f64,
    #[specta(type = Number)]
    pub cache_creation: f64,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DayCount {
    pub day: String,
    pub messages: u32,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WeekHourCount {
    /// 0 = Monday.
    pub weekday: u32,
    pub hour: u32,
    pub messages: u32,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStat {
    pub project_id: ProjectId,
    pub display_name: String,
    pub sessions: u32,
    pub messages: u32,
    #[specta(type = Number)]
    pub output_tokens: f64,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ToolStat {
    pub name: String,
    pub calls: u32,
    pub failures: u32,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentTypeStat {
    pub agent_type: String,
    pub runs: u32,
    #[specta(type = Number)]
    pub output_tokens: f64,
    #[specta(type = Number)]
    pub avg_duration_ms: f64,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub overview: StatsOverview,
    pub daily: Vec<DailyModelTokens>,
    pub heat_daily: Vec<DayCount>,
    pub heat_week_hour: Vec<WeekHourCount>,
    pub projects: Vec<ProjectStat>,
    pub tools: Vec<ToolStat>,
    pub subagents: Vec<AgentTypeStat>,
}
