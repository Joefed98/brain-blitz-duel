/**
 * Lookout's depth grader (wordSearchRev 3, word depth 25 Oct 2026; docs/depth/d1-word.md). FEATURE: a hidden,
 * unlisted on-theme bonus word. Today's rev-3 grade (at most 150; drags on the bonus never count as wrong picks)
 * plus the bonus word's points (wsBonusPoints), the only way past 150.
 */
import type { DepthGrader } from "../wordDepth.server";
import type { PuzzleData } from "../types";
import { storedScoreParts, type ScoreParts } from "../puzzleScoreRev";
import { withBonus } from "../wordDepth";
import { wsBonusPoints, wsHasBonus } from "../wordSearch";

export const wordsearchDepth: DepthGrader = {
  applies: (puzzle: PuzzleData) => puzzle.type === "wordsearch" && wsHasBonus(puzzle) && puzzle.bonus !== undefined,
  grade(ctx) {
    const today = ctx.today;
    const extra = today.extra ?? {};
    const bonusFound = extra["bonusFound"] === true;
    const finished = today.isCorrect;
    const left = typeof extra["time"] === "number" ? (extra["time"] as number) : 0;
    const bonusPoints = wsBonusPoints(bonusFound, finished, left);
    const score = withBonus(today.score, bonusPoints);
    const before = storedScoreParts(extra);
    const parts: ScoreParts =
      finished && before?.kind === "finish" && bonusPoints > 0
        ? { kind: "finish", base: before.base, efficiency: score - before.base - (before.speed ?? 0), measure: "bonus word", speed: before.speed ?? 0 }
        : finished && before
          ? before
          : { kind: "partial", base: score };
    return { ...today, score, extra: { ...extra, parts, bonusPoints, todayScore: today.score } };
  },
};
