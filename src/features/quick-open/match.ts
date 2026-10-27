import type { ProjectSummary, SessionSummary } from "@/ipc/bindings";

/** Projects of a session in display order: the one it started in, then the others it edited. */
export function sessionProjectIds(s: SessionSummary): string[] {
  return [s.projectId, ...s.editedProjectIds.filter((id) => id !== s.projectId)];
}

/** Lower-cased whitespace-separated terms; all must match. */
export function tokenize(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Sessions where every term appears in the title, a Project name or the git branch. Sessions with more
 * terms matching a Project name or the branch come first; ties keep the input order (newest first).
 */
export function matchSessions(sessions: SessionSummary[], names: Map<string, string>, terms: string[]): SessionSummary[] {
  if (terms.length === 0) return sessions;
  const scored: { s: SessionSummary; score: number }[] = [];
  for (const s of sessions) {
    const title = s.title.toLowerCase();
    const tags = [...sessionProjectIds(s).map((id) => names.get(id) ?? ""), s.gitBranch ?? ""].map((t) => t.toLowerCase());
    let score = 0;
    const all = terms.every((t) => {
      const inTags = tags.some((tag) => tag.includes(t));
      score += Number(inTags);
      return inTags || title.includes(t);
    });
    if (all) scored.push({ s, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.s);
}

/** Projects whose name or path contains every term, most recently active first. */
export function matchProjects(projects: ProjectSummary[], terms: string[]): ProjectSummary[] {
  if (terms.length === 0) return [];
  return projects
    .filter((p) => {
      const hay = `${p.displayName}\n${p.path}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    })
    .sort((a, b) => b.lastActiveMs - a.lastActiveMs);
}
