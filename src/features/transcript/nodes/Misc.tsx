import { ChevronDown, ChevronRight, Minimize2 } from "lucide-react";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/cn";
import type { Node } from "@/ipc/bindings";
import { useUi } from "@/state/ui";
import { clock, prettyJson } from "../util";

type Body<K extends Node["body"]["kind"]> = Extract<Node["body"], { kind: K }>;

export function SystemLine({ body }: { body: Body<"system"> }) {
  const warn = body.level === "error" || body.level === "warning";
  return (
    <div className={cn("flex items-baseline gap-2 text-[12px]", body.level === "error" ? "text-error" : "text-secondary")}>
      <span className="shrink-0 rounded border border-border px-1 text-[11px]">{warn ? "警告" : "系统"}</span>
      <span className="min-w-0 break-words whitespace-pre-wrap">{body.text}</span>
    </div>
  );
}

export function AttachmentLine({ body }: { body: Body<"attachment"> }) {
  return (
    <div className="flex items-baseline gap-2 text-[12px] text-secondary">
      <span className="shrink-0 rounded border border-border px-1 text-[11px]">附件</span>
      <span className="min-w-0 break-words">{body.text || body.attachmentType}</span>
    </div>
  );
}

export function CompactDivider({ node }: { node: Node }) {
  return (
    <div className="flex items-center gap-2.5 text-[12px] text-secondary">
      <span className="h-px flex-1 bg-border" />
      <Minimize2 size={13} strokeWidth={1.5} aria-hidden />
      <span>上下文已压缩 · {clock(node.timestampMs)}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function CompactSummaryCard({ node, body }: { node: Node; body: Body<"compactSummary"> }) {
  const key = `compact:${node.id}`;
  const open = useUi((s) => s.expanded[key] ?? false);
  const toggle = useUi((s) => s.toggleExpanded);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => toggle(key)}
        className="flex w-full items-center gap-2 bg-list px-2.5 py-1.5 text-left text-[12px] text-text/80"
      >
        {open ? <ChevronDown size={12} strokeWidth={1.8} /> : <ChevronRight size={12} strokeWidth={1.8} />}
        <span className="font-semibold">上下文摘要</span>
      </button>
      {open && <Markdown text={body.text} className="border-t border-border px-3 py-2 text-[12px]" />}
    </div>
  );
}

export function UnknownJson({ label, json }: { label: string; json: string }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-border">
      <div className="bg-list px-2.5 py-1 text-[11px] text-secondary">{label}</div>
      <pre className="m-0 max-h-60 overflow-auto bg-code px-3 py-2 font-mono text-[12px] leading-[1.55] whitespace-pre-wrap break-words">
        {prettyJson(json)}
      </pre>
    </div>
  );
}
