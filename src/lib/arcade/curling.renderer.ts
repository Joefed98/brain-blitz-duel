/**
 * Curling's art (display only; never imported by the sim or the server): the broadcast view from behind the thrower,
 * looking down the whole sheet in perspective to the far house, the near house cut by the bottom of the screen; a
 * top-down inset of the far house (top right) shows exactly where every stone sits.
 *
 * The arena (roof lights, the lit gallery, the boards' LED strips, the neighbouring sheets, the pebbled ice and the
 * lights' reflections on it) is painted once per canvas size into a cached layer; each frame draws only the stones,
 * the broom, the HUD chips and the inset over it. No curl line is ever drawn: reading the ice is the game.
 *
 * curlRev 2 (31 Oct 2026) draws a shorter world (390 × 540, CURL_VIEW_V2: the same camera with the arena's top and the
 * near house's ice cropped, so the world fills the width of a 375 × 667 phone), the stone at its start on the near hog
 * line with arrows to slide it, a straight aiming line from the stone to the broom (where it is released towards, not
 * the curl), the brushers on the side being brushed and a larger stone chip. Every view is chosen by the state's rev.
 *
 * curlRev 3 (1 Nov 2026, "prepare the shot") draws curlRev 2's view with two aids the stage works out (CurlAim `zone`
 * and `path`, from the sim's pure helpers curlDrawZone and curlAimPath): a faint aim line along the first third of
 * the stone's path for the chosen start, target and turn, in place of the straight dashed line, and the weight meter
 * on the right (weightMeter): the draw zone marked (the weights that bring an unswept stone to rest in the house), its
 * tee mark, the swipe filling it live and a tick where the last throw was released.
 */
import type { CanvasSize } from "./engine";
import { NO_LOOK, type GameLook } from "./skins/look";
import { curlStoneSkin, DEFAULT_RINK, neonRinkArena, neonRinkCacheTag, neonRinkIce, neonRinkPalette, neonStroke, paintSkinStone } from "./skins/curling.skins";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { artHash } from "./art.renderer";
import { sportsSprite, sportsSpritesVersion } from "./sportsSprites";
import {
  BACK_FAR,
  BACK_NEAR,
  BUTTON_R,
  CU,
  CURL_AIM,
  CURL_DONE,
  CURL_TRAVEL,
  CURLING_H,
  CURLING_H_V2,
  CURLING_H_V4,
  CURLING_STONES,
  CURLING_W,
  EIGHT_FOOT_R,
  FOUR_FOOT_R,
  HOG_FAR,
  HOG_NEAR,
  HOUSE_R,
  SHEET_HALF_W,
  STONE_R,
  SWEEP_MAX,
  TEAM_MINE,
  TEE_NEAR,
  type CurlingState,
} from "./curling";

/* ============================== Projection ============================== */

/** The camera: CAM_Y cm along the sheet (behind the near house), FOCAL px a unit of x ÷ depth, HF = height × FOCAL. */
const CAM_Y = TEE_NEAR + 2025;
const FOCAL = 2200;
const HF = 1_551_000;
const HORIZON = -22;
const CX = CURLING_W / 2;
/** Neighbouring sheets sit this far apart (cm, centre to centre). */
const SHEET_PITCH = 505;

/**
 * A view of the sheet (display only): the world's size and the horizon's height. curlRev 2's is the same camera as
 * curlRev 1's 90 px higher on a world 180 px shorter (the arena's top and the ice nearest the camera cropped).
 */
export interface CurlView {
  rev: number;
  w: number;
  h: number;
  horizon: number;
  /** The neighbouring sheets' dimming. */
  dim: number;
  /** The camera (curlRev 4's view only; the others use CAM_Y, FOCAL and HF): its place along the sheet, focal, height × focal. */
  camY?: number;
  focal?: number;
  hf?: number;
}
export const CURL_VIEW_V1: CurlView = { rev: 1, w: CURLING_W, h: CURLING_H, horizon: HORIZON, dim: 0.42 };
export const CURL_VIEW_V2: CurlView = { rev: 2, w: CURLING_W, h: CURLING_H_V2, horizon: HORIZON - 90, dim: 0.3 };
/**
 * curlRev 4's view (3 Nov 2026, display only; Joe's audit): the near house behind the thrower took about a quarter of the
 * screen while the far house was small. A longer lens from a little further back on a taller world (390 × 640): the far
 * house is about 1.4 times as wide, the stone's path from the near hog line (world row 540) to the house gets 340 rows
 * instead of 300, and only the top of the near house shows, below the In / Out / Throw row (CURL_TURN_ROW_TOP is worked
 * out from this view). Every input that reads the view (the broom, the start slide, the sweep side) reads it.
 */
export const CURL_VIEW_V4: CurlView = { rev: 4, w: CURLING_W, h: CURLING_H_V4, horizon: -163, dim: 0.3, camY: 5863, focal: 3204, hf: 2_129_000 };
/** The view a state's (or a stored round's) curlRev draws. */
export function curlViewFor(rev: number | null | undefined): CurlView {
  return (rev ?? 1) >= 4 ? CURL_VIEW_V4 : (rev ?? 1) >= 2 ? CURL_VIEW_V2 : CURL_VIEW_V1;
}

/** A sheet point (cm) on screen (world px); k is the px per cm across at that depth. */
export function curlProject(x: number, y: number, v: CurlView = CURL_VIEW_V1): { sx: number; sy: number; k: number } {
  const z = Math.max(60, (v.camY ?? CAM_Y) - y);
  const f = v.focal ?? FOCAL;
  return { sx: CX + (x * f) / z, sy: v.horizon + (v.hf ?? HF) / z, k: f / z };
}

/** A screen point (world px) back on the sheet (cm); null above the far boards. */
export function curlUnproject(sx: number, sy: number, v: CurlView = CURL_VIEW_V1): { x: number; y: number } | null {
  if (sy <= v.horizon + 1) return null;
  const z = (v.hf ?? HF) / (sy - v.horizon);
  return { x: ((sx - CX) * z) / (v.focal ?? FOCAL), y: (v.camY ?? CAM_Y) - z };
}

/** The far house on screen (world px) in a view: its centre and its across-radius, for the stage's broom drag. */
export function curlFarHouse(v: CurlView): { sx: number; sy: number; rx: number; top: number; bottom: number } {
  const c = curlProject(0, 0, v);
  return { sx: c.sx, sy: c.sy, rx: HOUSE_R * c.k, top: curlProject(0, -HOUSE_R, v).sy - 18, bottom: curlProject(0, HOUSE_R, v).sy + 26 };
}
export const CURL_FAR_HOUSE = curlFarHouse(CURL_VIEW_V1);

/** The inset (top right): its box (world px) and its scale (px a cm), centred on the far tee. */
export const CURL_INSET = { x: 262, y: 10, w: 120, h: 120, scale: 120 / 2 / 205 };
/**
 * curlRev 4's inset (the Sports overhaul, 15 Nov 2026, display and tap mapping only): larger (138 px square) on a solid
 * panel. Older views keep CURL_INSET: in curlRev 2 and 3's view the larger box would cover the far house's right edge.
 */
