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
  /** How many words of 4+ letters the centre allows in the whole dictionary (the generator's first filter, as Normal's bands count). */
  words: { readonly min: number; readonly max: number };
  /** How many everyday words of `minLength`+ letters the board holds (the ones it counts and lists). */
  everyday: { readonly min: number; readonly max: number };
  /** The shortest word that counts (stored on the puzzle as `minLength`; Normal's 4). Easy's 3 also scores on the step-up table. */
  minLength: number;
  /** Keep only boards the typed witness takes to 200 inside the clock at the human limits. */
  witness?: boolean;
  /** Word points at which the words part is full on this level (stored as `wordsFullAt`; Normal's 45 when absent). */
  wordsFullAt?: number;
  timeLimitMs: number;
};

const OPEN = { open: "A word find: every word on the board that uses the centre letter counts, so there is no single answer." };

/**
 * D1 (21 Nov 2026; difficulty-spec.md "Nucleus"): the shortest word that counts is the ladder (3, 4, 5, 6), shown as the
 * "Need" pill from the first word. Easy keeps today's rich boards and scores every word as two letters longer; Hard and
 * Expert deal bigger rings (10–11 and 11 letters) so a 200 stays on the board, each proved by the typed witness.
 */
export const WORDSMITH_LEVELS: GameLevels<WordsmithLevelSettings> | null = {
  levels: {
    easy: { settings: { sizes: [9, 10], words: { min: 30, max: 400 }, everyday: { min: 45, max: 85 }, minLength: 3, timeLimitMs: 120_000 }, oneSolution: OPEN },
    hard: { settings: { sizes: [10, 11], words: { min: 40, max: 400 }, everyday: { min: 20, max: 35 }, minLength: 5, witness: true, wordsFullAt: 75, timeLimitMs: 65_000 }, oneSolution: OPEN },
    expert: { settings: { sizes: [11], words: { min: 40, max: 400 }, everyday: { min: 12, max: 20 }, minLength: 6, witness: true, wordsFullAt: 70, timeLimitMs: 40_000 }, oneSolution: OPEN },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const WORDSMITH_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "Three-letter words count, every word scores more, and 120 seconds.",
  hard: "Only words of five letters or more count, on a bigger ring, and 65 seconds.",
  expert: "Only words of six letters or more count, eleven letters, and 40 seconds.",
};
