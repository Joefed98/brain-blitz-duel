/**
 * Server-only puzzle building and grading. Types whose content needs the
 * dictionary or a solver (Wordsmith, Word Hunt, Unblock, Block Party) are
 * handled here, so nothing answer-shaped is ever reachable from a client bundle.
 */

import { generateBlockParty } from "./blockParty.server";
import { generateGroups } from "./groups.server";
import { gradeSubmission, type Graded, type SubmitExtra } from "./grade";
import { pickRoundOrder, type RoundSelectionOptions } from "./selection";
import { puzzleDef } from "./registry";
import { TOTAL_ROUNDS, type PuzzleData, type PuzzleType } from "./types";
import { generateUnblock } from "./unblock.server";
import { generateWordHunt, gradeWordHunt } from "./wordHunt.server";
import { generateWordsmith, gradeWordsmith } from "./wordsmith.server";
import { generateWordLadder } from "./wordLadder.server";
import { generateLightsOut, generatePipes, generateSudoku } from "./logic.server";
import { generateFlow } from "./flow.server";
import { generateIceSlide } from "./slide.server";
import { generatePush } from "./push.server";
import { generateLaser } from "./laser.server";
import { generateTower } from "./tower.server";
import { generateMaze } from "./maze.server";
import { generateTubes } from "./tubes.server";
import { generateSafe } from "./safe.server";
import { generateBomb } from "./bomb.server";
import { generateGravity } from "./gravity.server";
import { generateChain } from "./chain.server";
import { generateIntruder } from "./intruder.server";
import { generateNonogram } from "./nonogram.server";
import { generatePairMatch } from "./pairmatch.server";
import { generateFlood } from "./flood.server";

export function generatePuzzle(type: PuzzleType): PuzzleData {
  if (type === "wordsmith") return generateWordsmith();
  if (type === "wordhunt") return generateWordHunt();
  if (type === "unblock") return generateUnblock();
  if (type === "blockparty") return generateBlockParty();
  if (type === "groups") return generateGroups();
  if (type === "ladder") return generateWordLadder();
  if (type === "lightsout") return generateLightsOut();
  if (type === "pipes") return generatePipes();
  if (type === "sudoku") return generateSudoku();
  if (type === "flow") return generateFlow();
  if (type === "iceslide") return generateIceSlide();
  if (type === "push") return generatePush();
  if (type === "laser") return generateLaser();
  if (type === "tower") return generateTower();
  if (type === "maze") return generateMaze();
  if (type === "tubes") return generateTubes();
  if (type === "safe") return generateSafe();
  if (type === "bomb") return generateBomb();
  if (type === "gravity") return generateGravity();
  if (type === "chain") return generateChain();
  if (type === "intruder") return generateIntruder();
  if (type === "nonogram") return generateNonogram();
  if (type === "pairmatch") return generatePairMatch();
  if (type === "flood") return generateFlood();
  return puzzleDef(type).generate();
}

/** Generated ONCE per room so every player receives identical puzzles. */
export function buildRoomPuzzles(options: RoundSelectionOptions = {}): {
  roundOrder: PuzzleType[];
  puzzles: PuzzleData[];
} {
  const roundOrder = pickRoundOrder({ rounds: TOTAL_ROUNDS, ...options });
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
