import { useHotkey } from "@/lib/hotkeys";
import { cn } from "@/lib/cn";
import { useUi } from "@/state/ui";
import { setCurrentTurn, type TurnInfo, useReading } from "../transcript/reading";
import { scrollToNode } from "../transcript/Transcript";

const main = () => document.querySelector<HTMLElement>('[data-testid="transcript"]');

function goTo(t: TurnInfo) {
  setCurrentTurn(t.turn, true);
  scrollToNode({ scope: { kind: "main" }, nodeId: t.nodeId, flashMs: 1200 });
}

/** `j` / `k` turn navigation and ⌘↑ / ⌘↓ (top / bottom); inactive while typing in an input. */
function useTurnKeys() {
  const step = (d: 1 | -1) => {
    const { turns, current } = useReading.getState();
    const t = d === 1 ? turns.find((x) => x.turn > current) : [...turns].reverse().find((x) => x.turn < current);
    if (t) goTo(t);
  };
  useHotkey("j", () => step(1));
  useHotkey("k", () => step(-1));
  useHotkey("Meta+ArrowUp", () => main()?.scrollTo({ top: 0 }));
  useHotkey("Meta+ArrowDown", () => {
    const el = main();
    el?.scrollTo({ top: el.scrollHeight });
  });
}

/** 轮次大纲: a 28px right rail with one tick per turn; the current turn is blue, hover shows the prompt. */
export function Outline() {
  const sessionId = useUi((s) => s.sessionId);
  const turns = useReading((s) => s.turns);
  const current = useReading((s) => s.current);
  useTurnKeys();
  if (!sessionId || turns.length === 0) return null;
  return (
    <nav
      aria-label="轮次大纲"
      data-testid="outline"
      className="flex w-7 shrink-0 flex-col items-center border-l border-border py-3"
    >
      {turns.map((t) => {
        const on = t.turn === current;
        return (
          <button
            key={t.nodeId}
            type="button"
            data-testid="outline-tick"
            data-turn={t.turn}
            data-current={on || undefined}
            aria-label={`第 ${t.turn + 1} 轮：${t.text.slice(0, 30)}`}
            aria-current={on || undefined}
            onClick={() => goTo(t)}
            className="group relative flex min-h-1.5 max-h-6 w-full flex-1 basis-0 items-center justify-center"
          >
            <span
              className={cn(
                "block h-[3px] w-3 rounded-sm transition-colors",
                on ? "bg-accent" : "bg-secondary/60 group-hover:bg-text",
              )}
            />
            <span
              role="tooltip"
              data-testid="outline-tip"
              className="pointer-events-none absolute top-1/2 right-full z-30 mr-1.5 hidden max-w-64 -translate-y-1/2 rounded-md border border-border bg-ground px-2 py-1 text-left text-[12px] leading-snug whitespace-normal text-text shadow-lg group-hover:block group-focus-visible:block"
            >
              {t.text.length > 30 ? `${t.text.slice(0, 30)}…` : t.text}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
