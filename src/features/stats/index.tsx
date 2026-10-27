import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import type { Drill, Stats, TimeRange } from "@/ipc/bindings";
import { useLeadingInset } from "@/features/layout";
import { cn } from "@/lib/cn";
import { cycleEnd, cycleStart } from "@/lib/cycle";
import { formatCost, formatDuration, formatTokens } from "@/lib/format";
import { useStats } from "@/queries";
import { useUi } from "@/state/ui";
import { Chart, useDark } from "./Chart";
import {
  FAMILIES,
  FAMILY_LABEL,
  IO_SERIES,
  type Metric,
  type ModelFamily,
  family,
  dailyOption,
  heatDayOption,
  heatWeekHourOption,
  themes,
} from "./charts";

const RANGES = [
  { key: "cycle", label: "本周期", days: 7 },
  { key: "7", label: "7 天", days: 7 },
  { key: "30", label: "30 天", days: 30 },
  { key: "90", label: "90 天", days: 90 },
  { key: "all", label: "全部", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const DAY = 86_400_000;
const num = (n: number) => n.toLocaleString("en-US");

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  small,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (k: T) => void;
  small?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex overflow-hidden rounded-md border border-border bg-ground">
      {options.map((o, i) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "px-3 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-accent",
            small ? "h-6 px-2 text-[11px]" : "h-7",
            i > 0 && "border-l border-border",
            value === o.key ? "bg-selection font-semibold text-accent" : "text-secondary hover:bg-code",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Card({ title, aside, className, children, testId }: { title: ReactNode; aside?: ReactNode; className?: string; children: ReactNode; testId?: string }) {
  return (
    <section data-testid={testId} className={cn("flex min-h-0 min-w-0 flex-col gap-2 rounded-[10px] border border-border bg-ground px-3.5 py-3", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="m-0 flex-1 text-[13px] font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ text = "所选范围内没有数据" }: { text?: string }) => (
  <div className="flex min-h-16 flex-1 items-center justify-center text-[12px] text-secondary">{text}</div>
);

function longestStreak(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev = 0;
  for (const d of sorted) {
    const [y, m, dd] = d.split("-").map(Number);
    const t = Date.UTC(y, m - 1, dd);
    run = prev && t - prev === DAY ? run + 1 : 1;
    prev = t;
    best = Math.max(best, run);
  }
  return best;
}

const CARD = "flex min-w-0 flex-col gap-0.5 rounded-[10px] border border-border bg-ground px-3.5 py-3";

/** Input (new, cache writes, cache reads) and output; the bar shows what the input was made of. */
function TokenCard({ stats }: { stats: Stats }) {
  const t = stats.daily.reduce(
    (a, d) => ({ input: a.input + d.input, read: a.read + d.cacheRead, write: a.write + d.cacheCreation }),
    { input: 0, read: 0, write: 0 },
  );
  const totalIn = t.input + t.read + t.write;
  const pct = (v: number) => (totalIn ? (v / totalIn) * 100 : 0);
  const parts = [
    { label: "缓存读取", value: t.read, className: "bg-accent" },
    { label: "缓存写入", value: t.write, className: "bg-accent/45" },
    { label: "新输入", value: t.input, className: "bg-text/20" },
  ];
  return (
    <div data-testid="stat-card" data-card="tokens" className={cn(CARD, "col-span-2 gap-[5px]")}>
      <div className="flex items-baseline gap-2">
        <span className="text-[12px] text-secondary">Token</span>
        <span className="flex-1" />
        <span data-testid="cache-hit" className="text-[12px] text-secondary">
          缓存命中率 <span className="font-semibold text-text">{Math.round(pct(t.read))}%</span>
        </span>
      </div>
      <div className="flex items-baseline gap-2.5">
        <span className="text-[24px] leading-tight font-semibold tracking-tight">{formatTokens(totalIn)}</span>
        <span className="text-[12px] text-secondary">输入</span>
        <span className="ml-1.5 text-[24px] leading-tight font-semibold tracking-tight">{formatTokens(stats.overview.outputTokens)}</span>
        <span className="text-[12px] text-secondary">输出</span>
      </div>
      <div
        role="img"
        aria-label={`输入构成：${parts.map((p) => `${p.label} ${Math.round(pct(p.value))}%`).join("，")}`}
        className="flex h-1.5 overflow-hidden rounded-full bg-border"
      >
        {parts.map((p) => (
          <span key={p.label} className={p.className} style={{ width: `${pct(p.value)}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 text-[11px] text-secondary">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1 whitespace-nowrap">
            <span className={cn("size-2 rounded-[2px]", p.className)} />
            {p.label} {formatTokens(p.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A daily average: one decimal below 10, so a quiet range does not read as 0. */
const perDay = (v: number) => (v < 10 ? String(Math.round(v * 10) / 10) : num(Math.round(v)));

function Overview({ stats, rangeDays }: { stats: Stats; rangeDays: number | null }) {
  const { overview: o, daily } = stats;
  const activeDays = daily.map((d) => d.day);
  const span = rangeDays ?? Math.max(o.activeDays, stats.heatDaily.length);
  const cards = [
    { id: "sessions", label: "Session", value: num(o.sessions), sub: o.activeDays ? `日均 ${perDay(o.sessions / o.activeDays)} 个` : "—" },
    { id: "messages", label: "消息", value: num(o.messages), sub: o.activeDays ? `日均 ${num(Math.round(o.messages / o.activeDays))} 条` : "—" },
    {
      id: "cost",
      label: "API 金额",
      value: formatCost(o.cost),
      sub: o.unpricedMessages > 0 ? `${num(o.unpricedMessages)} 条消息无价格，未计入` : o.activeDays ? `日均 ${formatCost(o.cost / o.activeDays)}` : "—",
    },
    {
      id: "active",
      label: "活跃天数",
      value: `${o.activeDays} / ${span}`,
      sub: activeDays.length ? `最长连续 ${longestStreak(activeDays)} 天` : "—",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4 @5xl:grid-cols-6">
      {cards.map((c, i) => (
        <Fragment key={c.id}>
          {/* Token sits third, after Session and messages. */}
          {i === 2 && <TokenCard stats={stats} />}
          <div data-testid="stat-card" data-card={c.id} className={CARD}>
            <span className="text-[12px] text-secondary">{c.label}</span>
            <span className="text-[24px] leading-tight font-semibold tracking-tight">{c.value}</span>
            <span className="truncate text-[11px] text-secondary">{c.sub}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function Bar({ pct, color, className }: { pct: number; color: string; className?: string }) {
  return (
    <span className={cn("block h-1.5 rounded-[3px] bg-code", className)}>
      <span className="block h-1.5 rounded-[3px]" style={{ width: `${Math.max(2, pct)}%`, background: color }} />
    </span>
  );
}

const WEEKDAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const pad = (n: number) => String(n).padStart(2, "0");
const fmtReset = (d: Date) => format(d, "M月d日 EEE HH:mm", { locale: zhCN });

function remaining(ms: number): string {
  const h = Math.max(0, Math.floor(ms / 3_600_000));
  return h >= 24 ? `${Math.floor(h / 24)} 天 ${h % 24} 小时` : `${h} 小时 ${Math.floor((ms % 3_600_000) / 60_000)} 分`;
}

/** The weekly cycle's reset setting and its current span. */
function CycleBar({ start, end }: { start: Date; end: Date }) {
  const reset = useUi((s) => s.weeklyReset);
  const setReset = useUi((s) => s.setWeeklyReset);
  const field = "h-6 rounded-md border border-border bg-ground px-1.5 text-[12px] text-text outline-none focus-visible:ring-2 focus-visible:ring-accent";
  return (
    <div data-testid="cycle-bar" className="flex flex-wrap items-center gap-x-2 gap-y-1 pb-2.5 text-[12px] text-secondary">
      <span>每周</span>
      <select aria-label="重置日" className={field} value={reset.weekday} onChange={(e) => setReset({ ...reset, weekday: Number(e.target.value) })}>
        {WEEKDAY_NAMES.map((n, i) => (
          <option key={n} value={i}>
            {n}
          </option>
        ))}
      </select>
      <input
        type="time"
        aria-label="重置时间"
        className={field}
        value={`${pad(Math.floor(reset.minutes / 60))}:${pad(reset.minutes % 60)}`}
        onChange={(e) => {
          const [h, m] = e.target.value.split(":").map(Number);
          if (Number.isFinite(h) && Number.isFinite(m)) setReset({ ...reset, minutes: h * 60 + m });
        }}
      />
      <span>重置</span>
      <span data-testid="cycle-span" className="text-text/80">
        本周期 {fmtReset(start)} 至 {fmtReset(end)}，还剩 {remaining(end.getTime() - Date.now())}
      </span>
    </div>
  );
}

export function StatsPanel() {
  const dark = useDark();
  const theme = themes[dark ? "dark" : "light"];
  const inset = useLeadingInset();
  const [rangeKey, setRangeKey] = useState<RangeKey>("30");
  const [metric, setMetric] = useState<Metric>("all");
  const [heat, setHeat] = useState<"day" | "weekHour">("weekHour");

  const weeklyReset = useUi((s) => s.weeklyReset);
  const rangeDays = RANGES.find((r) => r.key === rangeKey)!.days;
  const cycle = useMemo(() => {
    if (rangeKey !== "cycle") return null;
    const start = cycleStart(new Date(), weeklyReset);
    return { start, end: cycleEnd(start) };
  }, [rangeKey, weeklyReset]);
  const timeRange = useMemo<TimeRange | null>(
    () => (cycle ? { fromMs: cycle.start.getTime(), toMs: null } : rangeDays ? { fromMs: Date.now() - rangeDays * DAY, toMs: null } : null),
    [cycle, rangeDays],
  );
  const { data: stats, isPending, isError } = useStats({ timeRange });

  const drill = (d: Drill) => {
    const ui = useUi.getState();
    ui.setProjectIds([]);
    ui.setStatsDrill(d, timeRange);
    ui.selectSession(null);
    ui.setView("sessions");
  };
  const openSession = (id: string) => {
    const ui = useUi.getState();
    ui.setProjectIds([]);
    ui.setStatsDrill(null);
    ui.selectSession(id);
    ui.setView("sessions");
  };

  const dailyOpt = useMemo(() => (stats ? dailyOption(stats.daily, metric, theme) : null), [stats, metric, theme]);
  const heatOpt = useMemo(
    () => (stats ? (heat === "day" ? heatDayOption(stats.heatDaily, theme) : heatWeekHourOption(stats.heatWeekHour, theme)) : null),
    [stats, heat, theme],
  );

  const empty = stats != null && stats.overview.sessions === 0 && stats.daily.length === 0;
  const present = stats ? FAMILIES.filter((f) => stats.daily.some((d) => family(d.model) === f)) : [];
  const maxCost = Math.max(0.01, ...(stats?.sessions.map((s) => s.cost) ?? []));
  const maxTool = Math.max(1, ...(stats?.tools.map((t) => t.calls) ?? []));
  const tools = stats ? [...stats.tools].sort((a, b) => b.calls - a.calls) : [];
  const agents = stats ? [...stats.subagents].sort((a, b) => b.runs - a.runs) : [];

  return (
    <div data-testid="stats" className="@container flex h-full min-w-0 flex-col bg-list">
      {/* Toolbar stays put like the other panes' headers; only the content below scrolls. */}
      <header data-tauri-drag-region="deep" className={cn("flex shrink-0 flex-col border-b border-border px-6", inset)}>
        {/* The toolbar row keeps its height; the cycle bar only adds a row below it. */}
        <div data-tauri-drag-region="deep" className="flex min-h-[52px] flex-wrap items-center gap-3">
          <h1 className="m-0 flex-1 text-[16px] font-semibold">统计</h1>
          <Segmented label="时间范围" value={rangeKey} options={RANGES.map((r) => ({ key: r.key, label: r.label }))} onChange={setRangeKey} />
        </div>
        {cycle && <CycleBar start={cycle.start} end={cycle.end} />}
      </header>

      <div data-testid="stats-scroll" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-4 pb-6">
        {isPending && <Empty text="加载中…" />}
        {isError && <Empty text="统计加载失败" />}
        {empty && <Empty />}

        {stats && !empty && (
          <>
            <Overview stats={stats} rangeDays={rangeDays} />
            {/* Each card is as tall as its content, not stretched to the tallest in its row. */}
            <div className="grid grid-cols-1 items-start gap-3 @3xl:grid-cols-3">
              <Card
                className="@3xl:col-span-2"
                title={metric === "all" ? "每日 token" : "每日 token · 按模型"}
                testId="stats-daily"
                aside={
                  <>
                    {metric === "all" &&
                      IO_SERIES.map((s) => (
                        <span key={s.label} className="flex items-center gap-1 text-[11px]">
                          <span className="size-[9px] rounded-[2px]" style={{ background: theme[s.color] }} />
                          {s.label}
                        </span>
                      ))}
                    {metric !== "all" &&
                      present.map((f) => (
                      <button
                        key={f}
                        type="button"
                        data-testid="legend-item"
                        title="查看该模型的 Session"
                        onClick={() => drill({ kind: "model", model: stats.daily.find((d) => family(d.model) === f)!.model })}
                        className="flex items-center gap-1 text-[11px] hover:underline"
                      >
                        <span className="size-[9px] rounded-[2px]" style={{ background: theme.series[f as ModelFamily] }} />
                        {FAMILY_LABEL[f]}
                      </button>
                      ))}
                    <Segmented
                      small
                      label="指标"
                      value={metric}
                      options={[
                        { key: "all", label: "全部" },
                        { key: "input", label: "输入" },
                        { key: "output", label: "输出" },
                      ]}
                      onChange={setMetric}
                    />
                  </>
                }
              >
                {stats.daily.length === 0 ? (
                  <Empty />
                ) : (
                  <Chart
                    testId="daily-chart"
                    height={240}
                    label="每日 token 堆叠柱状图"
                    option={dailyOpt!}
                    onPick={(p) => p.name && drill({ kind: "day", day: p.name })}
                  />
                )}
              </Card>

              <Card title="Session 排行" aside={<span className="text-[11px] text-secondary">按 API 金额</span>}>
                {stats.sessions.length === 0 && <Empty />}
                {stats.sessions.map((s) => (
                  <button
                    key={s.sessionId}
                    type="button"
                    data-testid="session-rank-row"
                    title={s.title}
                    onClick={() => openSession(s.sessionId)}
                    className="flex flex-col gap-[3px] rounded text-left outline-none hover:bg-code focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="flex gap-2 text-[12px]">
                      <span className="min-w-0 flex-1 truncate">{s.title}</span>
                      <span className="shrink-0 text-secondary tabular-nums">
                        {formatCost(s.cost)} · {formatTokens(s.outputTokens)}
                      </span>
                    </span>
                    <Bar pct={(s.cost / maxCost) * 100} color={theme.series.opus} />
                  </button>
                ))}
              </Card>

              <Card
                title="活跃时段"
                testId="stats-heat"
                aside={
                  <Segmented
                    small
                    label="热力图类型"
                    value={heat}
                    options={[
                      { key: "day", label: "按日" },
                      { key: "weekHour", label: "星期 × 小时" },
                    ]}
                    onChange={setHeat}
                  />
                }
              >
                <Chart
                  testId="heat-chart"
                  height={heat === "day" ? 150 : 170}
                  label={heat === "day" ? "按日活跃热力图" : "星期乘小时活跃热力图"}
                  option={heatOpt!}
                  onPick={(p) => {
                    const d = p.data as (string | number)[] | undefined;
                    if (!d) return;
                    drill(heat === "day" ? { kind: "day", day: d[3] as string } : { kind: "weekHour", weekday: d[1] as number, hour: d[0] as number });
                  }}
                />
                <div className="text-[11px] text-secondary">消息数 · 颜色越深越多</div>
              </Card>

              <Card title="工具调用" aside={<span className="text-[11px] text-secondary">次数 · 失败率</span>}>
                {tools.length === 0 && <Empty />}
                <div className="flex max-h-56 flex-col gap-1.5 overflow-auto">
                  {tools.map((t) => {
                    const rate = t.calls ? (t.failures / t.calls) * 100 : 0;
                    const high = rate > 5;
                    return (
                      <button
                        key={t.name}
                        type="button"
                        data-testid="tool-row"
                        data-high-failure={high}
                        onClick={() => drill({ kind: "tool", name: t.name })}
                        className="flex items-center gap-2 rounded text-left text-[12px] outline-none hover:bg-code focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <code className="w-24 shrink-0 truncate font-mono text-[11px]" title={t.name}>
                          {t.name}
                        </code>
                        <Bar className="flex-1" pct={(t.calls / maxTool) * 100} color="#6f7c8c" />
                        <span className="w-12 shrink-0 text-right tabular-nums">{num(t.calls)}</span>
                        <span className={cn("w-14 shrink-0 whitespace-nowrap text-right text-[11px] tabular-nums", high ? "font-semibold text-error" : "text-secondary")}>
                          {high && "▲ "}
                          {rate.toFixed(rate < 10 ? 1 : 0)}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card title="Subagent" aside={<span className="text-[11px] text-secondary">按 agentType</span>}>
                {agents.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="flex flex-col text-[12px]">
                    <div className="flex border-b border-border pb-1 text-[11px] text-secondary">
                      <span className="flex-1">类型</span>
                      <span className="w-12 text-right">次数</span>
                      <span className="w-[72px] text-right">输出 token</span>
                      <span className="w-16 text-right">平均耗时</span>
                    </div>
                    {agents.map((a) => (
                      <button
                        key={a.agentType}
                        type="button"
                        data-testid="agent-row"
                        onClick={() => drill({ kind: "agentType", agentType: a.agentType })}
                        className="flex rounded py-0.5 text-left outline-none hover:bg-code focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span className="flex-1 truncate">{a.agentType}</span>
                        <span className="w-12 text-right tabular-nums">{num(a.runs)}</span>
                        <span className="w-[72px] text-right tabular-nums">{formatTokens(a.outputTokens)}</span>
                        <span className="w-16 text-right text-secondary tabular-nums">{formatDuration(a.avgDurationMs)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
