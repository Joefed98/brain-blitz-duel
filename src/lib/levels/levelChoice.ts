/**
 * The player's level choice (phase 2 step 4, 15 Nov 2026; docs/design/difficulty/README.md): device storage only.
 *
 * Two parts: the Games catalogue's level (its difficulty switch, for the whole catalogue) and a choice per game (a
 * game page's selector). A game plays at its own choice when it has one, else the catalogue's; changing the catalogue's
 * level clears the per-game choices, so the switch sets the level for every game. Either way the deal plays a level the
 * game doesn't offer as Normal (gameLevels.ts resolveLevel), and the screens say so.
 *
 * Accounts have no synced settings today, so the choice is kept on the device (`duelz-levels:v1`); every read and
 * write is guarded, and without storage everything is Normal.
 */
import { useSyncExternalStore } from "react";

import { resolveLevel } from "./gameLevels";
import { isLevel, NORMAL, type Level } from "./levels";

export const LEVEL_CHOICE_KEY = "duelz-levels:v1";

export interface LevelChoice {
  catalogue: Level;
  games: Record<string, Level>;
}

const EMPTY: LevelChoice = { catalogue: NORMAL, games: {} };
let cache: LevelChoice | null = null;
const listeners = new Set<() => void>();

function read(): LevelChoice {
  if (cache) return cache;
  let next: LevelChoice = EMPTY;
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(LEVEL_CHOICE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { catalogue?: unknown; games?: unknown };
      const games: Record<string, Level> = {};
      if (parsed.games && typeof parsed.games === "object")
        for (const [k, v] of Object.entries(parsed.games as Record<string, unknown>)) if (isLevel(v)) games[k] = v;
      next = { catalogue: isLevel(parsed.catalogue) ? parsed.catalogue : NORMAL, games };
    }
  } catch {
    next = EMPTY;
  }
  cache = next;
  return next;
}

function write(next: LevelChoice): void {
  cache = next;
  try {
    localStorage.setItem(LEVEL_CHOICE_KEY, JSON.stringify(next));
  } catch {
    /* kept in memory for this visit */
  }
  for (const l of listeners) l();
}

/** The choice as it stands (Normal everywhere without storage). */
export function levelChoiceNow(): LevelChoice {
  return read();
}

/** The level the player chose for a game (its own choice, else the catalogue's), before the game's own offer. */
export function chosenLevel(type: string, choice: LevelChoice = read()): Level {
  return choice.games[type] ?? choice.catalogue;
}

/** The level a game will actually be dealt at for this player: their choice, Normal where the game lacks it. */
export function playLevel(type: string, choice: LevelChoice = read()): Level {
  return resolveLevel(type, chosenLevel(type, choice));
}

/** The catalogue's difficulty switch: the level for every game (each game's own choice is cleared). */
export function setCatalogueLevel(level: Level): void {
  write({ catalogue: level, games: {} });
}

/** A game page's selector: this game's own level. */
export function setGameLevel(type: string, level: Level): void {
  const now = read();
  const games = { ...now.games };
  if (level === now.catalogue) delete games[type];
  else games[type] = level;
  write({ catalogue: now.catalogue, games });
}

/** Checks only: forget the cached choice (after changing storage under it). */
export function resetLevelChoiceCache(): void {
  cache = null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LEVEL_CHOICE_KEY) {
      cache = null;
      listener();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** The choice, kept up to date (Normal everywhere on the server's render). */
export function useLevelChoice(): LevelChoice {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
