/**
 * Double Take depth to 200 (25 Oct 2026, `spotRev 2`; docs/depth/d3-speed-attention.md). STRETCH + the hidden
 * difference. Both pictures, their twelve counted differences, the 60 s clock and the finish rule (all twelve, at
 * most 5 wrong taps in each picture) are spotRev 1's. New:
 *
 *   - one of the two pictures hides a seventh, subtler difference (`bonus`, server-side until the reveal like the
 *     others): one sweet or creature drawn a little smaller in one panel. It is not in the "n / 6" count and never
 *     needed to finish; tapping it is not a wrong tap. A picture ends when its six are found, so it must be spotted
 *     before the sixth.
 *   - a finish scores as puzzleScoreRev 3 up to the old 150 pace (120 + 30 × min(1, left ÷ 0.69)), then climbs up to
 *     DOUBLE_TAKE_STRETCH_TOP more by 84 % of the clock left, cut by wrong taps; the hidden difference adds
 *     DOUBLE_TAKE_BONUS on a finish, so {max} needs both.
 *
 * Unfinished rounds score exactly as puzzleScoreRev 3 (the hidden difference adds nothing to an unfinished round).
 */
import type { StretchCurve } from "../depth200";
import type { SpotPuzzleData } from "../types";

export const SPOT_DEPTH_REV = 2;
export const DOUBLE_TAKE_STRETCH_TOP = 25;
export const DOUBLE_TAKE_BONUS = 25;
export const SPOT_DEPTH_CURVE: StretchCurve = { fastShare: 0.69, eliteShare: 0.84, stretchTop: DOUBLE_TAKE_STRETCH_TOP, power: 1.5 };
/** Each wrong tap keeps this much less of the climb above 150 (squared): 1 → 69 %, 3 → 25 %, 6+ → none. */
export const SPOT_DEPTH_WRONG_STEP = 1 / 6;
/** The hidden difference's shape is drawn at this share of its size in the panel that changed. */
export const SPOT_BONUS_SCALE = 0.8;

export function usesSpotDepth(p: Pick<SpotPuzzleData, "spotRev">): boolean {
  return (p.spotRev ?? 0) >= SPOT_DEPTH_REV;
}

export function spotWrongKeep(wrong: number): number {
  return Math.max(0, 1 - SPOT_DEPTH_WRONG_STEP * Math.max(0, wrong));
}

/** The hidden difference's cell in a picture's taps, if it was tapped. */
export function spotBonusFound(p: SpotPuzzleData, taps: number[][]): boolean {
  const bonus = p.bonus;
  if (!usesSpotDepth(p) || !bonus) return false;
  const tapped = taps[bonus.scene ?? 0] ?? [];
  return bonus.cells.some((c) => tapped.includes(c));
}
