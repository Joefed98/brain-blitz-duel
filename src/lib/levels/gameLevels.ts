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
 * Every game's levels beyond Normal (a game with no entry offers Normal only).
 */
export const GAME_LEVELS: Partial<Record<PuzzleType, GameLevels>> = {
  // Home Run (homerunRev 5, the Home Run and Top Bins overhaul, 15 Nov 2026): the innings' pitch speeds, balls in the
  // first 24 pitches, the Contact / Power windows, the PERFECT window, the curveball's bend and the fielders' reach.
  // A mirror of HR_LEVEL_SETTINGS in src/lib/arcade/homerunInnings.ts (the sim reads its own; homerun-innings-check
  // proves the two match). Each level deals from its own proved deal (homerunDealV5.server.ts).
  homerun: {
    levels: {
      easy: { settings: { flight: { 0: [42, 47], 1: [54, 60], 3: [66, 74] }, balls: 6, winContact: 7, winPower: 5, perfect: 2, bend: 450, reach: 800, ballOff: [14, 34] } },
      hard: { settings: { flight: { 0: [28, 31], 1: [40, 44], 3: [54, 59] }, balls: 8, winContact: 4, winPower: 3, perfect: 0, bend: 1300, reach: 1100, ballOff: [8, 24] } },
      expert: { settings: { flight: { 0: [27, 29], 1: [37, 40], 3: [51, 55] }, balls: 9, winContact: 4, winPower: 2, perfect: 0, bend: 1600, reach: 1200, ballOff: [5, 17] } },
    },
  },
  // Top Bins (freekickRev 6 since 16 Nov 2026; rev 5 kept its own table): the power bar's gold zone, the keeper's reaction and speed, the wall, the wind, the corner
  // hoop's last size and the jumping-wall kicks. A mirror of FK_LEVEL_SETTINGS_V6 in src/lib/arcade/freekick.ts
  // (freekick-layered-check proves the two match). Each level deals from its own proved deal (freekickDealV5.server.ts).
  freekick: {
    levels: {
      easy: { settings: { zoneLo: 680, zoneHi: 820, react: 14, speed: 850, wall: [3, 3], wind: 1, hoopLast: 850, jumps: 3 } },
      hard: { settings: { zoneLo: 735, zoneHi: 790, react: 6, speed: 1300, wall: [4, 5], wind: 6, hoopLast: 600, jumps: 5 } },
      expert: { settings: { zoneLo: 745, zoneHi: 780, react: 5, speed: 1400, wall: [5, 5], wind: 7, hoopLast: 500, jumps: 6 } },
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
