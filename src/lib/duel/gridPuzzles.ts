/**
 * The four grid puzzles born on the scoring standard (1 Nov 2026): Fences, Fillomino, Bridges and Kakuro. One verdict
 * and progress figure per answer, from each game's own rules module, for the grader (grade.ts), the round summaries and
 * the reveal text. Shared and pure.
 */
import type { PuzzleData } from "./types";
import { fencesProgress, fencesSolved } from "./fences";
import { fillominoProgress, fillominoSolved } from "./fillomino";
import { bridgesProgress, bridgesSolved } from "./bridges";
import { kakuroProgress, kakuroSolved } from "./kakuro";

export interface GridVerdict {
  solved: boolean;
  /** Items on the solution, items off it, and the solution's items (edges, squares, bridges or digits). */
  right: number;
  wrong: number;
  total: number;
}

export type GridPuzzleType = "fences" | "fillomino" | "bridges" | "kakuro";

export function isGridPuzzle(puzzle: PuzzleData | null | undefined): puzzle is Extract<PuzzleData, { type: GridPuzzleType }> {
  return !!puzzle && (puzzle.type === "fences" || puzzle.type === "fillomino" || puzzle.type === "bridges" || puzzle.type === "kakuro");
}

export function gradeGridPuzzle(puzzle: Extract<PuzzleData, { type: GridPuzzleType }>, answer: string): GridVerdict {
  switch (puzzle.type) {
    case "fences":
      return { solved: fencesSolved(puzzle, answer), ...fencesProgress(puzzle, answer) };
    case "fillomino":
      return { solved: fillominoSolved(puzzle, answer), ...fillominoProgress(puzzle, answer) };
    case "bridges":
      return { solved: bridgesSolved(puzzle, answer), ...bridgesProgress(puzzle, answer) };
    case "kakuro":
      return { solved: kakuroSolved(puzzle, answer), ...kakuroProgress(puzzle, answer) };
  }
}

/** What the items are called, singular and plural, for summaries and reveals. */
export const GRID_ITEM: Record<GridPuzzleType, [string, string]> = {
  fences: ["edge", "edges"],
  fillomino: ["square", "squares"],
  bridges: ["bridge", "bridges"],
  kakuro: ["square", "squares"],
};

/** "14/24 edges right" and the cost line ("3 lines off the loop"), or null without a solution to compare. */
export function gridProgressText(puzzle: PuzzleData, answer: string): { text: string; cost: string | null } | null {
  if (!isGridPuzzle(puzzle) || !puzzle.solution?.length) return null;
  const v = gradeGridPuzzle(puzzle, answer);
  const [one, many] = GRID_ITEM[puzzle.type];
  const wrongWord: Record<GridPuzzleType, [string, string]> = {
    fences: ["line off the loop", "lines off the loop"],
    fillomino: ["wrong number", "wrong numbers"],
    bridges: ["bridge off the solution", "bridges off the solution"],
    kakuro: ["wrong digit", "wrong digits"],
  };
  const [w1, wN] = wrongWord[puzzle.type];
  return {
    text: `${v.right}/${v.total} ${v.total === 1 ? one : many} right`,
    cost: v.wrong > 0 ? `${v.wrong} ${v.wrong === 1 ? w1 : wN}` : null,
  };
}
