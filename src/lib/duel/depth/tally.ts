/**
 * Tally depth to 200 (25 Oct 2026, `countRev 3`; docs/depth/d3-speed-attention.md). STRETCH: the four trays, counts,
 * comparison question and 60 s clock are countRev 2's; only the score reaches further. A finish (all four exact, so
 * never a mistake) scores as puzzleScoreRev 3 up to the old 150 pace (120 + 30 × min(1, left ÷ 0.72)), then keeps
 * climbing to {max} at 83 % of the clock left (all four trays in about 10 s). Unfinished rounds score exactly as
 * puzzleScoreRev 3.
 */
import type { StretchCurve } from "../depth200";
import type { CountUpPuzzleData } from "../types";

export const COUNT_DEPTH_REV = 3;
export const COUNT_DEPTH_CURVE: StretchCurve = { fastShare: 0.72, eliteShare: 0.83, stretchTop: 50, power: 1.5 };
/**
 * The puzzle top-up (26 Oct 2026, countRev 4; docs/depth/topup-oct-2026.md): the same trays, counts and question; the
 * climb starts a little before the old 150 pace (COUNT_TOPUP_STRETCH_FROM; the speed part is rev 3's), so today's
 * near-perfect finish lands about 150–165.
 */
export const COUNT_TOPUP_REV = 4;
export const COUNT_TOPUP_CURVE: StretchCurve = { fastShare: 0.72, eliteShare: 0.83, stretchTop: 50, power: 1.2 };
export const COUNT_TOPUP_STRETCH_FROM = 0.57;

export function usesCountDepth(p: Pick<CountUpPuzzleData, "countRev">): boolean {
  return (p.countRev ?? 0) >= COUNT_DEPTH_REV;
}
