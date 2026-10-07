//! Stats panel aggregation (local-time day / week×hour buckets, A13).
//!
//! Semantics (each chart dimension has a [`Drill`](crate::model::Drill) in `index::reader` that
//! returns exactly the contributing sessions):
//! - Scope: non-empty sessions, optionally restricted to `project_ids`; the time range applies
//!   to each row's own timestamp (`messages.ts_ms`, `tool_calls.ts_ms`, `subagents.started_ms`),
//!   both bounds inclusive.
//! - `overview.messages`, `heat_daily`, `heat_week_hour`, `overview.sessions`,
//!   `overview.active_days` and the project `sessions` / `messages`: main-file messages only
//!   (human/command prompts + assistant messages by `message.id`, as `message_count`).
//! - Tokens (`overview.output_tokens`, `daily`, project `output_tokens`): main + subagent
//!   messages; `daily` skips messages without tokens (prompts, `<synthetic>` errors).
//! - `tools`: main + subagent tool calls (a Subagent's tool use is still the user's tool use);
//!   failures are tool results with `is_error: true`.
//! - `subagents`: one run per `subagents` row, grouped by `agent_type`.
//!
//! Days and hours are local wall-clock time via `chrono::Local` (DST-correct, honours `TZ`).

use std::collections::{BTreeMap, HashMap};

use chrono::{Datelike, Local, NaiveDate, NaiveDateTime, TimeZone, Timelike};
use rusqlite::types::Value;
use rusqlite::{Connection, params_from_iter};

use crate::error::CoreResult;
use crate::index::schema::MSG_ASSISTANT;
use crate::model::{
    AgentTypeStat, DailyModelTokens, DayCount, ProjectStat, Stats, StatsOverview, StatsRequest,
    TimeRange, ToolStat, WeekHourCount,
};

/// Label of messages without a model and Subagent Runs without an `agentType`
/// (the matching drills use the same label).
pub const UNKNOWN: &str = "unknown";

/// Local wall-clock time of a unix-ms timestamp.
pub(crate) fn local_time(ts_ms: i64) -> Option<NaiveDateTime> {
    Local
        .timestamp_millis_opt(ts_ms)
        .single()
        .map(|d| d.naive_local())
}

/// Inclusive `[from, to]` bounds of an optional time range (unbounded sides are `i64` extremes).
pub(crate) fn range_bounds(r: Option<&TimeRange>) -> (i64, i64) {
    let from = r.and_then(|r| r.from_ms).map_or(i64::MIN, |v| v as i64);
    let to = r.and_then(|r| r.to_ms).map_or(i64::MAX, |v| v as i64);
    (from, to)
}

/// `AND s.project_id IN (…)` for the request's projects (appends the arguments).
fn project_filter(ids: &[String], args: &mut Vec<Value>) -> String {
    if ids.is_empty() {
        return String::new();
    }
    args.extend(ids.iter().map(|p| Value::Text(p.clone())));
    format!(" AND s.project_id IN ({})", vec!["?"; ids.len()].join(","))
}

/// Ids of the sessions in scope, as a subquery (a hashed `IN` list is much cheaper than a
/// per-row join on 100k+ tool calls).
fn scope_subquery(ids: &[String], args: &mut Vec<Value>) -> String {
    format!(
        "(SELECT s.id FROM sessions s WHERE s.is_empty = 0{})",
        project_filter(ids, args)
    )
}

