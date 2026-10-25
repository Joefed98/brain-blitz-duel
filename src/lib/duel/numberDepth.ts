/**
 * Number puzzles to 200 (25 Oct 2026, `depthRev 1`; docs/depth/d2-number.md, docs/scoring-200.md).
 *
 * Eight Number puzzles score to 200 on rounds stamped `depthRev: 1` (Tenfall reaches 200 through its own sim,
 * `tenRev 4`). Every older round keeps its stamps and scores exactly as before: this layer only runs on a
 * depth-stamped puzzle, on top of the grade puzzleScoreRev 3 (or Ballpark's rev-2 curve) already gave it.
 *
 * Two routes:
 *   - STRETCH (Counterweight, Operator, Integer Pyramid, Trail): the game is unchanged. Unfinished and every
 *     finish up to today's 150 pace score exactly as puzzleScoreRev 3 (120 + 30 × min(1, left ÷ fast) ×
 *     efficiency). Beyond the fast share, a convex stretch adds up to 50: 50 × x² × efficiency², with
 *     x = (left − fast) ÷ (elite − fast). A clean finish at today's 150 pace lands 150–165; only a finish leaving
 *     the elite share of the clock with no mistakes reaches 200.
 *   - FEATURES (Exact's elegance, Brimful's par pours, Checkout's big finish): the 150 part is puzzleScoreRev 3's;
 *     the extra 50 comes only from the feature, earned in full at the fast share of the clock:
 *     50 × feature share × min(1, left ÷ fast)². A solid finish without the feature scores as today.
 *   - Ballpark (STRETCH + bullseye streak): rev 2's score (≤ 150), plus up to 20 for finishing faster than the
 *     full-speed point (half the clock) on close placements, plus up to 30 for runs of placements within a hair
 *     of exact (the streak).
 *
 * Shared, pure and the same on every phone and the server (the phone reads it for the feature lines and the
 * live streak; the server grades with numberDepth.server.ts). Floats only in display helpers; scores are
 * rounded integers.
 */
import { dealtPuzzleScoreRev } from "./puzzleScoreRev";
import type { PuzzleType } from "./types";

/** The depth stamp new Number puzzles are dealt (on puzzleScoreRev 3). */
export const NUMBER_DEPTH_REV = 1;
/** The round maximum on the depth stamp (ROUND_MAX's 200 for these games). */
export const NUMBER_DEPTH_MAX = 200;
/** The points above today's 150 a depth round can add. */
export const NUMBER_DEPTH_EXTRA = 50;

export type DepthRoute = "stretch" | "feature" | "open";

export interface DepthGame {
  route: DepthRoute;
  /**
   * Share of the clock an elite finish leaves (stretch: 200 from there with no mistakes). Measured from the
   * kit players (scripts/number-depth-bands.ts): clearly faster than the near-perfect player's 150 pace.
   */
  elite?: number;
}

export const NUMBER_DEPTH_GAMES: Readonly<Partial<Record<PuzzleType, DepthGame>>> = {
  balance: { route: "stretch", elite: 0.695 },
  equation: { route: "stretch", elite: 0.79 },
  numpyramid: { route: "stretch", elite: 0.505 },
  trail: { route: "stretch", elite: 0.765 },
  target: { route: "feature" },
  measure: { route: "feature" },
  checkout: { route: "feature" },
  numline: { route: "open", elite: 0.81 },
};

export function isNumberDepthType(type: PuzzleType | string | null | undefined): boolean {
  return !!type && type in NUMBER_DEPTH_GAMES;
}

/** The stored puzzle's depth stamp (0 = before depth). */
export function depthRevOf(puzzle: unknown): number {
  const rev = (puzzle as { depthRev?: number } | null)?.depthRev;
  return typeof rev === "number" && Number.isFinite(rev) ? rev : 0;
}

let depthPinnedOff = false;
/**
 * Checks that prove rounds dealt before depthRev 1 (their numbers are puzzleScoreRev 3's 150 shape) pin new
 * puzzles to that shape, as pinDealtPuzzleScoreRev does for older score revisions. Never called by app code.
 */
export function pinNumberDepth(off: boolean): void {
  depthPinnedOff = off;
}

/** True when new Number puzzles are dealt on the depth stamp (puzzleScoreRev 3 and not pinned by a check). */
export function numberDepthDealt(): boolean {
  return !depthPinnedOff && dealtPuzzleScoreRev() >= 3;
}

