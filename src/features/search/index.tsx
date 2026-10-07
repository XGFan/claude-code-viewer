import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { Check, ChevronDown, Search } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/ipc";
import type {
  AppError,
  SearchGroup,
  SearchHit,
  SearchMode,
  SearchRequest,
  SearchResponse,
  SearchRole,
} from "@/ipc/bindings";
import { formatRelative } from "@/lib/format";
import { useHotkey } from "@/lib/hotkeys";
import { cn } from "@/lib/cn";
import { queryKeys, useIndexStatus, useProjects } from "@/queries";
import { useUi } from "@/state/ui";

const DAY_MS = 86_400_000;
const nf = new Intl.NumberFormat("en-US");
const TIME_OPTIONS = [
  { label: "全部", days: 0 },
  { label: "近 7 天", days: 7 },
  { label: "近 30 天", days: 30 },
  { label: "近 90 天", days: 90 },
];
const ROLE_OPTIONS: { label: string; roles: SearchRole[] }[] = [
  { label: "全部", roles: [] },
  { label: "你", roles: ["user"] },
  { label: "Claude", roles: ["assistant"] },
  { label: "工具输入", roles: ["toolInput"] },
];

interface ToolScan {
  groups: SearchGroup[];
  progress: { done: number; total: number } | null;
  error: string | null;
}

const asAppError = (e: unknown): AppError | null =>
  e && typeof e === "object" && "message" in e ? (e as AppError) : null;

/** Merges groups of the same Session (default scope + tool-output scan), newest Session first. */
function mergeGroups(...lists: SearchGroup[][]): SearchGroup[] {
  const by = new Map<string, SearchGroup>();
  for (const g of lists.flat()) {
    const cur = by.get(g.session.id);
    by.set(
      g.session.id,
      cur ? { ...cur, hitCount: cur.hitCount + g.hitCount, hits: [...cur.hits, ...g.hits].slice(0, 5) } : g,
    );
  }
  return [...by.values()].sort((a, b) => b.session.lastActiveMs - a.session.lastActiveMs);
}

function Chip({ active, label, value, children }: { active: boolean; label: string; value: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-[26px] items-center gap-1 rounded-full border px-2.5 text-[12px] outline-none focus-visible:outline-2 focus-visible:outline-accent",
            active ? "border-accent bg-selection text-accent" : "border-border bg-ground text-text",
          )}
        >
          {label}：{value}
          <ChevronDown size={11} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function Option({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <DropdownMenuItem onSelect={onSelect}>
      <span className="flex w-3 justify-center">{selected && <Check size={12} aria-hidden />}</span>
      {children}
    </DropdownMenuItem>
  );
}

