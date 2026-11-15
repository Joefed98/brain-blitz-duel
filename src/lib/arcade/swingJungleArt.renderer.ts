/**
 * Grappler's jungle materials (the Action overhaul's materials pass, 15 Nov 2026; display only, swingRev 17): the
 * concept A look (docs/design/game-concepts/action.md) in 2D, all procedural and painted once into cached tiles and
 * sprites at the device's resolution, so no image ships and each frame is a few blits.
 *
 *  - Trunk layers: two scrolling layers of tall trunks behind the course (mid at 0.3 of the camera, near at 0.55), with
 *    bark (a rounded shade across the trunk, striations, knots, moss patches), the mid layer faded into the haze; the
 *    near layer carries clusters of lit leaves. Each layer is one seamless tile repeated across the view.
 *  - Leaf clusters: pointed leaves with a lit face, a darker underside and a midrib, sorted back to front.
 *  - Vine rope: a dark core, a mid strand, the twist of a second strand and a thin light line on the lit side.
 *  - Grab rings: an enamelled cream-metal ring (lit from the top left) round a dark centre, a crisp specular arc and a
 *    gold bead; the grabbed ring in gold enamel. No glow round them.
 *  - Wood: planks with grain and seams, a bark-textured post.
 *
 * Every shape is seeded by position (artHash), never random, so every player and replay sees the same jungle. Nothing
 * here collides or reads more than the camera. Render only: never writes the state.
 */
import { artHash } from "./art.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";

type Ctx = CanvasRenderingContext2D;

/** The device pixels per world unit the context draws at (1–3), so cached art is as sharp as direct painting. */
export function jungleArtScale(ctx: Ctx): number {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const s = t ? Math.hypot(t.a, t.b) : 1;
  return Math.max(1, Math.min(3, Math.ceil(s * 2) / 2));
}

/* ---------------- Leaves ---------------- */

