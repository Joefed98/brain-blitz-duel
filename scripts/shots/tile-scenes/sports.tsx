/**
 * The Sports group's tile scenes (30 Oct 2026): each game's own in-game background at the tile's size (its renderer's
 * tile painter, the same art the play screen draws), dimmed a little where it is busy so the tile reads at 44 px.
 */
import { paintHomerunTile } from "@/lib/arcade/homerun.renderer";
import { paintFreekickTile } from "@/lib/arcade/freekick.renderer";
import { paintRacingTile } from "@/lib/arcade/racing.renderer";

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
};
