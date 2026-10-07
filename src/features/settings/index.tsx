import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { Tabs } from "radix-ui";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DiagnosticsContent } from "@/features/diagnostics";
import { useHotkey } from "@/lib/hotkeys";
import { api } from "@/ipc";
import type { AppError, DataRootSource } from "@/ipc/bindings";
import { queryKeys, useAppInfo, useIndexStatus } from "@/queries";
import { useUi } from "@/state/ui";

const nf = new Intl.NumberFormat("en-US");
const SOURCE_LABEL: Record<DataRootSource, string> = {
  settings: "设置",
  env: "环境变量 CLAUDE_CONFIG_DIR",
  default: "默认",
};
const errText = (e: unknown) => (e && typeof e === "object" && "message" in e ? String((e as AppError).message) : String(e));

const TABS = [
  { id: "general", label: "通用" },
  { id: "data", label: "数据" },
  { id: "compat", label: "格式兼容性" },
] as const;

function Row({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="grid grid-cols-[120px_1fr] items-baseline gap-3 py-2 text-[13px]">
      <div className="text-secondary">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function GeneralTab() {
  const { data: info } = useAppInfo();
  return (
    <div className="divide-y divide-border">
      <Row label="应用版本" testId="set-version">
        {info?.version ?? "…"}
      </Row>
      <Row label="索引 Schema 版本" testId="set-schema">
        {info?.schemaVersion ?? "…"}
      </Row>
    </div>
  );
}

function DataTab() {
  const qc = useQueryClient();
  const { data: info } = useAppInfo();
  const { data: status } = useIndexStatus();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (info) setDraft(info.dataRoot);
  }, [info]);

  const setRoot = useMutation({
    mutationFn: (path: string | null) => api.setDataRoot(path),
    onSuccess: (next) => {
      setError(null);
      qc.setQueryData(queryKeys.appInfo, next);
      void qc.invalidateQueries({ queryKey: queryKeys.sessions() });
      void qc.invalidateQueries({ queryKey: queryKeys.projects });
      void qc.invalidateQueries({ queryKey: queryKeys.diagnostics });
      // The previous root's session is gone: drop the selection and everything cached for it.
      useUi.getState().selectSession(null);
      for (const key of ["transcript", "session", "stats"]) qc.removeQueries({ queryKey: [key] });
    },
    onError: (e) => setError(errText(e)),
  });
  const rebuild = useMutation({
    mutationFn: () => api.rebuildIndex(),
    onSuccess: () => setError(null),
    onError: (e) => setError(errText(e)),
  });

  if (!info) return null;
  const busy = status?.phase === "scanning" || status?.phase === "indexingText" || rebuild.isPending;
  const trimmed = draft.trim();
  const canApply = trimmed !== "" && trimmed !== info.dataRoot && !setRoot.isPending;
  const statusText = !status
    ? "…"
    : status.phase === "error"
      ? `索引失败${status.error ? ` · ${status.error}` : ""}`
      : status.phase === "scanning"
        ? `正在扫描 ${nf.format(status.filesDone)} / ${nf.format(status.filesTotal)} 个文件`
        : status.phase === "indexingText"
          ? "正在建立搜索索引"
          : `已索引 ${nf.format(status.sessionsTotal)} 个 Session${status.textReady ? "" : " · 搜索索引未完成"}`;

  return (
    <div className="divide-y divide-border">
      <Row label="数据目录" testId="set-root">
        <div className="flex flex-col gap-2">
          <div>
            <code data-testid="set-root-path" className="break-all font-mono text-xs">
              {info.dataRoot}
            </code>
            <span data-testid="set-root-source" className="ml-2 text-xs text-secondary">
              来源：{SOURCE_LABEL[info.dataRootSource]}
            </span>
          </div>
          {!info.dataRootExists && <div className="text-xs text-error">该目录不存在</div>}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (canApply) setRoot.mutate(trimmed);
            }}
          >
            <Input
              aria-label="数据目录路径"
              data-testid="set-root-input"
              className="font-mono text-xs"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="/Users/…/.claude"
              spellCheck={false}
            />
            <Button type="submit" variant="outline" disabled={!canApply} data-testid="set-root-apply">
              应用
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={info.dataRootSource !== "settings" || setRoot.isPending}
              onClick={() => setRoot.mutate(null)}
              data-testid="set-root-reset"
            >
              恢复默认
            </Button>
          </form>
        </div>
      </Row>
      <Row label="缓存目录" testId="set-cache">
        <code className="break-all font-mono text-xs">{info.cacheDir}</code>
      </Row>
      <Row label="索引" testId="set-index">
        <div className="flex items-center gap-3">
          <span data-testid="set-index-status" className={status?.phase === "error" ? "text-error" : ""}>
            {statusText}
          </span>
          <Button variant="outline" disabled={busy} onClick={() => rebuild.mutate()} data-testid="set-rebuild">
            重建索引
          </Button>
        </div>
      </Row>
      {error && (
        <div role="alert" data-testid="set-error" className="py-2 text-xs text-error">
          {error}
        </div>
      )}
    </div>
  );
}

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const setOpen = useUi((s) => s.setSettingsOpen);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("general");

  useHotkey("Meta+,", () => setOpen(!useUi.getState().settingsOpen), { enableInInputs: true });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-testid="settings"
        aria-describedby={undefined}
        className="flex max-h-[85vh] w-[920px] max-w-[94vw] flex-col overflow-hidden rounded-xl p-0"
      >
        <DialogTitle className="m-0 border-b border-border bg-sidebar py-2.5 text-center text-[13px]">设置</DialogTitle>
        <DialogDescription className="sr-only">应用设置</DialogDescription>
        <Tabs.Root value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex min-h-0 flex-1 flex-col">
          <Tabs.List className="flex justify-center gap-1 border-b border-border bg-sidebar p-2">
            {TABS.map((t) => (
              <Tabs.Trigger
                key={t.id}
                value={t.id}
                className="h-10 min-w-[76px] rounded-lg px-3 text-xs text-text/80 data-[state=active]:bg-selection data-[state=active]:font-semibold data-[state=active]:text-text focus-visible:outline-2 focus-visible:outline-accent"
              >
                {t.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <div className="min-h-[320px] flex-1 overflow-y-auto px-6 py-5">
            <Tabs.Content value="general">
              <GeneralTab />
            </Tabs.Content>
            <Tabs.Content value="data">
              <DataTab />
            </Tabs.Content>
            <Tabs.Content value="compat">
              <DiagnosticsContent />
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </DialogContent>
    </Dialog>
  );
}

/** Gear button that opens the settings dialog; placed by the app shell. */
export function SettingsButton({ className }: { className?: string }) {
  const setOpen = useUi((s) => s.setSettingsOpen);
  return (
    <Button variant="ghost" size="icon" aria-label="设置" title="设置 (⌘,)" className={className} onClick={() => setOpen(true)} data-testid="settings-button">
      <Settings size={15} />
    </Button>
  );
}
