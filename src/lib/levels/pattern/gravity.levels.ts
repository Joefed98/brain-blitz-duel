/**
 * Topsy-Turvy's (gravity) levels beyond Normal (the Pattern overhaul, stage 3, 16 Nov 2026;
 * docs/design/difficulty/README.md). Plain data only: the phone reads it to draw the level selector and each board's
 * par (topsy.ts `topsyBoardPar`), the server's deal (topsy.server.ts `generateTopsyLevel`) and
 * scripts/topsy-levels-bank.ts read the settings.
 *
 * Normal is today's game exactly: three 10 × 10 boards of six balls, each board's fewest tilts 4–7, a tilt limit of the
 * fewest + 8 (gravityRev 8), 120 s, full speed by 32 s. The other levels deal from their own seeded, rebuildable bank
 * (src/lib/duel/topsyLevelsBank.server.ts, `bun scripts/topsy-levels-bank.ts [--check]`), every board's fewest tilts
 * proved by breadth-first search over every ball's square (scripts/pattern-overhaul-gravity-levels-check.ts re-proves
 * each one every run). Every level keeps the 10 × 10 board (squares about 33 px on a 375 px phone, as Normal's), the
 * 120 s clock and gravityRev 8's rules (a ball home blocks; Undo and Reset give the tilts back).
 *
 * Topsy-Turvy accepts any tilt list that gets every ball home, so no level has a single answer: each board's minimum
 * (its par) is what is proved.
 */
import type { GameLevels } from "../gameLevels";

export type TopsyLevelSettings = {
  /** Balls on each board (each with its own cup in its colour and mark). More = more to plan with every tilt. */
  balls: number;
  /** Boards in the round, played one after another. */
  boards: number;
  /** Each board's fewest tilts to get every ball home, lowest and highest (proved by breadth-first search). */
  minTilts: readonly [number, number];
  /** Blocks on each board, fewest and most (Normal's 14–22). */
  walls: readonly [number, number];
  /** A board's tilt limit is its fewest tilts + this (Normal: 8). Fewer spare = less room to explore. */
  spare: number;
  /** The round's clock (every level keeps Normal's 120 s). */
  timeLimitMs: number;
  /** Speed points are full when the round is cleared within this many seconds (Normal: 32). */
  speedFullByS: number;
  /**
   * Keep only boards the person-like solver clears within the tilt limit (scripts/topsy-human.ts: each ball's own line
   * home, three tilts imagined ahead with every ball rolling, no search). Expert's proof that it is humanly solvable.
   */
  personSolvable?: boolean;
};

const OPEN = { open: "any tilt sequence that homes every ball counts; each board's minimum is proved by BFS" } as const;

export const LEVELS_GRAVITY: GameLevels<TopsyLevelSettings> = {
  levels: {
    // Easy: two boards of three balls, each board 2–4 tilts at the fewest, a generous limit (the fewest + 12), full
    // speed by 20 s.
    easy: { settings: { balls: 3, boards: 2, minTilts: [2, 4], walls: [14, 22], spare: 12, timeLimitMs: 120_000, speedFullByS: 20 }, oneSolution: OPEN },
    // Hard: three boards of six balls, 6–9 tilts at the fewest, a limit of the fewest + 6, full speed by 30 s (Joe, 16
    // Nov 2026: was 45 s, which sat Hard barely below Normal; 30 s is under Normal's 32 s for more tilts, so the speed
    // points ask for quicker play per tilt than Normal does. Grading: speed is full when the round is cleared within
    // this time, so a lower time is the harder one).
    // D4 (22 Nov 2026; the spec's Topsy-Turvy row): seven balls (today six, the same as Normal), the seventh in Expert's
    // lime green, so Hard is visibly busier than Normal; the limit and the fewest tilts as before.
    hard: { settings: { balls: 7, boards: 3, minTilts: [6, 9], walls: [14, 22], spare: 6, timeLimitMs: 120_000, speedFullByS: 30 }, oneSolution: OPEN },
    // Expert: three boards of eight balls (two more colours: lime green with a heart, pearl white with a crescent),
    // 7–10 tilts at the fewest, a limit of the fewest + 5, full speed by 30 s (50 s until 16 Nov 2026: with Hard at 30 s, Expert must not score easier); every board one the person-like solver
    // clears inside its limit.
    expert: { settings: { balls: 8, boards: 3, minTilts: [7, 10], walls: [14, 22], spare: 5, timeLimitMs: 120_000, speedFullByS: 30, personSolvable: true }, oneSolution: OPEN },
  },
};
