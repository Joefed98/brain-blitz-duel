/** Double Take spotRev 2 (depth/doubleTake.ts): rev 3's grade, stretched (cut by wrong taps), plus the hidden difference. */
import type { DepthGrader } from "../depth200.server";
import { puzzleScoreRevOf } from "../puzzleScoreRev";
import { PUZZLE_SCORE_REV_HELPER } from "../puzzleScoreRev3";
import { attentionStretchGrade } from "./attentionStretch.server";
import { DOUBLE_TAKE_BONUS, SPOT_DEPTH_CURVE, spotWrongKeep, usesSpotDepth } from "./doubleTake";

export const doubleTakeDepth: DepthGrader = {
  applies: (p) => p.type === "spotdiff" && usesSpotDepth(p) && puzzleScoreRevOf(p) >= PUZZLE_SCORE_REV_HELPER,
  grade: (input) => {
    const extra = input.graded.extra ?? {};
    const wrong = Array.isArray(extra["wrong"]) ? (extra["wrong"] as number[]).reduce((a, b) => a + b, 0) : 0;
    const hidden = extra["hiddenFound"] === true;
    return attentionStretchGrade(input, {
      curve: SPOT_DEPTH_CURVE,
      keep: spotWrongKeep(wrong),
      bonus: { points: hidden ? DOUBLE_TAKE_BONUS : 0, measure: "hidden difference" },
    });
  },
};
