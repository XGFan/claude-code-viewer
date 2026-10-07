import { ArrowUp, Clock } from "lucide-react";
import type { BranchPoint, Node } from "@/ipc/bindings";
import { BranchSwitcher } from "../BranchSwitcher";
import { ImageRefs } from "../tools";
import { clock } from "../util";
import { Anchor } from "./Anchor";
import { scrollToNode, useTranscriptCtx } from "./scroll";

type UserBody = Extract<Node["body"], { kind: "userPrompt" }>;

/** Human / command prompt (turn start), with the branch switcher when it is a branch head. */
export function UserPromptView({ node, body, branch }: { node: Node; body: UserBody; branch?: BranchPoint | null }) {
  const o = body.origin;
  if (o.kind !== "human" && o.kind !== "command") {
    return (
      <div className="flex items-baseline gap-2 text-[12px] text-secondary">
        <span className="shrink-0">{o.kind === "meta" ? "元消息" : o.kind === "taskNotification" ? "任务通知" : "命令输出"}</span>
        <span className="min-w-0 truncate">{body.text}</span>
      </div>
    );
  }
  return (
    <Anchor nodeId={node.id} className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2 text-[11px] text-secondary">
        {branch && <BranchSwitcher point={branch} />}
        <span>你 · {clock(node.timestampMs)}</span>
      </div>
      <div className="max-w-[640px] rounded-xl border border-selection bg-selection/50 px-3.5 py-2.5 break-words whitespace-pre-wrap">
        {o.kind === "command" ? (
          <code className="font-mono text-[12px]">
            /{o.name} {o.args}
          </code>
        ) : (
          body.text
        )}
      </div>
      {body.images.length > 0 && <PromptImages node={node} body={body} />}
    </Anchor>
  );
}

const STATUS_TEXT: Record<string, string> = { completed: "已完成", failed: "失败", killed: "已终止", error: "失败" };

/** Task-notification prompt: compact system-style row linking back to the background agent's card. */
export function NotificationRow({ node, body }: { node: Node; body: UserBody }) {
  const { runs, toolNode, scope } = useTranscriptCtx();
  const o = body.origin;
  if (o.kind !== "taskNotification") return null;
  const run = [...runs.values()].find((r) => (o.toolUseId && r.toolUseId === o.toolUseId) || (o.taskId && r.agentId === o.taskId));
  const cardNode = o.toolUseId ? toolNode.get(o.toolUseId) : undefined;
  const failed = o.status === "failed" || o.status === "error";
  return (
    <Anchor
      nodeId={node.id}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-[12px] text-text/80"
    >
      <Clock size={14} strokeWidth={1.5} className="shrink-0 text-secondary" aria-hidden />
      <span data-testid="task-notification" className="min-w-[200px] flex-1">
        后台 agent <strong className="font-semibold">{run?.description ?? run?.agentType ?? o.taskId ?? "任务"}</strong>{" "}
        <span className={failed ? "text-error" : undefined}>{STATUS_TEXT[o.status ?? ""] ?? o.status ?? "有更新"}</span>
        {o.summary && <span className="text-secondary"> · {o.summary}</span>}
        <span className="ml-1.5 text-secondary">{clock(node.timestampMs)}</span>
      </span>
      {cardNode && o.toolUseId && (
        <button
          type="button"
          data-testid="notification-to-card"
          onClick={() => scrollToNode({ scope, nodeId: cardNode, toolUseId: o.toolUseId })}
          className="flex items-center gap-0.5 font-semibold text-accent hover:underline"
        >
          <ArrowUp size={12} strokeWidth={2} aria-hidden />
          查看派出位置
        </button>
      )}
    </Anchor>
  );
}

function PromptImages({ node, body }: { node: Node; body: UserBody }) {
  const { sessionId, scope } = useTranscriptCtx();
  return <ImageRefs images={body.images} ctx={{ sessionId, scope, nodeId: node.id }} />;
}
