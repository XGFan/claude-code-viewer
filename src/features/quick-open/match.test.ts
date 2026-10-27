import { describe, expect, it } from "vitest";
import type { ProjectSummary, SessionSummary } from "@/ipc/bindings";
import { matchProjects, matchSessions, sessionProjectIds, tokenize } from "./match";

const session = (id: string, title: string, projectId: string, editedProjectIds: string[] = [], gitBranch: string | null = null) =>
  ({ id, title, projectId, editedProjectIds, gitBranch }) as SessionSummary;

const names = new Map([
  ["/w", "richemont"],
  ["/w/identity", "rwf-identity"],
  ["/w/task", "rwf-task"],
  ["/w/wmc", "rwf-wmc"],
]);

describe("sessionProjectIds", () => {
  it("启动 Project 在前，改动过的其他 Project 随后且不重复", () => {
    expect(sessionProjectIds(session("a", "", "/w/identity", ["/w/task", "/w/identity"]))).toEqual(["/w/identity", "/w/task"]);
  });
});

describe("matchSessions", () => {
  const list = [
    session("newest", "修复 identity 登录", "/w/wmc"),
    session("multi", "排查回调失败", "/w", ["/w/identity", "/w/task"]),
    session("branch", "改字段", "/w/wmc", [], "WESP-6195"),
  ];
  const ids = (q: string) => matchSessions(list, names, tokenize(q)).map((s) => s.id);

  it("空查询原样返回", () => {
    expect(ids("  ")).toEqual(["newest", "multi", "branch"]);
  });
  it("每个词都要在标题、Project 名或分支里出现", () => {
    expect(ids("identity task")).toEqual(["multi"]);
    expect(ids("wesp")).toEqual(["branch"]);
    expect(ids("登录 wmc")).toEqual(["newest"]);
  });
  it("命中 Project 名的排在只命中标题的前面", () => {
    expect(ids("identity")).toEqual(["multi", "newest"]);
  });
});

describe("matchProjects", () => {
  const projects = [
    { id: "/w/identity", path: "/w/identity", displayName: "rwf-identity", lastActiveMs: 1 },
    { id: "/x/identity", path: "/x/identity", displayName: "identity", lastActiveMs: 2 },
    { id: "/w/wmc", path: "/w/wmc", displayName: "rwf-wmc", lastActiveMs: 3 },
  ] as ProjectSummary[];

  it("按名称或路径匹配，最近活跃在前；空查询不列出", () => {
    expect(matchProjects(projects, tokenize("identity")).map((p) => p.id)).toEqual(["/x/identity", "/w/identity"]);
    expect(matchProjects(projects, tokenize("/w/ identity")).map((p) => p.id)).toEqual(["/w/identity"]);
    expect(matchProjects(projects, [])).toEqual([]);
  });
});
