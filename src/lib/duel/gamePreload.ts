/**
 * Data a game needs on the phone before it can play. Letterfall's dictionary
 * is a separate text file (never the main bundle), fetched as soon as a room's round
 * order or the practice list includes Letterfall, and cached on the device, so
 * no player waits for it at play time. preloadGameData never rejects: callers
 * retry by calling again.
 */
import { useEffect, useState } from "react";

import { loadWordfallDict, wordfallDictReady } from "@/lib/arcade/wordfallDict";

export function preloadGameData(type: string): Promise<void> {
  if (type === "wordfall") return loadWordfallDict().catch(() => undefined);
  return Promise.resolve();
}

/** True once the game's phone data is installed (always true for games without any). */
export function gameDataReady(type: string): boolean {
  return type !== "wordfall" || wordfallDictReady();
}

/** Loads the game's data and reports readiness, retrying a failed download every 1.5 s. */
export function useGameDataReady(type: string): boolean {
  const [ready, setReady] = useState(() => gameDataReady(type));
  useEffect(() => {
    if (gameDataReady(type)) {
      setReady(true);
      return;
    }
    setReady(false);
    let live = true;
    let timer = 0;
    const attempt = () => {
      void preloadGameData(type).then(() => {
        if (!live) return;
        if (gameDataReady(type)) setReady(true);
        else timer = window.setTimeout(attempt, 1500);
      });
    };
    attempt();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [type]);
  return ready;
}
