import { describe, expect, it } from "vitest";
import { formatDuration, formatRelative, formatTokens } from "./format";

describe("formatTokens", () => {
  it("按量级缩写", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(999)).toBe("999");
    expect(formatTokens(48300)).toBe("48.3K");
    expect(formatTokens(1000)).toBe("1K");
    expect(formatTokens(1_210_000)).toBe("1.21M");
  });
});

describe("formatDuration", () => {
  it("小时/分/秒", () => {
    expect(formatDuration(72 * 60_000)).toBe("1 小时 12 分");
    expect(formatDuration(3_600_000)).toBe("1 小时");
    expect(formatDuration(5 * 60_000)).toBe("5 分");
    expect(formatDuration(30_000)).toBe("30 秒");
  });
});

describe("formatRelative", () => {
  const now = new Date(2026, 9, 7, 12, 0, 0); // 周三
  it("各档位", () => {
    expect(formatRelative(new Date(2026, 9, 7, 11, 59, 40), now)).toBe("刚刚");
    expect(formatRelative(new Date(2026, 9, 7, 11, 54, 0), now)).toBe("6 分钟前");
    expect(formatRelative(new Date(2026, 9, 6, 8, 0, 0), now)).toBe("昨天");
    expect(formatRelative(new Date(2026, 9, 5, 8, 0, 0), now)).toBe("周一");
    expect(formatRelative(new Date(2026, 8, 30, 8, 0, 0), now)).toBe("9月30日");
  });
});
