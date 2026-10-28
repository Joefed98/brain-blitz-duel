/**
 * The puzzle scoring standard (27 Oct 2026, docs/scoring-standard.md): one scoring shape for 46 puzzles, each on
 * its own new version stamp (stamps.ts). Shared, pure arithmetic: the server grades with it and the help texts
 * quote its numbers.
 *
 *   finished   = 150 + speed + bonus (at most 200; each game splits its 50 between the two)
 *   speed      = full when solved by the game's "full by" time, then shrinking evenly to 0 at the buzzer
 *   par bonus  = full at par, shrinking evenly to 0 at twice par (or the game's own zero point)
 *   clean      = the stated amount, less the stated amount per mistake, never below 0
 *   unfinished = the game's credit, capped at 130, so a finish always beats it; "how early" extras are full for a
 *                part done at 0 s, shrinking evenly to 0 at the buzzer
 */
import type { ScoreParts } from "../puzzleScoreRev";

export const STANDARD_FINISH = 150;
export const STANDARD_MAX = 200;
export const STANDARD_UNFINISHED_CAP = 130;

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Speed points: `max` when the puzzle was solved by `fullByMs` on the round clock (`limitMs` long), then shrinking
 * evenly to 0 at the buzzer. `msLeft` is the time left at the finish.
 */
export function speedPoints(max: number, msLeft: number, limitMs: number, fullByMs: number): number {
  if (!(limitMs > 0) || !(max > 0)) return 0;
  const left = clamp(msLeft, 0, limitMs);
  const window = limitMs - clamp(fullByMs, 0, limitMs);
  if (window <= 0) return left > 0 ? max : 0;
  return max * Math.min(1, left / window);
}

/** A par bonus: `max` at or under par, shrinking evenly to 0 at `zeroAt` (twice par unless the game says). */
export function parPoints(max: number, used: number, par: number, zeroAt = 2 * par): number {
  if (!(max > 0) || !(par > 0) || !Number.isFinite(used)) return 0;
  if (used <= par) return max;
  if (zeroAt <= par) return 0;
  return max * clamp((zeroAt - used) / (zeroAt - par), 0, 1);
}

/** A clean bonus: `max`, less `per` for each mistake, never below 0. */
export function cleanPoints(max: number, per: number, mistakes: number): number {
  return Math.max(0, max - per * Math.max(0, Number.isFinite(mistakes) ? mistakes : 0));
}

/**
 * "How early" extras: each part done at round-clock time `t` earns `perPart × (1 − t ÷ limit)` (full at 0 s, nothing at
 * the buzzer). A part with no known time earns nothing.
 */
export function earlyPoints(perPart: number, times: readonly (number | null)[], limitMs: number): number {
  if (!(limitMs > 0) || !(perPart > 0)) return 0;
  let sum = 0;
  for (const t of times) if (t !== null && Number.isFinite(t)) sum += perPart * (1 - clamp(t, 0, limitMs) / limitMs);
  return sum;
}

/** A finish's parts, in the reveal's "150 + N <bonus> + N speed" form. */
export interface StandardFinish {
  speed: number;
  bonus: number;
  /** What the bonus measures, for the reveal line ("par", "bonus", "clean"…). */
  measure: string;
  /**
   * The finish's base when a game's row scores it below 150 (Ballpark: up to 150 by average accuracy); 150 when absent.
   * Additive (Number batch): every other game leaves it out.
   */
  base?: number;
}

export interface StandardScore {
  score: number;
  parts: ScoreParts;
}

/** 150 + speed + bonus, rounded part by part, at most 200; the parts add up to the score. */
export function standardFinish(f: StandardFinish): StandardScore {
  const base = f.base === undefined ? STANDARD_FINISH : Math.round(clamp(f.base, 0, STANDARD_FINISH));
  const bonus = Math.round(clamp(f.bonus, 0, STANDARD_MAX - STANDARD_FINISH));
  const speed = Math.round(clamp(f.speed, 0, STANDARD_MAX - STANDARD_FINISH - bonus));
  const score = base + speed + bonus;
  return { score, parts: { kind: "finish", base, efficiency: bonus, measure: f.measure, speed } };
}

/** An unfinished score: the credit, rounded, from 0 to 130. */
export function standardUnfinished(credit: number): StandardScore {
  const score = Math.round(clamp(credit, 0, STANDARD_UNFINISHED_CAP));
  return { score, parts: { kind: "partial", base: score } };
}
