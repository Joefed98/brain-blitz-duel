/**
 * Puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md).
 */
import { dealPinned, setDealPin } from "./dealEra";

/** Checks and reports: deal the stamps rooms dealt before the top-up (returns the previous setting). */
export function pinPreTopup(on: boolean): boolean {
  return setDealPin("preTopup", on);
}

export function preTopupPinned(): boolean {
  return dealPinned("preTopup");
}

/** The stamp new puzzles are dealt: the top-up's, or the live one before it while a check pins it. */
export function dealtTopupRev<T>(topupRev: T, liveRev: T): T {
  return dealPinned("preTopup") ? liveRev : topupRev;
}
