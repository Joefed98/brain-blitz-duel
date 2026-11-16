import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Roundabout's levels (the Word overhaul, stage 3, 15 Nov 2026; docs/design/game-reviews/word.md). Plain data only: the
 * phone reads it to draw the level switch, the server to deal (src/lib/duel/levels/letterwheel.server.ts). Normal is
 * today's game (a 7-letter wheel, 11–14 crossword words in at most 11 × 9, 100 s).
 *
 * Each level deals from its own bank (scripts/letter-wheel-bank.ts --level=…, LW_LEVEL_LIMITS in letterWheel.ts): Easy
 * a 6-letter wheel and 7–9 words; Hard a 7-letter wheel and 12–15 words; Expert a 7-letter wheel and 16–19 words. No
 * level is wider than 9 columns; Hard (up to 9 × 11) and Expert (up to 9 × 12) grow taller instead, so their squares
 * are never smaller than Normal's.
 */
export type LetterWheelLevelSettings = {
  timeLimitMs: number;
};

const OPEN = {
  open:
    "A word find: a traced word drops into its own slot in the crossword and any other real word goes in the jar, so " +
    "the player finds words rather than reasoning out one fill (most crosswords built from one wheel allow other fills).",
};

export const LETTERWHEEL_LEVELS: GameLevels<LetterWheelLevelSettings> | null = {
  levels: {
    easy: { settings: { timeLimitMs: 120_000 }, oneSolution: OPEN },
    hard: { settings: { timeLimitMs: 75_000 }, oneSolution: OPEN },
    expert: { settings: { timeLimitMs: 80_000 }, oneSolution: OPEN },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const LETTERWHEEL_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "Six letters on the wheel, a smaller crossword, and 120 seconds.",
  hard: "A bigger crossword with 12 to 15 words to find, and 75 seconds.",
  expert: "The biggest crossword, with 16 to 19 words to find, and 80 seconds.",
};
