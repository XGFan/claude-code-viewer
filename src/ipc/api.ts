import type {
  AppInfo,
  Diagnostics,
  FindRequest,
  FindResult,
  ImageData,
  ImageRequest,
  IndexStatus,
  IndexStatusEvent,
  JumpRequest,
  JumpTarget,
  LiveChanged,
  ProjectSummary,
  SearchRequest,
  SearchResponse,
  SessionDetail,
  SessionQuery,
  SessionsChanged,
  SessionSummary,
  Stats,
  StatsRequest,
  ToolDetail,
  ToolDetailRequest,
  Transcript,
  TranscriptRequest,
} from "./bindings";

export type Unlisten = () => void;

/** One method per Tauri command, plus event subscriptions and the clipboard. Rejections are `AppError`. */
export interface Api {
  getAppInfo(): Promise<AppInfo>;
  setDataRoot(path: string | null): Promise<AppInfo>;
  getIndexStatus(): Promise<IndexStatus>;
  rebuildIndex(): Promise<null>;
  listProjects(): Promise<ProjectSummary[]>;
  listSessions(query: SessionQuery): Promise<SessionSummary[]>;
  getSession(sessionId: string): Promise<SessionDetail>;
  getTranscript(req: TranscriptRequest): Promise<Transcript>;
  getToolDetail(req: ToolDetailRequest): Promise<ToolDetail>;
  getImage(req: ImageRequest): Promise<ImageData>;
  search(req: SearchRequest): Promise<SearchResponse>;
  resolveJump(req: JumpRequest): Promise<JumpTarget>;
  findInSession(req: FindRequest): Promise<FindResult>;
  revealSessionFile(sessionId: string, agentId: string | null): Promise<null>;
  getStats(req: StatsRequest): Promise<Stats>;
  getDiagnostics(): Promise<Diagnostics>;

  onIndexStatus(cb: (payload: IndexStatusEvent) => void): Promise<Unlisten>;
  onSessionsChanged(cb: (payload: SessionsChanged) => void): Promise<Unlisten>;
  onLiveChanged(cb: (payload: LiveChanged) => void): Promise<Unlisten>;
  onPricesChanged(cb: () => void): Promise<Unlisten>;

  copyText(text: string): Promise<void>;
}