export const CURL_INSET_V4 = { x: 246, y: 6, w: 138, h: 138, scale: 138 / 2 / 205 };
/** The inset a revision draws (and its taps map through). */
export function curlInsetFor(rev: number | null | undefined): typeof CURL_INSET {
  return (rev ?? 1) >= 4 ? CURL_INSET_V4 : CURL_INSET;
}

/** An inset point (world px) as sheet cm, or null outside the inset (curlRev 4's larger one with its rev). */
export function curlInsetToSheet(px: number, py: number, rev?: number | null): { x: number; y: number } | null {
  const i = curlInsetFor(rev);
  if (px < i.x || px > i.x + i.w || py < i.y || py > i.y + i.h) return null;
  // Top down with the far end up: up the screen is further down the sheet (smaller y).
  return { x: (px - (i.x + i.w / 2)) / i.scale, y: (py - (i.y + i.h / 2)) / i.scale };
}

/** Screen px a cm across at the far house (the broom drag's step). */
export const CURL_PX_PER_CM_FAR = curlProject(0, 0).k;

/* ================================ Palette ================================ */

const ICE = "#E9F1F6";
const ICE_FAR = "#B9C9D6";
const RING_BLUE = "#1F5FB8";
const RING_RED = "#C8202E";
const GOLD = "#E8B53A";
const GOLD_HI = "#FFE29A";
const RED = "#C42A2E";
const RED_HI = "#FF8A80";

/* ============================ The static layer ============================ */

let cache: { canvas: HTMLCanvasElement; w: number; h: number; rev: number; key: string } | null = null;

/** The look this draw uses (wave 2 skins): set by drawCurling / curlingScene for their length, the default otherwise. */
let L: GameLook = NO_LOOK;
/** The sheet's colours: the default's, or the Neon Rink's. */
const sheetPal = () => (L.world ? neonRinkPalette() : DEFAULT_RINK);

