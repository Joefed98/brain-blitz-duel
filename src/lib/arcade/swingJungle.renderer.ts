/**
 * Grappler's prehistoric jungle canopy (3 Nov 2026, Joe's audit; display only, swingRev 17, the revision rooms deal).
 * The same course, rules and timings as the cave it replaces, every shape on the sim's own geometry:
 *  - the canopy is the solid mass above the sim's ceiling line (leaves and branches, its underside on the line);
 *  - the river is the sim's floor line (a miss drops you in): its surface rides the line within 1.5 px;
 *  - grab points (the sim's anchors) are knotted vine loops at the anchor, hanging from the canopy, with a soft glow;
 *    a sliding hook is a swinging vine: its vine hangs from above the middle of its travel and its loop is drawn where
 *    the sim has the hook this tick, its path a faint dotted arc;
 *  - ledges are tree platforms (planks whose top is the landing line, a trunk down into the river);
 *  - a squeeze's roof is a hanging trunk and root mass and its floor a mossy boulder stack, exactly over the sim's two
 *    rectangles;
 *  - speed gates are two bamboo posts above and below the sim's opening;
 *  - the chasing dragon is a pterodactyl (its jaws on the catch line);
 *  - the dark ledge sections are deep canopy shade (swing.renderer.ts's drawDark, in green-black).
 * Behind it all: a layered backdrop (a green haze, distant tree crowns at slow parallax, mid trunks, light shafts),
 * none of which collides. Render only: never writes the state.
 */
import type { SwingGate, SwingLedge, SwingSlider, SwingState } from "./swing";
import { swingAnchorAt, swingHookLit, SWING_GATE_HALF_W, SWING_LEDGE_THICK } from "./swing";
import { artHash } from "./art.renderer";
import { artCanvas, artContext, deviceLayer, type ArtCanvas } from "./cache.renderer";
import { JUNGLE_MID, JUNGLE_NEAR, paintTrunkSpan, drawGrabRing, drawLeafClusterSprite, drawTrunkLayer, nearTrunksOnScreen, paintPlanks, paintTrunk, strokeVineRope } from "./swingJungleArt.renderer";

const FP = 256;
const COL = 40 * FP;

export const JUNGLE = {
  gold: "#F2C75C",
  leafDark: "#0B2416",
  leaf: "#1C4A2A",
  leafLight: "#3F8A3E",
  leafLit: "#8FD15A",
  bark: "#4A3322",
  barkDark: "#2A1C12",
  barkLight: "#7A5638",
  vine: "#5E8F33",
  vineDark: "#2F5419",
  vineLight: "#A7DB6A",
  moss: "#4D7A2E",
  rock: "#5B5E52",
  rockDark: "#2E302A",
  water: "#2F9FB0",
  waterDeep: "#0B3A4A",
  foam: "#D8F6F2",
  /** The deep-shade veil (drawDark / the ledge-run dim in the jungle). */
  shade: "2,10,6",
} as const;

/** Mixes two #rrggbb colours (t 0–1). */
export function jungleMix(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) + ((((pb >> sh) & 255) - ((pa >> sh) & 255)) * k));
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

/**
 * How deep into the jungle the camera is (0 at the start, 1 by the finish platform; the Action overhaul, 15 Nov 2026):
 * the setting darkens with it. From the sim's camera and the course's last ledge, so the same for every player and
 * replay; display only.
 */
