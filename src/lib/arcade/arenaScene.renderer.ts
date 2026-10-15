/**
 * Arena scenes (15 Oct 2026, display only). Ten arcade play screens (ARENA_SCENE_GAMES)
 * continue their own scenery past the world's edges to the arena box's edges, so the
 * arena fills the screen on modern phones while the world (its size, scale, place,
 * input mapping, sim, score and replay) stays exactly as it was.
 *
 * A scene is painted once per arena size (never per frame) on a canvas behind the world
 * (ArcadeArenaSlot, `data-arena-scene`), shown only on the arcade play screen and never
 * hit by a touch (pointer-events: none). Painters draw in world units under the world's
 * own transform: the world rectangle is (0, 0)–(worldW, worldH) and the view is the
 * whole arena box, so the extension is everything outside the world rectangle. Scenes
 * hold no play objects, targets or moving art: only backdrop (sky, grass, rock, wood).
 * Never imported by a sim, grader or server code.
 */
import { artHash } from "./art.renderer";

/** The arena box in world units (the world is (0, 0)–(worldW, worldH) inside it). */
export interface ArenaSceneView {
  worldW: number;
  worldH: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** CSS px per world unit. */
  scale: number;
}

export type ArenaScenePainter = (ctx: CanvasRenderingContext2D, view: ArenaSceneView) => void;

/** Games whose arena box shows their own scene instead of the screen edge's black. */
export const ARENA_SCENE_GAMES = [
  "matchup",
  "tilt",
  "whack",
  "tendrop",
  "bullseye",
  "bintoss",
  "clayshoot",
  "flip",
  "inkbridge",
  "cross",
] as const;

/** The view's band below the world (full view width), or null when there is none. */
export function sceneBelow(view: ArenaSceneView): { x: number; y: number; w: number; h: number } | null {
  const h = view.bottom - view.worldH;
  return h > 0.01 ? { x: view.left, y: view.worldH, w: view.right - view.left, h } : null;
}

/** The view's strips beside the world (world height only), each or none. */
export function sceneSides(view: ArenaSceneView): Array<{ x: number; y: number; w: number; h: number }> {
  const out: Array<{ x: number; y: number; w: number; h: number }> = [];
  if (view.left < -0.01) out.push({ x: view.left, y: Math.max(view.top, 0), w: -view.left, h: view.worldH - Math.max(view.top, 0) });
  if (view.right > view.worldW + 0.01) out.push({ x: view.worldW, y: Math.max(view.top, 0), w: view.right - view.worldW, h: view.worldH - Math.max(view.top, 0) });
  return out;
}

/**
 * Short grass blades scattered over a rectangle (seeded, the same on every phone),
 * about one per `area` square world units; `colours` cycle.
 */
export function sceneBlades(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  seed: number,
  colours: readonly string[],
  area = 70,
  length = 4,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.lineCap = "round";
  ctx.lineWidth = 1;
  const n = Math.min(6000, Math.ceil((rect.w * rect.h) / area));
  for (let i = 0; i < n; i++) {
    const h = artHash(i, seed);
    const x = rect.x + ((h % 10007) / 10007) * rect.w;
    const y = rect.y + (((h >>> 14) % 10009) / 10009) * rect.h;
    const lean = (((h >>> 6) % 5) - 2) * 0.6;
    const len = length * (0.6 + ((h >>> 26) % 5) * 0.15);
    ctx.strokeStyle = colours[i % colours.length]!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + lean, y - len);
    ctx.stroke();
  }
  ctx.restore();
}

/** A vertical linear gradient fill of a rectangle, stops given in world y. */
export function sceneFill(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  y0: number,
  y1: number,
  stops: ReadonlyArray<readonly [number, string]>,
): void {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [at, colour] of stops) g.addColorStop(Math.min(1, Math.max(0, at)), colour);
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}
