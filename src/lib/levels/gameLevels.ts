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
import { BOMB_LEVELS, MAZE_LEVELS, PAIR_LEVELS, SCAN_LEVELS, SPOT_LEVELS, TALLY_LEVELS } from "./attentionLevels.data";

/** The check proving every Attention level (one answer, legibility, clocks, the human-like Expert solver). */
const ATTENTION_PROOF = "scripts/attention-levels-check.ts";

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
  // The Attention overhaul (stage 3, 15 Nov 2026): every lever per level in attentionLevels.data.ts, proved by
  // attention-levels-check (each level's boards: one answer, legibility, the clock, a human-like solver finishing Expert).
  // Matchmaker: pairs, columns (the board grows downwards), the miss's flip-back, the clock, the shapes drawn from
  // (fewer shapes: more cards share a shape), speed's full-by and the free misses.
  pairmatch: {
    levels: {
      easy: { settings: { ...PAIR_LEVELS.easy }, oneSolution: { proof: ATTENTION_PROOF } },
      hard: { settings: { ...PAIR_LEVELS.hard }, oneSolution: { proof: ATTENTION_PROOF } },
      expert: { settings: { ...PAIR_LEVELS.expert }, oneSolution: { proof: ATTENTION_PROOF } },
    },
  },
  // Eagle Eye: each grid's size (a bigger grid grows downwards), the eagles facing the target, the first grid with two
  // facings and how many of each, the share of look-alikes (always exactly 45° off a target) and speed's full-by.
  // Every level, Normal included, plays scanRev 5's 60 s clock.
  symscan: {
    levels: {
      easy: { settings: { ...SCAN_LEVELS.easy }, oneSolution: { proof: ATTENTION_PROOF } },
      hard: { settings: { ...SCAN_LEVELS.hard }, oneSolution: { proof: ATTENTION_PROOF } },
      expert: { settings: { ...SCAN_LEVELS.expert }, oneSolution: { proof: ATTENTION_PROOF } },
    },
  },
  // Double Take: each picture's grid (Expert's 8 × 8 grows downwards), its differences, their kinds (Easy colour and
  // shape only; Expert's turns weighted up), the hidden seventh, Hard's subtler (still legible) colours, the clock and
  // speed's full-by. Each picture is kept only when its panels differ in exactly the dealt ways.
  spotdiff: {
    levels: {
      easy: { settings: { ...SPOT_LEVELS.easy }, oneSolution: { proof: ATTENTION_PROOF } },
      hard: { settings: { ...SPOT_LEVELS.hard }, oneSolution: { proof: ATTENTION_PROOF } },
      expert: { settings: { ...SPOT_LEVELS.expert }, oneSolution: { proof: ATTENTION_PROOF } },
    },
  },
  // Tally: the trays' shapes (none above 110; Easy three trays), each tray's answer range, the near-miss groups, the
  // comparison tray's closeness (Hard and Expert: bigger counts, smaller gaps), Expert's two-colour questions and no
  // marks, the clock and speed's full-by. Every answer is counted from the dealt tray itself, so there is one.
  countup: {
    levels: {
      easy: { settings: { ...TALLY_LEVELS.easy }, oneSolution: { proof: ATTENTION_PROOF } },
      hard: { settings: { ...TALLY_LEVELS.hard }, oneSolution: { proof: ATTENTION_PROOF } },
      expert: { settings: { ...TALLY_LEVELS.expert }, oneSolution: { proof: ATTENTION_PROOF } },
    },
  },
  // Bomb Defusal: the wires on the panel, the steps of the one answer, the card's clues (every one needed), Expert's
  // instant explosion on the first wrong step (checked live on the server, no Reset), the clock, the bank's size and
  // speed's full-by. Every banked card is proved by search to have exactly one answer.
  bomb: {
    levels: {
      easy: { settings: { ...BOMB_LEVELS.easy }, oneSolution: { proof: ATTENTION_PROOF } },
      hard: { settings: { ...BOMB_LEVELS.hard }, oneSolution: { proof: ATTENTION_PROOF } },
      expert: { settings: { ...BOMB_LEVELS.expert }, oneSolution: { proof: ATTENTION_PROOF } },
    },
  },
  // Labyrinth: the board's columns and rows (a bigger maze grows downwards), the route's length, the false trails (and
  // the long ones), turns and junctions on the route, the carving's branch share, Expert's hidden exit, the clock and
  // speed's full-by. Every carved maze is perfect: exactly one route joins the start and the exit.
  maze: {
    levels: {
      easy: { settings: { ...MAZE_LEVELS.easy }, oneSolution: { proof: ATTENTION_PROOF } },
      hard: { settings: { ...MAZE_LEVELS.hard }, oneSolution: { proof: ATTENTION_PROOF } },
      expert: { settings: { ...MAZE_LEVELS.expert }, oneSolution: { proof: ATTENTION_PROOF } },
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
