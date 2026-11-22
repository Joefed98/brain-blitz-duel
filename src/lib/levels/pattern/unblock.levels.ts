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
    // D4 (22 Nov 2026; the spec's Gridlock row): Easy a half-empty lot, 6–8 cars, 5–9 moves at the minimum.
    easy: { settings: { cols: 6, minMoves: [5, 9], cars: [6, 8], timeLimitMs: 60_000, speedFullByS: 40 }, oneSolution: OPEN },
    // Hard: Normal's 7×7 lot, 22–30 moves at the minimum, 12–14 cars, 60 s; full speed by 28 s (about a second a
    // move along the line: the step up from Normal is seeing the longer line, then playing it briskly).
    // D4: Hard a fuller lot (13–15 cars) and a longer line (26–32 moves). The spec's 8 × 8 Hard and 9 × 9 Expert wait for
    // the lot renders (lot-8, lot-9, A2's art).
    hard: { settings: { cols: 7, minMoves: [26, 32], cars: [13, 15], timeLimitMs: 60_000, speedFullByS: 28 }, oneSolution: OPEN },
    // Expert (deeper boards, Joe 16 Nov 2026): 7×7, 40–48 moves at the minimum (Hard 22–30, the old Expert 30–40), 13–15
    // cars, 90 s; full speed by 30 s, as before (about 0.7 s a move: only a player who reads the whole line at once).
    // The step up is the line's length, about 16 moves more than Hard's on average, so the clock grows to fit them (a
    // person-like solver's finishes take 42–90 s). The bank climbs each lot to 40 and takes the drawn depth or the
    // lot's hardest, whichever is less (scripts/unblock-levels-bank.ts).
    expert: { settings: { cols: 7, minMoves: [40, 48], cars: [13, 15], timeLimitMs: 90_000, speedFullByS: 30 }, oneSolution: OPEN },
  },
};
