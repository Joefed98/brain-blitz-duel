/** Tally countRev 3 (depth/tally.ts): rev 3's grade, stretched to 200 (a finish is four exact counts: no mistakes). */
import type { DepthGrader } from "../depth200.server";
import { puzzleScoreRevOf } from "../puzzleScoreRev";
import { PUZZLE_SCORE_REV_HELPER } from "../puzzleScoreRev3";
import { attentionStretchGrade } from "./attentionStretch.server";
import { COUNT_DEPTH_CURVE, COUNT_TOPUP_CURVE, COUNT_TOPUP_REV, COUNT_TOPUP_STRETCH_FROM, usesCountDepth } from "./tally";

export const tallyDepth: DepthGrader = {
  applies: (p) => p.type === "countup" && usesCountDepth(p) && puzzleScoreRevOf(p) >= PUZZLE_SCORE_REV_HELPER,
  grade: (input) =>
    input.puzzle.type === "countup" && (input.puzzle.countRev ?? 0) >= COUNT_TOPUP_REV
      ? attentionStretchGrade(input, { curve: COUNT_TOPUP_CURVE, keep: 1, stretchFrom: COUNT_TOPUP_STRETCH_FROM })
      : attentionStretchGrade(input, { curve: COUNT_DEPTH_CURVE, keep: 1 }),
};
