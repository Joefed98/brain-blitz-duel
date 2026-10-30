/**
 * Curling's art (display only; never imported by the sim or the server): the broadcast view from behind the thrower,
 * looking down the whole sheet in perspective to the far house, the near house cut by the bottom of the screen; a
 * top-down inset of the far house (top right) shows exactly where every stone sits.
 *
 * The arena (roof lights, the lit gallery, the boards' LED strips, the neighbouring sheets, the pebbled ice and the
 * lights' reflections on it) is painted once per canvas size into a cached layer; each frame draws only the stones,
 * the broom, the HUD chips and the inset over it. No curl line is ever drawn: reading the ice is the game.
 */
import type { CanvasSize } from "./engine";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { artHash } from "./art.renderer";
import {
  BACK_FAR,
  BACK_NEAR,
  BUTTON_R,
  CU,
  CURL_AIM,
  CURL_TRAVEL,
  CURLING_H,
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

/** A sheet point (cm) on screen (world px); k is the px per cm across at that depth. */
export function curlProject(x: number, y: number): { sx: number; sy: number; k: number } {
  const z = Math.max(60, CAM_Y - y);
  return { sx: CX + (x * FOCAL) / z, sy: HORIZON + HF / z, k: FOCAL / z };
}

/** A screen point (world px) back on the sheet (cm); null above the far boards. */
export function curlUnproject(sx: number, sy: number): { x: number; y: number } | null {
  if (sy <= HORIZON + 1) return null;
  const z = HF / (sy - HORIZON);
  return { x: ((sx - CX) * z) / FOCAL, y: CAM_Y - z };
}

/** The far house on screen (world px): its centre and its across-radius, for the stage's broom drag. */
export const CURL_FAR_HOUSE = (() => {
  const c = curlProject(0, 0);
  return { sx: c.sx, sy: c.sy, rx: HOUSE_R * c.k, top: curlProject(0, -HOUSE_R).sy - 18, bottom: curlProject(0, HOUSE_R).sy + 26 };
})();

/** The inset (top right): its box (world px) and its scale (px a cm), centred on the far tee. */
export const CURL_INSET = { x: 262, y: 10, w: 120, h: 120, scale: 120 / 2 / 205 };

/** An inset point (world px) as sheet cm, or null outside the inset. */
export function curlInsetToSheet(px: number, py: number): { x: number; y: number } | null {
  const i = CURL_INSET;
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
const LED = "#3FD6FF";

/* ============================ The static layer ============================ */

let cache: { canvas: HTMLCanvasElement; w: number; h: number } | null = null;

/** One sheet's ice, rings and lines, centred `offset` cm across. */
function sheet(ctx: CanvasRenderingContext2D, offset: number, dim: number): void {
  const near = BACK_NEAR + 300;
  const far = BACK_FAR - 120;
  const q = [curlProject(offset - SHEET_HALF_W, far), curlProject(offset + SHEET_HALF_W, far), curlProject(offset + SHEET_HALF_W, near), curlProject(offset - SHEET_HALF_W, near)];
  const g = ctx.createLinearGradient(0, q[0]!.sy, 0, CURLING_H);
  g.addColorStop(0, ICE_FAR);
  g.addColorStop(0.35, "#DCE7EF");
  g.addColorStop(1, ICE);
  ctx.save();
  ctx.beginPath();
  q.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy)));
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // Both houses, their rings about this sheet's centre line.
  {
    for (const cy of [0, TEE_NEAR]) {
      for (const [r, fill] of [
        [HOUSE_R, RING_BLUE],
        [EIGHT_FOOT_R, ICE],
        [FOUR_FOOT_R, RING_RED],
        [BUTTON_R, ICE],
      ] as const) {
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const p = curlProject(offset + Math.cos(a) * r, cy + Math.sin(a) * r);
          if (i === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      }
    }
  }
  const across = (y: number, colour: string, w: number) => {
    const a = curlProject(offset - SHEET_HALF_W, y);
    const b = curlProject(offset + SHEET_HALF_W, y);
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(0.5, w * a.k);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  };
  across(0, "#2B2B33", 1.3);
  across(BACK_FAR, "#2B2B33", 1.3);
  across(TEE_NEAR, "#2B2B33", 1.3);
  across(HOG_FAR, RING_RED, 10);
  across(HOG_NEAR, RING_RED, 10);
  // The centre line.
  const c0 = curlProject(offset, BACK_FAR - 120);
  const c1 = curlProject(offset, near);
  ctx.strokeStyle = "#2B2B3399";
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
    const p = curlProject(x, y);
    ctx.fillStyle = i % 3 ? "#FFFFFF55" : "#9FB3C455";
    ctx.fillRect(p.sx, p.sy, Math.max(0.5, p.k * 1.4), Math.max(0.5, p.k * 1.1));
  }
  // The roof lights' reflections: long soft streaks down the ice.
  for (const lx of [-120, 120]) {
    for (const ly of [300, 1300, 2300]) {
      const p = curlProject(offset + lx, ly);
      const r = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, 70 * p.k + 6);
      r.addColorStop(0, "#FFFFFFAA");
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
    ctx.fillRect(0, 0, CURLING_W, CURLING_H);
  }
  ctx.restore();
  // The side boards and their LED strips.
  for (const side of [-1, 1]) {
    const a = curlProject(offset + side * (SHEET_HALF_W + 4), far);
    const b = curlProject(offset + side * (SHEET_HALF_W + 4), near);
    ctx.strokeStyle = "#1A2230";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = LED;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = dim > 0 ? "#3FD6FF88" : LED;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy - 1.5);
    ctx.lineTo(b.sx, b.sy - 1.5);
    ctx.stroke();
    ctx.restore();
  }
}

