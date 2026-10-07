import type { DailyModelTokens, DayCount, WeekHourCount } from "@/ipc/bindings";
import type { ChartOption } from "@/lib/echarts";
import { formatTokens } from "@/lib/format";

/** Reference dataviz palette (validated): categorical slots 1-3 + 7, blue sequential ramp. */
export interface Theme {
  surface: string;
  ink: string;
  muted: string;
  grid: string;
  axis: string;
  tooltipBg: string;
  ramp: string[];
  series: Record<ModelFamily, string>;
}
export type ModelFamily = "opus" | "sonnet" | "haiku" | "other";
export const FAMILIES: ModelFamily[] = ["opus", "sonnet", "haiku", "other"];

export const themes: Record<"light" | "dark", Theme> = {
  light: {
    surface: "#ffffff",
    ink: "#52514e",
    muted: "#898781",
    grid: "#e1e0d9",
    axis: "#c3c2b7",
    tooltipBg: "#ffffff",
    ramp: ["#ebeae6", "#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#104281"],
    series: { opus: "#2a78d6", sonnet: "#eb6834", haiku: "#1baf7a", other: "#4a3aa7" },
  },
  dark: {
    surface: "#1e1e20",
    ink: "#c3c2b7",
    muted: "#898781",
    grid: "#2c2c2a",
    axis: "#383835",
    tooltipBg: "#2c2c2f",
    ramp: ["#2c2c2a", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#b7d3f6"],
    series: { opus: "#3987e5", sonnet: "#d95926", haiku: "#199e70", other: "#9085e9" },
  },
};

export const FAMILY_LABEL: Record<ModelFamily, string> = { opus: "opus", sonnet: "sonnet", haiku: "haiku", other: "其他" };

export function family(model: string): ModelFamily {
  const m = model.toLowerCase();
  return m.includes("opus") ? "opus" : m.includes("sonnet") ? "sonnet" : m.includes("haiku") ? "haiku" : "other";
}

export type Metric = "output" | "input";

const metricValue = (d: DailyModelTokens, m: Metric) => (m === "output" ? d.output : d.input + d.cacheRead + d.cacheCreation);

export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const dayLabel = (day: string) => {
  const d = parseDay(day);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

/** Every calendar day from the first to the last element of `days` (sorted, YYYY-MM-DD). */
export function fillDays(days: string[]): string[] {
  if (!days.length) return [];
  const out: string[] = [];
  const end = parseDay(days[days.length - 1]);
  for (let d = parseDay(days[0]); d <= end; d.setDate(d.getDate() + 1)) out.push(dayKey(d));
  return out;
}

export function familyTotals(daily: DailyModelTokens[], metric: Metric): Record<ModelFamily, number> {
  const t: Record<ModelFamily, number> = { opus: 0, sonnet: 0, haiku: 0, other: 0 };
  for (const d of daily) t[family(d.model)] += metricValue(d, metric);
  return t;
}

const base = (t: Theme) => ({
  animation: false,
  textStyle: { color: t.ink, fontFamily: "inherit", fontSize: 10 },
  tooltip: {
    confine: true,
    backgroundColor: t.tooltipBg,
    borderColor: t.grid,
    textStyle: { color: t.ink, fontSize: 12 },
    extraCssText: "box-shadow:0 4px 14px rgba(0,0,0,.18);",
  },
});

export function dailyOption(daily: DailyModelTokens[], metric: Metric, t: Theme): ChartOption {
  const days = fillDays([...new Set(daily.map((d) => d.day))].sort());
  const present = FAMILIES.filter((f) => daily.some((d) => family(d.model) === f));
  const series = present.map((f, i) => ({
    name: FAMILY_LABEL[f],
    type: "bar",
    stack: "t",
    barMaxWidth: 16,
    itemStyle: {
      color: t.series[f],
      borderColor: t.surface,
      borderWidth: 1,
      borderRadius: i === present.length - 1 ? [4, 4, 0, 0] : 0,
    },
    emphasis: { focus: "series" },
    data: days.map((day) =>
      daily.filter((d) => d.day === day && family(d.model) === f).reduce((s, d) => s + metricValue(d, metric), 0),
    ),
  }));
  return {
    ...base(t),
    grid: { left: 40, right: 8, top: 8, bottom: 22 },
    tooltip: {
      ...base(t).tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: t.grid, opacity: 0.4 } },
      formatter: (ps: { axisValue: string; marker: string; seriesName: string; value: number }[]) =>
        `<b>${dayLabel(ps[0].axisValue)}</b><br/>` +
        ps
          .filter((p) => p.value > 0)
          .reverse()
          .map((p) => `${p.marker}${p.seriesName}　${formatTokens(p.value)}`)
          .join("<br/>"),
    },
    xAxis: {
      type: "category",
      data: days,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: t.axis } },
      axisLabel: { color: t.muted, formatter: dayLabel, hideOverlap: true },
    },
    yAxis: {
      type: "value",
      splitNumber: 3,
      axisLabel: { color: t.muted, formatter: (v: number) => (v === 0 ? "0" : formatTokens(v)) },
      splitLine: { lineStyle: { color: t.grid } },
    },
    series,
  };
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function heatBase(t: Theme, max: number) {
  return {
    ...base(t),
    visualMap: { show: false, min: 0, max: Math.max(max, 1), inRange: { color: t.ramp } },
    yAxis: {
      type: "category",
      data: WEEKDAYS,
      inverse: true,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: t.muted, interval: 0 },
    },
  };
}

