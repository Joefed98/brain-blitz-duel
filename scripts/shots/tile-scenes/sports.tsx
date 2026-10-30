/**
 * Tile scenes for the Sports group (30 Oct 2026; see ./scene.tsx): each drawn by the game's own renderer.
 */
import { paintMinigolfTile } from "@/lib/arcade/minigolf.renderer";
import { poolGameFor, POOL_H } from "@/lib/arcade/pool";
import { drawPool } from "@/lib/arcade/pool.renderer";

import { canvasScene, type SceneSet, TILE } from "./scene";

export const SPORTS_SCENES: SceneSet = {
  // Minigolf: a corner of a hole at night, the ball lined up on the cup past a boulder.
  minigolf: canvasScene((c) => paintMinigolfTile(c, TILE)),
  // Speed Pool: the bottom-left corner pocket, a spot ball on the lip, a stripe and the cue ball lined up behind.
  pool: canvasScene((c) => {
    const s = poolGameFor(1).init(1);
    const ball = (id: number, x: number, y: number) => ({ id, x: x * 256, y: y * 256, vx: 0, vy: 0, down: 0 });
    const tile = { ...s, balls: [ball(0, 112, 610), ball(3, 62, 662), ball(11, 104, 680), ball(8, 50, 600)] };
    c.save();
    c.scale(TILE / 150, TILE / 150);
    c.translate(0, -(POOL_H - 150));
    drawPool(c, tile, null);
    c.restore();
  }),
};
