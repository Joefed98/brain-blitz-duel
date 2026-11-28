import { useSyncExternalStore } from "react";

import { DESKTOP_MODES } from "@/lib/duel/desktopModes";
import type { PuzzleType } from "@/lib/duel/types";

/**
 * The landscape board (P4, desktop size PR 2, 28 Nov 2026; docs/desktop-support.md "Landscape board"): a computer
 * setting, per game and off by default, that draws a portrait game's own world turned 90° clockwise into the landscape
 * screen, as Cue Ball's table always is (desktopModes.ts `rotate`). Offered only for games whose desktop entry has a
 * `landscape` field (Meteor first). Presentation and input mapping only: the identical world, its size, its deal and
 * its rules; keys and swipes are turned back (desktopPresentation.ts rotatedKey, tapMapping.ts arenaDelta), so the sim
 * receives exactly the inputs the upright board would give it (landscape-check). Allowed in every mode (practice,
 * rooms, the Daily, challenges, rated play and tournaments): it changes nothing anyone else sees.
 *
 * Kept on this device only (`duelz-landscape:v1`, the ids switched on), read safely: storage that throws reads as none.
 */
export const LANDSCAPE_KEY = "duelz-landscape:v1";

/** Whether a game offers the landscape board (its desktop entry names how its keys turn). */
export function landscapeOffered(type: PuzzleType | string | undefined | null): boolean {
  return Boolean(type && DESKTOP_MODES[type as PuzzleType]?.landscape);
}

let chosen: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();

function load(): ReadonlySet<string> {
  if (chosen) return chosen;
  let ids: string[] = [];
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(LANDSCAPE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    ids = [];
  }
  chosen = new Set(ids);
  return chosen;
}

/** Whether the player has switched the landscape board on for this game (false where it isn't offered). */
export function landscapeChosen(type: PuzzleType | string | undefined | null): boolean {
  return landscapeOffered(type) && load().has(String(type));
}

/** Switches the landscape board on or off for one game, on this device. */
export function setLandscape(type: PuzzleType | string, on: boolean): void {
  if (!landscapeOffered(type)) return;
  const next = new Set(load());
  if (on) next.add(String(type));
  else next.delete(String(type));
  chosen = next;
  try {
    localStorage.setItem(LANDSCAPE_KEY, JSON.stringify([...next].sort()));
  } catch {
    /* Kept for this visit only. */
  }
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const storage = (event: StorageEvent) => {
    if (event.key !== LANDSCAPE_KEY) return;
    chosen = null;
    fn();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", storage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") window.removeEventListener("storage", storage);
  };
}

/** The player's choice for a game, kept current (false on the server and before hydration). */
export function useLandscapeChosen(type: PuzzleType | string | undefined | null): boolean {
  return useSyncExternalStore(
    subscribe,
    () => landscapeChosen(type),
    () => false,
  );
}
