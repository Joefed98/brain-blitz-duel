/**
 * Bastion's art, bastionRev 2 (display only; never imported by the sim or the server). First person from a gun turret
 * behind a stone wall at dusk: the sky, the low sun, the far hills, the three lanes running to the vanishing point, the
 * haze on the horizon and the wall's parapet are painted once per canvas size (deviceLayer); per frame the tanks (each
 * hull and turret drawn exactly on the sim's collision rectangles, bastionTankRects, the weak spot's amber glow on its
 * own rectangle, the health pips above), the shells in flight, the landings, the crosshair, the gun's barrel and the HUD
 * (wave, base, shells and the reload bar with its needle and green zone).
 *
 * `bastionScene` carries the same dusk out past the world's sides and below it on the play screen, so the edges have
 * no seam (and on the computer layout the scenery extends to the sides).
 */
import { reducedMotion } from "./art.renderer";
import { deviceLayer } from "./cache.renderer";
import { arcadeFx, type ArcadeFxSpec } from "./arcadeFx.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import type { CanvasSize } from "./engine";
import {
  bastionNeedle,
  bastionScale256,
  bastionTankGame,
  bastionTankRects,
  bastionTankScore,
  bastionWave,
  BT2_BASE,
  BT2_FAR,
  BT2_HORIZON_Y,
  BT2_HP,
  BT2_LANE_X,
  BT2_MAG,
  BT2_VP_X,
  BT2_WALL_Y,
  BT2_WAVE_COUNT,
  BT2_WAVE_START,
  BT2_WORLD_H,
  BT2_WORLD_W,
  BT2_ZONE_W,
  type BastionTankState,
  type Bt2Impact,
  type Bt2Rect,
  type Bt2Tank,
} from "./bastionTank";

export const BT2_ART_BG = "#120E1C";
const W = BT2_WORLD_W;
const H = BT2_WORLD_H;
const MONO = "'Duelz Mono', 'JetBrains Mono', ui-monospace, monospace";
const DISPLAY = "'Archivo', 'Saira', system-ui, sans-serif";
/** Where the barrel's breech sits (below the world's bottom edge) and its muzzle length. */
const GUN_X = BT2_VP_X;
const GUN_Y = H + 40;
const GUN_LEN = 150;
const AMBER = "#FFB43A";
const ACTION_RED = "#FF4D4D";

/** Each type's paint: hull, hull shade, turret, track. */
const LIVERY = [
  { hull: "#9C8A5E", shade: "#5E5236", turret: "#B09C6A", track: "#2A251C" },
  { hull: "#5E6B3E", shade: "#363E22", turret: "#6E7C48", track: "#1E2214" },
  { hull: "#4A5058", shade: "#262A30", turret: "#5A6170", track: "#15171B" },
] as const;

