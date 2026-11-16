import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Forage's levels (the Word overhaul, stage 3, 15 Nov 2026; docs/design/game-reviews/word.md). Plain data only: the phone
 * reads it to draw the level switch, the server to deal (src/lib/duel/levels/wordhunt.server.ts). Normal is today's game
 * (a 6×6 board of 120+ everyday words, 140–420 dealt, median about 240; 100 s).
 *
 * The score is the board's word points on the same curve at every level, so a board with fewer words to trace is a
 * harder board: Easy deals the richest boards and the most time; Hard and Expert sparser boards on shorter clocks. The
 * board stays 6×6 at every level (squares the same size as Normal's).
 */
export type WordHuntLevelSettings = {
  /** How many everyday words the board holds. */
  words: { readonly min: number; readonly max: number };
  /** How many 6–9 letter seed words are traced in before the filler (Normal: 3 or 4). */
  seeds: readonly [number, number];
  timeLimitMs: number;
};

const OPEN = { open: "A word find: every everyday word traced on the board counts, so there is no single answer." };

export const WORDHUNT_LEVELS: GameLevels<WordHuntLevelSettings> | null = {
  levels: {
    easy: { settings: { words: { min: 320, max: 700 }, seeds: [4, 4], timeLimitMs: 120_000 }, oneSolution: OPEN },
    hard: { settings: { words: { min: 100, max: 140 }, seeds: [3, 3], timeLimitMs: 80_000 }, oneSolution: OPEN },
    expert: { settings: { words: { min: 50, max: 80 }, seeds: [1, 2], timeLimitMs: 70_000 }, oneSolution: OPEN },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const WORDHUNT_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "A board packed with words, and 120 seconds.",
  hard: "A board with fewer words hidden in it, and 80 seconds.",
  expert: "A board with only a few words hidden in it, and 70 seconds.",
};
