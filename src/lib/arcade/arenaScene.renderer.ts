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
 * whole play screen (17 Oct 2026: to its bottom and side edges, behind the header, the
 * controls and the home bar), so the extension is everything outside the world rectangle.
 * Scenes hold no play objects or targets: only backdrop (sky, grass, rock, wood). The
 * screen fill-ins (arenaFills.renderer.ts) give every active arcade game one, and a few a
 * slow moving layer (ArenaAmbient).
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
  /** The arena box's top (world units; 0 for a top-anchored world, below 0 above a centred one). */
  boxTop?: number;
}

export type ArenaScenePainter = (ctx: CanvasRenderingContext2D, view: ArenaSceneView) => void;

/**
 * A moving fill (17 Oct 2026, display only): drawn over the scene, outside the world, at most every
 * 50 ms of presentation time `t` (ms). `still` (reduced motion or reduced effects) asks for its
 * resting frame, drawn once: lights dim, colours fixed, nothing drifting, no walkers.
 */
export interface ArenaAmbient {
  /** Where it moves: the band below the world (full width) or the whole screen. */
  region: "below" | "all";
  draw: (ctx: CanvasRenderingContext2D, view: ArenaSceneView, t: number, still: boolean) => void;
}

/**
 * Games whose play screen shows their own scene instead of the screen edge's black: the engine games
 * with one (Bonk, Tenfall, Pull! and, since Polish batch S on 25 Oct 2026, Mixed Signals) and, since the
 * screen fill-ins (17 Oct 2026, arenaFills.renderer.ts), every active arcade game.
 */
export const ARENA_SCENE_GAMES = [
  "whack",
  "tendrop",
  "clayshoot",
  "hover",
  "breaker",
  "rally",
  "beat",
  "snake",
  "burst",
  "wavefront",
  "orbit",
  "skyline",
  "cross",
  "inkbridge",
  "slice",
  "bintoss",
  "bullseye",
  "bubble",
  "flip",
  "swing",
  "snip",
  "tilt",
  "balltrack",
  "matchup",
  "pinball",
  "minigolf",
  "pool",
  "curling",
  "stroop",
] as const;

/**
 * How far a scene runs in under the world's edges (world units, 17 Oct 2026). The world paints over it;
 * without it the device row a world's fractional edge falls in was half world, half nothing (the page's
 * black), a dark line where the world meets its scene.
 */
export const SCENE_TUCK = 2;

/** The view's band below the world (full view width, tucked SCENE_TUCK under it), or null when there is none. */
export function sceneBelow(view: ArenaSceneView): { x: number; y: number; w: number; h: number } | null {
  const h = view.bottom - view.worldH;
  return h > 0.01 ? { x: view.left, y: view.worldH - SCENE_TUCK, w: view.right - view.left, h: h + SCENE_TUCK } : null;
}

/** The view's strips beside the world (world height only), each or none. */
export function sceneSides(view: ArenaSceneView): Array<{ x: number; y: number; w: number; h: number }> {
  const out: Array<{ x: number; y: number; w: number; h: number }> = [];
  if (view.left < -0.01) out.push({ x: view.left, y: Math.max(view.top, 0), w: -view.left + SCENE_TUCK, h: view.worldH - Math.max(view.top, 0) });
  if (view.right > view.worldW + 0.01) out.push({ x: view.worldW - SCENE_TUCK, y: Math.max(view.top, 0), w: view.right - view.worldW + SCENE_TUCK, h: view.worldH - Math.max(view.top, 0) });
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
