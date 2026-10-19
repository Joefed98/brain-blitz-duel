/**
 * The shared puzzle helper (20 Oct 2026, `puzzleScoreRev: 3`; docs/scoring-report-oct-2026.md section 3,
 * docs/scoring-targets.md). Every finish puzzle scores on one formula instead of rev 2's per-game knots:
 *
 *   unfinished = min(110, round(110 × progress ÷ oneShort))
 *   finished   = 120 + round(30 × min(1, time left share ÷ fastShare) × efficiency)
 *
 *   - progress (0–1) is the game's own measure of what is done (puzzleProgress.ts: rev 1's unfinished credit
 *     ÷ 110, or the batch-1 fixes: Slider's row scale, Trail's tiles, scales and jugs with credit inside the
 *     current step, solver distance on the move puzzles…);
 *   - oneShort is the progress a board one action short of solved holds (a constant per game, measured by
 *     scripts/scoring-report.ts on 15 room seeds), so one short scores 110 and half done about 55;
 *   - fastShare is the share of the clock a fast, clean human leaves (the near-perfect kit player's 75th
 *     percentile, clamped to 0.40–0.75): finishing with that much left and no mistakes is 150;
 *   - efficiency (0–1) is the game's own mistake measure (wasted moves, tries, strikes, wrong taps) from the
 *     rev-1 breakdown. Mistakes only scale the 30 speed points, so a correct finish never scores below 120.
 *
 * Open games (Nucleus, Forage, Flash, Bang On, Ballpark) keep rev 2's curves under this stamp. Older rounds
 * keep their stamps and grade exactly as before. Server-only arithmetic on the grader's own figures.
 */
import { speedBonusCurve } from "./speedPar";
import { PUZZLE_EFFICIENCY_POINTS, PUZZLE_FINISH_BASE, PUZZLE_UNFINISHED_CAP, type ScoreParts } from "./puzzleScoreRev";
import { REV2_FINISH_GAMES } from "./puzzleScoreRev2";
import type { PuzzleType } from "./types";

export const PUZZLE_SCORE_REV_HELPER = 3;
export const REV3_FINISH_EXTRA = 30;
/** fastShare is clamped to this range (Joe, 20 Oct 2026). */
export const REV3_FAST_MIN = 0.4;
export const REV3_FAST_MAX = 0.75;

export interface Rev3Game {
  /** Share of the clock a fast, clean finish leaves (150 from there). */
  fastShare: number;
  /** Progress a board one action short of solved holds (one short = 110). */
  oneShort: number;
}

/**
 * Per game: fastShare from the scoring report's near-perfect kit (clamped), oneShort measured on the rev-3
 * progress measures by scripts/scoring-report.ts (the median one-short progress over 15 room seeds).
 */
const RAW: Record<string, [fast: number, oneShort: number]> = {
  // Cryptogrid: re-measured on codewordRev 3's six starting letters (30 room seeds, 20 Oct 2026): 0.77, five gave 0.75.
  codeword: [0.77, 1],
  tilegrid: [0.72, 14 / 15],
  wordsearch: [0.78, 1],
  letterwheel: [0.51, 0.97],
  wordslide: [0.9, 1],
  strikeout: [0.74, 1],
  swapword: [0.79, 1],
  measure: [0.66, 0.97],
  checkout: [0.58, 0.91],
  balance: [0.59, 0.99],
  target: [0.79, 1],
  numpyramid: [0.29, 0.98],
  equation: [0.7, 0.94],
  trail: [0.66, 0.96],
  numhunt: [0.7, 1],
  chain: [0.53, 1],
  spotdiff: [0.69, 1],
  symscan: [0.55, 0.97],
  maze: [0.48, 0.99],
  pairmatch: [0.72, 0.946],
  countup: [0.72, 0.86],
  flow: [0.61, 0.92],
  unblock: [0.68, 0.94],
  push: [0.64, 0.93],
  tiles: [0.78, 0.96],
  laser: [0.63, 1],
  pipes: [0.49, 0.95],
  iceslide: [0.63, 1],
  blockparty: [0.59, 1],
  gravity: [0.69, 0.92],
  rings: [0.77, 0.86],
  lightsout: [0.66, 0.92],
  bomb: [0.8, 1],
  sudoku: [0.59, 0.95],
  flood: [0.73, 0.97],
  tower: [0.69, 0.97],
  lightup: [0.64, 1],
  nonogram: [0.78, 0.96],
  tubes: [0.67, 0.96],
  safe: [0.74, 1],
  shikaku: [0.57, 0.955],
  tents: [0.66, 1],
};

