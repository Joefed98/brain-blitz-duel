/**
 * Muggins' screen fill (display only; arenaFills.renderer.ts' rules): the baize's darker green edge runs on beyond the
 * world, below it and beside it, settling darker towards the screen's bottom. Still (no ambient).
 */
import type { ArenaSceneView } from "../arenaScene.renderer";
import { fillAbove, fillBelow, fillGradient, fillSides } from "../arenaFills.renderer";

export function mugginsFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const below = fillBelow(view);
  const above = fillAbove(view);
  if (above) fillGradient(ctx, above, above.y, above.y + above.h, [[0, "#04170C"], [1, "#062012"]]);
  for (const side of fillSides(view)) fillGradient(ctx, side, side.y, side.y + side.h, [[0, "#062012"], [0.5, "#08281A"], [1, "#062012"]]);
  if (below) fillGradient(ctx, below, below.y, below.y + below.h, [[0, "#06200F"], [0.6, "#04170B"], [1, "#020E07"]]);
}