/** True when this stored round scores to 200 (a Number puzzle stamped depthRev ≥ 1). */
export function usesNumberDepth(puzzle: unknown): boolean {
  const type = (puzzle as { type?: string } | null)?.type;
  return isNumberDepthType(type) && depthRevOf(puzzle) >= NUMBER_DEPTH_REV;
}

/* ------------------------------------------------------------------ the curves */

/**
 * Stretch points (0–50) for a finish leaving `left` (0–1) of the clock with `efficiency` (0–1), beyond the
 * game's fast share (`fast`, puzzleScoreRev 3's) up to its elite share. Convex, so today's 150 pace gains little.
 */
export function depthStretchPoints(left: number, fast: number, elite: number, efficiency: number): number {
  const span = Math.max(0.01, elite - fast);
  const x = clamp01((clamp01(left) - fast) / span);
  const e = clamp01(efficiency);
  return Math.round(NUMBER_DEPTH_EXTRA * x * x * e * e);
}

/** Feature points (0–50): the feature's share, earned in full with the game's fast share of the clock left. */
export function depthFeaturePoints(share: number, left: number, fast: number): number {
  const t = clamp01(clamp01(left) / Math.max(0.01, fast));
  return Math.round(NUMBER_DEPTH_EXTRA * clamp01(share) * t * t);
}

/* ------------------------------------------------------------------ Exact: elegance */

/** Exact on the depth stamp: the target always has a five-number answer (and never one with four or fewer). */
export const EXACT_ELEGANT_TILES = 5;

/* ------------------------------------------------------------------ Checkout: the big finish */

/** True when this dart is a big finish on the stage: the Bull, or a treble where the stage finishes on a double. */
export function isBigFinishDart(stageFinish: number, dart: { wedge: number; ring: number }, bull = 20): boolean {
  if (dart.wedge === bull) return dart.ring === 2;
  return dart.ring === 3 && stageFinish !== 3;
}

/* ------------------------------------------------------------------ Ballpark: the bullseye streak */

/** A placement within this share of the line (0.5 %, half rev 2's full-points 1 %) is a bullseye. */
export const BALLPARK_HAIR = 0.005;
/** Each bullseye adds the streak's length so far, up to this. */
export const BALLPARK_STREAK_STEP_CAP = 4;
/** The streak sum of fifteen bullseyes in a row (1 + 2 + 3 + 4 × 12). */
export const BALLPARK_STREAK_FULL = 54;
export const BALLPARK_STREAK_POINTS = 30;
export const BALLPARK_SPEED_POINTS = 20;
/** Ballpark's full-speed point (rev 1's par curve: half the clock left). */
export const BALLPARK_FAST = 0.5;

export function isBullseye(error: number | null | undefined): boolean {
  return typeof error === "number" && Number.isFinite(error) && error <= BALLPARK_HAIR;
}

/** The running streak after each placement (0 after a miss) and the streak sum the bonus reads. */
export function ballparkStreak(errors: readonly (number | null | undefined)[]): { runs: number[]; sum: number; best: number } {
  let run = 0;
  let sum = 0;
  let best = 0;
  const runs: number[] = [];
  for (const error of errors) {
    if (isBullseye(error)) {
      run += 1;
      sum += Math.min(run, BALLPARK_STREAK_STEP_CAP);
    } else run = 0;
    best = Math.max(best, run);
    runs.push(run);
  }
  return { runs, sum, best };
}

/** Streak points (0–30) for a streak sum. */
export function ballparkStreakPoints(sum: number): number {
  return Math.round((BALLPARK_STREAK_POINTS * Math.max(0, Math.min(BALLPARK_STREAK_FULL, sum))) / BALLPARK_STREAK_FULL);
}

/** Speed stretch (0–20): a finish beyond the full-speed point, scaled by the share of close placements. */
export function ballparkSpeedPoints(left: number, close: number): number {
  const elite = NUMBER_DEPTH_GAMES.numline?.elite ?? 0.75;
  const x = clamp01((clamp01(left) - BALLPARK_FAST) / Math.max(0.01, elite - BALLPARK_FAST));
  return Math.round(BALLPARK_SPEED_POINTS * x * x * clamp01(close));
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
