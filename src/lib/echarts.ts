import { BarChart, HeatmapChart } from "echarts/charts";
import { GridComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

export type ChartOption = echarts.EChartsCoreOption;

export interface ChartHandle {
  setOption(option: ChartOption): void;
  /** Fires with the clicked data item's `params` (echarts click event). */
  onClick(handler: (params: unknown) => void): void;
  dispose(): void;
}

/** Tree-shaken chart bound to `el`: auto-resizes with the element, `dispose` releases everything. */
export function createChart(el: HTMLElement): ChartHandle {
  const chart = echarts.init(el, undefined, { renderer: "canvas" });
  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(el);
  return {
    setOption: (option) => chart.setOption(option, true),
    onClick: (handler) => {
      chart.off("click");
      chart.on("click", handler);
    },
    dispose: () => {
      ro.disconnect();
      chart.dispose();
    },
  };
}
