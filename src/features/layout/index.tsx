import { List, PanelLeft } from "lucide-react";
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
 * Left padding for `pane` when it is the leftmost visible column (the Project column is collapsed), so its
 * header clears the traffic lights and the toggles; `undefined` otherwise.
 */
export function useLeadingInset(pane: "sessions" | "main"): string | undefined {
  const projectsCollapsed = useUi((s) => s.collapsed.projects);
  const { hidden } = useSessionsHidden();
  const fullScreen = useFullScreen();
  if (!projectsCollapsed || (pane === "sessions" ? hidden : !hidden)) return undefined;
  return fullScreen ? "pl-[84px]" : "pl-[140px]";
}

interface ToggleProps {
  pane: CollapsiblePane;
  label: string;
  keys: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

function Toggle({ pane, label, keys, icon, disabled }: ToggleProps) {
  const collapsed = useUi((s) => s.collapsed[pane]);
  const toggle = useUi((s) => s.toggleCollapsed);
  const action = `${collapsed ? "显示" : "隐藏"} ${label}`;
  return (
    <button
      type="button"
      aria-label={action}
      title={`${action}（${keys}）`}
      disabled={disabled}
      onClick={() => toggle(pane)}
      className="flex size-7 items-center justify-center rounded-md text-secondary outline-none hover:bg-text/8 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {icon}
    </button>
  );
}

/** Column toggles, pinned right after the traffic lights like a native toolbar. */
export function PaneToggles() {
  const toggle = useUi((s) => s.toggleCollapsed);
  const { forced } = useSessionsHidden();
  const fullScreen = useFullScreen();
  useHotkey("Ctrl+Meta+S", () => toggle("projects"), { enableInInputs: true });
  useHotkey("Ctrl+Meta+L", () => !forced && toggle("sessions"), { enableInInputs: true });

  return (
    <div data-testid="pane-toggles" className={cn("fixed top-[4px] z-10 flex gap-0.5", fullScreen ? "left-3" : "left-[78px]")}>
      <Toggle pane="projects" label="Project 栏" keys="⌃⌘S" icon={<PanelLeft size={16} strokeWidth={1.6} aria-hidden />} />
      <Toggle pane="sessions" label="Session 列表" keys="⌃⌘L" icon={<List size={16} strokeWidth={1.6} aria-hidden />} disabled={forced} />
    </div>
  );
}