/** One pointed leaf at (x, y), `len` long, turned `a` radians; lit face from the top left. */
function leaf(ctx: Ctx, x: number, y: number, len: number, a: number, light: number, dark: string, lit: string): void {
  const w = len * 0.42;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, -w, len, 0);
  ctx.quadraticCurveTo(len * 0.45, w, 0, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -w, 0, w);
  g.addColorStop(0, lit);
  g.addColorStop(1, dark);
  ctx.globalAlpha = 0.55 + 0.45 * light;
  ctx.fillStyle = g;
  ctx.fill();
  ctx.globalAlpha = 1;
  // Midrib and a short sheen along the upper half.
  ctx.strokeStyle = "rgba(10,30,12,0.45)";
  ctx.lineWidth = Math.max(0.6, len * 0.035);
  ctx.beginPath();
  ctx.moveTo(len * 0.06, 0);
  ctx.lineTo(len * 0.9, 0);
  ctx.stroke();
  if (light > 0.6) {
    ctx.strokeStyle = `rgba(230,255,190,${(0.35 * light).toFixed(3)})`;
    ctx.lineWidth = Math.max(0.6, len * 0.05);
    ctx.beginPath();
    ctx.moveTo(len * 0.2, -w * 0.38);
    ctx.quadraticCurveTo(len * 0.45, -w * 0.62, len * 0.72, -w * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

const LEAF_DARK = ["#123A1C", "#1A4A22", "#22582A"];
const LEAF_LIT = ["#5FA544", "#79BE52", "#9BD465"];

/**
 * A cluster of lit leaves round (cx, cy), radius r, from `seed`: about 1 leaf per 18 px², the back ones darker, the
 * front ones on top and lit from the top left. `dim` (0–1) takes it darker (deeper in the jungle).
 */
export function paintLeafCluster(ctx: Ctx, cx: number, cy: number, r: number, seed: number, dim = 0): void {
  const n = Math.max(10, Math.min(60, Math.round((r * r) / 18)));
  const leaves: { x: number; y: number; a: number; len: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const h = artHash(i, seed);
    const ang = ((h % 6283) / 1000);
    const d = r * Math.sqrt(((h >>> 13) % 1000) / 1000);
    leaves.push({ x: cx + Math.cos(ang) * d, y: cy + Math.sin(ang) * d * 0.72, a: ang + ((h >>> 7) % 100) / 100 - 0.5, len: r * (0.34 + ((h >>> 20) % 30) / 100), z: (h >>> 3) % 1000 });
  }
  leaves.sort((a, b) => a.z - b.z);
  for (const l of leaves) {
    const depth = l.z / 1000;
    // Lit from the top left: leaves up and left of the centre are brighter.
    const light = Math.max(0, Math.min(1, 0.35 + depth * 0.45 + ((cx - l.x) / r) * 0.15 + ((cy - l.y) / r) * 0.25)) * (1 - dim * 0.6);
    const k = Math.min(2, Math.floor(depth * 3));
    leaf(ctx, l.x, l.y, l.len, l.a, light, LEAF_DARK[k]!, LEAF_LIT[k]!);
  }
}

const clusterCache = new Map<string, { canvas: ArtCanvas; size: number } | null>();
/** A cached leaf-cluster sprite (variant 0–5, radius r) at scale `k`, drawn centred at (x, y); painted direct if none. */
export function drawLeafClusterSprite(ctx: Ctx, x: number, y: number, r: number, variant: number, dim: number): void {
  const k = jungleArtScale(ctx);
  const step = Math.round(dim * 4);
  const key = `${variant}|${r}|${k}|${step}`;
  let sprite = clusterCache.get(key);
  if (sprite === undefined) {
    const size = Math.ceil(r * 2.6);
    const canvas = artCanvas(Math.ceil(size * k), Math.ceil(size * k));
    const c = canvas ? artContext(canvas) : null;
    if (canvas && c) {
      c.scale(k, k);
      paintLeafCluster(c as Ctx, size / 2, size / 2, r, 7919 * (variant + 1), step / 4);
      sprite = { canvas, size };
    } else sprite = null;
    if (clusterCache.size > 64) clusterCache.clear();
    clusterCache.set(key, sprite);
  }
  if (sprite) ctx.drawImage(sprite.canvas as CanvasImageSource, x - sprite.size / 2, y - sprite.size / 2, sprite.size, sprite.size);
  else paintLeafCluster(ctx, x, y, r, 7919 * (variant + 1), step / 4);
}

/* ---------------- Bark ---------------- */

/**
 * A trunk from y0 to y1 at x (left edge), `w` wide: a rounded shade across it (lit left edge, shadowed right), bark
 * striations and knots, moss patches. `base` is the trunk's mid colour.
 */
export function paintTrunk(ctx: Ctx, x: number, y0: number, y1: number, w: number, seed: number, base: string, hi: string, lo: string, detail: number): void {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, lo);
  g.addColorStop(0.18, hi);
  g.addColorStop(0.45, base);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.fillRect(x, y0, w, y1 - y0);
  if (detail <= 0) return;
  // Striations: long wavering grooves down the trunk.
  ctx.lineWidth = Math.max(0.8, w * 0.04);
  const grooves = Math.max(2, Math.round(w / 7));
  for (let i = 0; i < grooves; i++) {
    const h = artHash(i, seed);
    const gx = x + ((i + 0.5) * w) / grooves + ((h % 5) - 2);
    ctx.strokeStyle = i % 2 ? `rgba(0,0,0,${0.28 * detail})` : `rgba(255,240,200,${0.06 * detail})`;
    ctx.beginPath();
    ctx.moveTo(gx, y0);
    for (let y = y0; y <= y1; y += 24) ctx.lineTo(gx + Math.sin(y * 0.031 + (h % 7)) * 1.6, y);
    ctx.stroke();
  }
  // Knots and broken bark.
  const knots = Math.round(((y1 - y0) / 140) * detail);
  for (let i = 0; i < knots; i++) {
    const h = artHash(i, seed + 41);
    const ky = y0 + ((h % 1000) / 1000) * (y1 - y0);
    const kx = x + w * (0.25 + ((h >>> 10) % 50) / 100);
    const kr = 1.5 + ((h >>> 4) % 4);
    ctx.fillStyle = `rgba(0,0,0,${0.35 * detail})`;
    ctx.beginPath();
    ctx.ellipse(kx, ky, kr, kr * 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,230,180,${0.12 * detail})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(kx - 0.6, ky - 0.6, kr + 1, kr * 1.7 + 1, 0, Math.PI * 0.9, Math.PI * 1.6);
    ctx.stroke();
  }
  // Moss patches on the lit side.
  const moss = Math.round(((y1 - y0) / 200) * detail);
  for (let i = 0; i < moss; i++) {
    const h = artHash(i, seed + 97);
    const my = y0 + ((h % 1000) / 1000) * (y1 - y0);
    const mh = 30 + ((h >>> 9) % 60);
    // A run of moss down the lit edge: a few fine streaks, brightest at the edge.
    ctx.lineWidth = 1.2;
    for (let s = 0; s < 4; s++) {
      ctx.strokeStyle = `rgba(${110 + s * 12},${160 + s * 8},70,${(0.32 - s * 0.06) * detail})`;
      ctx.beginPath();
      ctx.moveTo(x + 1.5 + s * 1.6, my);
      ctx.lineTo(x + 1.5 + s * 1.6 + Math.sin(my) * 0.8, my + mh * (1 - s * 0.18));
      ctx.stroke();
    }
  }
}

/* ---------------- Trunk layers ---------------- */

export interface TrunkLayer {
  id: "mid" | "near";
  /** The tile's width (world px): one seamless period. */
  tileW: number;
  /** Camera fraction it scrolls at. */
  parallax: number;
}
export const JUNGLE_MID: TrunkLayer = { id: "mid", tileW: 520, parallax: 0.3 };
export const JUNGLE_NEAR: TrunkLayer = { id: "near", tileW: 640, parallax: 0.55 };

/** The trunks of a layer's tile (left edges, widths, seeds), the same every time. */
export function trunksOf(layer: TrunkLayer): { x: number; w: number; seed: number }[] {
  const out: { x: number; w: number; seed: number }[] = [];
  const n = layer.id === "mid" ? 6 : 4;
  for (let i = 0; i < n; i++) {
    const h = artHash(i, layer.id === "mid" ? 1301 : 1709);
    const w = layer.id === "mid" ? 20 + (h % 14) : 36 + (h % 20);
    out.push({ x: Math.round(((i + 0.15 + ((h >>> 8) % 50) / 100) * layer.tileW) / n), w, seed: h });
  }
  return out;
}

/** Paints a layer's tile from x = 0 to tileW (trunks wrapped across its ends so the tile repeats seamlessly). */
function paintTrunkTile(ctx: Ctx, layer: TrunkLayer, H: number): void {
  for (const t of trunksOf(layer))
    for (const shift of [0, -layer.tileW, layer.tileW]) {
      const x = t.x + shift;
      if (x + t.w < 0 || x > layer.tileW) continue;
      if (layer.id === "mid") {
        paintTrunk(ctx, x, 0, H, t.w, t.seed, "#244634", "#3A6248", "#14281D", 0.6);
        // Into the haze.
        ctx.fillStyle = "rgba(52,104,84,0.42)";
        ctx.fillRect(x, 0, t.w, H);
      } else {
        paintTrunk(ctx, x, 0, H, t.w, t.seed, "#1C3222", "#355238", "#0B1810", 1);
        // Lit leaf clusters part way up (concept A's mid-height foliage).
        const h = t.seed;
        const cy = H * (0.26 + ((h >>> 5) % 18) / 100);
        paintLeafCluster(ctx, x + t.w / 2 - 22, cy, 34 + (h % 12), h, 0);
        paintLeafCluster(ctx, x + t.w / 2 + 26, cy + 26, 28 + ((h >>> 3) % 10), h + 5, 0);
      }
    }
}

const tileCache = new Map<string, ArtCanvas | null>();
/**
 * Draws a trunk layer across the view (0…W), scrolled by the camera `cam` (world px) at the layer's parallax: one tile,
 * repeated. Cached per layer, height and scale; painted straight onto `ctx` where no offscreen canvas exists.
 */
export function drawTrunkLayer(ctx: Ctx, layer: TrunkLayer, cam: number, W: number, H: number): void {
  const k = jungleArtScale(ctx);
  const key = `${layer.id}|${H}|${k}`;
  let tile = tileCache.get(key);
  if (tile === undefined) {
    tile = artCanvas(Math.ceil(layer.tileW * k), Math.ceil(H * k));
    const c = tile ? artContext(tile) : null;
    if (tile && c) {
      c.scale(k, k);
      paintTrunkTile(c as Ctx, layer, H);
    } else tile = null;
    if (tileCache.size > 8) tileCache.clear();
    tileCache.set(key, tile);
  }
  const off = -(((cam * layer.parallax) % layer.tileW) + layer.tileW) % layer.tileW;
  for (let x = off; x < W; x += layer.tileW) {
    if (tile) ctx.drawImage(tile as CanvasImageSource, x, 0, layer.tileW, H);
    else {
      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.max(0, x), 0, Math.min(W, x + layer.tileW) - Math.max(0, x), H);
      ctx.clip();
      ctx.translate(x, 0);
      paintTrunkTile(ctx, layer, H);
      ctx.restore();
    }
  }
}

