/**
 * The Number overhaul's input rules for Counterweight and Exact (15 Nov 2026, docs/design/game-reviews/number.md):
 * pure helpers shared by the phone's stages and their checks. Nothing here grades a round.
 */
import { balanceTorque, type Placement } from "./balance";
import type { BalanceScale, Operator } from "./types";

/**
 * Counterweight: how many hangs moving tray weight `tray` to `peg` uses. On balanceRev 4 (`freeMoves`) only a weight
 * hung from the tray counts (moving a hung weight to another notch is free); on older stamps every placement counts,
 * as before.
 */
export function balanceHangCost(placement: Placement, tray: number, peg: number | null, freeMoves: boolean): 0 | 1 {
  if (peg === null) return 0;
  if (!freeMoves) return 1;
  return placement[tray] === null || placement[tray] === undefined ? 1 : 0;
}

/** Counterweight balanceRev 4: the balance shown under the beam, left turning force | right ("18 | 15"). */
export function balanceTorqueText(scale: BalanceScale, placement: Placement): string {
  const { left, right } = balanceTorque(scale, placement);
  return `${left} | ${right}`;
}

/** Exact: Lock is live (and gold) only once a step has been made. */
export function exactLockReady(steps: number): boolean {
  return steps > 0;
}

/** Exact: tapping the selected operator again deselects it; any other operator is selected. */
export function toggleOperator(current: Operator | null, tapped: Operator): Operator | null {
  return current === tapped ? null : tapped;
}

/* ---- The reveals (15 Nov 2026, Joe: clear, big reveals; display only). ---- */

/** A scale's mark on the reveal's tabs: balanced (and within its limit), tried, or nothing hung. */
export function balanceRevealMarks(placements: readonly Placement[], ok: readonly boolean[]): ("right" | "wrong" | "open")[] {
  return ok.map((right, s) => (right ? "right" : (placements[s] ?? []).some((p) => p !== null && p !== undefined) ? "wrong" : "open"));
}

/** The tray weights a balanced arrangement hangs somewhere other than you did (the solution view's gold rings). */
export function balanceMovedWeights(mine: Placement, solution: Placement): Set<number> {
  const moved = new Set<number>();
  solution.forEach((peg, i) => {
    if ((peg ?? null) !== (mine[i] ?? null)) moved.add(i);
  });
  return moved;
}

/** The tray weights you left unhung (your view's "Still on the tray" row). */
export function balanceLeftOnTray(mine: Placement, trayLength: number): number[] {
  return Array.from({ length: trayLength }, (_, i) => i).filter((i) => mine[i] === null || mine[i] === undefined);
}