pub fn compute(conn: &Connection, r: &StatsRequest) -> CoreResult<Stats> {
    let (from, to) = range_bounds(r.time_range.as_ref());
    let ranged = r.time_range.is_some();

    // Sessions in scope → (session index, project index).
    let mut args = Vec::new();
    let sql = format!(
        "SELECT s.id, s.project_id, coalesce(p.display_name, s.project_id)
         FROM sessions s LEFT JOIN projects p ON p.id = s.project_id
         WHERE s.is_empty = 0{}",
        project_filter(&r.project_ids, &mut args)
    );
    let mut sessions: HashMap<String, (usize, usize)> = HashMap::new();
    let mut projects: Vec<(String, String)> = Vec::new();
    let mut project_index: HashMap<String, usize> = HashMap::new();
    {
        let mut st = conn.prepare(&sql)?;
        let mut rows = st.query(params_from_iter(args))?;
        while let Some(row) = rows.next()? {
            let pid: String = row.get(1)?;
            let pi = match project_index.get(&pid) {
                Some(&i) => i,
                None => {
                    project_index.insert(pid.clone(), projects.len());
                    projects.push((pid, row.get(2)?));
                    projects.len() - 1
                }
            };
            let n = sessions.len();
            sessions.insert(row.get(0)?, (n, pi));
        }
    }

    // One pass over the messages in range.
    let mut session_active = vec![false; sessions.len()];
    let mut proj_messages = vec![0u32; projects.len()];
    let mut proj_output = vec![0f64; projects.len()];
    let mut messages = 0u32;
    let mut output = 0f64;
    let mut heat_daily: BTreeMap<NaiveDate, u32> = BTreeMap::new();
    let mut week_hour = [[0u32; 24]; 7];
    let mut daily: BTreeMap<(NaiveDate, String), [f64; 4]> = BTreeMap::new();
    {
        let mut sql = "SELECT session_id, agent_id = '', ts_ms, role, model, in_tok, out_tok,
            cr_tok, cc_tok FROM messages"
            .to_owned();
        // Unranged: a plain table scan beats walking `messages_ts` back into the table.
        let bounds = if ranged { vec![from, to] } else { vec![] };
        if ranged {
            sql.push_str(" WHERE ts_ms >= ?1 AND ts_ms <= ?2");
        }
        let mut st = conn.prepare(&sql)?;
        let mut rows = st.query(params_from_iter(bounds))?;
        while let Some(row) = rows.next()? {
            let Some(&(si, pi)) = sessions.get(row.get_ref(0)?.as_str().unwrap_or_default()) else {
                continue;
            };
            let Some(t) = local_time(row.get(2)?) else {
                continue;
            };
            let day = t.date();
            if row.get::<_, bool>(1)? {
                session_active[si] = true;
                proj_messages[pi] += 1;
                messages += 1;
                *heat_daily.entry(day).or_default() += 1;
                week_hour[t.weekday().num_days_from_monday() as usize][t.hour() as usize] += 1;
            }
            let tok: [f64; 4] = [
                row.get::<_, i64>(5)? as f64,
                row.get::<_, i64>(6)? as f64,
                row.get::<_, i64>(7)? as f64,
                row.get::<_, i64>(8)? as f64,
            ];
            if row.get::<_, i64>(3)? != MSG_ASSISTANT || tok.iter().all(|&v| v == 0.0) {
                continue;
            }
            output += tok[1];
            proj_output[pi] += tok[1];
            let model = row.get::<_, Option<String>>(4)?;
            let e = daily
                .entry((day, model.unwrap_or_else(|| UNKNOWN.to_owned())))
                .or_default();
            for (a, b) in e.iter_mut().zip(tok) {
                *a += b;
            }
        }
    }

    let mut proj_sessions = vec![0u32; projects.len()];
    for &(si, pi) in sessions.values() {
        proj_sessions[pi] += u32::from(session_active[si]);
    }
    let mut project_stats: Vec<ProjectStat> = projects
        .into_iter()
        .enumerate()
        .filter(|&(i, _)| proj_sessions[i] > 0 || proj_output[i] > 0.0)
        .map(|(i, (project_id, display_name))| ProjectStat {
            project_id,
            display_name,
            sessions: proj_sessions[i],
            messages: proj_messages[i],
            output_tokens: proj_output[i],
        })
        .collect();
    project_stats.sort_by(|a, b| {
        b.output_tokens
            .total_cmp(&a.output_tokens)
            .then(b.sessions.cmp(&a.sessions))
            .then(a.project_id.cmp(&b.project_id))
    });

    Ok(Stats {
        overview: StatsOverview {
            sessions: session_active.iter().filter(|&&a| a).count() as u32,
            messages,
            output_tokens: output,
            active_days: heat_daily.len() as u32,
        },
        daily: daily
            .into_iter()
            .map(|((day, model), t)| DailyModelTokens {
                day: day.to_string(),
                model,
                input: t[0],
                output: t[1],
                cache_read: t[2],
                cache_creation: t[3],
            })
            .collect(),
        heat_daily: heat_daily
            .into_iter()
            .map(|(day, messages)| DayCount {
                day: day.to_string(),
                messages,
            })
            .collect(),
        heat_week_hour: (0..7u32)
            .flat_map(|w| (0..24u32).map(move |h| (w, h)))
            .filter_map(|(weekday, hour)| {
                let messages = week_hour[weekday as usize][hour as usize];
                (messages > 0).then_some(WeekHourCount {
                    weekday,
                    hour,
                    messages,
                })
            })
            .collect(),
        projects: project_stats,
        tools: tool_stats(conn, r, ranged, from, to)?,
        subagents: agent_type_stats(conn, r, ranged, from, to)?,
    })
}

fn tool_stats(
    conn: &Connection,
    r: &StatsRequest,
    ranged: bool,
    from: i64,
    to: i64,
) -> CoreResult<Vec<ToolStat>> {
    let mut args = Vec::new();
    let mut sql = format!(
        "SELECT t.name, count(*), sum(t.is_error) FROM tool_calls t WHERE t.session_id IN {}",
        scope_subquery(&r.project_ids, &mut args)
    );
    if ranged {
        sql.push_str(" AND t.ts_ms >= ? AND t.ts_ms <= ?");
        args.extend([Value::Integer(from), Value::Integer(to)]);
    }
    sql.push_str(" GROUP BY t.name ORDER BY count(*) DESC, t.name");
    let mut st = conn.prepare(&sql)?;
    let rows = st.query_map(params_from_iter(args), |row| {
        Ok(ToolStat {
            name: row.get(0)?,
            calls: row.get(1)?,
            failures: row.get(2)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

fn agent_type_stats(
    conn: &Connection,
    r: &StatsRequest,
    ranged: bool,
    from: i64,
    to: i64,
) -> CoreResult<Vec<AgentTypeStat>> {
    let mut args = vec![Value::Text(UNKNOWN.to_owned())];
    let mut sql = format!(
        "SELECT coalesce(a.agent_type, ?), count(*), coalesce(sum(a.out_tok), 0),
            coalesce(avg(a.ended_ms - a.started_ms), 0)
         FROM subagents a WHERE a.session_id IN {}",
        scope_subquery(&r.project_ids, &mut args)
    );
    if ranged {
        sql.push_str(" AND a.started_ms >= ? AND a.started_ms <= ?");
        args.extend([Value::Integer(from), Value::Integer(to)]);
    }
    sql.push_str(" GROUP BY 1 ORDER BY count(*) DESC, 1");
    let mut st = conn.prepare(&sql)?;
    let rows = st.query_map(params_from_iter(args), |row| {
        Ok(AgentTypeStat {
            agent_type: row.get(0)?,
            runs: row.get(1)?,
            output_tokens: row.get::<_, i64>(2)? as f64,
            avg_duration_ms: row.get::<_, f64>(3)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}
