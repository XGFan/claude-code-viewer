import { ChevronDown, ChevronRight, CircleX } from "lucide-react";
import type { ReactNode } from "react";
import { Markdown } from "@/lib/markdown";
import { useUi } from "@/state/ui";
import { BranchSwitcher } from "../BranchSwitcher";
import type { GroupItem, RoleInfo, Row, ToolCallBlock } from "../grouping";
import { ToolCallView } from "../tools";
import { clock } from "../util";
import { Anchor } from "./Anchor";
import { UnknownJson } from "./Misc";
import { useTranscriptCtx } from "./scroll";
import type { Node } from "@/ipc/bindings";

type AssistantRowData = Extract<Row, { kind: "text" | "thinking" | "tool" | "group" | "unknownBlock" }>;

/** Wraps one segment of an assistant run; the first segment carries the role line. */
export function AssistantSegment({ role, children }: { role: RoleInfo | null; children: ReactNode }) {
  return (
    <div data-kind="assistant" className="flex flex-col items-start gap-2">
      {role && <RoleLine role={role} />}
      {children}
    </div>
  );
}

function RoleLine({ role }: { role: RoleInfo }) {
  const b = role.node.body;
  const apiError = b.kind === "assistant" && b.isApiError;
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-secondary">
      {role.branch && <BranchSwitcher point={role.branch} />}
      <span className="flex size-4 items-center justify-center rounded bg-claude text-[10px] font-bold text-white">C</span>
      Claude · {clock(role.node.timestampMs)}
      {apiError && <span className="ml-1 font-semibold text-error">API 错误</span>}
    </div>
  );
}

export function AssistantRow({ row }: { row: AssistantRowData }) {
  return <AssistantSegment role={row.role}>{segmentBody(row)}</AssistantSegment>;
}

function segmentBody(row: AssistantRowData): ReactNode {
  switch (row.kind) {
    case "text":
      return row.text.trim() ? (
        <Anchor nodeId={row.node.id} className="w-full">
          <Markdown text={row.text} className="w-full" />
        </Anchor>
      ) : (
        <Anchor nodeId={row.node.id} className="h-px w-full">
          {null}
        </Anchor>
      );
    case "thinking":
      return <Thinking nodeId={row.node.id} text={row.text} />;
    case "tool":
      return <Tool node={row.node} call={row.call} />;
    case "group":
      return <ToolGroup row={row} />;
    case "unknownBlock":
      return <UnknownJson label={`未知内容块 · ${row.blockType}`} json={row.rawJson} />;
  }
}

function Tool({ node, call }: { node: Node; call: ToolCallBlock }) {
  const { scope, sessionId } = useTranscriptCtx();
  return (
    <Anchor nodeId={node.id} toolUseId={call.toolUseId} className="w-full">
      <ToolCallView nodeId={node.id} call={call} startMs={node.timestampMs} sessionId={sessionId} scope={scope} />
    </Anchor>
  );
}

/** "N 次工具调用 · 3 Bash · 2 Read"; collapsed unless it holds a failed call (or the user opened it). */
function ToolGroup({ row }: { row: Extract<Row, { kind: "group" }> }) {
  const failed = row.failedCount > 0;
  const open = useUi((s) => s.expanded[row.key] ?? failed);
  const toggle = useUi((s) => s.toggleExpanded);
  return (
    <div data-testid="tool-group" data-open={open || undefined} className="flex w-full flex-col items-start gap-1.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => toggle(row.key, failed)}
        className="flex max-w-full items-center gap-2 rounded-lg border border-border bg-list px-2.5 py-1.5 text-[12px] text-text/80 hover:bg-selection/40"
      >
        {open ? <ChevronDown size={12} strokeWidth={1.8} aria-hidden /> : <ChevronRight size={12} strokeWidth={1.8} aria-hidden />}
        <span className="shrink-0 font-semibold">{row.callCount} 次工具调用</span>
        <span className="min-w-0 truncate text-secondary">{row.counts.map(([name, n]) => `${n} ${name}`).join(" · ")}</span>
        {failed && (
          <span className="flex shrink-0 items-center gap-1 font-semibold text-error">
            <CircleX size={12} strokeWidth={1.8} aria-hidden />
            {row.failedCount} 失败
          </span>
        )}
      </button>
      {open && (
        <div className="flex w-full flex-col gap-1.5 border-l-2 border-border pl-3">
          {row.items.map((it) => (
            <GroupEntry key={itemKey(it)} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

const itemKey = (it: GroupItem) => (it.type === "call" ? `c:${it.call.toolUseId}` : `t:${it.node.id}:${it.blockIndex}`);

function GroupEntry({ item }: { item: GroupItem }) {
  if (item.type === "thinking") return <Thinking nodeId={item.node.id} text={item.text} />;
  return <Tool node={item.node} call={item.call} />;
}

function Thinking({ nodeId, text }: { nodeId: string; text: string }) {
  const key = `thinking:${nodeId}`;
  const open = useUi((s) => s.expanded[key] ?? false);
  const toggle = useUi((s) => s.toggleExpanded);
  const lines = text.split("\n").length;
  return (
    <Anchor nodeId={nodeId} className="w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => toggle(key)}
        className="flex items-center gap-2 rounded px-1 py-1 text-[12px] text-secondary hover:text-text"
      >
        {open ? <ChevronDown size={12} strokeWidth={1.8} /> : <ChevronRight size={12} strokeWidth={1.8} />}
        <span className="italic">思考 · {lines} 行</span>
      </button>
      {open && (
        <div className="mt-1 ml-1 border-l-2 border-border pl-3 text-[12px] whitespace-pre-wrap text-secondary">{text}</div>
      )}
    </Anchor>
  );
}
