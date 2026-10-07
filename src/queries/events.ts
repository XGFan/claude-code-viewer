import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/ipc";
import { queryKeys } from "./hooks";

const FOLLOW_THROTTLE_MS = 1000;

/** Trailing-edge throttle per session so live appends refetch the transcript at most once per second. */
function createFollower(qc: QueryClient) {
  const last = new Map<string, number>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const refetch = (id: string) => {
    last.set(id, Date.now());
    void qc.invalidateQueries({ queryKey: ["transcript", id] });
    void qc.invalidateQueries({ queryKey: ["find", id] });
  };
  return {
    follow(id: string) {
      if (timers.has(id)) return;
      const wait = Math.max(0, (last.get(id) ?? 0) + FOLLOW_THROTTLE_MS - Date.now());
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          refetch(id);
        }, wait),
      );
    },
    dispose() {
      timers.forEach(clearTimeout);
      timers.clear();
    },
  };
}

/** Subscribes to the backend events once; mount near the root. */
export function useBackendEvents() {
  const qc = useQueryClient();
  useEffect(() => {
    const follower = createFollower(qc);
    const unlisten: Array<() => void> = [];
    let disposed = false;
    const keep = (p: Promise<() => void>) =>
      void p.then((fn) => (disposed ? fn() : unlisten.push(fn)));

    keep(
      api.onSessionsChanged((p) => {
        void qc.invalidateQueries({ queryKey: queryKeys.sessions() });
        void qc.invalidateQueries({ queryKey: queryKeys.projects });
        void qc.invalidateQueries({ queryKey: ["stats"] });
        for (const id of p.changed) {
          void qc.invalidateQueries({ queryKey: queryKeys.session(id) });
          follower.follow(id);
        }
        for (const id of p.removed) {
          qc.removeQueries({ queryKey: queryKeys.session(id) });
          qc.removeQueries({ queryKey: ["transcript", id] });
        }
      }),
    );
    keep(
      api.onLiveChanged(() => {
        void qc.invalidateQueries({ queryKey: queryKeys.sessions() });
        void qc.invalidateQueries({ queryKey: queryKeys.projects });
        void qc.invalidateQueries({ queryKey: ["session"] });
      }),
    );
    keep(api.onIndexStatus((status) => qc.setQueryData(queryKeys.indexStatus, status)));

    return () => {
      disposed = true;
      follower.dispose();
      unlisten.forEach((fn) => fn());
    };
  }, [qc]);
}
