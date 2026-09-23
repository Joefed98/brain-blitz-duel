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
import { TOTAL_ROUNDS, type GoNoGoItem, type PuzzleData, type PuzzleType } from "./types";
import { generateUnblock, type UnblockBankRow } from "./unblock.server";
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
import { generateStroke } from "./stroke.server";
import { generateTiles } from "./tiles.server";
import { generateRings } from "./rings.server";
import { generateHover } from "./hover.server";
import {
  generateBinToss,
  generateBullseye,
  generateMatchup,
  generateCross,
  generateDual,
  generateRicochet,
  generateBreaker,
  generateRally,
  generateSteady,
  generateSlice,
  generateBubble,
  generateBeat,
  generateSkyline,
  generateSnake,
  generateSwerve,
} from "./arcade.server";

import { buildGoNoGo } from "@/puzzles/goNoGo";

/** Room-level context a generator may need beyond its own randomness. */
export interface GenerateContext {
  /** The opening item of the host's previous Go / No-Go run, if there was one. */
  previousGoNoGoFirst?: GoNoGoItem | null;
  /** A pre-drawn Unblock bank row, so building a room never runs a solver. */
  unblockRow?: UnblockBankRow | null;
}

export function generatePuzzle(type: PuzzleType, context: GenerateContext = {}): PuzzleData {
  if (type === "gonogo") return buildGoNoGo(context.previousGoNoGoFirst ?? null);
  if (type === "wordsmith") return generateWordsmith();
  if (type === "wordhunt") return generateWordHunt();
  if (type === "unblock") return generateUnblock(context.unblockRow);
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
  if (type === "stroke") return generateStroke();
  if (type === "tiles") return generateTiles();
  if (type === "rings") return generateRings();
  if (type === "hover") return generateHover();
  if (type === "swerve") return generateSwerve();
  if (type === "skyline") return generateSkyline();
  if (type === "bintoss") return generateBinToss();
  if (type === "bullseye") return generateBullseye();
  if (type === "matchup") return generateMatchup();
  if (type === "snake") return generateSnake();
  if (type === "cross") return generateCross();
  if (type === "dual") return generateDual();
  if (type === "ricochet") return generateRicochet();
  if (type === "breaker") return generateBreaker();
  if (type === "rally") return generateRally();
  if (type === "steady") return generateSteady();
  if (type === "slice") return generateSlice();
  if (type === "bubble") return generateBubble();
  if (type === "beat") return generateBeat();

  return puzzleDef(type).generate();
}

/** Generated ONCE per room so every player receives identical puzzles. */
export function buildRoomPuzzles(options: RoundSelectionOptions & GenerateContext = {}): {
  roundOrder: PuzzleType[];
  puzzles: PuzzleData[];
} {
  const roundOrder = pickRoundOrder({ rounds: TOTAL_ROUNDS, ...options });
  return {
    roundOrder,
    puzzles: roundOrder.map((type) =>
      generatePuzzle(type, {
        previousGoNoGoFirst: options.previousGoNoGoFirst ?? null,
        unblockRow: options.unblockRow ?? null,
      }),
    ),
  };
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
