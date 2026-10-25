/**
 * Word depth grading (25 Oct 2026, depth session d1; wordDepth.ts, docs/depth/d1-word.md). Server-only.
 *
 * gradeAnswer (generate.server.ts) hands a puzzle that carries its game's depth stamp here after grading it as
 * today's stamps would: `graded` is the game's own grade (the rev-1 shape), `today` the final grade rev 3 / rev 2
 * gives. Each game's depth grader (src/lib/duel/depth/<type>.server.ts) turns them into the 200-point score.
 * A puzzle without its depth stamp never reaches a depth grader, so stored rounds grade exactly as before.
 */
import type { Graded } from "./grade";
import type { PuzzleData, PuzzleType } from "./types";
import { wordsmithDepth } from "./depth/wordsmith.server";
import { tilegridDepth } from "./depth/tilegrid.server";
import { wordslideDepth } from "./depth/wordslide.server";
import { wordhuntDepth } from "./depth/wordhunt.server";
import { wordsearchDepth } from "./depth/wordsearch.server";
import { letterwheelDepth } from "./depth/letterwheel.server";
import { strikeoutDepth } from "./depth/strikeout.server";
import { codewordDepth } from "./depth/codeword.server";
import { swapwordDepth } from "./depth/swapword.server";

export interface DepthContext {
  puzzle: PuzzleData;
  answer: string;
  /** The game's own grade before rev 2 / rev 3 (the rev-1 shape: `extra.parts`, isCorrect, storedMs). */
  graded: Graded;
  /** The grade today's stamps give (rev 3's helper or rev 2's curve): at most 150. */
  today: Graded;
  receivedMsRemaining?: number | undefined;
}

export interface DepthGrader {
  /** True when the stored puzzle carries this game's depth stamp. */
  applies(puzzle: PuzzleData): boolean;
  grade(ctx: DepthContext): Graded;
}

export const WORD_DEPTH_GRADERS: Partial<Record<PuzzleType, DepthGrader>> = {
  wordsmith: wordsmithDepth,
  tilegrid: tilegridDepth,
  wordslide: wordslideDepth,
  wordhunt: wordhuntDepth,
  wordsearch: wordsearchDepth,
  letterwheel: letterwheelDepth,
  strikeout: strikeoutDepth,
  codeword: codewordDepth,
  swapword: swapwordDepth,
};

/** The depth grader for a stored puzzle, or null when it carries no depth stamp. */
export function wordDepthGrader(puzzle: PuzzleData): DepthGrader | null {
  const grader = WORD_DEPTH_GRADERS[puzzle.type];
  return grader && grader.applies(puzzle) ? grader : null;
}
