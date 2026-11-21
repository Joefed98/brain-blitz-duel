import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Interlock's levels (the Word overhaul, stage 3, 15 Nov 2026; redesigned by D1, 21 Nov 2026: difficulty-spec.md
 * "Interlock"). Plain data only: the phone reads it to draw the level switch, the server to deal
 * (src/lib/duel/levels/tilegrid.server.ts) and the bank script to build each level's boards
 * (scripts/tilegrid-level-bank.ts). Normal is today's game (an H of three common 4–7 letter words, fifteen tiles on the
 * 7 × 7 board, 100 s).
 *
 * Tiles in the tray are the ladder (10, 15, 19, 23), each on a board sized for it: Easy two crossing everyday words of 5
 * and 6 letters on 6 × 6; Hard four crossing words of 5–6 letters on 8 × 8; Expert five on 9 × 9, its words lit and bad
 * runs shown only on Done. Every level deals tileGridRev 5 (the size and tile count stored on the puzzle) from its bank,
 * boards the person-like builder (scripts/tilegrid-human.ts, never sees the answer) finishes inside the clock; Expert's
 * only where that builder's line, timed at the human limits, scores 200. Any grid of real words that uses every tile
 * counts as a finish, so the game is open by design.
 */
export interface TileGridLevelSettings {
  /** The board's side (stored on the puzzle as `size`). */
  size: number;
  /** Tiles in the tray (stored as `tiles`). */
  tiles: number;
  /** The crossing words' lengths (their sum, less one shared letter a crossing, is `tiles`). */
  lengths: readonly number[];
  /** Words light and bad runs show only on Done (stored as `lightsOnDone`). */
  lightsOnDone?: boolean;
  timeLimitMs: number;
}

const OPEN = { open: "Any grid of real words that uses every tile finishes the board, so there is no single answer to prove." } as const;

export const TILEGRID_LEVEL_SETTINGS: Readonly<Record<Exclude<Level, "normal">, TileGridLevelSettings>> = {
  easy: { size: 6, tiles: 10, lengths: [5, 6], timeLimitMs: 120_000 },
  hard: { size: 8, tiles: 19, lengths: [5, 5, 6, 6], timeLimitMs: 90_000 },
  expert: { size: 9, tiles: 23, lengths: [5, 5, 5, 6, 6], lightsOnDone: true, timeLimitMs: 70_000 },
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
  easy: "Ten tiles and two crossing words on a small 6 by 6 board, with 120 seconds.",
  hard: "Nineteen tiles and four crossing words on an 8 by 8 board, with 90 seconds.",
  expert: "Twenty-three tiles on a 9 by 9 board, words checked only on Done, and 70 seconds.",
};
