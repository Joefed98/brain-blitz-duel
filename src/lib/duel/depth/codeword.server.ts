/**
 * Cryptogrid's depth grader (codewordRev 4, word depth 25 Oct 2026; docs/depth/d1-word.md). STRETCH: rev 3's board
 * and rules. An unfinished grid scores exactly what rev 3 gives; a finish keeps rev 3's 120 + speed and adds up to
 * 50 pace bonus for finishing clearly faster than today's 150 pace with no wrong letters (stretch.server.ts).
 */
import type { DepthGrader } from "../wordDepth.server";
import type { PuzzleData } from "../types";
import { CODEWORD_DEPTH_REV } from "../codeword";
import { addFinishBonus, finishFigures, stretchPoints } from "./stretch.server";
import { CODEWORD_STRETCH, stretchCurveFor } from "./stretchShapes";

export const codewordDepth: DepthGrader = {
  applies: (puzzle: PuzzleData) => puzzle.type === "codeword" && (puzzle.codewordRev ?? 0) >= CODEWORD_DEPTH_REV,
  grade(ctx) {
    const f = finishFigures(ctx.today);
    if (!f) return ctx.today;
    const pace = stretchPoints(stretchCurveFor("codeword", CODEWORD_STRETCH), f.time, f.efficiency, 50);
    return addFinishBonus(ctx.today, f.parts, pace, "pace bonus", { paceBonus: pace });
  },
};
