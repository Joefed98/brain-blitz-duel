/**
 * Server-only puzzle building and grading. Types whose content needs the
 * dictionary (Wordsmith) are handled here, so nothing dictionary-shaped is
 * ever reachable from a client bundle.
 */

import { gradeSubmission, type Graded, type SubmitExtra } from "./grade";
import { pickRoundOrder } from "./puzzles";
import { puzzleDef } from "./registry";
import { TOTAL_ROUNDS, type PuzzleData, type PuzzleType } from "./types";
import { generateWordsmith, gradeWordsmith } from "./wordsmith.server";

export function generatePuzzle(type: PuzzleType): PuzzleData {
  if (type === "wordsmith") return generateWordsmith();
  return puzzleDef(type).generate();
}

/** Generated ONCE per room so every player receives identical puzzles. */
export function buildRoomPuzzles(rounds: number = TOTAL_ROUNDS): {
  roundOrder: PuzzleType[];
  puzzles: PuzzleData[];
} {
  const roundOrder = pickRoundOrder(rounds);
  return { roundOrder, puzzles: roundOrder.map(generatePuzzle) };
}

/** The single place an answer is checked and scored. */
export function gradeAnswer(
  puzzle: PuzzleData,
  answer: string,
  msRemaining: number,
  extra?: SubmitExtra,
): Graded {
  if (puzzle.type === "wordsmith") return gradeWordsmith(puzzle, answer, msRemaining);
  return gradeSubmission(puzzle, answer, msRemaining, extra);
}
