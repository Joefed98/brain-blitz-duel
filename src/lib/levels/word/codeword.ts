import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Cryptogrid's levels (the Word overhaul, stage 3, 15 Nov 2026; redesigned by D1, 21 Nov 2026, docs/polish-plan-final/
 * difficulty-spec.md "Cryptogrid"). Plain data only: the phone reads it to draw the level switch, the server to deal
 * (src/lib/duel/levels/codeword.server.ts) and the bank script to build each level's boards (scripts/codeword-bank.ts
 * --levels). Normal is today's game: a 7 × 7 grid of 14–18 letters, six numbers start decoded, 120 s.
 *
 * The grid's size is the ladder (Easy 5 × 5, Normal 7 × 7, Hard 8 × 7, Expert 9 × 7), so a player sees the step before
 * touching anything: Easy a small lattice of six 5-letter words (rows and columns 1, 3 and 5) with half its letters in;
 * Hard and Expert grow wider, never taller (Joe, 21 Nov 2026: seven rows keep their squares 36 px or more on a 375 × 667
 * phone), Expert with four letters showing, dealt only from boards the person-like solver cracks by reasoning alone and
 * whose person-like line at the human limits scores 200 inside the clock. Every
 * board is proven to have exactly one decoding from its starting letters against the full dictionary. Each level's speed
 * line is half its clock (Normal's 60 s of 120), stored on the puzzle. Expert's clock is 80 s, not the spec's 100 s: at
 * 100 s the average kit scored 52 on the 9 × 9 boards (target 25–45), at 80 s 40.
 */
export type CodewordLevelSettings = {
  /** The grid's width (columns; its side on a square grid). */
  size: number;
  /**
   * The grid's height when it isn't square (Joe, 21 Nov 2026: Hard 8 × 7 and Expert 9 × 7 grow wider, never taller, so their
   * squares stay 36 px or more on a 375 × 667 phone); stored on the dealt puzzle as `rows`. Absent: square.
   */
  rows?: number;
  /** How many different letters (numbers) the grid uses. */
  letters: { readonly min: number; readonly max: number };
  /** Numbers that start decoded. */
  givens: number;
  /** The round's clock. */
  clockMs: number;
  /** Speed points are full for a crack inside this many seconds (stored on the puzzle; Normal's 60). */
  speedFullByS: number;
  /**
   * The templates: symmetric pairs of black squares dropped (pairsMin plus up to pairsSpan − 1 more), the white-cell range,
   * the share of white cells crossed by two words, the longest run (the answer list stops at seven letters) and the fill
   * search's budget; `lattice` for Easy's fixed rows and columns.
   */
  shape: {
    readonly pairsMin: number;
    readonly pairsSpan: number;
    readonly whiteMin: number;
    readonly whiteMax: number;
    readonly checked: number;
    readonly maxRun: number;
    readonly fillBudget: number;
    readonly lattice?: boolean;
  };
  /** Only boards the person-like solver decodes from the starting letters alone. */
  human?: boolean;
  /** Boards in the level's bank. */
  bank: number;
};

const PROOF = { proof: "scripts/codeword-levels-check.ts" };

export const CODEWORD_LEVELS: GameLevels<CodewordLevelSettings> = {
  levels: {
    easy: {
      settings: {
        size: 5,
        letters: { min: 10, max: 13 },
        givens: 6,
        clockMs: 120_000,
        speedFullByS: 60,
        shape: { pairsMin: 0, pairsSpan: 1, whiteMin: 21, whiteMax: 21, checked: 0, maxRun: 5, fillBudget: 4_000, lattice: true },
        bank: 200,
      },
      oneSolution: PROOF,
    },
    hard: {
      settings: {
        size: 8,
        rows: 7,
        letters: { min: 17, max: 21 },
        givens: 5,
        clockMs: 110_000,
        speedFullByS: 55,
        shape: { pairsMin: 6, pairsSpan: 6, whiteMin: 33, whiteMax: 44, checked: 0.5, maxRun: 7, fillBudget: 20_000 },
        bank: 200,
      },
      oneSolution: PROOF,
    },
    expert: {
      settings: {
        size: 9,
        rows: 7,
        letters: { min: 19, max: 23 },
        givens: 4,
        clockMs: 80_000,
        speedFullByS: 40,
        shape: { pairsMin: 7, pairsSpan: 6, whiteMin: 38, whiteMax: 50, checked: 0.5, maxRun: 7, fillBudget: 40_000 },
        human: true,
        bank: 200,
      },
      oneSolution: PROOF,
    },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const CODEWORD_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "A small 5 by 5 grid of six words, half its letters already in, and 120 seconds.",
  hard: "Five letters to start on a wider 8 by 7 grid, and 110 seconds.",
  expert: "Four letters to start on a 9 by 7 grid, and 80 seconds; it cracks by reasoning alone.",
};
