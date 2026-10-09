/**
 * Balance rules, shared by the phone and the server. Pegs 0–3 are the left
 * side at distances 4, 3, 2, 1; pegs 4–7 the right side at 1, 2, 3, 4. The
 * answer lists, per scale, the peg each tray weight sits on ("-" for the tray).
 */

import { speedBonusCurve } from "./speedPar";
import type { BalanceScale } from "./types";

export const BAL_PEGS = 8;
export const BAL_SCALES = 3;
export const BAL_TIME_MS = 90_000;
export const BAL_REVEAL_MS = 8_000;
export const BAL_MAX_TILT = 12;

export type Placement = (number | null)[];

export function pegDistance(peg: number): number {
  return peg < 4 ? 4 - peg : peg - 3;
}

export function pegIsLeft(peg: number): boolean {
  return peg < 4;
}

export function balanceTorque(scale: BalanceScale, placement: Placement): { left: number; right: number } {
  let left = 0;
  let right = 0;
  const add = (peg: number, w: number) => {
    if (pegIsLeft(peg)) left += w * pegDistance(peg);
    else right += w * pegDistance(peg);
  };
  for (const f of scale.fixed) add(f.peg, f.w);
  placement.forEach((peg, i) => {
    if (peg !== null && peg !== undefined) add(peg, scale.tray[i] ?? 0);
  });
  return { left, right };
}

export function placementLegal(scale: BalanceScale, placement: Placement): boolean {
  const taken = new Set(scale.fixed.map((f) => f.peg));
  for (const peg of placement) {
    if (peg === null) continue;
    if (!Number.isInteger(peg) || peg < 0 || peg >= BAL_PEGS || taken.has(peg)) return false;
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
  const parts = typeof raw === "string" ? raw.split("|") : [];
  return scales.map((scale, s) => {
    const cells = (parts[s] ?? "").split(",");
    return scale.tray.map((_, i) => {
      const v = Number.parseInt(cells[i] ?? "", 10);
      return Number.isInteger(v) && v >= 0 && v < BAL_PEGS ? v : null;
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

/** Stage weights for scales 1 / 2 / 3 when the round is unfinished. */
export const BAL_STAGE_POINTS = [20, 40, 60] as const;

/** All three: 120 + round(30 × ms left ÷ limit), cap 150. Otherwise the solved stages' weights. */
export function balanceRoundScore(solved: number, msRemaining: number, timeLimitMs: number): number {
  const n = Math.max(0, Math.min(BAL_SCALES, solved));
  if (n >= BAL_SCALES) {
    const ms = Math.max(0, Math.min(msRemaining, timeLimitMs));
    return Math.min(150, 120 + (timeLimitMs > 0 ? speedBonusCurve(30, ms, timeLimitMs) : 0));
  }
  return BAL_STAGE_POINTS.slice(0, n).reduce((a, b) => a + b, 0);
}
