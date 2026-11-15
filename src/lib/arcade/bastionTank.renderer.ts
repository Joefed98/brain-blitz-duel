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
 *
 * Iron Wall (3 Nov 2026, display only on every revision): scenery along the lane edges and the horizon (rocks, broken
 * walls, scrub, tank traps, two burnt-out wrecks and ruins on the skyline), all outside the road's edges so nothing
 * covers a lane or a shot; on bastionRev 3 the drones (paintDrone, exactly on bastionDroneRect), their flak and
 * wreckage, and a Drones pill between the Wave and Base pills.
 */
import { reducedMotion } from "./art.renderer";
import { drawActionHud, type ActionChip } from "./actionHud.renderer";
import { BT_VIEW_HORIZON, BT_VIEW_SKY_SHIFT, btViewMatrix, btViewS, btViewTransform, btViewX, btViewY } from "./bastionView";
import { deviceLayer } from "./cache.renderer";
import {
  BT_PANEL_HINT_Y,
  BT_PANEL_RELOAD_Y,
  BT_PANEL_SHELLS_Y,
  BT_PANEL_TIP_Y,
  BT_SETTING_FADE,
  BT_SETTING_FROM_WAVE,
  BT_SETTING_STEPS,
  BT_SWIPE_HINT,
  bastionSceneKey,
  bastionSettingMix,
  bastionSettingNow,
  bastionSettingOf,
  bastionSwipeHint,
  bastionFlashAge,
  bastionKick,
  bastionKillPoints,
  bastionLedgerStart,
  bastionLedgerStep,
  bastionNearMiss,
  bastionSnapLit,
  bastionTallyRows,
  bastionWaveTallies,
  BT_END_HOLD_MS,
  BT_HELD_AT_MS,
  BT_JAM_SHAKE_TICKS,
  BT_SNAP_STEP,
  BT_TALLY_STEP_MS,
  type BtLedger,
  type BtSetting,
} from "./bastionLook";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
export {
  BT_PANEL_HINT_Y,
  BT_PANEL_RELOAD_Y,
  BT_PANEL_SHELLS_Y,
  BT_PANEL_TIP_Y,
  BT_SETTING_FADE,
  BT_SETTING_FROM_WAVE,
  BT_SETTING_STEPS,
  BT_SWIPE_HINT,
  bastionSceneKey,
  bastionSettingMix,
  bastionSettingNow,
  bastionSettingOf,
  bastionSwipeHint,
  type BtSetting,
};
import { arcadeFx, type ArcadeFxSpec } from "./arcadeFx.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import type { CanvasSize } from "./engine";
import {
  bastionDronePos,
  bastionDroneRect,
  bastionDrones,
  bastionNeedle,
  bastionPlan,
  bastionZoneW,
  BT3_DRONES,
  bastionWeakOpen,
  bastionScale256,
  bastionIronGame,
  bastionTankGame,
  bastionTankRects,
  BASTION_REV_IRON,
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
  BT2_TANKS,
  BT2_WORLD_H,
  BT2_WORLD_W,
  type BastionTankState,
  type Bt2Impact,
  type Bt2Rect,
  type Bt2Tank,
} from "./bastionTank";

export const BT2_ART_BG = "#14171D";
const W = BT2_WORLD_W;
const H = BT2_WORLD_H;
const DISPLAY = "'Archivo', system-ui, sans-serif";
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
/** The panel's navy and its champagne-gold labels (the controls' colours, Action overhaul 15 Nov 2026). */
const PANEL_TOP = "#121A31";
const PANEL_BOTTOM = "#0B0F1C";
const GOLD = "#E2C07A";
/** The empty shell slots and the reload track on the navy panel. */
const SLOT = "#26304D";
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

/** The view's horizon (bastionView.ts): the backdrop, skyline and scenery are painted in the view. */
const HY = BT_VIEW_HORIZON;

