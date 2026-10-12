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

const layers = new Map<string, ArtCanvas | null>();
/**
 * Cached full-size layer (`w` × `h` CSS px at `dpr`), painted once per key by
 * `paint(ctx)` in CSS px; painted straight onto ctx where no offscreen canvas
 * exists (SSR, Node checks).
 */
export function seaLayer(
  ctx: CanvasRenderingContext2D,
  key: string,
  w: number,
  h: number,
  dpr: number,
  paint: (c: CanvasRenderingContext2D) => void,
): void {
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  const id = `${key}@${pw}x${ph}`;
  let layer = layers.get(id);
  if (layer === undefined) {
    if (layers.size >= 6) layers.clear();
    const canvas = artCanvas(pw, ph);
    const c = canvas ? artContext(canvas) : null;
    if (canvas && c) {
      c.scale(pw / w, ph / h);
      paint(c as CanvasRenderingContext2D);
    }
    layer = canvas && c ? canvas : null;
    layers.set(id, layer);
  }
  if (layer) ctx.drawImage(layer as CanvasImageSource, 0, 0, w, h);
  else paint(ctx);
}

/** Static deep water: depth gradient, caustic shimmer near the surface and drifting specks. */
export function seaWater(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SEA_SHALLOW);
  g.addColorStop(0.45, SEA_MID);
  g.addColorStop(1, SEA_DEEP);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Caustic net: soft light ripples fading with depth.
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < 46; i++) {
    const x = ((i * 89) % 101) / 101 * w;
    const y = (((i * 37) % 53) / 53) * h * 0.42;
    const len = w * (0.05 + ((i * 13) % 7) / 100);
    ctx.globalAlpha = 0.1 * (1 - y / (h * 0.5));
    ctx.strokeStyle = "#D8F0FF";
    ctx.lineWidth = 1 + (i % 3) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len * 0.5, y + (i % 2 ? 4 : -4), x + len, y + (i % 3) - 1);
    ctx.stroke();
  }
  // Marine snow: fine still specks through the water.
  ctx.fillStyle = "#CFE8F5";
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.08 + (i % 4) * 0.04;
    const x = ((i * 157) % 199) / 199 * w;
    const y = ((i * 71) % 211) / 211 * h;
    ctx.fillRect(x, y, i % 5 === 0 ? 1.6 : 1, i % 5 === 0 ? 1.6 : 1);
  }
  ctx.restore();
}

/** Soft light rays from above, swaying on the presentation clock. */
export function seaRays(ctx: CanvasRenderingContext2D, w: number, h: number): void {
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

/** Underwater depth gradient with soft light rays from above (uncached). */
export function seaUnderwater(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  seaWater(ctx, w, h);
  seaRays(ctx, w, h);
}

/** A swaying kelp frond rooted at (x, bottom), `height` tall. */
export function seaKelp(ctx: CanvasRenderingContext2D, x: number, bottom: number, height: number, width: number, phase: number): void {
  const t = seaClock();
  const segs = 8;
  const pts: [number, number][] = [[x, bottom]];
  for (let i = 1; i <= segs; i++) {
    const f = i / segs;
    const sway = Math.sin(t * 0.9 + phase + f * 2.4) * width * 1.6 * f;
    pts.push([x + sway, bottom - height * f]);
  }
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Blades first so the stem sits over their roots: dark blade, lit midrib.
  for (let i = 1; i < segs; i++) {
    const [px, py] = pts[i]!;
    const side = i % 2 ? 1 : -1;
    const len = width * (3.2 - (i / segs) * 1.2);
    const tipX = px + side * len;
    const tipY = py - len * 0.55;
    ctx.fillStyle = i % 3 === 0 ? "#2C6A36" : "#3E8A4A";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + side * len * 0.5, py - len * 0.65, tipX, tipY);
    ctx.quadraticCurveTo(px + side * len * 0.6, py + len * 0.05, px, py + width * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(170,230,150,0.35)";
    ctx.lineWidth = Math.max(0.6, width * 0.18);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + side * len * 0.5, py - len * 0.45, tipX, tipY);
    ctx.stroke();
  }
  const stem = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  };
  stem();
  ctx.strokeStyle = "#1F4D29";
  ctx.lineWidth = Math.max(2, width * 1.2);
  ctx.stroke();
  stem();
  ctx.strokeStyle = "#3F7F45";
  ctx.lineWidth = Math.max(1, width * 0.5);
  ctx.stroke();
  // Gas floats along the stem.
  ctx.fillStyle = "#5FA05A";
  for (let i = 2; i < segs; i += 2) {
    const [px, py] = pts[i]!;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1.2, width * 0.55), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A small branching coral rooted at (x, bottom): thick base, forked arms, lit tips. */
export function seaCoral(ctx: CanvasRenderingContext2D, x: number, bottom: number, s: number, colour: string): void {
  ctx.save();
  ctx.lineCap = "round";
  const arms = [[-0.6, -0.8], [0, -1], [0.55, -0.75], [-0.25, -0.5], [0.3, -0.45]] as const;
  const draw = (stroke: string, width: number, dx: number) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const [ax, ay] of arms) {
      const ex = x + ax * s, ey = bottom + ay * s;
      ctx.moveTo(x + dx, bottom);
      ctx.quadraticCurveTo(x + ax * s * 0.3 + dx, bottom - s * 0.4, ex + dx, ey);
      // A short fork near each tip.
      ctx.moveTo(x + ax * s * 0.75 + dx, bottom + ay * s * 0.75);
      ctx.lineTo(ex + (ax >= 0 ? 0.18 : -0.18) * s + dx, ey + s * 0.08);
    }
    ctx.stroke();
  };
  draw("rgba(40,10,20,0.35)", Math.max(2, s * 0.2), 1);
  draw(colour, Math.max(1.5, s * 0.15), 0);
  draw("rgba(255,235,225,0.28)", Math.max(0.6, s * 0.05), -s * 0.03);
  ctx.fillStyle = "rgba(255,240,230,0.7)";
  for (const [ax, ay] of arms) {
    ctx.beginPath();
    ctx.arc(x + ax * s, bottom + ay * s, Math.max(0.8, s * 0.07), 0, Math.PI * 2);
    ctx.fill();
  }
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
