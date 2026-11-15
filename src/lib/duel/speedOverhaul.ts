/**
 * The Speed overhaul (phase 2 step 4, 15 Nov 2026, docs/design/game-reviews/speed.md; docs/design/speed-art/README.md).
 *
 *   - Tenfall `tenRev 6` (TEN_DROP_RESET_REV): resets cost on a finished run too (tenRev 5 charged them only when the
 *     run was unfinished); every other number is tenRev 5's.
 *   - Pull! `clayRev 10` (CLAY_REV_WIDE): the quick-hit window is full within 0.4 s of a clay's launch and gone at
 *     0.6 s (clayRev 9: 0.25 s and 0.37 s); every other number is clayRev 9's.
 *
 * Every older stamp deals, grades and reads exactly as before. Checks written for the stamps before pin new deals to
 * them with `pinPreSpeedOverhaul(true)`. Shared by phone and server, pure.
 */
import { CLAY_REV_DEPTH, CLAY_REV_WIDE } from "@/lib/arcade/clayShoot";
import { TEN_DROP_RESET_REV, TEN_DROP_STANDARD_REV } from "@/lib/arcade/tenDrop";
import { dealPinned, setDealPin } from "./dealEra";

/** Checks written for the stamps before the Speed overhaul deal them; returns the previous setting. */
export function pinPreSpeedOverhaul(on: boolean): boolean {
  return setDealPin("preSpeedOverhaul", on);
}

/** True while the stamps before the overhaul are dealt (a check pinned them). */
export function preSpeedOverhaulPinned(): boolean {
  return dealPinned("preSpeedOverhaul");
}

/** Tenfall tenRev 6 over the standard's tenRev 5, Pull! clayRev 10 over clayRev 9 (any other stamp unchanged). */
export function dealSpeedOverhaul<T extends { type: string }>(puzzle: T): T {
  if (dealPinned("preSpeedOverhaul")) return puzzle;
  if (puzzle.type === "tendrop") {
    const p = puzzle as { tenRev?: number };
    return p.tenRev === TEN_DROP_STANDARD_REV ? { ...puzzle, tenRev: TEN_DROP_RESET_REV } : puzzle;
  }
  if (puzzle.type === "clayshoot") {
    const p = puzzle as { clayRev?: number };
    return p.clayRev === CLAY_REV_DEPTH ? { ...puzzle, clayRev: CLAY_REV_WIDE } : puzzle;
  }
  return puzzle;
}

/** The quick-hit window the help describes, for the clayRev dealt now (seconds: full by, none after). */
export function clayQuickWindowText(): { full: string; none: string } {
  return preSpeedOverhaulPinned() ? { full: "a quarter of a second", none: "about 0.37 s" } : { full: "0.4 s", none: "0.6 s" };
}
