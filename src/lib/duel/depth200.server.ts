/**
 * Depth to 200, server only: the one depth path (gradeAnswer calls it once, after the game's own grade and
 * today's puzzleScoreRev 2 / 3 mapping, which caps at 150). Each stamped puzzle is routed to its game's depth
 * grader: the twelve Speed and Attention games (D3, docs/depth/d3-speed-attention.md) grade from the game's own
 * grade; the nine word games (wordDepth.server.ts, docs/depth/d1-word.md) from both; the Number games (depthRev 1,
 * numberDepth.server.ts, docs/depth/d2-number.md) from today's grade. A grader applies only to puzzles stamped with
 * its game's depth revision; every older round returns null and grades exactly as before. The D5 remodels
 * (Topsy-Turvy, Jumbled) already score to 200 in their own grader. Engine games score inside their sims and need
 * nothing here.
 */
import type { Graded } from "./grade";
import type { PuzzleData, PuzzleType } from "./types";
import { puzzleScoreRevOf } from "./puzzleScoreRev";
import { PUZZLE_SCORE_REV_BANDS, rev2Applies } from "./puzzleScoreRev2";
import { PUZZLE_SCORE_REV_HELPER, rev3Applies } from "./puzzleScoreRev3";
import { NUMBER_DEPTH_GAMES, usesNumberDepth } from "./numberDepth";
import { withNumberDepth } from "./numberDepth.server";
import { flashDepth } from "./depth/flash.server";
import { ascendDepth } from "./depth/ascend.server";
import { bangOnDepth } from "./depth/bangOn.server";
import { chainDepth } from "./depth/chain.server";
import { eagleEyeDepth } from "./depth/eagleEye.server";
import { doubleTakeDepth } from "./depth/doubleTake.server";
import { tallyDepth } from "./depth/tally.server";
import { labyrinthDepth } from "./depth/labyrinth.server";
import { matchmakerDepth } from "./depth/matchmaker.server";
import { WORD_DEPTH_GRADERS, type DepthGrader as WordDepthGrader } from "./wordDepth.server";
import { isTopsy } from "./topsy";
import { isJumbledGradient } from "./jumbled";

export interface DepthGradeInput {
  puzzle: PuzzleData;
  answer: string;
  /** The game's own grade (grade.ts, rev-1 shape with its breakdown in `extra.parts`). */
  graded: Graded;
  /** Today's grade (puzzleScoreRev 3's helper or rev 2's knots over `graded`), worked out on first call. */
  today: () => Graded;
  receivedMsRemaining?: number | undefined;
}

export interface DepthGrader {
  /** True for puzzles stamped with the game's depth revision. */
  applies(puzzle: PuzzleData): boolean;
  grade(input: DepthGradeInput): Graded;
}

/**
 * Number depth (depthRev 1): applies where today's rev-3 / rev-2 mapping applies (as when it ran inside those
 * branches), and adds its stretch or feature to today's grade.
 */
const numberDepth: DepthGrader = {
  applies: (puzzle) => {
    const rev = puzzleScoreRevOf(puzzle);
    return usesNumberDepth(puzzle) && ((rev >= PUZZLE_SCORE_REV_HELPER && rev3Applies(puzzle.type)) || (rev >= PUZZLE_SCORE_REV_BANDS && rev2Applies(puzzle.type)));
  },
  grade: ({ puzzle, answer, today }) => withNumberDepth(puzzle, answer, today()),
};

/** The word games (wordDepth.server.ts, docs/depth/d1-word.md), each by its own stamp, from the game's own grade and today's. */
const wordDepth = (g: WordDepthGrader): DepthGrader => ({ applies: g.applies, grade: (input) => g.grade({ ...input, today: input.today() }) });

/** The D5 remodels (Topsy-Turvy gravityRev 3, Jumbled tilesRev 3, docs/depth/d5-remodels.md) score to 200 in their own grader. */
const ownGrade = (applies: (puzzle: PuzzleData) => boolean): DepthGrader => ({ applies, grade: ({ graded }) => graded });

const GRADERS: Partial<Record<PuzzleType, DepthGrader>> = {
  ...Object.fromEntries(Object.entries(WORD_DEPTH_GRADERS).map(([type, g]) => [type, wordDepth(g!)])),
  ...Object.fromEntries(Object.keys(NUMBER_DEPTH_GAMES).map((type) => [type, numberDepth])),
  reaction: flashDepth,
  numhunt: ascendDepth,
  stopwatch: bangOnDepth,
  chain: chainDepth,
  symscan: eagleEyeDepth,
  spotdiff: doubleTakeDepth,
  countup: tallyDepth,
  maze: labyrinthDepth,
  pairmatch: matchmakerDepth,
  gravity: ownGrade(isTopsy),
  tiles: ownGrade(isJumbledGradient),
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
