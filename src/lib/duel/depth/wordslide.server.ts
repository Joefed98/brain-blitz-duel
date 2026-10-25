/**
 * Slider's depth grader (word depth d1, `wordSlideRev 1`; parBonus.ts, docs/depth/d1-word.md): today's score
 * (rev 3's helper, at most 150) plus the par bonus for a finish in at most `par` moves. Unfinished rounds and
 * finishes over par score exactly as today.
 */
import type { Graded } from "../grade";
import { parBonusPoints } from "../parBonus";
import { puzzleTimeLimitMs } from "../registry";
import { withBonus } from "../wordDepth";
import type { DepthGrader } from "../wordDepth.server";
import { SLIDE_PAR_BONUS, WORD_SLIDE_REV_PAR, wordSlideRevOf } from "../wordSlide";
import { parGrade } from "./parGrade";

export const wordslideDepth: DepthGrader = {
  applies: (puzzle) => puzzle.type === "wordslide" && wordSlideRevOf(puzzle) >= WORD_SLIDE_REV_PAR,
  grade: ({ puzzle, today }): Graded => {
    if (puzzle.type !== "wordslide") return today;
    const moves = Number((today.extra as { moves?: number } | null)?.moves ?? Infinity);
    const atPar = today.isCorrect && moves <= puzzle.par;
    const left = today.storedMs / Math.max(1, puzzleTimeLimitMs(puzzle));
    const bonus = parBonusPoints(SLIDE_PAR_BONUS, atPar, left);
    return parGrade(today, withBonus(today.score, bonus), bonus, { atPar, wordSlideRev: WORD_SLIDE_REV_PAR });
  },
};
