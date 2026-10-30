/**
 * Tile scenes for the Sports group (30 Oct 2026; see ./scene.tsx): each drawn by the game's own renderer.
 */
import { paintMinigolfTile } from "@/lib/arcade/minigolf.renderer";
import { poolGameFor, POOL_H } from "@/lib/arcade/pool";
import { drawPool } from "@/lib/arcade/pool.renderer";
import { curlingGameFor, CU, TEAM_MINE, TEAM_THEIRS } from "@/lib/arcade/curling";
import { curlProject, drawCurling } from "@/lib/arcade/curling.renderer";

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
  // Curling: the far house down the sheet, a gold-handled stone on the button and a red one being knocked away.
  curling: canvasScene((c) => {
    const base = curlingGameFor().init(1);
    const stones: [number, number, number][] = [[0, 4, TEAM_MINE], [58, -40, TEAM_THEIRS], [-70, 60, TEAM_MINE]];
    const s = {
      ...base,
      x: stones.map(([x]) => x * CU),
      y: stones.map(([, y]) => y * CU),
      vx: stones.map(() => 0),
      vy: stones.map(() => 0),
      team: stones.map(([, , t]) => t),
      live: stones.map(() => 1),
      curl: stones.map(() => 0),
      theirs: 1,
      thrown: 2,
    };
    const house = curlProject(0, 0);
    const zoom = TILE / (house.k * 230);
    c.save();
    c.translate(TILE / 2, TILE * 0.62);
    c.scale(zoom, zoom);
    c.translate(-house.sx, -house.sy);
    drawCurling(c, s, null);
    c.restore();
  }),
};
