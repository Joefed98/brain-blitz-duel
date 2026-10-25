/**
 * Eagle Eye depth to 200 (25 Oct 2026, `scanRev 2`; docs/depth/d3-speed-attention.md). STRETCH: the grids, targets
 * and finish rule are scanRev 1's; only the score reaches further. A finish scores as puzzleScoreRev 3 up to the old
 * 150 pace (120 + 30 × min(1, left ÷ 0.55)), then a clean finish keeps climbing to {max} at 76 % of the clock left
 * (a finish in about 7 s). Taps taken back (an eagle marked, then unmarked) cut the climb above 150: the answer carries
 * the count as a fourth "|" part, the phone's word, like Forage's misses (it can only cost an honest player).
 * Unfinished rounds score exactly as puzzleScoreRev 3.
 */
import type { StretchCurve } from "../depth200";
import type { SymbolScanPuzzleData } from "../types";

export const SCAN_DEPTH_REV = 2;
export const SCAN_DEPTH_CURVE: StretchCurve = { fastShare: 0.55, eliteShare: 0.76, stretchTop: 50, power: 2.5 };
/** Each tap taken back keeps this much less of the climb above 150 (squared): 1 → 56 %, 2 → 25 %, 4+ → none. */
export const SCAN_DEPTH_CORRECTION_STEP = 0.25;

export function usesScanDepth(p: Pick<SymbolScanPuzzleData, "scanRev">): boolean {
  return (p.scanRev ?? 0) >= SCAN_DEPTH_REV;
}

/** scanRev 2 answers: "grid1|grid2|grid3|corrections". */
export function scanCorrections(answer: string | null | undefined): number {
  const n = Number.parseInt((answer ?? "").split("|")[3] ?? "", 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(99, n)) : 0;
}

export function scanCorrectionKeep(corrections: number): number {
  return Math.max(0, 1 - SCAN_DEPTH_CORRECTION_STEP * Math.max(0, corrections));
}
