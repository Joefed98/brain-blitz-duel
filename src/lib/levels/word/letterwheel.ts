import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Roundabout's levels (the Word overhaul, stage 3, 15 Nov 2026; docs/design/game-reviews/word.md). Plain data only: the
 * phone reads it to draw the level switch, the server to deal (src/lib/duel/levels/letterwheel.server.ts). Normal is
 * today's game (a 7-letter wheel, 11–14 crossword words in at most 11 × 9, 100 s).
 *
 * Each level deals from its own bank (scripts/letter-wheel-bank.ts --level=…, LW_LEVEL_LIMITS in letterWheel.ts): Easy
 * a 6-letter wheel and 7–9 words; Hard a 7-letter wheel and 16–19 words in up to 9 × 12; Expert an 8-letter wheel and
 * 20–24 words in up to 10 × 13 (D1, 21 Nov 2026).
 */
export type LetterWheelLevelSettings = {
  timeLimitMs: number;
  /** Misses that cost nothing (stored on the puzzle as `freeMisses`; Normal's 5 when absent). */
  freeMisses?: number;
};

const OPEN = {
  open:
    "A word find: a traced word drops into its own slot in the crossword and any other real word goes in the jar, so " +
    "the player finds words rather than reasoning out one fill (most crosswords built from one wheel allow other fills).",
};

export const LETTERWHEEL_LEVELS: GameLevels<LetterWheelLevelSettings> | null = {
  levels: {
    // D1 (21 Nov 2026; difficulty-spec.md "Roundabout"): Hard deals the 15 Nov Expert boards (16–19 words) on 95 s with 3
    // free misses; Expert an 8-letter wheel and 20–24 words on 70 s with 2 (LW_LEVEL_LIMITS, letterWheel.ts).
    easy: { settings: { timeLimitMs: 120_000 }, oneSolution: OPEN },
    hard: { settings: { timeLimitMs: 95_000, freeMisses: 3 }, oneSolution: OPEN },
    expert: { settings: { timeLimitMs: 70_000, freeMisses: 2 }, oneSolution: OPEN },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const LETTERWHEEL_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "Six letters on the wheel, a smaller crossword, and 120 seconds.",
  hard: "A bigger crossword with 16 to 19 words to find, 3 free misses and 95 seconds.",
  expert: "Eight letters on the wheel, 20 or more words, 2 free misses and 70 seconds.",
};
