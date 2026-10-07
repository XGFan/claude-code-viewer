import { ChevronDown, ChevronRight } from "lucide-react";
import type { AssistantBlock, Node } from "@/ipc/bindings";
import { Markdown } from "@/lib/markdown";
import { useUi } from "@/state/ui";
import { ToolCallView } from "../tools";
import { clock } from "../util";
import { UnknownJson } from "./Misc";

type AssistantBody = Extract<Node["body"], { kind: "assistant" }>;

export function AssistantView({ node, body, showRole }: { node: Node; body: AssistantBody; showRole: boolean }) {
  return (
    <div className="flex flex-col items-start gap-2">
      {showRole && (
        <div className="flex items-center gap-1.5 text-[11px] text-secondary">
          <span className="flex size-4 items-center justify-center rounded bg-claude text-[10px] font-bold text-white">C</span>
          Claude · {clock(node.timestampMs)}
        </div>
      )}
      {body.isApiError && <div className="text-[12px] text-error">API 错误</div>}
      {body.blocks.map((b, i) => (
        <Block key={blockKey(b, i)} node={node} block={b} />
      ))}
    </div>
  );
}

const blockKey = (b: AssistantBlock, i: number) => (b.kind === "toolCall" ? `t:${b.toolUseId}` : `${b.kind}:${i}`);

function Block({ node, block }: { node: Node; block: AssistantBlock }) {
  switch (block.kind) {
    case "text":
      return block.text.trim() ? <Markdown text={block.text} className="w-full" /> : null;
    case "thinking":
      return block.text.trim() ? <Thinking nodeId={node.id} text={block.text} /> : null;
    case "toolCall":
      return (
        <div className="w-full">
          <ToolCallView nodeId={node.id} call={block} startMs={node.timestampMs} />
        </div>
      );
    case "unknown":
      return <UnknownJson label={`未知内容块 · ${block.blockType}`} json={block.rawJson} />;
  }
}

function Thinking({ nodeId, text }: { nodeId: string; text: string }) {
  const key = `thinking:${nodeId}`;
  const open = useUi((s) => s.expanded[key] ?? false);
  const toggle = useUi((s) => s.toggleExpanded);
  const lines = text.split("\n").length;
  return (
    <div className="w-full">
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
    </div>
  );
}
