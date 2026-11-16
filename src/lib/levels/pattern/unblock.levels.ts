/**
 * Gridlock's (unblock) levels beyond Normal (the Pattern overhaul, stage 3; docs/design/difficulty/README.md). Plain
 * data only: the phone reads it to draw the level selector, the server to deal and scripts/unblock-levels-bank.ts to
 * build each level's bank.
 *
 * Normal is today's game exactly: a 7×7 lot from the unblock_bank table (15–22 moves at the minimum, 10–13 cars
 * besides the gold one, 60 s). The other levels deal from their own seeded, rebuildable bank
 * (src/lib/duel/unblockLevelsBank.server.ts, `bun scripts/unblock-levels-bank.ts [--check]`), every board's minimum
 * proved by breadth-first search over its whole reachable lot (scripts/pattern-overhaul-unblock-levels-check.ts
 * re-proves them).
 *
 * Gridlock accepts any route out, so no level has a single answer: the stored minimum (the par) is what is proved.
 */
import type { GameLevels } from "../gameLevels";

export type UnblockLevelSettings = {
  /** The lot's size, columns and rows (the exit is always on the third row). Smaller = fewer places to go. */
  cols: number;
  /** The fewest moves the board can be solved in, lowest and highest (a move slides one car any distance). */
  minMoves: readonly [number, number];
  /** Cars and lorries besides the gold car, fewest and most. More = a busier lot. */
  cars: readonly [number, number];
  /** The round's clock. */
  timeLimitMs: number;
  /** Speed points are full when the board is solved within this many seconds (Normal: 40). */
  speedFullByS: number;
};

const OPEN = { open: "any route out counts; the minimum is proved by BFS" } as const;

export const LEVELS_UNBLOCK: GameLevels<UnblockLevelSettings> = {
  levels: {
    // Easy: a 6×6 lot (squares about 53 px on a 375 px phone), 6–12 moves at the minimum, 8–10 cars, 60 s; full speed
    // by Normal's 40 s.
    easy: { settings: { cols: 6, minMoves: [6, 12], cars: [8, 10], timeLimitMs: 60_000, speedFullByS: 40 }, oneSolution: OPEN },
    // Hard: Normal's 7×7 lot, 22–30 moves at the minimum, 12–14 cars, 60 s; full speed by 28 s (about a second a
    // move along the line: the step up from Normal is seeing the longer line, then playing it briskly).
    hard: { settings: { cols: 7, minMoves: [22, 30], cars: [12, 14], timeLimitMs: 60_000, speedFullByS: 28 }, oneSolution: OPEN },
    // Expert: 7×7, 30–40 moves at the minimum, 13–15 cars, 75 s; full speed by 30 s (so the longer clock never scores
    // Expert above Hard: elite bots 192 Expert against 196 Hard, level-tune.ts, 16 Nov 2026).
    expert: { settings: { cols: 7, minMoves: [30, 40], cars: [13, 15], timeLimitMs: 75_000, speedFullByS: 30 }, oneSolution: OPEN },
  },
};
