import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Forage's levels (the Word overhaul, stage 3, 15 Nov 2026; redesigned by D1, 21 Nov 2026). Plain data only: the phone
 * reads it to draw the level switch, the server to deal (src/lib/duel/levels/wordhunt.server.ts). Normal is today's game
 * (a 6×6 board of 120+ everyday words, 140–420 dealt, median about 240; words of 4+ letters; 100 s).
 *
 * The shortest word that counts is the ladder (3, 4, 5, 7), shown in the "Min" and "Need" pills from the first trace; every
 * level deals a packed board (today's Easy band) so long words, and a 200, stay on it. The board stays 6×6 at every level.
 */
export type WordHuntLevelSettings = {
  /** How many everyday words of 4+ letters the board holds (the packed band). */
  words: { readonly min: number; readonly max: number };
  /** How many 6–9 letter seed words are traced in before the filler (Normal: 3 or 4). */
  seeds: readonly [number, number];
  /** The shortest word that counts (stored on the puzzle as `minLength`; Normal's 4). Easy's 3 also scores on the step-up table. */
  minLength: number;
  /** At least this many everyday words of `minLength`+ letters on the board. */
  longWords: number;
  /** Free misses before any cost, and more for each word found (stored on the puzzle; Normal's 10 and 2). */
  freeMisses?: readonly [number, number];
  /** Keep only boards the typed witness takes to 200 inside the clock at the human limits. */
  witness?: boolean;
  /** Base points and feature extras at which each part is full on this level (stored; Normal's 44 and 70 when absent). */
  fullAt?: readonly [number, number];
  timeLimitMs: number;
};

const OPEN = { open: "A word find: every everyday word traced on the board counts, so there is no single answer." };

export const WORDHUNT_LEVELS: GameLevels<WordHuntLevelSettings> | null = {
  levels: {
    // Easy: misses cost nothing (120 free, the most the phone ever sends).
    easy: { settings: { words: { min: 320, max: 700 }, seeds: [4, 4], minLength: 3, longWords: 0, freeMisses: [120, 0], timeLimitMs: 120_000 }, oneSolution: OPEN },
    hard: { settings: { words: { min: 320, max: 700 }, seeds: [4, 4], minLength: 5, longWords: 60, freeMisses: [6, 1], witness: true, fullAt: [80, 120], timeLimitMs: 65_000 }, oneSolution: OPEN },
    expert: { settings: { words: { min: 320, max: 700 }, seeds: [4, 4], minLength: 7, longWords: 25, freeMisses: [3, 1], witness: true, fullAt: [100, 250], timeLimitMs: 40_000 }, oneSolution: OPEN },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const WORDHUNT_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "Three-letter words count, every word scores more, misses are free, and 120 seconds.",
  hard: "Only words of five letters or more count, six free misses, and 65 seconds.",
  expert: "Only words of seven letters or more count, three free misses, and 40 seconds.",
};
