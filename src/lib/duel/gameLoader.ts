/**
 * Loads one game's code at a time (speed fix 1, Nov 2026; docs/audit-nov-2026/performance.md finding 1).
 * Each game is its own chunk (`gameModules.ts`); the first screen downloads none of them. A game's chunk is
 * fetched when it is first needed (its intro, stage, reveal or replay), or earlier through `preloadGame`:
 * rooms preload the current and next round's games, practice, the Daily and challenges the game they are
 * about to show. The definition is built by `registerDefinition`, exactly as the full registry builds it,
 * so a game loaded here is the game the server and the checks know. Once loaded it stays in memory for
 * the session; offline, the service worker serves the chunk from its cache (it keeps every client file).
 */
import { useEffect, useSyncExternalStore } from "react";

import { GAME_MODULES } from "./gameModules";
import { isLiveType } from "./catalogue";
import { registerDefinition, removedDefinition, type LoadedPuzzleDefinition } from "./registerDefinition";
import type { RemovedPuzzleType } from "./removedGames";
import type { PuzzleType } from "./types";

export type { LoadedPuzzleDefinition } from "./registerDefinition";

const loaded = new Map<string, LoadedPuzzleDefinition>();
const pending = new Map<string, Promise<LoadedPuzzleDefinition>>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** The game's definition if its code is already here (a deleted game's stand-in always is), else null. */
export function loadedGameDef(type: PuzzleType | RemovedPuzzleType | null | undefined): LoadedPuzzleDefinition | null {
  if (!type) return null;
  if (!isLiveType(type)) return removedDefinition(type);
  return loaded.get(type) ?? null;
}

/** Fetches the game's chunk (once; a failed fetch is tried again on the next call) and builds its definition. */
export function loadGameDef(type: PuzzleType | RemovedPuzzleType): Promise<LoadedPuzzleDefinition> {
  const ready = loadedGameDef(type);
  if (ready) return Promise.resolve(ready);
  const live = type as PuzzleType;
  let promise = pending.get(live);
  if (!promise) {
    promise = GAME_MODULES[live]()
      .then((definition) => {
        const registered = registerDefinition(live, definition);
        loaded.set(live, registered);
        pending.delete(live);
        notify();
        return registered;
      })
      .catch((error: unknown) => {
        pending.delete(live);
        throw error;
      });
    pending.set(live, promise);
  }
  return promise;
}

/** Starts fetching a game's code in the background (rooms' next round, practice's chosen game); never throws. */
export function preloadGame(type: PuzzleType | RemovedPuzzleType | null | undefined): void {
  if (!type || loadedGameDef(type)) return;
  loadGameDef(type).catch(() => undefined);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const RETRY_MS = 1500;

/**
 * A game's definition for rendering: at once when its code is here, otherwise null for the frames until its
 * chunk arrives (fetched now, and tried again every 1.5 s while the screen stays up if a fetch fails).
 * The server render has no games, so it and hydration read null.
 */
export function useGameDef(type: PuzzleType | RemovedPuzzleType | null | undefined): LoadedPuzzleDefinition | null {
  const definition = useSyncExternalStore(
    subscribe,
    () => loadedGameDef(type),
    () => null,
  );
  const missing = Boolean(type) && !definition;
  useEffect(() => {
    if (!type || !missing) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const attempt = () => {
      loadGameDef(type).catch(() => {
        if (live) timer = setTimeout(attempt, RETRY_MS);
      });
    };
    attempt();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [type, missing]);
  return definition;
}
