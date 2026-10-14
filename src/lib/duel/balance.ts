/**
 * Balance rules, shared by the phone and the server. On an 8-notch scale pegs
 * 0–3 are the left side at distances 4, 3, 2, 1 and pegs 4–7 the right side at
 * 1, 2, 3, 4; a 10-notch scale (balanceRev 2's fourth scale, `pegs: 10`) runs
 * 0–4 at 5…1 and 5–9 at 1…5. The answer lists, per scale, the peg each tray
 * weight sits on ("-" for the tray).
 *
 * balanceRev 2 (14 Oct 2026): four scales (the fourth with 10 notches, five
 * tray weights and 12 hangs), 120 s stored on the puzzle as `timeLimitMs`, and
 * the rev-2 scale points below. Stored rounds keep three 8-notch scales, the
 * registry's 90 s and their own points.
 */

import { finishParts, partialParts, scoreRev1 } from "./puzzleScoreRev";
import { speedBonusCurve } from "./speedPar";
import type { BalanceScale } from "./types";

/** balanceRev 2 (14 Oct 2026): four scales, 120 s, the rev-2 points. balanceRev 1 is the move-limit rev (moveLimits.ts). */
export const BAL_REV2 = 2;
/** Notches on a scale without its own `pegs` (every stored scale, and scales 1–3 of balanceRev 2). */
export const BAL_PEGS = 8;
/** Scales on a stored round (balanceRev 0–1); balanceRev 2 deals BAL_REV2_SCALES. */
export const BAL_SCALES = 3;
export const BAL_REV2_SCALES = 4;
/** Notches on balanceRev 2's fourth scale. */
export const BAL_REV2_WIDE_PEGS = 10;
/** The registry's clock: stored rounds. balanceRev 2 puzzles carry BAL_REV2_TIME_MS as `timeLimitMs`. */
export const BAL_TIME_MS = 90_000;
export const BAL_REV2_TIME_MS = 120_000;
export const BAL_REVEAL_MS = 8_000;
export const BAL_MAX_TILT = 12;

export type Placement = (number | null)[];

/** A scale's notch count (8 unless it carries its own). */
export function scalePegs(scale: Pick<BalanceScale, "pegs">): number {
  return scale.pegs === BAL_REV2_WIDE_PEGS ? BAL_REV2_WIDE_PEGS : BAL_PEGS;
}

export function pegDistance(peg: number, pegs = BAL_PEGS): number {
  const half = pegs / 2;
  return peg < half ? half - peg : peg - half + 1;
}

export function pegIsLeft(peg: number, pegs = BAL_PEGS): boolean {
  return peg < pegs / 2;
}

export function balanceTorque(scale: BalanceScale, placement: Placement): { left: number; right: number } {
  let left = 0;
  let right = 0;
  const pegs = scalePegs(scale);
  const add = (peg: number, w: number) => {
    if (pegIsLeft(peg, pegs)) left += w * pegDistance(peg, pegs);
    else right += w * pegDistance(peg, pegs);
  };
  for (const f of scale.fixed) add(f.peg, f.w);
  placement.forEach((peg, i) => {
    if (peg !== null && peg !== undefined) add(peg, scale.tray[i] ?? 0);
  });
  return { left, right };
}

export function placementLegal(scale: BalanceScale, placement: Placement): boolean {
  const taken = new Set(scale.fixed.map((f) => f.peg));
  const pegs = scalePegs(scale);
  for (const peg of placement) {
    if (peg === null) continue;
    if (!Number.isInteger(peg) || peg < 0 || peg >= pegs || taken.has(peg)) return false;
    taken.add(peg);
  }
  return true;
}

export function scaleSolved(scale: BalanceScale, placement: Placement): boolean {
  if (placement.length !== scale.tray.length || placement.some((p) => p === null)) return false;
  if (!placementLegal(scale, placement)) return false;
  const t = balanceTorque(scale, placement);
  return t.left === t.right;
}

/** Degrees of tilt: positive tips the right side down. */
export function balanceTilt(scale: BalanceScale, placement: Placement): number {
  const t = balanceTorque(scale, placement);
  return Math.max(-BAL_MAX_TILT, Math.min(BAL_MAX_TILT, ((t.right - t.left) / 30) * BAL_MAX_TILT));
}

