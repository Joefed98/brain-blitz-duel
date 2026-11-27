import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Swapword's levels (the Word overhaul, stage 3, 15 Nov 2026; docs/design/game-reviews/word.md). Plain data only: the phone
 * reads it to draw the level switch, the server to deal (src/lib/duel/levels/swapword.server.ts). Normal is today's game
 * (a 9–12 swap minimum, 3–5 tiles in place, minimum + 12 swaps, 120 s).
 *
 * Each level is a board of the same six crossing words scrambled further or less far: the proven fewest swaps
 * (`minSwaps`), how many tiles start in place, the spare swaps on top of the minimum (the budget, stored as `maxSwaps`)
 * and the clock (`timeLimitMs`), all stored on the dealt puzzle. Every level's board has exactly one arrangement of six
 * common answer words (the grader judges against that one), and every Expert board is worked out by a solver that only
 * reads what the phone shows (scripts/swapword-levels-check.ts proves both).
 */
export interface SwapwordLevelSettings {
  /** The proven fewest swaps, inclusive. */
  minSwaps: readonly [number, number];
  /** Tiles that start in place, inclusive. */
  inPlace: readonly [number, number];
  /** Swaps on top of the minimum (the budget). */
  spare: number;
  timeLimitMs: number;
  /** Deal only boards the human-like solver works out from the start board's marks. */
  humanSolvable?: boolean;
  /**
   * swapwordRev 8 (D1, 21 Nov 2026): the board's lattice (swapword.ts: "hard" the three loops of 30 tiles on 8 × 8,
   * "expert" the four-loop window of 33 tiles on 7 × 7), stored on the dealt puzzle; absent: today's 21-tile figure eight.
   */
  lattice?: "hard" | "expert";
  /** Deal only boards whose person-like line (the solver's words, then the fewest swaps) reaches 200 at the human limits. */
  line200?: boolean;
}

const PROOF = { proof: "scripts/swapword-levels-check.ts" } as const;

export const SWAPWORD_LEVEL_SETTINGS: Readonly<Record<Exclude<Level, "normal">, SwapwordLevelSettings>> = {
  // D1 (21 Nov 2026; difficulty-spec.md "Swapword"): loops of crossing words are the ladder. Easy is today's; Hard the
  // three loops (30 tiles, 8 words), Expert the four-loop window (33 tiles, six 7-letter words), both on swapwordRev 8,
  // each worked out by the mark-reading solver.
  easy: { minSwaps: [5, 7], inPlace: [7, 9], spare: 16, timeLimitMs: 120_000 },
  hard: { minSwaps: [13, 15], inPlace: [3, 4], spare: 8, timeLimitMs: 110_000, humanSolvable: true, lattice: "hard" },
  expert: { minSwaps: [17, 20], inPlace: [3, 3], spare: 6, timeLimitMs: 110_000, humanSolvable: true, lattice: "expert", line200: true },
};

export const SWAPWORD_LEVELS: GameLevels | null = {
  levels: {
    easy: { settings: { ...SWAPWORD_LEVEL_SETTINGS.easy }, oneSolution: PROOF },
    hard: { settings: { ...SWAPWORD_LEVEL_SETTINGS.hard }, oneSolution: PROOF },
    expert: { settings: { ...SWAPWORD_LEVEL_SETTINGS.expert }, oneSolution: PROOF },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const SWAPWORD_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "Fewer tiles out of place and plenty of spare swaps.",
  hard: "Three loops of words: 30 tiles on a bigger board, 8 spare swaps and 110 seconds.",
  expert: "A window of six 7-letter words, 33 tiles, 6 spare swaps and 110 seconds.",
};
