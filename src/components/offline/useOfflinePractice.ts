import { useEffect, useState } from "react";

import { useOfflineVersion } from "@/lib/offline/events";
import { packCounts } from "@/lib/offline/packs";
import { readRuns, type QueuedRun } from "@/lib/offline/queue";
import type { PuzzleType } from "@/lib/duel/types";

/** The offline store as the Practice tab shows it: deals left per game and the runs played away from the server. */
export function useOfflinePractice(): { counts: Partial<Record<PuzzleType, number>>; runs: QueuedRun[]; loaded: boolean } {
  const version = useOfflineVersion();
  const [state, setState] = useState<{ counts: Partial<Record<PuzzleType, number>>; runs: QueuedRun[]; loaded: boolean }>({
    counts: {},
    runs: [],
    loaded: false,
  });
  useEffect(() => {
    let live = true;
    void Promise.all([packCounts(), readRuns()]).then(([counts, runs]) => {
      if (live) setState({ counts, runs, loaded: true });
    });
    return () => {
      live = false;
    };
  }, [version]);
  return state;
}

/** One run's record, re-read whenever the store changes (its result screen waits on the server's grade). */
export function useQueuedRun(id: string | null): QueuedRun | null {
  const version = useOfflineVersion();
  const [run, setRun] = useState<QueuedRun | null>(null);
  useEffect(() => {
    let live = true;
    if (!id) return;
    void readRuns().then((runs) => {
      if (live) setRun(runs.find((r) => r.id === id) ?? null);
    });
    return () => {
      live = false;
    };
  }, [id, version]);
  return run;
}
