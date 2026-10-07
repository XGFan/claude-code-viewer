import { useUi } from "@/state/ui";
import { DiagnosticsPage } from "@/features/diagnostics";
import { ProjectList, StatsEntry } from "@/features/projects";
import { SearchOverlay } from "@/features/search";
import { SessionHeader } from "@/features/header";
import { SessionList } from "@/features/sessions";
import { SettingsDialog } from "@/features/settings";
import { StatsPanel } from "@/features/stats";
import { StatusBar } from "@/features/statusbar";
import { SubagentPanel } from "@/features/subagent-panel";
import { TranscriptView } from "@/features/transcript";
import { cn } from "@/lib/cn";

export default function App() {
  const view = useUi((s) => s.view);
  const sessionId = useUi((s) => s.sessionId);
  // The Subagent panel takes the session list's width so the conversation keeps a readable column.
  const panelOpen = useUi((s) => s.view === "sessions" && s.sessionId != null && s.panelStack.length > 0);

  return (
    <div className="grid h-full grid-rows-[1fr_28px]">
      <div className={cn("grid min-h-0", panelOpen ? "grid-cols-[216px_0px_1fr]" : "grid-cols-[216px_300px_1fr]")}>
        <aside data-testid="pane-projects" className="flex min-h-0 flex-col border-r border-border bg-sidebar">
          <div data-tauri-drag-region className="h-[52px] shrink-0 pl-[78px]" />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ProjectList />
          </div>
          <StatsEntry />
        </aside>

        <section
          data-testid="pane-sessions"
          aria-hidden={panelOpen || undefined}
          className={cn("flex min-h-0 flex-col border-r border-border bg-list", panelOpen && "invisible overflow-hidden border-r-0")}
        >
          <SessionList />
        </section>

        <main data-testid="pane-conversation" className="flex min-h-0 min-w-0 flex-col bg-ground">
          {view === "sessions" && (
            <>
              {!sessionId && <div data-tauri-drag-region className="h-[52px] shrink-0" />}
              <SessionHeader />
              {/* Later tasks mount FindBar / Outline (right gutter beside the transcript) / SubagentPanel here. */}
              <div className="flex min-h-0 flex-1">
                <TranscriptView />
                <SubagentPanel />
              </div>
            </>
          )}
          {view === "stats" && (
            <>
              <div data-tauri-drag-region className="h-[52px] shrink-0" />
              <div className="min-h-0 flex-1 overflow-auto">
                <StatsPanel />
              </div>
            </>
          )}
          {view === "diagnostics" && (
            <>
              <div data-tauri-drag-region className="h-[52px] shrink-0" />
              <div className="min-h-0 flex-1 overflow-auto">
                <DiagnosticsPage />
              </div>
            </>
          )}
        </main>
      </div>
      <StatusBar />
      {/* Overlays: portal/fixed based; wrapped so placeholder stubs stay out of the layout. */}
      <div className="fixed right-0 bottom-0 size-0 overflow-hidden">
        <SearchOverlay />
        <SettingsDialog />
      </div>
    </div>
  );
}
