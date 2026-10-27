import { ChartColumn, List, Search } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useHotkey } from "@/lib/hotkeys";
import { cn } from "@/lib/cn";
import { useUi, type CollapsiblePane } from "@/state/ui";

function subscribeResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** A native full-screen window covers the whole screen and has no traffic lights to clear. */
function useFullScreen(): boolean {
  return useSyncExternalStore(subscribeResize, () => window.innerWidth === screen.width && window.innerHeight === screen.height);
}

/** The session list column is hidden by the user, or because the Subagent panel / stats / diagnostics take its place. */
export function useSessionsHidden(): { hidden: boolean; forced: boolean } {
  const collapsed = useUi((s) => s.collapsed.sessions);
  const forced = useUi((s) => s.view !== "sessions" || (s.sessionId != null && s.panelStack.length > 0));
  return { hidden: forced || collapsed, forced };
}

/**
 * Left padding for the main pane's header when the Session list is hidden, so it clears the traffic
 * lights and the toolbar; `undefined` otherwise. (The list has its own strip for them.)
 */
export function useLeadingInset(): string | undefined {
  const { hidden } = useSessionsHidden();
  const fullScreen = useFullScreen();
  if (!hidden) return undefined;
  return fullScreen ? "pl-[84px]" : "pl-[140px]";
}

const TOOL_CLASS =
  "flex size-7 items-center justify-center rounded-md text-secondary outline-none hover:bg-text/8 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 disabled:hover:bg-transparent aria-pressed:bg-selection aria-pressed:text-accent";

function Toggle({ pane, label, keys, icon, disabled }: { pane: CollapsiblePane; label: string; keys: string; icon: React.ReactNode; disabled?: boolean }) {
  const collapsed = useUi((s) => s.collapsed[pane]);
  const toggle = useUi((s) => s.toggleCollapsed);
  const action = `${collapsed ? "显示" : "隐藏"} ${label}`;
  return (
    <button type="button" aria-label={action} title={`${action}（${keys}）`} disabled={disabled} onClick={() => toggle(pane)} className={TOOL_CLASS}>
      {icon}
    </button>
  );
}

/** Stats replaces the conversation; pressing it again goes back. Lives in the status bar. */
export function StatsToggle({ className }: { className?: string }) {
  const active = useUi((s) => s.view === "stats");
  const setView = useUi((s) => s.setView);
  return (
    <button
      type="button"
      data-testid="nav-stats"
      aria-label="统计"
      title="统计"
      aria-pressed={active}
      onClick={() => setView(active ? "sessions" : "stats")}
      className={cn(TOOL_CLASS, className)}
    >
      <ChartColumn size={15} strokeWidth={1.6} aria-hidden />
    </button>
  );
}

/** Session list toggle and search, pinned right after the traffic lights like a native toolbar. */
export function Toolbar() {
  const toggle = useUi((s) => s.toggleCollapsed);
  const { forced } = useSessionsHidden();
  const fullScreen = useFullScreen();
  useHotkey("Ctrl+Meta+L", () => !forced && toggle("sessions"), { enableInInputs: true });

  return (
    <div data-testid="toolbar" className={cn("fixed top-[4px] z-10 flex gap-0.5", fullScreen ? "left-3" : "left-[78px]")}>
      <Toggle pane="sessions" label="Session 列表" keys="⌃⌘L" icon={<List size={16} strokeWidth={1.6} aria-hidden />} disabled={forced} />
      <button
        type="button"
        data-testid="search-button"
        aria-label="搜索"
        title="搜索（⌘K）"
        onClick={() => useUi.getState().setSearchOpen(true)}
        className={TOOL_CLASS}
      >
        <Search size={16} strokeWidth={1.6} aria-hidden />
      </button>
    </div>
  );
}
