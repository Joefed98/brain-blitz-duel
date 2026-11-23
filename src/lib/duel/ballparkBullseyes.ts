/**
 * Ballpark's bullseyes (D2, 22 Nov 2026; Joe's approval of 22 Nov 2026: a Normal scoring stamp, so a realistic elite
 * under the human limits reaches 200 sometimes on Normal, less often each level up, Expert at least a fifth).
 * `depthRev 3` (BALLPARK_REV_BULLS): a bullseye (a number within 1 % of the line's length, unchanged) is worth 2½ on Easy
 * and Normal (twelve fill the part) and 3 on Hard and Expert (ten fill it: their numbers are harder), still up to 30.
 * Under depthRev 2 each was worth 2, so 200 needed all fifteen numbers within 1 %, which even an elite player managed on
 * about one Normal board in eight. Accuracy, speed, the unfinished credit's other parts and the wild-number cost are
 * unchanged. The worth is fixed by the stamp and the stored level, so a retune needs a new stamp.
 *
 * The board, the deal and every other rule are depthRev 2's; only a bullseye's worth moves. A new puzzle gets the stamp
 * only on top of depthRev 2 (so a check pinning any earlier world keeps it), and checks written for depthRev 2 pin it
 * with `pinPreBallparkBullseyes(true)`. Older rounds replay and score exactly as before (number-ballpark-bulls-check, on
 * scripts/fixtures/number-ballpark-bulls-legacy.json.gz recorded on main). Shared by phone and server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";
import { BALLPARK_STD_BULL_POINTS } from "./standard/number";
import type { PuzzleData } from "./types";
import { puzzleLevel, type Level } from "../levels/levels";

/** The stamp (Ballpark's `depthRev`). */
export const BALLPARK_REV_BULLS = 3;
/** The stamp it moves up from (the scoring standard's). */
export const BALLPARK_REV_BEFORE = 2;
/** A bullseye's worth at depthRev 3 by level (the part's maximum, BALLPARK_STD_BULL_MAX, is unchanged). */
export const BALLPARK_V3_BULL_POINTS: Readonly<Record<Level, number>> = { easy: 2.5, normal: 2.5, hard: 3, expert: 3 };

/** Checks written for depthRev 2 pin new deals to it (returns the previous setting). */
export function pinPreBallparkBullseyes(on: boolean): boolean {
  // The help and intro texts (liveRecord) follow it: setDealPin rebuilds them (dealEra.ts).
  return setDealPin("preBallparkBullseyes", on);
}

/** True while new Ballpark rounds are dealt depthRev 3 (the help describes it). */
export function ballparkBullseyesDealt(): boolean {
  return !dealPinned("preBallparkBullseyes");
}

/** True for a stored Ballpark on depthRev 3 or later. */
export function usesBallparkBullseyes(puzzle: PuzzleData | null | undefined): boolean {
  if (!puzzle || puzzle.type !== "numline") return false;
  const v = (puzzle as { depthRev?: unknown }).depthRev;
  return typeof v === "number" && v >= BALLPARK_REV_BULLS;
}

/** A bullseye's worth on a stored Ballpark: from depthRev 3 by its stored level, else 2. */
export function ballparkBullPoints(puzzle: PuzzleData | null | undefined): number {
  return usesBallparkBullseyes(puzzle) ? BALLPARK_V3_BULL_POINTS[puzzleLevel(puzzle!)] : BALLPARK_STD_BULL_POINTS;
}

/** The deal layer (generate.server.ts DEAL_LAYERS): depthRev 3 on a Ballpark carrying depthRev 2. */
export function dealBallparkBullseyes<T extends PuzzleData>(puzzle: T): T {
  if (puzzle.type !== "numline" || dealPinned("preBallparkBullseyes")) return puzzle;
  if ((puzzle as { depthRev?: unknown }).depthRev !== BALLPARK_REV_BEFORE) return puzzle;
  return { ...puzzle, depthRev: BALLPARK_REV_BULLS } as T;
}
