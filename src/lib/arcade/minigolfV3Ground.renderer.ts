/**
 * Crazy Golf golfRev 3's ground (the Crazy Golf overhaul, 15 Nov 2026; display only, never imported by the sim or the
 * server): the slopes, hills and swells read through light and shadow alone, with no arrows. A height field built from
 * the sim's own pieces (`groundHeight`) is lit from the top left (the course's light) and the mowing stripes are laid
 * on the ground, so they bend where it rises and falls; bunkers and ponds are drawn as the unions of the sim's circles
 * (natural shapes): raked sand inside a turf lip, water with ripples inside a stone edge.
 *
 * Everything here is painted once into the cached hole canvas (minigolf.renderer.ts cachedHole).
 */
import { px } from "./engine";
import type { MgHole } from "./minigolf";

/** The turf's colours (no rendered texture). */
const TURF = "#2F7A3A";

/**
 * The ground's height at (x, y) world px (arbitrary units, display only), from the sim's pieces: a ramp rises
 * linearly across its box against its pull (flat beyond), a hill is a dome (its push k·d/r integrated), a swell the
 * integral of its push 4k·d(r − d)/r² (a mound for k > 0, a hollow for k < 0). So where the ground slopes is exactly
 * where the sim pushes the ball, and the steeper it is drawn the harder it pushes.
 */
export function groundHeight(h: MgHole, x: number, y: number): number {
  let z = 0;
  for (const s of h.slopes) {
    const x0 = px(s.x0);
    const x1 = px(s.x1);
    const y0 = px(s.y0);
    const y1 = px(s.y1);
    const ax = s.ax;
    const ay = s.ay;
    const k = Math.hypot(ax, ay);
    if (k === 0) continue;
    // Inside the ramp's band across it (with a soft edge), the height climbs against the pull.
    const inX = ax === 0 ? x >= x0 - 2 && x <= x1 + 2 : true;
    const inY = ay === 0 ? y >= y0 - 2 && y <= y1 + 2 : true;
    if (!inX || !inY) continue;
    const ux = -ax / k;
    const uy = -ay / k;
    // Projection onto the uphill direction, clamped to the box's span along it.
    const p0 = Math.min(x0 * ux + y0 * uy, x1 * ux + y1 * uy, x0 * ux + y1 * uy, x1 * ux + y0 * uy);
    const p1 = Math.max(x0 * ux + y0 * uy, x1 * ux + y1 * uy, x0 * ux + y1 * uy, x1 * ux + y0 * uy);
    const p = Math.max(p0, Math.min(p1, x * ux + y * uy));
    z += (p - p0) * k * 0.012;
  }
  for (const hl of h.hills ?? []) {
    const r = px(hl.r);
    const d = Math.hypot(x - px(hl.x), y - px(hl.y));
    if (d < r) z += (hl.k * (r * r - d * d)) / (2 * r) * 0.1;
  }
  for (const w of h.swells ?? []) {
    const r = px(w.r);
    const d = Math.hypot(x - px(w.x), y - px(w.y));
    if (d >= r) continue;
    // ∫ from d to r of 4k·t(r − t)/r² dt.
    const F = (t: number) => (4 * w.k * (r * t * t / 2 - (t * t * t) / 3)) / (r * r);
    z += (F(r) - F(d)) * 0.1;
  }
  return z;
}

function scratch(w: number, h: number): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  let canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  if (typeof OffscreenCanvas !== "undefined") canvas = new OffscreenCanvas(w, h);
  else if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    canvas = c;
  }
  const ctx = canvas?.getContext("2d") as CanvasRenderingContext2D | null;
  return canvas && ctx ? { canvas, ctx } : null;
}

function polyPath(ctx: CanvasRenderingContext2D, poly: readonly number[]): void {
  ctx.beginPath();
  for (let i = 0; i < poly.length; i += 2) {
    if (i === 0) ctx.moveTo(px(poly[i]!), px(poly[i + 1]!));
    else ctx.lineTo(px(poly[i]!), px(poly[i + 1]!));
  }
  ctx.closePath();
}

/**
 * The fairway's light and mowing (on top of the turf, clipped to the outline): a per-pixel pass at `res` px a world
 * px. Each pixel's slope (the height field's gradient) is lit from the top left; the stripes run across the hole at
 * the ground's own height, so a mound pushes them uphill into a bend.
 */
