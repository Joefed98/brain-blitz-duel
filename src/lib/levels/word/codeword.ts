import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Cryptogrid's levels (the Word overhaul, stage 3, 15 Nov 2026; docs/design/game-reviews/word.md). Plain data only: the phone
 * reads it to draw the level switch, the server to deal (src/lib/duel/levels/codeword.server.ts). Normal is today's game.
 */
export const CODEWORD_LEVELS: GameLevels | null = null;

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const CODEWORD_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {};
