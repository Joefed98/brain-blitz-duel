/**
 * High Seas theme layer: deep water, weathered wood, brass, rope and gold.
 * Render only — never imported by sims, graders or scoring. Games draw their
 * own play objects on the sim geometry; this module supplies the palette,
 * the presentation clock (frozen under reduced motion), cached sprites and
 * background pieces (water, light rays, kelp, rigging, deck, rope).
 */
import { reducedMotion } from "./art.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";

export const SEA_DEEP = "#06172E";
export const SEA_MID = "#0C3561";
export const SEA_SHALLOW = "#1D6A9E";
export const SEA_FOAM = "#CFE8F5";
export const SEA_WOOD = "#7A5532";
export const SEA_WOOD_DARK = "#4A321C";
export const SEA_WOOD_LIGHT = "#A47A4E";
export const SEA_BRASS = "#C9A04A";
export const SEA_BRASS_DARK = "#7E6326";
export const SEA_ROPE = "#6B4E2E";
export const SEA_ROPE_LIGHT = "#A88358";
export const SEA_GOLD = "#F5C542";
export const SEA_TEXT = "#EAF4FA";
export const SEA_SAIL = "#E8DCC0";
export const SEA_SKY_TOP = "#2D5C8A";
export const SEA_SKY_LOW = "#9CC3DC";

/** Seconds of ambient presentation time; 0 under reduced motion. */
export function seaClock(): number {
  if (reducedMotion() || typeof performance === "undefined") return 0;
  return performance.now() / 1000;
}

/** Wall-clock ms for one-shot feedback (not frozen). */
export function seaNow(): number {
  return typeof performance === "undefined" ? 0 : performance.now();
}

/** Device pixels per CSS px of the current transform. */
export function seaDeviceScale(ctx: CanvasRenderingContext2D): number {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  return t ? Math.max(1, Math.min(2, Math.hypot(t.a, t.b))) : 1;
}

const sprites = new Map<string, ArtCanvas | null>();
/** Cached square sprite of `size` device px, drawn once by `paint(ctx, size)`. */
export function seaSprite(
  key: string,
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
): ArtCanvas | null {
  const px = Math.max(2, Math.round(size));
  const id = `${key}@${px}`;
  if (sprites.has(id)) return sprites.get(id)!;
  if (sprites.size > 256) sprites.clear();
  const canvas = artCanvas(px, px);
  const c = canvas ? artContext(canvas) : null;
  if (canvas && c) paint(c as CanvasRenderingContext2D, px);
  sprites.set(id, canvas && c ? canvas : null);
  return sprites.get(id)!;
}

/** Underwater depth gradient with soft light rays from above. */
export function seaUnderwater(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SEA_SHALLOW);
  g.addColorStop(0.45, SEA_MID);
  g.addColorStop(1, SEA_DEEP);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const t = seaClock();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 4; i++) {
    const sway = Math.sin(t * 0.25 + i * 1.7) * w * 0.03;
    const x = w * (0.12 + i * 0.26) + sway;
    const ray = ctx.createLinearGradient(0, 0, 0, h * 0.8);
    ray.addColorStop(0, "rgba(190,230,255,0.10)");
    ray.addColorStop(1, "rgba(190,230,255,0)");
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.04, 0);
    ctx.lineTo(x + w * 0.04, 0);
    ctx.lineTo(x + w * 0.13, h * 0.8);
    ctx.lineTo(x - w * 0.02, h * 0.8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** A swaying kelp frond rooted at (x, bottom), `height` tall. */
export function seaKelp(ctx: CanvasRenderingContext2D, x: number, bottom: number, height: number, width: number, phase: number): void {
  const t = seaClock();
  ctx.save();
  ctx.strokeStyle = "#2F6B3A";
  ctx.lineWidth = Math.max(2, width);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, bottom);
  const segs = 6;
  for (let i = 1; i <= segs; i++) {
    const f = i / segs;
    const sway = Math.sin(t * 0.9 + phase + f * 2.4) * width * 1.6 * f;
    ctx.lineTo(x + sway, bottom - height * f);
  }
  ctx.stroke();
  ctx.fillStyle = "#3E8A4A";
  for (let i = 1; i < segs; i++) {
    const f = i / segs;
    const sway = Math.sin(t * 0.9 + phase + f * 2.4) * width * 1.6 * f;
    ctx.beginPath();
    ctx.ellipse(x + sway + (i % 2 ? width : -width), bottom - height * f, width * 1.1, width * 0.45, i % 2 ? -0.5 : 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A small coral fan rooted at (x, bottom). */
export function seaCoral(ctx: CanvasRenderingContext2D, x: number, bottom: number, s: number, colour: string): void {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.5, s * 0.14);
  ctx.beginPath();
  for (const [dx, dy] of [[-0.6, -0.8], [0, -1], [0.55, -0.75], [-0.25, -0.5], [0.3, -0.45]] as const) {
    ctx.moveTo(x, bottom);
    ctx.quadraticCurveTo(x + dx * s * 0.3, bottom - s * 0.4, x + dx * s, bottom + dy * s);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Tarred hemp rope along a polyline: dark core plus a lighter dashed twist.
 * The centre line is exactly the given points.
 */
export function seaRope(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], width: number, alpha = 1): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(points[0]![0], points[0]![1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i]![0], points[i]![1]);
  };
  path();
  ctx.strokeStyle = "#2E2014";
  ctx.lineWidth = width;
  ctx.stroke();
  path();
  ctx.strokeStyle = SEA_ROPE;
  ctx.lineWidth = width * 0.7;
  ctx.stroke();
  path();
  ctx.strokeStyle = SEA_ROPE_LIGHT;
  ctx.lineWidth = width * 0.35;
  ctx.setLineDash([width * 0.9, width * 0.9]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** Cached gold coin sprite painter. */
export function paintCoin(c: CanvasRenderingContext2D, size: number): void {
  const r = size / 2;
  c.fillStyle = SEA_BRASS_DARK;
  c.beginPath();
  c.arc(r, r, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = SEA_GOLD;
  c.beginPath();
  c.arc(r, r, r * 0.84, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = SEA_BRASS_DARK;
  c.lineWidth = Math.max(1, r * 0.1);
  c.beginPath();
  c.arc(r, r, r * 0.6, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = "#FFF1B8";
  c.beginPath();
  c.ellipse(r * 0.7, r * 0.62, r * 0.22, r * 0.12, -0.7, 0, Math.PI * 2);
  c.fill();
}