export function paintGroundLight(ctx: CanvasRenderingContext2D, h: MgHole, res = 1.5): void {
  const b = h.box;
  const W = Math.ceil((b.w + 8) * res);
  const H = Math.ceil((b.h + 8) * res);
  const sc = scratch(W, H);
  if (!sc) return;
  const img = sc.ctx.createImageData(W, H);
  const data = img.data;
  const lx = -0.62;
  const ly = -0.78;
  const STRIPE = 18;
  const BEND = 7;
  const e = 1.2;
  for (let j = 0; j < H; j++) {
    const y = b.y - 4 + j / res;
    for (let i = 0; i < W; i++) {
      const x = b.x - 4 + i / res;
      const z = groundHeight(h, x, y);
      const gx = (groundHeight(h, x + e, y) - groundHeight(h, x - e, y)) / (2 * e);
      const gy = (groundHeight(h, x, y + e) - groundHeight(h, x, y - e)) / (2 * e);
      // Lambert from the top left: a face tipped towards the light brightens, away from it darkens.
      const lit = Math.max(-1, Math.min(1, (gx * lx + gy * ly) * 6));
      // The stripes, laid on the ground: their phase follows the height, so they bend over it.
      const phase = (y - z * BEND) / STRIPE;
      const f = phase - Math.floor(phase);
      // A soft-edged stripe (a quarter-pixel blend at its edges).
      const stripe = Math.min(1, Math.max(0, Math.min(f, 1 - f) * STRIPE * 0.6)) * (Math.floor(phase) & 1 ? 1 : -1);
      const k = (j * W + i) * 4;
      // Light first (warm), shade (deep green-black), then the stripe on top.
      let r = 0;
      let g = 0;
      let bl = 0;
      let a = 0;
      if (lit > 0) {
        r = 255;
        g = 246;
        bl = 200;
        a = lit * 0.34;
      } else if (lit < 0) {
        r = 0;
        g = 18;
        bl = 6;
        a = -lit * 0.42;
      }
      const sa = Math.abs(stripe) * 0.1;
      if (sa > 0) {
        const [sr, sg, sb] = stripe > 0 ? [225, 255, 190] : [0, 30, 6];
        const t = a + sa * (1 - a);
        r = (r * a + sr * sa * (1 - a)) / Math.max(1e-6, t);
        g = (g * a + sg * sa * (1 - a)) / Math.max(1e-6, t);
        bl = (bl * a + sb * sa * (1 - a)) / Math.max(1e-6, t);
        a = t;
      }
      data[k] = r;
      data[k + 1] = g;
      data[k + 2] = bl;
      data[k + 3] = Math.round(a * 255);
    }
  }
  sc.ctx.putImageData(img, 0, 0);
  ctx.save();
  polyPath(ctx, h.poly);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sc.canvas as CanvasImageSource, b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  ctx.restore();
}

/** The flat turf colour under the light pass, where there is no rendered texture. */
export function paintPlainTurf(ctx: CanvasRenderingContext2D, h: MgHole): void {
  ctx.save();
  polyPath(ctx, h.poly);
  ctx.fillStyle = TURF;
  ctx.fill();
  ctx.restore();
}

/** Each union's circles (world px) grouped by its group index. */
function groups(circles: readonly { x: number; y: number; r: number }[], group: readonly number[] | undefined): { x: number; y: number; r: number }[][] {
  const out: { x: number; y: number; r: number }[][] = [];
  circles.forEach((c, i) => {
    const g = group?.[i] ?? i;
    (out[g] ??= []).push({ x: px(c.x), y: px(c.y), r: px(c.r) });
  });
  return out.filter(Boolean);
}

function unionPath(ctx: CanvasRenderingContext2D, cs: readonly { x: number; y: number; r: number }[], grow = 0): void {
  ctx.beginPath();
  for (const c of cs) {
    ctx.moveTo(c.x + c.r + grow, c.y);
    ctx.arc(c.x, c.y, Math.max(0.5, c.r + grow), 0, Math.PI * 2);
  }
}

function centre(cs: readonly { x: number; y: number; r: number }[]): { x: number; y: number; r: number } {
  let a = 0;
  let x = 0;
  let y = 0;
  for (const c of cs) {
    const w = c.r * c.r;
    a += w;
    x += c.x * w;
    y += c.y * w;
  }
  x /= a;
  y /= a;
  const r = Math.max(...cs.map((c) => Math.hypot(c.x - x, c.y - y) + c.r));
  return { x, y, r };
}

/**
 * A bunker: the union of its circles, a darker lip just outside, sand (the rendered sand tile when given), shaded from
 * the top left, with rake lines in arcs round its middle and a soft rim shadow inside the lip.
 */
