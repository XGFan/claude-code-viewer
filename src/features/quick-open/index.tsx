import { Command } from "cmdk";
import { Folder, GitBranch, Search } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import type { ProjectSummary, SessionQuery, SessionSummary } from "@/ipc/bindings";
import { formatRelative } from "@/lib/format";
import { keepOpenWhileComposing, useHotkey } from "@/lib/hotkeys";
import { useProjects, useSessions } from "@/queries";
import { useUi } from "@/state/ui";
import { matchProjects, matchSessions, sessionProjectIds, tokenize } from "./match";

const MAX_SESSIONS = 50;
const MAX_PROJECTS = 5;
const ALL_RECENT: SessionQuery = { projectIds: [], sort: "lastActive", descending: true, liveOnly: false, timeRange: null, drill: null };

const ITEM = "flex cursor-default items-center gap-2.5 px-4 py-2 data-[selected=true]:bg-selection";
const HEADING = "[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-secondary";

function SessionItem({ s, names, onSelect }: { s: SessionSummary; names: Map<string, string>; onSelect: () => void }) {
  const tags = sessionProjectIds(s).map((id) => names.get(id) ?? id);
  return (
    <Command.Item value={`s:${s.id}`} onSelect={onSelect} data-testid="quick-open-session" className={ITEM}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          {s.live && <span className="size-2 shrink-0 rounded-full bg-live" />}
          <span className="min-w-0 flex-1 truncate font-semibold">{s.title}</span>
          <span className="shrink-0 text-[11px] text-secondary">{formatRelative(s.lastActiveMs)}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[11px] text-secondary">
          <span className="min-w-0 truncate text-text/80">{tags.join(" · ")}</span>
          {s.gitBranch && (
            <span className="flex min-w-0 shrink-0 items-center gap-[3px]">
              <GitBranch size={11} strokeWidth={1.5} className="shrink-0" aria-hidden />
              <span className="max-w-[180px] truncate">{s.gitBranch}</span>
            </span>
          )}
        </div>
      </div>
    </Command.Item>
  );
}

function ProjectItem({ p, onSelect }: { p: ProjectSummary; onSelect: () => void }) {
  return (
    <Command.Item value={`p:${p.id}`} onSelect={onSelect} data-testid="quick-open-project" className={ITEM}>
      <Folder size={15} strokeWidth={1.5} className="shrink-0 text-secondary" aria-hidden />
      <span className="shrink-0 font-semibold">{p.displayName}</span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-secondary">{p.missing ? `${p.path} · 已不存在` : p.path}</span>
      <span className="shrink-0 text-[12px] text-secondary">{p.sessionCount} 个 Session</span>
    </Command.Item>
  );
}

/** ⌘P: jump to a Session by title, Project or branch, or pick a Project to filter the Session list. */
export function QuickOpen() {
  const open = useUi((s) => s.quickOpenOpen);
  const setOpen = useUi((s) => s.setQuickOpenOpen);
  useHotkey(
    "Meta+P",
    () => {
      const ui = useUi.getState();
      ui.setSearchOpen(false);
      setOpen(!ui.quickOpenOpen);
    },
    { enableInInputs: true },
  );

  const [input, setInput] = useState("");
  // IME composition (e.g. pinyin) puts unconfirmed text in the input; match only confirmed text.
  const [composing, setComposing] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) return;
    setComposing(false);
    setInput("");
    setQuery("");
  }, [open]);
  useEffect(() => {
    if (!composing) setQuery(input);
  }, [input, composing]);

  // Loaded only while open: closed, it would refetch every session on each change of a Live Session.
  const sessions = useSessions(ALL_RECENT, open).data;
  const projects = useProjects().data;
  const names = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p.displayName])), [projects]);
  const terms = useMemo(() => tokenize(query), [query]);
  const sessionHits = useMemo(() => matchSessions(sessions ?? [], names, terms).slice(0, MAX_SESSIONS), [sessions, names, terms]);
  const projectHits = useMemo(() => matchProjects(projects ?? [], terms).slice(0, MAX_PROJECTS), [projects, terms]);

  const openSession = (s: SessionSummary) => {
    const ui = useUi.getState();
    // Keep the list showing the opened Session.
    if (ui.projectIds.length && !sessionProjectIds(s).some((id) => ui.projectIds.includes(id))) ui.setProjectIds([]);
    ui.selectSession(s.id);
    ui.setView("sessions");
    setOpen(false);
  };
  const filterProject = (id: string) => {
    const ui = useUi.getState();
    ui.setProjectIds([id]);
    ui.setView("sessions");
    // Picking a Project is a request to see its Sessions; a collapsed list would show nothing.
    if (ui.collapsed.sessions) ui.toggleCollapsed("sessions");
    setOpen(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(28,28,30,0.28)]" />
        <DialogPrimitive.Content
          data-testid="quick-open"
          aria-describedby={undefined}
          onEscapeKeyDown={keepOpenWhileComposing}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector<HTMLInputElement>("[cmdk-input]")?.focus();
          }}
          className="fixed top-[72px] left-1/2 z-50 flex max-h-[min(640px,calc(100vh-96px))] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-[14px] border border-border bg-ground text-text shadow-[0_24px_64px_rgba(0,0,0,0.22),0_2px_8px_rgba(0,0,0,0.08)]"
        >
          <DialogPrimitive.Title className="sr-only">快速打开</DialogPrimitive.Title>
          <Command shouldFilter={false} loop label="快速打开" className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <Search size={17} strokeWidth={1.6} className="text-secondary" aria-hidden />
              <Command.Input
                value={input}
                onValueChange={setInput}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={() => setComposing(false)}
                placeholder="按标题、Project 或分支查找 Session"
                className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-secondary"
              />
              <span className="text-[12px] text-secondary">esc 关闭</span>
            </div>
            <Command.List className="min-h-0 flex-1 overflow-y-auto pb-1.5">
              {sessions && sessionHits.length === 0 && projectHits.length === 0 && (
                <div role="status" data-testid="quick-open-empty" className="px-4 py-5 text-[12px] text-secondary">
                  没有匹配的 Session 或 Project
                </div>
              )}
              {projectHits.length > 0 && (
                <Command.Group heading="Project · 筛选 Session 列表" className={HEADING}>
                  {projectHits.map((p) => (
                    <ProjectItem key={p.id} p={p} onSelect={() => filterProject(p.id)} />
                  ))}
                </Command.Group>
              )}
              {sessionHits.length > 0 && (
                <Command.Group heading={terms.length ? "Session" : "最近的 Session"} className={HEADING}>
                  {sessionHits.map((s) => (
                    <SessionItem key={s.id} s={s} names={names} onSelect={() => openSession(s)} />
                  ))}
                </Command.Group>
              )}
            </Command.List>
            <div className="flex flex-wrap gap-4 border-t border-border bg-list px-4 py-2 text-[11px] text-secondary">
              <span>↑↓ 选择</span>
              <span>↵ 打开</span>
              <span>多个词同时匹配</span>
              <span>⌘K 搜索对话内容</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