export const REV3_GAMES: Partial<Record<PuzzleType, Rev3Game>> = Object.fromEntries(
  Object.entries(RAW).map(([type, [fast, oneShort]]) => [
    type,
    { fastShare: Math.min(REV3_FAST_MAX, Math.max(REV3_FAST_MIN, fast)), oneShort },
  ]),
);

/** Finish puzzles graded by the helper under puzzleScoreRev 3 (rev 2's finish games). */
export function rev3Applies(type: PuzzleType): boolean {
  return REV2_FINISH_GAMES.has(type) && REV3_GAMES[type] !== undefined;
}

export function rev3Game(type: PuzzleType): Rev3Game {
  return REV3_GAMES[type] ?? { fastShare: 0.6, oneShort: 1 };
}

/** Unfinished points for a progress share (0–1). */
export function rev3UnfinishedScore(type: PuzzleType, progress: number): number {
  const p = clamp(progress, 0, 1);
  const one = Math.max(0.05, rev3Game(type).oneShort);
  return Math.max(0, Math.min(PUZZLE_UNFINISHED_CAP, Math.round((PUZZLE_UNFINISHED_CAP * p) / one)));
}

/** Speed points (0–30) for a finish with `left` (0–1) of the clock left and `efficiency` (0–1). */
export function rev3SpeedPoints(type: PuzzleType, left: number, efficiency: number): number {
  const fast = rev3Game(type).fastShare;
  const t = Math.min(1, clamp(left, 0, 1) / fast);
  return Math.round(REV3_FINISH_EXTRA * t * clamp(efficiency, 0, 1));
}

/** Seconds a finish with no mistakes must leave on the clock for 150 ("finish in about N s"). */
export function rev3FastFinishSeconds(type: PuzzleType, limitMs: number): number {
  return Math.round((limitMs * (1 - rev3Game(type).fastShare)) / 1000);
}

/**
 * The finish's efficiency share from the rev-1 breakdown: the game's efficiency part (moves, tries, strikes…)
 * as a share of its 15, times any penalty the rev-1 speed part took (wrong taps), times the share of the
 * 120 base a finish scored on accuracy (Ascend's wrong taps). 1 when the game measures none of these.
 */
export function rev3Efficiency(parts: ScoreParts | null, msRemaining: number, limitMs: number): number {
  if (!parts || parts.kind !== "finish") return 1;
  const hasEff = parts.efficiency !== undefined;
  const speedMax = hasEff ? REV3_FINISH_EXTRA - PUZZLE_EFFICIENCY_POINTS : REV3_FINISH_EXTRA;
  const expected = limitMs > 0 ? speedBonusCurve(speedMax, clamp(msRemaining, 0, limitMs), limitMs) : 0;
  const kept = expected > 0 && parts.speed !== undefined ? clamp(parts.speed / expected, 0, 1) : 1;
  const baseShare = parts.base < PUZZLE_FINISH_BASE ? clamp(parts.base / PUZZLE_FINISH_BASE, 0, 1) : 1;
  const eff = hasEff ? clamp(parts.efficiency! / PUZZLE_EFFICIENCY_POINTS, 0, 1) : 1;
  return eff * kept * baseShare;
}

export interface Rev3Grade {
  score: number;
  parts: ScoreParts;
  /** Unfinished: the progress share; finished: the time share and efficiency. */
  progress?: number;
  time?: number;
  efficiency?: number;
}

/** A finished run: 120 + speed points. The breakdown reads "120 + N speed". */
export function rev3Finish(type: PuzzleType, msRemaining: number, limitMs: number, efficiency: number): Rev3Grade {
  const left = limitMs > 0 ? clamp(msRemaining, 0, limitMs) / limitMs : 0;
  const speed = rev3SpeedPoints(type, left, efficiency);
  return {
    score: PUZZLE_FINISH_BASE + speed,
    parts: { kind: "finish", base: PUZZLE_FINISH_BASE, speed },
    time: round3(left),
    efficiency: round3(clamp(efficiency, 0, 1)),
  };
}

/** An unfinished run: 110 × progress ÷ oneShort, at most 110. */
export function rev3Unfinished(type: PuzzleType, progress: number): Rev3Grade {
  const score = rev3UnfinishedScore(type, progress);
  return { score, parts: { kind: "partial", base: score }, progress: round3(clamp(progress, 0, 1)) };
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}
