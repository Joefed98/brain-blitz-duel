/**
 * Bastion's art, bastionRev 2 (display only; never imported by the sim or the server), after Joe's mockups
 * (bastion-mockup.png, bastion-controls.png; 1 Nov 2026). First person from a gun turret behind a wall at dusk: the
 * slate sky, the jagged peaks, the earth field with the road's three lanes and their dashed dividers running to the
 * vanishing point, and the wall are painted once per canvas size (deviceLayer); per frame the tanks (each hull and turret
 * drawn exactly on the sim's collision rectangles, bastionTankRects; the weak spot a round orange vent on its own square,
 * dark while closed; orange health pips above), the shells in flight, the landings, the crosshair (white ring, orange
 * dot), the gun and the HUD: the Wave and Base pills under the game header, and the bottom panel with SHELLS, the RELOAD
 * bar (its needle and green zone while reloading) and the hint line.
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
  bastionPlan,
  bastionWeakOpen,
  bastionScale256,
  bastionTankGame,
  bastionTankRects,
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

export const BT2_ART_BG = "#14171D";
const W = BT2_WORLD_W;
const H = BT2_WORLD_H;
const DISPLAY = "'Archivo', 'Saira', system-ui, sans-serif";
/** The gun: its breech below the parapet, its muzzle this far along the aim line. */
const GUN_X = BT2_VP_X;
const GUN_Y = 660;
const GUN_LEN = 112;
/** The bottom panel's top edge (world px). */
export const BT2_PANEL_Y = 628;
const ORANGE = "#FFB547";
const VENT = "#F29A2E";
const VENT_CORE = "#FFD36A";
const GREEN = "#8FD6A0";
const RED = "#FF6B5B";
/** Health pip colours (bastion-check skips them when it judges a tank's bounds: they are its HUD, above the turret). */
export const BT2_PIP_FILL = "#FF7A3C";
export const BT2_PIP_EMPTY = "#33373F";
export const BT2_PIP_BACK = "rgba(0,0,0,0.55)";

/** Each type's paint: hull, its shaded side, turret, track and the road wheels (scouts and mediums olive, heavies rust). */
const LIVERY = [
  { hull: "#5A6340", shade: "#3E4530", turret: "#66704A", track: "#1C1E22", wheel: "#3A3D44" },
  { hull: "#47533A", shade: "#323B29", turret: "#556244", track: "#1C1E22", wheel: "#3A3D44" },
  { hull: "#7A4434", shade: "#5A3126", turret: "#8A5141", track: "#1C1E22", wheel: "#41383A" },
] as const;

