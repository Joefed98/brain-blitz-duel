/**
 * Forage's depth grader (wordHuntRev 3; wordHunt.ts, wordDepth.server.ts). gradeWordHunt already scores a
 * wordHuntRev 3 board on its own two curves (base points to 150, long-word and golden extras to 50): that grade is
 * the round's score, not passed through rev 2's knots. The breakdown stored for the reveal adds up to it.
 */
import type { DepthGrader } from "../wordDepth.server";
import { wordHuntDepth } from "../wordHunt";
import type { ScoreParts } from "../puzzleScoreRev";

export const wordhuntDepth: DepthGrader = {
  applies: (puzzle) => puzzle.type === "wordhunt" && wordHuntDepth(puzzle),
  grade: ({ graded }) => {
    const parts: ScoreParts = { kind: "partial", base: graded.score };
    return { ...graded, extra: { ...(graded.extra ?? {}), parts, rev1Score: graded.score } };
  },
};
