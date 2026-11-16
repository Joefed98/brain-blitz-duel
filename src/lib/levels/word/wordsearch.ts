import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Lookout's levels (the Word overhaul, stage 3, 15 Nov 2026; docs/design/game-reviews/word.md). Plain data only: the
 * phone reads it to draw the level switch, the server to deal (src/lib/duel/levels/wordsearch.server.ts) and the bank
 * script to build each level's boards (scripts/word-search-level-bank.ts). Normal is today's game: a 10 × 10 grid, six
 * words in any of the eight directions, a hidden bonus word, 120 s.
 *
 * The bigger levels grow in rows, never columns (Joe, 15 Nov 2026: taller grids, not smaller squares): Hard and Expert
 * keep Normal's ten columns, so their squares are as wide as Normal's.
 */

/** The eight directions as [row step, column step]: across, down, the two down diagonals, then their reverses. */
export const WS_ALL_DIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [-1, 1],
];

export interface WordSearchLevelSettings {
  cols: number;
  rows: number;
  /** Listed words to find. */
  words: number;
  /** The directions the hidden words (and the bonus) may run. */
  dirs: readonly (readonly [number, number])[];
  /** Hidden words whose start, one letter short, is also written elsewhere (a false start). */
  decoys: number;
  /** The round's clock, ms (at most 120 s). */
  timeLimitMs: number;
}

const PROOF = { proof: "scripts/wordsearch-levels-check.ts" } as const;

export const WORDSEARCH_LEVEL_SETTINGS: Readonly<Record<Exclude<Level, "normal">, WordSearchLevelSettings>> = {
  easy: { cols: 8, rows: 8, words: 5, dirs: [[0, 1], [1, 0]], decoys: 0, timeLimitMs: 120_000 },
  hard: { cols: 10, rows: 11, words: 7, dirs: WS_ALL_DIRS, decoys: 0, timeLimitMs: 90_000 },
  expert: { cols: 10, rows: 12, words: 8, dirs: WS_ALL_DIRS, decoys: 4, timeLimitMs: 90_000 },
};

export const WORDSEARCH_LEVELS: GameLevels | null = {
  levels: {
    easy: { settings: { ...WORDSEARCH_LEVEL_SETTINGS.easy }, oneSolution: PROOF },
    hard: { settings: { ...WORDSEARCH_LEVEL_SETTINGS.hard }, oneSolution: PROOF },
    expert: { settings: { ...WORDSEARCH_LEVEL_SETTINGS.expert }, oneSolution: PROOF },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const WORDSEARCH_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "A smaller 8 by 8 grid with five words, all reading across or down.",
  hard: "A taller grid with seven words running any way, backwards too, and 90 seconds.",
  expert: "The tallest grid, eight words, false starts (a word's first letters appear twice) and 90 seconds.",
};
