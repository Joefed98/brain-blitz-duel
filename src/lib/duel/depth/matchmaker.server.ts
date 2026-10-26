/**
 * Matchmaker, Depth to 200 grader (`pairRev: 1`, depth/matchmaker.ts): puzzleScoreRev 3's score (at most 150)
 * plus the streak and gold-pair bonuses walked from the same flips. Older rounds never reach here.
 */
import { puzzleScoreRevOf } from "../puzzleScoreRev";
import { PUZZLE_SCORE_REV_HELPER } from "../puzzleScoreRev3";
import type { DepthGrader } from "../depth200.server";
import { depthClamp } from "../depth200";
import { decodePairFlips } from "../pairmatch";
import { storedScoreParts } from "../puzzleScoreRev";
import { rev3Efficiency, rev3Finish, rev3Unfinished } from "../puzzleScoreRev3";
import { rev3Progress } from "../puzzleProgress";
import { latestTapMs } from "../grade";
import { puzzleTimeLimitMs } from "../registry";
import { pairDepthReplay, pairUsesDepth } from "./matchmaker";

export const matchmakerDepth: DepthGrader = {
  // Only on puzzleScoreRev 3 (the dealt shape): a check pinning rev 1 / 2 keeps proving that shape.
  applies: (puzzle) => puzzle.type === "pairmatch" && pairUsesDepth(puzzle) && puzzleScoreRevOf(puzzle) >= PUZZLE_SCORE_REV_HELPER,
  grade: ({ puzzle, answer, graded, receivedMsRemaining }) => {
    if (puzzle.type !== "pairmatch") return graded;
    const limit = puzzleTimeLimitMs(puzzle);
    const parts1 = storedScoreParts(graded.extra);
    const finished = graded.isCorrect && (parts1 === null || parts1.kind === "finish");
    // The same arithmetic as puzzleScoreRev 3 (generate.server.ts withRev3) for the base.
    const base = finished
      ? rev3Finish("pairmatch", graded.storedMs, limit, rev3Efficiency(parts1, graded.storedMs, limit))
      : rev3Unfinished(
          "pairmatch",
          rev3Progress({ puzzle, answer, extra: graded.extra, latestMs: latestTapMs(limit, receivedMsRemaining) }) ?? Math.max(0, parts1 ? parts1.base : graded.score) / 110,
        );
    const d = pairDepthReplay(puzzle, decodePairFlips(answer));
    const score = depthClamp(base.score + d.streakBonus + d.goldBonus);
    const shares = finished ? { time: base.time, efficiency: base.efficiency } : { progressShare: base.progress };
    return {
      ...graded,
      isCorrect: finished,
      score,
      extra: {
        ...(graded.extra ?? {}),
        parts: base.parts,
        rev1Score: graded.score,
        ...shares,
        baseScore: base.score,
        streakBonus: d.streakBonus,
        bestStreak: d.bestStreak,
        goldTry: d.goldTry,
        goldBonus: d.goldBonus,
      },
    };
  },
};
