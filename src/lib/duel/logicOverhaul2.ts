/**
 * Logic overhaul, session 2 (15 Nov 2026, docs/design/game-reviews/logic.md): the two scoring changes agreed with Joe
 * for the seven games of this session, each on a new stamp one above the stamp dealt before.
 *
 *   - Trail `depthRev 3` (TRAIL_REV_UNDO_EACH): every undo costs the clean bonus 2.5 (the other games' rate for a
 *     mistake) instead of the whole bonus. An undo is one take-back of the path, read from the draft timeline: a draft
 *     in which a placed tile is no longer where the draft before had it (Undo, a step back, a drag back over several
 *     tiles in one change, or Reset, each one undo).
 *   - Regions (fillomino) `fillominoRev 2` (FILLOMINO_REV_STROKE): one drag stroke over wrong squares is one mistake.
 *     The stage reports its draft once a stroke ends (not square by square), and the grader counts the drafts that
 *     brought in a wrong number not seen before, so a stroke (or a tap) is at most one mistake.
 *
 * Every older stamp deals, grades and reads exactly as before. Checks written for the stamps before pin new deals to
 * them with `pinPreLogic2(true)`. Shared by phone and server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";

/** Trail on the scoring standard (depthRev 2, standard/stamps.ts): what depthRev 3 is dealt over. */
export const TRAIL_REV_STANDARD = 2;
/** Trail: the clean bonus less 2.5 an undo. */
export const TRAIL_REV_UNDO_EACH = 3;
/** Regions born on the standard (fillominoRev 1): what fillominoRev 2 is dealt over. */
export const FILLOMINO_REV_STANDARD = 1;
/** Regions: a stroke is one mistake. */
export const FILLOMINO_REV_STROKE = 2;

/** Checks written for the stamps before 15 Nov 2026 deal them (Trail depthRev 2, Regions fillominoRev 1). */
export function pinPreLogic2(on: boolean): boolean {
  return setDealPin("preLogic2", on);
}

export function preLogic2Pinned(): boolean {
  return dealPinned("preLogic2");
}

/** The deal layer: Trail and Regions one stamp above the standard's (any other stamp, or with the pin, unchanged). */
export function dealLogic2<T extends { type: string }>(puzzle: T): T {
  if (dealPinned("preLogic2")) return puzzle;
  if (puzzle.type === "trail" && (puzzle as { depthRev?: number }).depthRev === TRAIL_REV_STANDARD) {
    return { ...puzzle, depthRev: TRAIL_REV_UNDO_EACH };
  }
  if (puzzle.type === "fillomino" && (puzzle as { fillominoRev?: number }).fillominoRev === FILLOMINO_REV_STANDARD) {
    return { ...puzzle, fillominoRev: FILLOMINO_REV_STROKE };
  }
  return puzzle;
}

/** True for a Trail puzzle whose clean bonus costs 2.5 an undo. */
export function trailUndoEach(puzzle: unknown): boolean {
  const p = puzzle as { type?: string; depthRev?: number } | null;
  return p?.type === "trail" && (p.depthRev ?? 0) >= TRAIL_REV_UNDO_EACH;
}

/** True for a Regions puzzle that counts a stroke as one mistake (and whose stage reports a draft per stroke). */
export function fillominoStrokes(puzzle: unknown): boolean {
  const p = puzzle as { type?: string; fillominoRev?: number } | null;
  return p?.type === "fillomino" && (p.fillominoRev ?? 0) >= FILLOMINO_REV_STROKE;
}

/** The clean bonus and the points off it for each undo (Trail depthRev 3). */
export const TRAIL_UNDO_COST = 2.5;
