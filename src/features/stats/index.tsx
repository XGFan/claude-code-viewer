import { Check } from "lucide-react";
import { DropdownMenu as Dd } from "radix-ui";
import { type ReactNode, useMemo, useState } from "react";
import { DropdownMenuContent, DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Drill, Stats, TimeRange } from "@/ipc/bindings";
import { cn } from "@/lib/cn";
import { formatDuration, formatTokens } from "@/lib/format";
import { useProjects, useStats } from "@/queries";
import { useUi } from "@/state/ui";
import { Chart, useDark } from "./Chart";
import {
  FAMILIES,
  FAMILY_LABEL,
  type Metric,
  type ModelFamily,
  family,
  familyTotals,
  dailyOption,
  heatDayOption,
  heatWeekHourOption,
  themes,
} from "./charts";

const RANGES = [
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

function Overview({ stats, rangeDays }: { stats: Stats; rangeDays: number | null }) {
  const { overview: o, daily, projects } = stats;
  const out = familyTotals(daily, "output");
  const total = FAMILIES.reduce((s, f) => s + out[f], 0);
  const share = FAMILIES.filter((f) => out[f] > 0)
    .sort((a, b) => out[b] - out[a])
    .map((f) => `${FAMILY_LABEL[f]} ${Math.round((out[f] / total) * 100)}%`)
    .join(" · ");
  const activeDays = daily.map((d) => d.day);
  const span = rangeDays ?? Math.max(o.activeDays, stats.heatDaily.length);
  const cards = [
    { id: "sessions", label: "Session", value: num(o.sessions), sub: `${projects.length} 个 Project` },
    { id: "messages", label: "消息", value: num(o.messages), sub: o.activeDays ? `日均 ${num(Math.round(o.messages / o.activeDays))} 条` : "—" },
    { id: "tokens", label: "输出 token", value: formatTokens(o.outputTokens), sub: share || "—" },
    {
      id: "active",
      label: "活跃天数",
      value: `${o.activeDays} / ${span}`,
      sub: activeDays.length ? `最长连续 ${longestStreak(activeDays)} 天` : "—",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
      {cards.map((c) => (
        <div key={c.id} data-testid="stat-card" data-card={c.id} className="flex min-w-0 flex-col gap-0.5 rounded-[10px] border border-border bg-ground px-3.5 py-3">
          <span className="text-[12px] text-secondary">{c.label}</span>
          <span className="text-[24px] leading-tight font-semibold tracking-tight">{c.value}</span>
          <span className="truncate text-[11px] text-secondary">{c.sub}</span>
        </div>
      ))}
    </div>
  );
}

function ProjectFilter({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { data } = useProjects();
  const projects = data ?? [];
  const label = value.length === 0 ? "全部" : value.length === 1 ? (projects.find((p) => p.id === value[0])?.displayName ?? "1 个") : `${value.length} 个`;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="stats-project-filter"
        className="h-7 rounded-md border border-border bg-ground px-2.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Project：{label} ▾
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 min-w-48 overflow-auto">
        <Dd.CheckboxItem
          checked={value.length === 0}
          onSelect={(e) => {
            e.preventDefault();
            onChange([]);
          }}
          className="flex cursor-default items-center gap-2 rounded px-2 py-1 text-[13px] outline-none data-[highlighted]:bg-selection"
        >
          <span className="w-4">{value.length === 0 && <Check size={14} />}</span>全部
        </Dd.CheckboxItem>
        {projects.map((p) => (
          <Dd.CheckboxItem
            key={p.id}
            checked={value.includes(p.id)}
            onSelect={(e) => {
              e.preventDefault();
              toggle(p.id);
            }}
            className="flex cursor-default items-center gap-2 rounded px-2 py-1 text-[13px] outline-none data-[highlighted]:bg-selection"
          >
            <span className="w-4">{value.includes(p.id) && <Check size={14} />}</span>
            {p.displayName}
          </Dd.CheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Bar({ pct, color, className }: { pct: number; color: string; className?: string }) {
  return (
    <span className={cn("block h-1.5 rounded-[3px] bg-code", className)}>
      <span className="block h-1.5 rounded-[3px]" style={{ width: `${Math.max(2, pct)}%`, background: color }} />
    </span>
  );
}

export function StatsPanel() {
  const dark = useDark();
  const theme = themes[dark ? "dark" : "light"];
  const storeProjectIds = useUi((s) => s.projectIds);
  const [rangeKey, setRangeKey] = useState<RangeKey>("30");
  const [projectIds, setProjectIds] = useState<string[]>(storeProjectIds);
  const [metric, setMetric] = useState<Metric>("output");
  const [heat, setHeat] = useState<"day" | "weekHour">("weekHour");

  const rangeDays = RANGES.find((r) => r.key === rangeKey)!.days;
  const timeRange = useMemo<TimeRange | null>(() => (rangeDays ? { fromMs: Date.now() - rangeDays * DAY, toMs: null } : null), [rangeDays]);
  const { data: stats, isPending, isError } = useStats({ timeRange, projectIds });

  const drill = (d: Drill | null, ids: string[] = projectIds) => {
    const ui = useUi.getState();
    ui.setProjectIds(ids);
    ui.setStatsDrill(d, timeRange);
    ui.selectSession(null);
    ui.setView("sessions");
  };

  const dailyOpt = useMemo(() => (stats ? dailyOption(stats.daily, metric, theme) : null), [stats, metric, theme]);
  const heatOpt = useMemo(
    () => (stats ? (heat === "day" ? heatDayOption(stats.heatDaily, theme) : heatWeekHourOption(stats.heatWeekHour, theme)) : null),
    [stats, heat, theme],
  );

  const empty = stats != null && stats.overview.sessions === 0 && stats.daily.length === 0;
  const present = stats ? FAMILIES.filter((f) => stats.daily.some((d) => family(d.model) === f)) : [];
  const maxProj = Math.max(1, ...(stats?.projects.map((p) => p.outputTokens) ?? []));
  const maxTool = Math.max(1, ...(stats?.tools.map((t) => t.calls) ?? []));
  const projects = stats ? [...stats.projects].sort((a, b) => b.outputTokens - a.outputTokens) : [];
  const tools = stats ? [...stats.tools].sort((a, b) => b.calls - a.calls) : [];
  const agents = stats ? [...stats.subagents].sort((a, b) => b.runs - a.runs) : [];

  return (
    <div data-testid="stats" className="@container flex min-h-full min-w-0 flex-col gap-4 bg-list px-6 pb-6">
      <header data-tauri-drag-region="deep" className="flex min-h-[52px] shrink-0 flex-wrap items-center gap-3 border-b border-border">
        <h1 className="m-0 flex-1 text-[16px] font-semibold">统计</h1>
        <Segmented label="时间范围" value={rangeKey} options={RANGES.map((r) => ({ key: r.key, label: r.label }))} onChange={setRangeKey} />
        <ProjectFilter value={projectIds} onChange={setProjectIds} />
      </header>

      {isPending && <Empty text="加载中…" />}
      {isError && <Empty text="统计加载失败" />}
      {empty && <Empty />}

      {stats && !empty && (
        <>
          <Overview stats={stats} rangeDays={rangeDays} />
          <div className="grid flex-1 grid-cols-1 gap-3 @3xl:grid-cols-3 @3xl:grid-rows-[1.3fr_1fr]">
            <Card
              className="@3xl:col-span-2"
              title="每日 token · 按模型"
              testId="stats-daily"
              aside={
                <>
                  {present.map((f) => (
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
                      { key: "output", label: "输出" },
                      { key: "input", label: "输入（含缓存）" },
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

            <Card title="Project 排行" aside={<span className="text-[11px] text-secondary">按输出 token</span>}>
              {projects.length === 0 && <Empty />}
              {projects.slice(0, 8).map((p) => (
                <button
                  key={p.projectId}
                  type="button"
                  data-testid="project-rank-row"
                  onClick={() => drill(null, [p.projectId])}
                  className="flex flex-col gap-[3px] rounded text-left outline-none hover:bg-code focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="flex text-[12px]">
                    <span className="flex-1 truncate">{p.displayName}</span>
                    <span className="text-secondary tabular-nums">{formatTokens(p.outputTokens)}</span>
                  </span>
                  <Bar pct={(p.outputTokens / maxProj) * 100} color={theme.series.opus} />
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
              <div className="flex max-h-56 flex-col gap-1.5 overflow-auto @3xl:max-h-none @3xl:min-h-0 @3xl:flex-1">
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
  );
}
