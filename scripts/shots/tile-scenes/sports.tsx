/**
 * The Sports group's tile scenes (30 Oct 2026). Home Run Derby, Free Kick and Racing: each game's own in-game
 * background at the tile's size (its renderer's tile painter), dimmed a little where it is busy so the tile reads at
 * 44 px. Minigolf, Speed Pool and Curling: each drawn by the game's own renderer (see ./scene.tsx).
 */
import { paintHomerunTile } from "@/lib/arcade/homerun.renderer";
import { paintFreekickTile } from "@/lib/arcade/freekick.renderer";
import { paintRacingTile } from "@/lib/arcade/racing.renderer";
import { paintMinigolfTile } from "@/lib/arcade/minigolf.renderer";
import { poolGameFor, POOL_H } from "@/lib/arcade/pool";
import { drawPool } from "@/lib/arcade/pool.renderer";
import { curlingGameFor, CU, TEAM_MINE, TEAM_THEIRS } from "@/lib/arcade/curling";
import { curlProject, drawCurling } from "@/lib/arcade/curling.renderer";

import { AR_FLY } from "@/lib/arcade/alleyroll";
import { AR_WORLD_H, AR_WORLD_W, drawAlleyRoll, ringerStill } from "@/lib/arcade/alleyroll.renderer";
import { TILE, canvasScene, noText, type SceneSet } from "./scene";

/** A soft dark vignette over a busy scene (the "faded if busy" rule), leaving its middle clear. */
function fade(c: CanvasRenderingContext2D, amount: number): void {
  const g = c.createRadialGradient(TILE / 2, TILE / 2, TILE * 0.25, TILE / 2, TILE / 2, TILE * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${amount})`);
  c.fillStyle = g;
  c.fillRect(0, 0, TILE, TILE);
}

export const SPORTS_SCENES: SceneSet = {
  homerun: canvasScene((c) => {
    noText(c, () => paintHomerunTile(c, TILE));
    fade(c, 0.45);
  }),
  freekick: canvasScene((c) => {
    noText(c, () => paintFreekickTile(c, TILE));
    fade(c, 0.4);
  }),
  racing: canvasScene((c) => {
    noText(c, () => paintRacingTile(c, TILE));
    fade(c, 0.35);
  }),
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
    const base = curlingGameFor(1).init(1);
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
  // Ringer: the funfair board close up, the raised cup tower with a blue ball dropping toward the 50, the gold cup
  // gliding on its track behind and a 100 pocket in the corner.
  alleyroll: canvasScene((c) => {
    const s = { ...ringerStill(60), phase: AR_FLY, x: -26 * 256, y: 196 * 256, z: 13 * 256, balls: [{ release: 0, points: 0, x: 0, y: 0 }] };
    const zoom = TILE / 250;
    c.save();
    c.scale(zoom, zoom);
    c.translate(-82, -140);
    noText(c, () => drawAlleyRoll(c, s, { width: AR_WORLD_W, height: AR_WORLD_H }));
    c.restore();
  }),
};
