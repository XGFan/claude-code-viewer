import { describe, expect, it } from "vitest";
import { cycleEnd, cycleStart } from "./cycle";

const MON_14 = { weekday: 0, minutes: 14 * 60 };
const at = (s: string) => new Date(s);

describe("cycleStart", () => {
  it("回到最近一次重置", () => {
    // 2026-10-15 is a Thursday.
    expect(cycleStart(at("2026-10-15T10:00:00"), MON_14)).toEqual(at("2026-10-12T14:00:00"));
    expect(cycleEnd(at("2026-10-12T14:00:00"))).toEqual(at("2026-10-19T14:00:00"));
  });

  it("重置日当天：重置前属于上一周期，重置时刻起属于新周期", () => {
    expect(cycleStart(at("2026-10-12T13:59:00"), MON_14)).toEqual(at("2026-10-05T14:00:00"));
    expect(cycleStart(at("2026-10-12T14:00:00"), MON_14)).toEqual(at("2026-10-12T14:00:00"));
  });

  it("重置日在今天之后（周日 0 点重置，今天周四）", () => {
    expect(cycleStart(at("2026-10-15T10:00:00"), { weekday: 6, minutes: 0 })).toEqual(at("2026-10-11T00:00:00"));
  });
});
