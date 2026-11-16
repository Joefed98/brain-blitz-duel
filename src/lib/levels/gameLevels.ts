/**
 * The level registry (phase 2 step 4, 15 Nov 2026; docs/design/difficulty/README.md): which levels each game offers
 * and its settings per level. Shared and light (the phone reads it to draw the level selector; the server to deal),
 * so keep each entry to plain data: no imports of game code.
 *
 * A game with no entry offers Normal only, and Normal is exactly today's game. A family session adds a game's levels
 * by adding ONE entry here:
 *
 *   tents: {
 *     levels: {
 *       easy: { settings: { size: 6 }, oneSolution: { proof: "scripts/tents-levels-check.ts" } },
 *       hard: { settings: { size: 9 }, oneSolution: { proof: "scripts/tents-levels-check.ts" } },
 *     },
 *   },
 *
 * then reading the level in its generator (GenerateContext `level`, or `gameLevelSettings(type, level)`), stamping
 * anything its grader or stage must know on the dealt puzzle (the deal adds `level` itself), and grading from the
 * stored puzzle (`puzzleLevel(puzzle)`), so older stamps grade exactly as before. A level's clock is the puzzle's own
 * `timeLimitMs` when the generator sets one; difficulty-check fails on any clock over 120 s at any level.
 *
 * `oneSolution` is required for every puzzle (non-arcade) game's non-Normal level: the check that proves the level's
 * boards have exactly one solution (a script that exists and runs in CI), or `{ open: "<why>" }` for a game whose
 * answers are open by design (word finds, reaction games). difficulty-check enforces it.
 */
import { checkOverride } from "@/lib/checkOverride";
import type { PuzzleType } from "@/lib/duel/types";

import { LEVELS, NORMAL, type Level } from "./levels";

/** How a level's boards are proven to have exactly one solution. */
export type OneSolutionProof = { proof: string } | { open: string };

export interface LevelEntry<S = Record<string, unknown>> {
  /** The game's own settings for this level (sizes, counts, speeds…), read by its generator. */
  settings: S;
  /** Required for puzzle games (difficulty-check); arcade games may leave it out. */
  oneSolution?: OneSolutionProof;
}

export interface GameLevels<S = Record<string, unknown>> {
  /** The levels beyond Normal. Normal is always offered and is today's game (no entry). */
  levels: Partial<Record<Exclude<Level, "normal">, LevelEntry<S>>>;
}

/**
 * Every game's levels beyond Normal. Empty until the family sessions add theirs (15 Nov 2026): every game offers
 * Normal only.
 */
export const GAME_LEVELS: Partial<Record<PuzzleType, GameLevels>> = {
  // The Cards & Board overhaul, stage 3 (15 Nov 2026; docs/arcade-standard/<game>.md "Levels"). Each game's sim holds the
  // authoritative rules per level (FC_LEVEL_RULES, MAHJONG_LEVEL_RULES, TP_LEVEL_RULES, FH_LEVEL_RULES, PY_LEVEL_RULES);
  // these settings mirror them for the phone's selectors and the docs (cards-levels-check proves they match). Every
  // level's deals are proved clearable by cards-levels-check (banks re-solved, built deals proved by their witnesses).
  freecell: {
    levels: {
      easy: { settings: { cards: 32, cells: 5, undo: "free", hints: "free" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      hard: { settings: { cards: 52, cells: 4, undo: "a move", hints: "5 points each" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      expert: { settings: { cards: 52, cells: 3, undo: "3", hints: "1" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
    },
  },
  mahjong: {
    levels: {
      easy: { settings: { tiles: 56, layers: 3, quads: 2, shuffleCost: 2, hints: "free" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      hard: { settings: { tiles: 72, layers: 4, quads: 10, shuffleCost: 8, hints: "5 points each" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      expert: { settings: { tiles: 88, layers: 5, quads: 12, shuffleCost: 10, hints: "1" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
    },
  },
  tripeaks: {
    levels: {
      easy: { settings: { glow: true, wrap: true, undos: 3, speedFullS: 25, hints: "free" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      hard: { settings: { glow: false, wrap: false, undos: 0, speedFullS: 20, hints: "5 points each" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      expert: { settings: { glow: false, wrap: false, undos: 0, speedFullS: 16, hints: "1" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
    },
  },
  fivehands: {
    levels: {
      easy: { settings: { multiplier: 1.6, seconds: 75, preview: 2, columnValues: true, hints: "free" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      hard: { settings: { multiplier: 1.4, seconds: 50, preview: 0, columnValues: false, pair: 10, twoPair: 20, hints: "5 points each" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      expert: { settings: { multiplier: 1.3, seconds: 45, preview: 0, columnValues: false, pair: 10, twoPair: 15, hints: "1" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
    },
  },
  pyramid: {
    levels: {
      easy: { settings: { passes: 3, glow: true, kings: "3–4", deals: "any proved", hints: "free" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      hard: { settings: { passes: 1, glow: false, kings: "2–3", deals: "harder", hints: "5 points each" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
      expert: { settings: { passes: 1, glow: false, kings: "3", deals: "hardest", hints: "1" }, oneSolution: { proof: "scripts/cards-levels-check.ts" } },
    },
  },
};

/** The registry a caller reads (a check may stand in its own through `withGameLevels`). */
let registry: Partial<Record<string, GameLevels>> = GAME_LEVELS;

/** Checks only: run `fn` with another registry, restoring the real one after. */
export function withGameLevels<T>(stand: Partial<Record<string, GameLevels>>, fn: () => T): T {
  const before = registry;
  registry = stand;
  try {
    return fn();
  } finally {
    registry = before;
  }
}

/**
 * The registry in force: a check's own (withGameLevels, or the check-only `__DUELZ_GAME_LEVELS__` a browser check or
 * screenshot sets; a production build never reads it), else GAME_LEVELS.
 */
function current(): Partial<Record<string, GameLevels>> {
  if (registry !== GAME_LEVELS) return registry;
  return checkOverride<Partial<Record<string, GameLevels>>>("__DUELZ_GAME_LEVELS__") ?? registry;
}

/** The levels a game offers, in LEVELS order (always including Normal). */
export function levelsOf(type: string): Level[] {
  const own = current()[type]?.levels ?? {};
  return LEVELS.filter((level) => level === NORMAL || own[level as Exclude<Level, "normal">] !== undefined);
}

export function offersLevel(type: string, level: Level): boolean {
  return levelsOf(type).includes(level);
}

/** Whether a game has any level beyond Normal. */
export function hasLevels(type: string): boolean {
  return levelsOf(type).length > 1;
}

/** The level a game is actually played at when `requested` is asked for: Normal when it doesn't offer it. */
export function resolveLevel(type: string, requested: Level | null | undefined): Level {
  return requested && offersLevel(type, requested) ? requested : NORMAL;
}

/** A game's settings for a level, or null at Normal and for a level it doesn't offer. */
export function gameLevelSettings<S = Record<string, unknown>>(type: string, level: Level): S | null {
  if (level === NORMAL) return null;
  const entry = current()[type]?.levels[level as Exclude<Level, "normal">];
  return entry ? (entry.settings as S) : null;
}

/** A level's uniqueness proof, or null (Normal, an arcade game that gave none, or a level not offered). */
export function levelProof(type: string, level: Level): OneSolutionProof | null {
  if (level === NORMAL) return null;
  return current()[type]?.levels[level as Exclude<Level, "normal">]?.oneSolution ?? null;
}

/** Every game that offers a level beyond Normal (the tuning script and the checks walk them). */
export function gamesWithLevels(): string[] {
  return Object.keys(current()).filter((t) => hasLevels(t));
}
