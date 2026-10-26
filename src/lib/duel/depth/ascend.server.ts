/**
 * Ascend depth grader (`tapRev: 5`, depth/ascend.ts): puzzleScoreRev 3's Ascend score exactly as gradeAnswer's
 * withRev3 works it out (a finish 120 + speed cut by wrong taps, unfinished 110 × progress), plus the flow streak's
 * points, to 200. Older stamps return null.
 */
import { puzzleScoreRevOf } from "../puzzleScoreRev";
import { PUZZLE_SCORE_REV_HELPER } from "../puzzleScoreRev3";
import { decodeNumberTaps } from "../tapLog";
import { latestTapMs } from "../grade";
import { puzzleTimeLimitMs } from "../registry";
import { storedScoreParts } from "../puzzleScoreRev";
import { rev3Efficiency, rev3Finish, rev3Unfinished } from "../puzzleScoreRev3";
import { rev3EfficiencyOverride, rev3Progress } from "../puzzleProgress";
import type { DepthGrader } from "../depth200.server";
import { ascendDepthScore, ascendFlow, usesAscendDepth } from "./ascend";

export const ascendDepth: DepthGrader = {
  // Only on puzzleScoreRev 3 (the dealt shape): a check pinning rev 1 / 2 keeps proving that shape.
  applies: (puzzle) => usesAscendDepth(puzzle) && puzzleScoreRevOf(puzzle) >= PUZZLE_SCORE_REV_HELPER,
  grade: ({ puzzle, answer, graded, receivedMsRemaining }) => {
    if (puzzle.type !== "numhunt") return graded;
    const limit = puzzleTimeLimitMs(puzzle);
    const latest = latestTapMs(limit, receivedMsRemaining);
    // puzzleScoreRev 3, as generate.server.ts withRev3 (Ascend has no progress override: rev 1's credit ÷ 110).
    const parts1 = storedScoreParts(graded.extra);
    const finished = graded.isCorrect && (parts1 === null || parts1.kind === "finish");
    const r = finished
      ? rev3Finish(puzzle.type, graded.storedMs, limit, rev3EfficiencyOverride(puzzle, graded.extra) ?? rev3Efficiency(parts1, graded.storedMs, limit))
      : rev3Unfinished(puzzle.type, rev3Progress({ puzzle, answer, extra: graded.extra, latestMs: latest }) ?? Math.max(0, parts1 ? parts1.base : graded.score) / 110);
    const shares = finished ? { time: r.time, efficiency: r.efficiency } : { progressShare: r.progress };
    const flow = ascendFlow(puzzle, decodeNumberTaps(graded.answer || answer, latest, puzzle).taps);
    return {
      ...graded,
      isCorrect: finished,
      score: ascendDepthScore(r.score, flow),
      extra: { ...(graded.extra ?? {}), parts: r.parts, rev1Score: graded.score, ...shares, depth: { base: r.score, flow: flow.points, bestFlow: flow.best } },
    };
  },
};
