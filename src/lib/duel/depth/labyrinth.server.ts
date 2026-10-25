/**
 * Labyrinth depth grader (mazeRev 1; depth/labyrinth.ts). The game's own case in grade.ts has already re-walked the
 * trail and graded its route on the rev-1 shape (stars taken in `extra.stars`); here that becomes the score:
 *   - unfinished: puzzleScoreRev 3's progress score (up to 110), stars not counted;
 *   - finished: 120 + up to 30 for speed (puzzleScoreRev 3's Labyrinth curve, 150 with 48 % of the clock left) plus
 *     each star taken, LAB_STAR_POINTS × min(1, left ÷ LAB_STAR_FAST_SHARE)². The breakdown adds up to the score.
 */
import type { DepthGrader } from "../depth200.server";
import { storedScoreParts } from "../puzzleScoreRev";
import { rev3Finish, rev3Unfinished } from "../puzzleScoreRev3";
import { puzzleTimeLimitMs } from "../registry";
import { depthClamp } from "../depth200";
import { labStarPoints, usesMazeDepth } from "./labyrinth";

export const labyrinthDepth: DepthGrader = {
  applies: (puzzle) => usesMazeDepth(puzzle),
  grade: ({ puzzle, graded }) => {
    const limit = puzzleTimeLimitMs(puzzle);
    const parts1 = storedScoreParts(graded.extra);
    const finished = graded.isCorrect && (parts1 === null || parts1.kind === "finish");
    const taken = Array.isArray(graded.extra?.["stars"]) ? (graded.extra!["stars"] as number[]) : [];
    if (!finished) {
      const r = rev3Unfinished("maze", Math.max(0, parts1 ? parts1.base : graded.score) / 110);
      return { ...graded, isCorrect: false, score: r.score, extra: { ...(graded.extra ?? {}), parts: r.parts, rev1Score: graded.score, progressShare: r.progress } };
    }
    const r = rev3Finish("maze", graded.storedMs, limit, 1);
    const left = r.time ?? 0;
    const starPoints = taken.map((i) => labStarPoints(i, left));
    const bonus = starPoints.reduce((a, b) => a + b, 0);
    const score = depthClamp(r.score + bonus);
    return {
      ...graded,
      isCorrect: true,
      score,
      extra: { ...(graded.extra ?? {}), parts: r.parts, rev1Score: graded.score, time: r.time, efficiency: r.efficiency, starPoints, starBonus: bonus },
    };
  },
};
