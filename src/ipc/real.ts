import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Api } from "./api";
import { commands, events } from "./bindings";

export function createRealApi(): Api {
  return {
    getAppInfo: commands.getAppInfo,
    setDataRoot: commands.setDataRoot,
    getIndexStatus: commands.getIndexStatus,
    rebuildIndex: commands.rebuildIndex,
    listProjects: commands.listProjects,
    listSessions: commands.listSessions,
    getSession: commands.getSession,
    getTranscript: commands.getTranscript,
    getToolDetail: commands.getToolDetail,
    getImage: commands.getImage,
    search: commands.search,
    resolveJump: commands.resolveJump,
    findInSession: commands.findInSession,
    revealSessionFile: commands.revealSessionFile,
    getStats: commands.getStats,
    getDiagnostics: commands.getDiagnostics,
    onIndexStatus: (cb) => events.indexStatusEvent.listen((e) => cb(e.payload)),
    onSessionsChanged: (cb) => events.sessionsChangedEvent.listen((e) => cb(e.payload)),
    onLiveChanged: (cb) => events.liveChangedEvent.listen((e) => cb(e.payload)),
    onPricesChanged: (cb) => events.pricesChangedEvent.listen(() => cb()),
    copyText: writeText,
  };
}
