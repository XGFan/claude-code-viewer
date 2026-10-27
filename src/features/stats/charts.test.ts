import { describe, expect, it } from "vitest";
import { activityAxisLabel, activityTitle } from "./charts";

const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).getTime();

describe("activityAxisLabel", () => {
  it("小时柱只在 0 点标注：1h/3h 每天标星期与日，6h/12h 只在周一标月与日", () => {
    expect(activityAxisLabel("hour1", at(2026, 10, 20))).toBe("Tue 20");
    expect(activityAxisLabel("hour1", at(2026, 10, 20, 5))).toBe("");
    expect(activityAxisLabel("hour6", at(2026, 10, 5))).toBe("Oct 5");
    expect(activityAxisLabel("hour6", at(2026, 10, 6))).toBe("");
  });
  it("天及以上标注每月的第一根柱子，一月标年份", () => {
    expect(activityAxisLabel("day", at(2026, 8, 1))).toBe("Aug");
    expect(activityAxisLabel("day", at(2026, 8, 2))).toBe("");
    expect(activityAxisLabel("week", at(2026, 9, 7))).toBe("Sep");
    expect(activityAxisLabel("week", at(2026, 9, 14))).toBe("");
    expect(activityAxisLabel("month", at(2027, 1, 1))).toBe("2027");
    expect(activityAxisLabel("month", at(2027, 4, 1))).toBe("Apr");
    expect(activityAxisLabel("month", at(2027, 2, 1))).toBe("");
  });
});

describe("activityTitle", () => {
  it("按柱宽给出中文时间段", () => {
    expect(activityTitle("hour1", at(2026, 10, 22, 4), at(2026, 10, 22, 5))).toBe("10月22日 周四 04:00–05:00");
    expect(activityTitle("hour6", at(2026, 10, 22, 18), at(2026, 10, 23))).toBe("10月22日 周四 18:00–24:00");
    expect(activityTitle("day", at(2026, 10, 22), at(2026, 10, 23))).toBe("10月22日 周四");
    expect(activityTitle("week", at(2026, 10, 19), at(2026, 10, 26))).toBe("10月19日–10月25日");
    expect(activityTitle("month", at(2026, 10, 1), at(2026, 11, 1))).toBe("2026年10月");
  });
});
