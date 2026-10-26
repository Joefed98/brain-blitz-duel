/**
 * Server-only: stamps the depth revision (logicDepth.ts, 25 Oct 2026) on new puzzles of the eleven Logic games,
 * from stampMoveLimits (so room deals, practice, banked draws and the banked intro examples all carry it). Blackout
 * and Polypotions also get their par in the open (`par`, the stored minimum): the depth revision shows it on the
 * board as "Presses n · Par p" / "Pours n · Par p". Hanoi's minimum was always public.
 */
import { DEPTH_REV, dealtLogicDepthRev, isDepthType } from "./logicDepth";
import type { PuzzleData } from "./types";

export function stampLogicDepth(puzzle: PuzzleData): PuzzleData {
  if (!isDepthType(puzzle.type)) return puzzle;
  if (puzzle.type === "lightsout" && puzzle.minPresses && puzzle.minPresses > 0)
    return { ...puzzle, depthRev: DEPTH_REV, par: puzzle.minPresses };
  if (puzzle.type === "tubes" && puzzle.minMoves && puzzle.minMoves > 0) return { ...puzzle, depthRev: DEPTH_REV, par: puzzle.minMoves };
  // A board with no stored minimum (a malformed or placeholder puzzle) stays on the old scoring.
  if (puzzle.type === "lightsout" || puzzle.type === "tubes") return puzzle;
  return { ...puzzle, depthRev: dealtLogicDepthRev(puzzle.type) } as PuzzleData;
}