/** The arena above the far boards: the roof, its lights and the lit spectator gallery. */
function arena(ctx: CanvasRenderingContext2D, top: number, bottom: number): void {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, "#05070C");
  g.addColorStop(0.55, "#0C1320");
  g.addColorStop(1, "#18243A");
  ctx.fillStyle = g;
  ctx.fillRect(-400, top, CURLING_W + 800, bottom - top);
  // Roof trusses and their lights.
  ctx.strokeStyle = "#1C2638";
  ctx.lineWidth = 1;
  for (let i = -6; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 40, top);
    ctx.lineTo(CX + (i * 40 - CX) * 0.35, bottom - 70);
    ctx.stroke();
  }
  for (let row = 0; row < 3; row++) {
    const y = top + 18 + row * 26 + (bottom - top - 200) * 0.2;
    for (let i = 0; i < 9 - row; i++) {
      const x = CX + (i - (8 - row) / 2) * (44 - row * 9);
      const r = ctx.createRadialGradient(x, y, 0, x, y, 16 - row * 3);
      r.addColorStop(0, "#FFFBEA");
      r.addColorStop(0.25, "#FFF3C4AA");
      r.addColorStop(1, "#FFF3C400");
      ctx.fillStyle = r;
      ctx.fillRect(x - 18, y - 18, 36, 36);
    }
  }
  // The gallery: tiers of seated spectators under warm balcony light.
  const gTop = bottom - 64;
  const gal = ctx.createLinearGradient(0, gTop, 0, bottom);
  gal.addColorStop(0, "#2A2016");
  gal.addColorStop(1, "#4A3A26");
  ctx.fillStyle = gal;
  ctx.fillRect(-400, gTop, CURLING_W + 800, bottom - gTop);
  const tones = ["#C9B79A", "#7E91B5", "#B85C4F", "#E3D6BC", "#4F6B8F", "#D9A441", "#8A8A8A"];
  for (let tier = 0; tier < 5; tier++) {
    const y = gTop + 8 + tier * 11;
    for (let i = 0; i < 70; i++) {
      const h = artHash(i, tier + 3);
      if (h % 7 === 0) continue;
      const x = -40 + i * 7 + (tier % 2) * 3.5;
      ctx.fillStyle = tones[h % tones.length]!;
      ctx.globalAlpha = 0.55 + tier * 0.08;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 2.2, y + 1.6, 4.4, 4.5);
    }
  }
  ctx.globalAlpha = 1;
  // The balcony rail's light line.
  ctx.fillStyle = "#FFD9945A";
  ctx.fillRect(-400, gTop - 2, CURLING_W + 800, 2);
  // The far boards and their LED strip.
  ctx.fillStyle = "#121A28";
  ctx.fillRect(-400, bottom - 6, CURLING_W + 800, 6);
  ctx.save();
  ctx.shadowColor = LED;
  ctx.shadowBlur = 8;
  ctx.fillStyle = LED;
  ctx.fillRect(-400, bottom - 4, CURLING_W + 800, 1.4);
  ctx.restore();
}

