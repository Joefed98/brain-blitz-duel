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
  // Operator (operatorGaps.server.ts generateOperatorLevel): four equations per level, any true fill counts; every
  // line has a true fill the person-like search finds (scripts/number-levels-equation-pyramid-check.ts). Normal is today's.
  equation: {
    levels: {
      easy: {
        settings: {
          tries: 3,
          lines: [
            { count: 3, lo: 2, hi: 9, numberGaps: 0, signGaps: 1, decoys: 0, signs: "+-×", maxAnswers: 1 },
            { count: 3, lo: 2, hi: 9, numberGaps: 1, signGaps: 0, decoys: 2, signs: "+-×", maxAnswers: 2 },
            { count: 4, lo: 2, hi: 9, numberGaps: 1, signGaps: 1, decoys: 2, signs: "+-×", distinct: 2, maxAnswers: 3 },
            { count: 4, lo: 2, hi: 9, numberGaps: 1, signGaps: 1, decoys: 2, signs: "+-×", need: "×", distinct: 2, maxAnswers: 3 },
          ],
        },
        oneSolution: { open: "any true fill counts; every equation is proved to have one by scripts/number-levels-equation-pyramid-check.ts" },
      },
      hard: {
        settings: {
          tries: 3,
          lines: [
            { count: 4, lo: 2, hi: 25, numberGaps: 0, signGaps: 3, decoys: 0, signs: "+-×", distinct: 2, maxAnswers: 1 },
            { count: 4, lo: 2, hi: 25, numberGaps: 4, signGaps: 0, decoys: 2, signs: "+-×", distinct: 2, maxAnswers: 3 },
            { count: 5, lo: 2, hi: 25, numberGaps: 3, signGaps: 2, decoys: 2, signs: "+-×÷", distinct: 2, maxAnswers: 3 },
            { count: 5, lo: 2, hi: 25, numberGaps: 2, signGaps: 4, decoys: 2, signs: "+-×÷", need: "×÷", distinct: 3, maxAnswers: 3 },
          ],
        },
        oneSolution: { open: "any true fill counts; every equation is proved to have one by scripts/number-levels-equation-pyramid-check.ts" },
      },
      expert: {
        settings: {
          tries: 2,
          lines: [
            { count: 4, lo: 2, hi: 30, numberGaps: 1, signGaps: 2, decoys: 2, signs: "+-×÷", distinct: 2, maxAnswers: 2 },
            { count: 5, lo: 2, hi: 30, numberGaps: 2, signGaps: 2, decoys: 2, signs: "+-×÷", distinct: 2, maxAnswers: 3 },
            { count: 5, lo: 2, hi: 30, numberGaps: 2, signGaps: 3, decoys: 2, signs: "+-×÷", need: "÷", distinct: 3, maxAnswers: 3 },
            { count: 5, lo: 2, hi: 30, numberGaps: 3, signGaps: 3, decoys: 2, signs: "+-×÷", need: "×÷", distinct: 3, maxAnswers: 3 },
          ],
        },
        oneSolution: { open: "any true fill counts; every equation is proved to have one by scripts/number-levels-equation-pyramid-check.ts" },
      },
    },
  },
  // Integer Pyramid (numberPyramidLevels.ts): each level's four rising boards from its own bank, every board proved to
  // have exactly one tray assignment (decoys included) and completed by the person-like solver. Normal is today's bank.
  numpyramid: {
    levels: {
      easy: {
        settings: {
          stages: [
            { rows: 4, minEmpty: 4, maxEmpty: 4, bottomLo: 1, bottomHi: 9 },
            { rows: 4, minEmpty: 4, maxEmpty: 5, bottomLo: 1, bottomHi: 9 },
            { rows: 4, minEmpty: 5, maxEmpty: 6, bottomLo: 1, bottomHi: 9 },
            { rows: 4, minEmpty: 6, maxEmpty: 6, bottomLo: 1, bottomHi: 9 },
          ],
          decoys: 1,
        },
        oneSolution: { proof: "scripts/number-levels-equation-pyramid-check.ts" },
      },
      hard: {
        settings: {
          stages: [
            { rows: 5, minEmpty: 11, maxEmpty: 12, bottomLo: 4, bottomHi: 20 },
            { rows: 5, minEmpty: 12, maxEmpty: 12, bottomLo: 4, bottomHi: 20 },
            { rows: 5, minEmpty: 12, maxEmpty: 13, bottomLo: 4, bottomHi: 20 },
            { rows: 5, minEmpty: 13, maxEmpty: 13, bottomLo: 4, bottomHi: 20 },
          ],
          decoys: 3,
        },
        oneSolution: { proof: "scripts/number-levels-equation-pyramid-check.ts" },
      },
      expert: {
        settings: {
          stages: [
            { rows: 6, minEmpty: 12, maxEmpty: 13, bottomLo: 4, bottomHi: 25 },
            { rows: 6, minEmpty: 13, maxEmpty: 13, bottomLo: 4, bottomHi: 25 },
            { rows: 6, minEmpty: 13, maxEmpty: 13, bottomLo: 4, bottomHi: 25 },
            { rows: 6, minEmpty: 13, maxEmpty: 14, bottomLo: 4, bottomHi: 25 },
          ],
          decoys: 3,
        },
        oneSolution: { proof: "scripts/number-levels-equation-pyramid-check.ts" },
      },
    },
  },
  // Counterweight (balanceLevels.ts): Joe's decision of 15 Nov 2026, today's game is Hard; Normal (balanceRev 5,
  // BALANCE_NORMAL there) is gentler, Easy gentler still, Expert harder with the balance readout hidden.
  balance: {
    levels: {
      easy: {
        settings: {
          scales: [
            { loose: 2, fixed: 1, pegs: 6, unique: true, maxW: 6 },
            { loose: 2, fixed: 1, pegs: 6, unique: true },
            { loose: 3, fixed: 2, pegs: 6, unique: true },
          ],
          spare: [8, 8, 10],
        },
        oneSolution: { open: "any balanced arrangement counts; every board is proved solvable by scripts/number-levels-balance-target-check.ts" },
      },
      hard: {
        settings: { today: true },
        oneSolution: { open: "any balanced arrangement counts; today's game, proved solvable by its generator" },
      },
      expert: {
        settings: {
          scales: [
            { loose: 3, fixed: 1, pegs: 10, unique: true },
            { loose: 4, fixed: 2, pegs: 10, unique: true },
            { loose: 5, fixed: 2, pegs: 10, unique: true },
            { loose: 6, fixed: 2, pegs: 10, unique: true },
          ],
          spare: [5, 6, 6, 7],
          hide: true,
        },
        oneSolution: { proof: "scripts/number-levels-balance-target-check.ts" },
      },
    },
  },
  // Exact (targetLevels.server.ts): any route counts; each level's target is proved by exhaustive search.
  target: {
    levels: {
      easy: {
        settings: { large: [1, 2], target: [101, 300], tiles: [3, 4] },
        oneSolution: { open: "any route counts; every target is proved reachable with 3 or 4 numbers by scripts/number-levels-balance-target-check.ts" },
      },
      hard: {
        settings: { large: [1, 1], target: [300, 999], tiles: [6, 6] },
        oneSolution: { open: "any route counts; every target is proved to need all six numbers by scripts/number-levels-balance-target-check.ts" },
      },
      expert: {
        settings: { large: [0, 0], target: [500, 999], tiles: [6, 6], person: true },
        oneSolution: { open: "any route counts; every target is proved to need all six numbers by scripts/number-levels-balance-target-check.ts" },
      },
    },
  },
  // Brimful (measureLevels.ts): Joe's decision of 15 Nov 2026, today's game is Hard; Normal (measureRev 5,
  // MEASURE_NORMAL there) is gentler, Easy gentler still, Expert harder. Each board's minimum is proven by BFS.
  measure: {
    levels: {
      easy: {
        settings: {
          boards: [
            { goal: "amount", jugs: 2, tap: true, band: [2, 4] },
            { goal: "amount", jugs: 2, tap: true, band: [3, 4] },
            { goal: "amount", jugs: 2, tap: true, band: [4, 6] },
          ],
          limitFactor: 5,
        },
        oneSolution: { open: "any sequence reaching the target counts; the minimum is proven by BFS" },
      },
      hard: {
        settings: { today: true },
        oneSolution: { open: "any sequence reaching the target counts; the minimum is proven by BFS" },
      },
      expert: {
        settings: {
          boards: [
            { goal: "amount", jugs: 2, tap: true, band: [14, 16] },
            { goal: "amount", jugs: 3, tap: true, band: [12, 15] },
            { goal: "amount", jugs: 3, tap: false, band: [11, 15] },
            { goal: "split", jugs: 3, tap: false, band: [13, 16] },
          ],
          limitFactor: 1.5,
        },
        oneSolution: { open: "any sequence reaching the target counts; the minimum is proven by BFS" },
      },
    },
  },
  // Checkout (numberLevels.ts): Joe's decision of 15 Nov 2026, today's game is Hard; Normal (checkoutRev 4,
  // CHECKOUT_NORMAL there) is three standard boards and two shuffled, Easy three standard boards checking out on any
  // dart, Expert five strange boards with exact dart counts. Every board is proved by the exhaustive search (a route in
  // an order that never busts); Easy and Expert boards are also found by the person-like solver.
  checkout: {
    levels: {
      easy: {
        settings: {
          boards: [
            { wedges: "standard", finish: 2, anyRing: true, maxDarts: 3, target: [30, 70], minRoutes: 50 },
            { wedges: "standard", finish: 2, anyRing: true, maxDarts: 3, target: [50, 100], minRoutes: 50 },
            { wedges: "standard", finish: 2, anyRing: true, maxDarts: 3, target: [100, 150], minRoutes: 50 },
          ],
          person: true,
        },
        oneSolution: { open: "any dart sequence reaching the target on the finishing ring counts; every level board is proved to have a checkout by scripts/number-levels-checkout-kakuro-check.ts" },
      },
      hard: {
        settings: { today: true },
        oneSolution: { open: "any dart sequence reaching the target on the finishing ring counts; every level board is proved to have a checkout by scripts/number-levels-checkout-kakuro-check.ts" },
      },
      expert: {
        settings: {
          boards: [
            { wedges: "uneven", finish: 2, maxDarts: 3, exact: true, target: [80, 170], notGreedy: true },
            { wedges: "uneven", finish: 3, quad: true, maxDarts: 3, exact: true, target: [150, 320], notGreedy: true },
            { wedges: "shuffled", negatives: true, finish: 2, maxDarts: 4, exact: true, target: [80, 170], notGreedy: true },
            { wedges: "uneven", negatives: true, quad: true, finish: 2, maxDarts: 4, exact: true, target: [120, 280], notGreedy: true },
            { wedges: "uneven", negatives: true, quad: true, finish: 3, maxDarts: 4, exact: true, target: [150, 320], notGreedy: true },
          ],
          person: true,
        },
        oneSolution: { open: "any dart sequence reaching the target on the finishing ring counts; every level board is proved to have a checkout by scripts/number-levels-checkout-kakuro-check.ts" },
      },
    },
  },
  // Kakuro (numberLevels.ts): Joe's decision of 15 Nov 2026, today's 6 × 6 game is Hard; Normal (kakuroRev 3,
  // KAKURO_NORMAL there) is 6 × 6 with 16–19 white squares, grade 0–4, Easy 5 × 5, Expert 7 × 7. Every board has
  // exactly one solution (the solver's search) and, at every new level, the person-like solver completes it.
  kakuro: {
    levels: {
      easy: {
        settings: { size: 5, whiteMin: 12, whiteMax: 14, gradeMin: 0, gradeMax: 0, maxBlocks: 9, person: true },
        oneSolution: { proof: "scripts/number-levels-checkout-kakuro-check.ts" },
      },
      hard: {
        settings: { today: true },
        oneSolution: { proof: "scripts/number-levels-checkout-kakuro-check.ts" },
      },
      expert: {
        settings: { size: 7, whiteMin: 26, whiteMax: 30, gradeMin: 4, gradeMax: 12, maxBlocks: 12, person: true },
        oneSolution: { proof: "scripts/number-levels-checkout-kakuro-check.ts" },
      },
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
