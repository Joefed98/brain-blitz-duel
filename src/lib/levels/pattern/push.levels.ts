/**
 * Heave (push)'s levels beyond Normal (the Pattern overhaul, stage 3, 16 Nov 2026; docs/design/difficulty/README.md).
 * Plain data only: the phone reads it to draw the level selector and to know whether the stuck hint is on; the bank
 * build (scripts/push-levels-bank.ts) reads it to build and prove each level's warehouses; the deal
 * (depth4/deal.server.ts → pushLevels.server.ts) draws a level's board from that bank by the room seed.
 *
 * Normal (no entry) is today's game: the depth-batch-4 bank (pushD4Bank.server.ts), five crates, 18–27 pushes, a gold
 * crate, 120 s, full speed by 45 s; it gets the stuck hint (PUSH_NORMAL_STUCK_HINT below), which is display only.
 *
 * Levers, one per setting (every level keeps the 9 × 9 warehouse, so every board fits as Normal's does: ≈ 39 px a cell
 * on a 375 px phone, the size Normal has always had):
 *   crates        how many crates (and marks);
 *   pushes        the board's minimum push count, proved by the bank's backward search (its depth IS the minimum);
 *   innerWalls    how many wall squares are dropped inside the outer wall (more walls = a tighter warehouse with
 *                 fewer ways round, and a search small enough to reach deep minimums);
 *   perCrate      every crate is pushed at least this many times in the stored minimum solution (no scenery crates);
 *   detour        somewhere in the stored minimum solution a crate is pushed away from the mark it ends on (never a
 *                 straight shove);
 *   stuckHint     the deadlock hint: a crate pushed onto a square from which it can never reach a mark tints and
 *                 plays push.stuck (display only; never changes a move, a push or the grade);
 *   speedFullByS  speed points full when the warehouse is cleared within this many seconds of play (Normal: 45);
 *   timeLimitMs   the round's clock (every level 120 s, Heave's own clock).
 *
 * Heave counts any push sequence that homes every crate, so it is not a one-answer game; each board's minimum is
 * proved instead (pattern-overhaul-push-levels-check re-solves every bank board forwards and matches its minimum).
 */
import type { GameLevels } from "../gameLevels";

export type PushLevelSettings = {
  crates: number;
  pushes: { min: number; max: number };
  innerWalls: { min: number; max: number };
  perCrate: number;
  detour: boolean;
  stuckHint: boolean;
  speedFullByS: number;
  timeLimitMs: number;
};

/** Normal (today's deal, no entry) shows the stuck hint too (Joe's spec, 16 Nov 2026; display only, no stamp). */
export const PUSH_NORMAL_STUCK_HINT = true;

const OPEN = { open: "any push sequence that homes every crate counts; the minimum is proved by solver" } as const;

export const LEVELS_PUSH: GameLevels<PushLevelSettings> = {
  levels: {
    // Easy: three crates, 8–14 pushes, an open warehouse, no detour asked for, the stuck hint on.
    easy: {
      settings: {
        crates: 3,
        pushes: { min: 8, max: 14 },
        innerWalls: { min: 4, max: 9 },
        perCrate: 2,
        detour: false,
        stuckHint: true,
        speedFullByS: 30,
        timeLimitMs: 120_000,
      },
      oneSolution: OPEN,
    },
    // Hard: Normal's five crates, 25–32 pushes, the detour kept, no stuck hint.
    // D4 (22 Nov 2026; the spec's Heave row): the crates climb 3, 5, 6, 7 (Hard today showed Normal's five), the push
    // minimum rising behind them, between tighter walls. Hard full speed by 61 s, set from the elite's finishes under
    // the human limits (at Normal's 45 s the elite reached 200 on 1 % of six-crate boards).
    hard: {
      settings: {
        crates: 6,
        pushes: { min: 28, max: 36 },
        innerWalls: { min: 6, max: 12 },
        perCrate: 3,
        detour: true,
        stuckHint: false,
        speedFullByS: 61,
        timeLimitMs: 120_000,
      },
      oneSolution: OPEN,
    },
    // Expert: six crates, 30–40 pushes, the detour kept, no stuck hint. D4: seven crates, 38–48 pushes, full speed by
    // 81 s (the elite's finishes under the human limits over the whole bank: a third at 200).
    expert: {
      settings: {
        crates: 7,
        pushes: { min: 38, max: 48 },
        innerWalls: { min: 8, max: 14 },
        perCrate: 3,
        detour: true,
        stuckHint: false,
        speedFullByS: 81,
        timeLimitMs: 120_000,
      },
      oneSolution: OPEN,
    },
  },
};
