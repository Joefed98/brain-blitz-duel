/**
 * Moon Climb's play-screen fill (Ricochet's ninja climb; display only, arenaFills.renderer.ts rules), edge to edge since
 * the Action overhaul (15 Nov 2026): below the world, the two temple walls' carved slate carried on down under the walls
 * (`paintSlate`, the world's own painter) and the shaft's slate floor (MOON_FLOOR) between them, settling darker to the
 * screen's bottom; beside the world (wide screens), more of the same slate wall, darker further out. Painted once per
 * size, never per frame.
 */
import { fillBelow, fillGradient, fillSides } from "./arenaFills.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { MOON_FLOOR, NINJA_STONE_ROW as ROW, paintSlate } from "./ricochetNinja.renderer";
import { NINJA_WALL_L, NINJA_WALL_R } from "./ricochetNinja";

/** The play screen's fill: the walls and floor carried on below the world, the slate wall beside it. */
export function ninjaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const below = fillBelow(view);
  if (below) {
    const bottom = below.y + below.h;
    // The shaft's floor between the walls, its flagstone joints carried on.
    fillGradient(ctx, below, below.y, below.y + Math.max(below.h, 240), [[0, MOON_FLOOR], [0.35, "#171D34"], [1, "#0B0E1A"]]);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    for (let x = NINJA_WALL_L + 30; x < NINJA_WALL_R; x += 60) ctx.fillRect(x, below.y + 4, 1.5, below.h);
    // The walls' slate under each wall (and out to the screen's sides), course by course down from the world's edge.
    const rows = Math.ceil(below.h / ROW) + 1;
    const rowAt = (r: number) => below.y + (rows - 1 - r) * ROW;
    paintSlate(ctx, 0, Math.min(view.left, 0), NINJA_WALL_L, rowAt, 0, rows);
    paintSlate(ctx, 1, NINJA_WALL_R, Math.max(view.right, view.worldW), rowAt, 0, rows);
    // Everything settles darker towards the screen's bottom.
    fillGradient(ctx, below, below.y, bottom, [[0, "rgba(7,7,9,0)"], [0.25, "rgba(7,7,9,0)"], [1, "rgba(7,7,9,0.6)"]]);
  }
  for (const side of fillSides(view)) {
    // Beside the world (wide screens): the temple walls' slate, darker the further out.
    const left = side.x < 0;
    const rows = Math.ceil(view.worldH / ROW) + 1;
    paintSlate(ctx, left ? 0 : 1, side.x, side.x + side.w, (r) => view.worldH - (r + 1) * ROW, 0, rows);
    const near = left ? side.x + side.w : side.x;
    const far = left ? side.x : side.x + side.w;
    const g = ctx.createLinearGradient(near, 0, far, 0);
    g.addColorStop(0, "rgba(0,0,10,0.35)");
    g.addColorStop(1, "rgba(0,0,10,0.6)");
    ctx.fillStyle = g;
    ctx.fillRect(side.x, side.y, side.w, side.h);
  }
}