export function encodeBalance(placements: Placement[]): string {
  return placements.map((p) => p.map((peg) => (peg === null ? "-" : String(peg))).join(",")).join("|");
}

export function decodeBalance(raw: string, scales: BalanceScale[]): Placement[] {
  // balanceRev 1 answers end with "#" and the hang counts (moveLimits.ts); stored rounds never contain "#".
  const parts = typeof raw === "string" ? raw.split("#")[0]!.split("|") : [];
  return scales.map((scale, s) => {
    const cells = (parts[s] ?? "").split(",");
    const pegs = scalePegs(scale);
    return scale.tray.map((_, i) => {
      const v = Number.parseInt(cells[i] ?? "", 10);
      return Number.isInteger(v) && v >= 0 && v < pegs ? v : null;
    });
  });
}

/** Scales solved in order — the round only advances past a balanced scale. */
export function balanceSolvedCount(scales: BalanceScale[], placements: Placement[]): number {
  let n = 0;
  for (let s = 0; s < scales.length; s++) {
    if (!scaleSolved(scales[s]!, placements[s] ?? [])) break;
    n++;
  }
  return n;
}

/** Every scale's balance verdict, in any order (puzzle score rev 1). */
export function balanceScalesSolved(scales: BalanceScale[], placements: Placement[]): boolean[] {
  return scales.map((scale, s) => scaleSolved(scale, placements[s] ?? []));
}

/** Puzzle score rev 1: each balanced scale, any order, weighted by difficulty (the two hardest = 110). */
export const BAL_REV1_SCALE_POINTS = [20, 35, 75] as const;

/** balanceRev 2: each balanced scale of four, any order (the best three = 110). */
export const BAL_REV2_SCALE_POINTS = [15, 25, 30, 55] as const;

/** Stage weights for scales 1 / 2 / 3 when the round is unfinished. */
export const BAL_STAGE_POINTS = [20, 40, 60] as const;

/** The puzzle's scale count: 4 on balanceRev 2, else 3. */
export function balanceScaleCount(puzzle: { scales: readonly unknown[] }): number {
  return puzzle.scales.length === BAL_REV2_SCALES ? BAL_REV2_SCALES : BAL_SCALES;
}

/** All three: 120 + round(30 × ms left ÷ limit), cap 150. Otherwise the solved stages' weights. */
export function balanceRoundScore(solved: number, msRemaining: number, timeLimitMs: number, scalesSolved?: readonly boolean[]): number {
  if (scoreRev1() && scalesSolved && scalesSolved.length === BAL_REV2_SCALES) {
    // balanceRev 2: four scales, 15 / 25 / 30 / 55 in any order (the best three = 110); all four = 120 + PAR(30).
    if (scalesSolved.every(Boolean)) return finishParts(timeLimitMs > 0 ? speedBonusCurve(30, msRemaining, timeLimitMs) : 0);
    return partialParts(scalesSolved.reduce((sum, ok, i) => sum + (ok ? BAL_REV2_SCALE_POINTS[i] ?? 0 : 0), 0));
  }
  if (scoreRev1() && scalesSolved) {
    // Rev 1: each balanced scale scores its weight in any order (20 / 35 / 75: any two at most 110); all three = 120 + PAR(30).
    const n = scalesSolved.filter(Boolean).length;
    if (n >= BAL_SCALES) return finishParts(timeLimitMs > 0 ? speedBonusCurve(30, msRemaining, timeLimitMs) : 0);
    return partialParts(scalesSolved.reduce((sum, ok, i) => sum + (ok ? BAL_REV1_SCALE_POINTS[i] ?? 0 : 0), 0));
  }
  const n = Math.max(0, Math.min(BAL_SCALES, solved));
  if (n >= BAL_SCALES) {
    const ms = Math.max(0, Math.min(msRemaining, timeLimitMs));
    return Math.min(150, 120 + (timeLimitMs > 0 ? speedBonusCurve(30, ms, timeLimitMs) : 0));
  }
  return BAL_STAGE_POINTS.slice(0, n).reduce((a, b) => a + b, 0);
}
