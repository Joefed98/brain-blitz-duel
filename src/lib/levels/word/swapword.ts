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
}

const PROOF = { proof: "scripts/swapword-levels-check.ts" } as const;

export const SWAPWORD_LEVEL_SETTINGS: Readonly<Record<Exclude<Level, "normal">, SwapwordLevelSettings>> = {
  easy: { minSwaps: [5, 7], inPlace: [7, 9], spare: 16, timeLimitMs: 120_000 },
  hard: { minSwaps: [13, 15], inPlace: [3, 4], spare: 6, timeLimitMs: 55_000 },
  expert: { minSwaps: [15, 17], inPlace: [2, 3], spare: 4, timeLimitMs: 60_000, humanSolvable: true },
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
  hard: "More tiles out of place, only 6 spare swaps and 55 seconds.",
  expert: "Almost every tile out of place, only 4 spare swaps and 60 seconds.",
};
