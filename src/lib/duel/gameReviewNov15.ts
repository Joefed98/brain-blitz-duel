/**
 * Game review fixes (15 Nov 2026, phase 2 step 4, docs/design/game-reviews/number.md "Brimful").
 *
 *   - Brimful `measureRev 4` (MEASURE_REV_BOARD_OUT): running out of moves ends only that puzzle, and play moves on
 *     to the next one, so a player stuck on puzzle 1 still plays puzzles 2–4. The server grades every board in order:
 *     a board out of its moves is closed unsolved and the next board is open (on measureRev 3 and older, a board out
 *     of moves closes every later board, as before). The boards, their limits and every scoring number are measureRev
 *     3's exactly.
 *
 * Every older stamp deals, grades and reads exactly as before. Checks written for the stamps before pin new deals to
 * them with `pinPreGameReviewNov15(true)`. Shared by phone and server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";

/** Brimful's stamp before the fix (Joe's phone notes, moveLimits.ts MEASURE_NOTES_REV). */
export const MEASURE_REV_NOTES = 3;
/** Brimful's depthRev on the scoring standard (standard/stamps.ts, one above its live 2). */
export const MEASURE_DEPTH_STANDARD = 3;
/** Brimful: running out of moves ends only that puzzle. */
export const MEASURE_REV_BOARD_OUT = 4;

/** Checks written for the stamps before 15 Nov 2026 deal them (measureRev 3); returns the previous setting. */
export function pinPreGameReviewNov15(on: boolean): boolean {
  return setDealPin("preGameReviewNov15", on);
}

export function preGameReviewNov15Pinned(): boolean {
  return dealPinned("preGameReviewNov15");
}

/** Brimful: measureRev 4 over the notes' measureRev 3 on the standard (any other stamp, or with the pin, unchanged). */
export function dealGameReviewNov15<T extends { type: string }>(puzzle: T): T {
  if (dealPinned("preGameReviewNov15") || puzzle.type !== "measure") return puzzle;
  // Over the standard's Brimful (depthRev 3) only, so checks that deal the stamps before the standard keep them.
  const p = puzzle as { measureRev?: number; depthRev?: number };
  if (p.measureRev !== MEASURE_REV_NOTES || p.depthRev !== MEASURE_DEPTH_STANDARD) return puzzle;
  return { ...puzzle, measureRev: MEASURE_REV_BOARD_OUT };
}

/** True for a Brimful puzzle whose out-of-moves board ends only itself. */
export function measureBoardOut(puzzle: unknown): boolean {
  const p = puzzle as { type?: string; measureRev?: number } | null;
  return p?.type === "measure" && (p.measureRev ?? 0) >= MEASURE_REV_BOARD_OUT;
}
