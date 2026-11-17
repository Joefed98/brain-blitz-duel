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

/**
 * A hazard's smooth outline (Joe, 15 Nov 2026: "never clusters of circles"): the level set of the sim's own field over
 * its circles, Σ (r²/d²)² (minigolf.ts mgMetaSum, here in floats for drawing), traced by marching squares on a 1 px grid
 * and joined into closed loops. `grow` > 0 traces it that far outside (the threshold a lone circle of the group's typical
 * radius would have `grow` px out), < 0 inside. Cached per shape and offset (the hole is painted once).
 */
const outlineCache = new Map<string, number[][]>();
function metaField(cs: readonly { x: number; y: number; r: number }[], x: number, y: number): number {
  let f = 0;
  for (const c of cs) {
    const d2 = (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y);
    const r2 = c.r * c.r;
    if (d2 >= 9 * r2) continue;
    const q = Math.min(r2 / Math.max(d2, 1e-6), 64);
    f += q * q;
  }
  return f;
}
export function metaOutline(cs: readonly { x: number; y: number; r: number }[], grow = 0): number[][] {
  const key = `${cs.map((c) => `${c.x},${c.y},${c.r}`).join(";")}|${grow}`;
  const hit = outlineCache.get(key);
  if (hit) return hit;
  const radii = cs.map((c) => c.r).sort((a, b) => a - b);
  const R = radii[Math.floor(radii.length / 2)]!;
  const thr = Math.pow(R / Math.max(1, R + grow), 4);
  const pad = Math.max(0, grow) + 3;
  const x0 = Math.floor(Math.min(...cs.map((c) => c.x - c.r)) - pad);
  const y0 = Math.floor(Math.min(...cs.map((c) => c.y - c.r)) - pad);
  const x1 = Math.ceil(Math.max(...cs.map((c) => c.x + c.r)) + pad);
  const y1 = Math.ceil(Math.max(...cs.map((c) => c.y + c.r)) + pad);
  const W = x1 - x0 + 1;
  const H = y1 - y0 + 1;
  const v = new Float64Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) v[j * W + i] = metaField(cs, x0 + i, y0 + j) - thr;
  // Marching squares: each cell's edge crossings, joined into loops by their shared edge points.
  const at = (i: number, j: number) => v[j * W + i]!;
  const pt = (i0: number, j0: number, i1: number, j1: number): [number, number, string] => {
    const a = at(i0, j0);
    const b = at(i1, j1);
    const t = a / (a - b);
    const key2 = i0 === i1 ? `v${i0},${Math.min(j0, j1)}` : `h${Math.min(i0, i1)},${j0}`;
    return [x0 + i0 + (i1 - i0) * t, y0 + j0 + (j1 - j0) * t, key2];
  };
  // Undirected: each crossing point joins the (at most two) segments through it, so loops close whatever way each
  // cell's segment was written.
  const links = new Map<string, string[]>();
  const pos = new Map<string, [number, number]>();
  const link = (a: string, b: string) => {
    (links.get(a) ?? links.set(a, []).get(a)!).push(b);
    (links.get(b) ?? links.set(b, []).get(b)!).push(a);
  };
  for (let j = 0; j < H - 1; j++)
    for (let i = 0; i < W - 1; i++) {
      const c = (at(i, j) > 0 ? 8 : 0) | (at(i + 1, j) > 0 ? 4 : 0) | (at(i + 1, j + 1) > 0 ? 2 : 0) | (at(i, j + 1) > 0 ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const T = () => pt(i, j, i + 1, j);
      const Rr = () => pt(i + 1, j, i + 1, j + 1);
      const B = () => pt(i, j + 1, i + 1, j + 1);
      const L = () => pt(i, j, i, j + 1);
      const segs: [() => [number, number, string], () => [number, number, string]][] = [];
      switch (c) {
        case 1: segs.push([L, B]); break;
        case 2: segs.push([B, Rr]); break;
        case 3: segs.push([L, Rr]); break;
        case 4: segs.push([Rr, T]); break;
        case 5: segs.push([L, T], [Rr, B]); break;
        case 6: segs.push([B, T]); break;
        case 7: segs.push([L, T]); break;
        case 8: segs.push([T, L]); break;
        case 9: segs.push([T, B]); break;
        case 10: segs.push([T, Rr], [B, L]); break;
        case 11: segs.push([T, Rr]); break;
        case 12: segs.push([Rr, L]); break;
        case 13: segs.push([Rr, B]); break;
        case 14: segs.push([B, L]); break;
      }
      for (const [fa, fb] of segs) {
        const a = fa();
        const b = fb();
        pos.set(a[2], [a[0], a[1]]);
        pos.set(b[2], [b[0], b[1]]);
        link(a[2], b[2]);
      }
    }
  const loops: number[][] = [];
  const used = new Set<string>();
  for (const startKey of links.keys()) {
    if (used.has(startKey)) continue;
    const loop: number[] = [];
    let k: string | undefined = startKey;
    while (k !== undefined && !used.has(k)) {
      used.add(k);
      const p = pos.get(k)!;
      loop.push(p[0], p[1]);
      k = (links.get(k) ?? []).find((n) => !used.has(n));
    }
    if (loop.length >= 6) loops.push(loop);
  }
  outlineCache.set(key, loops);
  return loops;
}