export function paintBunkersV3(ctx: CanvasRenderingContext2D, h: MgHole, sand: CanvasPattern | string | null): void {
  for (const cs of groups(h.sands ?? [], h.sandGroups)) {
    const c = centre(cs);
    ctx.save();
    unionPath(ctx, cs, 2.2);
    ctx.fillStyle = "rgba(36,26,8,0.55)";
    ctx.fill();
    unionPath(ctx, cs);
    ctx.fillStyle = sand ?? "#DCC07E";
    ctx.fill();
    ctx.clip();
    // Light across the sand from the top left; the far side in the lip's shade.
    const g = ctx.createRadialGradient(c.x - c.r * 0.4, c.y - c.r * 0.45, c.r * 0.1, c.x, c.y, c.r * 1.05);
    g.addColorStop(0, "rgba(255,250,228,0.22)");
    g.addColorStop(0.7, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(70,44,10,0.32)");
    ctx.fillStyle = g;
    ctx.fillRect(c.x - c.r - 4, c.y - c.r - 4, c.r * 2 + 8, c.r * 2 + 8);
    // Rake lines: concentric arcs, a darker groove and a lit ridge beside it.
    ctx.lineWidth = 0.8;
    for (let rr = 4; rr < c.r + 4; rr += 3.2) {
      ctx.strokeStyle = "rgba(110,80,30,0.28)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,246,214,0.22)";
      ctx.beginPath();
      ctx.arc(c.x - 0.5, c.y - 0.6, rr + 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The inner rim shade (the turf's lip casting onto the sand).
    unionPath(ctx, cs, 1.4);
    ctx.strokeStyle = "rgba(60,38,8,0.35)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * A pond: a dressed stone edge round the union (its outer 3 px, outside the sim's circles), deep water shading to a
 * shallower rim, the sky's highlight from the top left and a few still ripples. The sim's water is the circles less
 * 2 px (a ball must be over the water to drop), so the stone sits on dry ground.
 */
export function paintPondsV3(ctx: CanvasRenderingContext2D, h: MgHole, stone: CanvasPattern | string | null): void {
  for (const cs of groups(h.ponds, h.pondGroups)) {
    const c = centre(cs);
    ctx.save();
    // The stone edge's cast shadow, then the stones.
    ctx.save();
    ctx.translate(1.2, 1.8);
    unionPath(ctx, cs, 4);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fill();
    ctx.restore();
    unionPath(ctx, cs, 3.5);
    ctx.fillStyle = stone ?? "#9A8C74";
    ctx.fill();
    unionPath(ctx, cs, 3.5);
    ctx.strokeStyle = "rgba(255,244,222,0.25)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Stone joints: short ticks round the edge.
    ctx.strokeStyle = "rgba(40,30,20,0.45)";
    ctx.lineWidth = 0.7;
    for (const k of cs) {
      const n = Math.max(6, Math.round(k.r / 3));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(k.x + Math.cos(a) * (k.r + 0.2), k.y + Math.sin(a) * (k.r + 0.2));
        ctx.lineTo(k.x + Math.cos(a) * (k.r + 3.4), k.y + Math.sin(a) * (k.r + 3.4));
        ctx.stroke();
      }
    }
    // The water.
    unionPath(ctx, cs);
    ctx.clip();
    const g = ctx.createRadialGradient(c.x + c.r * 0.15, c.y + c.r * 0.2, 2, c.x, c.y, c.r * 1.1);
    g.addColorStop(0, "#0E3F5C");
    g.addColorStop(0.7, "#1B6A86");
    g.addColorStop(1, "#3E95A8");
    ctx.fillStyle = g;
    ctx.fillRect(c.x - c.r - 6, c.y - c.r - 6, c.r * 2 + 12, c.r * 2 + 12);
    // The edge's own shadow on the water.
    unionPath(ctx, cs, 1);
    ctx.strokeStyle = "rgba(0,20,30,0.45)";
    ctx.lineWidth = 3;
    ctx.stroke();
    // Sky highlight and still ripples.
    const hl = ctx.createRadialGradient(c.x - c.r * 0.45, c.y - c.r * 0.45, 1, c.x - c.r * 0.45, c.y - c.r * 0.45, c.r * 0.7);
    hl.addColorStop(0, "rgba(220,245,255,0.28)");
    hl.addColorStop(1, "rgba(220,245,255,0)");
    ctx.fillStyle = hl;
    ctx.fillRect(c.x - c.r - 6, c.y - c.r - 6, c.r * 2 + 12, c.r * 2 + 12);
    ctx.strokeStyle = "rgba(210,240,255,0.22)";
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 3; i++) {
      const rx = c.x + Math.cos(i * 2.1 + c.x) * c.r * 0.4;
      const ry = c.y + Math.sin(i * 1.7 + c.y) * c.r * 0.35;
      for (const rr of [3, 6, 9]) {
        ctx.beginPath();
        ctx.ellipse(rx, ry, rr, rr * 0.55, 0, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
