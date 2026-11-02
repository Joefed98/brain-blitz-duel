/**
 * Ricochet's play-screen fill (ricoRev 2, the ninja wall-climb; display only, arenaFills.renderer.ts rules): the temple
 * wall's stone carried on below and beside the world, darker the further out, painted once per size.
 */
import { artHash } from "./art.renderer";
import { fillBelow, fillGradient, fillSides } from "./arenaFills.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { NINJA_STONE_ROW as ROW } from "./ricochetNinja.renderer";

/** The play screen's fill: the walls' stone carried on below and beside the world, under a dusk haze. */
export function ninjaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const below = fillBelow(view);
  if (below) {
    fillGradient(ctx, below, below.y, below.y + below.h, [[0, "#2A2230"], [1, "#0B0B12"]]);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let y = below.y + 10; y < below.y + below.h; y += ROW) ctx.fillRect(below.x, y, below.w, 1);
  }
  for (const side of fillSides(view)) {
    // Beside the world (wide screens): more temple wall, darker the further out.
    fillGradient(ctx, side, 0, view.worldH, [[0, "#1D1E29"], [1, "#151620"]]);
    for (let r = 0; r * ROW < view.worldH; r++) {
      const off = r % 2 === 0 ? 0 : 22;
      for (let x = side.x - off; x < side.x + side.w; x += 44) {
        const h = artHash(r, Math.round(x));
        ctx.fillStyle = h % 4 === 0 ? "#24252F" : "#1F2029";
        ctx.fillRect(Math.max(side.x, x + 1), r * ROW + 1, Math.min(42, side.x + side.w - x - 1), ROW - 2);
      }
    }
  }
}

