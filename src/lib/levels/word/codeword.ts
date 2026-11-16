import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Cryptogrid's levels (the Word overhaul, stage 3, 15 Nov 2026; docs/design/game-reviews/word.md). Plain data only: the
 * phone reads it to draw the level switch, the server to deal (src/lib/duel/levels/codeword.server.ts). Normal is
 * today's game: six numbers start decoded and the clock is 120 s.
 */
export type CodewordLevelSettings = {
  /** Numbers that start decoded. */
  givens: number;
  /** The round's clock. */
  clockMs: number;
};

const PROOF = { proof: "scripts/codeword-levels-check.ts" };

export const CODEWORD_LEVELS: GameLevels<CodewordLevelSettings> = {
  levels: {
    easy: { settings: { givens: 8, clockMs: 120_000 }, oneSolution: PROOF },
    hard: { settings: { givens: 5, clockMs: 60_000 }, oneSolution: PROOF },
    expert: { settings: { givens: 4, clockMs: 50_000 }, oneSolution: PROOF },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const CODEWORD_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "Eight letters start decoded.",
  hard: "Five letters start decoded, and you have 60 seconds.",
  expert: "Four letters start decoded and you have 50 seconds; every board cracks by reasoning alone.",
};
