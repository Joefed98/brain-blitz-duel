/**
 * The Cards & Board screen fill (display only; arenaFills.renderer.ts' rules): the felt's darker edge runs on
 * beyond the world, below it and beside it, settling darker towards the screen's bottom. Still (no ambient).
 */
import type { ArenaSceneView } from "../arenaScene.renderer";
import { fillAbove, fillBelow, fillGradient, fillSides } from "../arenaFills.renderer";

export function cardsFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const below = fillBelow(view);
  const above = fillAbove(view);
  if (above) fillGradient(ctx, above, above.y, above.y + above.h, [[0, "#06142E"], [1, "#081A3A"]]);
  for (const side of fillSides(view)) fillGradient(ctx, side, side.y, side.y + side.h, [[0, "#081A3A"], [0.5, "#0A2048"], [1, "#081A3A"]]);
  if (below) fillGradient(ctx, below, below.y, below.y + below.h, [[0, "#081B3C"], [0.6, "#061430"], [1, "#040D22"]]);
}