/** A layer's trunks painted still over world x0…x1 (the screen fill beside the world: the same trunks, unscrolled). */
export function paintTrunkSpan(ctx: Ctx, layer: TrunkLayer, x0: number, x1: number, H: number): void {
  for (let base = Math.floor(x0 / layer.tileW) * layer.tileW; base < x1; base += layer.tileW) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(Math.max(x0, base), 0, Math.min(x1, base + layer.tileW) - Math.max(x0, base), H);
    ctx.clip();
    ctx.translate(base, 0);
    paintTrunkTile(ctx, layer, H);
    ctx.restore();
  }
}

/** The near layer's trunks on screen (left edge and width, world px) for the camera: the river reflects them. */
export function nearTrunksOnScreen(cam: number, W: number): { x: number; w: number }[] {
  const off = -(((cam * JUNGLE_NEAR.parallax) % JUNGLE_NEAR.tileW) + JUNGLE_NEAR.tileW) % JUNGLE_NEAR.tileW;
  const out: { x: number; w: number }[] = [];
  for (let base = off - JUNGLE_NEAR.tileW; base < W; base += JUNGLE_NEAR.tileW) for (const t of trunksOf(JUNGLE_NEAR)) if (base + t.x + t.w > 0 && base + t.x < W) out.push({ x: base + t.x, w: t.w });
  return out;
}

