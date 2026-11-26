/**
 * Integer Pyramid's unfinished credit (D2, 22 Nov 2026; plan section 8.2 I3, Joe's approval of 20 Nov: built on Normal
 * too). `depthRev 3` (PYRAMID_REV_PARTIAL): an unfinished round scores 130 × the stones placed correctly ÷ the round's
 * empty stones (PYRAMID_PARTIAL_POINTS), counted on the pyramids done and the one the player is on (the phone edits only
 * that one, so a later pyramid's tiles never count), with no "how early" extras and no clean points; a finish is
 * unchanged (150 + speed + clean). Under depthRev 2 the credit was 120 × (pyramids done + the share right of the current
 * one) ÷ the pyramids, plus extras, so a player who had a pyramid nearly done earned little for it.
 *
 * The board, the deal and every rule a player sees are depthRev 2's; only the unfinished credit moves. A new puzzle gets
 * the stamp only on top of depthRev 2 (so a check pinning any earlier world keeps it), and checks written for depthRev 2
 * pin it with `pinPrePyramidPartial(true)`. Older rounds replay and score exactly as before (number-pyramid-partial-check,
 * on scripts/fixtures/number-pyramid-partial-legacy.json.gz recorded on main). Shared by phone and server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";
import type { PuzzleData } from "./types";

/** The stamp (Integer Pyramid's `depthRev`). */
export const PYRAMID_REV_PARTIAL = 3;
/** The stamp it moves up from (the scoring standard's). */
export const PYRAMID_REV_BEFORE = 2;
/** Unfinished credit at depthRev 3: up to this many points by the share of the round's stones placed correctly. */
export const PYRAMID_PARTIAL_POINTS = 130;

/** Checks written for depthRev 2 pin new deals to it (returns the previous setting). */
export function pinPrePyramidPartial(on: boolean): boolean {
  // The help and intro texts (liveRecord) follow it: setDealPin rebuilds them (dealEra.ts).
  return setDealPin("prePyramidPartial", on);
}

/** True while new Integer Pyramid rounds are dealt depthRev 3 (the help and intro describe it). */
export function pyramidPartialDealt(): boolean {
  return !dealPinned("prePyramidPartial");
}

/** True for a stored Integer Pyramid on depthRev 3 or later. */
export function usesPyramidPartial(puzzle: PuzzleData | null | undefined): boolean {
  if (!puzzle || puzzle.type !== "numpyramid") return false;
  const v = (puzzle as { depthRev?: unknown }).depthRev;
  return typeof v === "number" && v >= PYRAMID_REV_PARTIAL;
}

/** The deal layer (generate.server.ts DEAL_LAYERS): depthRev 3 on an Integer Pyramid carrying depthRev 2. */
export function dealPyramidPartial<T extends PuzzleData>(puzzle: T): T {
  if (puzzle.type !== "numpyramid" || dealPinned("prePyramidPartial")) return puzzle;
  if ((puzzle as { depthRev?: unknown }).depthRev !== PYRAMID_REV_BEFORE) return puzzle;
  return { ...puzzle, depthRev: PYRAMID_REV_PARTIAL } as T;
}

/**
 * depthRev 3's unfinished credit: 130 × right ÷ stones, `right` the correct stones on the pyramids done and the current
 * one (the first unfinished), `stones` every empty stone of the round. Always below 130 (a full set is a finish).
 */
export function pyramidPartialCredit(boards: readonly { complete: boolean; correct: number; empty: number }[]): { credit: number; right: number; stones: number } {
  const stones = boards.reduce((sum, b) => sum + b.empty, 0);
  let right = 0;
  for (const b of boards) {
    right += b.complete ? b.empty : Math.min(b.correct, b.empty);
    if (!b.complete) break;
  }
  return { credit: stones > 0 ? (PYRAMID_PARTIAL_POINTS * right) / stones : 0, right, stones };
}
