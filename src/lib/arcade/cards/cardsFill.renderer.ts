/**
 * The Cards & Board screen fill (display only; arenaFills.renderer.ts' rules): the felt's darker edge runs on
 * beyond the world, below it and beside it, settling darker towards the screen's bottom. Still (no ambient).
 */
import type { ArenaSceneView } from "../arenaScene.renderer";
import { fillAbove, fillBelow, fillGradient, fillSides } from "../arenaFills.renderer";
import { NO_LOOK, type GameLook } from "../skins/look";
import { feltFillStops, feltOf } from "../skins/cards.skins";

export function cardsFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  paintCardsFill(ctx, view, NO_LOOK);
}

/** The fill in a look (wave 2 skins): the live stage's, the player's own. */
export function cardsFillFor(look: GameLook): (ctx: CanvasRenderingContext2D, view: ArenaSceneView) => void {
  return feltOf(look) ? (ctx, view) => paintCardsFill(ctx, view, look) : cardsFill;
}

function paintCardsFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView, look: GameLook): void {
  const below = fillBelow(view);
  const above = fillAbove(view);
  const felt = feltOf(look);
  if (felt) {
    // A skinned felt's rail runs on round the world (wave 2 skins).
    const stops = feltFillStops(felt);
    if (above) fillGradient(ctx, above, above.y, above.y + above.h, stops.above);
    for (const side of fillSides(view)) fillGradient(ctx, side, side.y, side.y + side.h, stops.side);
    if (below) fillGradient(ctx, below, below.y, below.y + below.h, stops.below);
    return;
  }
  if (above) fillGradient(ctx, above, above.y, above.y + above.h, [[0, "#06142E"], [1, "#081A3A"]]);
  for (const side of fillSides(view)) fillGradient(ctx, side, side.y, side.y + side.h, [[0, "#081A3A"], [0.5, "#0A2048"], [1, "#081A3A"]]);
  if (below) fillGradient(ctx, below, below.y, below.y + below.h, [[0, "#081B3C"], [0.6, "#061430"], [1, "#040D22"]]);
}
