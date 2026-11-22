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

/**
 * The fill as it was before the polish plan's brighter baize (20 Nov 2026), kept for the retired Full House and Golf
 * Solitaire (practice only; Full House's frames are held to main's record by skins-default-check).
 */
export function cardsFillClassic(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  paintCardsFill(ctx, view, NO_LOOK, true);
}

/**
 * The fill in a look (wave 2 skins): the live stage's, the player's own. `classic`: with no felt, the fill as it was
 * before the brighter baize (Full House, retired, held to main's frames).
 */
export function cardsFillFor(look: GameLook, classic = false): (ctx: CanvasRenderingContext2D, view: ArenaSceneView) => void {
  return feltOf(look) ? (ctx, view) => paintCardsFill(ctx, view, look) : classic ? cardsFillClassic : cardsFill;
}

function paintCardsFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView, look: GameLook, classic = false): void {
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
  if (classic) {
    if (above) fillGradient(ctx, above, above.y, above.y + above.h, [[0, "#06142E"], [1, "#081A3A"]]);
    for (const side of fillSides(view)) fillGradient(ctx, side, side.y, side.y + side.h, [[0, "#081A3A"], [0.5, "#0A2048"], [1, "#081A3A"]]);
    if (below) fillGradient(ctx, below, below.y, below.y + below.h, [[0, "#081B3C"], [0.6, "#061430"], [1, "#040D22"]]);
    return;
  }
  // The polish plan (20 Nov 2026): the brighter baize's edges carried on, about a third lighter (were #06142E / #081A3A,
  // #081A3A / #0A2048 and #081B3C / #061430 / #040D22), so the world meets the fill with no seam.
  if (above) fillGradient(ctx, above, above.y, above.y + above.h, [[0, "#081B3F"], [1, "#0B234F"]]);
  for (const side of fillSides(view)) fillGradient(ctx, side, side.y, side.y + side.h, [[0, "#0B234F"], [0.5, "#0E2C62"], [1, "#0B234F"]]);
  if (below) fillGradient(ctx, below, below.y, below.y + below.h, [[0, "#0B2552"], [0.6, "#081B41"], [1, "#05112E"]]);
}
