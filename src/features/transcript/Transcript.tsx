import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Node } from "@/ipc/bindings";
import { useCurrentTranscript } from "@/queries";
import { useUi } from "@/state/ui";
import { NodeView } from "./nodes";

const PIN_THRESHOLD = 48;

interface Row {
  node: Node;
  showRole: boolean;
}

function toRows(nodes: Node[], showHidden: boolean): Row[] {
  const rows: Row[] = [];
  for (const node of nodes) {
    if (node.hidden && !showHidden) continue;
    const prev = rows[rows.length - 1]?.node.body.kind;
    rows.push({ node, showRole: node.body.kind === "assistant" && prev !== "assistant" });
  }
  return rows;
}

export function TranscriptView() {
  const sessionId = useUi((s) => s.sessionId);
  const { data } = useCurrentTranscript();

  if (!sessionId) {
    return (
      <div data-testid="transcript-empty" className="flex flex-1 items-center justify-center text-[13px] text-secondary">
        选择一个 Session 查看对话
      </div>
    );
  }
  // keepPreviousData may still hold the previous session's transcript while the new one loads.
  if (!data || data.sessionId !== sessionId) {
    return <div data-testid="transcript" className="flex-1" />;
  }
  return <TranscriptBody key={sessionId} nodes={data.nodes} revision={data.revision} />;
}

function TranscriptBody({ nodes, revision }: { nodes: Node[]; revision: number }) {
  const showHidden = useUi((s) => s.showHidden);
  const rows = useMemo(() => toRows(nodes, showHidden), [nodes, showHidden]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [unread, setUnread] = useState(false);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 110,
    overscan: 8,
    getItemKey: (i) => rows[i]!.node.id,
  });

  const toBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= PIN_THRESHOLD;
    pinned.current = atBottom;
    if (atBottom) setUnread(false);
  }, []);

  // Stay at the bottom while content grows (new rows, late measurements) if the user was there.
  const total = virtualizer.getTotalSize();
  useLayoutEffect(() => {
    if (pinned.current) toBottom();
  }, [total, toBottom]);

  // New revision while the user reads elsewhere: offer a jump instead of moving the view.
  const firstRevision = useRef(true);
  useEffect(() => {
    if (firstRevision.current) {
      firstRevision.current = false;
      return;
    }
    if (!pinned.current) setUnread(true);
  }, [revision]);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        data-testid="transcript"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6"
      >
        <div className="relative mx-auto max-w-[820px]" style={{ height: total + 40 }}>
          {virtualizer.getVirtualItems().map((v) => {
            const row = rows[v.index]!;
            return (
              <div
                key={v.key}
                ref={virtualizer.measureElement}
                data-index={v.index}
                className="absolute top-0 left-0 w-full pb-[18px]"
                style={{ transform: `translateY(${v.start + 20}px)` }}
              >
                <NodeView node={row.node} showRole={row.showRole} />
              </div>
            );
          })}
        </div>
      </div>
      {unread && (
        <button
          type="button"
          data-testid="new-messages"
          onClick={() => {
            pinned.current = true;
            toBottom();
            setUnread(false);
          }}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-accent px-3 py-1 text-[12px] text-white shadow-lg"
        >
          有新消息
          <ArrowDown size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