/* ---------------- Vine rope ---------------- */

/**
 * A vine rope along a path (`trace` builds it): a dark core, a green strand, the second strand's twist as short light
 * slants and a thin light line on the lit side. `w` scales the width.
 */
export function strokeVineRope(ctx: Ctx, trace: () => void, w = 1, gold = false): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  trace();
  ctx.strokeStyle = "#1E3A10";
  ctx.lineWidth = 5 * w;
  ctx.stroke();
  ctx.strokeStyle = gold ? "#B98E2C" : "#5FA03A";
  ctx.lineWidth = 3.4 * w;
  ctx.stroke();
  // The twist: the second strand crossing over, a short light slant every few px.
  ctx.setLineDash([2.2 * w, 2.8 * w]);
  ctx.strokeStyle = gold ? "#F7DA88" : "#BCE97C";
  ctx.lineWidth = 1.7 * w;
  ctx.stroke();
  ctx.setLineDash([]);
}

/* ---------------- Grab rings ---------------- */

const ringCache = new Map<string, { canvas: ArtCanvas; size: number } | null>();
/** Paints a grab ring of radius R centred at (x, y): enamelled cream metal (gold when `gold`), a dark centre, a bead. */
export function paintGrabRing(ctx: Ctx, x: number, y: number, R: number, gold: boolean): void {
  // A soft contact shadow below (depth, not a glow).
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x + 0.6, y + 1.6, R, 0, Math.PI * 2);
  ctx.stroke();
  // The dark centre.
  const hole = ctx.createRadialGradient(x, y - 2, 1, x, y, R);
  hole.addColorStop(0, "rgba(4,14,8,0.55)");
  hole.addColorStop(1, "rgba(4,14,8,0.82)");
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(x, y, R - 2, 0, Math.PI * 2);
  ctx.fill();
  // Rim, then the enamel lit from the top left.
  ctx.strokeStyle = gold ? "#4A3410" : "#25301A";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.stroke();
  const e = ctx.createLinearGradient(x - R, y - R, x + R, y + R);
  if (gold) {
    e.addColorStop(0, "#FFF0B0");
    e.addColorStop(0.45, "#F2C75C");
    e.addColorStop(1, "#9A6E1E");
  } else {
    e.addColorStop(0, "#FFFBEA");
    e.addColorStop(0.45, "#E4E8C8");
    e.addColorStop(1, "#8E9670");
  }
  ctx.strokeStyle = e;
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.stroke();
  // Inner edge line for the enamel's depth.
  ctx.strokeStyle = "rgba(20,26,10,0.5)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(x, y, R - 2.3, 0, Math.PI * 2);
  ctx.stroke();
  // The specular: a crisp short arc on the upper left.
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, R + 0.6, Math.PI * 1.08, Math.PI * 1.42);
  ctx.stroke();
  // The bead at the top, where the vine ties on.
  const b = ctx.createRadialGradient(x - 1.4, y - R - 1.4, 0.4, x, y - R, 4.6);
  b.addColorStop(0, "#FFF4C8");
  b.addColorStop(0.5, "#F2C75C");
  b.addColorStop(1, "#7A5414");
  ctx.fillStyle = b;
  ctx.beginPath();
  ctx.arc(x, y - R, 4.4, 0, Math.PI * 2);
  ctx.fill();
}

