import { useEffect, useRef, useSyncExternalStore } from "react";
import { type ChartHandle, type ChartOption, createChart } from "@/lib/echarts";

const query = "(prefers-color-scheme: dark)";

/** Follows the OS color scheme (the app theme is `prefers-color-scheme` driven). */
export function useDark(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
  );
}

interface Props {
  option: ChartOption;
  height: number;
  label: string;
  testId?: string;
  onPick?: (params: { data?: unknown; name?: string; seriesName?: string }) => void;
}

export function Chart({ option, height, label, testId, onPick }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<ChartHandle | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    const c = createChart(el.current!);
    chart.current = c;
    c.onClick((p) => pick.current?.(p as never));
    return () => {
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option);
  }, [option]);

  return <div ref={el} role="img" aria-label={label} data-testid={testId} style={{ height, width: "100%" }} />;
}
