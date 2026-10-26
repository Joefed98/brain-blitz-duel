/**
 * Don't Break the Chain, Depth to 200 grader (`chainDepthRev: 1`, depth/chain.ts): puzzleScoreRev 3's finish and
 * credit, the finish stretched above 150 and the milestones added. Older rounds never reach here.
 */
import { puzzleScoreRevOf } from "../puzzleScoreRev";
import { PUZZLE_SCORE_REV_HELPER } from "../puzzleScoreRev3";
import type { DepthGrader } from "../depth200.server";
import { depthClamp, stretchFinishScore } from "../depth200";
import { decodeChainAnswer, replayChain } from "../chain";
import { storedScoreParts } from "../puzzleScoreRev";
import { rev3Efficiency, rev3Unfinished } from "../puzzleScoreRev3";
import { puzzleTimeLimitMs } from "../registry";
import { CHAIN_DEPTH_UNFINISHED_TOP, chainDepthRevOf, chainMilestoneTotal, chainMilestones, chainStretchFor, chainUsesDepth } from "./chain";

export const chainDepth: DepthGrader = {
  // Only on puzzleScoreRev 3 (the dealt shape): a check pinning rev 1 / 2 keeps proving that shape.
  applies: (puzzle) => puzzle.type === "chain" && chainUsesDepth(puzzle) && puzzleScoreRevOf(puzzle) >= PUZZLE_SCORE_REV_HELPER,
  grade: ({ puzzle, answer, graded }) => {
    if (puzzle.type !== "chain") return graded;
    const limit = puzzleTimeLimitMs(puzzle);
    const decoded = decodeChainAnswer(answer);
    const replay = replayChain(puzzle, decoded);
    const milestones = chainMilestones(decoded.taps, replay.links, chainDepthRevOf(puzzle));
    const milestonePoints = chainMilestoneTotal(milestones);
    const parts1 = storedScoreParts(graded.extra);
    const finished = graded.isCorrect && (parts1 === null || parts1.kind === "finish");
    const detail = { milestones: milestones.map((m) => ({ at: m.at, gapMs: m.gapMs, points: m.points })), milestonePoints, rev1Score: graded.score };
    if (finished) {
      const left = limit > 0 ? Math.max(0, Math.min(limit, graded.storedMs)) / limit : 0;
      const efficiency = rev3Efficiency(parts1, graded.storedMs, limit);
      const f = stretchFinishScore(chainStretchFor(chainDepthRevOf(puzzle)), left, efficiency);
      const score = depthClamp(f.score + milestonePoints);
      return {
        ...graded,
        isCorrect: true,
        score,
        extra: { ...(graded.extra ?? {}), ...detail, parts: { kind: "finish", base: 120, speed: f.speed }, stretch: f.stretch, time: Math.round(left * 1000) / 1000, efficiency: Math.round(efficiency * 1000) / 1000 },
      };
    }
    const base = rev3Unfinished("chain", Math.max(0, parts1 ? parts1.base : graded.score) / 110);
    const score = depthClamp(Math.min(CHAIN_DEPTH_UNFINISHED_TOP, base.score + milestonePoints));
    return { ...graded, isCorrect: false, score, extra: { ...(graded.extra ?? {}), ...detail, parts: base.parts, progressShare: base.progress } };
  },
};
