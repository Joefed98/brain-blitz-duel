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

/** The Logic overhaul's level proof (session 1): every level board of its seven games. */
const LOGIC1_PROOF = "scripts/logic-1-levels-check.tsx";

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
  /*
   * The Logic overhaul, session 1 (15 Nov 2026; docs/design/game-reviews/logic.md, the levels Joe agreed). Every
   * level's boards are proven by scripts/logic-1-levels-check.ts (exactly one solution, or for the move games the
   * exact minimum by search); the levers are listed beside each game's settings. Every clock is at most 120 s.
   */
  // Box Six. Levers: givens (fewer = harder), the deduction a board needs (`steps`: "singles" = naked and hidden
  // singles only; "advanced" = needs a pair, pointing or box-line step, at least `minAdvanced` times), clashes shown live or on Check,
  // used-up digits hidden from the keypad (Easy), the clock.
  sudoku: {
    levels: {
      easy: { settings: { givens: [19, 21], steps: "singles", clashes: "live", hideUsed: true, timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { givens: [10, 12], steps: "advanced", minAdvanced: 1, clashes: "live", hideUsed: false, timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { givens: [9, 10], steps: "advanced", minAdvanced: 2, clashes: "check", hideUsed: false, timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
    },
  },
  // Polypotions. Levers: flasks, colours, layers a flask holds, empty flasks, the exact minimum's band, hidden layers
  // (only the top colour of each flask shows until it is uncovered), the clock; the pour allowance stays min + 6.
  tubes: {
    levels: {
      easy: { settings: { flasks: 6, colours: 4, capacity: 4, minMoves: [8, 12], hidden: false, timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { flasks: 10, colours: 8, capacity: 7, minMoves: [26, 34], hidden: false, timeMs: 120_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { flasks: 12, colours: 10, capacity: 6, minMoves: [28, 38], hidden: true, timeMs: 120_000 }, oneSolution: { proof: LOGIC1_PROOF } },
    },
  },
  // Hanoi. Levers: posts (fixed per level), rings, the exact minimum's band, the clock.
  tower: {
    levels: {
      easy: { settings: { pegs: 4, discs: 7, minMoves: [10, 18], timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { pegs: 3, discs: 9, minMoves: [34, 45], timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { pegs: 3, discs: 10, minMoves: [45, 60], timeMs: 105_000 }, oneSolution: { proof: LOGIC1_PROOF } },
    },
  },
  // Safe Cracker. Levers: dials, the dial range, clues on the card, the clue kinds and their weights, tries, the clock.
  safe: {
    levels: {
      easy: { settings: { dials: 3, max: 9, clues: 5, kinds: "simple", tries: 3, timeMs: 75_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { dials: 4, max: 15, clues: 6, kinds: "number", tries: 3, timeMs: 75_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { dials: 5, max: 20, clues: 7, kinds: "number", tries: 2, timeMs: 105_000 }, oneSolution: { proof: LOGIC1_PROOF } },
    },
  },
  // Mosaic. Levers: columns × rows (grown downwards, so squares stay tappable at 375 px), how full the picture is,
  // the reasoning a board needs ("line" = each line solvable from its own clue and what is already known; "two" =
  // needs two lines together at least once), lines locking once right (Easy), the clock.
  nonogram: {
    levels: {
      easy: { settings: { cols: 6, rows: 6, fill: [0.5, 0.7], logic: "line", lockLines: true, timeMs: 90_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { cols: 9, rows: 11, fill: [0.5, 0.65], logic: "line", lockLines: false, timeMs: 120_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { cols: 9, rows: 14, fill: [0.5, 0.6], logic: "two", lockLines: false, timeMs: 120_000 }, oneSolution: { proof: LOGIC1_PROOF } },
    },
  },
  // Colour Flood. Levers: blob smoothing, columns × rows (grown downwards past 14 wide), colours, the exact minimum (par) band,
  // blocked squares (never flooded, never counted), the clock; the move allowance stays par + 6.
  flood: {
    levels: {
      easy: { settings: { smooth: 2, cols: 10, rows: 10, colours: 4, par: [6, 8], blocked: 0, spare: 8, timeMs: 60_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { smooth: 1, cols: 12, rows: 17, colours: 6, par: [14, 18], blocked: 0, spare: 4, timeMs: 60_000 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { smooth: 2, cols: 14, rows: 24, colours: 6, par: [18, 22], blocked: 14, spare: 3, timeMs: 75_000 }, oneSolution: { proof: LOGIC1_PROOF } },
    },
  },
  // Minefield (an arcade-run Logic game). Levers: columns × rows (grown downwards past 10 wide), mines, the opening's
  // size band, the solver steps a board needs (never a guess), the run's length. Hard is today's game exactly
  // (minesRev 2: 20 mines); Normal is the gentler minesRev 3 (Joe, 15 Nov 2026, "too-hard games: today's becomes Hard").
  minesweeper: {
    levels: {
      easy: { settings: { cols: 8, rows: 12, mines: 9, opening: [25, 40], seconds: 90 }, oneSolution: { proof: LOGIC1_PROOF } },
      hard: { settings: { cols: 10, rows: 16, mines: 20, opening: [20, 60], seconds: 90 }, oneSolution: { proof: LOGIC1_PROOF } },
      expert: { settings: { cols: 12, rows: 18, mines: 34, opening: [8, 16], seconds: 120 }, oneSolution: { proof: LOGIC1_PROOF } },
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
