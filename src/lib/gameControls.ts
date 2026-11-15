/**
 * Game controls on a computer (phase 2 step 4 pass 2, 15 Nov 2026; docs/design/game-fx/README.md "Controls"):
 * input mapping only. Whatever is chosen, a game's sim receives exactly the inputs a phone would give it (the
 * keyboard and mouse feed the same handlers as taps and swipes), so play and scoring are identical.
 *
 * The schemes:
 *  - "keys":  the game's keys (desktopKeys.ts DESKTOP_KEYS) and the mouse both play;
 *  - "mouse": click and drag only, as a finger (keys off, so a stray key does nothing);
 *  - "move":  aim by moving the mouse, click to act (games whose stage aims on hover: Iron Wall);
 *  - "drag":  press, drag to aim and release, exactly as a phone (the same games' alternative).
 *
 * Each game offers the schemes that make sense for it (schemesFor) with a default; a player's choice is kept on
 * this device per game (`duelz-game-controls:v1`), plus a preferred scheme for every game that offers it (Settings →
 * Game controls). Set from the game menu and Settings.
 */
import { createContext, useSyncExternalStore } from "react";

import { DESKTOP_KEYS } from "@/lib/desktopKeys";
import type { PuzzleType } from "@/lib/duel/types";

export type ControlScheme = "keys" | "mouse" | "move" | "drag";

export const SCHEME_LABEL: Record<ControlScheme, string> = {
  keys: "Keyboard",
  mouse: "Mouse",
  move: "Mouse movement",
  drag: "Click and drag",
};

export const SCHEME_NOTE: Record<ControlScheme, string> = {
  keys: "The keys below, and the mouse",
  mouse: "Click to tap, drag to swipe or aim; keys off",
  move: "Move the mouse to aim, click to act",
  drag: "Press, drag to aim, release, as on a phone",
};

/** Games whose stage aims by hovering the mouse (ArcadeCanvasStage `hover`). */
const HOVER_AIM: ReadonlySet<PuzzleType> = new Set<PuzzleType>(["bastion"]);

/** The schemes a game offers on a computer, the default first. */
export function schemesFor(type: PuzzleType): readonly ControlScheme[] {
  if (HOVER_AIM.has(type)) return ["move", "drag"];
  if (DESKTOP_KEYS[type]?.length) return ["keys", "mouse"];
  return ["mouse"];
}

export const CONTROLS_KEY = "duelz-game-controls:v1";

interface Stored {
  /** The preferred scheme for every game that offers it (Settings → Game controls). */
  prefer?: ControlScheme | null;
  games?: Partial<Record<string, ControlScheme>>;
}

let cache: Stored | null = null;
const listeners = new Set<() => void>();
let version = 0;

function read(): Stored {
  if (cache) return cache;
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(CONTROLS_KEY);
    cache = raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    cache = {};
  }
  return cache;
}
function write(next: Stored): void {
  cache = next;
  version += 1;
  try {
    window.localStorage.setItem(CONTROLS_KEY, JSON.stringify(next));
  } catch {
    /* kept for this visit */
  }
  for (const fn of [...listeners]) fn();
}

/** The scheme this game plays with on this device: its own choice, else the preference where offered, else its default. */
export function schemeFor(type: PuzzleType): ControlScheme {
  const offered = schemesFor(type);
  const s = read();
  const own = s.games?.[type];
  if (own && offered.includes(own)) return own;
  if (s.prefer && offered.includes(s.prefer)) return s.prefer;
  return offered[0]!;
}

export function setSchemeFor(type: PuzzleType, scheme: ControlScheme): void {
  if (!schemesFor(type).includes(scheme)) return;
  const s = read();
  write({ ...s, games: { ...s.games, [type]: scheme } });
}

export function preferredScheme(): ControlScheme | null {
  return read().prefer ?? null;
}

/** Settings → Game controls: the preference for every game, and clears the per-game choices it overrides. */
export function setPreferredScheme(scheme: ControlScheme | null): void {
  write({ prefer: scheme, games: {} });
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const storage = (event: StorageEvent) => {
    if (event.key !== CONTROLS_KEY) return;
    cache = null;
    version += 1;
    fn();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", storage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") window.removeEventListener("storage", storage);
  };
}

/** The scheme for a game, kept current as the player changes it. */
export function useControlScheme(type: PuzzleType | undefined): ControlScheme | null {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return type ? schemeFor(type) : null;
}

export function usePreferredScheme(): ControlScheme | null {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return preferredScheme();
}

/** Test hook. */
export function resetGameControlsForTest(): void {
  cache = null;
  version += 1;
}

/** The live round's scheme, set by GameLayout around the stage (null outside a live round: a phone, a demo). */
export const ControlSchemeContext = createContext<ControlScheme | null>(null);
