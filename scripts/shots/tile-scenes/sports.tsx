/**
 * Tile scenes for the Sports group (30 Oct 2026; see ./scene.tsx): each drawn by the game's own renderer.
 */
import { paintMinigolfTile } from "@/lib/arcade/minigolf.renderer";

import { canvasScene, type SceneSet, TILE } from "./scene";

export const SPORTS_SCENES: SceneSet = {
  // Minigolf: a corner of a hole at night, the ball lined up on the cup past a boulder.
  minigolf: canvasScene((c) => paintMinigolfTile(c, TILE)),
};
