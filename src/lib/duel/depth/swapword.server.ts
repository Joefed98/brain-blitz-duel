/**
 * Swapword's depth grader (word depth d1, `swapwordRev 4`; parBonus.ts, docs/depth/d1-word.md): today's score
 * (rev 3's helper, at most 150) plus the par bonus for a finish in the board's proven fewest swaps. Unfinished
 * rounds and finishes over par score exactly as today.
 */
import type { Graded } from "../grade";
import { parBonusPoints } from "../parBonus";
import { puzzleTimeLimitMs } from "../registry";
import { SWAPWORD_REV_PAR, SWAP_PAR_BONUS } from "../swapword";
import { withBonus } from "../wordDepth";
import type { DepthGrader } from "../wordDepth.server";
import { parGrade } from "./parGrade";

export const swapwordDepth: DepthGrader = {
  applies: (puzzle) => puzzle.type === "swapword" && puzzle.swapwordRev >= SWAPWORD_REV_PAR,
  grade: ({ puzzle, today }): Graded => {
    if (puzzle.type !== "swapword") return today;
    const swaps = Number((today.extra as { swaps?: number } | null)?.swaps ?? Infinity);
    const atPar = today.isCorrect && swaps <= puzzle.minSwaps;
    const left = today.storedMs / Math.max(1, puzzleTimeLimitMs(puzzle));
    const bonus = parBonusPoints(SWAP_PAR_BONUS, atPar, left);
    return parGrade(today, withBonus(today.score, bonus), bonus, { atPar });
  },
};
