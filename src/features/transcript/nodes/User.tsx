import type { Node } from "@/ipc/bindings";
import { clock } from "../util";

type UserBody = Extract<Node["body"], { kind: "userPrompt" }>;

export function UserPromptView({ node, body }: { node: Node; body: UserBody }) {
  const o = body.origin;
  if (o.kind === "commandOutput" || o.kind === "meta" || o.kind === "taskNotification") {
    const text =
      o.kind === "taskNotification" ? (o.summary ?? `后台任务${o.status ?? "更新"}`) : body.text;
    return (
      <div className="flex items-baseline gap-2 text-[12px] text-secondary">
        <span className="shrink-0">{o.kind === "taskNotification" ? "任务通知" : o.kind === "meta" ? "元消息" : "命令输出"}</span>
        <span className="min-w-0 truncate">{text}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="text-[11px] text-secondary">你 · {clock(node.timestampMs)}</div>
      <div className="max-w-[640px] rounded-xl border border-selection bg-selection/50 px-3.5 py-2.5 break-words whitespace-pre-wrap">
        {o.kind === "command" ? (
          <code className="font-mono text-[12px]">
            /{o.name} {o.args}
          </code>
        ) : (
          body.text
        )}
      </div>
      {body.images.length > 0 && <div className="text-[11px] text-secondary">含 {body.images.length} 张图片</div>}
    </div>
  );
}
