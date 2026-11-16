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
 *       easy: { settings: { colours: 3, reef: 75, every: 10, trail: 2, banksFull: 8, coreFull: 50, speedFullLeft: 1800 } },
 *       hard: { settings: { colours: 5, reef: 110, every: 5, trail: 1, banksFull: 20, coreFull: 110, speedFullLeft: 1800 } },
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
  // Coral Pop (the Strategy overhaul, stage 3): colours, reef bubbles (chests included), shots between descents and
  // the aim trail's reach (2 two bounces, 1 one bounce, 0 short). Played on bubbleRev 12; the sim keeps the same
  // numbers frozen with the stamp (BUB_LEVELS in src/lib/arcade/bubble.ts; bubble-levels-check proves they agree).
  bubble: {
    levels: {
      easy: { settings: { colours: 3, reef: 75, every: 10, trail: 2, banksFull: 8, coreFull: 50, speedFullLeft: 1800 } },
      hard: { settings: { colours: 5, reef: 110, every: 5, trail: 1, banksFull: 20, coreFull: 110, speedFullLeft: 1800 } },
      expert: { settings: { colours: 6, reef: 110, every: 7, trail: 0, banksFull: 10, coreFull: 110, speedFullLeft: 1800 } },
    },
  },
  // Ball Tracker (Strategy overhaul stage 3, 15 Nov 2026; docs/arcade-standard/balltrack.md "Levels"): Normal is
  // btRev 8 today (36 marbles every 84 ticks, 1.4 s; the cups move twice: a re-lay and a colour shuffle; 6 gold, 3
  // boosters). Each level deals a course from its own proved list (src/lib/duel/ballTrackDeal<Level>.server.ts, built
  // by scripts/balltrack-level-deal.ts from these settings): marbles, release ticks, cup moves, gold marbles, boosters;
  // Easy also fills the combos part at 10 combo landings (`comboFull`, stored on its courses as `combo`; 16 Nov 2026).
  balltrack: {
    levels: {
      easy: { settings: { balls: 16, dropTicks: 190, moves: 0, golds: 7, boosts: 4, comboFull: 10 } },
      hard: { settings: { balls: 42, dropTicks: 72, moves: 8, golds: 7, boosts: 3 } },
      expert: { settings: { balls: 42, dropTicks: 66, moves: 12, golds: 7, boosts: 2 } },
    },
  },
  // Gemstone, matchupRev 13 (the Strategy overhaul stage 3): a copy of the sim's MATCHUP_V13_LEVELS (arcade/matchup.ts,
  // which the sim reads; gemstone-levels-check proves the two agree). Normal: 6 colours, 10 ice cells, the hint at 5 s.
  matchup: {
    levels: {
      easy: { settings: { colours: 5, goals: [12, 18, 24, 30, 36], ice: 5, hintS: 3 } },
      hard: { settings: { colours: 6, goals: [28, 38, 48, 58, 68, 78], ice: 14, hintS: 8 } },
      expert: { settings: { colours: 7, goals: [30, 40, 50, 60, 70, 80, 90], ice: 18, hintS: 0 } },
    },
  },
  // Tilt (the Strategy overhaul, stage 3; docs/arcade-standard/tilt.md "Levels (stage 3)"): a mirror of TILT_LEVELS in
  // src/lib/arcade/tilt.ts, which the sim reads (tilt-levels-check proves the two the same).
  tilt: {
    levels: {
      easy: { settings: { mazes: 3, sizes: [11, 13, 13], routes: [28, 34, 30], pits: [0, 1, 1], ice: [0, 0, 0], icePassages: 0, twoOf: [3], twoCount: [1, 1], parScale: 240, speedFullS: 60 } },
      hard: { settings: { mazes: 4, sizes: [15, 15, 17, 19], routes: [54, 56, 52, 58], pits: [3, 4, 4, 4], ice: [3, 3, 4, 4], icePassages: 2, twoOf: [2, 3, 4], twoCount: [2, 2], parScale: 135, speedFullS: 58 } },
      expert: { settings: { mazes: 4, sizes: [15, 17, 19, 19], routes: [56, 62, 58, 60], pits: [4, 4, 4, 4], ice: [5, 5, 5, 5], icePassages: 2, twoOf: [2, 3, 4], twoCount: [2, 3], parScale: 115, speedFullS: 70 } },
    },
  },
  // Rainbow Bridge (the Strategy overhaul's stage 3, 15 Nov 2026; docs/arcade-standard/inkbridge.md "Levels (stage 3)"):
  // inkRev 15 at each level, the sim's INK_LEVEL_SETS (ink percent of inkRev 10's, birds kept percent and added per
  // level, the first live level 0-based, the ink par margin, the levels whose birds sway); Normal is 125 %, today's
  // birds, live from 8 (level 9), 10 %. Each level deals from its own proved deal (ink-levels-check).
  inkbridge: {
    levels: {
      easy: { settings: { inkPct: 150, birdsPct: 25, extraBirds: [], liveFrom: 10, parMarginPct: 25, swayLevels: [], swayBirds: 0, stillPot: true, potW: 110, speedFullLeftS: 10, cloverOnRoute: 60, tricksFullAt: 2, cloversFullAt: 1 } },
      hard: { settings: { inkPct: 110, birdsPct: 100, extraBirds: [0, 2, 2, 2, 2, 2, 2, 2, 2, 2], liveFrom: 7, parMarginPct: 10, swayLevels: [], swayBirds: 0, potW: 48, speedFullLeftS: 70 } },
      expert: { settings: { inkPct: 100, birdsPct: 100, extraBirds: [0, 2, 3, 3, 3, 3, 3, 3, 3, 3], liveFrom: 6, parMarginPct: 0, swayLevels: [4, 5], swayBirds: 3, potW: 42, speedFullLeftS: 85 } },
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
