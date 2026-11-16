/**
 * Logic overhaul, session 1 (phase 2 step 4, 15 Nov 2026; docs/design/game-reviews/logic.md, Joe's agreed changes for
 * Box Six, Polypotions, Hanoi, Safe Cracker, Mosaic, Colour Flood and Minefield). This module holds the batch's
 * gameplay stamps; everything else in the batch is display, sound or input only.
 *
 * - Polypotions `tubesRev 3` (TUBES_REFUND_REV, moveLimits.ts): tubesRev 2's board, limit and solver-distance progress,
 *   but Undo gives its pour back and Reset gives them all back (replayTubeLog's `refund`): the pours counted are the
 *   ones standing on the board.
 *
 * A new puzzle gets these stamps only when it was dealt the stamp before (so a check pinning an earlier world keeps
 * what it pinned) and this batch is not pinned (`pinPreLogicOverhaul1`). Older rounds replay and score exactly as
 * before. Shared by phone and server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";
import { TUBES_PROGRESS_REV, TUBES_REFUND_REV } from "./moveLimits";
import { LOGIC_REV_PARTIAL } from "./partialCredit";
import type { PuzzleData } from "./types";

export { TUBES_REFUND_REV } from "./moveLimits";

/** Checks written for the stamps before this batch pin new deals to them (returns the previous setting). */
export function pinPreLogicOverhaul1(on: boolean): boolean {
  return setDealPin("preLogicOverhaul1", on);
}

/** True while new rounds are dealt this batch's stamps. */
export function logicOverhaul1Dealt(): boolean {
  return !dealPinned("preLogicOverhaul1");
}

/** The deal layer (generate.server.ts DEAL_LAYERS): the batch's stamps on the stamps before them. */
export function dealLogicOverhaul1<T extends PuzzleData>(puzzle: T): T {
  if (dealPinned("preLogicOverhaul1")) return puzzle;
  // Only on the live deal before it (tubesRev 2 on the partial-credit depthRev 3), so a pinned older era is kept.
  if (puzzle.type === "tubes" && puzzle.tubesRev === TUBES_PROGRESS_REV && puzzle.pourLimit && puzzle.depthRev === LOGIC_REV_PARTIAL)
    return { ...puzzle, tubesRev: TUBES_REFUND_REV } as T;
  return puzzle;
}
