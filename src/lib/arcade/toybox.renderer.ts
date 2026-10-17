/**
 * Toybox theme layer: a wooden toy board on a lamp-lit tabletop. Render only —
 * never imported by sims, graders or scoring. Games keep their own world
 * transform; the tabletop fills the whole canvas, the board's dark rim and
 * brass screws sit just outside the world rectangle (visible only in the
 * letterbox margins), and glass marbles are drawn at the sim's radius.
 */
import { reducedMotion } from "./art.renderer";

export const TOY_OAK = "#C99A62";
export const TOY_OAK_LIGHT = "#DDB27A";
export const TOY_OAK_GRAIN = "#A87843";
export const TOY_WOOD_DARK = "#6B4426";
export const TOY_WOOD_DEEP = "#3E2716";
export const TOY_BRASS = "#D4A84A";
export const TOY_BRASS_DARK = "#8A6420";
export const TOY_TABLE = "#2A1C14";
export const TOY_TABLE_LIT = "#5A3E2A";
export const TOY_INK = "#2B1A0E";

/** Presentation clock in ms; frozen at 0 under reduced motion. */
export function toyClock(): number {
  if (reducedMotion()) return 0;
  return typeof performance === "undefined" ? 0 : performance.now();
}

/** Tabletop under soft lamp light over the whole canvas, darker at the edges. */
export function toyTabletop(ctx: CanvasRenderingContext2D): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, TOY_TABLE_LIT);
  g.addColorStop(1, TOY_TABLE);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function screw(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = TOY_BRASS;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TOY_BRASS_DARK;
  ctx.lineWidth = Math.max(1, r * 0.3);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.65, y - r * 0.2);
  ctx.lineTo(x + r * 0.65, y + r * 0.2);
  ctx.stroke();
}

/** Light-oak grain in a world rectangle (caller clips if needed). */
export function toyGrain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step = 14): void {
  ctx.save();
  ctx.strokeStyle = TOY_OAK_GRAIN;
  ctx.lineWidth = 1;
  for (let gy = y + step / 2, i = 0; gy < y + h; gy += step, i++) {
    ctx.globalAlpha = 0.18 + (i % 3) * 0.06;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.bezierCurveTo(x + w * 0.3, gy + ((i % 2) ? 4 : -3), x + w * 0.7, gy + ((i % 2) ? -4 : 3), x + w, gy + 1);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The wooden board in world coordinates: dark rim + screws outside the
 * rectangle (margins only), oak with grain and a subtle vignette inside.
 */
export function toyBoard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rim = 10, frame = true): void {
  ctx.save();
  // `frame: false` (Tilt's play screen since 17 Oct 2026): no rim, outline or screws, the board's oak meeting its scene.
  if (frame) {
    ctx.fillStyle = TOY_WOOD_DARK;
    ctx.fillRect(x - rim, y - rim, w + rim * 2, h + rim * 2);
    ctx.fillStyle = TOY_WOOD_DEEP;
    ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
    const sr = rim * 0.32;
    for (const [sx, sy] of [[x - rim / 2, y - rim / 2], [x + w + rim / 2, y - rim / 2], [x - rim / 2, y + h + rim / 2], [x + w + rim / 2, y + h + rim / 2]] as const) {
      screw(ctx, sx, sy, sr);
    }
  }
  ctx.fillStyle = TOY_OAK;
  ctx.fillRect(x, y, w, h);
  toyGrain(ctx, x, y, w, h, Math.max(10, h / 40));
  const v = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.max(w, h) * 0.72);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(40,20,5,0.32)");
  ctx.fillStyle = v;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/**
 * A glass marble at the sim's radius: solid colour, faint inner swirl, one
 * specular highlight. `light` rotates the highlight (radians) so it stays
 * screen-fixed on rotating boards; shimmer is off under reduced motion.
 */
export function toyMarble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string, light = 0, seed = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // Faint swirl.
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = Math.max(0.8, r * 0.14);
  ctx.beginPath();
  ctx.arc(r * 0.1, r * 0.05, r * 0.5, seed, seed + Math.PI * 1.1);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = Math.max(0.8, r * 0.12);
  ctx.beginPath();
  ctx.arc(-r * 0.05, r * 0.1, r * 0.62, seed + Math.PI, seed + Math.PI * 1.8);
  ctx.stroke();
  // Specular highlight (screen-fixed lamp at upper left).
  const t = toyClock();
  const shimmer = t === 0 ? 0.85 : 0.75 + 0.15 * Math.sin(t / 380 + seed);
  ctx.rotate(light);
  ctx.globalAlpha = shimmer;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(-r * 0.36, -r * 0.36, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Per-canvas presentation memory: ms since a watched value last grew
 * (Infinity before), plus the `extra` passed on the frame BEFORE that change.
 */
const memos = new WeakMap<CanvasRenderingContext2D, Map<string, { value: number; at: number; last: unknown; snap: unknown }>>();
export function toyChangeAge(ctx: CanvasRenderingContext2D, name: string, value: number, extra?: unknown): { age: number; before: unknown } {
  let map = memos.get(ctx);
  if (!map) memos.set(ctx, (map = new Map()));
  const now = typeof performance === "undefined" ? 0 : performance.now();
  const old = map.get(name);
  if (!old) {
    map.set(name, { value, at: -Infinity, last: extra, snap: undefined });
    return { age: Infinity, before: undefined };
  }
  if (old.value !== value) {
    old.at = value > old.value ? now : -Infinity;
    old.value = value;
    old.snap = old.last;
  }
  old.last = extra;
  return { age: now - old.at, before: old.snap };
}
