import type { Node } from "@/ipc/bindings";
import { cn } from "@/lib/cn";
import type { Row } from "../grouping";
import { FinalResultCard, OrphanHeader, ParallelAgents, SubagentCard, TaskPromptCard, WorkflowCard } from "./Agents";
import { Anchor } from "./Anchor";
import { AssistantRow, AssistantSegment } from "./Assistant";
import { InheritedBanner, InheritedDivider } from "./Fork";
import { AttachmentLine, CompactRow, CompactSummaryCard, SystemLine, UnknownJson } from "./Misc";
import { NotificationRow, UserPromptView } from "./User";

export { TranscriptContext, scrollToNode, type ScrollRequest, type TranscriptCtx } from "./scroll";

/** Rows that continue an assistant run sit closer to the previous row. */
export const isContinuation = (row: Row) => "role" in row && row.role === null;

/** Renders one virtual-list row produced by `buildRows`. */
export function RowView({ row }: { row: Row }) {
  switch (row.kind) {
    case "prompt":
      return (
        <div data-node-id={row.node.id} data-kind="userPrompt" className={cn(row.node.hidden && "opacity-60")}>
          <UserPromptView node={row.node} body={row.body} branch={row.branch} />
        </div>
      );
    case "notification":
      return <NotificationRow node={row.node} body={row.body} />;
    case "taskPrompt":
      return <TaskPromptCard node={row.node} text={row.text} />;
    case "text":
    case "thinking":
    case "tool":
    case "group":
    case "unknownBlock":
      return <AssistantRow row={row} />;
    case "subagent":
      return (
        <AssistantSegment role={row.role}>
          <SubagentCard run={row.run} call={row.call} node={row.node} />
        </AssistantSegment>
      );
    case "parallel":
      return (
        <AssistantSegment role={row.role}>
          <ParallelAgents cards={row.cards} />
        </AssistantSegment>
      );
    case "workflow":
      return (
        <AssistantSegment role={row.role}>
          <WorkflowCard run={row.run} node={row.node} call={row.call} />
        </AssistantSegment>
      );
    case "compact":
      return <CompactRow boundary={row.boundary} summary={row.summary} />;
    case "node":
      return <NodeView node={row.node} />;
    case "inheritedBanner":
      return <InheritedBanner range={row.range} count={row.count} expanded={row.expanded} lastTimestampMs={row.lastTimestampMs} />;
    case "inheritedDivider":
      return <InheritedDivider />;
    case "orphanHeader":
      return <OrphanHeader count={row.count} />;
    case "orphan":
      return <SubagentCard run={row.run} />;
    case "finalResult":
      return <FinalResultCard text={row.text} />;
  }
}

/** System / attachment / unknown entries, non-turn prompts and standalone compact summaries. */
export function NodeView({ node }: { node: Node }) {
  const b = node.body;
  return (
    <Anchor nodeId={node.id}>
      <div data-node-id={node.id} data-kind={b.kind} className={cn(node.hidden && "opacity-60")}>
        {b.kind === "userPrompt" && <UserPromptView node={node} body={b} />}
        {b.kind === "compactSummary" && <CompactSummaryCard node={node} body={b} />}
        {b.kind === "system" && <SystemLine body={b} />}
        {b.kind === "attachment" && <AttachmentLine body={b} />}
        {b.kind === "unknown" && <UnknownJson label={`未知记录 · ${b.entryType}`} json={b.rawJson} />}
      </div>
    </Anchor>
  );
}