export function swingJungleDepth(state: Pick<SwingState, "camX" | "ledges">, viewW: number): number {
  const ledges = state.ledges ?? [];
  if (ledges.length < 2) return 0;
  // From the start platform to the finish platform, each centred in the view.
  const start = ledges[0]!.x - viewW * FP * 0.5;
  const end = ledges[ledges.length - 1]!.x - viewW * FP * 0.5;
  if (end <= start) return 0;
  const t = Math.max(0, Math.min(1, (state.camX - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function lerpAt(arr: readonly number[], x: number): number {
  const i = Math.max(0, Math.min(arr.length - 2, Math.trunc(x / COL)));
  const f = x - i * COL;
  return arr[i]! + Math.trunc(((arr[i + 1]! - arr[i]!) * f) / COL);
}

/**
 * The far backdrop: the green haze, light shafts and two layers of distant tree crowns, painted once per canvas size and
 * held still behind the scrolling course (deviceLayer; no collision). Reduced effects: one crown layer, no shafts.
 */
function paintJungleFar(ctx: CanvasRenderingContext2D, W: number, H: number, lite: boolean): void {
  paintJungleFarSpan(ctx, 0, W, H, lite);
}

/**
 * The far backdrop over world x from `x0` to `x1` (edge to edge, 15 Nov 2026): the world's own still layer is the span
 * 0…W; the screen fill beside the world paints the spans outside it with the same seeded crowns and shafts, so the far
 * jungle runs on past the world's edges without a seam.
 */
function paintJungleFarSpan(ctx: CanvasRenderingContext2D, x0: number, x1: number, H: number, lite: boolean): void {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0E2A1C");
  sky.addColorStop(0.45, "#1B4A35");
  sky.addColorStop(0.8, "#24604A");
  sky.addColorStop(1, "#173E36");
  ctx.fillStyle = sky;
  ctx.fillRect(x0, 0, x1 - x0, H);
  if (!lite) {
    // Light shafts from the canopy's gaps, slanting down to the right.
    for (let k = Math.min(-1, Math.floor((x0 - 360) / 150)); k < Math.max(4, Math.ceil(x1 / 150) + 1); k++) {
      const h = artHash(k, 313);
      const base = k * 150 + (h % 40);
      const w = 30 + (h % 40);
      const a = 0.035 + ((h >>> 5) % 5) * 0.007; // calmer (the overhaul): softer shafts
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(220,255,170,${a})`);
      g.addColorStop(1, "rgba(220,255,170,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(base, 0);
      ctx.lineTo(base + w, 0);
      ctx.lineTo(base + w + 160, H);
      ctx.lineTo(base + 120, H);
      ctx.closePath();
      ctx.fill();
    }
  }
  // The materials pass: the third, farthest row of trunks, pale in the haze (concept A's three-deep forest).
  for (let k = Math.floor(x0 / 70) - 1; k <= x1 / 70 + 1; k++) {
    const h = artHash(k, 557);
    const tx = k * 70 + (h % 30);
    const tw = 8 + ((h >>> 5) % 8);
    const tg = ctx.createLinearGradient(tx, 0, tx + tw, 0);
    tg.addColorStop(0, "rgba(44,92,72,0.75)");
    tg.addColorStop(0.3, "rgba(66,120,96,0.75)");
    tg.addColorStop(1, "rgba(34,76,60,0.75)");
    ctx.fillStyle = tg;
    ctx.fillRect(tx, 0, tw, H);
  }
  // Distant tree crowns: rounded canopies on thin trunks.
  const layers = lite ? ([[H * 0.52, "#1C4A3A", 70]] as const) : ([[H * 0.46, "#1C4A3A", 80], [H * 0.58, "#173A2D", 62]] as const);
  for (const [base, colour, step] of layers) {
    ctx.fillStyle = colour;
    for (let k = Math.min(-1, Math.floor(x0 / step) - 1); k <= x1 / step + 1; k++) {
      const h = artHash(k, step);
      const x = k * step + (h % 20);
      const top = base + ((h >>> 4) % 60) - 30;
      ctx.fillRect(x - 3, top, 6, H - top);
      const r = 26 + ((h >>> 9) % 18);
      ctx.beginPath();
      ctx.arc(x, top, r, 0, Math.PI * 2);
      ctx.arc(x - r * 0.7, top + r * 0.35, r * 0.7, 0, Math.PI * 2);
      ctx.arc(x + r * 0.75, top + r * 0.3, r * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // A low mist over the far crowns (the overhaul: aerial depth, so the course in front reads first).
  const mist = ctx.createLinearGradient(0, H * 0.35, 0, H);
  mist.addColorStop(0, "rgba(40,96,76,0)");
  mist.addColorStop(0.55, "rgba(40,96,76,0.22)");
  mist.addColorStop(1, "rgba(30,78,66,0.3)");
  ctx.fillStyle = mist;
  ctx.fillRect(x0, H * 0.35, x1 - x0, H * 0.65);
}

/** The steps the deepening setting moves in (so the world's veil and the screen fill beside it always match). */
export const SWING_DEPTH_STEPS = 20;
/** The depth step (0…SWING_DEPTH_STEPS) of a state: the world's veil and the fill's (sceneKey) both use it. */
export function swingJungleDepthStep(state: Pick<SwingState, "camX" | "ledges">, viewW: number): number {
  return Math.round(swingJungleDepth(state, viewW) * SWING_DEPTH_STEPS);
}

/** The deepening veil over the backdrop (world and fill alike): darker and colder towards the end of the course. */
function jungleVeil(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, H: number, depth: number): void {
  if (depth <= 0) return;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(2,10,12,${0.7 * depth})`);
  g.addColorStop(1, `rgba(4,16,20,${0.5 * depth})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** The screen fill's canopy band and river surface beside the world sit at the courses' typical lines (world px). */
export const JUNGLE_SIDE_CEIL = 62;
export const JUNGLE_SIDE_FLOOR = 801;

/**
 * Edge to edge (Joe's standing rule, 15 Nov 2026; display only): the jungle carried on beside the world in the strip
 * `r` (world units, the world `H` tall): the far backdrop continued exactly (paintJungleFarSpan), the deepening veil at
 * the same `depth`, a leafy canopy band over the top to about the courses' typical ceiling, and the river from about
 * their typical floor to the bottom, in the same colours the world draws at that depth. Painted once per size and depth
 * step (ArcadeArenaSlot's sceneKey), never per frame; nothing collides.
 */
export function paintJungleSides(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, H: number, depth: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  paintJungleFarSpan(ctx, r.x, r.x + r.w, H, false);
  // The materials pass: the mid and near trunks beside the world too (still: the fill is painted once per step).
  paintTrunkSpan(ctx, JUNGLE_MID, r.x, r.x + r.w, H);
  paintTrunkSpan(ctx, JUNGLE_NEAR, r.x, r.x + r.w, H);
  jungleVeil(ctx, r.x, r.y, r.w, r.h, H, depth);
  // The canopy band: the same gradient and leaves as the world's canopy mass, its underside a soft wave.
  const leafLit = jungleMix(JUNGLE.leafLight, "#245E3A", depth * 0.8);
  const leafMid = jungleMix(JUNGLE.leaf, "#10301F", depth * 0.8);
  const under = (x: number) => JUNGLE_SIDE_CEIL + Math.sin(x * 0.045) * 8 + Math.sin(x * 0.11) * 4;
  ctx.beginPath();
  ctx.moveTo(r.x - 4, -4);
  for (let x = r.x - 4; x <= r.x + r.w + 4; x += 4) ctx.lineTo(x, under(x));
  ctx.lineTo(r.x + r.w + 4, -4);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, 260);
  g.addColorStop(0, "#06160D");
  g.addColorStop(1, leafMid);
  ctx.fillStyle = g;
  ctx.fill();
  for (let k = Math.floor(r.x / 26) - 1; k < (r.x + r.w) / 26 + 2; k++) {
    const cy = under(k * 26);
    for (let row = 0; row < 2; row++) {
      const hh = artHash(k, 41 + row);
      const rad = 12 + (hh % 8) - row * 2;
      ctx.fillStyle = row === 0 ? leafLit : leafMid;
      ctx.beginPath();
      ctx.ellipse(k * 26 + ((hh >>> 8) % 10) - 5, cy - 6 - row * 22 - ((hh >>> 4) % 8), rad, rad * 0.7, ((hh >>> 3) % 7) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The river: the world's colours at this depth, from about the courses' floor to the bottom.
  const water = jungleMix(JUNGLE.water, "#1E6C7A", depth * 0.7);
  const mid = jungleMix("#1C6F80", "#11485A", depth * 0.7);
  const deep = jungleMix(JUNGLE.waterDeep, "#06202C", depth * 0.7);
  const surf = (x: number) => JUNGLE_SIDE_FLOOR + Math.sin(x * 0.05) * 1.0 + Math.sin(x * 0.13) * 0.3;
  ctx.beginPath();
  ctx.moveTo(r.x - 4, H + 4);
  for (let x = r.x - 4; x <= r.x + r.w + 4; x += 4) ctx.lineTo(x, surf(x));
  ctx.lineTo(r.x + r.w + 4, H + 4);
  ctx.closePath();
  const wg = ctx.createLinearGradient(0, JUNGLE_SIDE_FLOOR, 0, H);
  wg.addColorStop(0, water);
  wg.addColorStop(0.3, mid);
  wg.addColorStop(1, deep);
  ctx.fillStyle = wg;
  ctx.fill();
  ctx.strokeStyle = JUNGLE.foam;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let x = r.x - 4; x <= r.x + r.w + 4; x += 4) {
    if (x === r.x - 4) ctx.moveTo(x, surf(x));
    else ctx.lineTo(x, surf(x));
  }
  ctx.stroke();
  ctx.restore();
}

/** The deep river carried on under the world (the screen fill below it) at the world's depth. */
export function jungleDeepWater(depth: number): string {
  return jungleMix(JUNGLE.waterDeep, "#06202C", depth * 0.7);
}

/**
 * The backdrop: the far layer (cached, still), then the materials pass's two trunk layers (swingJungleArt.renderer.ts:
 * mid trunks fading into the haze at 0.3 of the camera, near trunks with bark and lit leaf clusters at 0.55), moss
 * curtains deeper in, then the deepening veil (the Action overhaul, 15 Nov 2026): `depth` 0–1 (swingJungleDepth)
 * darkens and cools the backdrop only, behind every vine, platform and the hero, so the deep jungle never costs
 * readability. Reduced effects: the mid layer only.
 */
export function drawJungleBackdrop(ctx: CanvasRenderingContext2D, cam: number, W: number, H: number, t: number, lite: boolean, depth = 0): void {
  deviceLayer(ctx, `swing-jungle-far:${W}x${H}:${lite ? 1 : 0}`, (c) => paintJungleFar(c, W, H, lite));
  void t;
  drawTrunkLayer(ctx, JUNGLE_MID, cam, W, H);
  if (!lite) {
    // Deeper in: hanging moss curtains between the layers (from a third of the way).
    if (depth > 0.3) {
      const step = 170;
      const off = (cam * 0.42) % step;
      const k0 = Math.floor((cam * 0.42) / step);
      ctx.globalAlpha = Math.min(1, (depth - 0.3) * 2) * 0.85;
      ctx.fillStyle = "#0E241A";
      for (let k = -1; k <= W / step + 1; k++) {
        const h = artHash(k0 + k, 977);
        if (h % 2) continue;
        const mx = k * step - off + 60 + (h % 40);
        const len = H * (0.25 + ((h >>> 3) % 20) / 100);
        ctx.beginPath();
        ctx.moveTo(mx - 9, 0);
        ctx.quadraticCurveTo(mx - 6, len * 0.6, mx, len);
        ctx.quadraticCurveTo(mx + 6, len * 0.6, mx + 9, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    drawTrunkLayer(ctx, JUNGLE_NEAR, cam, W, H);
  }
  // The deep jungle: the backdrop darkens and cools towards blue-green night under the canopy (the fill beside the
  // world draws the same veil at the same depth step).
  jungleVeil(ctx, 0, 0, W, H, H, depth);
}

/** A soft round glow (warm centre to clear), cached once per colour at 64 px and drawn at any radius. */
const glowCache = new Map<string, ArtCanvas | null>();
export function drawJungleGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, outer: string): void {
  const key = `${inner}|${outer}`;
  let sprite = glowCache.get(key);
  if (sprite === undefined) {
    sprite = artCanvas(64, 64);
    const c = sprite ? artContext(sprite) : null;
    if (c) {
      const g = c.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, inner);
      g.addColorStop(0.5, outer);
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    } else sprite = null;
    glowCache.set(key, sprite);
  }
  if (sprite) {
    ctx.drawImage(sprite as CanvasImageSource, x - r, y - r, r * 2, r * 2);
    return;
  }
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(0.5, outer);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** The canopy: the mass above the sim's ceiling line, its underside exactly on the line, fringed with leaves inside it. */
export function drawJungleCanopy(ctx: CanvasRenderingContext2D, state: SwingState, first: number, last: number, sx: (x: number) => number, W: number, t: number, lite: boolean, depth = 0): void {
  // Deeper in (the overhaul), the canopy's leaves darken a little; its underside stays on the sim's line.
  const leafLit = jungleMix(JUNGLE.leafLight, "#245E3A", depth * 0.8);
  const leafMid = jungleMix(JUNGLE.leaf, "#10301F", depth * 0.8);
  const ceil = state.ceil;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx(first * COL), -4);
  for (let i = first; i <= last; i++) ctx.lineTo(sx(i * COL), ceil[i]! / FP);
  ctx.lineTo(sx(last * COL), -4);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, 260);
  g.addColorStop(0, "#06160D");
  g.addColorStop(1, leafMid);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // Leaf clumps inside the mass, brightest along the underside; branches through them.
  const c0 = Math.floor((state.camX / FP) / 26) - 1;
  for (let k = c0; k < c0 + W / 26 + 3; k++) {
    const wx = k * 26;
    const px = wx - state.camX / FP;
    const cy = lerpAt(ceil, wx * FP) / FP;
    // The materials pass: clusters of real leaves (two deep where effects allow) along the underside, inside the mass,
    // dimming deeper in; the mass's own colours below them.
    const h = artHash(k, 41);
    if (lite) {
      ctx.fillStyle = leafLit;
      ctx.beginPath();
      ctx.ellipse(px + ((h >>> 8) % 10) - 5, cy - 8, 13, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (k % 2 === 0) drawLeafClusterSprite(ctx, px + ((h >>> 8) % 10) - 5, cy - 32 - ((h >>> 4) % 8), 20, (h >>> 12) % 6, depth);
    drawLeafClusterSprite(ctx, px + ((h >>> 9) % 8) - 4, cy - 9 - ((h >>> 5) % 5), 15 + (h % 4), (h >>> 15) % 6, depth);
  }
  ctx.strokeStyle = JUNGLE.barkDark;
  ctx.lineWidth = 5;
  for (let k = Math.floor(state.camX / FP / 140) - 1; k < Math.floor(state.camX / FP / 140) + W / 140 + 2; k++) {
    const h = artHash(k, 71);
    const x0 = k * 140 - state.camX / FP;
    const y0 = lerpAt(ceil, Math.max(0, k * 140 * FP)) / FP - 30 - (h % 20);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + 60, y0 + 8 - (h >>> 4) % 16, x0 + 140, y0 - 6);
    ctx.stroke();
  }
  ctx.restore();
  // Leaf tips hanging just under the line? No: the underside stays exactly on the sim's line (a soft lit rim only).
  ctx.strokeStyle = "rgba(160,225,100,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = first; i <= last; i++) {
    const x = sx(i * COL);
    const y = ceil[i]! / FP;
    if (i === first) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  void t;
}

/** The river surface's offset (px) from the sim's floor line at world x `wx` and time `t` s: three waves, |·| ≤ 1.45. */
export function jungleRiverWave(wx: number, t: number, still: boolean): number {
  return still ? 0 : Math.sin(wx * 0.05 + t * 1.4) * 1.0 + Math.sin(wx * 0.13 - t) * 0.3 + Math.sin(wx * 0.31 + t * 2.3) * 0.15;
}

/**
 * The river: its surface on the sim's floor line (waves within 1.5 px), deep teal below. The Action overhaul (15 Nov
 * 2026) gives it movement and shine: three waves rolling at different speeds, a lit band under the surface (the canopy
 * reflected), slow ripple lines drifting with the current, and small glints that travel along the surface and
 * twinkle. `depth` (swingJungleDepth) takes it towards a darker, colder river; still with reduced motion.
 */
export function drawJungleRiver(ctx: CanvasRenderingContext2D, state: SwingState, cam: number, W: number, H: number, t: number, still: boolean, lite: boolean, depth = 0): void {
  // Three waves: 1.0 + 0.3 + 0.15 = at most 1.45 px off the sim's line (jungleRiverWave).
  const wave = (wx: number) => jungleRiverWave(wx, t, still);
  const surface: Array<[number, number]> = [];
  for (let px = -4; px <= W + 4; px += 4) surface.push([px, lerpAt(state.floor, Math.round((px + cam) * FP)) / FP + wave(px + cam)]);
  const top = Math.min(...surface.map((p) => p[1]));
  const water = jungleMix(JUNGLE.water, "#1E6C7A", depth * 0.7);
  const mid = jungleMix("#1C6F80", "#11485A", depth * 0.7);
  const deep = jungleMix(JUNGLE.waterDeep, "#06202C", depth * 0.7);
  ctx.beginPath();
  ctx.moveTo(-4, H);
  for (const [px, py] of surface) ctx.lineTo(px, py);
  ctx.lineTo(W + 4, H);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, water);
  g.addColorStop(0.3, mid);
  g.addColorStop(1, deep);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // The lit band under the surface: the canopy's green light on the water.
  const band = ctx.createLinearGradient(0, top, 0, top + 16);
  band.addColorStop(0, "rgba(170,236,214,0.32)");
  band.addColorStop(1, "rgba(170,236,214,0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, top - 2, W, 18);
  // The materials pass: the gloss. The near trunks reflected (dark wavering columns under each one), then a broad
  // sheen across the water where the light falls, so the river reads as glossy liquid rather than a flat band.
  if (!lite) {
    ctx.fillStyle = "rgba(2,16,18,0.42)";
    for (const tr of nearTrunksOnScreen(cam, W))
      for (let y = top + 2; y < H; y += 3) {
        const wob = still ? 0 : Math.sin(y * 0.35 + t * 2.4) * (1 + (y - top) * 0.04);
        ctx.fillRect(tr.x + wob + tr.w * 0.1, y, tr.w * 0.8, 2);
      }
    const sheen = ctx.createLinearGradient(0, 0, W, 0);
    sheen.addColorStop(0, "rgba(200,255,245,0)");
    sheen.addColorStop(0.35, "rgba(200,255,245,0.16)");
    sheen.addColorStop(0.55, "rgba(200,255,245,0.04)");
    sheen.addColorStop(1, "rgba(200,255,245,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, top, W, H - top);
  }
  const flow = (speed: number, period: number) => (still ? 0 : (t * speed) % period);
  // Ripple lines drifting left with the current (the river runs against the swing), two depths.
  if (!lite)
    for (const [period, speed, dy, alpha] of [[60, 18, 14, 0.2], [90, 11, 30, 0.13]] as const) {
      ctx.strokeStyle = `rgba(210,250,244,${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let k = Math.floor(cam / period) - 1; k < Math.floor(cam / period) + W / period + 2; k++) {
        const h = artHash(k, 233 + period);
        const px = k * period - cam - flow(speed, period) + (h % 24);
        const py = lerpAt(state.floor, Math.round(k * period * FP)) / FP + dy + ((h >>> 5) % 12);
        const len = 22 + ((h >>> 3) % 18);
        const sway = still ? 0 : Math.sin(t * 1.7 + k) * 1.5;
        ctx.moveTo(px, py);
        ctx.bezierCurveTo(px + len * 0.33, py - 2 + sway, px + len * 0.66, py + 2 - sway, px + len, py);
      }
      ctx.stroke();
    }
  // Current streaks.
  ctx.strokeStyle = "rgba(200,245,240,0.2)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = Math.floor(cam / 50) - 1; k < Math.floor(cam / 50) + W / 50 + 2; k++) {
    const h = artHash(k, 211);
    const px = k * 50 - cam - flow(30, 50) + (h % 30);
    const py = lerpAt(state.floor, Math.round((k * 50) * FP)) / FP + 10 + (h >>> 5) % 40;
    ctx.moveTo(px, py);
    ctx.lineTo(px + 12 + (h >>> 3) % 14, py);
  }
  ctx.stroke();
  // Reeds and lily pads at the surface (inside the water's own shape).
  if (!lite) for (let k = Math.floor(cam / 80) - 1; k < Math.floor(cam / 80) + W / 80 + 2; k++) {
    const h = artHash(k, 505);
    if (h % 3) continue;
    const wx = k * 80 + (h % 50);
    const px = wx - cam;
    const py = lerpAt(state.floor, Math.round(wx * FP)) / FP + wave(wx) + 3;
    ctx.fillStyle = jungleMix("#2F7A3A", "#1D5230", depth * 0.6);
    ctx.beginPath();
    ctx.ellipse(px, py, 9, 2.6, 0, 0.3, Math.PI * 2 - 0.3);
    ctx.lineTo(px, py);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = JUNGLE.foam;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  surface.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.stroke();
  if (!lite) {
    ctx.strokeStyle = "rgba(216,246,242,0.22)";
    ctx.lineWidth = 4;
    ctx.stroke();
    // Shine: small glints riding the surface downstream, each twinkling on its own beat (no glare: short and thin).
    ctx.lineCap = "round";
    for (let k = Math.floor(cam / 46) - 1; k < Math.floor(cam / 46) + W / 46 + 2; k++) {
      const h = artHash(k, 919);
      const wx = k * 46 + (h % 30) - flow(14, 46);
      const px = wx - cam;
      const a = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * (2 + (h % 3)) + (h % 17));
      if (a < 0.15) continue;
      const py = lerpAt(state.floor, Math.round(wx * FP)) / FP + wave(wx) + 4;
      const len = 6 + ((h >>> 4) % 10);
      ctx.strokeStyle = `rgba(255,255,250,${(0.75 * a * (1 - depth * 0.35)).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px - len / 2, py);
      ctx.lineTo(px + len / 2, py);
      ctx.stroke();
    }
  }
}

/** A squeeze: the roof a hanging trunk with roots, the floor a mossy boulder stack, each exactly its sim rectangle. */
export function drawJungleSqueeze(ctx: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, roof: boolean, seed: number): void {
  const w = x1 - x0;
  if (roof) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, JUNGLE.barkLight);
    g.addColorStop(0.45, JUNGLE.bark);
    g.addColorStop(1, JUNGLE.barkDark);
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, y1 - y0);
    ctx.strokeStyle = "rgba(20,12,6,0.6)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let n = 1; n < 5; n++) {
      const x = x0 + (w * n) / 5 + ((artHash(seed, n) % 7) - 3);
      ctx.moveTo(x, y0);
      ctx.lineTo(x + ((artHash(seed, n + 9) % 5) - 2), y1 - 3);
    }
    ctx.stroke();
    // Its bottom edge: a lit rim exactly on the opening.
    ctx.fillStyle = "rgba(200,240,140,0.8)";
    ctx.fillRect(x0, y1 - 2, w, 2);
  } else {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, JUNGLE.rock);
    g.addColorStop(1, JUNGLE.rockDark);
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, y1 - y0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, y1 - y0);
    ctx.clip();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    for (let n = 0; n < 6; n++) {
      const h = artHash(seed, 30 + n);
      ctx.beginPath();
      ctx.ellipse(x0 + (h % 100) / 100 * w, y0 + 14 + n * 22, 12 + (h >>> 7) % 10, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = JUNGLE.moss;
    ctx.fillRect(x0, y0, w, 5);
    ctx.restore();
    ctx.fillStyle = "rgba(200,240,140,0.8)";
    ctx.fillRect(x0, y0, w, 2);
  }
}

/** A tree platform: planks with their top on the sim's landing line, a trunk under it down to the river. */
export function drawJunglePlatform(ctx: CanvasRenderingContext2D, l: SwingLedge, x: number, floorY: number, kind: number, reached: boolean, tick: number, still: boolean): void {
  const half = l.half / FP;
  const top = l.top / FP;
  const thick = SWING_LEDGE_THICK / FP;
  const left = x - half;
  // The trunk, behind the planks, down into the water (the materials pass: real bark).
  const tw = Math.min(18, half * 0.5);
  paintTrunk(ctx, x - tw / 2, top + thick - 1, top + thick - 1 + Math.max(0, floorY - top - thick + 4), tw, l.x, "#5A3E28", "#8A6440", "#2A1C12", 0.8);
  // Planks with grain, seams and a lit top edge.
  paintPlanks(ctx, left, top, half * 2, thick, l.x);

  // Moss along the top; gold once landed on.
  ctx.fillStyle = reached ? JUNGLE.gold : JUNGLE.leafLit;
  ctx.fillRect(left, top, half * 2, reached ? 2.5 : 2);
  if (kind === 0) {
    ctx.fillStyle = JUNGLE.gold;
    ctx.beginPath();
    ctx.moveTo(x - 5, top + 2);
    ctx.lineTo(x + 4, top + thick / 2 + 0.5);
    ctx.lineTo(x - 5, top + thick - 1);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 2) {
    const pole = left + half * 2 - 6;
    ctx.strokeStyle = JUNGLE.barkLight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pole, top);
    ctx.lineTo(pole, top - 28);
    ctx.stroke();
    const wave = still ? 0 : Math.sin(tick * 0.15) * 2;
    ctx.fillStyle = JUNGLE.gold;
    ctx.beginPath();
    ctx.moveTo(pole, top - 28);
    ctx.quadraticCurveTo(pole - 8, top - 25 + wave, pole - 16, top - 23 + wave);
    ctx.lineTo(pole, top - 17);
    ctx.closePath();
    ctx.fill();
  }
}

/** A speed gate: bamboo posts over and under the sim's opening, a glowing band between (gold once lit). */
export function drawJungleGate(ctx: CanvasRenderingContext2D, g: SwingGate, x: number, lit: boolean, i: number, tick: number, still: boolean, lite: boolean): void {
  const y0 = g.y0 / FP;
  const y1 = g.y1 / FP;
  const half = SWING_GATE_HALF_W / FP;
  if (!lite) {
    const band = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
    band.addColorStop(0, "rgba(200,255,120,0)");
    band.addColorStop(0.5, lit ? "rgba(255,214,90,0.45)" : `rgba(190,255,140,${0.14 + (still ? 0 : 0.05 * Math.sin(tick * 0.12 + i))})`);
    band.addColorStop(1, "rgba(200,255,120,0)");
    ctx.fillStyle = band;
    ctx.fillRect(x - 16, y0, 32, y1 - y0);
  }
  ctx.strokeStyle = lit ? "#FFE08A" : "rgba(200,255,160,0.6)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [top, bottom, cap] of [[y0 - 38, y0, y0], [y1, y1 + 38, y1]] as const) {
    const s = ctx.createLinearGradient(x - half, 0, x + half, 0);
    s.addColorStop(0, "#B9C46A");
    s.addColorStop(0.5, "#7E8E3A");
    s.addColorStop(1, "#4E5A22");
    ctx.fillStyle = s;
    ctx.fillRect(x - half, top, half * 2, bottom - top);
    ctx.fillStyle = "#3C4718";
    for (let y = top + 9; y < bottom - 2; y += 12) ctx.fillRect(x - half, y, half * 2, 2);
    ctx.fillStyle = lit ? JUNGLE.gold : "#D9C77A";
    ctx.fillRect(x - half - 1, cap - 1.5, half * 2 + 2, 3);
  }
}

/** Each swinging vine's path: a faint dotted arc from one end of its travel to the other (not drawn in the shade). */
export function drawJungleVinePaths(ctx: CanvasRenderingContext2D, state: SwingState, sx: (x: number) => number, W: number): void {
  (state.sliders ?? []).forEach((sl: SwingSlider, n) => {
    if (state.dark && !swingHookLit(state, sl.i)) return;
    const x0 = sx(sl.x - sl.amp);
    const x1 = sx(sl.x + sl.amp);
    if (x1 < -20 || x0 > W + 20) return;
    const y = state.anchors[sl.i]!.y / FP;
    const stopped = ((state.slideLock ?? 0) & (1 << n)) !== 0;
    ctx.save();
    ctx.globalAlpha = stopped ? 0.35 : 0.8;
    ctx.strokeStyle = "rgba(190,240,140,0.55)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    // A shallow arc through both ends of the travel, its lowest point at the middle (the vine's swing).
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo((x0 + x1) / 2, y + 8, x1, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  });
}

/** The grab loop's radius (px; the Action overhaul, 15 Nov 2026: 12, was 10). Display only: a grab is by reach. */
export const JUNGLE_LOOP_R = 12;

/**
 * The grab points: a vine from the canopy down to each anchor (a swinging vine's from above its travel's middle) and
 * a knotted loop at the anchor; the hook grabbed gets a gold flash. The loop is drawn where the sim has the hook this
 * tick (swingAnchorAt), and nothing is drawn for a hook in the shade (swingHookLit). The Action overhaul made the hooks
 * more obvious with less glow: a bigger loop with a dark centre, a thick dark rim and a bright cream ring, so it reads
 * against leaves, trunks and water alike.
 */
export function drawJungleGrabPoints(ctx: CanvasRenderingContext2D, state: SwingState, sx: (x: number) => number, W: number, t: number, still: boolean, lite: boolean): void {
  const slider = new Map((state.sliders ?? []).map((sl) => [sl.i, sl] as const));
  const R = JUNGLE_LOOP_R;
  state.anchors.forEach((home, i) => {
    const a = state.slide ? swingAnchorAt(state, i, state.tick) : home;
    const x = sx(a.x);
    if (x < -30 || x > W + 30 || (state.dark && !swingHookLit(state, i))) return;
    const y = a.y / FP;
    const sl = slider.get(i);
    const topX = sl ? sx(sl.x) : x + (still ? 0 : Math.sin(t * 0.8 + i) * 1.5);
    const topY = lerpAt(state.ceil, sl ? sl.x : a.x) / FP;
    const held = i === state.rope;
    // The vine (behind the loop): a soft curve with leaves along it.
    // The materials pass: a twisted rope with its lit strand (swingJungleArt's strokeVineRope).
    strokeVineRope(ctx, () => {
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo((topX + x) / 2 + 4, (topY + y) / 2, x, y - R - 1);
    }, 1);
    const len = Math.hypot(x - topX, y - topY);
    for (let k = 1; k < Math.min(6, len / 22); k++) {
      const f = k / Math.min(6, len / 22);
      const lx = topX + (x - topX) * f;
      const ly = topY + (y - R - 1 - topY) * f;
      drawLeafClusterSprite(ctx, lx + (k % 2 ? 5 : -5), ly, 6, (i + k) % 6, 0);
    }
    // The materials pass: the ring itself, enamelled cream metal (gold just after a grab), no glow round it.
    const flash = held && state.tick - state.grabTick < 12;
    void still;
    drawGrabRing(ctx, x, y, R, flash);
  });
}

/**
 * The vine the hero holds: taut from the anchor to the hands, a twisted rope (swingJungleArt's strokeVineRope). `w`
 * scales its width (the game draws it 1.35× since the Action overhaul, 15 Nov 2026; the tile keeps 1).
 */
export function drawJungleRope(ctx: CanvasRenderingContext2D, ax: number, ay: number, hx: number, hy: number, w = 1): void {
  strokeVineRope(
    ctx,
    () => {
      ctx.moveTo(ax, ay);
      ctx.lineTo(hx, hy);
    },
    w,
  );
}

/** The pterodactyl (the chase): wings beating, long crest and beak; its beak tip at (x + 34, y), the catch line. */
export function drawPterodactyl(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number): void {
  const beat = Math.sin((phase * Math.PI) / 4);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = "round";
  // Wings: leathery membranes on a long finger bone.
  for (const side of [-1, 1] as const) {
    ctx.fillStyle = side < 0 ? "#6A2E3A" : "#8C3E48";
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-18, side * (14 + beat * 10) - 6);
    ctx.quadraticCurveTo(-4, side * (10 + beat * 6), 10, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2A0E14";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // Body and tail.
  ctx.fillStyle = "#A24C4E";
  ctx.beginPath();
  ctx.ellipse(0, 1, 13, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2A0E14";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Head: crest back, long beak forward to the catch line.
  ctx.fillStyle = "#B85A54";
  ctx.beginPath();
  ctx.moveTo(10, -3);
  ctx.lineTo(-2, -11);
  ctx.lineTo(14, -6);
  ctx.lineTo(34, 0);
  ctx.lineTo(14, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#FFD93A";
  ctx.beginPath();
  ctx.arc(14, -3, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