/** The smooth outline as a path (every loop, so a ring's inner shore is a hole in it under nonzero filling). */
function unionPath(ctx: CanvasRenderingContext2D, cs: readonly { x: number; y: number; r: number }[], grow = 0): void {
  ctx.beginPath();
  for (const loop of metaOutline(cs, grow)) {
    ctx.moveTo(loop[0]!, loop[1]!);
    for (let i = 2; i < loop.length; i += 2) ctx.lineTo(loop[i]!, loop[i + 1]!);
    ctx.closePath();
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
 * A hazard's field sampled once at the canvas's own resolution (k device px a world px) over its box: the sim's field,
 * Σ (r²/d²)², in floats. Its masks (the shape grown or shrunk, shifted) are thresholds of this one grid, so every band,
 * fill and clip of a pond or bunker follows the sim's exact smooth shape, anti-aliased, with no path to assemble.
 */
interface FieldGrid {
  x: number;
  y: number;
  w: number;
  h: number;
  k: number;
  W: number;
  H: number;
  f: Float32Array;
  R: number;
}
function fieldGrid(ctx: CanvasRenderingContext2D, cs: readonly { x: number; y: number; r: number }[], pad: number): FieldGrid {
  const m = ctx.getTransform();
  const k = Math.max(1, Math.min(3, Math.hypot(m.a, m.b)));
  const b = bboxOf(cs, pad);
  const W = Math.ceil(b.w * k);
  const H = Math.ceil(b.h * k);
  const f = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    const y = b.y + (j + 0.5) / k;
    for (let i = 0; i < W; i++) f[j * W + i] = metaField(cs, b.x + (i + 0.5) / k, y);
  }
  const radii = cs.map((c) => c.r).sort((a, c) => a - c);
  return { ...b, k, W, H, f, R: radii[Math.floor(radii.length / 2)]! };
}
/** The shape grown by `grow` world px (the threshold a lone circle of the group's typical radius would have there), moved by dx, dy. */
function gridMask(g: FieldGrid, grow: number, dx = 0, dy = 0): CanvasImageSource | null {
  const sc = scratch(g.W, g.H);
  if (!sc) return null;
  const img = sc.ctx.createImageData(g.W, g.H);
  const thr = Math.pow(g.R / Math.max(1, g.R + grow), 4);
  const si = Math.round(dx * g.k);
  const sj = Math.round(dy * g.k);
  for (let j = 0; j < g.H; j++) {
    const jj = j - sj;
    if (jj < 0 || jj >= g.H) continue;
    for (let i = 0; i < g.W; i++) {
      const ii = i - si;
      if (ii < 0 || ii >= g.W) continue;
      const v = g.f[jj * g.W + ii]!;
      // A soft edge about a device pixel wide: the field changes ~4·f/d a world px near its edge.
      const a = Math.max(0, Math.min(1, 0.5 + ((v - thr) / thr) * (g.R / 4) * g.k * 0.5));
      img.data[(j * g.W + i) * 4 + 3] = Math.round(a * 255);
    }
  }
  sc.ctx.putImageData(img, 0, 0);
  return sc.canvas as CanvasImageSource;
}
/** Draws `draw` (world coordinates) inside the shape grown by `grow`. */
function inShape(ctx: CanvasRenderingContext2D, g: FieldGrid, grow: number, draw: (t: CanvasRenderingContext2D) => void, dx = 0, dy = 0): void {
  const sc = scratch(g.W, g.H);
  const mask = gridMask(g, grow, dx, dy);
  if (!sc || !mask) return;
  const t = sc.ctx;
  t.scale(g.k, g.k);
  t.translate(-g.x, -g.y);
  draw(t);
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = "destination-in";
  t.drawImage(mask, 0, 0);
  ctx.drawImage(sc.canvas as CanvasImageSource, g.x, g.y, g.w, g.h);
}
/**
 * Fills (the shape grown by `grow`) less (the shape grown by `cut`, moved by dx, dy) with `fill`: a crisp lip, rim or
 * crescent of the whole smooth shape.
 */
function band(ctx: CanvasRenderingContext2D, g: FieldGrid, grow: number, cut: number, dx: number, dy: number, fill: string | CanvasPattern): void {
  const sc = scratch(g.W, g.H);
  const keep = gridMask(g, grow);
  const away = gridMask(g, cut, dx, dy);
  if (!sc || !keep || !away) return;
  const t = sc.ctx;
  t.save();
  t.scale(g.k, g.k);
  t.translate(-g.x, -g.y);
  t.fillStyle = fill;
  t.fillRect(g.x, g.y, g.w, g.h);
  t.restore();
  t.globalCompositeOperation = "destination-in";
  t.drawImage(keep, 0, 0);
  t.globalCompositeOperation = "destination-out";
  t.drawImage(away, 0, 0);
  ctx.drawImage(sc.canvas as CanvasImageSource, g.x, g.y, g.w, g.h);
}

/**
 * A bunker (a hollow in the turf): the turf's dark lip just outside its smooth shape, the sand (the rendered sand tile
 * when given) inside it, then the hollow's light: the inner wall on the top-left in shade (the lip casting onto the
 * sand), the far inner wall lit, rake lines in arcs round its middle, and a crisp lit crest on the lip's far side.
 */
export function paintBunkersV3(ctx: CanvasRenderingContext2D, h: MgHole, sand: CanvasPattern | string | null): void {
  for (const cs of groups(h.sands ?? [], h.sandGroups)) {
    const c = centre(cs);
    const g = fieldGrid(ctx, cs, 8);
    band(ctx, g, 2.6, -99, 0, 0, "rgba(28,22,8,0.62)");
    band(ctx, g, 2.6, 2.6, -1.4, -1.6, "rgba(196,230,150,0.38)");
    inShape(ctx, g, 0, (t) => {
      t.fillStyle = sand ?? "#DCC07E";
      t.fillRect(g.x, g.y, g.w, g.h);
      const lg = t.createLinearGradient(c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r);
      lg.addColorStop(0, "rgba(120,86,30,0.20)");
      lg.addColorStop(0.55, "rgba(255,246,214,0.10)");
      lg.addColorStop(1, "rgba(255,250,232,0.22)");
      t.fillStyle = lg;
      t.fillRect(g.x, g.y, g.w, g.h);
      for (let rr = 5; rr < c.r + 6; rr += 3.4) {
        t.lineWidth = 0.9;
        t.strokeStyle = "rgba(112,80,28,0.34)";
        t.beginPath();
        t.arc(c.x, c.y, rr, 0, Math.PI * 2);
        t.stroke();
        t.lineWidth = 0.7;
        t.strokeStyle = "rgba(255,248,222,0.40)";
        t.beginPath();
        t.arc(c.x + 0.45, c.y + 0.55, rr + 0.9, 0, Math.PI * 2);
        t.stroke();
      }
    });
    band(ctx, g, 0, 0, 3, 3.6, "rgba(70,44,10,0.42)");
    band(ctx, g, 0, 0, -2, -2.4, "rgba(255,248,226,0.30)");
  }
}

/**
 * A pond: a ring of dressed stone round its smooth shape (outside the water, on dry ground), bevelled (its top-left
 * crest lit, a crisp line; its lower edge in shade), deep water shading from a dark middle to a shallower rim with the
 * sky's reflection laid across it, the stone's shadow on the water, a crisp specular highlight on the near curve and a
 * few still ripples. Glossy without any glow: every highlight is a hard-edged shape.
 */
export function paintPondsV3(ctx: CanvasRenderingContext2D, h: MgHole, stone: CanvasPattern | string | null): void {
  for (const cs of groups(h.ponds, h.pondGroups)) {
    const c = centre(cs);
    const g = fieldGrid(ctx, cs, 10);
    band(ctx, g, 5.5, -99, 0, 0, "rgba(0,0,0,0.38)");
    band(ctx, g, 4.2, -99, 0, 0, stone ?? "#9A8C74");
    band(ctx, g, 4.2, 4.2, 1.2, 1.4, "rgba(255,246,226,0.55)");
    band(ctx, g, 4.2, 4.2, -1.1, -1.3, "rgba(30,22,12,0.5)");
    const big = cs.reduce((a, b) => (b.r > a.r ? b : a));
    inShape(ctx, g, 0, (t) => {
      const rg = t.createRadialGradient(c.x + c.r * 0.12, c.y + c.r * 0.18, 1, c.x, c.y, c.r * 1.05);
      rg.addColorStop(0, "#082C42");
      rg.addColorStop(0.6, "#0F4D6A");
      rg.addColorStop(1, "#2B7E92");
      t.fillStyle = rg;
      t.fillRect(g.x, g.y, g.w, g.h);
      const sky = t.createLinearGradient(c.x - c.r, c.y - c.r, c.x + c.r * 0.6, c.y + c.r * 0.6);
      sky.addColorStop(0, "rgba(190,226,240,0.34)");
      sky.addColorStop(0.45, "rgba(190,226,240,0.10)");
      sky.addColorStop(0.46, "rgba(190,226,240,0)");
      t.fillStyle = sky;
      t.fillRect(g.x, g.y, g.w, g.h);
      t.strokeStyle = "rgba(214,240,250,0.30)";
      t.lineWidth = 0.8;
      for (const k of cs.filter((_, i) => i % 3 === 0)) {
        for (const rr of [3.5, 7]) {
          t.beginPath();
          t.ellipse(k.x + k.r * 0.15, k.y + k.r * 0.1, rr, rr * 0.55, 0, Math.PI * 1.15, Math.PI * 1.85);
          t.stroke();
        }
      }
    });
    band(ctx, g, 0, 0, 2.8, 3.2, "rgba(0,18,28,0.55)");
    inShape(ctx, g, -1.5, (t) => {
      t.fillStyle = "rgba(244,252,255,0.85)";
      t.beginPath();
      t.ellipse(big.x - big.r * 0.42, big.y - big.r * 0.5, Math.max(2.4, big.r * 0.32), Math.max(0.9, big.r * 0.07), -0.62, 0, Math.PI * 2);
      t.fill();
      t.fillStyle = "rgba(244,252,255,0.6)";
      t.beginPath();
      t.arc(big.x - big.r * 0.12, big.y - big.r * 0.68, Math.max(0.9, big.r * 0.05), 0, Math.PI * 2);
      t.fill();
    });
  }
}