interface Extent {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/* -------------------------------------------------------------- backdrop */

/** Each setting's colours: sky top, middle and horizon, the far and near ridges, the field far and near, the horizon haze and the far tanks' fog. */
export const BT_SETTING_LOOK = [
  { sky: ["#25334A", "#5F7690", "#9DB0C2"], ridge: "#3A4658", ridgeNear: "#2B333F", field: ["#776448", "#5A4B37"], haze: "120,140,160", hazeA: 0.5, fog: "96,112,130" },
  { sky: ["#4A3A34", "#A3734A", "#E0B27A"], ridge: "#A07A52", ridgeNear: "#7E5E40", field: ["#9A7C54", "#6E583C"], haze: "214,170,112", hazeA: 0.55, fog: "176,140,98" },
  { sky: ["#1C1418", "#5C2A22", "#C0582E"], ridge: "#3A2626", ridgeNear: "#241A1C", field: ["#6A4F38", "#43342A"], haze: "70,48,44", hazeA: 0.5, fog: "84,60,54" },
] as const;

/** The sky, the far land, the field, the road's lanes and the wall for a setting, over any extent (world units). */
function paintBackdrop(ctx: CanvasRenderingContext2D, e: Extent, setting: BtSetting = 0): void {
  // Iron Wall's view (bastionView.ts): the horizon at HY and every depth scale s drawn as btViewS(s).
  const wx = e.x1 - e.x0;
  const look = BT_SETTING_LOOK[setting];
  // The same gradient in the world and the scene beyond it (from world y 0), so their edges meet with no seam.
  const sky = ctx.createLinearGradient(0, 0, 0, HY);
  sky.addColorStop(0, look.sky[0]);
  sky.addColorStop(0.6, look.sky[1]);
  sky.addColorStop(1, look.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(e.x0, e.y0, wx, HY - e.y0 + 1);
  if (setting === 0) {
    // A clear evening: a low pale sun and two ridges of jagged peaks (fixed patterns, so the scene carries them on).
    paintSun(ctx, BT2_VP_X + 120, HY - 74, 14, "255,236,200", 0.9);
    paintPeaks(ctx, e, look.ridge, [10, 30, 22, 44, 18, 36, 26, 48, 14, 32, 24, 40], 26);
    paintPeaks(ctx, e, look.ridgeNear, [0, 18, 46, 30, 64, 22, 52, 12, 40, 26, 58, 16], 20);
  } else if (setting === 1) {
    // Dusty desert: a hazed sun and two lines of rolling sand hills.
    paintSun(ctx, BT2_VP_X - 90, HY - 64, 20, "255,230,180", 0.75);
    paintHills(ctx, e, look.ridge, 34, 170, 0.6);
    paintHills(ctx, e, look.ridgeNear, 20, 110, 2.1);
  } else {
    // The battle-smoke storm: smoke columns rising from fires on the skyline, a dark ridge in front.
    paintSmoke(ctx, e);
    paintHills(ctx, e, look.ridge, 26, 130, 1.3, "255,140,90");
    paintPeaks(ctx, e, look.ridgeNear, [0, 14, 30, 20, 40, 12, 34, 8, 26, 18, 36, 10], 22, "255,120,70");
  }
  // The field: earth, a little darker toward the wall.
  const field = ctx.createLinearGradient(0, HY, 0, BT2_WALL_Y);
  field.addColorStop(0, look.field[0]);
  field.addColorStop(1, look.field[1]);
  ctx.fillStyle = field;
  ctx.fillRect(e.x0, HY, wx, BT2_WALL_Y - HY + 1);
  paintFieldGrain(ctx, e, setting);
  // Dark hollows on the ground (fixed places), smaller toward the horizon.
  ctx.fillStyle = "rgba(40,32,24,0.45)";
  for (let i = 0; i < 26; i++) {
    const z = 60 + ((i * 397) % 1300);
    const s = btViewS(bastionScale256(z * 256) / 256);
    const y = HY + (BT2_WALL_Y - HY) * s;
    const side = i % 2 ? 1 : -1;
    const x = BT2_VP_X + side * (210 + ((i * 131) % 260)) * s;
    ctx.beginPath();
    ctx.ellipse(x, y, 30 * s + 2, 6 * s + 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  paintRoad(ctx, setting);
  paintScenery(ctx, e, setting);
  // A faint haze where the tanks roll out.
  const haze = ctx.createLinearGradient(0, HY - 4, 0, HY + 70);
  haze.addColorStop(0, `rgba(${look.haze},${look.hazeA})`);
  haze.addColorStop(1, `rgba(${look.haze},0)`);
  ctx.fillStyle = haze;
  ctx.fillRect(e.x0, HY - 4, wx, 74);
  paintWall(ctx, e);
}

/** A low sun: a soft glow and its disc (`rgb` as "r,g,b"). */
function paintSun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.25, `rgba(${rgb},${a * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(${rgb},${a})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A ridge of jagged peaks on the horizon: a fixed pattern repeating every `step` × its length, so scenes carry it on. */
function paintPeaks(ctx: CanvasRenderingContext2D, e: Extent, colour: string, peaks: readonly number[], step: number, lit = "255,236,206"): void {
  const pts: [number, number][] = [];
  for (let x = Math.floor(e.x0 / step) * step; x <= e.x1 + step; x += step) {
    const k = (((x / step) % peaks.length) + peaks.length) % peaks.length;
    pts.push([x, HY - peaks[k]!]);
  }
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(e.x0, HY + 1);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(e.x1, HY + 1);
  ctx.closePath();
  ctx.fill();
  // Rock faces turned to the low sun (the slopes falling to the right) catch the light, fading down the face.
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    if (y1 <= y0) continue;
    const g = ctx.createLinearGradient(0, y0, 0, HY);
    g.addColorStop(0, `rgba(${lit},0.22)`);
    g.addColorStop(1, `rgba(${lit},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 - (y1 - y0) * 0.3, HY + 1);
    ctx.lineTo(x0 + 2, HY + 1);
    ctx.closePath();
    ctx.fill();
  }
}

/** Rolling sand hills: a sum of two slow waves fixed in world x, so the scene carries them on with no seam. */
function paintHills(ctx: CanvasRenderingContext2D, e: Extent, colour: string, height: number, wave: number, phase: number, lit = "255,226,170"): void {
  const pts: [number, number][] = [];
  for (let x = Math.floor(e.x0 / 6) * 6; x <= e.x1 + 6; x += 6) {
    const h = height * (0.55 + 0.3 * Math.sin(x / wave + phase) + 0.15 * Math.sin(x / (wave * 0.37) + phase * 2.3));
    pts.push([x, HY - h]);
  }
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(e.x0, HY + 1);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(e.x1, HY + 1);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Sunlit ridges: a soft band under each crest, brighter on the slopes facing the sun, and the shaded lee below.
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const facing = Math.max(0, Math.min(1, 0.5 + (y1 - y0) / 4));
    const band = ctx.createLinearGradient(0, Math.min(y0, y1), 0, Math.min(y0, y1) + 14);
    band.addColorStop(0, `rgba(${lit},${0.1 + 0.28 * facing})`);
    band.addColorStop(1, `rgba(${lit},0)`);
    ctx.fillStyle = band;
    ctx.fillRect(x0, Math.min(y0, y1) - 1, x1 - x0 + 0.5, 16);
    if (facing < 0.4) {
      ctx.fillStyle = `rgba(40,24,12,${(0.4 - facing) * 0.35})`;
      ctx.fillRect(x0, Math.min(y0, y1) + 4, x1 - x0 + 0.5, HY - Math.min(y0, y1));
    }
  }
  ctx.restore();
}

/** The storm's smoke: dark columns leaning with the wind from fires on the skyline (three every 150 px), and a low pall. */
function paintSmoke(ctx: CanvasRenderingContext2D, e: Extent): void {
  const pall = ctx.createLinearGradient(0, HY - 120, 0, HY);
  pall.addColorStop(0, "rgba(30,20,22,0)");
  pall.addColorStop(1, "rgba(30,20,22,0.45)");
  ctx.fillStyle = pall;
  ctx.fillRect(e.x0, HY - 120, e.x1 - e.x0, 120);
  const period = 150;
  for (let base = Math.floor(e.x0 / period) * period - period; base <= e.x1 + period; base += period) {
    const k = (((base / period) % 3) + 3) % 3;
    const x = base + [40, 95, 120][k]!;
    const tall = [150, 110, 175][k]!;
    // The fire at the column's foot, lighting the smoke above it.
    const fire = ctx.createRadialGradient(x, HY - 6, 0, x, HY - 6, 26);
    fire.addColorStop(0, "rgba(255,140,60,0.5)");
    fire.addColorStop(1, "rgba(255,90,40,0)");
    ctx.fillStyle = fire;
    ctx.beginPath();
    ctx.arc(x, HY - 6, 26, 0, Math.PI * 2);
    ctx.fill();
    // Billows with volume: each a dark core, a lit crown up-wind and a warm underside near the fire.
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const r = 8 + t * 26;
      const cx = x + t * t * 70 + (hash01(base * 13 + i) - 0.5) * 10 * t;
      const cy = HY - 8 - t * tall;
      const a = 0.66 - t * 0.38;
      const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      body.addColorStop(0, `rgba(${118 - i * 3},${100 - i * 3},${98 - i * 3},${a})`);
      body.addColorStop(0.55, `rgba(${46 + i * 2},${36 + i * 2},${38 + i * 2},${a})`);
      body.addColorStop(1, `rgba(${30 + i * 2},${22 + i * 2},${24 + i * 2},${a * 0.6})`);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      if (i < 5) {
        const warm = ctx.createLinearGradient(0, cy + r, 0, cy - r * 0.2);
        warm.addColorStop(0, `rgba(255,128,60,${0.32 * (1 - i / 5)})`);
        warm.addColorStop(1, "rgba(255,128,60,0)");
        ctx.fillStyle = warm;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/* ------------------------------------------------------------ materials */

/** A fixed hash in 0…1 (display only: the same speckles every paint, so the cached layers are stable). */
function hash01(n: number): number {
  let h = (n * 374761393 + 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The road's half width at the wall (world px) and at view y. */
const ROAD_HALF = 192;
function roadHalfAt(y: number): number {
  const t = Math.max(0, Math.min(1, (y - HY) / (BT2_WALL_Y - HY)));
  return ROAD_HALF * (0.04 + 0.96 * t);
}

/** Each setting's asphalt (far, near) and its line paint. */
const ASPHALT = [
  { far: "#8C9096", near: "#6E7177", line: "234,230,218", dust: 0 },
  { far: "#958A74", near: "#71685A", line: "236,226,200", dust: 0.2 },
  { far: "#6F6764", near: "#57504D", line: "226,214,196", dust: 0.1 },
] as const;

/**
 * The road as asphalt (Action overhaul's materials pass, display only): a mid-grey surface lighter toward the horizon,
 * fine aggregate speckles and tar patches shrinking with distance, darker worn tyre lanes, solid worn edge lines and
 * worn dashed dividers, and sand drifting over the shoulders in the dust. Tanks stay the darkest thing on it.
 */
function paintRoad(ctx: CanvasRenderingContext2D, setting: BtSetting): void {
  const a = ASPHALT[setting];
  const surface = ctx.createLinearGradient(0, HY, 0, BT2_WALL_Y);
  surface.addColorStop(0, a.far);
  surface.addColorStop(1, a.near);
  ctx.fillStyle = surface;
  ctx.beginPath();
  ctx.moveTo(BT2_VP_X - ROAD_HALF * 0.04, HY + 1);
  ctx.lineTo(BT2_VP_X + ROAD_HALF * 0.04, HY + 1);
  ctx.lineTo(BT2_VP_X + ROAD_HALF, BT2_WALL_Y);
  ctx.lineTo(BT2_VP_X - ROAD_HALF, BT2_WALL_Y);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Worn tyre lanes: two darker bands either side of each lane's centre.
  for (const lx of BT2_LANE_X)
    for (const off of [-30, 30]) {
      const x = lx + off;
      ctx.fillStyle = "rgba(20,20,24,0.10)";
      ctx.beginPath();
      ctx.moveTo(BT2_VP_X + (x - 9) * 0.04, HY + 1);
      ctx.lineTo(BT2_VP_X + (x + 9) * 0.04, HY + 1);
      ctx.lineTo(BT2_VP_X + x + 9, BT2_WALL_Y);
      ctx.lineTo(BT2_VP_X + x - 9, BT2_WALL_Y);
      ctx.closePath();
      ctx.fill();
    }
  // Aggregate: light and dark speckles, more and bigger toward the wall (perspective).
  for (let i = 0; i < 2600; i++) {
    const t = Math.pow(hash01(i * 3 + 1), 0.55);
    const y = HY + 2 + t * (BT2_WALL_Y - HY - 2);
    const half = roadHalfAt(y);
    const x = BT2_VP_X + (hash01(i * 3 + 2) * 2 - 1) * half;
    const sz = 0.5 + t * 1.6;
    const light = hash01(i * 3 + 3) < 0.45;
    ctx.fillStyle = light ? "rgba(235,235,240,0.16)" : "rgba(10,10,14,0.20)";
    ctx.fillRect(x, y, sz, sz * 0.6);
  }
  // Tar patches and cracks: a few dark seams across the surface.
  ctx.strokeStyle = "rgba(18,18,22,0.30)";
  for (let i = 0; i < 14; i++) {
    const t = 0.25 + 0.75 * hash01(i + 900);
    const y = HY + t * (BT2_WALL_Y - HY);
    const half = roadHalfAt(y);
    const x0 = BT2_VP_X + (hash01(i + 950) * 1.6 - 0.8) * half;
    ctx.lineWidth = 0.6 + t * 0.9;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + (hash01(i + 970) - 0.5) * 50 * t, y + (hash01(i + 990) - 0.3) * 8 * t);
    ctx.lineTo(x0 + (hash01(i + 1010) - 0.5) * 90 * t, y + (hash01(i + 1030) - 0.2) * 12 * t);
    ctx.stroke();
  }
  // Sand blown over the shoulders (the dust and the storm).
  if (a.dust > 0)
    for (const side of [-1, 1]) {
      const g = ctx.createLinearGradient(BT2_VP_X + side * ROAD_HALF, 0, BT2_VP_X + side * (ROAD_HALF - 70), 0);
      g.addColorStop(0, `rgba(196,164,112,${a.dust * 1.6})`);
      g.addColorStop(1, "rgba(196,164,112,0)");
      ctx.fillStyle = g;
      ctx.fillRect(BT2_VP_X - ROAD_HALF, HY, ROAD_HALF * 2, BT2_WALL_Y - HY);
    }
  ctx.restore();
  // Solid edge lines, worn in places.
  for (const side of [-1, 1])
    for (let k = 0; k < 40; k++) {
      const t0 = k / 40;
      const t1 = (k + 1) / 40;
      const wear = 0.45 + 0.45 * hash01(k * 7 + (side > 0 ? 3 : 5));
      const y0 = HY + 1 + t0 * (BT2_WALL_Y - HY - 1);
      const y1 = HY + 1 + t1 * (BT2_WALL_Y - HY - 1);
      const w0 = 0.5 + 2.2 * t0;
      const w1 = 0.5 + 2.2 * t1;
      const in0 = roadHalfAt(y0) - 6 * t0;
      const in1 = roadHalfAt(y1) - 6 * t1;
      ctx.fillStyle = `rgba(${a.line},${wear})`;
      ctx.beginPath();
      ctx.moveTo(BT2_VP_X + side * in0, y0);
      ctx.lineTo(BT2_VP_X + side * (in0 - w0), y0);
      ctx.lineTo(BT2_VP_X + side * (in1 - w1), y1);
      ctx.lineTo(BT2_VP_X + side * in1, y1);
      ctx.closePath();
      ctx.fill();
    }
  // The dashed lane dividers, worn paint.
  let n = 0;
  for (const lx of [(BT2_LANE_X[0] + BT2_LANE_X[1]) / 2, (BT2_LANE_X[1] + BT2_LANE_X[2]) / 2]) {
    for (let z = 40; z < BT2_FAR + 400; z += 90) {
      const sa = btViewS(bastionScale256(z * 256) / 256);
      const sb = btViewS(bastionScale256((z + 40) * 256) / 256);
      const ya = HY + (BT2_WALL_Y - HY) * sa;
      const yb = HY + (BT2_WALL_Y - HY) * sb;
      const w = Math.max(0.6, 2.4 * sa);
      ctx.fillStyle = `rgba(${a.line},${0.62 + 0.3 * hash01(n++ + 400)})`;
      ctx.beginPath();
      ctx.moveTo(BT2_VP_X + lx * sa - w, ya);
      ctx.lineTo(BT2_VP_X + lx * sa + w, ya);
      ctx.lineTo(BT2_VP_X + lx * sb + w * 0.8, yb);
      ctx.lineTo(BT2_VP_X + lx * sb - w * 0.8, yb);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** A burning wreck's smoke plume: billows growing and drifting with the wind, lit warm from the fire below. */
function paintWreckPlume(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number): void {
  const tall = (120 + 80 * hash01(seed)) * Math.max(0.35, s);
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const r = (6 + t * 22) * Math.max(0.4, s);
    const cx = x + t * t * 50 * Math.max(0.4, s) + (hash01(seed + i) - 0.5) * 6;
    const cy = y - t * tall;
    const a = 0.7 - t * 0.45;
    const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    body.addColorStop(0, `rgba(${112 - i * 4},${96 - i * 4},${94 - i * 4},${a})`);
    body.addColorStop(0.6, `rgba(${44 + i * 2},${34 + i * 2},${36 + i * 2},${a})`);
    body.addColorStop(1, `rgba(${30 + i * 2},${22 + i * 2},${24 + i * 2},${a * 0.5})`);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const fire = ctx.createRadialGradient(x, y + 4 * s, 0, x, y + 4 * s, 16 * Math.max(0.4, s));
  fire.addColorStop(0, "rgba(255,170,80,0.7)");
  fire.addColorStop(1, "rgba(255,90,40,0)");
  ctx.fillStyle = fire;
  ctx.beginPath();
  ctx.arc(x, y + 4 * s, 16 * Math.max(0.4, s), 0, Math.PI * 2);
  ctx.fill();
}

/** The field's grain: sand speckles and ripples, finer toward the horizon (fixed, display only). */
function paintFieldGrain(ctx: CanvasRenderingContext2D, e: Extent, setting: BtSetting): void {
  const span = BT2_WALL_Y - HY;
  const w = e.x1 - e.x0;
  const count = Math.round((w / 390) * 2200);
  for (let i = 0; i < count; i++) {
    const t = Math.pow(hash01(i * 5 + 11), 0.6);
    const y = HY + 1 + t * span;
    const x = e.x0 + hash01(i * 5 + 12) * w;
    const sz = 0.5 + t * 1.8;
    const light = hash01(i * 5 + 13) < 0.5;
    ctx.fillStyle = light ? (setting === 2 ? "rgba(220,150,110,0.10)" : "rgba(255,240,210,0.13)") : "rgba(30,22,14,0.16)";
    ctx.fillRect(x, y, sz, sz * 0.55);
  }
  // Wind ripples: short soft lines, lit on their tops.
  for (let i = 0; i < Math.round((w / 390) * 70); i++) {
    const t = 0.2 + 0.8 * hash01(i * 7 + 501);
    const y = HY + t * span;
    const x = e.x0 + hash01(i * 7 + 502) * w;
    const len = 10 + 40 * t;
    ctx.strokeStyle = `rgba(255,236,200,${0.06 + 0.06 * t})`;
    ctx.lineWidth = 0.6 + t;
    ctx.beginPath();
    ctx.moveTo(x - len / 2, y);
    ctx.quadraticCurveTo(x, y - 2 * t, x + len / 2, y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(20,14,8,${0.07 + 0.06 * t})`;
    ctx.beginPath();
    ctx.moveTo(x - len / 2, y + 1.2 * t);
    ctx.quadraticCurveTo(x, y - 0.8 * t, x + len / 2, y + 1.2 * t);
    ctx.stroke();
  }
}

/* -------------------------------------------------------------- scenery */

/**
 * Lane-edge scenery (display only, painted once with the backdrop): each item sits at a fixed depth and a fixed distance
 * out from the vanishing point at scale 1, always at least 214 px out (the road's edge is 192 px out at the wall and the
 * outer lanes' hulls end 175 px out), so nothing ever covers a lane or a shot. The list repeats outward for wide scenes.
 */
type SceneryKind = "rock" | "wall" | "scrub" | "trap" | "wreck";
export const BT_SCENERY: readonly (readonly [side: -1 | 1, out: number, z: number, kind: SceneryKind])[] = [
  [-1, 236, 70, "wall"],
  [1, 230, 110, "trap"],
  [1, 300, 40, "rock"],
  [-1, 262, 260, "scrub"],
  [1, 250, 300, "wreck"],
  [-1, 224, 420, "trap"],
  [-1, 330, 520, "rock"],
  [1, 236, 560, "scrub"],
  [-1, 270, 700, "wreck"],
  [1, 226, 760, "trap"],
  [1, 300, 900, "wall"],
  [-1, 230, 980, "rock"],
  [-1, 250, 1160, "scrub"],
  [1, 240, 1240, "rock"],
  [-1, 420, 180, "rock"],
  [1, 440, 220, "scrub"],
  [-1, 480, 620, "wall"],
  [1, 470, 640, "trap"],
  [-1, 560, 120, "scrub"],
  [1, 600, 90, "wall"],
  [-1, 640, 380, "trap"],
  [1, 620, 460, "rock"],
];

function paintScenery(ctx: CanvasRenderingContext2D, e: Extent, setting: BtSetting = 0): void {
  // The skyline's ruins first (behind the field; not among the desert's dunes), then the items far to near.
  if (setting !== 1) paintRuins(ctx, e);
  const items = [...BT_SCENERY].sort((a, b) => b[2] - a[2]);
  for (const [side, out, z, kind] of items) {
    const s = btViewS(bastionScale256(z * 256) / 256);
    const y = HY + (BT2_WALL_Y - HY) * s;
    const x = BT2_VP_X + side * out * s;
    if (x < e.x0 - 120 * s || x > e.x1 + 120 * s) continue;
    if (kind === "rock") paintRock(ctx, x, y, s, side);
    else if (kind === "wall") paintBrokenWall(ctx, x, y, s, side);
    else if (kind === "scrub") paintScrub(ctx, x, y, s);
    else if (kind === "trap") paintTankTrap(ctx, x, y, s);
    else {
      paintWreck(ctx, x, y, s, side);
      // In the storm every wreck burns: a smoke plume with volume rising off it (behind the tanks, in the backdrop).
      if (setting === 2) paintWreckPlume(ctx, x, y - 8 * s, s, z);
    }
  }
}

/** Ruined buildings and a broken tower on the skyline, in front of the peaks (a pattern repeating every 360 px). */
function paintRuins(ctx: CanvasRenderingContext2D, e: Extent): void {
  const shapes: readonly (readonly [x: number, w: number, h: number, broken: number])[] = [
    [18, 22, 14, 1],
    [44, 10, 30, 2],
    [58, 26, 10, 0],
    [128, 18, 18, 1],
    [150, 12, 9, 0],
    [252, 30, 12, 1],
    [288, 8, 22, 2],
    [300, 16, 8, 0],
  ];
  ctx.fillStyle = "#30363F";
  const period = 360;
  for (let base = Math.floor(e.x0 / period) * period; base < e.x1 + period; base += period) {
    for (const [ox, w, h, broken] of shapes) {
      const x = base + ox;
      // Keep the vanishing point's few pixels clear (the tanks roll out there).
      if (Math.abs(x + w / 2 - BT2_VP_X) < 34) continue;
      ctx.beginPath();
      ctx.moveTo(x, HY + 1);
      ctx.lineTo(x, HY - h);
      if (broken === 1) {
        ctx.lineTo(x + w * 0.3, HY - h + 3);
        ctx.lineTo(x + w * 0.5, HY - h - 2);
        ctx.lineTo(x + w * 0.75, HY - h * 0.55);
      } else if (broken === 2) {
        ctx.lineTo(x + w * 0.6, HY - h - 3);
        ctx.lineTo(x + w, HY - h * 0.7);
      }
      ctx.lineTo(x + w, HY - (broken ? h * 0.4 : h));
      ctx.lineTo(x + w, HY + 1);
      ctx.closePath();
      ctx.fill();
      // Empty windows, a few dusk-lit.
      if (w >= 16 && h >= 10) {
        for (let wx = x + 3; wx < x + w - 4; wx += 6) {
          ctx.fillStyle = (wx + h) % 4 === 0 ? "rgba(255,170,90,0.35)" : "rgba(14,16,21,0.6)";
          ctx.fillRect(wx, HY - h + 4, 2, 3);
        }
        ctx.fillStyle = "#30363F";
      }
    }
  }
}

function paintRock(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, side: number): void {
  const w = 30 * s + 2;
  const h = 16 * s + 1;
  ctx.fillStyle = "rgba(20,16,12,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.62, h * 0.18 + 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#575049";
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w * 0.42, y - h * 0.55);
  ctx.lineTo(x - w * 0.12, y - h);
  ctx.lineTo(x + w * 0.24, y - h * 0.82);
  ctx.lineTo(x + w / 2, y - h * 0.3);
  ctx.lineTo(x + w * 0.46, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = side > 0 ? "#6E665C" : "#433D37";
  ctx.beginPath();
  ctx.moveTo(x - w * 0.12, y - h);
  ctx.lineTo(x + w * 0.24, y - h * 0.82);
  ctx.lineTo(x + w * 0.1, y - h * 0.4);
  ctx.lineTo(x - w * 0.3, y - h * 0.5);
  ctx.closePath();
  ctx.fill();
}

function paintBrokenWall(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, side: number): void {
  const w = 54 * s + 2;
  const h = 22 * s + 1;
  const x0 = x - w / 2;
  ctx.fillStyle = "#4C4540";
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x0, y - h * 0.7);
  ctx.lineTo(x0 + w * 0.18, y - h);
  ctx.lineTo(x0 + w * 0.32, y - h * 0.86);
  ctx.lineTo(x0 + w * 0.42, y - h * 0.94);
  ctx.lineTo(x0 + w * 0.55, y - h * 0.45);
  ctx.lineTo(x0 + w * 0.7, y - h * 0.52);
  ctx.lineTo(x0 + w * 0.82, y - h * 0.2);
  ctx.lineTo(x0 + w, y - h * 0.24);
  ctx.lineTo(x0 + w, y);
  ctx.closePath();
  ctx.fill();
  // Courses of stone and a lit face.
  if (s > 0.35) {
    ctx.strokeStyle = "rgba(24,20,18,0.55)";
    ctx.lineWidth = Math.max(0.6, s);
    for (let k = 1; k <= 3; k++) {
      const yy = y - (h * k) / 4;
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.lineTo(x0 + w * (1 - k * 0.2), yy);
      ctx.stroke();
    }
  }
  ctx.fillStyle = side > 0 ? "rgba(255,190,130,0.12)" : "rgba(0,0,0,0.15)";
  ctx.fillRect(x0, y - h * 0.7, w * 0.08, h * 0.7);
  // Rubble at its foot.
  ctx.fillStyle = "#3E3833";
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.arc(x0 + w * (0.5 + k * 0.16), y - 1.5 * s, (2.5 + (k % 2)) * s + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintScrub(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.strokeStyle = "#4A5131";
  ctx.lineWidth = Math.max(0.7, 1.6 * s);
  ctx.lineCap = "round";
  for (let k = -3; k <= 3; k++) {
    const h = (12 + ((k * 7 + 9) % 6)) * s + 1;
    ctx.beginPath();
    ctx.moveTo(x + k * 3 * s, y);
    ctx.lineTo(x + k * 5.5 * s, y - h);
    ctx.stroke();
  }
  ctx.fillStyle = "#3B4128";
  ctx.beginPath();
  ctx.ellipse(x, y - 2 * s, 12 * s + 1, 4 * s + 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = "butt";
}

/** A steel hedgehog: three crossed beams. */
function paintTankTrap(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const h = 20 * s + 1;
  const w = 22 * s + 1;
  ctx.strokeStyle = "#2B2D31";
  ctx.lineWidth = Math.max(1, 3.4 * s);
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x + w / 2, y - h);
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x - w / 2, y - h);
  ctx.moveTo(x - w * 0.12, y - h * 0.08);
  ctx.lineTo(x + w * 0.12, y - h * 0.92);
  ctx.stroke();
  ctx.strokeStyle = "rgba(200,140,90,0.35)";
  ctx.lineWidth = Math.max(0.5, 1.2 * s);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.stroke();
  ctx.lineCap = "butt";
}

/** A burnt-out tank: a charred hull, its turret knocked askew, the barrel drooping, a thin static smoke wisp. */
function paintWreck(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, side: number): void {
  const w = 78 * s + 2;
  const h = 26 * s + 1;
  ctx.fillStyle = "rgba(18,14,12,0.45)";
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.6, h * 0.2 + 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1E1B1A";
  ctx.fillRect(x - w / 2, y - h * 0.38, w, h * 0.38);
  ctx.fillStyle = "#2F2925";
  ctx.beginPath();
  ctx.moveTo(x - w * 0.46, y - h * 0.38);
  ctx.lineTo(x - w * 0.38, y - h * 0.78);
  ctx.lineTo(x + w * 0.4, y - h * 0.74);
  ctx.lineTo(x + w * 0.5, y - h * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.translate(x - side * w * 0.08, y - h * 0.78);
  ctx.rotate(side * 0.22);
  ctx.fillStyle = "#3A322C";
  ctx.fillRect(-w * 0.17, -h * 0.4, w * 0.34, h * 0.4);
  ctx.strokeStyle = "#2A2420";
  ctx.lineWidth = Math.max(1, 3 * s);
  ctx.beginPath();
  ctx.moveTo(side * w * 0.15, -h * 0.22);
  ctx.lineTo(side * w * 0.5, h * 0.12);
  ctx.stroke();
  ctx.restore();
  // Rust and soot.
  ctx.fillStyle = "rgba(140,70,40,0.4)";
  ctx.fillRect(x - w * 0.2, y - h * 0.62, w * 0.16, h * 0.18);
  ctx.fillStyle = "rgba(255,120,50,0.35)";
  ctx.beginPath();
  ctx.arc(x + w * 0.12, y - h * 0.5, 2 * s + 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(60,60,66,0.28)";
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.arc(x + side * k * 6 * s, y - h - k * 9 * s, (6 + k * 3) * s + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ----------------------------------------------------------------- drones */

/**
 * A drone (bastionRev 3) exactly on its rectangle (bastionDroneRect: 24 × 10 round its centre): a dark delta body with a
 * gunmetal top, two rotor pods with their blur, a camera pod and a blinking red light at the nose.
 */
export function paintDrone(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, tick: number, still: boolean): void {
  const [x0, y0, x1, y1] = bastionDroneRect(x, y);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2 + 0.5;
  // Rotor arms and pods.
  ctx.fillStyle = "#1B1E24";
  ctx.fillRect(x0 + 3, cy - 2, x1 - x0 - 6, 1.6);
  for (const px of [x0 + 3.5, x1 - 3.5]) {
    ctx.fillStyle = "#262A32";
    ctx.beginPath();
    ctx.arc(px, cy - 1.5, 2, 0, Math.PI * 2);
    ctx.fill();
    // Rotor blur on top.
    ctx.fillStyle = still ? "rgba(215,225,238,0.6)" : `rgba(215,225,238,${0.45 + 0.08 * ((tick + Math.round(px)) % 3)})`;
    ctx.beginPath();
    ctx.ellipse(px, y0 + 1.3, 3.3, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // A short pale exhaust streak behind the tail (inside the rectangle), so it reads against the dusk.
  const streak = ctx.createLinearGradient(cx - dir * 7, 0, cx - dir * 12, 0);
  streak.addColorStop(0, "rgba(255,190,120,0.8)");
  streak.addColorStop(1, "rgba(255,190,120,0)");
  ctx.fillStyle = streak;
  ctx.fillRect(Math.min(cx - dir * 7, cx - dir * 12), cy - 0.8, 5, 1.6);
  // The body: a gunmetal delta with a pale keyline, nose toward the way it flies, a lit top.
  ctx.fillStyle = "#3E4450";
  ctx.beginPath();
  ctx.moveTo(cx + dir * 7, cy);
  ctx.lineTo(cx - dir * 5, cy - 3);
  ctx.lineTo(cx - dir * 7, cy);
  ctx.lineTo(cx - dir * 5, cy + 2.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(225,232,242,0.85)";
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.fillStyle = "#AAB3C1";
  ctx.beginPath();
  ctx.moveTo(cx + dir * 5, cy - 0.5);
  ctx.lineTo(cx - dir * 4, cy - 2.6);
  ctx.lineTo(cx - dir * 4, cy - 0.8);
  ctx.closePath();
  ctx.fill();
  // Camera pod under the body.
  ctx.fillStyle = "#15171C";
  ctx.beginPath();
  ctx.arc(cx + dir, y1 - 1.8, 1.6, 0, Math.PI * 2);
  ctx.fill();
  // The blinking light at the nose.
  const on = still || Math.floor(tick / 8) % 2 === 0;
  ctx.save();
  if (on) {
    ctx.shadowColor = "#FF3B30";
    ctx.shadowBlur = 6;
  }
  ctx.fillStyle = on ? "#FF4A3D" : "#6A1E1A";
  ctx.beginPath();
  ctx.arc(cx + dir * 6, cy - 0.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The parapet: dark stone from the wall's line down, with a lit lip, and below the world the panel's colour. */
function paintWall(ctx: CanvasRenderingContext2D, e: Extent): void {
  const wx = e.x1 - e.x0;
  const face = ctx.createLinearGradient(0, BT2_WALL_Y, 0, BT2_PANEL_Y);
  face.addColorStop(0, "#2A2F38");
  face.addColorStop(1, "#1C1F26");
  ctx.fillStyle = face;
  ctx.fillRect(e.x0, BT2_WALL_Y, wx, BT2_PANEL_Y - BT2_WALL_Y);
  // Cast concrete (materials pass): block joints, pitted grain and a lit coping along the top.
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  for (let x = Math.floor(e.x0 / 64) * 64; x < e.x1; x += 64) ctx.fillRect(x, BT2_WALL_Y + 3, 1.5, BT2_PANEL_Y - BT2_WALL_Y - 3);
  for (let i = 0; i < Math.round(wx * 1.4); i++) {
    const x = e.x0 + hash01(i * 3 + 7001) * wx;
    const y = BT2_WALL_Y + 4 + hash01(i * 3 + 7002) * (BT2_PANEL_Y - BT2_WALL_Y - 5);
    ctx.fillStyle = hash01(i * 3 + 7003) < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.18)";
    ctx.fillRect(x, y, 1.2, 0.8);
  }
  const coping = ctx.createLinearGradient(0, BT2_WALL_Y, 0, BT2_WALL_Y + 4);
  coping.addColorStop(0, "#8A93A2");
  coping.addColorStop(1, "#3A404B");
  ctx.fillStyle = coping;
  ctx.fillRect(e.x0, BT2_WALL_Y, wx, 4);
  // The bottom panel: navy, with a champagne-gold rule on its top edge (the controls' colours).
  const panel = ctx.createLinearGradient(0, BT2_PANEL_Y, 0, H);
  panel.addColorStop(0, PANEL_TOP);
  panel.addColorStop(1, PANEL_BOTTOM);
  ctx.fillStyle = panel;
  ctx.fillRect(e.x0, BT2_PANEL_Y, wx, Math.max(H, e.y1) - BT2_PANEL_Y);
  ctx.fillStyle = "rgba(226,192,122,0.45)";
  ctx.fillRect(e.x0, BT2_PANEL_Y, wx, 1.5);
}

/* ----------------------------------------------------------------- tanks */

/** A hex colour scaled toward white (k > 1) or black (k < 1), as a hex string. */
function shadeHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** A tank's shadow on the ground: a soft ellipse under its tracks, no wider than its hull. */
export function paintTankShadow(ctx: CanvasRenderingContext2D, kind: number, lane: number, z: number): void {
  const r = bastionTankRects(kind, lane, z);
  const hw = r.hull[2] - r.hull[0];
  ctx.fillStyle = "rgba(14,10,8,0.32)";
  ctx.beginPath();
  ctx.ellipse(r.cx, r.hull[3], hw * 0.5, Math.min(2, Math.max(0.8, hw * 0.05)), 0, 0, Math.PI * 2);
  ctx.fill();
}

/** The far tanks' fog colour, the setting's (set by the world each frame before its tanks; display only). */
let tankFog: string = BT_SETTING_LOOK[0].fog;

/** Each type's badge: its letter and ring colour (Scout, Medium, Heavy). */
export const BT_BADGES = [
  { letter: "S", name: "Scout", ring: "#8FD6A0" },
  { letter: "M", name: "Medium", ring: "#E2C07A" },
  { letter: "H", name: "Heavy", ring: "#FF8A6A" },
] as const;
/** From this depth (world px from the wall) a tank is far: it gets the light outline, fading in over the next 200 px, and its type badge. */
export const BT_FAR_MARK_Z = 620;
/** The badge's size (view px) and its letter's size: never under 10 px, readable at the horizon. */
export const BT_BADGE_W = 16;
export const BT_BADGE_H = 15;
export const BT_BADGE_FONT = 11;

/** How strongly a tank at depth z (1/256 px) is outlined (0 near, rising to 1 from BT_FAR_MARK_Z). */
export function bastionFarMark(z256: number): number {
  return Math.max(0, Math.min(1, (z256 / 256 - BT_FAR_MARK_Z + 160) / 200));
}

/** The far tank's light outline: a thin pale line round its hull and turret, on their edges (inside the 2 px bounds). */
export function paintTankOutline(ctx: CanvasRenderingContext2D, kind: number, lane: number, z: number): void {
  const k = bastionFarMark(z);
  if (k <= 0) return;
  const r = bastionTankRects(kind, lane, z);
  ctx.save();
  ctx.strokeStyle = `rgba(255,246,226,${0.75 * k})`;
  ctx.lineWidth = 1.1;
  ctx.lineJoin = "round";
  const [hx0, hy0, hx1, hy1] = r.hull;
  const [tx0, ty0, tx1, ty1] = r.turret;
  ctx.beginPath();
  ctx.moveTo(hx0, hy1);
  ctx.lineTo(hx0, hy0);
  ctx.lineTo(Math.max(hx0, tx0), hy0);
  ctx.lineTo(tx0, ty0);
  ctx.lineTo(tx1, ty0);
  ctx.lineTo(Math.min(hx1, tx1), hy0);
  ctx.lineTo(hx1, hy0);
  ctx.lineTo(hx1, hy1);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** Where a far tank's badge sits in the view: centred over its health pips (null for a near tank). */
export function bastionBadgeBox(kind: number, lane: number, z: number): { x: number; y: number; w: number; h: number } | null {
  if (z / 256 < BT_FAR_MARK_Z) return null;
  const r = bastionTankRects(kind, lane, z);
  const s = r.s256 / 256;
  const ph = Math.max(2, Math.round(4 * s + 1.5));
  const pipTop = r.turret[1] - ph - Math.max(2, Math.round(7 * s)) - 1;
  const [a, , c, d, e, f] = btViewMatrix(r.cx, (r.turret[1] + r.ground) / 2);
  const x = a * r.cx + c * pipTop + e;
  const y = d * pipTop + f;
  return { x: x - BT_BADGE_W / 2, y: y - 3 - BT_BADGE_H, w: BT_BADGE_W, h: BT_BADGE_H };
}

/** A far tank's type badge (S, M or H on a dark chip with its type's ring), in view px, so it stays readable at the horizon. */
export function paintTankBadge(ctx: CanvasRenderingContext2D, kind: number, lane: number, z: number): void {
  const box = bastionBadgeBox(kind, lane, z);
  if (!box) return;
  const b = BT_BADGES[kind]!;
  const k = bastionFarMark(z);
  ctx.save();
  ctx.globalAlpha = Math.min(1, 0.4 + k);
  ctx.fillStyle = "rgba(8,10,16,0.82)";
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, 4);
  ctx.fill();
  ctx.strokeStyle = b.ring;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `800 ${BT_BADGE_FONT}px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(b.letter, box.x + box.w / 2, box.y + box.h / 2 + 0.5);
  ctx.restore();
}

function rect(ctx: CanvasRenderingContext2D, r: Bt2Rect): void {
  ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
}

/**
 * One tank on its rectangles: tracks with road wheels, the hull, the turret with its muzzle toward the wall, the weak
 * spot (a round orange vent on its square while exposed, a dark plate while closed), a hit's flash, haze on far ones and
 * the orange health pips above.
 */
export function paintTank(ctx: CanvasRenderingContext2D, kind: number, lane: number, z: number, hp: number, flash: number, tick: number, still: boolean, open = true, pips = true, mark = 0): void {
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
  // Painted metal (materials pass): the lit top plane of the hull, a crisp lit edge along its front, and the
  // track's links (all inside the hull's own rectangle).
  const topH = Math.max(1, (ty - hy0) * 0.34);
  const top = ctx.createLinearGradient(0, hy0, 0, hy0 + topH);
  top.addColorStop(0, "rgba(255,244,214,0.30)");
  top.addColorStop(1, "rgba(255,244,214,0.04)");
  ctx.fillStyle = top;
  ctx.fillRect(hx0 + inset, hy0, hw - inset * 2, topH);
  ctx.fillStyle = "rgba(255,248,226,0.42)";
  ctx.fillRect(hx0 + inset, hy0, hw - inset * 2, Math.max(0.6, hh * 0.035));
  if (hw > 10) {
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    const links = Math.max(4, Math.round(hw / Math.max(2.2, 3.4 * s)));
    for (let i = 0; i <= links; i++) ctx.fillRect(hx0 + (i * hw) / links - 0.3, ty, Math.max(0.5, 0.9 * s), hy1 - ty);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(hx0, ty, hw, Math.max(0.6, (hy1 - ty) * 0.18));
  }
  // Turret: a cast dome lit from above, its sides falling into shade, and a small specular glint.
  const [tx0, ty0, tx1, ty1] = r.turret;
  const tg = ctx.createLinearGradient(0, ty0, 0, ty1);
  tg.addColorStop(0, shadeHex(live.turret, 1.28));
  tg.addColorStop(0.55, live.turret);
  tg.addColorStop(1, live.shade);
  ctx.fillStyle = tg;
  ctx.beginPath();
  const ti = Math.max(1, Math.round((tx1 - tx0) * 0.12));
  ctx.moveTo(tx0 + ti, ty0);
  ctx.lineTo(tx1 - ti, ty0);
  ctx.lineTo(tx1, ty1);
  ctx.lineTo(tx0, ty1);
  ctx.closePath();
  ctx.fill();
  const tw = tx1 - tx0;
  const th = ty1 - ty0;
  if (tw > 5) {
    ctx.fillStyle = "rgba(255,255,248,0.62)";
    ctx.beginPath();
    ctx.ellipse(tx0 + ti + tw * 0.2, ty0 + th * 0.22, Math.max(0.6, tw * 0.11), Math.max(0.4, th * 0.09), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const mr = Math.max(0.8, Math.min(tx1 - tx0, ty1 - ty0) * 0.28);
  ctx.fillStyle = "#121317";
  ctx.beginPath();
  ctx.arc((tx0 + tx1) / 2, (ty0 + ty1) / 2, mr, 0, Math.PI * 2);
  ctx.fill();
  // Dents (stage 2): one for each hit point it has lost, a pressed crater with a lit lower rim and a scorch, at fixed
  // places for this tank (its plan index `mark`), all inside the hull's upper plates.
  const lost = Math.max(0, BT2_HP[kind]! - hp);
  if (lost > 0 && hw > 6) paintDents(ctx, hx0, hy0, hx1, ty, s, lost, kind * 7 + mark * 13);
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
    // A brief pale wash (stage 2: at most a third, so the sparks, the dents and the gold read through it; no glare).
    ctx.fillStyle = `rgba(255,248,232,${0.04 * flash})`;
    rect(ctx, [hx0, ty0, hx1, hy1]);
  }
  // Haze on the far ones.
  const fog = Math.max(0, Math.min(0.5, (z / 256 - 520) / 1500));
  if (fog > 0) {
    ctx.fillStyle = `rgba(${tankFog},${fog})`;
    rect(ctx, [hx0, ty0, hx1, hy1]);
  }
  // Health pips above the turret: one per hit point, orange while left (not on the tile icon).
  if (!pips) return;
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

/** The dents on a hull's upper plates (x0…x1, y0…y1 the plate band): inside it whatever the scale. */
export function paintDents(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, s: number, n: number, seed: number): void {
  const w = x1 - x0;
  const h = y1 - y0;
  const rx = Math.min(w * 0.12, 3.6 * s + 0.7);
  const ry = Math.min(h * 0.32, rx * 0.62);
  if (rx < 0.6 || ry < 0.4) return;
  for (let k = 0; k < n; k++) {
    const fx = 0.2 + 0.6 * hash01(seed * 31 + k * 7 + 1);
    const fy = 0.3 + 0.4 * hash01(seed * 31 + k * 7 + 2);
    const cx = x0 + rx + (w - 2 * rx) * fx;
    const cy = y0 + ry + (h - 2 * ry) * fy;
    // Scorch round the crater, the pressed hollow (darker at its top, lit along its lower rim where the light catches).
    ctx.fillStyle = "rgba(16,12,10,0.32)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, cy - ry * 0.7, 0, cy + ry * 0.7);
    g.addColorStop(0, "rgba(10,8,8,0.78)");
    g.addColorStop(0.65, "rgba(40,34,30,0.6)");
    g.addColorStop(1, "rgba(236,220,190,0.55)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.62, ry * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* -------------------------------------------------------------- effects */

/**
 * How long each landing's effect lasts (ticks; every one inside the sim's 60-tick impact memory and under 900 ms):
 * a hull hit's sparks 14, a weak-spot hit's gold flash 14, a kill's burst 16 with its debris 44 and "+n" 48, a miss's
 * puff 30 (a near miss's dusty puff and CLOSE 36).
 */
export const BT_FX_TICKS = { sparks: 14, gold: 14, burst: 16, debris: 44, points: 48, puff: 30, close: 36 } as const;
/** The weak spot's gold (every weak-spot hit flashes it, a kill on one too). */
export const BT_WEAK_GOLD = "#FFD15C";

/** Sparks off armour: short bright streaks flying out from the landing, shortening as they fade. */
function paintSparks(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, age: number, still: boolean, n: number, seed: number): void {
  const life = BT_FX_TICKS.sparks;
  if (age >= life) return;
  const k = age / life;
  const u = 0.5 + s;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(0.8, 1.4 * s + 0.4);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (hash01(seed + i * 3) - 0.5) * Math.PI * 1.6;
    const v = (2.2 + 2.4 * hash01(seed + i * 3 + 1)) * u;
    const d0 = still ? 3 * u : v * age;
    const len = (still ? 5 : 6 * (1 - k) + 1.5) * u;
    const gy = still ? 0 : 0.06 * age * age * u;
    const x0 = x + Math.cos(a) * d0;
    const y0 = y + Math.sin(a) * d0 + gy;
    ctx.strokeStyle = `rgba(255,${226 - Math.round(k * 80)},${170 - Math.round(k * 120)},${1 - k})`;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 - Math.cos(a) * len, y0 - Math.sin(a) * len);
    ctx.stroke();
  }
  // The strike itself: a small white-hot point for the first few ticks.
  if (age < 4) {
    ctx.fillStyle = `rgba(255,250,236,${1 - age / 4})`;
    ctx.beginPath();
    ctx.arc(x, y, (2.6 - age * 0.4) * u, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A weak-spot hit: the vent flashes gold (a solid disc, then a ring opening out), every time. */
function paintGoldFlash(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, age: number, still: boolean): void {
  const life = BT_FX_TICKS.gold;
  if (age >= life) return;
  const k = age / life;
  const r0 = Math.max(3, 7 * s + 1.5);
  ctx.save();
  ctx.fillStyle = `rgba(255,209,92,${(1 - k) * 0.95})`;
  ctx.beginPath();
  ctx.arc(x, y, r0 * (still ? 1 : 1 - 0.4 * k), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,248,214,${(1 - k) * 0.9})`;
  ctx.beginPath();
  ctx.arc(x, y, r0 * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,209,92,${1 - k})`;
  ctx.lineWidth = Math.max(1, 2 * s);
  ctx.beginPath();
  ctx.arc(x, y, r0 * (still ? 1.5 : 1.2 + 1.4 * k), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** A tank destroyed: a short burst of flame petals, armour debris flung out and falling, then the smoke. */
function paintKillBurst(ctx: CanvasRenderingContext2D, m: Bt2Impact, age: number, still: boolean, lite: boolean): void {
  const s = m.s256 / 256;
  const u = 0.45 + s;
  if (age < BT_FX_TICKS.burst) {
    const k = age / BT_FX_TICKS.burst;
    const petals = 9;
    const reach = (still ? 16 : 8 + 18 * Math.sqrt(k)) * u;
    ctx.save();
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2 + hash01(m.t + i) * 0.5;
      const len = reach * (0.7 + 0.5 * hash01(m.t * 3 + i));
      const w = 4.2 * u * (1 - k * 0.6);
      ctx.fillStyle = i % 2 ? `rgba(255,150,60,${1 - k})` : `rgba(255,206,110,${1 - k})`;
      ctx.beginPath();
      ctx.moveTo(m.x + Math.cos(a + 1.57) * w, m.y + Math.sin(a + 1.57) * w);
      ctx.lineTo(m.x + Math.cos(a) * len, m.y + Math.sin(a) * len * 0.8);
      ctx.lineTo(m.x + Math.cos(a - 1.57) * w, m.y + Math.sin(a - 1.57) * w);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = `rgba(255,246,222,${1 - k})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 6 * u * (1 - k * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Debris: chunks of armour plate in the tank's livery, spinning out on arcs and falling (none under reduced motion).
  if (!still && age < BT_FX_TICKS.debris) {
    const k = age / BT_FX_TICKS.debris;
    const n = lite ? 4 : 8;
    const live = LIVERY[m.kind] ?? LIVERY[0];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (hash01(m.t * 7 + i) - 0.5) * Math.PI * 1.5;
      const v = (1.4 + 1.8 * hash01(m.t * 7 + i + 50)) * u;
      const x = m.x + Math.cos(a) * v * age;
      const y = m.y + Math.sin(a) * v * age + 0.05 * age * age * u;
      const sz = (2 + 2.5 * hash01(m.t + i * 11)) * u;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.translate(x, y);
      ctx.rotate(age * (0.25 + 0.2 * hash01(i + 9)) * (i % 2 ? 1 : -1));
      ctx.fillStyle = i % 3 === 0 ? live.turret : i % 3 === 1 ? live.shade : "#2A2C31";
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
      // Lit along its top edge: painted plate, not a dot.
      ctx.fillStyle = "rgba(255,240,210,0.45)";
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, Math.max(0.5, sz * 0.18));
      ctx.restore();
    }
  }
  // The wreck's smoke rising after the flash.
  if (age > 8) {
    const k = age / 50;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.55 - k * 0.55);
    ctx.fillStyle = "#2A2228";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(m.x + (i - 1) * 6 * s, m.y - (still ? 6 : (age - 8) * 0.6 * (0.5 + s)) - i * 4, (6 + (still ? 4 : age * 0.2)) * (0.4 + s), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function paintImpact(ctx: CanvasRenderingContext2D, m: Bt2Impact, tick: number, still: boolean, near = false, lite = false): void {
  const age = tick - m.t;
  if (age < 0 || age > 50) return;
  const s = m.s256 / 256;
  const k = age / 50;
  ctx.save();
  if (m.r === 5) {
    // A drone shot down: a white-hot pop, sparks and falling bits.
    const k2 = Math.min(1, age / 40);
    ctx.globalCompositeOperation = "lighter";
    const rad = still ? 16 : 6 + age * 0.9;
    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, rad);
    g.addColorStop(0, `rgba(255,250,230,${(1 - k2) * 0.95})`);
    g.addColorStop(0.4, `rgba(255,170,70,${(1 - k2) * 0.75})`);
    g.addColorStop(1, "rgba(255,80,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(m.x, m.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(40,44,52,${1 - k2})`;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const d = still ? 10 : age * 0.7;
      ctx.fillRect(m.x + Math.cos(a) * d, m.y + Math.sin(a) * d * 0.6 + (still ? 0 : age * age * 0.02), 2.4, 1.6);
    }
  } else if (m.r === 0 && m.y < BT2_HORIZON_Y) {
    // A miss in the sky: a flak puff.
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.fillStyle = "#3A3E46";
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const d = still ? 4 : 2 + age * 0.25;
      ctx.beginPath();
      ctx.arc(m.x + Math.cos(a) * d, m.y + Math.sin(a) * d, 4 + age * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    if (age < 6) {
      ctx.fillStyle = "rgba(255,190,90,0.85)";
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (m.r === 0) {
    // A miss: a dust puff where it landed; a near miss (within a tank-length of a tank) a bigger, dustier one.
    const life = near ? BT_FX_TICKS.close : BT_FX_TICKS.puff;
    if (age < life) {
      const kk = age / life;
      ctx.globalAlpha = (1 - kk) * (near ? 0.85 : 0.7);
      const puffs = near ? 8 : 5;
      for (let i = 0; i < puffs; i++) {
        const a = (i / puffs) * Math.PI * 2 + 0.3;
        const d = (still ? 4 : 3 + age * (near ? 0.65 : 0.5)) * (0.6 + s) * (near ? 1.3 : 1);
        ctx.fillStyle = near && i % 2 ? "#A88A6C" : "#8C6E58";
        ctx.beginPath();
        ctx.arc(m.x + Math.cos(a) * d, m.y - Math.abs(Math.sin(a)) * d * 0.7, (3 + age * (near ? 0.2 : 0.15)) * (0.5 + s) * (near ? 1.25 : 1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    const weak = m.r === 2 || m.r === 4;
    if (m.r >= 3) paintKillBurst(ctx, m, age, still, lite);
    else paintSparks(ctx, m.x, m.y, s, age, still, lite ? 4 : 8, m.t * 5 + Math.round(m.x));
    if (weak) paintGoldFlash(ctx, m.x, m.y, s, age, still);
  }
  void k;
  ctx.restore();
}

/** Words that rise off a landing in view px (a kill's "+n", a near miss's CLOSE): never under 14 px, on a dark outline. */
export function paintRiser(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, age: number, life: number, still: boolean, colour: string, size: number): void {
  if (age < 0 || age >= life) return;
  const fade = Math.min(1, (life - age) / 14);
  const rise = still ? 0 : 26 * (1 - (1 - age / life) ** 2);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.font = `800 ${size}px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(10,12,16,0.85)";
  ctx.strokeText(text, x, y - rise);
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y - rise);
  ctx.restore();
}

/* ------------------------------------------------------------------- HUD */

/** The bar's left edge and width (world px), shared by the shells' slots. */
const BAR_X = 96;
const BAR_W = 278;

function paintHud(ctx: CanvasRenderingContext2D, state: BastionTankState, memory: BtMemory | null = null, still = false): void {
  const wave = bastionWave(state);
  // The Action HUD (3 Nov 2026): WAVE (the main count) and, on Iron Wall, DRONES left; BASE right.
  const left: ActionChip[] = [{ label: "WAVE", value: `${wave + 1} / ${BT2_WAVE_COUNT}`, pulse: { id: "bastion", tick: state.tick } }];
  if (state.rev >= BASTION_REV_IRON) left.push({ label: "DRONES", value: `${state.drones} / ${BT3_DRONES}`, tone: state.drones > 0 ? "hot" : "plain" });
  drawActionHud(ctx, W, [{ left, right: [{ label: "BASE", value: `${state.base} / ${BT2_BASE}`, tone: state.base >= 2 ? "good" : "bad" }] }]);

  // Stage 2: a crack across the panel's glass for each base hit, where that tank came through; it stays all run.
  paintPanelCracks(ctx, state, memory, still);
  // The bottom panel: SHELLS, RELOAD and the hint lines (labels 13 px in champagne gold, the hints 13 px).
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `800 13px ${DISPLAY}`;
  ctx.fillStyle = GOLD;
  const shellsY = BT_PANEL_SHELLS_Y;
  const reloadY = BT_PANEL_RELOAD_Y;
  ctx.fillText("SHELLS", 16, shellsY);
  ctx.fillText("RELOAD", 16, reloadY);
  const gap = 6;
  const sw = (BAR_W - gap * (BT2_MAG - 1)) / BT2_MAG;
  const reloading = state.reloadAt >= 0;
  // A fast reload's shells snap in one by one as it ends (the magazine is already full in the sim).
  const snap = bastionSnapLit(state, BT2_MAG);
  for (let i = 0; i < BT2_MAG; i++) {
    const lit = snap === null ? i < state.mag : i < Math.min(snap, state.mag);
    const fresh = snap !== null && !still && i === snap - 1 && state.tick - state.reloadEnd - BT_SNAP_STEP * i < 2;
    const grow = fresh ? 1.5 : 0;
    paintShellSlot(ctx, BAR_X + i * (sw + gap) - grow, shellsY - 9 - grow, sw + grow * 2, 18 + grow * 2, !reloading && lit);
  }
  // The reload gauge's track: a recessed channel, shaded at its top, a thin lit lip at its bottom.
  const track = ctx.createLinearGradient(0, reloadY - 5, 0, reloadY + 5);
  track.addColorStop(0, "#0A0F1C");
  track.addColorStop(0.6, SLOT);
  track.addColorStop(1, "#33405F");
  ctx.fillStyle = track;
  ctx.beginPath();
  ctx.roundRect(BAR_X, reloadY - 5, BAR_W, 10, 5);
  ctx.fill();
  // No standing hint on the play screen (3 Nov 2026, Joe's audit): the intro says how to aim; only the reload's words show.
  let hint = "";
  let hintColour = "#C9CEDA";
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
      ctx.fillRect(BAR_X + (BAR_W * state.zone) / 1000, reloadY - 7, (BAR_W * bastionZoneW(state.rev)) / 1000, 14);
    }
    // The needle: polished steel, lit on its left edge; green once a fast reload is in, red and shaking on a jam.
    const jamAge = memory && state.reloadTap === 2 && memory.jamAt >= 0 ? state.tick - memory.jamAt : -1;
    const shake = !still && jamAge >= 0 && jamAge < BT_JAM_SHAKE_TICKS ? Math.sin(jamAge * 1.9) * 2.6 * (1 - jamAge / BT_JAM_SHAKE_TICKS) : 0;
    paintNeedle(ctx, BAR_X + (BAR_W * needle) / 1000 + shake, reloadY, state.reloadTap === 1 ? "fast" : state.reloadTap === 2 ? "jam" : "steel", 1);
    const left = Math.max(0, state.reloadEnd - state.tick) / 60;
    ctx.font = `700 13px ${DISPLAY}`;
    ctx.textAlign = "right";
    ctx.fillStyle = "#F3F1EC";
    ctx.fillText(`${left.toFixed(1)} s`, W - 12, shellsY);
    hint = state.reloadTap === 2 ? "Jammed!" : state.reloadTap === 1 ? "Fast reload!" : "Tap while the needle is in the green";
    hintColour = state.reloadTap === 2 ? RED : state.reloadTap === 1 ? GREEN : "#F3F1EC";
  } else {
    const full = ctx.createLinearGradient(0, reloadY - 5, 0, reloadY + 5);
    full.addColorStop(0, "#BDEBC8");
    full.addColorStop(0.45, GREEN);
    full.addColorStop(1, "#5FAE74");
    ctx.fillStyle = full;
    ctx.beginPath();
    ctx.roundRect(BAR_X, reloadY - 5, BAR_W, 10, 5);
    ctx.fill();
    // A fast reload's green needle stays at the half-way mark while the shells snap in, fading out.
    if (snap !== null) {
      paintNeedle(ctx, BAR_X + BAR_W / 2, reloadY, "fast", 1 - (state.tick - state.reloadEnd) / (BT_SNAP_STEP * BT2_MAG));
      hint = "Fast reload!";
      hintColour = GREEN;
    }
  }
  ctx.font = `600 13px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.fillStyle = hintColour;
  ctx.fillText(hint, W / 2, BT_PANEL_HINT_Y);
  // The first time the magazine runs dry, once a run: teach the early reload (display only, from the sim's own counters).
  if (bastionSwipeHint(state)) {
    ctx.font = `700 13px ${DISPLAY}`;
    ctx.fillStyle = GOLD;
    ctx.fillText(BT_SWIPE_HINT, W / 2, BT_PANEL_TIP_Y);
  }
}

/** The reload needle: steel, green (a fast reload) with a soft green ring, or red (a jam). */
function paintNeedle(ctx: CanvasRenderingContext2D, x: number, y: number, look: "steel" | "fast" | "jam", alpha: number): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  const x0 = x - 1.5;
  if (look === "fast") {
    // The green needle's ring: a thin halo hugging it (no bloom across the panel).
    ctx.fillStyle = "rgba(143,214,160,0.32)";
    ctx.beginPath();
    ctx.roundRect(x0 - 3, y - 12, 9, 24, 4);
    ctx.fill();
  }
  const ng = ctx.createLinearGradient(x0, 0, x0 + 3, 0);
  if (look === "fast") {
    ng.addColorStop(0, "#E4FFE9");
    ng.addColorStop(1, "#5FCB7E");
  } else if (look === "jam") {
    ng.addColorStop(0, "#FFC2B8");
    ng.addColorStop(1, RED);
  } else {
    ng.addColorStop(0, "#FFFFFF");
    ng.addColorStop(1, "#AEB6C4");
  }
  ctx.fillStyle = ng;
  ctx.fillRect(x0, y - 9, 3, 18);
  ctx.restore();
}

/** Where base hit n's crack starts on the panel's top edge (by the lane its tank came down), clear of the labels. */
export const BT_CRACK_X = [126, 236, 336] as const;

/**
 * The cracks across the panel (stage 2): one for each base hit, from the panel's top edge down where that tank came
 * through, a dark fracture line with a lit edge and two short branches; it stays for the rest of the run. The newest
 * flashes white for 6 ticks as it splits.
 */
function paintPanelCracks(ctx: CanvasRenderingContext2D, state: BastionTankState, memory: BtMemory | null, still: boolean): void {
  const n = Math.min(BT2_BASE, state.breached);
  for (let k = 0; k < n; k++) {
    const lane = memory?.breachLanes[k] ?? [2, 0, 1][k]!;
    const path = bastionCrackPath(k, lane);
    const fresh = !still && k === n - 1 && state.tick - state.breachAt < 6;
    for (const [w, colour, dx] of [
      [2.2, "rgba(4,6,12,0.78)", 0],
      [0.8, fresh ? "rgba(255,255,255,0.95)" : "rgba(196,210,240,0.42)", 0.9],
    ] as const) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = w;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (const line of path) {
        ctx.moveTo(line[0]![0] + dx, line[0]![1] + dx);
        for (const [x, y] of line.slice(1)) ctx.lineTo(x + dx, y + dx);
      }
      ctx.stroke();
    }
  }
}

/** Crack k's lines (world px): the main fracture and two branches, fixed for that hit and lane. */
export function bastionCrackPath(k: number, lane: number): [number, number][][] {
  const x0 = BT_CRACK_X[lane] ?? BT_CRACK_X[1];
  const main: [number, number][] = [[x0, BT2_PANEL_Y + 1]];
  let x = x0;
  let y = BT2_PANEL_Y + 1;
  for (let i = 1; i <= 6; i++) {
    x += (hash01(k * 41 + lane * 7 + i) - 0.5) * 22;
    y += 9 + hash01(k * 41 + lane * 7 + i + 20) * 7;
    main.push([Math.max(4, Math.min(W - 4, x)), Math.min(H - 2, y)]);
  }
  const branch = (at: number, dir: number): [number, number][] => {
    const [bx, by] = main[at]!;
    return [
      [bx, by],
      [bx + dir * (10 + 8 * hash01(k + at)), by + 6],
      [bx + dir * (18 + 10 * hash01(k + at + 3)), by + 9 + 4 * hash01(k + at + 5)],
    ];
  };
  return [main, branch(2, -1), branch(4, 1)];
}

/**
 * One shell's slot on the panel (materials pass): a glass capsule with a crisp highlight along its upper curve; a loaded
 * one holds a brass shell (lit top, darker base), an empty one is dark glass. No text sits under a highlight.
 */
function paintShellSlot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, loaded: boolean): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (loaded) {
    g.addColorStop(0, "#FFE2A0");
    g.addColorStop(0.35, ORANGE);
    g.addColorStop(1, "#C77A22");
  } else {
    g.addColorStop(0, "#1C2440");
    g.addColorStop(1, SLOT);
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 5);
  ctx.fill();
  ctx.strokeStyle = loaded ? "rgba(120,66,14,0.7)" : "rgba(120,140,190,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // The glass's highlight: a thin bright crescent on the top curve.
  ctx.fillStyle = loaded ? "rgba(255,255,255,0.62)" : "rgba(220,230,255,0.22)";
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 2, w - 6, Math.max(1.5, h * 0.16), 2);
  ctx.fill();
}

/* ------------------------------------------------------------- the world */

function paintGun(ctx: CanvasRenderingContext2D, state: BastionTankState, still: boolean): void {
  const dx = btViewX(state.aimX, state.aimY) - GUN_X;
  const dy = Math.min(-20, btViewY(state.aimY) - GUN_Y);
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Stage 2: the barrel kicks back 3 px for 80 ms when it fires (the barrel only; the mount, world and arena stay put).
  const recoil = still ? 0 : bastionKick(state);
  const mx = GUN_X + ux * (GUN_LEN - recoil);
  const my = GUN_Y + uy * (GUN_LEN - recoil);
  const nx = -uy;
  const ny = ux;
  ctx.save();
  // The barrel rises from behind the parapet: nothing of it below the panel's top edge.
  ctx.beginPath();
  ctx.rect(0, 0, W, BT2_PANEL_Y);
  ctx.clip();
  // Gunmetal (materials pass): dark edges, a crisp highlight running down the barrel's lit side.
  const metal = (w: number) => {
    const g = ctx.createLinearGradient(GUN_X + nx * w, GUN_Y + ny * w, GUN_X - nx * w, GUN_Y - ny * w);
    g.addColorStop(0, "#1C2027");
    g.addColorStop(0.18, "#4A5262");
    g.addColorStop(0.27, "#AEB7C4");
    g.addColorStop(0.33, "#66707F");
    g.addColorStop(0.7, "#3A414E");
    g.addColorStop(1, "#171A20");
    return g;
  };
  ctx.fillStyle = metal(15);
  ctx.beginPath();
  ctx.moveTo(GUN_X + nx * 15, GUN_Y + ny * 15);
  ctx.lineTo(mx + nx * 11, my + ny * 11);
  ctx.lineTo(mx - nx * 11, my - ny * 11);
  ctx.lineTo(GUN_X - nx * 15, GUN_Y - ny * 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = metal(13);
  ctx.beginPath();
  ctx.moveTo(mx + nx * 13, my + ny * 13);
  ctx.lineTo(mx + nx * 13 + ux * 10, my + ny * 13 + uy * 10);
  ctx.lineTo(mx - nx * 13 + ux * 10, my - ny * 13 + uy * 10);
  ctx.lineTo(mx - nx * 13, my - ny * 13);
  ctx.closePath();
  ctx.fill();
  const flash = bastionFlashAge(state);
  if (flash !== null) paintMuzzleFlash(ctx, mx + ux * 12, my + uy * 12, ux, uy, flash, still);
  // The gun's base on the parapet: a cast mount lit along its top.
  const mount = ctx.createLinearGradient(0, BT2_PANEL_Y - 22, 0, BT2_PANEL_Y);
  mount.addColorStop(0, "#5B6472");
  mount.addColorStop(0.18, "#3A414D");
  mount.addColorStop(1, "#20242B");
  ctx.fillStyle = mount;
  ctx.beginPath();
  ctx.roundRect(GUN_X - 46, BT2_PANEL_Y - 22, 92, 22, [8, 8, 0, 0]);
  ctx.fill();
  ctx.restore();
}

/**
 * The muzzle flash (stage 2): a crisp four-point star and a white core at the muzzle for 3 ticks (50 ms), its long
 * points along the barrel; no glow round it. Reduced motion: the same star, smaller, for the same three ticks.
 */
function paintMuzzleFlash(ctx: CanvasRenderingContext2D, x: number, y: number, ux: number, uy: number, age: number, still: boolean): void {
  const k = 1 - age / 3;
  const big = (still ? 0.6 : 1) * (0.65 + 0.35 * k);
  const nx = -uy;
  const ny = ux;
  ctx.save();
  ctx.fillStyle = `rgba(255,186,80,${0.9 * k + 0.1})`;
  ctx.beginPath();
  ctx.moveTo(x + ux * 26 * big, y + uy * 26 * big);
  ctx.lineTo(x + nx * 7 * big, y + ny * 7 * big);
  ctx.lineTo(x - ux * 6 * big, y - uy * 6 * big);
  ctx.lineTo(x - nx * 7 * big, y - ny * 7 * big);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + nx * 15 * big, y + ny * 15 * big);
  ctx.lineTo(x + ux * 5 * big, y + uy * 5 * big);
  ctx.lineTo(x - nx * 15 * big, y - ny * 15 * big);
  ctx.lineTo(x - ux * 5 * big, y - uy * 5 * big);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#FFF6DC";
  ctx.beginPath();
  ctx.arc(x, y, 5.5 * big, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A shell in flight (stage 2): the round itself, a brass tracer with a short trail, flying from the muzzle, and its
 * shadow sliding over the road from the wall to the very point it will land on, darker and smaller as it closes, so
 * where a shot comes down can be learnt. No shadow for a shot into the sky (a drone's).
 */
export function bastionShellShadow(sh: { x: number; y: number; from: number; at: number }, tick: number): { x: number; y: number; rx: number; ry: number; a: number } | null {
  if (sh.y < BT2_HORIZON_Y) return null;
  const u = Math.max(0, Math.min(1, (tick - sh.from) / Math.max(1, sh.at - sh.from)));
  const ease = 1 - (1 - u) * (1 - u);
  const tx = btViewX(sh.x, sh.y);
  const ty = btViewY(sh.y);
  const x = GUN_X + (tx - GUN_X) * ease;
  const y = BT2_WALL_Y + (ty - BT2_WALL_Y) * ease;
  const sv = Math.max(0.05, Math.min(1, (y - HY) / (BT2_WALL_Y - HY)));
  const rx = 2.5 + 7 * sv * (1 - 0.35 * u);
  return { x, y, rx, ry: rx * 0.38, a: 0.2 + 0.3 * u };
}

function paintShells(ctx: CanvasRenderingContext2D, state: BastionTankState): void {
  for (const sh of state.shells) {
    const shadow = bastionShellShadow(sh, state.tick);
    if (!shadow) continue;
    ctx.fillStyle = `rgba(12,10,8,${shadow.a})`;
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, shadow.rx, shadow.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const sh of state.shells) {
    const u = Math.min(1, (state.tick - sh.from) / Math.max(1, sh.at - sh.from));
    const ease = 1 - (1 - u) * (1 - u);
    const x0 = GUN_X;
    const y0 = GUN_Y - GUN_LEN;
    const tx = btViewX(sh.x, sh.y);
    const ty = btViewY(sh.y);
    const x = x0 + (tx - x0) * ease;
    const y = y0 + (ty - y0) * ease;
    const r = 4.6 - 3 * u;
    // A short trail back toward the muzzle, then the brass round with a lit top.
    const back = Math.max(0, ease - 0.12);
    const bx = x0 + (tx - x0) * back;
    const by = y0 + (ty - y0) * back;
    ctx.strokeStyle = "rgba(255,214,140,0.45)";
    ctx.lineWidth = r * 1.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = "#E7A642";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFF0C8";
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintCrosshair(ctx: CanvasRenderingContext2D, state: BastionTankState): void {
  // Where the aim is in the view (the stage sent the world point under the finger's crosshair).
  const x = btViewX(state.aimX, state.aimY);
  const y = btViewY(state.aimY);
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
  const memory = observeRun(ctx, state);
  // The setting (clear, dust, storm) by wave, one cross-fading into the next (display only).
  const set = bastionSettingMix(state);
  const world = { x0: 0, x1: W, y0: 0, y1: H };
  if (set.mix < 1) deviceLayer(ctx, `bastion-set:${set.from}`, (c) => paintBackdrop(c, world, set.from));
  deviceLayer(ctx, `bastion-set:${set.to}`, (c) => paintBackdrop(c, world, set.to), set.mix);
  tankFog = BT_SETTING_LOOK[set.mix < 0.5 ? set.from : set.to].fog;
  const plan = bastionPlan(state.seed);
  // Tanks, far ones first (the sim keeps them nearest first).
  const tanks: Bt2Tank[] = state.tanks;
  for (let i = tanks.length - 1; i >= 0; i--) {
    const t = tanks[i]!;
    if (t.z > BT2_FAR * 256) continue;
    const p = plan[t.i];
    // In the view: the tank's own rectangles, scaled about its ground point (bastionView.ts).
    ctx.save();
    const tr = bastionTankRects(t.kind, t.lane, t.z);
    btViewTransform(ctx, tr.cx, (tr.turret[1] + tr.ground) / 2);
    paintTankShadow(ctx, t.kind, t.lane, t.z);
    paintTank(ctx, t.kind, t.lane, t.z, t.hp, t.flash, state.tick, still, p ? bastionWeakOpen(p, state.tick) : true, true, t.i);
    paintTankOutline(ctx, t.kind, t.lane, t.z);
    ctx.restore();
    paintTankBadge(ctx, t.kind, t.lane, t.z);
  }
  if (state.rev >= BASTION_REV_IRON) {
    const ds = bastionDrones(state.seed);
    for (let n = 0; n < ds.length; n++) {
      if (state.droneMask & (1 << n)) continue;
      const at = bastionDronePos(ds[n]!, state.tick);
      if (at) paintDrone(ctx, at.x, at.y - BT_VIEW_SKY_SHIFT, ds[n]!.dir, state.tick, still);
    }
  }
  const lite = arcadeReducedEffects();
  for (const m of state.impacts) {
    ctx.save();
    btViewTransform(ctx, m.x, m.y);
    paintImpact(ctx, m, state.tick, still, m.r === 0 && memory.near.get(impactKey(m)) === true, lite);
    ctx.restore();
  }
  // The words off a landing, in view px: a kill's "+n" (gold on a weak-spot kill) and a near miss's CLOSE.
  for (const m of state.impacts) {
    const age = state.tick - m.t;
    const vx = btViewX(m.x, m.y);
    const vy = btViewY(m.y);
    if (m.r === 3 || m.r === 4) paintRiser(ctx, `+${bastionKillPoints(m.kind, state.rev)}`, vx, vy - 14 * (0.45 + m.s256 / 256), age, BT_FX_TICKS.points, still, m.r === 4 ? BT_WEAK_GOLD : "#FFFFFF", 20);
    else if (m.r === 0 && memory.near.get(impactKey(m)) === true) paintRiser(ctx, "CLOSE", vx, vy - 18, age, BT_FX_TICKS.close, still, "#F3E4C8", 14);
  }
  paintShells(ctx, state);
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
  paintHud(ctx, state, memory, still);
  if (state.ended !== 0) paintEndCard(ctx, state, memory, still);
}

/* ------------------------------------------------------------ the run's memory (display only) */

/**
 * What the art remembers between frames of one run (stage 2; per canvas, never read by the sim): the ledger of each
 * tank's fate (for the end card's tally), when the last jam came (its shake), which landings were near misses (decided
 * once, as the sound observer does), the lanes the base hits came through (the panel's cracks) and when the run ended
 * (the end card's clock). A replay drawn frame by frame builds the same memory; a lone frame of a finished run (no
 * history) shows the end card's totals only.
 */
export interface BtMemory {
  seed: number;
  tick: number;
  prev: BastionTankState;
  ledger: BtLedger;
  /** The ledger saw the run from its start (the end card can tally each wave). */
  whole: boolean;
  jams: number;
  jamAt: number;
  near: Map<string, boolean>;
  breachLanes: number[];
  endAt: number | null;
}
const memories = new WeakMap<object, BtMemory>();
let endClock: () => number = () => (typeof performance !== "undefined" ? performance.now() : 0);
/** Screenshot and check hook: the clock the end card is timed on (null restores the presentation clock). */
export function setBastionEndClock(clock: (() => number) | null): void {
  endClock = clock ?? (() => (typeof performance !== "undefined" ? performance.now() : 0));
}
const impactKey = (m: Bt2Impact) => `${m.t}:${m.x}:${m.y}`;

export function observeRun(ctx: object, state: BastionTankState): BtMemory {
  let m = memories.get(ctx);
  if (!m || m.seed !== state.seed || state.tick < m.tick) {
    m = { seed: state.seed, tick: state.tick, prev: state, ledger: bastionLedgerStart(state.seed, BT2_TANKS, BT3_DRONES), whole: state.tick <= 1, jams: state.jams, jamAt: -1, near: new Map(), breachLanes: [], endAt: state.ended !== 0 ? endClock() - BT_END_HOLD_MS : null };
    m.ledger.tick = state.tick;
    memories.set(ctx, m);
  }
  if (state.tick > m.tick) {
    bastionLedgerStep(m.ledger, m.prev, state);
    if (state.jams > m.jams) m.jamAt = state.tick;
    m.jams = state.jams;
    const plan = bastionPlan(state.seed);
    while (m.breachLanes.length < m.ledger.breaches.length) m.breachLanes.push(plan[m.ledger.breaches[m.breachLanes.length]!]?.lane ?? 1);
    for (const imp of state.impacts) if (imp.r === 0 && imp.t > m.tick && !m.near.has(impactKey(imp))) m.near.set(impactKey(imp), bastionNearMiss(state, imp));
    if (m.near.size > 40) for (const key of [...m.near.keys()].slice(0, m.near.size - 40)) m.near.delete(key);
    m.prev = state;
    m.tick = state.tick;
  }
  if (state.ended !== 0 && m.endAt === null) m.endAt = endClock();
  return m;
}

/**
 * The end card (stage 2): the field dims, then the five waves tally one by one (WAVE n, a pip for each of its tanks,
 * lit for each destroyed, red for one that reached the wall, and "4 / 5"), then WALL HELD (the clock ran out or every
 * tank is gone with the base standing) or BASE DOWN. Reduced motion: the whole card at once. Without the run's history
 * (a lone frame) it shows the run's tanks destroyed in one row.
 */
function paintEndCard(ctx: CanvasRenderingContext2D, state: BastionTankState, memory: BtMemory, still: boolean): void {
  const ms = still ? BT_END_HOLD_MS : Math.max(0, endClock() - (memory.endAt ?? endClock()));
  ctx.save();
  ctx.fillStyle = `rgba(8,11,22,${Math.min(0.68, ms / 300)})`;
  ctx.fillRect(0, 0, W, BT2_PANEL_Y);
  const rows = memory.whole ? bastionWaveTallies(memory.ledger, bastionPlan(state.seed), BT2_WAVE_COUNT) : null;
  const shown = still ? BT2_WAVE_COUNT : bastionTallyRows(ms, BT2_WAVE_COUNT);
  const top = 176;
  const rowH = 50;
  ctx.textBaseline = "middle";
  const drawRow = (y: number, label: string, pips: { fate: number }[], count: string, appear: number) => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, appear);
    const lift = still ? 0 : 8 * (1 - Math.min(1, appear));
    // The row's plate: navy, a champagne rule under it.
    ctx.fillStyle = "rgba(18,26,49,0.92)";
    ctx.beginPath();
    ctx.roundRect(28, y - 20 + lift, W - 56, 40, 10);
    ctx.fill();
    ctx.fillStyle = "rgba(226,192,122,0.35)";
    ctx.fillRect(40, y + 19 + lift, W - 80, 1);
    ctx.font = `800 15px ${DISPLAY}`;
    ctx.textAlign = "left";
    ctx.fillStyle = GOLD;
    ctx.fillText(label, 42, y + lift);
    const pw = 14;
    const gapX = 5;
    const x0 = 128;
    pips.forEach((p, i) => {
      const px = x0 + i * (pw + gapX);
      ctx.fillStyle = p.fate === 1 ? ORANGE : p.fate === 2 ? RED : SLOT;
      ctx.beginPath();
      ctx.roundRect(px, y - 7 + lift, pw, 14, 3);
      ctx.fill();
      if (p.fate === 1) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(px + 2, y - 5 + lift, pw - 4, 2);
      }
    });
    ctx.font = `800 20px ${DISPLAY}`;
    ctx.textAlign = "right";
    ctx.fillStyle = "#F3F1EC";
    ctx.fillText(count, W - 42, y + lift);
    ctx.restore();
  };
  if (rows) {
    for (let w = 0; w < shown; w++) {
      const row = rows[w]!;
      const appear = still ? 1 : (ms - (120 + w * BT_TALLY_STEP_MS)) / 120;
      drawRow(top + w * rowH, `WAVE ${w + 1}`, row.tanks, `${row.kills} / ${row.tanks.length}`, appear);
    }
  } else if (shown > 0) {
    drawRow(top + 2 * rowH, "TANKS", [], `${state.kills} / ${BT2_TANKS}`, 1);
  }
  if (ms >= BT_HELD_AT_MS || still) {
    const held = state.ended !== 2;
    const k = still ? 1 : Math.min(1, (ms - BT_HELD_AT_MS) / 160);
    const y = top + BT2_WAVE_COUNT * rowH + 26;
    const scale = still ? 1 : 1.15 - 0.15 * k;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(W / 2, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(11,15,28,0.96)";
    ctx.beginPath();
    ctx.roundRect(-128, -28, 256, 56, 12);
    ctx.fill();
    ctx.strokeStyle = held ? GOLD : RED;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `900 32px ${DISPLAY}`;
    ctx.textAlign = "center";
    ctx.fillStyle = held ? GOLD : RED;
    ctx.fillText(held ? "WALL HELD" : "BASE DOWN", 0, 1);
    ctx.restore();
  }
  ctx.restore();
}

/* ----------------------------------------------------------- the answer reveal's picture of the run */

/** The reveal picture's logical width (it is drawn to fit its box's width) and its rows' heights. */
export const BT_SUMMARY_W = 360;
const SUM_ROW = 52;
const SUM_LEGEND = 44;
/** The reveal picture's logical height for a revision (rev 3 adds the drones' row). */
export function bastionSummaryHeight(rev: number): number {
  return 8 + BT2_WAVE_COUNT * SUM_ROW + (rev >= BASTION_REV_IRON ? SUM_ROW : 0) + SUM_ROW + SUM_LEGEND;
}
/** What the picture shows, all from the stored log's replay (bastionTankLedger): every number the server's score reads. */
export interface BtSummaryData {
  rev: number;
  waves: ReturnType<typeof bastionWaveTallies>;
  /** Each drone's tick downed (null: missed); empty on rev 2. */
  drones: (number | null)[];
  base: number;
  fell: boolean;
}
/** The text each row shows, for checks and screen readers: "WAVE 1 4 / 5" etc. */
export function bastionSummaryRows(d: BtSummaryData): string[] {
  const rows = d.waves.map((w) => `WAVE ${w.wave + 1} ${w.kills} / ${w.tanks.length}`);
  if (d.rev >= BASTION_REV_IRON) rows.push(`DRONES ${d.drones.filter((t) => t !== null).length} / ${d.drones.length}`);
  rows.push(`BASE ${d.base} / ${BT2_BASE}`);
  return rows;
}

/**
 * The run in one picture (Action overhaul stage 2; the reveal's own drawing, display only): a strip for each wave with
 * each of its tanks drawn by the game's own art in the order it rolled on (full colour: destroyed; on a red plate:
 * reached the wall; faded: never stopped), a gold dot under a tank for each weak-spot hit on it and the wave's kills
 * big on the right; then the drones (rev 3) and the base's three blocks, cracked for each hit. Logical size
 * BT_SUMMARY_W × bastionSummaryHeight(rev); every label 14 px and every count 20 px at that size.
 */
export function paintBastionSummary(ctx: CanvasRenderingContext2D, d: BtSummaryData): void {
  const w = BT_SUMMARY_W;
  ctx.save();
  ctx.textBaseline = "middle";
  let y = 8;
  const plate = (top: number) => {
    ctx.fillStyle = "rgba(14,20,38,0.78)";
    ctx.beginPath();
    ctx.roundRect(0, top + 3, w, SUM_ROW - 6, 10);
    ctx.fill();
  };
  const label = (text: string, top: number) => {
    ctx.font = `800 14px ${DISPLAY}`;
    ctx.textAlign = "left";
    ctx.fillStyle = GOLD;
    ctx.fillText(text, 12, top + SUM_ROW / 2);
  };
  const count = (text: string, top: number, colour = "#F3F1EC") => {
    ctx.font = `800 20px ${DISPLAY}`;
    ctx.textAlign = "right";
    ctx.fillStyle = colour;
    ctx.fillText(text, w - 12, top + SUM_ROW / 2);
  };
  const k = 0.25;
  const slot = 26;
  const x0 = 82;
  for (const wave of d.waves) {
    plate(y);
    label(`WAVE ${wave.wave + 1}`, y);
    wave.tanks.forEach((t, i) => {
      const cx = x0 + slot * (i + 0.5);
      const ground = y + SUM_ROW / 2 + 8;
      if (t.fate === 2) {
        ctx.fillStyle = "rgba(255,107,91,0.30)";
        ctx.strokeStyle = RED;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(cx - slot / 2 + 1.5, y + 8, slot - 3, SUM_ROW - 16, 6);
        ctx.fill();
        ctx.stroke();
      }
      ctx.save();
      if (t.fate === 0) ctx.globalAlpha = 0.3;
      ctx.translate(cx, ground);
      ctx.scale(k, k);
      ctx.translate(-BT2_VP_X, -BT2_WALL_Y);
      paintTank(ctx, t.kind, 1, 0, t.fate === 1 ? 0 : BT2_HP[t.kind]!, 0, 0, true, t.weak > 0 || t.fate !== 1, false, t.i);
      ctx.restore();
      for (let n = 0; n < t.weak; n++) {
        ctx.fillStyle = BT_WEAK_GOLD;
        ctx.beginPath();
        ctx.arc(cx + (n - (t.weak - 1) / 2) * 7, ground + 7, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    count(`${wave.kills} / ${wave.tanks.length}`, y);
    y += SUM_ROW;
  }
  if (d.rev >= BASTION_REV_IRON) {
    plate(y);
    label("DRONES", y);
    d.drones.forEach((t, i) => {
      ctx.save();
      if (t === null) ctx.globalAlpha = 0.3;
      const cx = x0 + 28 + i * 48;
      ctx.translate(cx, y + SUM_ROW / 2);
      ctx.scale(1.5, 1.5);
      paintDrone(ctx, 0, 0, 1, 0, true);
      ctx.restore();
    });
    count(`${d.drones.filter((t) => t !== null).length} / ${d.drones.length}`, y);
    y += SUM_ROW;
  }
  plate(y);
  label("BASE", y);
  for (let i = 0; i < BT2_BASE; i++) {
    const bx = x0 + 6 + i * 52;
    const by = y + 14;
    const hit = i >= d.base;
    const g = ctx.createLinearGradient(0, by, 0, by + 24);
    g.addColorStop(0, hit ? "#5A2A26" : "#8A93A2");
    g.addColorStop(0.2, hit ? "#40201E" : "#3A404B");
    g.addColorStop(1, hit ? "#2A1614" : "#20242B");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(bx, by, 44, 24, 4);
    ctx.fill();
    if (hit) {
      ctx.strokeStyle = RED;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx + 14, by);
      ctx.lineTo(bx + 20, by + 9);
      ctx.lineTo(bx + 16, by + 15);
      ctx.lineTo(bx + 24, by + 24);
      ctx.moveTo(bx + 20, by + 9);
      ctx.lineTo(bx + 31, by + 12);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(226,192,122,0.55)";
      ctx.fillRect(bx + 4, by + 2, 36, 1.5);
    }
  }
  count(`${d.base} / ${BT2_BASE}`, y, d.fell ? RED : "#F3F1EC");
  y += SUM_ROW;
  // The key, two short lines: a tank in colour, a faded one, a red plate and a gold dot.
  ctx.font = `600 13px ${DISPLAY}`;
  ctx.textAlign = "left";
  const miniTank = (x: number, cy: number, alpha: number) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x + 8, cy + 5);
    ctx.scale(0.22, 0.22);
    ctx.translate(-BT2_VP_X, -BT2_WALL_Y);
    paintTank(ctx, 0, 1, 0, 1, 0, 0, true, false, false);
    ctx.restore();
  };
  const keys: [string, (x: number, cy: number) => void][] = [
    ["Destroyed", (x, cy) => miniTank(x, cy, 1)],
    ["Not stopped", (x, cy) => miniTank(x, cy, 0.3)],
    ["Reached the wall", (x, cy) => ((ctx.fillStyle = "rgba(255,107,91,0.45)"), (ctx.strokeStyle = RED), (ctx.lineWidth = 1.4), ctx.beginPath(), ctx.roundRect(x + 2, cy - 6, 13, 12, 3), ctx.fill(), ctx.stroke())],
    ["Weak-spot hit", (x, cy) => ((ctx.fillStyle = BT_WEAK_GOLD), ctx.beginPath(), ctx.arc(x + 8, cy, 3, 0, Math.PI * 2), ctx.fill())],
  ];
  keys.forEach(([text, mark], i) => {
    const kx = 4 + (i % 2) * 180;
    const ky = y + 10 + Math.floor(i / 2) * 20;
    mark(kx, ky);
    ctx.fillStyle = "#C9CEDA";
    ctx.fillText(text, kx + 22, ky);
  });
  ctx.restore();
}

/** The miss moments: base hits and jams. */
function bastionMisses(s: BastionTankState): number {
  return s.breached + s.jams;
}

function lastImpact(s: BastionTankState, kill: boolean): { x: number; y: number } | null {
  for (let i = s.impacts.length - 1; i >= 0; i--) {
    const m = s.impacts[i]!;
    if (kill ? m.r >= 3 : m.r === 2 || m.r === 4) return { x: btViewX(m.x, m.y), y: btViewY(m.y) };
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
/** bastionRev 3's (Iron Wall's) game with the art. */
export const bastionIronArtGame = { ...bastionIronGame, draw: drawBastionTankArt };
/** The art game for a stored stamp. */
export function bastionTankArtGameFor(rev?: number | null) {
  return (rev ?? 0) >= BASTION_REV_IRON ? bastionIronArtGame : bastionTankArtGame;
}

/**
 * The play screen's scenery beyond the world (painted once per size, world units): the same dusk, field and wall
 * carried out to the box's edges (the computer layout's sides included), darkening a little far below the world.
 */
export function bastionScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView, state?: Pick<BastionTankState, "tick">): void {
  const e: Extent = { x0: view.left - 2, x1: view.right + 2, y0: Math.min(view.top, 0) - 2, y1: view.bottom + 2 };
  ctx.fillStyle = BT2_ART_BG;
  ctx.fillRect(e.x0, e.y0, e.x1 - e.x0, e.y1 - e.y0);
  // The setting as the world draws it (the same stepped fade), so the scene meets the world's edge exactly.
  const set = state ? bastionSettingMix(state) : { from: 0 as BtSetting, to: 0 as BtSetting, mix: 1 };
  // Through the same layers as the world (a fading setting composited as one picture at the step's opacity).
  const ext = `${e.x0},${e.x1},${e.y0},${e.y1}`;
  if (set.mix < 1) deviceLayer(ctx, `bastion-scene:${set.from}:${ext}`, (c) => paintBackdrop(c, e, set.from));
  deviceLayer(ctx, `bastion-scene:${set.to}:${ext}`, (c) => paintBackdrop(c, e, set.to), set.mix);
  if (view.bottom > H) {
    const g = ctx.createLinearGradient(0, H, 0, view.bottom);
    g.addColorStop(0, "rgba(8,6,10,0)");
    g.addColorStop(1, "rgba(8,6,10,0.4)");
    ctx.fillStyle = g;
    ctx.fillRect(e.x0, H, e.x1 - e.x0, view.bottom - H);
  }
}

/**
 * Tile icon helper (Iron Wall, 3 Nov 2026; scripts/shots/tile-scenes): a heavy tank with its glowing weak spot, seen
 * through the gun's crosshair (a scope ring over a darkened edge) on the dusk background, drawn by the game's own art.
 */
export function paintBastionTile(ctx: CanvasRenderingContext2D, size: number): void {
  const u = size / 104;
  ctx.save();
  // The dusk: sky, skyline ruins and peaks over the earth field (the horizon at 46 % of the tile).
  ctx.save();
  const s1 = size / 170;
  ctx.scale(s1, s1);
  ctx.translate(-110, -172 + BT_VIEW_SKY_SHIFT);
  paintBackdrop(ctx, { x0: 100, x1: 300, y0: 160, y1: 360 });
  ctx.restore();
  // The tank, close and large, its weak spot at the tile's centre.
  const z = 120 * 256;
  const r = bastionTankRects(2, 1, z);
  const wx = (r.weak[0] + r.weak[2]) / 2;
  const wy = (r.weak[1] + r.weak[3]) / 2;
  const k = 0.68 * u;
  ctx.save();
  ctx.translate(52 * u, 58 * u);
  ctx.scale(k, k);
  ctx.translate(-wx, -wy);
  ctx.fillStyle = "rgba(20,16,12,0.45)";
  ctx.beginPath();
  ctx.ellipse(r.cx, r.ground, (r.hull[2] - r.hull[0]) * 0.62, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  paintTank(ctx, 2, 1, z, 3, 0, 0, true, true, false);
  ctx.restore();
  // The scope: the edge darkened outside the ring, the ring, the crosshair with its gap and the orange dot.
  const cx = 52 * u;
  const cy = 58 * u;
  const R = 30 * u;
  ctx.fillStyle = "rgba(6,7,10,0.5)";
  ctx.beginPath();
  ctx.rect(0, 0, size, size);
  ctx.arc(cx, cy, R, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 3.4 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#F3F1EC";
  ctx.lineWidth = 1.6 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.3 * u;
  ctx.beginPath();
  for (const [ax, ay] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    ctx.moveTo(cx + ax * 9 * u, cy + ay * 9 * u);
    ctx.lineTo(cx + ax * (R - 2 * u), cy + ay * (R - 2 * u));
  }
  ctx.stroke();
  ctx.lineWidth = 1 * u;
  ctx.beginPath();
  for (const d of [16, 23]) {
    ctx.moveTo(cx - 2.5 * u, cy + d * u);
    ctx.lineTo(cx + 2.5 * u, cy + d * u);
  }
  ctx.stroke();
  ctx.fillStyle = ORANGE;
  ctx.beginPath();
  ctx.arc(cx, cy, 1.8 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
