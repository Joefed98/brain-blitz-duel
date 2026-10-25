/** Eagle Eye scanRev 2 (depth/eagleEye.ts): rev 3's grade, stretched to 200; taps taken back cut the climb. */
import type { DepthGrader } from "../depth200.server";
import { puzzleScoreRevOf } from "../puzzleScoreRev";
import { PUZZLE_SCORE_REV_HELPER } from "../puzzleScoreRev3";
import { attentionStretchGrade } from "./attentionStretch.server";
import { SCAN_DEPTH_CURVE, scanCorrectionKeep, scanCorrections, usesScanDepth } from "./eagleEye";

export const eagleEyeDepth: DepthGrader = {
  applies: (p) => p.type === "symscan" && usesScanDepth(p) && puzzleScoreRevOf(p) >= PUZZLE_SCORE_REV_HELPER,
  grade: (input) => attentionStretchGrade(input, { curve: SCAN_DEPTH_CURVE, keep: scanCorrectionKeep(scanCorrections(input.answer)) }),
};
