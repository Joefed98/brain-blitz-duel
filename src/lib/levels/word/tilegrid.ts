import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Interlock's levels (the Word overhaul, stage 3, 15 Nov 2026; docs/design/game-reviews/word.md). Plain data only: the
 * phone reads it to draw the level switch, the server to deal (src/lib/duel/levels/tilegrid.server.ts). Normal is today's
 * game (an H of three common 4–7 letter words, fifteen tiles, 100 s).
 *
 * Every level keeps the fifteen tiles and the H; what changes is how the words cross and the clock. Easy's two down words
 * cross the across word at their first letters (the across word's letters start each down word, the easiest crossing to
 * spot); Hard's across word is seven letters and each down word crosses it away from both its ends; Expert adds that the
 * two down words never start or end on the crossing and the crossings sit inside the across word, on a shorter clock.
 * Any grid of real words that uses every tile counts as a finish, so the game is open by design.
 */
export interface TileGridLevelSettings {
  /** The across word's length, when the level fixes it. */
  acrossLen?: number;
  /** Where each down word may cross: at its first letter, or away from both its ends. */
  cross: "start" | "inside";
  /** Keep the crossings off the across word's first and last letters. */
  innerAcross?: boolean;
  timeLimitMs: number;
}

const OPEN = { open: "Any grid of real words that uses every tile finishes the board, so there is no single answer to prove." } as const;

export const TILEGRID_LEVEL_SETTINGS: Readonly<Record<Exclude<Level, "normal">, TileGridLevelSettings>> = {
  easy: { cross: "start", timeLimitMs: 120_000 },
  hard: { acrossLen: 7, cross: "inside", timeLimitMs: 60_000 },
  expert: { acrossLen: 7, cross: "inside", innerAcross: true, timeLimitMs: 50_000 },
};

export const TILEGRID_LEVELS: GameLevels | null = {
  levels: {
    easy: { settings: { ...TILEGRID_LEVEL_SETTINGS.easy }, oneSolution: OPEN },
    hard: { settings: { ...TILEGRID_LEVEL_SETTINGS.hard }, oneSolution: OPEN },
    expert: { settings: { ...TILEGRID_LEVEL_SETTINGS.expert }, oneSolution: OPEN },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const TILEGRID_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "The two down words start on the across word, with 120 seconds.",
  hard: "A 7-letter across word, crossed in the middle of the down words, with 60 seconds.",
  expert: "The crossings hide in the middle of every word, with 50 seconds.",
};
