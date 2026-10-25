/**
 * Par bonus (25 Oct 2026, word depth d1: Slider `wordSlideRev 1`, Swapword `swapwordRev 4`; docs/depth/d1-word.md).
 *
 * A finish at or under the puzzle's par (Slider's moves, Swapword's swaps) adds a bonus to today's score (at most
 * 150), and it is the only way past 150: `base` for making par at any pace, then up to 50 the faster the finish
 * beyond today's 150 pace: base + (50 − base) × s^power, s = (time left share − fast) ÷ (elite − fast) clamped to
 * 0–1. `fast` is rev 3's fastShare for the game (a clean finish with that much of the clock left scores 150
 * today), so a solid player who makes par lands a few points above today, and only an elite finish at par reaches
 * 200. Shared by the phone (texts) and the server (grading). Pure arithmetic.
 */
export interface ParBonusCurve {
  /** Points for making par at any pace. */
  base: number;
  /** Today's fastShare (rev 3) for the game. */
  fast: number;
  /** Time-left share at which a finish at par scores the whole 50. */
  elite: number;
  /** Shape of the climb above `base` (> 1: slow at first). */
  power: number;
}

export const PAR_BONUS_MAX = 50;

/** The bonus for a finish with `left` (0–1) of the clock left; 0 unless `atPar`. */
export function parBonusPoints(curve: ParBonusCurve, atPar: boolean, left: number): number {
  if (!atPar) return 0;
  const l = Number.isFinite(left) ? Math.max(0, Math.min(1, left)) : 0;
  const s = Math.max(0, Math.min(1, (l - curve.fast) / Math.max(0.01, curve.elite - curve.fast)));
  return Math.round(curve.base + (PAR_BONUS_MAX - curve.base) * Math.pow(s, curve.power));
}

/** Seconds a finish at par may take and still earn the whole bonus. */
export function parBonusEliteSeconds(curve: ParBonusCurve, limitMs: number): number {
  return Math.round((limitMs * (1 - curve.elite)) / 1000);
}
