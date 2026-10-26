/**
 * Interlock's depth grader (tileGridRev 1, word depth 25 Oct 2026; docs/depth/d1-word.md). STRETCH: the game is
 * unchanged. An unfinished grid scores exactly what rev 3 gives; a finish keeps rev 3's 120 + speed and adds up to
 * 50 pace bonus for finishing clearly faster than today's 150 pace (stretch.server.ts).
 */
import type { DepthGrader } from "../wordDepth.server";
import type { PuzzleData } from "../types";
import { TILE_GRID_DEPTH_REV, TILE_GRID_TOPUP_REV } from "../tileGrid";
import { addFinishBonus, finishFigures, stretchPoints } from "./stretch.server";
import { TILEGRID_STRETCH, TILEGRID_STRETCH_TOPUP, stretchCurveFor } from "./stretchShapes";

export const tilegridDepth: DepthGrader = {
  applies: (puzzle: PuzzleData) => puzzle.type === "tilegrid" && (puzzle.tileGridRev ?? 0) >= TILE_GRID_DEPTH_REV,
  grade(ctx) {
    const f = finishFigures(ctx.today);
    if (!f) return ctx.today;
    const shape = ((ctx.puzzle as { tileGridRev?: number }).tileGridRev ?? 0) >= TILE_GRID_TOPUP_REV ? TILEGRID_STRETCH_TOPUP : TILEGRID_STRETCH;
    const pace = stretchPoints(stretchCurveFor("tilegrid", shape), f.time, f.efficiency, 50);
    return addFinishBonus(ctx.today, f.parts, pace, "pace bonus", { paceBonus: pace });
  },
};