function paintStatic(ctx: CanvasRenderingContext2D): void {
  const farEdge = curlProject(0, BACK_FAR - 120).sy;
  arena(ctx, -200, farEdge);
  // The floor between sheets.
  ctx.fillStyle = "#0E1520";
  ctx.beginPath();
  ctx.moveTo(-400, farEdge);
  ctx.lineTo(CURLING_W + 400, farEdge);
  ctx.lineTo(CURLING_W + 400, CURLING_H + 200);
  ctx.lineTo(-400, CURLING_H + 200);
  ctx.closePath();
  ctx.fill();
  for (const off of [-2 * SHEET_PITCH, 2 * SHEET_PITCH, -SHEET_PITCH, SHEET_PITCH]) sheet(ctx, off, 0.42);
  sheet(ctx, 0, 0);
}

function staticLayer(ctx: CanvasRenderingContext2D): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const t = ctx.getTransform();
  const w = Math.max(1, Math.round(CURLING_W * t.a));
  const h = Math.max(1, Math.round(CURLING_H * t.d));
  if (cache && cache.w === w && cache.h === h) return cache.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) return null;
  c.scale(w / CURLING_W, h / CURLING_H);
  paintStatic(c);
  cache = { canvas, w, h };
  return canvas;
}

/* ================================ Stones ================================ */

/** A granite stone at a sheet point: a short cylinder with a speckled top and its handle (gold or red). */
function stone(ctx: CanvasRenderingContext2D, x: number, y: number, mine: boolean, seed: number, moving: boolean): void {
  const p = curlProject(x, y);
  const rx = STONE_R * p.k;
  const ry = Math.max(rx * 0.22, (STONE_R * HF) / Math.max(60, CAM_Y - y) ** 2);
  const lift = Math.max(1.2, 11 * p.k);
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

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, w: number): void {
  ctx.fillStyle = "#0A0F18CC";
  ctx.strokeStyle = "#FFFFFF22";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 22, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#F3F1EC";
  ctx.font = "700 11px Archivo, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 10, y + 11.5);
}

