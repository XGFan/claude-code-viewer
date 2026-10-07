import { useIndexStatus } from "@/queries";

const nf = new Intl.NumberFormat("en-US");

export function StatusBar() {
  const { data: s } = useIndexStatus();
  if (!s) return <div className="border-t border-border bg-sidebar" />;

  const busy = s.phase === "scanning" || s.phase === "indexingText";
  const pct =
    s.bytesTotal > 0
      ? Math.min(100, (s.bytesDone / s.bytesTotal) * 100)
      : s.filesTotal > 0
        ? Math.min(100, (s.filesDone / s.filesTotal) * 100)
        : 0;
  return (
    <div
      data-testid="statusbar"
      data-tauri-drag-region="deep"
      className="flex items-center gap-3 border-t border-border bg-sidebar px-3 text-[11px] text-secondary"
    >
      {s.phase === "error" ? (
        <span className="text-error">索引失败{s.error ? ` · ${s.error}` : ""}</span>
      ) : busy ? (
        <>
          <span>{s.phase === "scanning" ? "正在扫描" : "正在建立全文索引"}</span>
          <span className="tabular-nums">
            {nf.format(s.filesDone)} / {nf.format(s.filesTotal)} 个文件
          </span>
          <span
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            className="h-1 w-28 overflow-hidden rounded-full bg-border"
          >
            <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </span>
        </>
      ) : (
        <span>已索引 {nf.format(s.sessionsTotal)} 个 Session</span>
      )}
    </div>
  );
}
