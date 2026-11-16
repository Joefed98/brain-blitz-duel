import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Slider's levels (the Word overhaul, stage 3, 15 Nov 2026; docs/design/game-reviews/word.md). Plain data only: the phone
 * reads it to draw the level switch, the server to deal (src/lib/duel/levels/wordslide.server.ts). Normal is today's game
 * (five common words scrambled 5–8 slides, par the proven fewest, 100 s).
 *
 * Each level scrambles the same kind of board further or less far: its par (the proven fewest slides back to the
 * words) is held in a range, and the clock is stored on the puzzle (`timeLimitMs`) where it isn't Normal's. The grid
 * stays 5 × 5 (square by rule). Hard is 7 slides deep in 60 s, Expert deeper, 8 slides in 50 s (Joe, 16 Nov 2026,
 * measured by the person-like solver, scripts/slider-human.ts). Depth stops at 8: proving a deeper par, and grading an
 * unfinished deeper board, would cost the server seconds per player. Any five real words count as a finish, so the game
 * is open by design.
 */
export interface WordSlideLevelSettings {
  /** The scramble's slides, inclusive. */
  shifts: readonly [number, number];
  /** The proven fewest slides back to the words (the par), inclusive. */
  par: readonly [number, number];
  /** The level's clock, when it isn't Normal's 100 s. */
  timeLimitMs?: number;
}

const OPEN = { open: "Any five real words in the rows finish the board, so there is no single answer to prove." } as const;

export const WORDSLIDE_LEVEL_SETTINGS: Readonly<Record<Exclude<Level, "normal">, WordSlideLevelSettings>> = {
  easy: { shifts: [3, 3], par: [2, 3] },
  hard: { shifts: [7, 7], par: [7, 7], timeLimitMs: 60_000 },
  expert: { shifts: [8, 8], par: [8, 8], timeLimitMs: 50_000 },
};

export const WORDSLIDE_LEVELS: GameLevels | null = {
  levels: {
    easy: { settings: { ...WORDSLIDE_LEVEL_SETTINGS.easy }, oneSolution: OPEN },
    hard: { settings: { ...WORDSLIDE_LEVEL_SETTINGS.hard }, oneSolution: OPEN },
    expert: { settings: { ...WORDSLIDE_LEVEL_SETTINGS.expert }, oneSolution: OPEN },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const WORDSLIDE_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "The words are only 2 or 3 slides away.",
  hard: "The words are 7 slides away, with 60 seconds.",
  expert: "The words are 8 slides away, with 50 seconds.",
};
