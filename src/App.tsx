import { cn } from "@/lib/cn";
import { useUi } from "@/state/ui";
import { DiagnosticsPage } from "@/features/diagnostics";
import { FindBar } from "@/features/find";
import { Outline } from "@/features/outline";
import { ProjectList } from "@/features/projects";
import { SearchOverlay } from "@/features/search";
import { SessionHeader } from "@/features/header";
import { SessionList } from "@/features/sessions";
import { SettingsDialog } from "@/features/settings";
import { StatsPanel } from "@/features/stats";
import { StatusBar } from "@/features/statusbar";
import { SubagentPanel } from "@/features/subagent-panel";
import { TranscriptView } from "@/features/transcript";

export default function App() {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);

  return (
    <div className="grid h-full grid-rows-[1fr_28px]">
      <div className="grid min-h-0 grid-cols-[216px_300px_1fr]">
        <aside data-testid="pane-projects" className="flex min-h-0 flex-col border-r border-border bg-sidebar">
          <div data-tauri-drag-region className="h-[52px] shrink-0 pl-[78px]" />
          <div className="min-h-0 flex-1 overflow-auto">
            <ProjectList />
          </div>
          <button
            data-testid="nav-stats"
            onClick={() => setView("stats")}
            className={cn("m-2 rounded-md px-2 py-1 text-left", view === "stats" && "bg-selection text-accent")}
          >
            统计
          </button>
        </aside>

        <section data-testid="pane-sessions" className="flex min-h-0 flex-col border-r border-border bg-list">
          <div data-tauri-drag-region className="h-[52px] shrink-0" />
          <div className="min-h-0 flex-1 overflow-auto">
            <SessionList />
          </div>
        </section>

        <main data-testid="pane-conversation" className="flex min-h-0 flex-col bg-ground">
          <div data-tauri-drag-region className="h-[52px] shrink-0" />
          <div className="min-h-0 flex-1 overflow-auto">
            {view === "sessions" && (
              <>
                <SessionHeader />
                <FindBar />
                <TranscriptView />
                <Outline />
                <SubagentPanel />
              </>
            )}
            {view === "stats" && <StatsPanel />}
            {view === "diagnostics" && <DiagnosticsPage />}
          </div>
        </main>
      </div>
      <StatusBar />
      <SearchOverlay />
      <SettingsDialog />
    </div>
  );
}
