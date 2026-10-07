import { Bot, Check, ChevronDown, ChevronRight, CircleX, FileText, Pencil, Search, SquareTerminal, Wrench } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import type { ToolCall } from "@/ipc/bindings";
import { cn } from "@/lib/cn";
import { useUi } from "@/state/ui";
import { prettyJson } from "../util";

const SUMMARY_KEYS = ["command", "file_path", "path", "pattern", "url", "query", "description", "prompt"];

/** One short line describing a call's input: the first well-known string field, else the first string. */
export function summarizeInput(inputJson: string): string {
  try {
    const v = JSON.parse(inputJson) as Record<string, unknown>;
    if (v && typeof v === "object") {
      for (const k of SUMMARY_KEYS) if (typeof v[k] === "string" && v[k]) return firstLine(v[k]);
      for (const x of Object.values(v)) if (typeof x === "string" && x) return firstLine(x);
    }
  } catch {
    /* fall through */
  }
  return "";
}

const firstLine = (s: string) => s.split("\n", 1)[0]!.slice(0, 200);

function toolIcon(name: string): ReactNode {
  const p = { size: 14, strokeWidth: 1.6, "aria-hidden": true } as const;
  if (name === "Bash") return <SquareTerminal {...p} />;
  if (name === "Read") return <FileText {...p} />;
  if (name === "Edit" || name === "Write" || name === "MultiEdit" || name === "NotebookEdit") return <Pencil {...p} />;
  if (name === "Grep" || name === "Glob" || name === "WebSearch") return <Search {...p} />;
  if (name === "Task" || name === "Agent") return <Bot {...p} />;
  return <Wrench {...p} />;
}

function durationText(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");

export const toolKey = (nodeId: string, toolUseId: string) => `tool:${nodeId}|${toolUseId}`;

/** Generic one-line tool call (expandable to input JSON and output text). Specialized renderers replace this per tool. */
export function ToolCallView({ nodeId, call, startMs }: { nodeId: string; call: ToolCall; startMs: number | null }) {
  const failed = call.result?.isError === true;
  const key = toolKey(nodeId, call.toolUseId);
  const open = useUi((s) => s.expanded[key] ?? failed);
  const toggle = useUi((s) => s.toggleExpanded);
  const summary = useMemo(() => summarizeInput(call.inputJson), [call.inputJson]);
  const input = useMemo(() => (open ? prettyJson(call.inputJson) : ""), [open, call.inputJson]);
  const result = call.result;
  const dur =
    result?.timestampMs != null && startMs != null && result.timestampMs >= startMs ? result.timestampMs - startMs : null;

  return (
    <div
      data-testid="tool-call"
      data-failed={failed || undefined}
      className={cn("overflow-hidden rounded-lg border", failed ? "border-error/30" : "border-border")}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => toggle(key, failed)}
        className={cn(
          "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px]",
          failed ? "bg-error-bg text-error" : "bg-list text-text/80",
        )}
      >
        {open ? <ChevronDown size={12} strokeWidth={1.8} /> : <ChevronRight size={12} strokeWidth={1.8} />}
        {toolIcon(call.name)}
        <span className="shrink-0 font-semibold">{call.name}</span>
        <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{summary}</code>
        {result == null ? (
          <span className="text-secondary">执行中</span>
        ) : failed ? (
          <span className="flex items-center gap-1 font-semibold">
            <CircleX size={13} strokeWidth={1.8} />
            失败
          </span>
        ) : (
          <span className="flex items-center gap-1 text-live">
            <Check size={12} strokeWidth={2} />
            完成
          </span>
        )}
        {dur != null && <span className="text-secondary">{durationText(dur)}</span>}
      </button>
      {open && (
        <div className="border-t border-border">
          <Section label="输入">
            <pre className="m-0 max-h-80 overflow-auto bg-code px-3 py-2 font-mono text-[12px] leading-[1.55] whitespace-pre-wrap break-words">
              {input}
              {call.inputTruncated && "\n… 输入已截断"}
            </pre>
          </Section>
          {result && (
            <Section label="输出">
              <pre
                className={cn(
                  "m-0 max-h-80 overflow-auto bg-terminal px-3 py-2 font-mono text-[12px] leading-[1.55] whitespace-pre-wrap break-words",
                  failed ? "text-[#ff8a80]" : "text-[#e4e4e6]",
                )}
              >
                {stripAnsi(result.text) || "（无输出）"}
                {result.truncated && "\n… 输出已截断"}
              </pre>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="px-3 pt-1.5 pb-0.5 text-[11px] text-secondary">{label}</div>
      {children}
    </div>
  );
}
