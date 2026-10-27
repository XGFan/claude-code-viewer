use serde::{Deserialize, Serialize};
use specta::Type;
use specta_typescript::Number;

use super::common::{SessionId, TimeRange};

/// Days and week-hours are bucketed in local time (`chrono::Local`, DST-correct).
#[derive(Serialize, Deserialize, Type, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatsRequest {
    pub time_range: Option<TimeRange>,
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
    /// API cost in USD, main + subagents.
    #[specta(type = Number)]
    pub cost: f64,
    /// Assistant messages whose model has no price (not in `cost`).
    pub unpriced_messages: u32,
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
pub struct SessionStat {
    pub session_id: SessionId,
    pub title: String,
    /// Main-file messages in range.
    pub messages: u32,
    #[specta(type = Number)]
    pub output_tokens: f64,
    #[specta(type = Number)]
    pub cost: f64,
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
    /// The most expensive sessions in range (at most [`crate::stats::TOP_SESSIONS`]).
    pub sessions: Vec<SessionStat>,
    pub tools: Vec<ToolStat>,
    pub subagents: Vec<AgentTypeStat>,
}