const cellStyle = (t: Theme) => ({ borderColor: t.surface, borderWidth: 2, borderRadius: 3 });

/** GitHub-style calendar: columns = weeks (Monday first), rows = weekdays. Data item: [x, y, messages, day]. */
export function heatDayOption(rows: DayCount[], t: Theme): ChartOption {
  const byDay = new Map(rows.map((r) => [r.day, r.messages]));
  const days = fillDays([...byDay.keys()].sort());
  if (!days.length) return { ...base(t), series: [] };
  const first = parseDay(days[0]);
  const offset = (first.getDay() + 6) % 7;
  const weeks = Math.ceil((offset + days.length) / 7);
  const data = days.map((day, i) => [Math.floor((offset + i) / 7), (offset + i) % 7, byDay.get(day) ?? 0, day]);
  const weekLabels = Array.from({ length: weeks }, (_, w) => {
    const d = new Date(first);
    d.setDate(d.getDate() - offset + w * 7);
    return d;
  });
  return {
    ...heatBase(t, Math.max(0, ...byDay.values())),
    grid: { left: 20, right: 4, top: 4, bottom: 18 },
    tooltip: {
      ...base(t).tooltip,
      formatter: (p: { data: (string | number)[] }) => `<b>${dayLabel(p.data[3] as string)}</b>　${p.data[2]} 条消息`,
    },
    xAxis: {
      type: "category",
      data: weekLabels.map((d) => `${d.getMonth() + 1}/${d.getDate()}`),
      splitArea: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: t.muted, hideOverlap: true },
    },
    series: [{ type: "heatmap", data, itemStyle: cellStyle(t), emphasis: { itemStyle: { borderColor: t.ink } } }],
  };
}

export function heatWeekHourOption(rows: WeekHourCount[], t: Theme): ChartOption {
  const data = rows.map((r) => [r.hour, r.weekday, r.messages]);
  return {
    ...heatBase(t, Math.max(0, ...rows.map((r) => r.messages))),
    grid: { left: 20, right: 4, top: 4, bottom: 18 },
    tooltip: {
      ...base(t).tooltip,
      formatter: (p: { data: number[] }) => `<b>周${WEEKDAYS[p.data[1]]} ${p.data[0]} 时</b>　${p.data[2]} 条消息`,
    },
    xAxis: {
      type: "category",
      data: Array.from({ length: 24 }, (_, h) => String(h)),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: t.muted, interval: 5, formatter: (v: string) => (v === "0" ? "0时" : v) },
    },
    series: [{ type: "heatmap", data, itemStyle: cellStyle(t), emphasis: { itemStyle: { borderColor: t.ink } } }],
  };
}