interface Extent {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/* -------------------------------------------------------------- backdrop */

/** The dusk sky, hills, field, lanes and the wall, over any extent (world units). */
function paintBackdrop(ctx: CanvasRenderingContext2D, e: Extent): void {
  const wx = e.x1 - e.x0;
  // Sky: deep violet overhead to a burning orange at the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, BT2_HORIZON_Y);
  sky.addColorStop(0, "#140F2A");
  sky.addColorStop(0.45, "#3B1F4A");
  sky.addColorStop(0.8, "#B4485A");
  sky.addColorStop(1, "#F49A4C");
  ctx.fillStyle = sky;
  ctx.fillRect(e.x0, e.y0, wx, BT2_HORIZON_Y - e.y0 + 1);
  // The low sun, half behind the hills, with its bloom.
  const sun = ctx.createRadialGradient(258, BT2_HORIZON_Y - 6, 4, 258, BT2_HORIZON_Y - 6, 120);
  sun.addColorStop(0, "rgba(255,236,190,0.95)");
  sun.addColorStop(0.18, "rgba(255,190,110,0.6)");
  sun.addColorStop(1, "rgba(255,140,80,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(e.x0, BT2_HORIZON_Y - 140, wx, 150);
  ctx.fillStyle = "#FFE7B8";
  ctx.beginPath();
  ctx.arc(258, BT2_HORIZON_Y - 4, 15, Math.PI, 0);
  ctx.fill();
  // A few streaks of cloud.
  ctx.fillStyle = "rgba(255,170,140,0.18)";
  for (const [x, y, w] of [
    [40, 120, 120],
    [210, 96, 150],
    [-90, 160, 110],
    [330, 150, 140],
  ] as const) {
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x + 20, y + 6, w * 0.6, 2);
  }
  // Far hills: two ridges in cooling silhouettes.
  ctx.fillStyle = "#4A2440";
  ctx.beginPath();
  ctx.moveTo(e.x0, BT2_HORIZON_Y);
  for (let x = Math.floor(e.x0 / 10) * 10; x <= e.x1 + 10; x += 10) ctx.lineTo(x, BT2_HORIZON_Y - 14 - 9 * Math.sin(x / 47) - 6 * Math.sin(x / 19 + 1));
  ctx.lineTo(e.x1, BT2_HORIZON_Y);
  ctx.fill();
  ctx.fillStyle = "#2E1830";
  ctx.beginPath();
  ctx.moveTo(e.x0, BT2_HORIZON_Y + 1);
  for (let x = Math.floor(e.x0 / 10) * 10; x <= e.x1 + 10; x += 10) ctx.lineTo(x, BT2_HORIZON_Y - 5 - 5 * Math.sin(x / 31 + 2));
  ctx.lineTo(e.x1, BT2_HORIZON_Y + 1);
  ctx.fill();
  // The field: dusk-lit earth, darkening toward the wall.
  const field = ctx.createLinearGradient(0, BT2_HORIZON_Y, 0, BT2_WALL_Y);
  field.addColorStop(0, "#5A3A3A");
  field.addColorStop(0.25, "#3C2E2A");
  field.addColorStop(1, "#1E1A16");
  ctx.fillStyle = field;
  ctx.fillRect(e.x0, BT2_HORIZON_Y, wx, BT2_WALL_Y - BT2_HORIZON_Y + 1);
  // The lanes: worn tracks converging on the vanishing point, with their edges.
  for (let lane = 0; lane < 3; lane++) {
    const lx = BT2_LANE_X[lane]!;
    const half = 58;
    ctx.fillStyle = "rgba(120,88,64,0.32)";
    ctx.beginPath();
    ctx.moveTo(BT2_VP_X + ((lx - half) * 0.06), BT2_HORIZON_Y + 2);
    ctx.lineTo(BT2_VP_X + ((lx + half) * 0.06), BT2_HORIZON_Y + 2);
    ctx.lineTo(BT2_VP_X + lx + half, BT2_WALL_Y);
    ctx.lineTo(BT2_VP_X + lx - half, BT2_WALL_Y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,190,120,0.16)";
  ctx.lineWidth = 1.2;
  for (const bx of [-192, -64, 64, 192]) {
    ctx.beginPath();
    ctx.moveTo(BT2_VP_X + bx * 0.06, BT2_HORIZON_Y + 2);
    ctx.lineTo(BT2_VP_X + bx, BT2_WALL_Y);
    ctx.stroke();
  }
  // Depth marks across the field (every 160 depth units), fading with distance.
  for (let z = 160; z < BT2_FAR + 600; z += 160) {
    const y = BT2_HORIZON_Y + Math.floor(((BT2_WALL_Y - BT2_HORIZON_Y) * bastionScale256(z * 256)) / 256);
    ctx.fillStyle = `rgba(255,200,150,${0.05 + 0.05 * (1 - z / (BT2_FAR + 600))})`;
    ctx.fillRect(e.x0, y, wx, 1);
  }
  // Scrub and rocks scattered on the field (fixed, symmetric-free).
  for (let i = 0; i < 40; i++) {
    const z = 80 + ((i * 397) % 1400);
    const s = bastionScale256(z * 256) / 256;
    const y = BT2_HORIZON_Y + (BT2_WALL_Y - BT2_HORIZON_Y) * s;
    const side = i % 2 ? 1 : -1;
    const off = 200 + ((i * 131) % 220);
    const x = BT2_VP_X + side * off * s;
    ctx.fillStyle = i % 3 ? "rgba(20,14,12,0.55)" : "rgba(60,40,30,0.6)";
    ctx.beginPath();
    ctx.ellipse(x, y, 7 * s + 1, 3 * s + 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Horizon haze where the tanks roll out.
  const haze = ctx.createLinearGradient(0, BT2_HORIZON_Y - 10, 0, BT2_HORIZON_Y + 90);
  haze.addColorStop(0, "rgba(244,154,76,0.0)");
  haze.addColorStop(0.25, "rgba(232,140,96,0.38)");
  haze.addColorStop(1, "rgba(120,70,70,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(e.x0, BT2_HORIZON_Y - 10, wx, 100);
  paintWall(ctx, e);
}

/** The parapet: the wall's lit top edge at depth 0, then its stone face to the bottom of the extent. */
function paintWall(ctx: CanvasRenderingContext2D, e: Extent): void {
  const wx = e.x1 - e.x0;
  const top = BT2_WALL_Y;
  const bottom = Math.max(H, e.y1);
  const face = ctx.createLinearGradient(0, top, 0, H);
  face.addColorStop(0, "#5C4C44");
  face.addColorStop(0.12, "#3A302C");
  face.addColorStop(1, "#1C1715");
  ctx.fillStyle = face;
  ctx.fillRect(e.x0, top, wx, bottom - top);
  // Stone courses.
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  let row = 0;
  for (let y = top + 18; y < bottom; y += 26, row++) {
    ctx.beginPath();
    ctx.moveTo(e.x0, y);
    ctx.lineTo(e.x1, y);
    ctx.stroke();
    const off = row % 2 ? 0 : 33;
    for (let x = Math.floor((e.x0 - off) / 66) * 66 + off; x < e.x1; x += 66) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 26);
      ctx.stroke();
    }
  }
  // The sunset catching the parapet's lip.
  ctx.fillStyle = "#C9875A";
  ctx.fillRect(e.x0, top, wx, 3);
  ctx.fillStyle = "rgba(255,200,140,0.25)";
  ctx.fillRect(e.x0, top + 3, wx, 4);
}

/* ----------------------------------------------------------------- tanks */

function rect(ctx: CanvasRenderingContext2D, r: Bt2Rect): void {
  ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
}

/** One tank on its rectangles: shadow, tracks, hull, turret, muzzle, the weak spot's glow, a hit's flash. */
export function paintTank(ctx: CanvasRenderingContext2D, kind: number, lane: number, z: number, hp: number, flash: number, tick: number, still: boolean): void {
  const r = bastionTankRects(kind, lane, z);
  const s = r.s256 / 256;
  const live = LIVERY[kind]!;
  const [hx0, hy0, hx1, hy1] = r.hull;
  const hw = hx1 - hx0;
  const hh = hy1 - hy0;
  // Shadow on the ground (a soft ellipse along the tracks' foot, inside the hull's rectangle).
  const sr = Math.max(1, hh * 0.12);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(r.cx, hy1 - sr, hw / 2 + 1, sr, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tracks: the lower third, the full width, with road wheels.
  const ty = hy1 - Math.max(1, Math.round(hh * 0.38));
  ctx.fillStyle = live.track;
  ctx.fillRect(hx0, ty, hw, hy1 - ty);
  if (hw > 18) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    const n = kind === 2 ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const wx = hx0 + ((i + 0.5) * hw) / n;
      ctx.beginPath();
      ctx.arc(wx, (ty + hy1) / 2, Math.max(1, (hy1 - ty) * 0.32), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Hull: the glacis plate, lit from the low sun on the right.
  const g = ctx.createLinearGradient(hx0, 0, hx1, 0);
  g.addColorStop(0, live.shade);
  g.addColorStop(0.65, live.hull);
  g.addColorStop(1, "#D9A070");
  ctx.fillStyle = g;
  ctx.beginPath();
  const inset = Math.max(1, Math.round(hw * 0.08));
  ctx.moveTo(hx0 + inset, hy0);
  ctx.lineTo(hx1 - inset, hy0);
  ctx.lineTo(hx1, ty);
  ctx.lineTo(hx0, ty);
  ctx.closePath();
  ctx.fill();
  // Turret, a little narrower on top, with its gun's muzzle facing the wall.
  const [tx0, ty0, tx1, ty1] = r.turret;
  ctx.fillStyle = live.turret;
  ctx.beginPath();
  const ti = Math.max(1, Math.round((tx1 - tx0) * 0.14));
  ctx.moveTo(tx0 + ti, ty0);
  ctx.lineTo(tx1 - ti, ty0);
  ctx.lineTo(tx1, ty1);
  ctx.lineTo(tx0, ty1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,200,150,0.35)";
  ctx.fillRect(tx0 + ti, ty0, tx1 - tx0 - 2 * ti, Math.max(1, (ty1 - ty0) * 0.18));
  const mr = Math.max(1, Math.min(tx1 - tx0, ty1 - ty0) * 0.3);
  ctx.fillStyle = "#0B0A0C";
  ctx.beginPath();
  ctx.arc((tx0 + tx1) / 2, (ty0 + ty1) / 2 + mr * 0.2, mr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = live.shade;
  ctx.lineWidth = Math.max(0.6, mr * 0.45);
  ctx.stroke();
  // The weak spot: a glowing amber vent, gently pulsing.
  const [wx0, wy0, wx1, wy1] = r.weak;
  const pulse = still ? 0.8 : 0.65 + 0.35 * Math.sin(tick * 0.18 + lane);
  ctx.save();
  ctx.shadowColor = AMBER;
  ctx.shadowBlur = 8 * s * pulse + 2;
  ctx.fillStyle = `rgba(255,180,58,${0.75 + 0.25 * pulse})`;
  rect(ctx, r.weak);
  ctx.restore();
  ctx.fillStyle = "rgba(255,245,200,0.9)";
  ctx.fillRect(wx0 + (wx1 - wx0) * 0.25, wy0 + (wy1 - wy0) * 0.3, (wx1 - wx0) * 0.5, Math.max(0.6, (wy1 - wy0) * 0.25));
  // A hit's flash over the whole tank.
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${0.12 * flash})`;
    rect(ctx, [hx0, ty0, hx1, hy1]);
  }
  // Atmospheric haze on the far ones.
  const fog = Math.max(0, Math.min(0.55, (z / 256 - 500) / 1400));
  if (fog > 0) {
    ctx.fillStyle = `rgba(214,128,96,${fog})`;
    rect(ctx, [hx0, ty0, hx1, hy1]);
  }
  // Health pips above the turret (one per hit point; empty ones dark).
  const max = BT2_HP[kind]!;
  const pw = Math.max(3, Math.round(10 * s + 2));
  const ph = Math.max(2, Math.round(3.5 * s + 1.5));
  const gap = Math.max(1, Math.round(2 * s));
  const total = max * pw + (max - 1) * gap;
  const px0 = Math.round(r.cx - total / 2);
  const py = ty0 - ph - Math.max(2, Math.round(5 * s));
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(px0 + i * (pw + gap) - 1, py - 1, pw + 2, ph + 2);
    ctx.fillStyle = i < hp ? (hp === 1 && max > 1 ? ACTION_RED : "#7CF29A") : "rgba(255,255,255,0.12)";
    ctx.fillRect(px0 + i * (pw + gap), py, pw, ph);
  }
}

/* -------------------------------------------------------------- effects */

function paintImpact(ctx: CanvasRenderingContext2D, m: Bt2Impact, tick: number, still: boolean): void {
  const age = tick - m.t;
  if (age < 0 || age > 50) return;
  const s = m.s256 / 256;
  const k = age / 50;
  ctx.save();
  if (m.r === 0) {
    // A miss: a dust puff where it landed.
    ctx.globalAlpha = (1 - k) * 0.7;
    ctx.fillStyle = "#8C6E58";
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const d = (still ? 4 : 3 + age * 0.5) * (0.6 + s);
      ctx.beginPath();
      ctx.arc(m.x + Math.cos(a) * d, m.y - Math.abs(Math.sin(a)) * d * 0.7, (3 + age * 0.15) * (0.5 + s), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const kill = m.r >= 3;
    const weak = m.r === 2 || m.r === 4;
    const radius = (kill ? 26 : 12) * (0.4 + s) * (still ? 1 : 0.6 + k * 0.8);
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, radius);
    g.addColorStop(0, `rgba(255,248,220,${(1 - k) * 0.95})`);
    g.addColorStop(0.35, weak ? `rgba(255,190,70,${(1 - k) * 0.8})` : `rgba(255,140,60,${(1 - k) * 0.7})`);
    g.addColorStop(1, "rgba(255,90,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(m.x, m.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    if (kill && age > 8) {
      // Smoke rising from the wreck.
      ctx.globalAlpha = Math.max(0, 0.55 - k * 0.55);
      ctx.fillStyle = "#2A2228";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(m.x + (i - 1) * 6 * s, m.y - (age - 8) * 0.6 * (0.5 + s) - i * 4, (6 + age * 0.2) * (0.4 + s), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------- HUD */

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "rgba(10,8,16,0.9)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function paintHud(ctx: CanvasRenderingContext2D, state: BastionTankState): void {
  const wave = bastionWave(state);
  ctx.textBaseline = "middle";
  // Wave, top left.
  chip(ctx, 10, 8, 104, 30);
  ctx.fillStyle = "#F3F1EC";
  ctx.font = `800 15px ${DISPLAY}`;
  ctx.textAlign = "left";
  ctx.fillText(`WAVE ${wave + 1}/${BT2_WAVE_COUNT}`, 20, 24);
  // Score, top centre.
  chip(ctx, 150, 8, 90, 30);
  ctx.textAlign = "center";
  ctx.font = `700 16px ${MONO}`;
  ctx.fillStyle = "#F2C75C";
  ctx.fillText(String(bastionTankScore(state)), 195, 24);
  // Base, top right: three shields.
  chip(ctx, 268, 8, 112, 30);
  ctx.textAlign = "left";
  ctx.font = `800 12px ${DISPLAY}`;
  ctx.fillStyle = "#BDBDCC";
  ctx.fillText("BASE", 278, 24);
  for (let i = 0; i < BT2_BASE; i++) {
    const x = 320 + i * 18;
    ctx.fillStyle = i < state.base ? "#7CF29A" : "rgba(255,77,77,0.45)";
    ctx.beginPath();
    ctx.moveTo(x, 16);
    ctx.lineTo(x + 12, 16);
    ctx.lineTo(x + 12, 24);
    ctx.quadraticCurveTo(x + 12, 31, x + 6, 33);
    ctx.quadraticCurveTo(x, 31, x, 24);
    ctx.closePath();
    ctx.fill();
  }
  // Shells, bottom left.
  const by = 672;
  chip(ctx, 10, by - 18, 128, 40);
  for (let i = 0; i < BT2_MAG; i++) {
    const x = 22 + i * 22;
    const full = i < state.mag && state.reloadAt < 0;
    ctx.fillStyle = full ? "#E8B84A" : "rgba(255,255,255,0.13)";
    ctx.beginPath();
    ctx.roundRect(x, by - 10, 12, 22, [6, 6, 2, 2]);
    ctx.fill();
    if (full) {
      ctx.fillStyle = "#9A6B22";
      ctx.fillRect(x, by + 6, 12, 3);
    }
  }
  // Reload bar, bottom right: needle and green zone while reloading.
  const rx = 156;
  const rw = 224;
  chip(ctx, rx - 6, by - 18, rw + 12, 40);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(rx, by - 4, rw, 12);
  const needle = bastionNeedle(state);
  ctx.textAlign = "left";
  ctx.font = `800 10px ${DISPLAY}`;
  if (needle >= 0) {
    ctx.fillStyle = state.reloadTap === 2 ? "rgba(255,77,77,0.35)" : "rgba(124,242,154,0.55)";
    ctx.fillRect(rx + (rw * state.zone) / 1000, by - 4, (rw * BT2_ZONE_W) / 1000, 12);
    const done = Math.min(1, (state.tick - state.reloadAt) / Math.max(1, state.reloadEnd - state.reloadAt));
    ctx.fillStyle = "rgba(242,199,92,0.35)";
    ctx.fillRect(rx, by + 9, rw * done, 3);
    const nx = rx + (rw * needle) / 1000;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(nx - 1.5, by - 9, 3, 22);
    ctx.fillStyle = state.reloadTap === 2 ? ACTION_RED : state.reloadTap === 1 ? "#7CF29A" : "#F3F1EC";
    ctx.fillText(state.reloadTap === 2 ? "JAMMED" : state.reloadTap === 1 ? "FAST RELOAD" : "RELOADING · TAP IN THE GREEN", rx, by - 11);
  } else {
    ctx.fillStyle = "#BDBDCC";
    ctx.fillText(state.mag < BT2_MAG ? "SWIPE DOWN (R) TO RELOAD" : "LOADED", rx, by - 11);
    ctx.fillStyle = "rgba(242,199,92,0.5)";
    ctx.fillRect(rx, by - 4, (rw * state.mag) / BT2_MAG, 12);
  }
}

/* ------------------------------------------------------------- the world */

function paintGun(ctx: CanvasRenderingContext2D, state: BastionTankState, still: boolean): void {
  const dx = state.aimX - GUN_X;
  const dy = state.aimY - GUN_Y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const recoil = still ? 0 : Math.max(0, state.cool - 9) * 2.5;
  const mx = GUN_X + ux * (GUN_LEN - recoil);
  const my = GUN_Y + uy * (GUN_LEN - recoil);
  const nx = -uy;
  const ny = ux;
  ctx.save();
  // Barrel: a tapered tube, lit on one side.
  const g = ctx.createLinearGradient(GUN_X + nx * 16, GUN_Y + ny * 16, GUN_X - nx * 16, GUN_Y - ny * 16);
  g.addColorStop(0, "#1A1A1E");
  g.addColorStop(0.55, "#4A4A52");
  g.addColorStop(1, "#8A7A6A");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(GUN_X + nx * 22, GUN_Y + ny * 22);
  ctx.lineTo(mx + nx * 9, my + ny * 9);
  ctx.lineTo(mx - nx * 9, my - ny * 9);
  ctx.lineTo(GUN_X - nx * 22, GUN_Y - ny * 22);
  ctx.closePath();
  ctx.fill();
  // Muzzle brake and a flash just after a shot.
  ctx.fillStyle = "#26262C";
  ctx.beginPath();
  ctx.ellipse(mx, my, 11, 6, Math.atan2(uy, ux) + Math.PI / 2, 0, Math.PI * 2);
  ctx.fill();
  if (!still && state.cool > 10) {
    ctx.globalCompositeOperation = "lighter";
    const fl = ctx.createRadialGradient(mx, my, 0, mx, my, 34);
    fl.addColorStop(0, "rgba(255,240,200,0.95)");
    fl.addColorStop(0.4, "rgba(255,170,70,0.6)");
    fl.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = fl;
    ctx.beginPath();
    ctx.arc(mx, my, 34, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function paintCrosshair(ctx: CanvasRenderingContext2D, state: BastionTankState): void {
  const x = state.aimX;
  const y = state.aimY;
  const ready = state.reloadAt < 0 && state.mag > 0;
  const c = ready ? (state.aiming ? "#FFFFFF" : "rgba(255,255,255,0.75)") : "rgba(255,120,120,0.7)";
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = c;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.stroke();
  for (const [ax, ay] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x + ax * 7, y + ay * 7);
    ctx.lineTo(x + ax * 19, y + ay * 19);
    ctx.stroke();
  }
  ctx.fillStyle = c;
  ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.restore();
}

function drawBastionWorld(ctx: CanvasRenderingContext2D, state: BastionTankState): void {
  const still = reducedMotion();
  deviceLayer(ctx, "bastion-dusk:1", (c) => paintBackdrop(c, { x0: 0, x1: W, y0: 0, y1: H }));
  // Tanks, far ones first (the sim keeps them nearest first).
  const tanks: Bt2Tank[] = state.tanks;
  for (let i = tanks.length - 1; i >= 0; i--) {
    const t = tanks[i]!;
    if (t.z > BT2_FAR * 256) continue;
    paintTank(ctx, t.kind, t.lane, t.z, t.hp, t.flash, state.tick, still);
  }
  for (const m of state.impacts) paintImpact(ctx, m, state.tick, still);
  // Shells in flight: from the muzzle, shrinking toward the point they land on.
  for (const sh of state.shells) {
    const u = Math.min(1, (state.tick - sh.from) / Math.max(1, sh.at - sh.from));
    const ease = 1 - (1 - u) * (1 - u);
    const x = GUN_X + (sh.x - GUN_X) * ease;
    const y = GUN_Y - GUN_LEN + (sh.y - (GUN_Y - GUN_LEN)) * ease;
    const r = 5 - 3.2 * u;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,200,110,0.9)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // The wall's lip again over any tank right at it (it stands in front of the field).
  ctx.fillStyle = "#C9875A";
  ctx.fillRect(0, BT2_WALL_Y, W, 3);
  paintGun(ctx, state, still);
  paintCrosshair(ctx, state);
  // A base hit: a red flash round the edges.
  const since = state.tick - state.breachAt;
  if (state.breachAt > 0 && since < 36) {
    const a = (1 - since / 36) * 0.5;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.7);
    g.addColorStop(0, "rgba(255,40,40,0)");
    g.addColorStop(1, `rgba(255,40,40,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // The wave call as each wave rolls in.
  const wave = bastionWave(state);
  const age = state.tick - BT2_WAVE_START[wave]!;
  if (age >= 0 && age < 80 && state.ended === 0) {
    ctx.save();
    ctx.globalAlpha = still ? 1 : Math.min(1, (80 - age) / 20, age / 8);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 30px ${DISPLAY}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(10,6,12,0.85)";
    const text = wave === BT2_WAVE_COUNT - 1 ? "FINAL WAVE" : `WAVE ${wave + 1}`;
    ctx.strokeText(text, W / 2, 190);
    ctx.fillStyle = "#F3F1EC";
    ctx.fillText(text, W / 2, 190);
    ctx.restore();
  }
  paintHud(ctx, state);
}

/** The miss moments: base hits and jams. */
function bastionMisses(s: BastionTankState): number {
  return s.breached + s.jams;
}

function lastImpact(s: BastionTankState, kill: boolean): { x: number; y: number } | null {
  for (let i = s.impacts.length - 1; i >= 0; i--) {
    const m = s.impacts[i]!;
    if (kill ? m.r >= 3 : m.r === 2 || m.r === 4) return { x: m.x, y: m.y };
  }
  return null;
}

export const BASTION_FX: ArcadeFxSpec<BastionTankState> = {
  game: "bastion",
  world: "realworld",
  width: W,
  height: H,
  // An aiming game: no shake (it would mislead the finger).
  shake: false,
  textInset: 40,
  events: [
    { kind: "pop", count: (s) => s.kills, at: (s) => lastImpact(s, true), label: () => null },
    { kind: "streak", count: (s) => s.weak, at: (s) => lastImpact(s, false), label: () => "WEAK SPOT", every: 5 },
    { kind: "combo", count: (s) => s.fast, at: () => ({ x: 268, y: 640 }), label: () => "FAST RELOAD" },
  ],
  misses: [{ count: bastionMisses }],
};

export function drawBastionTankArt(ctx: CanvasRenderingContext2D, state: BastionTankState, size: CanvasSize): void {
  arcadeFx(ctx, BASTION_FX, state, () => drawBastionWorld(ctx, state), size);
}

export const bastionTankArtGame = { ...bastionTankGame, draw: drawBastionTankArt };

/**
 * The play screen's scenery beyond the world (painted once per size, world units): the same dusk, field and wall
 * carried out to the box's edges (the computer layout's sides included), darkening a little far below the world.
 */
export function bastionScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const e: Extent = { x0: view.left - 2, x1: view.right + 2, y0: Math.min(view.top, 0) - 2, y1: view.bottom + 2 };
  ctx.fillStyle = BT2_ART_BG;
  ctx.fillRect(e.x0, e.y0, e.x1 - e.x0, e.y1 - e.y0);
  paintBackdrop(ctx, e);
  if (view.bottom > H) {
    const g = ctx.createLinearGradient(0, H, 0, view.bottom);
    g.addColorStop(0, "rgba(8,6,10,0)");
    g.addColorStop(1, "rgba(8,6,10,0.4)");
    ctx.fillStyle = g;
    ctx.fillRect(e.x0, H, e.x1 - e.x0, view.bottom - H);
  }
}

/** Tile icon helper: tanks rolling down the lanes at dusk, a weak-spot hit and the crosshair (scripts/shots/tile-scenes). */
export function paintBastionTile(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.save();
  const s = size / 220;
  ctx.scale(s, s);
  ctx.translate(-85, -232);
  paintBackdrop(ctx, { x0: 60, x1: 340, y0: 200, y1: 480 });
  paintTank(ctx, 1, 0, 900 * 256, 2, 0, 0, true);
  paintTank(ctx, 0, 2, 560 * 256, 1, 0, 0, true);
  paintTank(ctx, 2, 1, 280 * 256, 3, 0, 0, true);
  const r = bastionTankRects(2, 1, 280 * 256);
  const wx = (r.weak[0] + r.weak[2]) / 2;
  const wy = (r.weak[1] + r.weak[3]) / 2;
  paintImpact(ctx, { x: wx, y: wy, t: 0, r: 2, kind: 2, s256: r.s256 }, 6, true);
  paintCrosshair(ctx, { ...bastionTankGame.init(1), aimX: Math.round(wx), aimY: Math.round(wy), aiming: 1 });
  ctx.restore();
}