function Snippet({ hit }: { hit: SearchHit }) {
  const mono = hit.role !== "user" && hit.role !== "assistant";
  return (
    <span className={cn("min-w-0 flex-1 truncate text-[12px] text-text/80", mono && "font-mono")}>
      {hit.snippet.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-[2px] bg-[#ffe58a] px-px text-[#1c1c1e]">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}

function HitRow({ group, hit, onOpen }: { group: SearchGroup; hit: SearchHit; onOpen: (sessionId: string, hit: SearchHit) => void }) {
  const sessionId = group.session.id;
  const agentType = hit.agentId ? hit.agentType : null;
  const role = hit.agentId
    ? (agentType ?? "Subagent")
    : hit.role === "user"
      ? "你"
      : hit.role === "assistant"
        ? "Claude"
        : hit.role === "toolInput"
          ? "工具输入"
          : "工具输出";
  const value = `${sessionId}|${hit.nodeId}|${hit.agentId ?? ""}|${hit.toolUseId ?? ""}|${hit.role}`;
  return (
    <Command.Item
      value={value}
      onSelect={() => onOpen(sessionId, hit)}
      data-testid="search-hit"
      className="flex cursor-default items-baseline gap-2.5 py-0.5 pr-4 pl-8 data-[selected=true]:bg-selection"
    >
      <span className="w-[60px] shrink-0 truncate text-[12px] text-secondary">{role}</span>
      <Snippet hit={hit} />
      {hit.agentId && (
        <span data-testid="tag-subagent" className="shrink-0 rounded border border-[#f5d4a6] bg-[#fff1dd] px-1.5 text-[11px] text-[#7a3e00]">
          Subagent{agentType ? ` · ${agentType}` : ""}
        </span>
      )}
      {!hit.onMainLine && (
        <span data-testid="tag-branch" className="shrink-0 rounded border border-[#f5d4a6] bg-[#fff1dd] px-1.5 text-[11px] text-[#7a3e00]">
          已回退的分支
        </span>
      )}
    </Command.Item>
  );
}

const MODE_HINT: Partial<Record<SearchMode, string>> = { like: "短词匹配", mixed: "短词匹配" };

export function SearchOverlay() {
  const open = useUi((s) => s.searchOpen);
  const setOpen = useUi((s) => s.setSearchOpen);
  const jumpTo = useUi((s) => s.jumpTo);
  useHotkey("Meta+K", () => setOpen(!useUi.getState().searchOpen), { enableInInputs: true });

  const [input, setInput] = useState("");
  // IME composition (e.g. pinyin) puts unconfirmed text in the input; query only confirmed text.
  const [composing, setComposing] = useState(false);
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [days, setDays] = useState(0);
  const [roleIdx, setRoleIdx] = useState(0);
  const [liveOnly, setLiveOnly] = useState(false);
  const [withTools, setWithTools] = useState(false);
  const [jumpError, setJumpError] = useState<string | null>(null);
  const [scan, setScan] = useState<ToolScan>({ groups: [], progress: null, error: null });

  // The input unmounts on close, possibly mid-composition (no compositionend follows).
  useEffect(() => {
    if (!open) setComposing(false);
  }, [open]);
  useEffect(() => {
    if (composing) return;
    const t = setTimeout(() => setQuery(input.trim()), 200);
    return () => clearTimeout(t);
  }, [input, composing]);

  const projects = useProjects().data ?? [];
  const status = useIndexStatus().data;

  const req = useMemo<SearchRequest>(
    () => ({
      query,
      projectId,
      timeRange: days ? { fromMs: Date.now() - days * DAY_MS, toMs: null } : null,
      roles: ROLE_OPTIONS[roleIdx].roles,
      liveOnly,
      maxSessions: 50,
      hitsPerSession: 5,
    }),
    [query, projectId, days, roleIdx, liveOnly],
  );
  const active = open && query.length > 0;

  const search = useQuery<SearchResponse, AppError>({
    queryKey: queryKeys.search(req),
    queryFn: () => api.search(req),
    enabled: active,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });

  // Tool-output scan: restarted on any query/filter change, cancelled on close.
  const reqRef = useRef(req);
  reqRef.current = req;
  useEffect(() => {
    setScan({ groups: [], progress: null, error: null });
    if (!active || !withTools) return;
    let stale = false;
    let searchId: number | null = null;
    setScan({ groups: [], progress: { done: 0, total: 0 }, error: null });
    api
      .searchToolOutput(reqRef.current, (ev) => {
        if (stale) return;
        if (ev.kind === "progress") setScan((s) => ({ ...s, progress: { done: ev.filesDone, total: ev.filesTotal } }));
        else if (ev.kind === "groups") setScan((s) => ({ ...s, groups: mergeGroups(s.groups, ev.groups) }));
        else if (ev.kind === "done") setScan((s) => ({ ...s, progress: null }));
        else setScan((s) => ({ ...s, progress: null, error: ev.message }));
      })
      .then((h) => {
        searchId = h.searchId;
        if (stale) void api.cancelSearch(h.searchId);
      })
      .catch((e) => !stale && setScan({ groups: [], progress: null, error: asAppError(e)?.message ?? String(e) }));
    return () => {
      stale = true;
      if (searchId != null) void api.cancelSearch(searchId);
    };
  }, [active, withTools, req]);

  // keepPreviousData also fills disabled queries; a blank query shows no results.
  const data = active ? search.data : undefined;
  const groups = useMemo(() => mergeGroups(data?.groups ?? [], scan.groups), [data, scan.groups]);
  const totalHits = scan.groups.length ? groups.reduce((n, g) => n + g.hitCount, 0) : (data?.totalHits ?? 0);
  const totalSessions = scan.groups.length ? groups.length : (data?.totalSessions ?? 0);
  const scanning = scan.progress != null;
  const errMsg = search.error?.message ?? scan.error ?? jumpError;
  const settled = active && !search.isFetching && data != null && !search.error;
  const empty = settled && groups.length === 0 && !scanning;

  const openHit = async (sessionId: string, hit: SearchHit) => {
    try {
      const target = await api.resolveJump({ sessionId, nodeId: hit.nodeId, agentId: hit.agentId, toolUseId: hit.toolUseId });
      jumpTo(target);
      setOpen(false);
    } catch (e) {
      setJumpError(asAppError(e)?.message ?? String(e));
    }
  };

  // Phase-2 progress (files of the text backlog), only while the backlog is being built.
  const textProgress =
    status && !status.textReady && status.phase === "indexingText"
      ? `${nf.format(status.filesDone)} / ${nf.format(status.filesTotal)} 个文件`
      : null;
  const timeLabel = TIME_OPTIONS.find((t) => t.days === days)!.label;
  const projectLabel = projects.find((p) => p.id === projectId)?.displayName ?? "全部";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(28,28,30,0.28)]" />
        <DialogPrimitive.Content
          data-testid="search"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector<HTMLInputElement>("[cmdk-input]")?.focus();
          }}
          className="fixed top-[72px] left-1/2 z-50 flex max-h-[min(780px,calc(100vh-96px))] w-[min(780px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-[14px] border border-border bg-ground text-text shadow-[0_24px_64px_rgba(0,0,0,0.22),0_2px_8px_rgba(0,0,0,0.08)]"
        >
          <DialogPrimitive.Title className="sr-only">搜索全部 Session</DialogPrimitive.Title>
          <Command shouldFilter={false} loop label="搜索全部 Session" className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
              <Search size={18} strokeWidth={1.6} className="text-secondary" aria-hidden />
              <Command.Input
                value={input}
                onValueChange={(v) => {
                  setInput(v);
                  setJumpError(null);
                }}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={() => setComposing(false)}
                className="min-w-0 flex-1 bg-transparent text-[18px] outline-none placeholder:text-secondary"
              />
              <span className="text-[12px] text-secondary">esc 关闭</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
              <Chip active={projectId != null} label="Project" value={projectLabel}>
                <Option selected={projectId == null} onSelect={() => setProjectId(null)}>
                  全部
                </Option>
                {projects.map((p) => (
                  <Option key={p.id} selected={projectId === p.id} onSelect={() => setProjectId(p.id)}>
                    {p.displayName}
                  </Option>
                ))}
              </Chip>
              <Chip active={days > 0} label="时间" value={timeLabel}>
                {TIME_OPTIONS.map((t) => (
                  <Option key={t.days} selected={days === t.days} onSelect={() => setDays(t.days)}>
                    {t.label}
                  </Option>
                ))}
              </Chip>
              <Chip active={roleIdx > 0} label="角色" value={ROLE_OPTIONS[roleIdx].label}>
                {ROLE_OPTIONS.map((r, i) => (
                  <Option key={r.label} selected={roleIdx === i} onSelect={() => setRoleIdx(i)}>
                    {r.label}
                  </Option>
                ))}
              </Chip>
              <label className="flex items-center gap-1.5 px-1 text-[12px]">
                <Checkbox checked={liveOnly} onCheckedChange={(v) => setLiveOnly(v === true)} />
                仅进行中
              </label>
              <label className="flex items-center gap-1.5 px-1 text-[12px]">
                <Checkbox checked={withTools} onCheckedChange={(v) => setWithTools(v === true)} />
                包含工具输出（较慢）
              </label>
              <span className="flex-1" />
              {settled && !empty && (
                <span data-testid="search-summary" className="text-[12px] text-secondary">
                  {totalSessions} 个 Session · {totalHits} 处命中 · {data.elapsedMs} ms
                </span>
              )}
            </div>

            {(scanning || errMsg || data?.mode && MODE_HINT[data.mode] || (data && !data.indexComplete)) && (
              <div className="flex flex-col gap-0.5 border-b border-border bg-list px-4 py-1.5 text-[12px] text-secondary">
                {scan.progress && (
                  <span data-testid="search-progress">
                    正在扫描工具输出 · {scan.progress.done} / {scan.progress.total} 个文件
                  </span>
                )}
                {data && !data.indexComplete && (
                  <span data-testid="search-incomplete">
                    {textProgress ? `全文索引未完成 · ${textProgress}` : "全文索引未完成"}
                  </span>
                )}
                {data?.mode && MODE_HINT[data.mode] && <span>{MODE_HINT[data.mode]}</span>}
                {errMsg && (
                  <span role="alert" data-testid="search-error" className="text-error">
                    {errMsg}
                  </span>
                )}
              </div>
            )}

            <Command.List className="min-h-0 flex-1 overflow-y-auto">
              {empty && (
                <div role="status" data-testid="search-empty" className="flex flex-col gap-2.5 px-4 py-5">
                  <div className="font-semibold">没有找到 “{query}”</div>
                  <div className="text-[12px] text-text/80">
                    {[
                      data && !data.indexComplete && "全文索引未完成",
                      !withTools && "本次搜索未包含工具输出",
                      days > 0 && `时间范围为${timeLabel}`,
                    ]
                      .filter(Boolean)
                      .join("；")}
                    {data?.indexComplete && withTools && days === 0 ? "已搜索全部范围。" : "。"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!withTools && (
                      <button
                        type="button"
                        onClick={() => setWithTools(true)}
                        className="h-7 rounded-md bg-accent px-3 text-[12px] font-semibold text-white"
                      >
                        包含工具输出重新搜索
                      </button>
                    )}
                    {days > 0 && (
                      <button
                        type="button"
                        onClick={() => setDays(0)}
                        className="h-7 rounded-md border border-border bg-ground px-3 text-[12px] hover:bg-selection"
                      >
                        清除时间过滤
                      </button>
                    )}
                  </div>
                </div>
              )}
              {groups.map((g) => (
                <div key={g.session.id} data-testid="search-group" className="flex flex-col gap-1.5 border-b border-border py-3">
                  <div className="flex flex-wrap items-center gap-2 px-4">
                    {g.session.live && <span data-testid="search-live" className="size-2 rounded-full bg-live" />}
                    <span className="font-semibold">{g.session.title}</span>
                    <span className="text-[12px] text-secondary">
                      {projects.find((p) => p.id === g.session.projectId)?.displayName ?? g.session.projectId} · {formatRelative(g.session.lastActiveMs)}
                    </span>
                    <span className="flex-1" />
                    <span className="rounded-full bg-code px-2 text-[11px]">{g.hitCount} 处</span>
                  </div>
                  {g.hits.slice(0, 5).map((h) => (
                    <HitRow key={`${h.nodeId}|${h.agentId}|${h.toolUseId}|${h.role}`} group={g} hit={h} onOpen={openHit} />
                  ))}
                </div>
              ))}
            </Command.List>

            <div className="flex flex-wrap gap-4 border-t border-border bg-list px-4 py-2 text-[11px] text-secondary">
              <span>↑↓ 选择</span>
              <span>↵ 打开并定位</span>
              <span>"短语" 精确匹配</span>
              <span>-词 排除</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
