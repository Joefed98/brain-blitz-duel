/**
 * Depth to 200 (25 Oct 2026, docs/depth/d3-speed-attention.md), server only: the twelve Speed and Attention
 * games' new revisions grade here, after the game's own case in grade.ts and instead of puzzleScoreRev 2 / 3's
 * mapping (which caps at 150). A game's grader applies only to puzzles stamped with its new revision; every older
 * round returns null and grades exactly as before. Engine games (Bonk, Pull!, Mixed Signals) score inside their
 * sims and need nothing here.
 */
import type { Graded } from "./grade";
import type { PuzzleData, PuzzleType } from "./types";
import { flashDepth } from "./depth/flash.server";
import { ascendDepth } from "./depth/ascend.server";
import { bangOnDepth } from "./depth/bangOn.server";
import { chainDepth } from "./depth/chain.server";
import { eagleEyeDepth } from "./depth/eagleEye.server";
import { doubleTakeDepth } from "./depth/doubleTake.server";
import { tallyDepth } from "./depth/tally.server";
import { labyrinthDepth } from "./depth/labyrinth.server";
import { matchmakerDepth } from "./depth/matchmaker.server";

export interface DepthGradeInput {
  puzzle: PuzzleData;
  answer: string;
  /** The game's own grade (grade.ts, rev-1 shape with its breakdown in `extra.parts`). */
  graded: Graded;
  receivedMsRemaining?: number | undefined;
}

export interface DepthGrader {
  /** True for puzzles stamped with the game's depth revision. */
  applies(puzzle: PuzzleData): boolean;
  grade(input: DepthGradeInput): Graded;
}

const GRADERS: Partial<Record<PuzzleType, DepthGrader>> = {
  reaction: flashDepth,
  numhunt: ascendDepth,
  stopwatch: bangOnDepth,
  chain: chainDepth,
  symscan: eagleEyeDepth,
  spotdiff: doubleTakeDepth,
  countup: tallyDepth,
  maze: labyrinthDepth,
  pairmatch: matchmakerDepth,
};

/** The depth grade for a stamped puzzle, or null (every other puzzle: gradeAnswer carries on as before). */
export function gradeDepth200(input: DepthGradeInput): Graded | null {
  const grader = GRADERS[input.puzzle.type];
  return grader && grader.applies(input.puzzle) ? grader.grade(input) : null;
}

/** True when a stored puzzle is on its game's depth revision (scores up to 200). */
export function usesDepth200(puzzle: PuzzleData): boolean {
  return GRADERS[puzzle.type]?.applies(puzzle) ?? false;
}
