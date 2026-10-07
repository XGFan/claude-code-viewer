import type { AppInfo, Diagnostics, IndexStatus, Stats } from "@/ipc/bindings";
import { DAY, NOW } from "./builders";
import { HOMELAB, LUMEN, ORBIT } from "./projects";

export const appInfo = {
  version: "0.1.0",
  dataRoot: "/Users/dev/.claude",
  dataRootSource: "default",
  dataRootExists: true,
  cacheDir: "/Users/dev/Library/Caches/claude-viewer",
  schemaVersion: 1,
} satisfies AppInfo;

export const indexStatus = {
  phase: "idle",
  filesTotal: 1342,
  filesDone: 1342,
  bytesTotal: 3_221_225_472,
  bytesDone: 3_221_225_472,
  sessionsTotal: 10,
  textReady: true,
  error: null,
} satisfies IndexStatus;

export const diagnostics = {
  filesScanned: 1342,
  sessions: 10,
  emptySessions: 2,
  failedLines: 3,
  filesWithFailures: [
    { path: "/Users/dev/.claude/projects/-Users-dev-Developer-orbit-web/5e1c0b7a-0006-4000-8000-000000000006.jsonl", failedLines: 3, firstError: "EOF while parsing a string at line 412 column 18" },
  ],
  unknownEntryTypes: [{ name: "frame-link", count: 14, versions: ["2.1.88", "2.1.91"] }],
  unknownBlockTypes: [{ name: "server_tool_use", count: 5, versions: ["2.1.91"] }],
  unknownSystemSubtypes: [{ name: "memory_saved", count: 2, versions: ["2.1.91"] }],
  unknownTools: [{ name: "ScheduleWakeup", count: 9, versions: ["2.1.90", "2.1.91"] }],
  versions: [
    { version: "2.1.91", sessions: 6, failedLines: 0, unknownItems: 12, lastSeenMs: NOW - 120_000 },
    { version: "2.1.88", sessions: 3, failedLines: 3, unknownItems: 9, lastSeenMs: NOW - 5 * DAY },
    { version: "2.1.76", sessions: 1, failedLines: 0, unknownItems: 0, lastSeenMs: NOW - 20 * DAY },
  ],
  duplicateUuids: 2,
  orphanSubagents: 1,
} satisfies Diagnostics;

function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Deterministic pseudo-random in [0, 1). */
const rnd = (i: number) => {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const models = ["claude-sonnet-5-5", "claude-opus-4-7"];
const daily = Array.from({ length: 30 }, (_, i) => 29 - i).flatMap((back) =>
  models.map((model, m) => {
    const k = back * 2 + m;
    const scale = m === 0 ? 1 : 0.4;
    return {
      day: localDay(NOW - back * DAY),
      model,
      input: Math.round(rnd(k) * 40_000 * scale) + 2_000,
      output: Math.round(rnd(k + 100) * 180_000 * scale) + 5_000,
      cacheRead: Math.round(rnd(k + 200) * 4_000_000 * scale) + 100_000,
      cacheCreation: Math.round(rnd(k + 300) * 300_000 * scale) + 10_000,
    };
  }),
);

export const stats = {
  overview: { sessions: 10, messages: 1286, outputTokens: daily.reduce((s, d) => s + d.output, 0), activeDays: 24 },
  daily,
  heatDaily: Array.from({ length: 90 }, (_, i) => ({ day: localDay(NOW - (89 - i) * DAY), messages: Math.round(rnd(i + 7) * 80) })),
  heatWeekHour: Array.from({ length: 7 * 24 }, (_, i) => ({
    weekday: Math.floor(i / 24),
    hour: i % 24,
    messages: i % 24 >= 9 && i % 24 <= 22 ? Math.round(rnd(i + 11) * 60) : Math.round(rnd(i + 11) * 5),
  })),
  projects: [
    { projectId: LUMEN, displayName: "lumen-api", sessions: 4, messages: 612, outputTokens: 2_140_000 },
    { projectId: ORBIT, displayName: "orbit-web", sessions: 4, messages: 488, outputTokens: 1_310_000 },
    { projectId: HOMELAB, displayName: "homelab-infra", sessions: 2, messages: 186, outputTokens: 520_000 },
  ],
  tools: [
    { name: "Bash", calls: 1240, failures: 118 },
    { name: "Read", calls: 980, failures: 4 },
    { name: "Edit", calls: 640, failures: 22 },
    { name: "Grep", calls: 530, failures: 0 },
    { name: "Write", calls: 210, failures: 3 },
    { name: "TodoWrite", calls: 150, failures: 0 },
    { name: "Agent", calls: 96, failures: 5 },
    { name: "mcp__github__list_pull_requests", calls: 12, failures: 1 },
  ],
  subagents: [
    { agentType: "Explore", runs: 58, outputTokens: 310_000, avgDurationMs: 42_000 },
    { agentType: "general-purpose", runs: 31, outputTokens: 520_000, avgDurationMs: 188_000 },
    { agentType: "test-engineer", runs: 12, outputTokens: 140_000, avgDurationMs: 236_000 },
  ],
} satisfies Stats;
