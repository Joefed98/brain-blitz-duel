/**
 * Screen-tap to sim-input mappings for the canvas tap-target games, kept pure so
 * scripts/tap-mapping-check.ts runs the phone's exact arithmetic against the real
 * renderers and sims. Each takes the tapped element's on-screen box and the client
 * point; the stages call these from their pointer handlers and nothing else.
 */
import { BEAT_LANES, BEAT_WORLD_W } from "@/lib/arcade/beat";
import { CLAY_H, CLAY_W, clayView } from "@/lib/arcade/clayShoot";
import {
  CLASH_DROP,
  CLASH_INPUT_LANE,
  CLASH_SET_LANE,
  CLASH_WORLD_W,
} from "@/lib/arcade/colourClash";

export interface TapBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** ArcadeCanvasStage: screen point to world point, or null outside the drawn play area. */
export function arcadeWorldPoint(
  box: TapBox | null | undefined,
  clientX: number,
  clientY: number,
  worldW: number,
  worldH: number,
  clamp: boolean,
): { x: number; y: number } | null {
  if (!box || box.width < 1) return null;
  const x = Math.round(((clientX - box.left) / box.width) * worldW);
  const y = Math.round(((clientY - box.top) / box.height) * worldH);
  if (!clamp && (x < 0 || x > worldW || y < 0 || y > worldH)) return null;
  return { x: Math.max(0, Math.min(worldW, x)), y: Math.max(0, Math.min(worldH, y)) };
}

/** Pull!: the shot's world point (the sim's 360 × 400 sky), or null off the sky. */
export function clayTapWorld(
  box: TapBox,
  clientX: number,
  clientY: number,
): { wx: number; wy: number } | null {
  const { scaleX, scaleY } = clayView({ width: box.width, height: box.height });
  const wx = Math.round((clientX - box.left) / scaleX);
  const wy = Math.round((clientY - box.top) / scaleY);
  if (wx < 0 || wx > CLAY_W || wy < 0 || wy > CLAY_H) return null;
  return { wx, wy };
}

/** Mixed Signals: a press and release (world points) become a lane pick, or a drop for a downward flick. */
export function clashTapPayload(
  down: { x: number; y: number },
  up: { x: number; y: number },
): { k: number; a: number; b: number; c: number } {
  if (up.y - down.y > 40) return { k: CLASH_INPUT_LANE, a: CLASH_DROP, b: 0, c: 0 };
  return {
    k: CLASH_INPUT_LANE,
    a: CLASH_SET_LANE,
    b: Math.min(CLASH_WORLD_W - 1, Math.max(0, Math.round(up.x))),
    c: 0,
  };
}

/** Tempo: which lane the finger is in, from the sim's own mapping. */
export function beatLaneAt(box: TapBox, clientX: number): number {
  const x = ((clientX - box.left) / box.width) * BEAT_WORLD_W;
  const lane = Math.floor((x / BEAT_WORLD_W) * BEAT_LANES);
  return Math.max(0, Math.min(BEAT_LANES - 1, lane));
}
