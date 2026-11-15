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
    z += (p - p0) * k * 0.0065;
  }
  for (const hl of h.hills ?? []) {
    const r = px(hl.r);
    const d = Math.hypot(x - px(hl.x), y - px(hl.y));
    if (d < r) z += (hl.k * (r * r - d * d)) / (2 * r) * 0.005;
  }
  for (const w of h.swells ?? []) {
    const r = px(w.r);
    const d = Math.hypot(x - px(w.x), y - px(w.y));
    if (d >= r) continue;
    // ∫ from d to r of 4k·t(r − t)/r² dt.
    const F = (t: number) => (4 * w.k * (r * t * t / 2 - (t * t * t) / 3)) / (r * r);
    z += (F(r) - F(d)) * 0.0028;
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
  /** World px a stripe moves a unit of height: a mound bends its stripes by about one stripe's width. */
  const BEND = 6;
  const e = 1.2;
  for (let j = 0; j < H; j++) {
    const y = b.y - 4 + j / res;
    for (let i = 0; i < W; i++) {
      const x = b.x - 4 + i / res;
      const z = groundHeight(h, x, y);
      const gx = (groundHeight(h, x + e, y) - groundHeight(h, x - e, y)) / (2 * e);
      const gy = (groundHeight(h, x, y + e) - groundHeight(h, x, y - e)) / (2 * e);
      // Lambert from the top left: a face tipped towards the light brightens, away from it darkens.
      const lit = Math.max(-1, Math.min(1, (gx * lx + gy * ly) * 16));
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
        a = lit * 0.4;
      } else if (lit < 0) {
        r = 0;
        g = 18;
        bl = 6;
        a = -lit * 0.5;
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

/** A union's bounding box (world px) grown by `pad`. */
function bboxOf(cs: readonly { x: number; y: number; r: number }[], pad: number) {
  const x0 = Math.min(...cs.map((c) => c.x - c.r)) - pad;
  const y0 = Math.min(...cs.map((c) => c.y - c.r)) - pad;
  const x1 = Math.max(...cs.map((c) => c.x + c.r)) + pad;
  const y1 = Math.max(...cs.map((c) => c.y + c.r)) + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Fills (the union grown by `grow`) less (the union grown by `cut`, moved by dx, dy) with `fill`, through an off-screen
 * mask, so a union of circles gets a crisp lip, rim or crescent with no seam where its circles overlap.
 */
function unionBand(ctx: CanvasRenderingContext2D, cs: readonly { x: number; y: number; r: number }[], grow: number, cut: number, dx: number, dy: number, fill: string | CanvasPattern): void {
  const m = ctx.getTransform();
  const k = Math.max(1, Math.min(4, Math.hypot(m.a, m.b)));
  const b = bboxOf(cs, Math.max(grow, cut) + Math.abs(dx) + Math.abs(dy) + 2);
  const sc = scratch(Math.ceil(b.w * k), Math.ceil(b.h * k));
  if (!sc) return;
  const t = sc.ctx;
  t.scale(k, k);
  t.translate(-b.x, -b.y);
  unionPath(t, cs, grow);
  t.fillStyle = fill;
  t.fill();
  t.globalCompositeOperation = "destination-out";
  t.translate(dx, dy);
  unionPath(t, cs, cut);
  t.fillStyle = "#000";
  t.fill();
  ctx.drawImage(sc.canvas as CanvasImageSource, b.x, b.y, b.w, b.h);
}

/**
 * A bunker (a hollow in the turf): the turf's dark lip just outside the union, the sand (the rendered sand tile when
 * given) inside it, then the hollow's light: the inner wall on the top-left in shade (the lip casting onto the sand),
 * the far inner wall lit, rake lines in arcs round its middle, and a crisp lit crest on the turf lip's far side. Every
 * band is a mask of the whole union, so the circles' overlaps leave no seam.
 */
export function paintBunkersV3(ctx: CanvasRenderingContext2D, h: MgHole, sand: CanvasPattern | string | null): void {
  for (const cs of groups(h.sands ?? [], h.sandGroups)) {
    const c = centre(cs);
    // The turf lip: a dark band all round, its far (bottom-right) crest catching the light.
    unionBand(ctx, cs, 2.6, 0, 0, 0, "rgba(28,22,8,0.62)");
    unionBand(ctx, cs, 2.6, 2.6, -1.4, -1.6, "rgba(196,230,150,0.38)");
    ctx.save();
    unionPath(ctx, cs);
    ctx.fillStyle = sand ?? "#DCC07E";
    ctx.fill();
    ctx.clip();
    // Warm sun across the sand from the top left.
    const g = ctx.createLinearGradient(c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r);
    g.addColorStop(0, "rgba(120,86,30,0.20)");
    g.addColorStop(0.55, "rgba(255,246,214,0.10)");
    g.addColorStop(1, "rgba(255,250,232,0.22)");
    ctx.fillStyle = g;
    ctx.fillRect(c.x - c.r - 4, c.y - c.r - 4, c.r * 2 + 8, c.r * 2 + 8);
    // Rake lines: grooves (shaded on their near side, lit on their far side).
    for (let rr = 5; rr < c.r + 4; rr += 3.4) {
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = "rgba(112,80,28,0.34)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = "rgba(255,248,222,0.40)";
      ctx.beginPath();
      ctx.arc(c.x + 0.45, c.y + 0.55, rr + 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    // The hollow: shade on the near (top-left) inner wall, light on the far one.
    unionBand(ctx, cs, 0, 0, 3, 3.6, "rgba(70,44,10,0.42)");
    unionBand(ctx, cs, 0, 0, -2, -2.4, "rgba(255,248,226,0.30)");
  }
}

/**
 * A pond: a ring of dressed stone round the union (outside the sim's circles, on dry ground), bevelled (its top-left
 * crest lit, a crisp line; its lower edge in shade), deep water shading from a dark middle to a shallower rim with the
 * sky's reflection laid across it, the stone's shadow on the water, a crisp specular highlight on the near curve and a
 * few still ripples. Glossy without any glow: every highlight is a hard-edged shape.
 */
export function paintPondsV3(ctx: CanvasRenderingContext2D, h: MgHole, stone: CanvasPattern | string | null): void {
  for (const cs of groups(h.ponds, h.pondGroups)) {
    const c = centre(cs);
    // The stone ring's cast shadow on the turf, the stones, their bevel.
    unionBand(ctx, cs, 5.5, 0, 0, 0, "rgba(0,0,0,0.38)");
    unionBand(ctx, cs, 4.2, 0, 0, 0, stone ?? "#9A8C74");
    unionBand(ctx, cs, 4.2, 4.2, 1.2, 1.4, "rgba(255,246,226,0.55)");
    unionBand(ctx, cs, 4.2, 4.2, -1.1, -1.3, "rgba(30,22,12,0.5)");
    ctx.save();
    unionPath(ctx, cs);
    ctx.clip();
    // Deep water: dark at its heart, clearer towards the rim.
    const g = ctx.createRadialGradient(c.x + c.r * 0.12, c.y + c.r * 0.18, 1, c.x, c.y, c.r * 1.05);
    g.addColorStop(0, "#082C42");
    g.addColorStop(0.6, "#0F4D6A");
    g.addColorStop(1, "#2B7E92");
    ctx.fillStyle = g;
    ctx.fillRect(c.x - c.r - 6, c.y - c.r - 6, c.r * 2 + 12, c.r * 2 + 12);
    // The sky reflected: a broad diagonal band, lighter towards the top left.
    const sky = ctx.createLinearGradient(c.x - c.r, c.y - c.r, c.x + c.r * 0.6, c.y + c.r * 0.6);
    sky.addColorStop(0, "rgba(190,226,240,0.34)");
    sky.addColorStop(0.45, "rgba(190,226,240,0.10)");
    sky.addColorStop(0.46, "rgba(190,226,240,0)");
    ctx.fillStyle = sky;
    ctx.fillRect(c.x - c.r - 6, c.y - c.r - 6, c.r * 2 + 12, c.r * 2 + 12);
    // Still ripples: thin, hard lines.
    ctx.strokeStyle = "rgba(214,240,250,0.30)";
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 2; i++) {
      const rx = c.x + Math.cos(i * 2.4 + c.x) * c.r * 0.35;
      const ry = c.y + Math.sin(i * 1.9 + c.y) * c.r * 0.3;
      for (const rr of [3.5, 7]) {
        ctx.beginPath();
        ctx.ellipse(rx, ry, rr, rr * 0.55, 0, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    }
    ctx.restore();
    // The stone's shadow on the water along its near edge, then a crisp specular glint on the far curve (glass-like).
    unionBand(ctx, cs, 0, 0, 2.8, 3.2, "rgba(0,18,28,0.55)");
    const big = cs.reduce((a, b) => (b.r > a.r ? b : a));
    ctx.save();
    unionPath(ctx, cs);
    ctx.clip();
    ctx.fillStyle = "rgba(244,252,255,0.85)";
    ctx.beginPath();
    ctx.ellipse(big.x - big.r * 0.42, big.y - big.r * 0.5, Math.max(2.4, big.r * 0.32), Math.max(0.9, big.r * 0.07), -0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(244,252,255,0.6)";
    ctx.beginPath();
    ctx.arc(big.x - big.r * 0.12, big.y - big.r * 0.68, Math.max(0.9, big.r * 0.05), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