function inset(ctx: CanvasRenderingContext2D, s: CurlingState, aim: CurlAim | null): void {
  const i = CURL_INSET;
  const cx = i.x + i.w / 2;
  const cy = i.y + i.h / 2;
  ctx.save();
  ctx.fillStyle = "#0A0F18E6";
  ctx.strokeStyle = "#FFFFFF2A";
  ctx.beginPath();
  ctx.roundRect(i.x, i.y, i.w, i.h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.clip();
  ctx.fillStyle = "#DCE7EF";
  ctx.fillRect(i.x, i.y, i.w, i.h);
  for (const [r, fill] of [
    [HOUSE_R, RING_BLUE],
    [EIGHT_FOOT_R, "#F2F6F9"],
    [FOUR_FOOT_R, RING_RED],
    [BUTTON_R, "#F2F6F9"],
  ] as const) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx, cy, r * i.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#2B2B3366";
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
    ctx.fillStyle = "#4C515B";
    ctx.beginPath();
    ctx.arc(x, y, STONE_R * i.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mine ? GOLD : RED;
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

/** What the stage shows over the sim (presentation only): the broom, the turn, the swipe's weight. */
export interface CurlAim {
  broomX: number;
  broomY: number;
  /** 0 In, 1 Out. */
  turn: number;
  /** A swipe in progress: its weight so far (1…1000), else null. */
  swipe: number | null;
}

/** The weight's words for the swipe pill. */
export function curlWeightWord(w: number): string {
  if (w < 270) return "Light";
  if (w < 330) return "Draw";
  if (w < 400) return "Firm";
  return "Takeout";
}

function broom(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const p = curlProject(x, y);
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

function turnMark(ctx: CanvasRenderingContext2D, turn: number): void {
  const p = curlProject(0, HOG_NEAR + 40);
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

/* ================================= Frame ================================= */

/** One frame in world px (390 × 720): the cached arena and sheets, the stones, the broom, the HUD chips and the inset. */
export function drawCurling(ctx: CanvasRenderingContext2D, s: CurlingState, aim: CurlAim | null): void {
  const layer = staticLayer(ctx);
  if (layer) ctx.drawImage(layer, 0, 0, CURLING_W, CURLING_H);
  else paintStatic(ctx);
  // Stones, far ones first.
  const order = s.x.map((_, k) => k).filter((k) => s.live[k]).sort((a, b) => s.y[a]! - s.y[b]!);
  for (const k of order) stone(ctx, s.x[k]! / CU, s.y[k]! / CU, s.team[k] === TEAM_MINE, k * 7919 + s.seed, s.vx[k] !== 0 || s.vy[k] !== 0);
  // The stone waiting on the near hog line, and the turn and broom while aiming.
  if (s.phase === CURL_AIM && aim) {
    broom(ctx, aim.broomX, aim.broomY);
    stone(ctx, 0, HOG_NEAR, true, s.thrown * 31 + s.seed, false);
    turnMark(ctx, aim.turn);
  }
  // Sweepers' brooms working the ice in front of the moving stone.
  if (s.phase === CURL_TRAVEL && s.active >= 0 && s.sweep > 0 && s.live[s.active]) {
    const ahead = s.y[s.active]! / CU - 60;
    const p = curlProject(s.x[s.active]! / CU, ahead);
    const wob = Math.sin(s.tick * 0.9) * 4 * p.k * 10;
    ctx.fillStyle = "#F3F1ECCC";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(p.sx + side * 9 * p.k * 10 * 0.25 + wob * side, p.sy, Math.max(2, 9 * p.k), Math.max(0.8, 2.4 * p.k), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // HUD chips (top left): the stone and the sweep meter.
  chip(ctx, 10, 10, `STONE ${Math.min(CURLING_STONES, s.thrown + (s.phase === CURL_AIM ? 1 : 0))}/${CURLING_STONES}`, 86);
  if (s.phase === CURL_TRAVEL) {
    chip(ctx, 10, 38, "SWEEP", 112);
    ctx.fillStyle = "#FFFFFF22";
    ctx.fillRect(64, 46, 46, 6);
    ctx.fillStyle = GOLD;
    ctx.fillRect(64, 46, (46 * Math.min(s.sweep, SWEEP_MAX)) / SWEEP_MAX, 6);
  }
  inset(ctx, s, aim);
  // The swipe's weight pill, low on the lane.
  if (aim?.swipe != null && s.phase === CURL_AIM) {
    const text = `${curlWeightWord(aim.swipe)} · ${Math.round(aim.swipe / 10)}%`;
    ctx.font = "700 12px Archivo, system-ui, sans-serif";
    const w = ctx.measureText(text).width + 24;
    chip(ctx, CX - w / 2, CURLING_H - 120, text, w);
  }
}

/** The scenery beyond the world (display only): the arena's dark above, the sheet's floor below and to the sides. */
export function curlingScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const farEdge = curlProject(0, BACK_FAR - 120).sy;
  ctx.fillStyle = "#05070C";
  ctx.fillRect(view.left, view.top, view.right - view.left, farEdge - view.top);
  ctx.fillStyle = "#0E1520";
  ctx.fillRect(view.left, farEdge, view.right - view.left, view.bottom - farEdge);
}

/** The canvas background behind the world. */
export const CURLING_BG = "#05070C";

export type { CanvasSize };
