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
