/**
 * Strikeout's depth grader (strikeoutRev 5, word depth 25 Oct 2026; docs/depth/d1-word.md). STRETCH + the
 * early-solve bonus: rev 4's rules exactly. An unfinished round scores exactly what rev 3 gives. A finish keeps
 * rev 3's 120 + speed and adds two bonuses (together up to 50):
 *   - pace bonus, up to 25: finishing clearly faster than today's 150 pace with few strikes (stretch.server.ts);
 *   - early solves, up to 25: the share of each word's hidden tiles still hidden when it was solved with Solve
 *     (so2EarlySolves, over all five words; 0.8 or more counts in full), counted in full only on a quick finish
 *     (× min(1, time left ÷ rev 3's fastShare)³).
 */
import type { DepthGrader } from "../wordDepth.server";
import type { PuzzleData } from "../types";
import { isWord } from "../dictionary.server";
import { decodeStrikeout2, so2EarlySolves, so2Rules, strikeoutRevOf, STRIKEOUT_REV5, STRIKEOUT_REV_TOPUP } from "../strikeout";
import { rev3Game } from "../puzzleScoreRev3";
import { addFinishBonus, finishFigures, stretchPoints } from "./stretch.server";
import {
  STRIKEOUT_EARLY_FULL,
  STRIKEOUT_EARLY_POINTS,
  STRIKEOUT_EARLY_QUICK_POWER,
  STRIKEOUT_PACE_POINTS,
  STRIKEOUT_STRETCH,
  STRIKEOUT_TOPUP_EARLY_FROM,
  STRIKEOUT_TOPUP_EARLY_FULL_AT,
  STRIKEOUT_TOPUP_PACE,
  stretchCurveFor,
} from "./stretchShapes";

export function strikeoutEarlyPoints(share: number, left: number, rev = STRIKEOUT_REV5): number {
  const s = Math.max(0, Math.min(1, share / STRIKEOUT_EARLY_FULL));
  if (rev >= STRIKEOUT_REV_TOPUP) {
    const pace = Math.max(0, Math.min(1, (left - STRIKEOUT_TOPUP_EARLY_FROM) / (STRIKEOUT_TOPUP_EARLY_FULL_AT - STRIKEOUT_TOPUP_EARLY_FROM)));
    return Math.round(STRIKEOUT_EARLY_POINTS * s * pace);
  }
  const quick = Math.max(0, Math.min(1, left / rev3Game("strikeout").fastShare));
  return Math.round(STRIKEOUT_EARLY_POINTS * s * Math.pow(quick, STRIKEOUT_EARLY_QUICK_POWER));
}

export const strikeoutDepth: DepthGrader = {
  applies: (puzzle: PuzzleData) => puzzle.type === "strikeout" && strikeoutRevOf(puzzle) >= STRIKEOUT_REV5,
  grade(ctx) {
    const f = finishFigures(ctx.today);
    if (!f || ctx.puzzle.type !== "strikeout") return ctx.today;
    const p = ctx.puzzle;
    const early = so2EarlySolves(p.words ?? [], p.givens ?? [], decodeStrikeout2(ctx.answer), isWord, so2Rules(strikeoutRevOf(p)));
    const rev = strikeoutRevOf(p);
    const pace = stretchPoints(stretchCurveFor("strikeout", rev >= STRIKEOUT_REV_TOPUP ? STRIKEOUT_TOPUP_PACE : STRIKEOUT_STRETCH), f.time, f.efficiency, STRIKEOUT_PACE_POINTS);
    const earlyPts = strikeoutEarlyPoints(early.share, f.time, rev);
    return addFinishBonus(ctx.today, f.parts, pace + earlyPts, "pace and early-solve bonus", {
      paceBonus: pace,
      earlyBonus: earlyPts,
      earlyShare: Math.round(early.share * 1000) / 1000,
      hiddenAtSolve: early.hiddenAtSolve,
    });
  },
};
