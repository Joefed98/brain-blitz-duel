/**
 * Server-only puzzle building and grading. Types whose content needs the
 * dictionary or a solver (Wordsmith, Word Hunt, Unblock, Block Party) are
 * handled here, so nothing answer-shaped is ever reachable from a client bundle.
 */

import { generateBlockParty } from "./blockParty.server";
import { generateGroups } from "./groups.server";
import { gradeSubmission, type Graded, type SubmitExtra } from "./grade";
import { pickRoundOrder } from "./puzzles";
import { puzzleDef } from "./registry";
import { TOTAL_ROUNDS, type PuzzleData, type PuzzleType } from "./types";
import { generateUnblock } from "./unblock.server";
import { generateWordHunt, gradeWordHunt } from "./wordHunt.server";
import { generateWordsmith, gradeWordsmith } from "./wordsmith.server";

export function generatePuzzle(type: PuzzleType): PuzzleData {
  if (type === "wordsmith") return generateWordsmith();
  if (type === "wordhunt") return generateWordHunt();
  if (type === "unblock") return generateUnblock();
  if (type === "blockparty") return generateBlockParty();
  if (type === "groups") return generateGroups();
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
  if (puzzle.type === "wordhunt") return gradeWordHunt(puzzle, answer, msRemaining);
  return gradeSubmission(puzzle, answer, msRemaining, extra);
}
