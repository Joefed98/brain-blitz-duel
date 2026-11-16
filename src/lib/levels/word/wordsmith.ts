import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Nucleus's levels (the Word overhaul, stage 3, 15 Nov 2026; docs/design/game-reviews/word.md). Plain data only: the phone
 * reads it to draw the level switch, the server to deal (src/lib/duel/levels/wordsmith.server.ts). Normal is today's game
 * (8–11 letters, 25–120 words a board by size, 100 s).
 *
 * The score is the board's word points on the same curve at every level, so a board with fewer words to find is a harder
 * board: Easy deals the bigger, richer boards; Hard and Expert smaller boards with fewer words, on shorter clocks.
 */
export type WordsmithLevelSettings = {
  /** Board sizes (letters) the level deals, one drawn at random. */
  sizes: readonly number[];
  /** How many words the centre allows in the whole dictionary (the generator's first filter, as Normal's bands count). */
  words: { readonly min: number; readonly max: number };
  /** How many of them are everyday words (the ones the board counts and lists; Normal's boards hold 17–87, median 37). */
  everyday: { readonly min: number; readonly max: number };
  timeLimitMs: number;
};

const OPEN = { open: "A word find: every word on the board that uses the centre letter counts, so there is no single answer." };

export const WORDSMITH_LEVELS: GameLevels<WordsmithLevelSettings> | null = {
  levels: {
    easy: { settings: { sizes: [9, 10], words: { min: 30, max: 400 }, everyday: { min: 45, max: 85 }, timeLimitMs: 120_000 }, oneSolution: OPEN },
    hard: { settings: { sizes: [8, 9], words: { min: 15, max: 400 }, everyday: { min: 16, max: 24 }, timeLimitMs: 65_000 }, oneSolution: OPEN },
    expert: { settings: { sizes: [8], words: { min: 10, max: 400 }, everyday: { min: 10, max: 14 }, timeLimitMs: 50_000 }, oneSolution: OPEN },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const WORDSMITH_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "Nine or ten letters with lots of words to find, and 120 seconds.",
  hard: "Eight or nine letters with fewer words to find, and 65 seconds.",
  expert: "Eight letters with only a few words to find, and 50 seconds.",
};
