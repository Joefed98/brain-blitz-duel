/**
 * Counterweight's levels (Number overhaul stage 3, 15 Nov 2026; docs/number-overhaul.md "Stage 3"). Joe's decision
 * for this game: today's game becomes Hard exactly (balanceRev 4, dealt as rooms dealt it before levels), and Normal,
 * Easy and Expert are new deals on `balanceRev 5` (BALANCE_REV_LEVELS): Normal gentler than today, Easy gentler still,
 * Expert harder with the balance readout hidden. Rated play and the Daily deal Normal, so they get the new Normal.
 *
 * balanceRev 5 plays and grades as balanceRev 4 (free moves, only hangs from the tray count, the same graders); the
 * deal carries everything that differs: its scales (any notch count of 6, 8 or 10), its own `placeLimits` and, at
 * Expert, `hideBalance`. Shared and plain (the stage reads it); the deal is balanceLevels.server.ts.
 */
import type { BalancePuzzleData } from "./types";

/** The levels' stamp: Normal, Easy and Expert since 15 Nov 2026 (Hard is balanceRev 4, today's game). */
export const BALANCE_REV_LEVELS = 5;

/** One scale of a level: weights to hang, fixed weights, notches, and whether exactly one arrangement balances. */
export interface BalanceLevelScale {
  loose: number;
  fixed: number;
  pegs: 6 | 8 | 10;
  unique: boolean;
  /** The heaviest weight dealt (1–9 by default). */
  maxW?: number;
}

/** A level's settings (GAME_LEVELS `balance`, and BALANCE_NORMAL for Normal). */
export interface BalanceLevelSettings {
  /** Hard: today's game exactly (generateBalance, balanceRev 4). */
  today?: boolean;
  scales?: readonly BalanceLevelScale[];
  /** Hangs allowed beyond the tray, per scale. */
  spare?: readonly number[];
  /** Expert: the balance readout is not shown. */
  hide?: boolean;
  /**
   * Keep only scales the person-like solver (balanceLevels.server.ts personSolveScale) balances within its budget, as
   * Expert always has (D2, 22 Nov 2026: the new Hard too, with the readout shown).
   */
  person?: boolean;
  /** The level's own "full by" time for its speed points, stamped as `speedFullByS` (D2); the game's 60 s without one. */
  fullByS?: number;
}

/**
 * The new Normal (gentler than today's, which is now Hard): four 8-notch scales of 2, 2, 3 and 4 weights, the first
 * three with exactly one balanced arrangement, generous hangs, the balance shown.
 */
export const BALANCE_NORMAL: BalanceLevelSettings = {
  scales: [
    { loose: 2, fixed: 1, pegs: 8, unique: true },
    { loose: 2, fixed: 2, pegs: 8, unique: true },
    { loose: 3, fixed: 2, pegs: 8, unique: true },
    { loose: 4, fixed: 2, pegs: 8, unique: false },
  ],
  spare: [8, 9, 10, 11],
};

/** True when the stage must not show the balance readout (balanceRev 5 at Expert). */
export function balanceHidden(puzzle: Pick<BalancePuzzleData, "hideBalance" | "balanceRev">): boolean {
  return (puzzle.balanceRev ?? 0) >= BALANCE_REV_LEVELS && puzzle.hideBalance === true;
}
