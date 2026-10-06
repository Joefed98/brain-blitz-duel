/**
 * Shared "Real World" theme layer (Cross, Junction, Skyline, Ink Bridge).
 * Daylight palette, flat clean shapes, soft shadows. Render only: never read
 * by a sim; ambient animation freezes under reduced motion.
 */
import { reducedMotion } from "./art.renderer";
export { drawVehicle as realVehicle } from "./cross.renderer";

export const REAL_SKY_TOP = "#BFDDF2";
export const REAL_SKY_LOW = "#EAF4FA";
export const REAL_SKY_DIM_TOP = "#A9CCE5";
export const REAL_SKY_DIM_LOW = "#D9EAF5";
export const REAL_GRASS = "#86BF63";
export const REAL_GRASS_DARK = "#6FA851";
export const REAL_ASPHALT = "#555B64";
export const REAL_KERB = "#C9CDD3";
export const REAL_MARK = "#F4F6F8";
export const REAL_INK = "#1E2630";
export const REAL_SHADOW = "rgba(24, 34, 48, 0.2)";
export const REAL_WOOD = "#A8743F";
export const REAL_WOOD_DARK = "#7A5129";
export const REAL_WOOD_LIGHT = "#C9945B";
export const REAL_WATER = "#4E9BD6";
export const REAL_WATER_DARK = "#367FB8";
export const REAL_STONE = "#9AA0A8";
export const REAL_RED = "#E5484D";
export const REAL_GOLD = "#F5B82E";

/** Seconds of presentation time; frozen at 0 under reduced motion. */
export function realClock(): number {
  if (reducedMotion() || typeof performance === "undefined") return 0;
  return performance.now() / 1000;
}

/** Wall-clock milliseconds for one-shot effects (not frozen: they are feedback, not ambience). */
export function realNow(): number {
  return typeof performance === "undefined" ? 0 : performance.now();
}

/** Pale daylight sky over the given rectangle. */
export function realSky(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dim = false): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, dim ? REAL_SKY_DIM_TOP : REAL_SKY_TOP);
  g.addColorStop(1, dim ? REAL_SKY_DIM_LOW : REAL_SKY_LOW);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** A flat white cloud of three puffs, roughly 2.4 s wide and s tall. */
export function realCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha = 0.85): void {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
  ctx.arc(x + s * 0.55, y - s * 0.2, s * 0.62, 0, Math.PI * 2);
  ctx.arc(x + s * 1.2, y, s * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x, y - s * 0.1, s * 1.2, s * 0.6);
}

/** Flat top-down tree: soft shadow, two-tone canopy. */
export function realTree(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = REAL_SHADOW;
  ctx.beginPath();
  ctx.arc(x + 3, y + 3, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4F8F3A";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#68A84C";
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Per-key presentation memory, reset when the sim tick runs backwards. */
export function realMemo<K extends object, M extends { tick: number }>(
  map: WeakMap<K, M>,
  key: K,
  tick: number,
  make: () => M,
): M {
  let m = map.get(key);
  if (!m || tick < m.tick) {
    m = make();
    map.set(key, m);
  }
  return m;
}
