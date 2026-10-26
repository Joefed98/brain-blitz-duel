/** Eagle Eye scanRev 2 (depth/eagleEye.ts): rev 3's grade, stretched to 200; taps taken back cut the climb. */
import type { DepthGrader } from "../depth200.server";
import { puzzleScoreRevOf } from "../puzzleScoreRev";
import { PUZZLE_SCORE_REV_HELPER } from "../puzzleScoreRev3";
import { attentionStretchGrade } from "./attentionStretch.server";
import { SCAN_DEPTH_CURVE, SCAN_TOPUP_CURVE, SCAN_TOPUP_REV, SCAN_TOPUP_STRETCH_FROM, scanCorrectionKeep, scanCorrections, usesScanDepth } from "./eagleEye";

export const eagleEyeDepth: DepthGrader = {
  applies: (p) => p.type === "symscan" && usesScanDepth(p) && puzzleScoreRevOf(p) >= PUZZLE_SCORE_REV_HELPER,
  grade: (input) => {
    const keep = scanCorrectionKeep(scanCorrections(input.answer));
    const topup = input.puzzle.type === "symscan" && (input.puzzle.scanRev ?? 0) >= SCAN_TOPUP_REV;
    return attentionStretchGrade(input, topup ? { curve: SCAN_TOPUP_CURVE, keep, stretchFrom: SCAN_TOPUP_STRETCH_FROM } : { curve: SCAN_DEPTH_CURVE, keep });
  },
};
