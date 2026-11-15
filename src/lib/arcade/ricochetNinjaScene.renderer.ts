/**
 * Moon Climb's play-screen fill (Ricochet's ninja climb; display only, arenaFills.renderer.ts rules), edge to edge since
 * the Action overhaul (15 Nov 2026): below the world, the temple's slate floor (MOON_FLOOR, the colour the world's own
 * floor and night meet the edge in) carried on down to the screen's bottom with faint flagstone joints, settling darker;
 * beside the world (wide screens), more of the moonlit slate wall, shaded as the world's walls are at their outer edge
 * and darker further out. Painted once per size, never per frame.
 */
import { artHash } from "./art.renderer";
import { fillBelow, fillGradient, fillSides } from "./arenaFills.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { MOON_FLOOR, NINJA_STONE_ROW as ROW } from "./ricochetNinja.renderer";

/** The wall's slate beside the world: the world walls' block colours under their outer-edge shade. */
const SIDE_STONE = ["#20253A", "#262C42", "#1A1E30"] as const;
const SIDE_MORTAR = "#0C0F19";

/** The play screen's fill: the slate floor below the world, the slate wall beside it. */
export function ninjaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const below = fillBelow(view);
  if (below) {
    fillGradient(ctx, below, below.y, below.y + Math.max(below.h, 240), [[0, MOON_FLOOR], [0.35, "#171D34"], [1, "#0B0E1A"]]);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    for (let x = 30; x < view.right; x += 60) ctx.fillRect(x, below.y + 4, 1.5, below.h);
    for (let x = 30 - 60; x > view.left; x -= 60) ctx.fillRect(x, below.y + 4, 1.5, below.h);
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let y = below.y + 24; y < below.y + below.h; y += ROW) ctx.fillRect(below.x, y, below.w, 1);
  }
  for (const side of fillSides(view)) {
    // Beside the world (wide screens): the temple wall's slate, darker the further out.
    ctx.fillStyle = SIDE_MORTAR;
    ctx.fillRect(side.x, side.y, side.w, side.h);
    for (let r = 0; r * ROW < view.worldH; r++) {
      const off = r % 2 === 0 ? 0 : 22;
      for (let x = side.x - off; x < side.x + side.w; x += 44) {
        const h = artHash(r, Math.round(x));
        ctx.fillStyle = SIDE_STONE[h % 3]!;
        ctx.fillRect(Math.max(side.x, x + 1), r * ROW + 1, Math.min(42, side.x + side.w - x - 1), ROW - 2);
      }
    }
    const left = side.x < 0;
    const near = left ? side.x + side.w : side.x;
    const far = left ? side.x : side.x + side.w;
    const g = ctx.createLinearGradient(near, 0, far, 0);
    g.addColorStop(0, "rgba(0,0,10,0)");
    g.addColorStop(1, "rgba(0,0,10,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(side.x, side.y, side.w, side.h);
  }
}