interface Extent {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/* -------------------------------------------------------------- backdrop */

/** The slate dusk sky, the peaks, the field, the road's lanes and the wall, over any extent (world units). */
function paintBackdrop(ctx: CanvasRenderingContext2D, e: Extent): void {
  const wx = e.x1 - e.x0;
  const sky = ctx.createLinearGradient(0, 0, 0, BT2_HORIZON_Y);
  sky.addColorStop(0, "#2A3240");
  sky.addColorStop(1, "#46515F");
  ctx.fillStyle = sky;
  ctx.fillRect(e.x0, e.y0, wx, BT2_HORIZON_Y - e.y0 + 1);
  // Jagged peaks on the horizon (a fixed pattern repeating every 240 px, so the scene carries it on with no seam).
  ctx.fillStyle = "#262B33";
  ctx.beginPath();
  ctx.moveTo(e.x0, BT2_HORIZON_Y + 1);
  const peaks = [0, 18, 46, 30, 64, 22, 52, 12, 40, 26, 58, 16] as const;
  const step = 20;
  for (let x = Math.floor(e.x0 / step) * step; x <= e.x1 + step; x += step) {
    const k = (((x / step) % peaks.length) + peaks.length) % peaks.length;
    ctx.lineTo(x, BT2_HORIZON_Y - peaks[k]!);
  }
  ctx.lineTo(e.x1, BT2_HORIZON_Y + 1);
  ctx.closePath();
  ctx.fill();
  // The field: earth, a little darker toward the wall.
  const field = ctx.createLinearGradient(0, BT2_HORIZON_Y, 0, BT2_WALL_Y);
  field.addColorStop(0, "#6F5E46");
  field.addColorStop(1, "#5A4B37");
  ctx.fillStyle = field;
  ctx.fillRect(e.x0, BT2_HORIZON_Y, wx, BT2_WALL_Y - BT2_HORIZON_Y + 1);
  // Dark hollows on the ground (fixed places), smaller toward the horizon.
  ctx.fillStyle = "rgba(40,32,24,0.45)";
  for (let i = 0; i < 26; i++) {
    const z = 60 + ((i * 397) % 1300);
    const s = bastionScale256(z * 256) / 256;
    const y = BT2_HORIZON_Y + (BT2_WALL_Y - BT2_HORIZON_Y) * s;
    const side = i % 2 ? 1 : -1;
    const x = BT2_VP_X + side * (210 + ((i * 131) % 260)) * s;
    ctx.beginPath();
    ctx.ellipse(x, y, 30 * s + 2, 6 * s + 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The road: one paler wedge over the three lanes, its edges and the dashed dividers between lanes.
  const half = 192;
  ctx.fillStyle = "rgba(150,128,96,0.32)";
  ctx.beginPath();
  ctx.moveTo(BT2_VP_X - half * 0.04, BT2_HORIZON_Y + 1);
  ctx.lineTo(BT2_VP_X + half * 0.04, BT2_HORIZON_Y + 1);
  ctx.lineTo(BT2_VP_X + half, BT2_WALL_Y);
  ctx.lineTo(BT2_VP_X - half, BT2_WALL_Y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(30,24,18,0.35)";
  ctx.lineWidth = 1.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(BT2_VP_X + side * half * 0.04, BT2_HORIZON_Y + 1);
    ctx.lineTo(BT2_VP_X + side * half, BT2_WALL_Y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(225,210,180,0.55)";
  for (const lx of [(BT2_LANE_X[0] + BT2_LANE_X[1]) / 2, (BT2_LANE_X[1] + BT2_LANE_X[2]) / 2]) {
    for (let z = 40; z < BT2_FAR + 400; z += 90) {
      const a = bastionScale256(z * 256) / 256;
      const b = bastionScale256((z + 40) * 256) / 256;
      const ya = BT2_HORIZON_Y + (BT2_WALL_Y - BT2_HORIZON_Y) * a;
      const yb = BT2_HORIZON_Y + (BT2_WALL_Y - BT2_HORIZON_Y) * b;
      const w = Math.max(0.6, 2.2 * a);
      ctx.beginPath();
      ctx.moveTo(BT2_VP_X + lx * a - w, ya);
      ctx.lineTo(BT2_VP_X + lx * a + w, ya);
      ctx.lineTo(BT2_VP_X + lx * b + w * 0.8, yb);
      ctx.lineTo(BT2_VP_X + lx * b - w * 0.8, yb);
      ctx.closePath();
      ctx.fill();
    }
  }
  // A faint haze where the tanks roll out.
  const haze = ctx.createLinearGradient(0, BT2_HORIZON_Y - 4, 0, BT2_HORIZON_Y + 70);
  haze.addColorStop(0, "rgba(70,81,95,0.55)");
  haze.addColorStop(1, "rgba(70,81,95,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(e.x0, BT2_HORIZON_Y - 4, wx, 74);
  paintWall(ctx, e);
}

/** The parapet: dark stone from the wall's line down, with a lit lip, and below the world the panel's colour. */
function paintWall(ctx: CanvasRenderingContext2D, e: Extent): void {
  const wx = e.x1 - e.x0;
  const face = ctx.createLinearGradient(0, BT2_WALL_Y, 0, BT2_PANEL_Y);
  face.addColorStop(0, "#2A2F38");
  face.addColorStop(1, "#1C1F26");
  ctx.fillStyle = face;
  ctx.fillRect(e.x0, BT2_WALL_Y, wx, BT2_PANEL_Y - BT2_WALL_Y);
  ctx.fillStyle = "#4A505C";
  ctx.fillRect(e.x0, BT2_WALL_Y, wx, 2);
  ctx.fillStyle = BT2_ART_BG;
  ctx.fillRect(e.x0, BT2_PANEL_Y, wx, Math.max(H, e.y1) - BT2_PANEL_Y);
  ctx.fillStyle = "#232730";
  ctx.fillRect(e.x0, BT2_PANEL_Y, wx, 1);
}

/* ----------------------------------------------------------------- tanks */

function rect(ctx: CanvasRenderingContext2D, r: Bt2Rect): void {
  ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
}

/**
 * One tank on its rectangles: tracks with road wheels, the hull, the turret with its muzzle toward the wall, the weak
 * spot (a round orange vent on its square while exposed, a dark plate while closed), a hit's flash, haze on far ones and
 * the orange health pips above.
 */
export function paintTank(ctx: CanvasRenderingContext2D, kind: number, lane: number, z: number, hp: number, flash: number, tick: number, still: boolean, open = true): void {
  const r = bastionTankRects(kind, lane, z);
  const s = r.s256 / 256;
  const live = LIVERY[kind]!;
  const [hx0, hy0, hx1, hy1] = r.hull;
  const hw = hx1 - hx0;
  const hh = hy1 - hy0;
  // Tracks: the lower third, the full width, with road wheels.
  const ty = hy1 - Math.max(1, Math.round(hh * 0.36));
  ctx.fillStyle = live.track;
  ctx.fillRect(hx0, ty, hw, hy1 - ty);
  if (hw > 14) {
    ctx.fillStyle = live.wheel;
    const n = kind === 2 ? 6 : 5;
    const wr = Math.max(0.8, (hy1 - ty) * 0.3);
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(hx0 + ((i + 0.5) * hw) / n, (ty + hy1) / 2, wr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Hull, its left side in shade.
  const g = ctx.createLinearGradient(hx0, 0, hx1, 0);
  g.addColorStop(0, live.shade);
  g.addColorStop(0.45, live.hull);
  g.addColorStop(1, live.hull);
  ctx.fillStyle = g;
  ctx.beginPath();
  const inset = Math.max(1, Math.round(hw * 0.06));
  ctx.moveTo(hx0 + inset, hy0);
  ctx.lineTo(hx1 - inset, hy0);
  ctx.lineTo(hx1, ty);
  ctx.lineTo(hx0, ty);
  ctx.closePath();
  ctx.fill();
  // Turret and its muzzle.
  const [tx0, ty0, tx1, ty1] = r.turret;
  ctx.fillStyle = live.turret;
  ctx.beginPath();
  const ti = Math.max(1, Math.round((tx1 - tx0) * 0.12));
  ctx.moveTo(tx0 + ti, ty0);
  ctx.lineTo(tx1 - ti, ty0);
  ctx.lineTo(tx1, ty1);
  ctx.lineTo(tx0, ty1);
  ctx.closePath();
  ctx.fill();
  const mr = Math.max(0.8, Math.min(tx1 - tx0, ty1 - ty0) * 0.28);
  ctx.fillStyle = "#121317";
  ctx.beginPath();
  ctx.arc((tx0 + tx1) / 2, (ty0 + ty1) / 2, mr, 0, Math.PI * 2);
  ctx.fill();
  // The weak spot: a round vent filling its square.
  const [wx0, wy0, wx1, wy1] = r.weak;
  const cx = (wx0 + wx1) / 2;
  const cy = (wy0 + wy1) / 2;
  const rad = Math.max(1, Math.min(wx1 - wx0, wy1 - wy0) / 2);
  if (open) {
    const pulse = still ? 0.85 : 0.7 + 0.3 * Math.sin(tick * 0.2 + lane);
    ctx.save();
    ctx.shadowColor = VENT;
    ctx.shadowBlur = 10 * s * pulse + 2;
    ctx.fillStyle = VENT;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = VENT_CORE;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.55, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#2B2E33";
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,181,71,0.35)";
    ctx.lineWidth = Math.max(0.5, rad * 0.18);
    ctx.stroke();
  }
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${0.12 * flash})`;
    rect(ctx, [hx0, ty0, hx1, hy1]);
  }
  // Haze on the far ones.
  const fog = Math.max(0, Math.min(0.5, (z / 256 - 520) / 1500));
  if (fog > 0) {
    ctx.fillStyle = `rgba(70,81,95,${fog})`;
    rect(ctx, [hx0, ty0, hx1, hy1]);
  }
  // Health pips above the turret: one per hit point, orange while left.
  const max = BT2_HP[kind]!;
  const pw = Math.max(3, Math.round(11 * s + 2));
  const ph = Math.max(2, Math.round(4 * s + 1.5));
  const gap = Math.max(1, Math.round(2.5 * s));
  const total = max * pw + (max - 1) * gap;
  const px0 = Math.round(r.cx - total / 2);
  const py = ty0 - ph - Math.max(2, Math.round(7 * s));
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = BT2_PIP_BACK;
    ctx.fillRect(px0 + i * (pw + gap) - 1, py - 1, pw + 2, ph + 2);
    ctx.fillStyle = i < hp ? BT2_PIP_FILL : BT2_PIP_EMPTY;
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

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, colour: string, alignRight = false): void {
  ctx.font = `600 14px ${DISPLAY}`;
  const w = Math.ceil(ctx.measureText(text).width) + 28;
  const x0 = alignRight ? x - w : x;
  ctx.fillStyle = "rgba(14,16,21,0.88)";
  ctx.beginPath();
  ctx.roundRect(x0, y, w, 30, 15);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x0 + 14, y + 15.5);
}

/** The bar's left edge and width (world px), shared by the shells' slots. */
const BAR_X = 96;
const BAR_W = 278;

function paintHud(ctx: CanvasRenderingContext2D, state: BastionTankState): void {
  const wave = bastionWave(state);
  pill(ctx, 14, 12, `Wave ${wave + 1} of ${BT2_WAVE_COUNT}`, "#F3F1EC");
  pill(ctx, W - 14, 12, `Base ${state.base} / ${BT2_BASE}`, state.base >= 2 ? GREEN : RED, true);

  // The bottom panel: SHELLS, RELOAD and the hint line.
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `700 11px ${DISPLAY}`;
  ctx.fillStyle = "#BDBDCC";
  const shellsY = 652;
  const reloadY = 680;
  ctx.fillText("SHELLS", 16, shellsY);
  ctx.fillText("RELOAD", 16, reloadY);
  const gap = 6;
  const sw = (BAR_W - gap * (BT2_MAG - 1)) / BT2_MAG;
  const reloading = state.reloadAt >= 0;
  for (let i = 0; i < BT2_MAG; i++) {
    ctx.fillStyle = !reloading && i < state.mag ? ORANGE : "#2A2E36";
    ctx.beginPath();
    ctx.roundRect(BAR_X + i * (sw + gap), shellsY - 10, sw, 20, 4);
    ctx.fill();
  }
  ctx.fillStyle = "#2A2E36";
  ctx.beginPath();
  ctx.roundRect(BAR_X, reloadY - 5, BAR_W, 10, 5);
  ctx.fill();
  let hint = "Drag to aim · lift to fire · swipe down to reload early";
  let hintColour = "#9AA0AA";
  const needle = bastionNeedle(state);
  if (needle >= 0) {
    const span = Math.max(1, state.reloadEnd - state.reloadAt);
    const done = Math.min(1, (state.tick - state.reloadAt) / span);
    ctx.fillStyle = "rgba(143,214,160,0.45)";
    ctx.beginPath();
    ctx.roundRect(BAR_X, reloadY - 5, BAR_W * done, 10, 5);
    ctx.fill();
    if (state.reloadTap !== 1) {
      ctx.fillStyle = state.reloadTap === 2 ? "rgba(255,107,91,0.55)" : "#9BE3AE";
      ctx.fillRect(BAR_X + (BAR_W * state.zone) / 1000, reloadY - 7, (BAR_W * BT2_ZONE_W) / 1000, 14);
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(BAR_X + (BAR_W * needle) / 1000 - 1.5, reloadY - 9, 3, 18);
    const left = Math.max(0, state.reloadEnd - state.tick) / 60;
    ctx.font = `700 11px ${DISPLAY}`;
    ctx.textAlign = "right";
    ctx.fillStyle = "#F3F1EC";
    ctx.fillText(`${left.toFixed(1)} s`, W - 16, shellsY);
    hint = state.reloadTap === 2 ? "Jammed!" : state.reloadTap === 1 ? "Fast reload!" : "Tap while the needle is in the green";
    hintColour = state.reloadTap === 2 ? RED : state.reloadTap === 1 ? GREEN : "#F3F1EC";
  } else {
    ctx.fillStyle = GREEN;
    ctx.beginPath();
    ctx.roundRect(BAR_X, reloadY - 5, BAR_W, 10, 5);
    ctx.fill();
  }
  ctx.font = `500 12px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.fillStyle = hintColour;
  ctx.fillText(hint, W / 2, 706);
}

/* ------------------------------------------------------------- the world */

function paintGun(ctx: CanvasRenderingContext2D, state: BastionTankState, still: boolean): void {
  const dx = state.aimX - GUN_X;
  const dy = Math.min(-20, state.aimY - GUN_Y);
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const recoil = still ? 0 : Math.max(0, state.cool - 9) * 2.5;
  const mx = GUN_X + ux * (GUN_LEN - recoil);
  const my = GUN_Y + uy * (GUN_LEN - recoil);
  const nx = -uy;
  const ny = ux;
  ctx.save();
  // The barrel rises from behind the parapet: nothing of it below the panel's top edge.
  ctx.beginPath();
  ctx.rect(0, 0, W, BT2_PANEL_Y);
  ctx.clip();
  ctx.fillStyle = "#3B4250";
  ctx.beginPath();
  ctx.moveTo(GUN_X + nx * 15, GUN_Y + ny * 15);
  ctx.lineTo(mx + nx * 11, my + ny * 11);
  ctx.lineTo(mx - nx * 11, my - ny * 11);
  ctx.lineTo(GUN_X - nx * 15, GUN_Y - ny * 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#4E5767";
  ctx.beginPath();
  ctx.moveTo(mx + nx * 13, my + ny * 13);
  ctx.lineTo(mx + nx * 13 + ux * 10, my + ny * 13 + uy * 10);
  ctx.lineTo(mx - nx * 13 + ux * 10, my - ny * 13 + uy * 10);
  ctx.lineTo(mx - nx * 13, my - ny * 13);
  ctx.closePath();
  ctx.fill();
  if (!still && state.cool > 10) {
    const fx = mx + ux * 14;
    const fy = my + uy * 14;
    ctx.globalCompositeOperation = "lighter";
    const fl = ctx.createRadialGradient(fx, fy, 0, fx, fy, 30);
    fl.addColorStop(0, "rgba(255,240,200,0.95)");
    fl.addColorStop(0.4, "rgba(255,170,70,0.6)");
    fl.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = fl;
    ctx.beginPath();
    ctx.arc(fx, fy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  // The gun's base on the parapet.
  ctx.fillStyle = "#2A2F38";
  ctx.beginPath();
  ctx.roundRect(GUN_X - 46, BT2_PANEL_Y - 22, 92, 22, [8, 8, 0, 0]);
  ctx.fill();
  ctx.restore();
}

function paintCrosshair(ctx: CanvasRenderingContext2D, state: BastionTankState): void {
  const x = state.aimX;
  const y = state.aimY;
  const ready = state.reloadAt < 0 && state.mag > 0;
  ctx.save();
  ctx.globalAlpha = ready ? 1 : 0.55;
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.stroke();
  for (const [ax, ay] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x + ax * 10, y + ay * 10);
    ctx.lineTo(x + ax * 24, y + ay * 24);
    ctx.stroke();
  }
  ctx.fillStyle = ORANGE;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBastionWorld(ctx: CanvasRenderingContext2D, state: BastionTankState): void {
  const still = reducedMotion();
  deviceLayer(ctx, "bastion-slate:2", (c) => paintBackdrop(c, { x0: 0, x1: W, y0: 0, y1: H }));
  const plan = bastionPlan(state.seed);
  // Tanks, far ones first (the sim keeps them nearest first).
  const tanks: Bt2Tank[] = state.tanks;
  for (let i = tanks.length - 1; i >= 0; i--) {
    const t = tanks[i]!;
    if (t.z > BT2_FAR * 256) continue;
    const p = plan[t.i];
    paintTank(ctx, t.kind, t.lane, t.z, t.hp, t.flash, state.tick, still, p ? bastionWeakOpen(p, state.tick) : true);
  }
  for (const m of state.impacts) paintImpact(ctx, m, state.tick, still);
  // Shells in flight: from the muzzle, shrinking toward the point they land on.
  for (const sh of state.shells) {
    const u = Math.min(1, (state.tick - sh.from) / Math.max(1, sh.at - sh.from));
    const ease = 1 - (1 - u) * (1 - u);
    const x0 = GUN_X;
    const y0 = GUN_Y - GUN_LEN;
    const x = x0 + (sh.x - x0) * ease;
    const y = y0 + (sh.y - y0) * ease;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,200,110,0.9)";
    ctx.beginPath();
    ctx.arc(x, y, 5 - 3.2 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
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
    ctx.strokeStyle = "rgba(10,12,16,0.85)";
    const text = wave === BT2_WAVE_COUNT - 1 ? "FINAL WAVE" : `WAVE ${wave + 1}`;
    ctx.strokeText(text, W / 2, 170);
    ctx.fillStyle = "#F3F1EC";
    ctx.fillText(text, W / 2, 170);
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
    { kind: "combo", count: (s) => s.fast, at: () => ({ x: W / 2, y: 600 }), label: () => "FAST RELOAD" },
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
