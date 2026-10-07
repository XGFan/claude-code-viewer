import { Copy, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/ipc";
import { cn } from "@/lib/cn";
import { formatDuration, formatRelative, formatTokens } from "@/lib/format";
import { useSession } from "@/queries";
import { useUi } from "@/state/ui";

export function SessionHeader() {
  const sessionId = useUi((s) => s.sessionId);
  const showHidden = useUi((s) => s.showHidden);
  const setShowHidden = useUi((s) => s.setShowHidden);
  const setSearchOpen = useUi((s) => s.setSearchOpen);
  const { data: d } = useSession(sessionId);
  if (!sessionId || !d) return null;

  const s = d.summary;
  const live = s.live;
  const t = s.tokens;
  const project = d.projectPath.split("/").filter(Boolean).pop() ?? d.projectPath;
  const liveText = live
    ? `进行中 · ${live.status === "busy" ? "工作中" : "等待输入"}`
    : `已结束 · ${formatRelative(s.lastActiveMs)}`;

  return (
    <header data-testid="header" data-tauri-drag-region className="flex shrink-0 flex-col gap-1.5 border-b border-border py-2.5 pr-5 pl-6">
      <div className="flex flex-wrap items-center gap-2.5" data-tauri-drag-region>
        <h1 className="m-0 min-w-60 flex-1 truncate text-[15px] font-[650]">{s.title}</h1>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex h-7 min-w-50 items-center gap-2 rounded-md border border-border px-2.5 text-[12px] text-secondary"
        >
          <Search size={13} strokeWidth={1.6} aria-hidden />
          <span className="flex-1 text-left">搜索全部 Session</span>
          <kbd className="rounded border border-border px-1 font-sans text-[11px]">⌘K</kbd>
        </button>
        <label className="flex items-center gap-1.5 text-[12px] text-text/80">
          <Checkbox checked={showHidden} onCheckedChange={(v) => setShowHidden(v === true)} />
          显示系统消息
        </label>
        <button
          type="button"
          onClick={() => void api.copyText(d.resumeCommand)}
          className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-ground px-2.5 text-[12px] hover:bg-selection"
        >
          <Copy size={13} strokeWidth={1.5} aria-hidden />
          复制 resume 命令
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-0.5 text-[12px] text-secondary">
        <span data-testid="live-state" className={cn("flex items-center gap-1.5", live && "font-semibold text-live")}>
          {live && <span className="size-2 rounded-full bg-live" />}
          {liveText}
        </span>
        <span className="text-text/80">{project}</span>
        {s.gitBranch && <span>{s.gitBranch}</span>}
        {s.primaryModel && <span>{s.primaryModel}</span>}
        <span>
          输出 {formatTokens(t.output)} · 输入 {formatTokens(t.input + t.cacheRead + t.cacheCreation)}（缓存 {formatTokens(t.cacheRead)}）
        </span>
        <span>{formatDuration(d.durationMs)}</span>
        <span>{s.messageCount} 条消息</span>
        <span>{s.toolCallCount} 次工具调用</span>
        {s.subagentCount > 0 && <span>{s.subagentCount} 个 Subagent</span>}
      </div>
    </header>
  );
}