/** One sheet's ice, rings and lines, centred `offset` cm across. */
function sheet(ctx: CanvasRenderingContext2D, offset: number, dim: number, v: CurlView): void {
  const P = (x: number, y: number) => curlProject(x, y, v);
  const near = BACK_NEAR + 300;
  const far = BACK_FAR - 120;
  const q = [P(offset - SHEET_HALF_W, far), P(offset + SHEET_HALF_W, far), P(offset + SHEET_HALF_W, near), P(offset - SHEET_HALF_W, near)];
  const g = ctx.createLinearGradient(0, q[0]!.sy, 0, v.h);
  const pal = sheetPal();
  g.addColorStop(0, pal.iceFar);
  g.addColorStop(0.35, pal.iceMid);
  g.addColorStop(1, pal.ice);
  ctx.save();
  ctx.beginPath();
  q.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy)));
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  if (L.world) neonRinkIce(ctx, q[0]!.sy, v.w, v.h);
  // Both houses, their rings about this sheet's centre line.
  {
    for (const cy of [0, TEE_NEAR]) {
      for (const [r, fill, edge] of [
        [HOUSE_R, pal.house[0], pal.ring[0]],
        [EIGHT_FOOT_R, pal.house[1], pal.ring[1]],
        [FOUR_FOOT_R, pal.house[2], pal.ring[2]],
        [BUTTON_R, pal.house[3], pal.ring[3]],
      ] as const) {
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const p = P(offset + Math.cos(a) * r, cy + Math.sin(a) * r);
          if (i === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (edge) neonStroke(ctx, edge, Math.max(1, 5 * P(offset, cy).k));
        else if (!L.world) {
          // A crisp painted rim (the default rink), seen through the ice.
          ctx.strokeStyle = "rgba(16,28,52,0.32)";
          ctx.lineWidth = Math.max(0.5, 1.4 * P(offset, cy).k);
          ctx.stroke();
        }
      }
    }
  }
  // The rings are paint under the ice (the default rink): a thin clear veil of ice over them, the pebble on top.
  if (!L.world) {
    ctx.fillStyle = "rgba(244,249,252,0.1)";
    ctx.fillRect(-400, q[0]!.sy, v.w + 800, v.h + 400);
  }
  const across = (y: number, colour: string, w: number) => {
    const a = P(offset - SHEET_HALF_W, y);
    const b = P(offset + SHEET_HALF_W, y);
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(0.5, w * a.k);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  };
  across(0, pal.line, 1.3);
  across(BACK_FAR, pal.line, 1.3);
  across(TEE_NEAR, pal.line, 1.3);
  if (pal.glowHog) {
    ctx.save();
    ctx.shadowColor = pal.hog;
    ctx.shadowBlur = 5;
  }
  across(HOG_FAR, pal.hog, 10);
  across(HOG_NEAR, pal.hog, 10);
  if (pal.glowHog) ctx.restore();
  // The centre line.
  const c0 = P(offset, BACK_FAR - 120);
  const c1 = P(offset, near);
  ctx.strokeStyle = pal.centre;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(c0.sx, c0.sy);
  ctx.lineTo(c1.sx, c1.sy);
  ctx.stroke();
  // Pebble: fine frozen droplets, denser and softer far away.
  for (let i = 0; i < 1400; i++) {
    const u = artHash(i, 11 + offset) / 4294967296;
    const v = artHash(i, 23 + offset) / 4294967296;
    const y = far + (near - far) * Math.sqrt(v);
    const x = offset + (u * 2 - 1) * SHEET_HALF_W;
    const p = P(x, y);
    ctx.fillStyle = i % 3 ? pal.pebble[0] : pal.pebble[1];
    ctx.fillRect(p.sx, p.sy, Math.max(0.5, p.k * 1.4), Math.max(0.5, p.k * 1.1));
  }
  // The main sheet's depth (the default rink): the sheen and the roof lights' long reflections (iceDepth).
  if (!L.world && offset === 0) iceDepth(ctx, offset, v, far, near);
  // The neighbouring sheets' roof-light reflections: soft streaks down the ice.
  for (const lx of pal.reflections && (L.world || offset !== 0) ? [-120, 120] : []) {
    for (const ly of [300, 1300, 2300]) {
      const p = P(offset + lx, ly);
      const r = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, 70 * p.k + 6);
      r.addColorStop(0, "#FFFFFF55");
      r.addColorStop(1, "#FFFFFF00");
      ctx.fillStyle = r;
      ctx.save();
      ctx.translate(p.sx, p.sy);
      ctx.scale(0.45, 1.6);
      ctx.translate(-p.sx, -p.sy);
      ctx.fillRect(p.sx - 90 * p.k - 8, p.sy - 90 * p.k - 8, 180 * p.k + 16, 180 * p.k + 16);
      ctx.restore();
    }
  }
  if (dim > 0) {
    ctx.fillStyle = `rgba(10,16,28,${dim})`;
    // Clipped to this sheet: the whole of it, out past the world's edges (the scene beyond) as well.
    ctx.fillRect(-400, -400, v.w + 800, v.h + 800);
  }
  ctx.restore();
  // The side boards and their LED strips (the default rink: a solid dark board, its lit top edge, so the sheet glows
  // by contrast).
  for (const side of L.world ? [] : [-1, 1]) {
    const e0 = offset + side * (SHEET_HALF_W + 1);
    const e1 = offset + side * (SHEET_HALF_W + 18);
    const qa = [P(e0, far), P(e1, far), P(e1, near), P(e0, near)];
    ctx.fillStyle = "#070A11";
    ctx.beginPath();
    qa.forEach((pt, i) => (i ? ctx.lineTo(pt.sx, pt.sy) : ctx.moveTo(pt.sx, pt.sy)));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(190,212,236,0.42)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(qa[0]!.sx, qa[0]!.sy);
    ctx.lineTo(qa[3]!.sx, qa[3]!.sy);
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    const a = P(offset + side * (SHEET_HALF_W + 4), far);
    const b = P(offset + side * (SHEET_HALF_W + 4), near);
    if (L.world) {
      ctx.strokeStyle = pal.board;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = pal.led;
    ctx.shadowBlur = L.world ? 6 : 2;
    ctx.strokeStyle = dim > 0 ? `${pal.led}88` : pal.led;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy - 1.5);
    ctx.lineTo(b.sx, b.sy - 1.5);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * The main sheet's depth (the Sports overhaul, 15 Nov 2026; the default rink): polished ice, a sheen darkening towards
 * the boards and the roof lights reflected as long soft highlights running down the sheet (several nested bands, each
 * faint, brightest a third of the way down and gone before the near end: no glare over the stones or the HUD).
 * Drawn inside the sheet's clip, under the stones; geometry and projection unchanged.
 */
function iceDepth(ctx: CanvasRenderingContext2D, offset: number, v: CurlView, far: number, near: number): void {
  const P = (x: number, y: number) => curlProject(x, y, v);
  const quad = (x0: number, x1: number, y0: number, y1: number) => {
    const a = P(offset + x0, y0);
    const b = P(offset + x1, y0);
    const c = P(offset + x1, y1);
    const d = P(offset + x0, y1);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.lineTo(c.sx, c.sy);
    ctx.lineTo(d.sx, d.sy);
    ctx.closePath();
  };
  // The sheen across: the middle of the sheet brightest, darker towards the boards.
  const strips = 28;
  for (let i = 0; i < strips; i++) {
    const u0 = -1 + (2 * i) / strips;
    const u1 = u0 + 2 / strips;
    const m = Math.abs((u0 + u1) / 2);
    quad(u0 * SHEET_HALF_W, u1 * SHEET_HALF_W, far, near);
    ctx.fillStyle = `rgba(30,50,82,${(0.3 * m ** 2).toFixed(3)})`;
    ctx.fill();
  }
  // A cool sheen falling off with distance (the far end catches less of the lights).
  const top = P(offset, far).sy;
  const bottom = Math.min(v.h + 40, P(offset, near).sy);
  const fall = ctx.createLinearGradient(0, top, 0, bottom);
  fall.addColorStop(0, "rgba(120,146,176,0.22)");
  fall.addColorStop(0.35, "rgba(120,146,176,0.06)");
  fall.addColorStop(0.7, "rgba(60,82,108,0.04)");
  fall.addColorStop(1, "rgba(60,82,108,0.1)");
  quad(-SHEET_HALF_W, SHEET_HALF_W, far, near);
  ctx.fillStyle = fall;
  ctx.fill();
  // The roof lights' reflections: long, gentle highlights down the sheet.
  for (const lx of [-150, -58, 58, 150]) {
    for (const [half, a] of [
      [30, 0.08],
      [15, 0.1],
      [6, 0.12],
    ] as const) {
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.12, `rgba(255,255,255,${a * 0.6})`);
      g.addColorStop(0.38, `rgba(255,255,255,${a})`);
      g.addColorStop(0.72, `rgba(255,255,255,${a * 0.45})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      quad(lx - half, lx + half, far + 60, near);
      ctx.fillStyle = g;
      ctx.fill();
    }
  }
  // The glossy veil: a faint brighter band where the lights' glow pools mid-sheet.
  const pool = ctx.createLinearGradient(0, top, 0, bottom);
  pool.addColorStop(0, "rgba(255,255,255,0)");
  pool.addColorStop(0.45, "rgba(255,255,255,0.05)");
  pool.addColorStop(1, "rgba(255,255,255,0)");
  quad(-SHEET_HALF_W * 0.7, SHEET_HALF_W * 0.7, far, near);
  ctx.fillStyle = pool;
  ctx.fill();
}

/**
 * The arena above the far boards (the Sports overhaul, 15 Nov 2026, concept A): a packed stand of seated spectators in
 * bright team colours, row over row up into the dark roof, a quiet warm wash from the roof lights (no glare), the
 * balcony rail and the far boards with a thin cool LED strip.
 */
function arena(ctx: CanvasRenderingContext2D, top: number, bottom: number): void {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, "#030408");
  g.addColorStop(0.6, "#0A0D16");
  g.addColorStop(1, "#141826");
  ctx.fillStyle = g;
  ctx.fillRect(-400, top, CURLING_W + 800, bottom - top);
  // The stand: tiers from the boards up, each a dark seat row with its spectators, smaller and dimmer further up.
  const shirts = ["#D8352F", "#F2C230", "#2F6FD6", "#F3F1EC", "#E8752A", "#1FA38A", "#C8202E", "#3B4A6B", "#E9A6C8", "#7A55C9"];
  const skins = ["#F2D2B6", "#D9A982", "#B47B55", "#8A5A3C", "#F7E1CC"];
  const rows = 11;
  let y = bottom - 12;
  for (let tier = 0; tier < rows; tier++) {
    const sc = 1 - tier * 0.045;
    const pitch = 11.2 * sc;
    const rowH = 15.5 * sc;
    const shade = Math.min(0.78, tier * 0.07);
    // The seat backs.
    ctx.fillStyle = "#1A2034";
    ctx.fillRect(-400, y - 2.5 * sc, CURLING_W + 800, 4.2 * sc);
    for (let i = -2; i < Math.ceil((CURLING_W + 40) / pitch) + 2; i++) {
      const h = artHash(i + 97, tier * 13 + 5);
      if (h % 11 === 0) continue; // an empty seat
      const x = -20 + i * pitch + (tier % 2) * pitch * 0.5 + ((h >>> 8) % 3) - 1;
      const bob = ((h >>> 12) % 3) * 0.6 * sc;
      // Torso: a rounded block in a team colour.
      ctx.fillStyle = shirts[(h >>> 4) % shirts.length]!;
      ctx.beginPath();
      ctx.roundRect(x - 4 * sc, y - 9.5 * sc - bob, 8 * sc, 8.5 * sc, 2.2 * sc);
      ctx.fill();
      // Head.
      ctx.fillStyle = skins[(h >>> 16) % skins.length]!;
      ctx.beginPath();
      ctx.arc(x, y - 12.6 * sc - bob, 2.9 * sc, 0, Math.PI * 2);
      ctx.fill();
      // A few hats and scarves for texture.
      if ((h >>> 20) % 6 === 0) {
        ctx.fillStyle = shirts[(h >>> 24) % shirts.length]!;
        ctx.fillRect(x - 3 * sc, y - 15.6 * sc - bob, 6 * sc, 2 * sc);
      }
    }
    if (shade > 0) {
      ctx.fillStyle = `rgba(3,4,8,${shade.toFixed(3)})`;
      ctx.fillRect(-400, y - rowH, CURLING_W + 800, rowH + 2);
    }
    y -= rowH;
    if (y < top) break;
  }
  // The roof lights' quiet wash over the lower tiers (no hot spots).
  const wash = ctx.createLinearGradient(0, bottom - 120, 0, bottom);
  wash.addColorStop(0, "rgba(255,236,200,0)");
  wash.addColorStop(1, "rgba(255,236,200,0.07)");
  ctx.fillStyle = wash;
  ctx.fillRect(-400, bottom - 120, CURLING_W + 800, 120);
  // The balcony rail and the far boards with their LED strip.
  ctx.fillStyle = "#0C111C";
  ctx.fillRect(-400, bottom - 8, CURLING_W + 800, 8);
  ctx.fillStyle = "#2A3246";
  ctx.fillRect(-400, bottom - 8, CURLING_W + 800, 1);
  ctx.fillStyle = "#7FE3FF";
  ctx.fillRect(-400, bottom - 3.5, CURLING_W + 800, 1.2);
}

function paintStatic(ctx: CanvasRenderingContext2D, v: CurlView): void {
  const farEdge = curlProject(0, BACK_FAR - 120, v).sy;
  if (L.world) neonRinkArena(ctx, -200, farEdge, CURLING_W);
  else {
    arena(ctx, -200, farEdge);
    renderedArena(ctx, farEdge);
  }
  // The floor between sheets.
  ctx.fillStyle = sheetPal().floor;
  ctx.beginPath();
  ctx.moveTo(-400, farEdge);
  ctx.lineTo(CURLING_W + 400, farEdge);
  ctx.lineTo(CURLING_W + 400, CURLING_H + 200);
  ctx.lineTo(-400, CURLING_H + 200);
  ctx.closePath();
  ctx.fill();
  // The neighbouring sheets recede into the dark (concept A); the Neon Rink keeps its own dimming.
  const nd = L.world ? v.dim : Math.max(v.dim, 0.8);
  for (const off of [-2 * SHEET_PITCH, 2 * SHEET_PITCH, -SHEET_PITCH, SHEET_PITCH]) sheet(ctx, off, nd, v);
  sheet(ctx, 0, 0, v);
}

function staticLayer(ctx: CanvasRenderingContext2D, v: CurlView): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const t = ctx.getTransform();
  const w = Math.max(1, Math.round(v.w * t.a));
  const h = Math.max(1, Math.round(v.h * t.d));
  // Repainted once when a rendered image arrives (the arena behind the boards).
  const key = (L.world ?? "") + (L.world ? neonRinkCacheTag() : `:${sportsSpritesVersion()}`);
  if (cache && cache.w === w && cache.h === h && cache.rev === v.rev && cache.key === key) return cache.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) return null;
  c.scale(w / v.w, h / v.h);
  paintStatic(c, v);
  cache = { canvas, w, h, rev: v.rev, key };
  return canvas;
}

/* ============================ Rendered materials ============================ */

/**
 * The rendered stones' frame (docs/design/game-art/sports/render_curling.py, public/sports/curling/stone-*.webp): a
 * 256 px square, the granite body's radius in px, and the row of the body's centre-bottom (the stone's contact point
 * on the ice). Seen 12.7° above the ice, as every stone in the game is drawn (top face ry = 0.22 rx).
 */
export const STONE_FRAME = { size: 256, radius: 98.46, base: 168.34 };
/** The rendered arena (public/sports/curling/arena.webp): 1560 × 610 px for 780 world px across, the boards' face at row 600. */
export const ARENA_FRAME = { w: 1560, h: 610, worldW: 780, boardsRow: 600 };

/**
 * The rendered stands (concept A: tiers of fans in team colours under the roof's lights) over the painted fallback,
 * aligned on the far boards and centred on the sheet; dark fades at its two sides hide where it meets the painted
 * crowd beyond (only a box wider than 780 px shows them).
 */
function renderedArena(ctx: CanvasRenderingContext2D, farEdge: number): void {
  const img = sportsSprite("curling", "arena");
  if (!img) return;
  const s = ARENA_FRAME.worldW / ARENA_FRAME.w;
  const x0 = CX - ARENA_FRAME.worldW / 2;
  const y0 = farEdge - ARENA_FRAME.boardsRow * s;
  ctx.drawImage(img, x0, y0, ARENA_FRAME.worldW, ARENA_FRAME.h * s);
  for (const side of [0, 1]) {
    const xa = side ? x0 + ARENA_FRAME.worldW - 40 : x0;
    const g = ctx.createLinearGradient(xa, 0, xa + 40, 0);
    g.addColorStop(side ? 0 : 1, "rgba(5,7,12,0)");
    g.addColorStop(side ? 1 : 0, "rgba(5,7,12,0.9)");
    ctx.fillStyle = g;
    ctx.fillRect(xa, y0, 40, farEdge - y0);
  }
}

/* ================================ Stones ================================ */

/** A granite stone at a sheet point: a short cylinder with a speckled top and its handle (gold or red). */
function stone(ctx: CanvasRenderingContext2D, x: number, y: number, mine: boolean, seed: number, moving: boolean, v: CurlView): void {
  const p = curlProject(x, y, v);
  const rx = STONE_R * p.k;
  const ry = Math.max(rx * 0.22, (STONE_R * (v.hf ?? HF)) / Math.max(60, (v.camY ?? CAM_Y) - y) ** 2);
  const lift = Math.max(1.2, 11 * p.k);
  const skinned = curlStoneSkin(L, mine);
  if (skinned) {
    paintSkinStone(ctx, skinned, p.sx, p.sy, rx, ry, lift, seed, moving);
    return;
  }
  // The rendered stone (polished granite, a gold or red handle; display only), its body exactly the sim's radius.
  const img = L.world ? null : sportsSprite("curling", mine ? "stone-gold" : "stone-red");
  if (img) {
    const sc = rx / STONE_FRAME.radius;
    const ix = p.sx - (STONE_FRAME.size / 2) * sc;
    const iy = p.sy - STONE_FRAME.base * sc;
    const is = STONE_FRAME.size * sc;
    // A faint reflection in the polished ice: the stone mirrored about its contact line, squashed and faded.
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.translate(0, p.sy);
    ctx.scale(1, -0.55);
    ctx.translate(0, -p.sy);
    ctx.drawImage(img, ix, iy, is, is);
    ctx.restore();
    // A soft contact shadow.
    const sh = ctx.createRadialGradient(p.sx, p.sy + ry * 0.2, 0, p.sx, p.sy + ry * 0.2, rx * 1.15);
    sh.addColorStop(0, "rgba(10,22,40,0.32)");
    sh.addColorStop(1, "rgba(10,22,40,0)");
    ctx.save();
    ctx.translate(p.sx, p.sy + ry * 0.2);
    ctx.scale(1, Math.max(0.2, (ry * 1.3) / (rx * 1.15)));
    ctx.translate(-p.sx, -(p.sy + ry * 0.2));
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy + ry * 0.2, rx * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.drawImage(img, ix, iy, is, is);
    if (moving) {
      ctx.strokeStyle = "#FFFFFF66";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy - lift, rx * 1.15, ry * 1.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  // Shadow on the ice.
  ctx.fillStyle = "#0B1A2A33";
  ctx.beginPath();
  ctx.ellipse(p.sx + rx * 0.08, p.sy + ry * 0.4, rx * 1.05, ry * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // The body (side band) and the striking band.
  ctx.fillStyle = "#4A4E57";
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(p.sx - rx, p.sy - lift);
  ctx.ellipse(p.sx, p.sy - lift, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#6C717C";
  ctx.fillRect(p.sx - rx, p.sy - lift * 0.55, rx * 2, Math.max(0.6, lift * 0.18));
  // The top: speckled granite.
  const top = ctx.createRadialGradient(p.sx - rx * 0.3, p.sy - lift - ry * 0.4, 0, p.sx, p.sy - lift, rx);
  top.addColorStop(0, "#A8ADB6");
  top.addColorStop(1, "#5D626C");
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy - lift, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  if (rx > 5) {
    for (let i = 0; i < 10; i++) {
      const h = artHash(seed, i);
      const a = (h % 628) / 100;
      const r = ((h >>> 10) % 90) / 100;
      ctx.fillStyle = i % 2 ? "#2F333A" : "#D3D7DE";
      ctx.fillRect(p.sx + Math.cos(a) * rx * r, p.sy - lift + Math.sin(a) * ry * r, Math.max(0.6, rx * 0.06), Math.max(0.5, ry * 0.1));
    }
  }
  // The handle: a shiny bar with a highlight.
  const hw = rx * 0.95;
  const hh = Math.max(1.2, lift * 0.55);
  const hg = ctx.createLinearGradient(0, p.sy - lift - hh, 0, p.sy - lift);
  hg.addColorStop(0, mine ? GOLD_HI : RED_HI);
  hg.addColorStop(0.5, mine ? GOLD : RED);
  hg.addColorStop(1, mine ? "#8A6416" : "#6E1214");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(p.sx - hw * 0.15, p.sy - lift - hh * 0.4, hw * 0.55, Math.max(1, hh * 0.65), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(p.sx - hw * 0.15, p.sy - lift - hh * 0.75, hw * 0.75, Math.max(1, hh * 0.6));
  if (moving) {
    ctx.strokeStyle = "#FFFFFF66";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy - lift, rx * 1.15, ry * 1.3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/* ================================ The HUD ================================ */

/** The stone count's chip (all revisions, display only): larger type, near-black with a gold edge, white figures. */
function stoneChip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): number {
  // The Sports overhaul (15 Nov 2026): big and legible, 20 px figures on a solid chip.
  ctx.font = "800 20px Archivo, system-ui, sans-serif";
  const w = Math.ceil(ctx.measureText(text).width) + 28;
  ctx.fillStyle = "#05080F";
  ctx.strokeStyle = "#E8B53A";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 36, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 14, y + 18.5);
  return w;
}

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, w: number): void {
  ctx.fillStyle = "#05080FEE";
  ctx.strokeStyle = "#FFFFFF2E";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 28, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#F3F1EC";
  ctx.font = "800 14px Archivo, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 12, y + 14.5);
}

function inset(ctx: CanvasRenderingContext2D, s: CurlingState, aim: CurlAim | null): void {
  const i = curlInsetFor(s.rev);
  const cx = i.x + i.w / 2;
  const cy = i.y + i.h / 2;
  ctx.save();
  // A solid panel (the Sports overhaul): an opaque dark frame with a light rim, so the house never sits on the crowd.
  ctx.fillStyle = "#05080F";
  ctx.beginPath();
  ctx.roundRect(i.x - 3, i.y - 3, i.w + 6, i.h + 6, 12);
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF66";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(i.x, i.y, i.w, i.h, 10);
  ctx.clip();
  const neon = L.world ? neonRinkPalette() : null;
  ctx.fillStyle = neon ? neon.ice : "#F1F6FA";
  ctx.fillRect(i.x, i.y, i.w, i.h);
  for (const [r, fill, edge] of [
    [HOUSE_R, neon ? neon.house[0] : RING_BLUE, neon?.ring[0]],
    [EIGHT_FOOT_R, neon ? neon.house[1] : "#F1F6FA", neon?.ring[1]],
    [FOUR_FOOT_R, neon ? neon.house[2] : RING_RED, neon?.ring[2]],
    [BUTTON_R, neon ? neon.house[3] : "#F1F6FA", neon?.ring[3]],
  ] as const) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx, cy, r * i.scale, 0, Math.PI * 2);
    ctx.fill();
    if (edge) neonStroke(ctx, edge, 1.5);
  }
  ctx.strokeStyle = neon ? neon.centre : "#2B2B3366";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(i.x, cy);
  ctx.lineTo(i.x + i.w, cy);
  ctx.moveTo(cx, i.y);
  ctx.lineTo(cx, i.y + i.h);
  ctx.stroke();
  for (let k = 0; k < s.x.length; k++) {
    if (!s.live[k]) continue;
    const x = cx + (s.x[k]! / CU) * i.scale;
    const y = cy + (s.y[k]! / CU) * i.scale;
    if (y < i.y - 8 || y > i.y + i.h + 8) continue;
    const mine = s.team[k] === TEAM_MINE;
    const skin = curlStoneSkin(L, mine);
    ctx.fillStyle = skin ? skin.top : "#4C515B";
    ctx.beginPath();
    ctx.arc(x, y, STONE_R * i.scale, 0, Math.PI * 2);
    ctx.fill();
    if (!skin) {
      ctx.strokeStyle = "#1B1E24";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (skin?.topEdge) {
      ctx.strokeStyle = skin.topEdge;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = skin ? skin.handle : mine ? GOLD : RED;
    ctx.beginPath();
    ctx.arc(x, y, STONE_R * i.scale * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  if (aim && s.phase === CURL_AIM) {
    const x = cx + aim.broomX * i.scale;
    const y = cy + aim.broomY * i.scale;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 5);
    ctx.stroke();
  }
  ctx.restore();
}

/** What the stage shows over the sim (presentation only): the broom, the turn, the swipe's weight, the start. */
export interface CurlAim {
  broomX: number;
  broomY: number;
  /** curlRev 2: the stone's start x on the near hog line (cm); absent or 0 the centre line. */
  startX?: number;
  /** 0 In, 1 Out. */
  turn: number;
  /** A swipe in progress: its weight so far (1…1000), else null. */
  swipe: number | null;
  /** curlRev 3: the draw zone for this start, target and turn (weights), or null when no weight reaches the house. */
  zone?: { lo: number; hi: number; tee: number } | null;
  /** curlRev 3: the first third of the stone's path at the zone's tee weight (sheet cm). */
  path?: readonly { x: number; y: number }[] | null;
  /**
   * curlRev 3: the weight the last throw was released at (the meter's tick), and the keyboard's set weight. curlRev 4:
   * keyWeight is the weight set on the power bar (by a tap or drag, or − / +), its marker staying where it was set.
   */
  lastRelease?: number | null;
  keyWeight?: number | null;
}

/** curlRev 3's weight meter (world px, curlRev 2's 390 × 540 view): a bar on the right, weight 0 at the bottom. */
export const CURL_METER = { x: 360, y: 214, w: 14, h: 252 };
/**
 * curlRev 4's power bar (world px): the same bar, wider and taller (a tap or drag on it sets the weight); its touch
 * area (CURL_METER_HIT_V4) runs from 30 px left of the bar to the world's right edge and 16 px past either end.
 */
export const CURL_METER_V4 = { x: 356, y: 172, w: 22, h: 300 };
/** How far left of the bar a touch still takes it (px; 30 until the Sports overhaul widened the grab area to 46). */
export const CURL_METER_GRAB = 46;
export const CURL_METER_HIT_V4 = { x: CURL_METER_V4.x - CURL_METER_GRAB, y: CURL_METER_V4.y - 16, w: 390 - (CURL_METER_V4.x - CURL_METER_GRAB), h: CURL_METER_V4.h + 32 };
/** The meter a revision draws. */
export function curlMeterFor(rev: number | null | undefined): { x: number; y: number; w: number; h: number } {
  return (rev ?? 1) >= 4 ? CURL_METER_V4 : CURL_METER;
}
/** The meter's y (world px) for a weight. */
export function curlMeterY(w: number, m: { y: number; h: number } = CURL_METER): number {
  return m.y + m.h - (m.h * Math.max(0, Math.min(1000, w))) / 1000;
}
/** curlRev 4: the weight (1…1000) a touch at world y sets on the power bar. */
export function curlMeterWeightAt(y: number): number {
  const m = CURL_METER_V4;
  return Math.max(1, Math.min(1000, Math.round(((m.y + m.h - y) / m.h) * 1000)));
}
/** curlRev 4: whether a touch at world (x, y) is on the power bar. */
export function curlOnMeterV4(x: number, y: number): boolean {
  const h = CURL_METER_HIT_V4;
  return x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h;
}

/** The weight's words for the swipe pill. */
export function curlWeightWord(w: number): string {
  if (w < 270) return "Light";
  if (w < 330) return "Draw";
  if (w < 400) return "Firm";
  return "Takeout";
}

function broom(ctx: CanvasRenderingContext2D, x: number, y: number, v: CurlView): void {
  const p = curlProject(x, y, v);
  ctx.save();
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = 8;
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy, 7, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = GOLD_HI;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(p.sx, p.sy - 1);
  ctx.lineTo(p.sx + 3, p.sy - 22);
  ctx.stroke();
}

function turnMark(ctx: CanvasRenderingContext2D, turn: number, v: CurlView, x = 0): void {
  const p = curlProject(x, HOG_NEAR + 40, v);
  const r = 22;
  const dir = turn === 0 ? 1 : -1;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const a0 = -Math.PI * 0.85;
  const a1 = -Math.PI * 0.15;
  ctx.ellipse(p.sx, p.sy - 8, r, r * 0.35, 0, dir > 0 ? a0 : a1, dir > 0 ? a1 : a0, dir < 0);
  ctx.stroke();
  const end = dir > 0 ? a1 : a0;
  const ex = p.sx + Math.cos(end) * r;
  const ey = p.sy - 8 + Math.sin(end) * r * 0.35;
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(ex + dir * 5, ey + 1);
  ctx.lineTo(ex - dir * 2, ey - 4);
  ctx.lineTo(ex - dir * 2, ey + 5);
  ctx.closePath();
  ctx.fill();
}

/* ============================== Captain Joulz ============================== */

/**
 * Captain Joulz's delivery (the Sports overhaul, 15 Nov 2026; display only): the 3D Captain (#423) rendered from behind
 * and above (docs/design/game-art/sports/render_sports.py, public/sports/curling/), crouched beside the waiting stone
 * with his hand on it while aiming, then at the throw sliding a little way on and letting go, fading out as the stone
 * runs. He is drawn beside the stone's line, never over it: the path ahead, the far house, the inset, the power bar
 * and (curlRev 4) the In / Out / Throw row all stay clear (curling-overhaul-check proves it on every delivery frame).
 * Until his sprites load (and wherever there is no browser Image) nothing is drawn.
 */
export const CURL_CAPTAIN = {
  slide: { w: 258, h: 276, hand: [252, 166] as const },
  release: { w: 262, h: 276, hand: [256, 158] as const },
};
/** His height on the ice (cm, crouched), scaled by the perspective at his hand. */
const CAPTAIN_CM = 86;
/** At the throw: how far he slides on (cm), over how many ticks, then how long he takes to fade. */
const CAPTAIN_SLIDE_CM = 34;
const CAPTAIN_SLIDE_TICKS = 18;
const CAPTAIN_FADE_TICKS = 30;

export interface CurlCaptainPlace {
  pose: "slide" | "release";
  /** The sprite's box (world px) and whether it is mirrored (he crouches right of the line for a start far left). */
  x: number;
  y: number;
  w: number;
  h: number;
  flip: boolean;
  alpha: number;
  /** How far he has slid on past the hog line (cm along the sheet): his hand is on the line at HOG_NEAR − fwd. */
  fwd: number;
}

/** Where the Captain is drawn this frame for a start `startX` (cm), or null when he isn't. */
export function curlCaptainPlace(s: Pick<CurlingState, "phase" | "thrown" | "travelTicks" | "active">, startX: number, v: CurlView, broomX = 0): CurlCaptainPlace | null {
  let pose: "slide" | "release";
  let fwd = 0;
  let alpha = 1;
  if (s.phase === CURL_AIM && s.thrown < CURLING_STONES) pose = "slide";
  else if (s.phase === CURL_TRAVEL && s.active >= 0 && s.travelTicks < CAPTAIN_SLIDE_TICKS + CAPTAIN_FADE_TICKS) {
    pose = "release";
    const t = Math.min(1, s.travelTicks / CAPTAIN_SLIDE_TICKS);
    fwd = CAPTAIN_SLIDE_CM * (1 - (1 - t) * (1 - t));
    alpha = s.travelTicks <= CAPTAIN_SLIDE_TICKS ? 1 : 1 - (s.travelTicks - CAPTAIN_SLIDE_TICKS) / CAPTAIN_FADE_TICKS;
  } else return null;
  const spec = CURL_CAPTAIN[pose];
  const flip = curlCaptainRight(startX, broomX);
  const p = curlProject(startX, HOG_NEAR - fwd, v);
  const lift = Math.max(1.2, 11 * p.k);
  // His hand on the stone's near side (its striking band), never over its top: the line ahead stays clear.
  const handX = p.sx + (flip ? 1 : -1) * STONE_R * p.k * 1.02;
  const handY = p.sy - lift * 0.5;
  // Smaller where a wide start leaves less ice than his width before the world's edge (never cut off; at most 25 %).
  const room = flip ? v.w - 4 - handX : handX - 4;
  const reach = spec.hand[0]; // mirrored or not, his body runs this far (sprite px) from his hand
  const scale = Math.min((CAPTAIN_CM * p.k) / spec.h, Math.max((0.75 * CAPTAIN_CM * p.k) / spec.h, room / reach));
  const w = spec.w * scale;
  const h = spec.h * scale;
  const ax = spec.hand[0] * scale;
  const x = flip ? handX - (w - ax) : handX - ax;
  return { pose, x, y: handY - spec.hand[1] * scale, w, h, flip, alpha: Math.max(0, alpha), fwd };
}

/**
 * Which side of the line he crouches on: away from where the throw is aimed (the stone runs from its start towards the
 * broom), so it never runs back across him; with the broom on the line, the side with more ice. Fixed by the aim, so
 * he never switches sides during a delivery.
 */
export function curlCaptainRight(startX: number, broomX: number): boolean {
  const d = broomX - startX;
  if (Math.abs(d) > 4) return d < 0;
  return startX < -40;
}

function captain(ctx: CanvasRenderingContext2D, s: CurlingState, startX: number, v: CurlView, broomX: number): void {
  const place = curlCaptainPlace(s, startX, v, broomX);
  if (!place || place.alpha <= 0) return;
  const img = sportsSprite("curling", place.pose, true);
  if (!img) return;
  ctx.save();
  ctx.globalAlpha = place.alpha;
  if (place.flip) {
    ctx.translate(place.x + place.w, place.y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, place.w, place.h);
  } else ctx.drawImage(img, place.x, place.y, place.w, place.h);
  ctx.restore();
}

/* ================================= Frame ================================= */

/** curlRev 2: the straight line the stone is released along, from its start to the broom (dashed gold, fading out). */
function aimLine(ctx: CanvasRenderingContext2D, fromX: number, toX: number, toY: number, v: CurlView): void {
  const a = curlProject(fromX, HOG_NEAR, v);
  const b = curlProject(toX, toY, v);
  const g = ctx.createLinearGradient(a.sx, a.sy, b.sx, b.sy);
  g.addColorStop(0, "#FFE29AE6");
  g.addColorStop(1, "#FFE29A40");
  ctx.save();
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy - 4);
  ctx.lineTo(b.sx, b.sy);
  ctx.stroke();
  ctx.restore();
}

/** curlRev 3: the faint aim line, the first third of the path (sheet cm), fading as it runs on. */
function aimPath(ctx: CanvasRenderingContext2D, path: readonly { x: number; y: number }[], v: CurlView): void {
  if (path.length < 2) return;
  const pts = path.map((p) => curlProject(p.x, p.y, v));
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  const g = ctx.createLinearGradient(a.sx, a.sy, b.sx, b.sy);
  g.addColorStop(0, "#FFF3C4C0");
  g.addColorStop(1, "#FFF3C410");
  ctx.save();
  ctx.strokeStyle = g;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy - 4);
  for (let k = 1; k < pts.length; k += 2) ctx.lineTo(pts[k]!.sx, pts[k]!.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.stroke();
  ctx.restore();
}

/**
 * curlRev 3's weight meter: the bar (light at the bottom, heavy at the top), the draw zone (gold, "HOUSE") with its tee
 * mark, the live swipe's fill and the last release's tick.
 */
function weightMeter(ctx: CanvasRenderingContext2D, aim: CurlAim, aiming: boolean, rev = 3): void {
  const m = curlMeterFor(rev);
  const v4 = rev >= 4;
  const my = (w: number) => curlMeterY(w, m);
  ctx.save();
  ctx.fillStyle = "#05080FD9";
  ctx.strokeStyle = "#FFFFFF33";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6, 6);
  ctx.fill();
  ctx.stroke();
  ctx.font = "800 10px Archivo, system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  {
    const label = v4 ? "POWER" : "WEIGHT";
    const lw = ctx.measureText(label).width + 12;
    const right = m.x + m.w + 3;
    ctx.fillStyle = "#05080FD9";
    ctx.beginPath();
    ctx.roundRect(right - lw, m.y - 24, lw, 16, 8);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = "#F3F1EC";
    ctx.fillText(label, right - lw / 2, m.y - 12.5);
  }
  const zone = aim.zone;
  if (zone) {
    const top = my(zone.hi);
    const bottom = my(zone.lo);
    ctx.fillStyle = "#E8B53A59";
    ctx.fillRect(m.x, top, m.w, bottom - top);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(m.x + 0.75, top + 0.75, m.w - 1.5, bottom - top - 1.5);
    const tee = my(zone.tee);
    ctx.fillStyle = GOLD_HI;
    ctx.fillRect(m.x - 4, tee - 1, m.w + 8, 2);
    const lw = ctx.measureText("HOUSE").width + 10;
    ctx.fillStyle = "#05080FD9";
    ctx.beginPath();
    ctx.roundRect(m.x - 7 - lw, tee - 8, lw, 16, 8);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = GOLD_HI;
    ctx.fillText("HOUSE", m.x - 7 - lw / 2, tee + 3.5);
  }
  const fill = aiming ? (aim.swipe ?? aim.keyWeight ?? null) : null;
  if (fill != null) {
    const y = my(fill);
    const inZone = zone && fill >= zone.lo && fill <= zone.hi;
    ctx.fillStyle = inZone ? "#FFE29ACC" : "#F3F1EC99";
    ctx.fillRect(m.x + 3, y, m.w - 6, m.y + m.h - y);
  }
  if (v4 && aiming && aim.keyWeight != null) {
    // curlRev 4: the set weight's marker, a bright handle across the bar that stays where it was set.
    const y = my(aim.keyWeight);
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#05080F";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(m.x - 6, y - 3.5, m.w + 12, 7, 3.5);
    ctx.fill();
    ctx.stroke();
  } else if (v4 && aiming) {
    // Nothing set yet: a quiet prompt down the bar.
    ctx.save();
    ctx.translate(m.x + m.w / 2, m.y + m.h / 2);
    ctx.font = "700 9px Archivo, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#F3F1ECB0";
    ctx.fillText("TAP", 0, -4);
    ctx.fillText("ME", 0, 7);
    ctx.restore();
  }
  if (aim.lastRelease != null) {
    const y = my(aim.lastRelease);
    ctx.fillStyle = "#F3F1EC";
    ctx.beginPath();
    ctx.moveTo(m.x + m.w + 2, y);
    ctx.lineTo(m.x + m.w + 9, y - 5);
    ctx.lineTo(m.x + m.w + 9, y + 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** curlRev 2: the slide arrows either side of the waiting stone (drag it along the hog line). */
function slideArrows(ctx: CanvasRenderingContext2D, x: number, v: CurlView): void {
  const p = curlProject(x, HOG_NEAR, v);
  const off = STONE_R * p.k + 9;
  ctx.fillStyle = "#FFE29AD9";
  for (const side of [-1, 1]) {
    const tx = p.sx + side * off;
    ctx.beginPath();
    ctx.moveTo(tx + side * 7, p.sy - 5);
    ctx.lineTo(tx, p.sy - 10);
    ctx.lineTo(tx, p.sy);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * One frame in world px (curlRev 1: 390 × 720; curlRev 2: 390 × 540): the cached arena and sheets, the stones, the
 * broom, the HUD chips and the inset.
 */
export function drawCurling(ctx: CanvasRenderingContext2D, s: CurlingState, aim: CurlAim | null, look: GameLook = NO_LOOK): void {
  L = look;
  try {
    drawCurlingLooked(ctx, s, aim);
  } finally {
    L = NO_LOOK;
  }
}

function drawCurlingLooked(ctx: CanvasRenderingContext2D, s: CurlingState, aim: CurlAim | null): void {
  const v = curlViewFor(s.rev);
  const layer = staticLayer(ctx, v);
  if (layer) ctx.drawImage(layer, 0, 0, v.w, v.h);
  else paintStatic(ctx, v);
  const startX = v.rev >= 2 ? (aim?.startX ?? 0) : 0;
  if (s.phase === CURL_AIM && aim && s.rev >= 3) {
    if (aim.path) aimPath(ctx, aim.path, v);
  } else if (s.phase === CURL_AIM && aim && v.rev >= 2) aimLine(ctx, startX, aim.broomX, aim.broomY, v);
  // Stones, far ones first.
  const order = s.x.map((_, k) => k).filter((k) => s.live[k]).sort((a, b) => s.y[a]! - s.y[b]!);
  for (const k of order) stone(ctx, s.x[k]! / CU, s.y[k]! / CU, s.team[k] === TEAM_MINE, k * 7919 + s.seed, s.vx[k] !== 0 || s.vy[k] !== 0, v);
  // Captain Joulz beside the stone's line (behind the waiting stone, or letting go of the thrown one).
  if (aim) captain(ctx, s, startX, v, aim.broomX);
  // The stone waiting on the near hog line, and the turn and broom while aiming.
  if (s.phase === CURL_AIM && aim) {
    broom(ctx, aim.broomX, aim.broomY, v);
    stone(ctx, startX, HOG_NEAR, true, s.thrown * 31 + s.seed, false, v);
    turnMark(ctx, aim.turn, v, startX);
    if (v.rev >= 2) slideArrows(ctx, startX, v);
  }
  // Sweepers' brooms working the ice in front of the moving stone (curlRev 2: on the side being brushed).
  const brushing = v.rev >= 2 ? (s.bend ?? 0) !== 0 || s.sweep > 0 : s.sweep > 0;
  if (s.phase === CURL_TRAVEL && s.active >= 0 && brushing && s.live[s.active]) {
    const side = v.rev >= 2 ? Math.sign(s.bend ?? 0) : 0;
    const ahead = s.y[s.active]! / CU - 60;
    const p = curlProject(s.x[s.active]! / CU + side * 26, ahead, v);
    const wob = Math.sin(s.tick * 0.9) * 4 * p.k * 10;
    ctx.fillStyle = "#F3F1ECCC";
    for (const pair of side === 0 ? [-1, 1] : [side * 0.4, side * 1.4]) {
      ctx.beginPath();
      ctx.ellipse(p.sx + pair * 9 * p.k * 10 * 0.25 + wob * Math.sign(pair), p.sy, Math.max(2, 9 * p.k), Math.max(0.8, 2.4 * p.k), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // HUD chips (top left): the stone and the brush (sweep) meter.
  stoneChip(ctx, 10, 8, `STONE ${Math.min(CURLING_STONES, s.thrown + (s.phase === CURL_AIM ? 1 : 0))}/${CURLING_STONES}`);
  if (s.phase === CURL_TRAVEL) {
    const bend = s.bend ?? 0;
    const label = v.rev >= 2 ? (bend < 0 ? "BRUSH ◀" : bend > 0 ? "BRUSH ▶" : "BRUSH") : "SWEEP";
    chip(ctx, 10, 50, label, 170);
    ctx.fillStyle = "#FFFFFF26";
    ctx.beginPath();
    ctx.roundRect(100, 60, 70, 8, 4);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.roundRect(100, 60, Math.max(0.01, (70 * Math.min(s.sweep, SWEEP_MAX)) / SWEEP_MAX), 8, 4);
    ctx.fill();
  }
  inset(ctx, s, aim);
  // curlRev 3: the weight meter (while aiming and as the stone travels, with the last release's tick).
  if (aim && s.rev >= 3 && s.phase !== CURL_DONE) weightMeter(ctx, aim, s.phase === CURL_AIM, s.rev);
  // The swipe's weight pill, low on the lane (curlRev 1 and 2).
  if (aim?.swipe != null && s.phase === CURL_AIM && s.rev < 3) {
    const text = `${curlWeightWord(aim.swipe)} · ${Math.round(aim.swipe / 10)}%`;
    ctx.font = "700 12px Archivo, system-ui, sans-serif";
    const w = ctx.measureText(text).width + 24;
    chip(ctx, CX - w / 2, v.h - (v.rev >= 2 ? 150 : 120), text, w);
  }
}

/**
 * The scenery beyond the world (display only): the world's own static layer (the arena, the floor and the dimmed
 * neighbouring sheets, which already run past the world's edges) carried on out to the box, so the ice and the
 * arena continue across every edge with no seam, then settling darker below the world.
 */
export function curlingScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView, rev: number | null = 1, look: GameLook = NO_LOOK): void {
  const v = curlViewFor(rev);
  L = look;
  try {
    ctx.fillStyle = sheetPal().floor;
    ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
    paintStatic(ctx, v);
  } finally {
    L = NO_LOOK;
  }
  const below = view.bottom - v.h;
  if (below > 0.01) {
    const g = ctx.createLinearGradient(0, v.h, 0, view.bottom);
    g.addColorStop(0, "rgba(10,16,28,0)");
    g.addColorStop(1, "rgba(10,16,28,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(view.left, v.h, view.right - view.left, below);
  }
}

/** The canvas background behind the world. */
export const CURLING_BG = "#05070C";

export type { CanvasSize };

/** One stone alone at a sheet point in a look (checks: a skin stays inside the default stone's outline). */
export function paintCurlingStoneIn(look: GameLook, ctx: CanvasRenderingContext2D, x: number, y: number, mine: boolean, rev: number): void {
  L = look;
  try {
    stone(ctx, x, y, mine, 1, false, curlViewFor(rev));
  } finally {
    L = NO_LOOK;
  }
}
