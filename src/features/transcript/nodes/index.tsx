import type { Node } from "@/ipc/bindings";
import { cn } from "@/lib/cn";
import { AssistantView } from "./Assistant";
import { AttachmentLine, CompactDivider, CompactSummaryCard, SystemLine, UnknownJson } from "./Misc";
import { UserPromptView } from "./User";

export function NodeView({ node, showRole }: { node: Node; showRole: boolean }) {
  const b = node.body;
  return (
    <div data-node-id={node.id} data-kind={b.kind} className={cn(node.hidden && "opacity-60")}>
      {b.kind === "userPrompt" && <UserPromptView node={node} body={b} />}
      {b.kind === "assistant" && <AssistantView node={node} body={b} showRole={showRole} />}
      {b.kind === "compactBoundary" && <CompactDivider node={node} />}
      {b.kind === "compactSummary" && <CompactSummaryCard node={node} body={b} />}
      {b.kind === "system" && <SystemLine body={b} />}
      {b.kind === "attachment" && <AttachmentLine body={b} />}
      {b.kind === "unknown" && <UnknownJson label={`未知记录 · ${b.entryType}`} json={b.rawJson} />}
    </div>
  );
}
