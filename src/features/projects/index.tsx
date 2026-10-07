import { useMemo } from "react";
import { ChartColumn, Folder, Layers } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useProjects } from "@/queries";
import { useUi } from "@/state/ui";
import { SettingsButton } from "@/features/settings";

const nf = new Intl.NumberFormat("en-US");

function Item({
  selected,
  onClick,
  icon,
  children,
  count,
  live,
  testId,
}: {
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  count?: number;
  live?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-current={selected || undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left",
        selected ? "bg-selection font-semibold text-accent" : "hover:bg-black/5 dark:hover:bg-white/5",
      )}
    >
      <span className={cn("flex shrink-0", !selected && "text-secondary")}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {live && <span title="有进行中的 Session" className="size-[7px] shrink-0 rounded-full bg-live" />}
      {count != null && <span className={cn("text-[12px]", selected ? "font-medium" : "text-secondary")}>{nf.format(count)}</span>}
    </button>
  );
}

export function ProjectList() {
  const { data } = useProjects();
  const projectIds = useUi((s) => s.projectIds);
  const view = useUi((s) => s.view);
  const setProjectIds = useUi((s) => s.setProjectIds);
  const setView = useUi((s) => s.setView);

  const projects = useMemo(() => [...(data ?? [])].sort((a, b) => b.lastActiveMs - a.lastActiveMs), [data]);
  const total = projects.reduce((n, p) => n + p.sessionCount, 0);
  const pick = (ids: string[]) => {
    setProjectIds(ids);
    setView("sessions");
  };
  const inSessions = view === "sessions";

  return (
    <nav aria-label="Projects" className="flex min-h-0 flex-1 flex-col">
      {/* "全部 Session" and the heading stay put; only the project list scrolls. */}
      <div className="shrink-0 px-2.5">
        <Item
          testId="project-all"
          selected={inSessions && projectIds.length === 0}
          onClick={() => pick([])}
          icon={<Layers size={15} strokeWidth={1.5} />}
          count={total}
        >
          全部 Session
        </Item>
        <div className="px-2 pt-4 pb-1.5 text-[11px] font-semibold tracking-[0.02em] text-secondary">PROJECTS · 按最近活跃</div>
      </div>
      <div data-testid="project-scroll" className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-2.5 pb-2">
        {projects.map((p) => (
          <Item
            key={p.id}
            testId="project-item"
            selected={inSessions && projectIds.length === 1 && projectIds[0] === p.id}
            onClick={() => pick([p.id])}
            icon={<Folder size={15} strokeWidth={1.5} />}
            count={p.sessionCount}
            live={p.liveCount > 0}
          >
            {p.displayName}
            {p.missing && <span className="text-secondary"> · 已不存在</span>}
          </Item>
        ))}
      </div>
    </nav>
  );
}

export function StatsEntry() {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  return (
    <div className="flex items-center gap-1 border-t border-border px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <Item
          testId="nav-stats"
          selected={view === "stats"}
          onClick={() => setView("stats")}
          icon={<ChartColumn size={15} strokeWidth={1.5} />}
        >
          统计
        </Item>
      </div>
      <SettingsButton className="size-7 shrink-0 text-secondary" />
    </div>
  );
}
