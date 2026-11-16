import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Strikeout's levels (the Word overhaul, stage 3, 15 Nov 2026; docs/design/game-reviews/word.md). Plain data only: the
 * phone reads it to draw the level switch, the server to deal (src/lib/duel/levels/strikeout.server.ts). Normal is
 * today's game: three starting letters on the first three seven-letter words and two on the first three eight-letter
 * words, one fewer on words 4 and 5, three vowel guesses a word and twelve strikes.
 */
export interface StrikeoutLevelSettings {
  /** Starting letters on words 1–3: [a seven-letter word, an eight-letter word]. */
  givensFirst: readonly [number, number];
  /** Starting letters on words 4 and 5: [seven letters, eight letters]. */
  givensRest: readonly [number, number];
  /** Vowel guesses allowed on each word. */
  vowels: number;
  /** Strikes (shared over the round) that end it. */
  strikes: number;
  /** The round's clock, ms (at most 120 s). */
  timeLimitMs: number;
}

const PROOF = { proof: "scripts/strikeout-levels-check.ts" } as const;

export const STRIKEOUT_LEVEL_SETTINGS: Readonly<Record<Exclude<Level, "normal">, StrikeoutLevelSettings>> = {
  easy: { givensFirst: [3, 2], givensRest: [3, 2], vowels: 4, strikes: 14, timeLimitMs: 120_000 },
  hard: { givensFirst: [1, 1], givensRest: [1, 1], vowels: 2, strikes: 10, timeLimitMs: 90_000 },
  expert: { givensFirst: [0, 0], givensRest: [0, 0], vowels: 2, strikes: 12, timeLimitMs: 85_000 },
};

export const STRIKEOUT_LEVELS: GameLevels | null = {
  levels: {
    easy: { settings: { ...STRIKEOUT_LEVEL_SETTINGS.easy }, oneSolution: PROOF },
    hard: { settings: { ...STRIKEOUT_LEVEL_SETTINGS.hard }, oneSolution: PROOF },
    expert: { settings: { ...STRIKEOUT_LEVEL_SETTINGS.expert }, oneSolution: PROOF },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const STRIKEOUT_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "An extra starting letter on words 4 and 5, four vowel guesses a word, 14 strikes and 120 seconds.",
  hard: "One starting letter a word, two vowel guesses a word, 10 strikes and 90 seconds.",
  expert: "No starting letters, two vowel guesses a word, 12 strikes and 85 seconds.",
};