/** A cached grab-ring sprite (radius R, gold or cream) drawn centred at (x, y); painted direct where none. */
export function drawGrabRing(ctx: Ctx, x: number, y: number, R: number, gold: boolean): void {
  const k = jungleArtScale(ctx);
  const key = `${R}|${gold ? 1 : 0}|${k}`;
  let sprite = ringCache.get(key);
  if (sprite === undefined) {
    const size = Math.ceil(R * 2 + 16);
    const canvas = artCanvas(Math.ceil(size * k), Math.ceil(size * k));
    const c = canvas ? artContext(canvas) : null;
    if (canvas && c) {
      c.scale(k, k);
      paintGrabRing(c as Ctx, size / 2, size / 2, R, gold);
      sprite = { canvas, size };
    } else sprite = null;
    ringCache.set(key, sprite);
  }
  if (sprite) ctx.drawImage(sprite.canvas as CanvasImageSource, x - sprite.size / 2, y - sprite.size / 2, sprite.size, sprite.size);
  else paintGrabRing(ctx, x, y, R, gold);
}

/* ---------------- Wood ---------------- */

/** Planks from `left`, `width` wide, `thick` deep at `top`: grain lines, seams, a lit top edge and a shadowed underside. */
export function paintPlanks(ctx: Ctx, left: number, top: number, width: number, thick: number, seed: number): void {
  const p = ctx.createLinearGradient(0, top, 0, top + thick);
  p.addColorStop(0, "#B88A56");
  p.addColorStop(0.5, "#8E6438");
  p.addColorStop(1, "#4E3420");
  ctx.fillStyle = p;
  ctx.beginPath();
  ctx.roundRect(left, top, width, thick, 3);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Grain: thin wavering lines along the planks.
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 4; i++) {
    const h = artHash(i, seed);
    const gy = top + 1.5 + ((i + 0.5) * (thick - 3)) / 4;
    ctx.strokeStyle = i % 2 ? "rgba(60,36,16,0.55)" : "rgba(240,200,140,0.25)";
    ctx.beginPath();
    ctx.moveTo(left, gy);
    for (let x = left; x <= left + width; x += 6) ctx.lineTo(x, gy + Math.sin(x * 0.11 + (h % 9)) * 0.7);
    ctx.stroke();
  }
  // Seams every 18 px with a nail head each side.
  ctx.strokeStyle = "rgba(36,20,8,0.75)";
  ctx.lineWidth = 1;
  for (let x = left + 18; x < left + width - 2; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, top + 1);
    ctx.lineTo(x, top + thick - 1);
    ctx.stroke();
    ctx.fillStyle = "rgba(20,14,8,0.8)";
    ctx.fillRect(x - 3, top + thick / 2 - 0.6, 1.2, 1.2);
    ctx.fillRect(x + 2, top + thick / 2 - 0.6, 1.2, 1.2);
  }
  ctx.restore();
  // A crisp lit edge along the top.
  ctx.strokeStyle = "rgba(255,226,170,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left + 2, top + 0.6);
  ctx.lineTo(left + width - 2, top + 0.6);
  ctx.stroke();
}
