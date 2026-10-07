import { create } from "zustand";
import type { BranchChoice, Drill, JumpTarget, SessionSort, TimeRange, TranscriptScope } from "@/ipc/bindings";

export type View = "sessions" | "stats" | "diagnostics";

export interface Highlight {
  nodeId: string;
  toolUseId?: string;
}

/** Per-session state; reset whenever `sessionId` changes. */
const sessionDefaults = {
  scope: { kind: "main" } as TranscriptScope,
  branchChoices: [] as BranchChoice[],
  showHidden: false,
  /** Subagent Run ids, outermost first. */
  panelStack: [] as string[],
  findOpen: false,
  findQuery: "",
  findIndex: 0,
  highlight: null as Highlight | null,
  /** Keys: `tool:<nodeId>|<toolUseId>`, `group:<firstNodeId>|<firstToolUseId>`, `thinking:<nodeId>`, `inherited`, `compact:<nodeId>`. */
  expanded: {} as Record<string, boolean>,
};

interface UiState {
  view: View;
  /** Empty = all projects (matches `SessionQuery.projectIds`). */
  projectIds: string[];
  sessionId: string | null;
  scope: TranscriptScope;
  branchChoices: BranchChoice[];
  showHidden: boolean;
  panelStack: string[];
  searchOpen: boolean;
  findOpen: boolean;
  findQuery: string;
  findIndex: number;
  pendingJump: JumpTarget | null;
  highlight: Highlight | null;
  expanded: Record<string, boolean>;
  sessionSort: SessionSort;
  sessionDescending: boolean;
  statsDrill: Drill | null;
  /** Time range of the stats view a drill came from; applied to the session list only while the drill is active. */
  statsDrillRange: TimeRange | null;
  settingsOpen: boolean;

  setView: (view: View) => void;
  setProjectIds: (ids: string[]) => void;
  /** Switches session (resetting per-session state); a no-op when the id is unchanged. */
  selectSession: (id: string | null) => void;
  /** Selects `headId` at `anchorKey`, replacing any earlier choice for that anchor. */
  setBranchChoice: (choice: BranchChoice) => void;
  setShowHidden: (show: boolean) => void;
  setPanelStack: (stack: string[]) => void;
  pushPanel: (agentId: string) => void;
  popPanel: () => void;
  setSearchOpen: (open: boolean) => void;
  setFindOpen: (open: boolean) => void;
  setFindQuery: (query: string) => void;
  setFindIndex: (index: number) => void;
  /** Opens the target's session (if different) and queues the jump for the transcript to consume. */
  jumpTo: (target: JumpTarget) => void;
  setHighlight: (h: Highlight | null) => void;
  toggleExpanded: (key: string, defaultValue?: boolean) => void;
  setExpanded: (key: string, value: boolean) => void;
  setSessionSort: (sort: SessionSort, descending?: boolean) => void;
  setStatsDrill: (drill: Drill | null, range?: TimeRange | null) => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useUi = create<UiState>()((set) => ({
  view: "sessions",
  projectIds: [],
  sessionId: null,
  ...sessionDefaults,
  searchOpen: false,
  pendingJump: null,
  sessionSort: "lastActive",
  sessionDescending: true,
  statsDrill: null,
  statsDrillRange: null,
  settingsOpen: false,

  setView: (view) => set({ view }),
  setProjectIds: (projectIds) => set({ projectIds }),
  selectSession: (id) => set((s) => (s.sessionId === id ? s : { sessionId: id, ...sessionDefaults })),
  setBranchChoice: (choice) =>
    set((s) => ({ branchChoices: [...s.branchChoices.filter((c) => c.anchorKey !== choice.anchorKey), choice] })),
  setShowHidden: (showHidden) => set({ showHidden }),
  setPanelStack: (panelStack) => set({ panelStack }),
  pushPanel: (agentId) => set((s) => ({ panelStack: [...s.panelStack, agentId] })),
  popPanel: () => set((s) => ({ panelStack: s.panelStack.slice(0, -1) })),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setFindOpen: (findOpen) => set({ findOpen }),
  setFindQuery: (findQuery) => set({ findQuery, findIndex: 0 }),
  setFindIndex: (findIndex) => set({ findIndex }),
  jumpTo: (target) =>
    set((s) => ({
      view: "sessions",
      pendingJump: target,
      ...(s.sessionId === target.sessionId ? {} : { sessionId: target.sessionId, ...sessionDefaults }),
    })),
  setHighlight: (highlight) => set({ highlight }),
  toggleExpanded: (key, defaultValue = false) =>
    set((s) => ({ expanded: { ...s.expanded, [key]: !(s.expanded[key] ?? defaultValue) } })),
  setExpanded: (key, value) => set((s) => ({ expanded: { ...s.expanded, [key]: value } })),
  setSessionSort: (sessionSort, descending) =>
    set((s) => ({ sessionSort, sessionDescending: descending ?? s.sessionDescending })),
  setStatsDrill: (statsDrill, range = null) => set({ statsDrill, statsDrillRange: statsDrill ? range : null }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}));
