import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, GitBranch } from "lucide-react";
import { useMemo, useRef, type KeyboardEvent } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ProjectSummary, SessionSort, SessionSummary } from "@/ipc/bindings";
import { cn } from "@/lib/cn";
import { formatRelative, formatTokens } from "@/lib/format";
import { useProjects, useSessionList } from "@/queries";
import { useUi } from "@/state/ui";

const ROW_HEIGHT = 60;

const SORTS: { value: SessionSort; menu: string; order: string }[] = [
  { value: "lastActive", menu: "时间", order: "时间" },
  { value: "created", menu: "创建", order: "创建时间" },
  { value: "messages", menu: "消息数", order: "消息数" },
  { value: "tokens", menu: "Token", order: "Token" },
];

export function SessionList() {
  const { data } = useSessionList();
  const { data: projects } = useProjects();
  const projectIds = useUi((s) => s.projectIds);
  const sessionId = useUi((s) => s.sessionId);
  const selectSession = useUi((s) => s.selectSession);
  const setView = useUi((s) => s.setView);
  const sort = useUi((s) => s.sessionSort);
  const descending = useUi((s) => s.sessionDescending);
  const setSort = useUi((s) => s.setSessionSort);

  const list = data ?? [];
  const names = useMemo(() => new Map((projects ?? []).map((p: ProjectSummary) => [p.id, p.displayName])), [projects]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const sortInfo = SORTS.find((s) => s.value === sort)!;
  const title = projectIds.length === 1 ? (names.get(projectIds[0]!) ?? "Session") : "全部 Session";
  const liveCount = list.filter((s) => s.live).length;

  const open = (id: string) => {
    selectSession(id);
    setView("sessions");
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const cur = list.findIndex((s) => s.id === sessionId);
    const next = Math.max(0, Math.min(list.length - 1, cur < 0 ? 0 : cur + (e.key === "ArrowDown" ? 1 : -1)));
    const target = list[next];
    if (!target) return;
    open(target.id);
    virtualizer.scrollToIndex(next, { align: "auto" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div data-tauri-drag-region className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border px-3.5">
        <div className="min-w-0 flex-1" data-tauri-drag-region>
          <div className="truncate text-[14px] font-semibold">{title}</div>
          <div className="text-[11px] text-secondary">
            {liveCount} 个进行中 · 按{sortInfo.order}
            {descending ? "倒序" : "正序"}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="排序方式"
            className="flex h-7 items-center gap-1 rounded-md border border-border bg-ground px-2 text-[12px] text-text/80 outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            {sortInfo.menu}
            <ChevronDown size={11} strokeWidth={1.8} aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SORTS.map((s) => (
              <DropdownMenuItem key={s.value} onSelect={() => setSort(s.value)}>
                <span className="w-3">{s.value === sort ? "✓" : ""}</span>
                {s.menu}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setSort(sort, !descending)}>
              <span className="w-3" />
              {descending ? "改为正序" : "改为倒序"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        ref={scrollRef}
        tabIndex={0}
        role="listbox"
        aria-label="Session 列表"
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 overflow-y-auto outline-none"
      >
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((v) => {
            const s = list[v.index]!;
            return (
              <div
                key={s.id}
                className="absolute top-0 left-0 w-full"
                style={{ height: ROW_HEIGHT, transform: `translateY(${v.start}px)` }}
              >
                <SessionRow
                  s={s}
                  selected={s.id === sessionId}
                  projectName={projectIds.length === 1 ? null : (names.get(s.projectId) ?? null)}
                  byCreated={sort === "created"}
                  onOpen={open}
                />
              </div>
            );
          })}
        </div>
        {data && list.length === 0 && <div className="p-6 text-center text-[12px] text-secondary">没有 Session</div>}
      </div>
    </div>
  );
}

function SessionRow({
  s,
  selected,
  projectName,
  byCreated,
  onOpen,
}: {
  s: SessionSummary;
  selected: boolean;
  projectName: string | null;
  byCreated: boolean;
  onOpen: (id: string) => void;
}) {
  const busy = s.live?.status === "busy";
  return (
    <div
      role="option"
      aria-selected={selected}
      data-testid="session-row"
      data-session-id={s.id}
      onClick={() => onOpen(s.id)}
      className={cn(
        "flex h-full cursor-default flex-col justify-center gap-[3px] border-b border-border/70 px-3.5",
        selected ? "bg-selection shadow-[inset_3px_0_0_var(--color-accent)]" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
      )}
    >
      <div className="flex items-center gap-1.5">
        {s.live && (
          <span
            data-testid="live-dot"
            data-state={busy ? "busy" : "idle"}
            title={busy ? "进行中 · 工作中" : "进行中 · 等待输入"}
            className={cn(
              "size-2 shrink-0 rounded-full",
              busy ? "bg-live shadow-[0_0_0_3px_rgba(30,127,69,0.16)]" : "box-border border-[1.5px] border-live",
            )}
          />
        )}
        <span className="min-w-0 flex-1 truncate font-semibold">{s.title}</span>
        <span className="shrink-0 text-[11px] text-secondary">{formatRelative(byCreated ? s.createdMs : s.lastActiveMs)}</span>
      </div>
      <div className="flex items-center gap-2.5 text-[11px] text-secondary">
        {projectName && <span className="max-w-[40%] shrink-0 truncate text-text/80">{projectName}</span>}
        {s.gitBranch && (
          <span className="flex min-w-0 items-center gap-[3px]">
            <GitBranch size={11} strokeWidth={1.5} className="shrink-0" aria-hidden />
            <span className="truncate">{s.gitBranch}</span>
          </span>
        )}
        <span className="flex-1" />
        <span className="shrink-0">{s.messageCount} 条</span>
        <span className="shrink-0">{formatTokens(s.tokens.output)}</span>
      </div>
    </div>
  );
}
