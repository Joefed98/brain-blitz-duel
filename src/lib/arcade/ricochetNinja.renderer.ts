/**
 * Ricochet's ninja wall-climb art (ricoRev 2; display only, never imported by the sim or server): night over two
 * temple walls of dark stone, a moon and a distant pagoda behind, the ninja (a clean black silhouette with a red
 * headband and sash), katanas in the walls (a gold guard and a steel blade that glints), spinning shurikens, moss and
 * ice patches, coins, gold lanterns and scrolls. Moon Climb (ricoRev 3) draws a larger moon and the pagoda under it,
 * the mid-ledges (slim hanging stone pieces), the sky lanterns (paper, glowing orange; the ninja hangs from one it
 * rides) and the Height and Flow pills, and no coins or gold lanterns. Every object is drawn inside its sim bounds (within 2 px: the
 * arcade bounds rule). The sky is painted once per canvas size (deviceLayer); only the walls, the objects in view and
 * the HUD are drawn each frame.
 */
import { drawActionHud, type ActionHudRow } from "./actionHud.renderer";
import { artCanvas, artContext, deviceLayer } from "./cache.renderer";
import { drawHero, heroPose, type HeroPose } from "./hero.renderer";
import { artHash } from "./art.renderer";
import { arcadeFx, ARCADE_FX_DISPLAY_FONT, type ArcadeFxSpec } from "./arcadeFx.renderer";
import type { CanvasSize } from "./engine";
import {
  KATANA_HALF,
  KATANA_LEN,
  lanternAt,
  LANTERN_R,
  MODE_FLIGHT,
  MODE_STUN,
  NINJA_CORE_FULL_M,
  NINJA_HANG,
  NINJA_PX_PER_M,
  NINJA_HH,
  NINJA_HW,
  NINJA_START,
  NINJA_WALL_L,
  NINJA_WALL_R,
  NINJA_WORLD_H,
  NINJA_WORLD_W,
  ninjaGame,
  moonGame,
  ninjaClimbedPx,
  ninjaMetres,
  SCROLL_R,
  COIN_R,
  SHURIKEN_R,
  SHURIKEN_X0,
  SHURIKEN_X1,
  shurikenAt,
  SURF_ICE,
  SURF_MOSS,
  MODE_RIDE,
  MOON_CORE_FULL_M,
  MOON_LEDGE_HW,
  MOON_REV,
  MOON_RIDE_HANG,
  MOON_SKY,
  MOON_SCROLLS,
  MOON_SKY_R,
  moonSkyAt,
  type MoonState,
  type NinjaState,
} from "./ricochetNinja";

export const NINJA_BG = "#0A0D1C";
export const NINJA_RED = "#E0283A";
export const NINJA_GOLD = "#F2C75C";
// Moonlit slate (the Action overhaul, 15 Nov 2026): a cool blue-grey stone, each block bevelled.
const STONE = "#2F3548";
const STONE_LIT = "#3A4259";
const STONE_DARK = "#232839";
const MORTAR = "#10131F";
const MOSS = "#3F7F2F";
const ICE = "#BFE6F5";
const STEEL = "#D8DEE8";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/** The camera: the ninja two thirds down; the floor never above the bottom. */
const EYE = Math.round(NINJA_WORLD_H * 0.62);
export function ninjaCamera(state: Pick<NinjaState, "y">): number {
  return Math.max(state.y >> 8, NINJA_WORLD_H - 24 - EYE);
}
/** World height (px above the floor) to the world's screen y for this camera. */
export function ninjaScreenY(cam: number, ypx: number): number {
  return EYE - (ypx - cam);
}

/* ================================ The sky ================================ */

function paintSky(ctx: CanvasRenderingContext2D): void {
  const W = NINJA_WORLD_W;
  const H = NINJA_WORLD_H;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#070A18");
  g.addColorStop(0.55, "#121A36");
  g.addColorStop(1, "#1E2240");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Stars.
  for (let i = 0; i < 70; i++) {
    const h = artHash(i, 41);
    ctx.globalAlpha = 0.25 + ((h >>> 9) % 6) * 0.1;
    ctx.fillStyle = "#E8ECFF";
    ctx.fillRect(NINJA_WALL_L + (h % (NINJA_WALL_R - NINJA_WALL_L)), (h >>> 12) % Math.round(H * 0.7), (h >>> 28) % 5 === 0 ? 2 : 1, 1);
  }
  ctx.globalAlpha = 1;
  // The moon, with a soft halo.
  const mx = 238;
  const my = 132;
  const halo = ctx.createRadialGradient(mx, my, 20, mx, my, 110);
  halo.addColorStop(0, "rgba(255,240,205,0.30)");
  halo.addColorStop(1, "rgba(255,240,205,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(mx - 110, my - 110, 220, 220);
  ctx.fillStyle = "#FBF1D6";
  ctx.beginPath();
  ctx.arc(mx, my, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(205,190,160,0.35)";
  for (const [x, y, r] of [[-10, -6, 7], [9, 8, 5], [4, -14, 4], [-6, 14, 3]] as const) {
    ctx.beginPath();
    ctx.arc(mx + x, my + y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // A far ridge and the pagoda, in silhouette.
  ctx.fillStyle = "#151A33";
  ctx.beginPath();
  ctx.moveTo(0, H * 0.88);
  for (let x = 0; x <= W; x += 30) ctx.lineTo(x, H * 0.86 + 14 * Math.sin(x / 47) + 8 * Math.sin(x / 13));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  drawPagoda(ctx, 160, Math.round(H * 0.86), 0.8);
  // Mist over the ridge.
  const mist = ctx.createLinearGradient(0, H * 0.8, 0, H);
  mist.addColorStop(0, "rgba(120,130,190,0)");
  mist.addColorStop(1, "rgba(120,130,190,0.16)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, H * 0.8, W, H * 0.2);
}

/*
 * Moon Climb's night (ricoRev 3; the Action overhaul, 15 Nov 2026, display only): a deep blue moonlit sky that
 * changes as the climb goes on. The moon rises from just over the far ridge (large, warm) to high above the shaft
 * (smaller, pale), and the sky deepens and fills with stars, both from the run's best height (moonNight), so every
 * player at the same height sees the same sky. Three layers: the sky (gradient, stars, cloud wisps; painted once per
 * size), the night's deepening, the extra stars and the moon (drawn each frame, a few fills), then the ridge, the
 * pagoda and the mist (painted once per size, over the moon so it rises from behind them).
 */
/** The night's progress, 0 at the foot of the tower to 1 at the core's full height: smooth, never going back. */
export function moonNight(state: Pick<NinjaState, "best">): number {
  const p = Math.max(0, Math.min(1, ninjaClimbedPx(state) / (MOON_CORE_FULL_M * NINJA_PX_PER_M)));
  return p * p * (3 - 2 * p);
}
/** The moon's centre and radius for a night's progress (world px). */
export function moonPlace(p: number): { x: number; y: number; r: number } {
  return { x: NINJA_WORLD_W / 2, y: Math.round(610 - 440 * p), r: Math.round(66 - 16 * p) };
}

function paintMoonSky(ctx: CanvasRenderingContext2D): void {
  const W = NINJA_WORLD_W;
  const H = NINJA_WORLD_H;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0A1435");
  g.addColorStop(0.45, "#16295E");
  g.addColorStop(0.8, "#26407F");
  g.addColorStop(1, "#33508F");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Stars, brighter higher up.
  for (let i = 0; i < 90; i++) {
    const h = artHash(i, 43);
    const y = (h >>> 12) % Math.round(H * 0.72);
    ctx.globalAlpha = (0.2 + ((h >>> 9) % 6) * 0.1) * (1 - (0.5 * y) / H);
    ctx.fillStyle = "#E8ECFF";
    ctx.fillRect(NINJA_WALL_L + (h % (NINJA_WALL_R - NINJA_WALL_L)), y, (h >>> 28) % 5 === 0 ? 2 : 1, (h >>> 28) % 5 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
  // Thin cloud wisps, lit from below by the moon.
  for (let i = 0; i < 6; i++) {
    const h = artHash(i, 91);
    const cy = 200 + (h % 360);
    const cx = NINJA_WALL_L + ((h >>> 9) % (NINJA_WALL_R - NINJA_WALL_L));
    const w = 70 + ((h >>> 17) % 70);
    const c = ctx.createLinearGradient(0, cy - 5, 0, cy + 5);
    c.addColorStop(0, "rgba(150,170,230,0)");
    c.addColorStop(1, "rgba(170,190,245,0.16)");
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, 4 + ((h >>> 25) % 4), 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The far ridge, the pagoda and the mist (transparent elsewhere): drawn over the moon. */
function paintMoonRidge(ctx: CanvasRenderingContext2D): void {
  const W = NINJA_WORLD_W;
  const H = NINJA_WORLD_H;
  // Misty layers (the materials pass; concept A): a far range and a small far pagoda in haze, a mist band, the
  // nearer ridge, another band, then the near ridge and the temple's pagoda, mist rising off the valley.
  const band = (y: number, h: number, a: number) => {
    const g = ctx.createLinearGradient(0, y - h, 0, y + h);
    g.addColorStop(0, "rgba(140,160,225,0)");
    g.addColorStop(0.5, `rgba(140,160,225,${a})`);
    g.addColorStop(1, "rgba(140,160,225,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - h, W, 2 * h);
  };
  ctx.fillStyle = "#26386E";
  ctx.beginPath();
  ctx.moveTo(0, H * 0.8);
  for (let x = 0; x <= W; x += 15) ctx.lineTo(x, H * 0.79 + 12 * Math.sin(x / 29 + 2) + 5 * Math.sin(x / 7));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.45;
  drawPagoda(ctx, W * 0.28, Math.round(H * 0.8), 0.55);
  ctx.restore();
  band(H * 0.82, 16, 0.18);
  ctx.fillStyle = "#1B2A5C";
  ctx.beginPath();
  ctx.moveTo(0, H * 0.86);
  for (let x = 0; x <= W; x += 15) ctx.lineTo(x, H * 0.85 + 16 * Math.sin(x / 37 + 1) + 7 * Math.sin(x / 9));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  band(H * 0.875, 12, 0.16);
  ctx.fillStyle = "#101A3E";
  ctx.beginPath();
  ctx.moveTo(0, H * 0.9);
  for (let x = 0; x <= W; x += 15) ctx.lineTo(x, H * 0.89 + 11 * Math.sin(x / 41) + 5 * Math.sin(x / 11));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  drawPagoda(ctx, W / 2, Math.round(H * 0.9), 1.2);
  const mist = ctx.createLinearGradient(0, H * 0.78, 0, H);
  mist.addColorStop(0, "rgba(130,150,215,0)");
  mist.addColorStop(1, "rgba(130,150,215,0.2)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, H * 0.78, W, H * 0.22);
}

/** The night's deepening, the extra stars and the moon for this progress (each frame). */
function drawMoonNight(ctx: CanvasRenderingContext2D, p: number, tick: number): void {
  const W = NINJA_WORLD_W;
  const H = NINJA_WORLD_H;
  if (p > 0.01) {
    const d = ctx.createLinearGradient(0, 0, 0, H * 0.85);
    d.addColorStop(0, `rgba(2,4,18,${(0.62 * p).toFixed(3)})`);
    d.addColorStop(1, `rgba(2,4,18,${(0.3 * p).toFixed(3)})`);
    ctx.fillStyle = d;
    ctx.fillRect(0, 0, W, H);
    // More stars come out as the night deepens; a few twinkle.
    ctx.fillStyle = "#F2F4FF";
    for (let i = 0; i < 40; i++) {
      const h = artHash(i, 57);
      const tw = (h >>> 3) % 7 === 0 ? 0.6 + 0.4 * Math.sin((tick + (h % 97)) / 11) : 1;
      ctx.globalAlpha = Math.min(1, p * 1.4 * (0.45 + ((h >>> 9) % 6) * 0.1)) * tw;
      const sz = (h >>> 28) % 4 === 0 ? 2 : 1.4;
      ctx.fillRect(NINJA_WALL_L + 4 + (h % (NINJA_WALL_R - NINJA_WALL_L - 8)), (h >>> 12) % Math.round(H * 0.6), sz, sz);
    }
    ctx.globalAlpha = 1;
  }
  // The moon: warm and large on the ridge, pale and higher as it rises.
  const m = moonPlace(p);
  const warm = 1 - p;
  const halo = ctx.createRadialGradient(m.x, m.y, m.r * 0.8, m.x, m.y, m.r * 2.3);
  halo.addColorStop(0, `rgba(255,${Math.round(225 + 15 * p)},${Math.round(170 + 50 * p)},0.26)`);
  halo.addColorStop(1, "rgba(255,235,200,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(m.x - m.r * 2.3, m.y - m.r * 2.3, m.r * 4.6, m.r * 4.6);
  const face = ctx.createRadialGradient(m.x - m.r * 0.35, m.y - m.r * 0.35, m.r * 0.1, m.x, m.y, m.r);
  face.addColorStop(0, `rgb(255,${Math.round(246 - 6 * warm)},${Math.round(226 - 50 * warm)})`);
  face.addColorStop(1, `rgb(${Math.round(232 + 10 * warm)},${Math.round(218 - 22 * warm)},${Math.round(186 - 66 * warm)})`);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
  ctx.fill();
  // Maria (soft, broad) and craters (the materials pass): each crater shadowed inside on its upper-left wall and lit on
  // its lower-right rim, so the surface reads cratered, scaled to the moon.
  const k = m.r / 56;
  const tint = (a: number) => `rgba(${Math.round(160 + 20 * warm)},${Math.round(150 - 10 * warm)},${Math.round(132 - 30 * warm)},${a})`;
  ctx.fillStyle = tint(0.24);
  for (const [x, y, rx, ry] of [[-14, -8, 18, 13], [14, 12, 13, 10], [-6, 22, 10, 7]] as const) {
    ctx.beginPath();
    ctx.ellipse(m.x + x * k, m.y + y * k, rx * k, ry * k, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [x, y, r] of [[-18, -10, 6], [16, 14, 5], [8, -24, 4.5], [-10, 24, 3.5], [26, -8, 4], [-28, 10, 3.2], [30, 18, 2.6], [-2, 4, 2.4], [20, -26, 2.8], [-30, -16, 2.4]] as const) {
    const cx = m.x + x * k;
    const cy = m.y + y * k;
    const cr = r * k;
    ctx.fillStyle = tint(0.38);
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = tint(0.55);
    ctx.lineWidth = Math.max(0.8, cr * 0.28);
    ctx.beginPath();
    ctx.arc(cx, cy, cr * 0.82, Math.PI * 0.95, Math.PI * 1.75);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,252,240,0.7)";
    ctx.lineWidth = Math.max(0.7, cr * 0.22);
    ctx.beginPath();
    ctx.arc(cx, cy, cr, Math.PI * 0.05, Math.PI * 0.75);
    ctx.stroke();
  }
}

/** A five-roof pagoda silhouette, its base at (x, base), with a few lit windows. */
export function drawPagoda(ctx: CanvasRenderingContext2D, x: number, base: number, s: number): void {
  ctx.fillStyle = "#0E1226";
  const tiers = 5;
  let y = base;
  for (let i = 0; i < tiers; i++) {
    const w = (54 - i * 8) * s;
    const h = 16 * s;
    ctx.fillRect(x - w * 0.32, y - h, w * 0.64, h);
    // The roof: wide, swept up at its ends.
    ctx.beginPath();
    ctx.moveTo(x - w * 0.62, y - h + 1 * s);
    ctx.quadraticCurveTo(x - w * 0.42, y - h - 2 * s, x - w * 0.3, y - h - 6 * s);
    ctx.lineTo(x + w * 0.3, y - h - 6 * s);
    ctx.quadraticCurveTo(x + w * 0.42, y - h - 2 * s, x + w * 0.62, y - h + 1 * s);
    ctx.closePath();
    ctx.fill();
    // Moonlight along the roof's top edge (the materials pass).
    ctx.strokeStyle = "rgba(170,190,240,0.45)";
    ctx.lineWidth = Math.max(0.6, 0.9 * s);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, y - h - 6 * s);
    ctx.lineTo(x + w * 0.3, y - h - 6 * s);
    ctx.quadraticCurveTo(x + w * 0.42, y - h - 2 * s, x + w * 0.62, y - h + 1 * s);
    ctx.stroke();
    if (i < 3) {
      ctx.fillStyle = "rgba(255,190,90,0.55)";
      ctx.fillRect(x - 2 * s, y - h * 0.7, 3 * s, 5 * s);
      ctx.fillStyle = "#0E1226";
    }
    y -= h + 6 * s;
  }
  ctx.fillRect(x - 1 * s, y - 14 * s, 2 * s, 14 * s);
}

/* ================================ Walls ================================ */

export const NINJA_STONE_ROW = 30;
const ROW = NINJA_STONE_ROW;
/** The slate strip's period: this many courses, then the pattern repeats (960 px, 24 m). */
const SLATE_ROWS = 32;
const SLATE_H = SLATE_ROWS * ROW;

/*
 * Carved moonlit slate (the materials pass, 15 Nov 2026; concept A): each block a slate tone falling off to its foot,
 * fine grain and a strata line, a crisp lit bevel on its top edge and on the side facing the moonlit gap, a shadowed
 * bottom and far side, the odd chipped corner (lit on its broken face) and crack; mortar sunk dark between. Painted
 * once per wall and device scale into a strip SLATE_ROWS courses tall and copied in place each frame (where no
 * offscreen canvas exists, painted straight onto the frame). Shared with the play screen's fill (ricochetNinjaScene).
 */
const SLATE_TONES = ["#434C64", "#3B4359", "#4B5570", "#363E52", "#454E67", "#3F475E"] as const;
/** Paints courses r0 … r0 + n − 1 of one wall between x0 and x1; `rowAt(r)` is course r's top edge (y grows down). */
export function paintSlate(c: CanvasRenderingContext2D, wall: number, x0: number, x1: number, rowAt: (r: number) => number, r0: number, n: number): void {
  c.fillStyle = MORTAR;
  c.fillRect(x0, rowAt(r0 + n - 1), x1 - x0, n * ROW);
  const inner = wall === 0 ? 1 : -1;
  for (let k = 0; k < n; k++) {
    const r = r0 + k;
    const m = ((r % SLATE_ROWS) + SLATE_ROWS) % SLATE_ROWS;
    const sy = rowAt(r);
    const off = m % 2 === 0 ? 0 : 22;
    const start = wall === 0 ? x0 - off : x0 - off - 4;
    for (let bx = start; bx < x1; bx += 44) {
      const h = artHash(m * 7 + wall, Math.round(bx));
      const a = Math.max(x0, bx + 1);
      const b = Math.min(x1, bx + 43);
      if (b <= a) continue;
      const top = sy + 1;
      const bh = ROW - 2;
      const g = c.createLinearGradient(0, top, 0, top + bh);
      g.addColorStop(0, SLATE_TONES[h % SLATE_TONES.length]!);
      g.addColorStop(1, "#2A3043");
      c.fillStyle = g;
      c.fillRect(a, top, b - a, bh);
      // Grain: fine light and dark flecks from the block's own place, and a faint strata line.
      for (let i = 0; i < 10; i++) {
        const q = artHash(h, i + 3);
        c.fillStyle = q % 3 === 0 ? "rgba(205,215,245,0.10)" : "rgba(5,7,14,0.22)";
        c.fillRect(a + 2 + (q % Math.max(1, b - a - 4)), top + 3 + ((q >>> 8) % (bh - 6)), 1 + ((q >>> 16) % 3), 1);
      }
      c.fillStyle = "rgba(10,12,22,0.28)";
      c.fillRect(a + 1, top + 8 + ((h >>> 4) % 12), b - a - 2, 1);
      // The bevel: lit top edge and the side facing the gap, shadowed bottom and far side.
      c.fillStyle = "rgba(200,214,255,0.34)";
      c.fillRect(a, top, b - a, 1.5);
      c.fillStyle = "rgba(200,214,255,0.2)";
      if (inner === 1) c.fillRect(b - 1.5, top, 1.5, bh);
      else c.fillRect(a, top, 1.5, bh);
      c.fillStyle = "rgba(0,0,0,0.42)";
      c.fillRect(a, top + bh - 2, b - a, 2);
      if (inner === 1) c.fillRect(a, top, 1.5, bh);
      else c.fillRect(b - 1.5, top, 1.5, bh);
      // A chipped corner now and then, lit on its broken face.
      if (h % 6 === 0 && b - a > 14) {
        const cx = (h >>> 6) % 2 === 0 ? a : b;
        const d = cx === a ? 1 : -1;
        c.fillStyle = MORTAR;
        c.beginPath();
        c.moveTo(cx, top);
        c.lineTo(cx + d * 7, top);
        c.lineTo(cx, top + 6);
        c.closePath();
        c.fill();
        c.strokeStyle = "rgba(200,214,255,0.3)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(cx + d * 7, top + 0.5);
        c.lineTo(cx + d * 0.5, top + 6);
        c.stroke();
      }
      if (h % 9 === 0 && b - a > 20) {
        const cx = a + 6 + ((h >>> 5) % (b - a - 12));
        c.strokeStyle = "rgba(6,8,16,0.7)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(cx, top + 2);
        c.lineTo(cx + 3, top + 10);
        c.lineTo(cx - 1, top + bh - 2);
        c.stroke();
        c.strokeStyle = "rgba(200,214,255,0.14)";
        c.beginPath();
        c.moveTo(cx + 1, top + 2);
        c.lineTo(cx + 4, top + 10);
        c.stroke();
      }
    }
  }
}

/** The wall's light: a moonlit rim on its inner face and the wall's own shade further out (over the stone). */
function wallLight(c: CanvasRenderingContext2D, wall: number, y: number, h: number): void {
  const x0 = wall === 0 ? 0 : NINJA_WALL_R;
  const x1 = wall === 0 ? NINJA_WALL_L : NINJA_WORLD_W;
  const edge = wall === 0 ? NINJA_WALL_L - 4 : NINJA_WALL_R;
  const rim = c.createLinearGradient(edge, 0, edge + 4, 0);
  rim.addColorStop(0, wall === 0 ? "rgba(150,170,235,0.06)" : "rgba(175,195,255,0.42)");
  rim.addColorStop(1, wall === 0 ? "rgba(175,195,255,0.42)" : "rgba(150,170,235,0.06)");
  c.fillStyle = rim;
  c.fillRect(edge, y, 4, h);
  const shade = c.createLinearGradient(x0, 0, x1, 0);
  shade.addColorStop(wall === 0 ? 0 : 1, "rgba(0,0,10,0.38)");
  shade.addColorStop(wall === 0 ? 1 : 0, "rgba(0,0,10,0)");
  c.fillStyle = shade;
  c.fillRect(x0, y, x1 - x0, h);
}

/** Cached slate strips, by wall and device scale. */
const slateStrips = new Map<string, CanvasImageSource>();
function slateStrip(wall: number, k: number): CanvasImageSource | null {
  const key = `${wall}|${k.toFixed(3)}`;
  const hit = slateStrips.get(key);
  if (hit) return hit;
  const x0 = wall === 0 ? 0 : NINJA_WALL_R;
  const x1 = wall === 0 ? NINJA_WALL_L : NINJA_WORLD_W;
  const surface = artCanvas(Math.ceil((x1 - x0) * k), Math.ceil(SLATE_H * k));
  const c = surface ? (artContext(surface) as CanvasRenderingContext2D | null) : null;
  if (!surface || !c) return null;
  c.scale(k, k);
  c.translate(-x0, 0);
  // Course m (0 at the strip's bottom) has its top edge at SLATE_H − (m + 1) × ROW.
  paintSlate(c, wall, x0, x1, (r) => SLATE_H - (r + 1) * ROW, 0, SLATE_ROWS);
  wallLight(c, wall, 0, SLATE_H);
  if (slateStrips.size > 8) slateStrips.clear();
  slateStrips.set(key, surface as CanvasImageSource);
  return surface as CanvasImageSource;
}

function drawWall(ctx: CanvasRenderingContext2D, wall: number, cam: number): void {
  const x0 = wall === 0 ? 0 : NINJA_WALL_R;
  const x1 = wall === 0 ? NINJA_WALL_L : NINJA_WORLD_W;
  // Courses of carved slate scroll with the climb: course r's top edge is on screen at ninjaScreenY(cam, (r + 1) × ROW).
  const topPx = cam + EYE;
  const lowRow = Math.floor((topPx - NINJA_WORLD_H) / ROW) - 1;
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const k = t ? Math.max(0.5, Math.min(4, Math.hypot(t.a, t.b))) : 1;
  const strip = t ? slateStrip(wall, k) : null;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, 0, x1 - x0, NINJA_WORLD_H);
  ctx.clip();
  if (strip) {
    // Each copy of the strip holds courses base … base + SLATE_ROWS − 1; its top edge is the last one's top edge.
    for (let base = Math.floor(lowRow / SLATE_ROWS) * SLATE_ROWS; ; base += SLATE_ROWS) {
      const y = ninjaScreenY(cam, (base + SLATE_ROWS) * ROW);
      if (y < NINJA_WORLD_H) ctx.drawImage(strip, x0, y, x1 - x0, SLATE_H);
      if (y <= 0) break;
    }
  } else {
    const hiRow = Math.ceil(topPx / ROW) + 1;
    paintSlate(ctx, wall, x0, x1, (r) => ninjaScreenY(cam, (r + 1) * ROW), lowRow, hiRow - lowRow + 1);
    wallLight(ctx, wall, 0, NINJA_WORLD_H);
  }
  ctx.restore();
}

function drawFloor(ctx: CanvasRenderingContext2D, cam: number): void {
  const sy = ninjaScreenY(cam, (NINJA_START >> 8) - NINJA_HH);
  if (sy > NINJA_WORLD_H) return;
  // The temple's slate floor (the Action overhaul): the play screen's fill below the world carries on in the same
  // colour (MOON_FLOOR, ricochetNinjaScene.renderer.ts), so there is no step at the world's bottom edge.
  ctx.fillStyle = MOON_FLOOR;
  ctx.fillRect(NINJA_WALL_L, sy, NINJA_WALL_R - NINJA_WALL_L, NINJA_WORLD_H - sy + 2);
  ctx.fillStyle = "#3A4466";
  ctx.fillRect(NINJA_WALL_L, sy, NINJA_WALL_R - NINJA_WALL_L, 3);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let x = NINJA_WALL_L + 30; x < NINJA_WALL_R; x += 60) ctx.fillRect(x, sy + 3, 1.5, NINJA_WORLD_H - sy);
}
/** The floor's slate, shared with the play screen's fill below the world. */
export const MOON_FLOOR = "#1E2540";

/* ================================ Objects ================================ */

/**
 * A moss or ice patch on a wall, 14 px into the stone with a lip at the face. Moss: green with lighter tufts and drips.
 * Ice: pale blue and frosted (white speckles, crystal streaks, a glint running down it) with icicles off its lower
 * edge, so it reads as plainly as the moss.
 */
export function drawPatch(ctx: CanvasRenderingContext2D, wall: number, kind: number, top: number, bottom: number, tick: number): void {
  const face = wall === 0 ? NINJA_WALL_L : NINJA_WALL_R;
  const depth = 14;
  const x = wall === 0 ? face - depth : face;
  const h = bottom - top;
  const inward = wall === 0 ? 1 : -1;
  if (kind === SURF_MOSS) {
    // Wet moss (the materials pass): deep in the stone, brighter at the lip, in rounded clumps each lit on its upper
    // side and catching a crisp wet highlight; never like ice.
    const mg = ctx.createLinearGradient(x, 0, x + depth, 0);
    mg.addColorStop(wall === 0 ? 0 : 1, "#1F4A19");
    mg.addColorStop(wall === 0 ? 1 : 0, MOSS);
    ctx.fillStyle = mg;
    ctx.fillRect(x, top, depth, h);
    for (let i = 0; i * 9 < h; i++) {
      const hh = artHash(i, Math.round(top) * 5 + wall);
      const cx = x + 3 + (hh % (depth - 6));
      const cy = top + 4 + i * 9;
      ctx.fillStyle = "#24521C";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1, 3.6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5A9A3E";
      ctx.beginPath();
      ctx.ellipse(cx - 0.6, cy - 0.4, 2.6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(225,255,205,0.85)";
      ctx.fillRect(cx - 1.6, cy - 1.6, 1.2, 1);
    }
    ctx.fillStyle = "#6FB04E";
    for (let y = top + 4; y < bottom - 2; y += 9) ctx.fillRect(wall === 0 ? face - 4 : face + 1, y, 3, 4);
    ctx.fillStyle = "#86C861";
    ctx.fillRect(wall === 0 ? face - 2 : face, top, 2, h);
    // Drips into the gap.
    ctx.fillStyle = "#3C6E2C";
    for (let i = 0; i < 3; i++) ctx.fillRect(wall === 0 ? face : face - 2, top + ((i + 1) * h) / 4, 2, 5);
  } else {
    // Glassy ice (the materials pass): a clear sheet, deep blue where it meets the stone and pale at its rounded lip,
    // the slate faintly through it, a long crisp highlight on the curve.
    const g = ctx.createLinearGradient(x, 0, x + depth, 0);
    g.addColorStop(wall === 0 ? 0 : 1, "rgba(70,140,190,0.78)");
    g.addColorStop(0.55, "rgba(160,215,240,0.86)");
    g.addColorStop(wall === 0 ? 1 : 0, "rgba(235,250,255,0.96)");
    ctx.fillStyle = g;
    ctx.fillRect(x, top, depth, h);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(wall === 0 ? face - 7 : face + 5, top + 3, 1.2, Math.max(0, h - 6));
    // Frost: white speckles and slanted crystal streaks, from the patch's own place.
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i * 7 < h; i++) {
      const hh = artHash(i, Math.round(top) * 3 + wall);
      ctx.fillRect(x + 1 + (hh % (depth - 3)), top + i * 7 + ((hh >>> 8) % 5), 2, 1.5);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = top + 6; y < bottom - 6; y += 16) {
      ctx.moveTo(x + 2, y);
      ctx.lineTo(x + depth - 2, y - 6);
    }
    ctx.stroke();
    // The lip at the face and a glint running down it.
    ctx.fillStyle = "#F4FBFF";
    ctx.fillRect(wall === 0 ? face - 2 : face, top, 2, h);
    const shine = (tick * 2 + top) % Math.max(1, Math.round(h + 40));
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(wall === 0 ? face - 5 : face + 2, top + shine - 20, 3, 14);
    // Icicles off the lower edge, along the face.
    ctx.fillStyle = "#D6F0FC";
    for (const [dx, len] of [[1, 9], [5, 6], [9, 8]] as const) {
      const ix = face - inward * dx;
      ctx.beginPath();
      ctx.moveTo(ix - 2, bottom);
      ctx.lineTo(ix + 2, bottom);
      ctx.lineTo(ix, bottom + len);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export function drawKatana(ctx: CanvasRenderingContext2D, wall: number, sy: number, tick: number, seed: number): void {
  const dir = wall === 0 ? 1 : -1;
  const face = wall === 0 ? NINJA_WALL_L : NINJA_WALL_R;
  // The wrapped hilt against the wall (the materials pass; concept A): dark cord diamonds over red, a steel pommel.
  // A short stub inside the stone, never more than 8 px from the face.
  const hx = wall === 0 ? face - 6.5 : face + 1;
  ctx.fillStyle = "#7A1420";
  ctx.fillRect(hx, sy - 2.5, 5.5, 5);
  ctx.fillStyle = "#14161E";
  for (let i = 0; i < 2; i++) {
    const cx = hx + 0.3 + i * 2.6;
    ctx.beginPath();
    ctx.moveTo(cx, sy);
    ctx.lineTo(cx + 1.3, sy - 2.5);
    ctx.lineTo(cx + 2.6, sy);
    ctx.lineTo(cx + 1.3, sy + 2.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#AEB6C4";
  ctx.fillRect(wall === 0 ? hx - 1.5 : hx + 5.5, sy - 2.5, 1.5, 5);
  // The blade: polished steel inside the sim's KATANA_LEN × 2·KATANA_HALF box, dark at the spine and bright to the
  // cutting edge, a pale temper line, a crisp specular edge and a long sharp tip, outlined so it reads on any stone.
  ctx.beginPath();
  ctx.moveTo(face + dir * 6, sy - KATANA_HALF + 0.5);
  ctx.lineTo(face + dir * (KATANA_LEN - 12), sy - KATANA_HALF + 0.5);
  ctx.lineTo(face + dir * (KATANA_LEN - 0.5), sy + KATANA_HALF - 1);
  ctx.lineTo(face + dir * 6, sy + KATANA_HALF - 0.5);
  ctx.closePath();
  const steel = ctx.createLinearGradient(0, sy - KATANA_HALF, 0, sy + KATANA_HALF);
  steel.addColorStop(0, "#5D6676");
  steel.addColorStop(0.45, "#C3CBD8");
  steel.addColorStop(0.75, "#EEF2F8");
  steel.addColorStop(1, "#9AA4B4");
  ctx.fillStyle = steel;
  ctx.fill();
  ctx.lineJoin = "miter";
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#0B0D16";
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const px = face + dir * (8 + i * ((KATANA_LEN - 22) / 8));
    const py = sy + 0.6 + (i % 2 === 0 ? -0.6 : 0.6);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(Math.min(face + dir * 7, face + dir * (KATANA_LEN - 4)), sy + KATANA_HALF - 2, KATANA_LEN - 11, 1);
  // A glint running along it every couple of seconds.
  const p = (tick + (seed % 97)) % 130;
  if (p < 24) {
    const gx = face + dir * (8 + (p * (KATANA_LEN - 14)) / 24);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(gx - 2, sy - KATANA_HALF + 1, 4, 3);
  }
  // The gold guard at the wall: polished, lit along its top, shadowed underneath, a crisp highlight.
  const gx0 = wall === 0 ? face + 1.5 : face - 5.5;
  const gold = ctx.createLinearGradient(0, sy - 6, 0, sy + 6);
  gold.addColorStop(0, "#FFE9A3");
  gold.addColorStop(0.4, NINJA_GOLD);
  gold.addColorStop(1, "#8A5E16");
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.roundRect(gx0, sy - 6, 4, 12, 1.5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(gx0 + 0.8, sy - 5, 1, 4);
}

/** A shuriken: steel grey with a dark outline and a red centre ring, its four points turning (the sim's radius at the points). */
export function drawShuriken(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((tick % 20) * ((Math.PI * 2) / 20));
  const r = SHURIKEN_R - 0.5;
  // A faint red danger ring at the touch radius (the Action overhaul: a hazard reads at a glance).
  ctx.strokeStyle = "rgba(255,80,90,0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, SHURIKEN_R - 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a + Math.PI / 4) * 2.9, Math.sin(a + Math.PI / 4) * 2.9);
  }
  ctx.closePath();
  // Blued steel with a sheen across it (the materials pass): the sheen turns with the star, so it flashes as it spins.
  const sheen = ctx.createLinearGradient(-r, -r, r, r);
  sheen.addColorStop(0, "#4E5868");
  sheen.addColorStop(0.5, "#B9C2D0");
  sheen.addColorStop(1, "#5F6A7C");
  ctx.fillStyle = sheen;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "#14161E";
  ctx.stroke();
  // A bright bevel on one side of each point, so the turning reads.
  ctx.fillStyle = "#E6EBF3";
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (r - 1.5), Math.sin(a) * (r - 1.5));
    ctx.lineTo(Math.cos(a + Math.PI / 4) * 3, Math.sin(a + Math.PI / 4) * 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = NINJA_RED;
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#14161E";
  ctx.beginPath();
  ctx.arc(0, 0, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A shuriken's seeded path across the gap: a faint dotted line from wall to wall. */
function drawShurikenPath(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255,120,120,0.28)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 6]);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number): void {
  const squash = 0.55 + 0.45 * Math.abs(Math.cos((tick + x) / 14));
  ctx.fillStyle = "#B8862A";
  ctx.beginPath();
  ctx.ellipse(x, y, COIN_R * squash, COIN_R, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFD86B";
  ctx.beginPath();
  ctx.ellipse(x, y, (COIN_R - 2) * squash, COIN_R - 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8A5E16";
  ctx.fillRect(x - 1.5 * squash, y - 2, 3 * squash, 4);
}

export function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number): void {
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 26);
  glow.addColorStop(0, `rgba(255,200,90,${0.42 + 0.08 * Math.sin(tick / 9)})`);
  glow.addColorStop(1, "rgba(255,200,90,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 26, y - 26, 52, 52);
  ctx.fillStyle = "#3A2A10";
  ctx.fillRect(x - 5, y - LANTERN_R, 10, 2);
  ctx.fillRect(x - 5, y + LANTERN_R - 2, 10, 2);
  ctx.fillStyle = NINJA_GOLD;
  ctx.beginPath();
  ctx.ellipse(x, y, LANTERN_R - 2, LANTERN_R - 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(150,90,20,0.7)";
  ctx.lineWidth = 1;
  for (const dx of [-4, 0, 4]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y - LANTERN_R + 3);
    ctx.lineTo(x + dx, y + LANTERN_R - 3);
    ctx.stroke();
  }
}

export function drawScroll(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number): void {
  const bob = Math.round(Math.sin(tick / 12));
  ctx.fillStyle = "rgba(255,240,200,0.28)";
  ctx.beginPath();
  ctx.arc(x, y + bob, SCROLL_R + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F3E6C4";
  ctx.fillRect(x - SCROLL_R + 2, y - 5 + bob, 2 * SCROLL_R - 4, 10);
  ctx.fillStyle = "#7A4B22";
  ctx.fillRect(x - SCROLL_R, y - 6 + bob, 3, 12);
  ctx.fillRect(x + SCROLL_R - 3, y - 6 + bob, 3, 12);
  ctx.fillStyle = NINJA_RED;
  ctx.fillRect(x - 1, y - 5 + bob, 3, 10);
}

/**
 * A mid-ledge (Moon Climb): a slim hanging piece of the temple's stone, MOON_LEDGE_HW × 2 px wide from `top` to
 * `bottom` (screen y), with a bronze cap at each end and a rope up from its top. Drawn inside its sim box.
 */
export function drawLedge(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number): void {
  const w = MOON_LEDGE_HW * 2;
  const l = x - MOON_LEDGE_HW;
  ctx.strokeStyle = "rgba(190,170,130,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, top - 22);
  ctx.lineTo(x, top);
  ctx.stroke();
  ctx.fillStyle = STONE;
  ctx.fillRect(l, top, w, bottom - top);
  ctx.fillStyle = STONE_LIT;
  ctx.fillRect(l, top, 3, bottom - top);
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(l + w - 3, top, 3, bottom - top);
  ctx.fillStyle = MORTAR;
  for (let y = top + 22; y < bottom - 8; y += 22) ctx.fillRect(l + 2, Math.round(y), w - 4, 1.5);
  ctx.fillStyle = "#B8873A";
  ctx.fillRect(l, top, w, 4);
  ctx.fillRect(l, bottom - 4, w, 4);
  ctx.fillStyle = "rgba(255,226,150,0.6)";
  ctx.fillRect(l + 1, top, w - 2, 1.2);
}

/**
 * A sky lantern (Moon Climb): a paper lantern glowing orange, its body inside the touch radius (MOON_SKY_R round its
 * centre), a dark cap and base and a short tassel; the glow round it is light only.
 */
export function drawSkyLantern(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number, ridden = false): void {
  // Translucent paper lit from within (the materials pass; no glow round it): bright where the flame sits low in the
  // body, deepening to orange at the curved edge, the bamboo ribs dark against the light, lacquered caps.
  const flick = Math.sin(tick / 7 + x) * 0.8;
  const r = MOON_SKY_R;
  const body = ctx.createRadialGradient(x, y + 3 + flick * 0.5, 1, x, y, r);
  body.addColorStop(0, ridden ? "#FFF4D6" : "#FFEBC0");
  body.addColorStop(0.35, "#FFC066");
  body.addColorStop(0.8, "#F07A2A");
  body.addColorStop(1, "#B9461A");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y, r - 3, r - 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(110,38,8,0.6)";
  ctx.lineWidth = 0.9;
  for (const dx of [-7, -3.5, 0, 3.5, 7]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * 0.55, y - r + 3);
    ctx.quadraticCurveTo(x + dx * 1.05, y, x + dx * 0.55, y + r - 3);
    ctx.stroke();
  }
  // The flame inside, soft through the paper.
  ctx.fillStyle = "rgba(255,250,225,0.75)";
  ctx.beginPath();
  ctx.ellipse(x, y + 4 + flick * 0.5, 2, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Lacquered caps with a thin highlight, and the tassel.
  const cap = ctx.createLinearGradient(0, y - r, 0, y - r + 3);
  cap.addColorStop(0, "#6A3418");
  cap.addColorStop(1, "#2A140A");
  ctx.fillStyle = cap;
  ctx.fillRect(x - 6, y - r, 12, 3);
  ctx.fillStyle = "#2A140A";
  ctx.fillRect(x - 5, y + r - 3, 10, 3);
  ctx.fillStyle = "rgba(255,210,160,0.7)";
  ctx.fillRect(x - 5, y - r, 10, 0.8);
  ctx.fillStyle = NINJA_RED;
  ctx.fillRect(x - 1, y + r - 1, 2, 2);
}

/**
 * The ninja: the Joulz hero (hero.renderer.ts, the figure the score celebrations draw: its gold cape, gold-outlined black
 * limbs, chest bolt, gold gloves and boots, black head with the gold ring, mask band and eye slits) in ninja gear: a
 * dark wrap round the head that leaves the hero's face showing, a red headband with trailing tails, a red sash and a
 * small katana on the back. Every pose sits inside the sim's body box (NINJA_HW × NINJA_HH either side of (x, y)),
 * so what you see is what is hit. `pose`: 0 clinging (hands and feet on the wall behind, `face` +1 facing right),
 * 1 leaping (stretched along the arc), 2 double jump (a tuck turning through `spin`), 3 stunned (arms dropped,
 * swaying), 4 hanging from a sky lantern (Moon Climb). `scale` draws it larger or smaller (the tile icon); the game draws at 1.
 */
const ninjaPoseMemo = heroPose();
const NINJA_WRAP = "#2A2D45";
const NINJA_WRAP_EDGE = "#6B72A8";

function setPose(p: HeroPose, pose: number, face: number, tick: number): void {
  const f = face;
  const at = (k: keyof HeroPose, v: number) => {
    (p as unknown as Record<string, number>)[k] = v;
  };
  // Bolder since 3 Nov 2026 (Joe's audit: the hero read small at play size): thicker limbs and a bigger head, still
  // inside the 26 × 52 body box (the hood's edge at most 11 px out, the box's half-width 13).
  // Bolder again in the Action overhaul (15 Nov 2026): the figure already fills its body box, so it reads bigger by
  // weight (thicker limbs), not by reaching past the box the blades hit.
  p.stick = 5.2;
  p.headR = 8;
  p.scale = 1;
  p.detailScale = NaN;
  p.core = null;
  p.gentle = false;
  p.face = 0.7 * f;
  if (pose === 0) {
    // Clinging: crouched to the wall behind, hands up on the stone, feet braced.
    const wall = -f * 10.2;
    at("headX", f * 1); at("headY", -18);
    at("neckX", 0); at("neckY", -11);
    at("shoulderX", 0); at("shoulderY", -8);
    at("hipX", -f * 2); at("hipY", 7);
    at("handAX", wall); at("handAY", -20);
    at("handBX", wall); at("handBY", -1);
    at("footAX", wall); at("footAY", 23);
    at("footBX", f * 5); at("footBY", 23);
    p.moveX = 0; p.moveY = 1; p.speed = 0.15;
  } else if (pose === 1) {
    // Leaping: stretched up along the arc, the leading arm reaching, the legs trailing.
    at("headX", f * 5); at("headY", -18);
    at("neckX", f * 3); at("neckY", -11);
    at("shoulderX", f * 3); at("shoulderY", -8);
    at("hipX", -f * 2); at("hipY", 7);
    at("handAX", f * 11); at("handAY", -22);
    at("handBX", -f * 9); at("handBY", -3);
    at("footAX", -f * 8); at("footAY", 23);
    at("footBX", f * 2); at("footBY", 21);
    p.moveX = f; p.moveY = -1; p.speed = 0.3;
  } else if (pose === 2) {
    // The double jump: tucked into a ball (turned by the caller).
    at("headX", f * 2); at("headY", -10);
    at("neckX", 0); at("neckY", -4);
    at("shoulderX", 0); at("shoulderY", -2);
    at("hipX", 0); at("hipY", 7);
    at("handAX", f * 8); at("handAY", 4);
    at("handBX", -f * 7); at("handBY", 5);
    at("footAX", f * 6); at("footAY", 12);
    at("footBX", -f * 4); at("footBY", 13);
    p.moveX = 0; p.moveY = 0; p.speed = 0;
  } else if (pose === 4) {
    // Riding a sky lantern: hanging from both hands above the head, the legs together and swinging a little.
    const sway = Math.sin(tick / 9) * 2;
    at("headX", 0); at("headY", -14);
    at("neckX", 0); at("neckY", -7);
    at("shoulderX", 0); at("shoulderY", -5);
    at("hipX", sway * 0.3); at("hipY", 9);
    at("handAX", -3); at("handAY", -24);
    at("handBX", 3); at("handBY", -24);
    at("footAX", sway - 2); at("footAY", 24);
    at("footBX", sway + 3); at("footBY", 23);
    p.moveX = 0; p.moveY = -1; p.speed = 0.2;
  } else {
    // Stunned: upright, arms dropped wide, swaying.
    const sway = Math.sin(tick / 5) * 2;
    at("headX", sway); at("headY", -18);
    at("neckX", sway * 0.6); at("neckY", -11);
    at("shoulderX", sway * 0.6); at("shoulderY", -8);
    at("hipX", 0); at("hipY", 7);
    at("handAX", -11); at("handAY", 3);
    at("handBX", 11); at("handBY", 3);
    at("footAX", -6); at("footAY", 24);
    at("footBX", 6); at("footBY", 24);
    p.moveX = 0; p.moveY = 0; p.speed = 0;
  }
}

export function drawNinja(ctx: CanvasRenderingContext2D, x: number, y: number, pose: number, face: number, tick: number, spin = 0, scale = 1): void {
  const p = ninjaPoseMemo;
  setPose(p, pose, face, tick);
  ctx.save();
  ctx.translate(x, y);
  if (scale !== 1) ctx.scale(scale, scale);
  const f = face;
  // A soft moonlit glow behind the figure (inside its body box), so it reads on the night sky; brighter since the
  // Action overhaul (15 Nov 2026), with a firmer gold rim: the ninja is the first thing the eye finds.
  ctx.fillStyle = "rgba(175,195,255,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, 0, NINJA_HW + 1, NINJA_HH + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(242,199,92,0.55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (pose === 2) ctx.rotate(spin * face);
  // The katana on the back, behind the hero: a dark scabbard and a gold-wrapped hilt over the far shoulder.
  ctx.save();
  ctx.translate(p.neckX - f * 5, p.neckY + 2);
  ctx.rotate(f * 0.5);
  ctx.fillStyle = "#3B2A4A";
  ctx.fillRect(-1.8, -1, 3.6, 13);
  ctx.strokeStyle = "#0A0B12";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-1.8, -1, 3.6, 13);
  ctx.fillStyle = NINJA_GOLD;
  ctx.fillRect(-3, -2.4, 6, 1.8);
  // The hilt over the shoulder: red wrap with a steel pommel.
  ctx.fillStyle = NINJA_RED;
  ctx.fillRect(-1.4, -10.5, 2.8, 8);
  ctx.fillStyle = "#0A0B12";
  for (let k = 0; k < 3; k++) ctx.fillRect(-1.4, -9.5 + k * 2.6, 2.8, 0.7);
  ctx.fillStyle = STEEL;
  ctx.fillRect(-1.8, -12, 3.6, 1.6);
  ctx.restore();
  // The ninja wrap round the head: a dark hood larger than the head, peaked behind, with the face left open.
  ctx.fillStyle = NINJA_WRAP;
  ctx.beginPath();
  ctx.arc(p.headX, p.headY, p.headR + 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(p.headX - f * (p.headR + 1), p.headY - 3);
  ctx.lineTo(p.headX - f * (p.headR + 5), p.headY + 5);
  ctx.lineTo(p.headX - f * 1, p.headY + p.headR + 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = NINJA_WRAP_EDGE;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(p.headX, p.headY, p.headR + 2.4, 0, Math.PI * 2);
  ctx.stroke();
  // The hero itself (cape, limbs, bolt, gloves and boots, head with its face).
  drawHero(ctx, p);
  // The red sash at the waist, its knot's ends trailing.
  const tx = p.hipX - p.neckX;
  const ty = p.hipY - p.neckY;
  const sx = p.neckX + tx * 0.82;
  const sy = p.neckY + ty * 0.82;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(Math.atan2(ty, tx) - Math.PI / 2);
  ctx.fillStyle = NINJA_RED;
  ctx.fillRect(-5.2, -1.6, 10.4, 3.4);
  ctx.beginPath();
  ctx.moveTo(-f * 4, 1.5);
  ctx.lineTo(-f * 8, 6 + Math.sin(tick / 4));
  ctx.lineTo(-f * 5.5, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // The red headband across the brow (over the wrap, above the gold mask band), its two tails streaming behind.
  ctx.save();
  ctx.translate(p.headX, p.headY);
  ctx.fillStyle = NINJA_RED;
  ctx.fillRect(-p.headR - 1.6, -p.headR * 0.78, (p.headR + 1.6) * 2, 2.6);
  const flap = Math.sin(tick / 3) * 1.6;
  const back = -f * (p.headR + 1);
  ctx.beginPath();
  ctx.moveTo(back, -p.headR * 0.7);
  ctx.lineTo(back - f * 6, -p.headR * 0.7 - 2 + flap);
  ctx.lineTo(back - f * 5.5, -p.headR * 0.7 + 1 + flap);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(back, -p.headR * 0.55);
  ctx.lineTo(back - f * 5, -p.headR * 0.4 + 2 - flap);
  ctx.lineTo(back - f * 4, -p.headR * 0.3 + 3 - flap);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/* ================================ The frame ================================ */

/**
 * Moon Climb's HUD lines (the Action overhaul, 15 Nov 2026): the first row HEIGHT N m (the main count) left and
 * FLOW ×N right (gold while a streak runs); the second row the two other scored parts, lantern RIDES n/6 left and
 * SCROLLS n/3 right, each gold once complete and flashing as one is taken. Exported for the check.
 */
export function moonHudRows(s: MoonState): ActionHudRow[] {
  const m = ninjaMetres(s);
  const lit = s.tick - s.flowTick < 30;
  const grab = s.tick - s.grabTick < 30 ? 1 - (s.tick - s.grabTick) / 30 : 0;
  const scroll = s.tick - s.pickTick < 30 ? 1 - (s.tick - s.pickTick) / 30 : 0;
  return [
    {
      left: [{ label: "HEIGHT", value: `${m} m`, tone: m >= MOON_CORE_FULL_M ? "gold" : "plain", pulse: { id: "ricochet", tick: s.tick } }],
      right: [{ label: "FLOW", value: `×${s.streak}`, tone: s.streak > 0 ? "gold" : "dim", flash: lit ? 1 - (s.tick - s.flowTick) / 30 : 0 }],
    },
    {
      left: [{ label: "RIDES", value: `${s.rides}/${MOON_SKY}`, tone: s.rides >= MOON_SKY ? "gold" : "plain", flash: grab, icon: (c, x, y) => drawSkyLanternIcon(c, x, y) }],
      right: [{ label: "SCROLLS", value: `${s.scrolls}/${MOON_SCROLLS}`, tone: s.scrolls >= MOON_SCROLLS ? "gold" : "plain", flash: scroll, icon: (c, x, y) => drawScrollIcon(c, x, y) }],
    },
  ];
}

/** A small sky lantern for the HUD chip (14 px). */
function drawSkyLanternIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#FF9C45";
  ctx.beginPath();
  ctx.ellipse(x, y, 4.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3A2210";
  ctx.fillRect(x - 3.5, y - 7, 7, 2);
  ctx.fillRect(x - 3, y + 5, 6, 2);
}

/** A small scroll for the HUD chip (14 px). */
function drawScrollIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#F3E6C4";
  ctx.fillRect(x - 5, y - 3.5, 10, 7);
  ctx.fillStyle = "#7A4B22";
  ctx.fillRect(x - 6.5, y - 4.5, 2, 9);
  ctx.fillRect(x + 4.5, y - 4.5, 2, 9);
  ctx.fillStyle = NINJA_RED;
  ctx.fillRect(x - 0.75, y - 3.5, 1.5, 7);
}

function drawMoonHud(ctx: CanvasRenderingContext2D, s: MoonState): void {
  drawActionHud(ctx, NINJA_WORLD_W, moonHudRows(s));
}

/** The HUD: "Height N m" top left, the items top right. */
function drawHud(ctx: CanvasRenderingContext2D, s: NinjaState): void {
  if (s.rev === MOON_REV) {
    drawMoonHud(ctx, s as MoonState);
    return;
  }
  const chip = (x: number, w: number) => {
    ctx.fillStyle = "rgba(6,8,18,0.62)";
    ctx.beginPath();
    ctx.roundRect(x, 10, w, 26, 8);
    ctx.fill();
  };
  const m = ninjaMetres(s);
  chip(10, 128);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `700 11px ${MONO}`;
  ctx.fillStyle = "#BFC4DA";
  ctx.fillText("HEIGHT", 18, 23);
  ctx.font = `800 15px ${ARCADE_FX_DISPLAY_FONT}`;
  ctx.fillStyle = m >= NINJA_CORE_FULL_M ? NINJA_GOLD : "#F5F5F7";
  ctx.fillText(`${m} m`, 70, 23.5);
  // Coins, lanterns and scrolls.
  chip(NINJA_WORLD_W - 150, 140);
  const base = NINJA_WORLD_W - 140;
  drawCoin(ctx, base + 6, 23, 0);
  drawLantern(ctx, base + 52, 23, 0);
  drawScroll(ctx, base + 100, 23, 0);
  ctx.font = `700 12px ${MONO}`;
  ctx.fillStyle = "#F5F5F7";
  ctx.fillText(String(s.coins), base + 16, 24);
  ctx.fillText(String(s.lanterns), base + 66, 24);
  ctx.fillText(String(s.scrolls), base + 113, 24);
}

/** Where the ninja is drawn this frame (world px): the sim's own x and height. */
export function ninjaDrawPoint(s: NinjaState): { x: number; y: number } {
  return { x: s.x, y: ninjaScreenY(ninjaCamera(s), s.y >> 8) };
}

export function drawNinjaWorld(ctx: CanvasRenderingContext2D, s: NinjaState): void {
  const W = NINJA_WORLD_W;
  const H = NINJA_WORLD_H;
  const cam = ninjaCamera(s);
  const t = s.tick;
  const moon = s.rev === MOON_REV ? (s as MoonState) : null;
  if (moon) {
    deviceLayer(ctx, "moon-sky-v2", paintMoonSky);
    drawMoonNight(ctx, moonNight(s), t);
    deviceLayer(ctx, "moon-ridge-v2", paintMoonRidge);
  } else deviceLayer(ctx, "ninja-sky", paintSky);
  drawWall(ctx, 0, cam);
  drawWall(ctx, 1, cam);
  drawFloor(ctx, cam);
  const lo = cam - (H - EYE) - 40;
  const hi = cam + EYE + 40;
  const tower = s.tower;
  for (const p of tower.patches) {
    if (p.hi < lo) continue;
    if (p.lo > hi) break;
    drawPatch(ctx, p.wall, p.kind, ninjaScreenY(cam, p.hi), ninjaScreenY(cam, p.lo), t);
  }
  // Each shuriken's seeded path, faint and dotted, under everything else in the gap.
  for (const sh of tower.shurikens) {
    if (Math.max(sh.y0, sh.y0 + sh.dy) < lo) continue;
    if (Math.min(sh.y0, sh.y0 + sh.dy) > hi) break;
    drawShurikenPath(ctx, SHURIKEN_X0, ninjaScreenY(cam, sh.y0), SHURIKEN_X1, ninjaScreenY(cam, sh.y0 + sh.dy));
  }
  for (const k of tower.katanas) {
    if (k.y < lo) continue;
    if (k.y > hi) break;
    drawKatana(ctx, k.wall, ninjaScreenY(cam, k.y), t, k.y);
  }
  if (moon) {
    for (const l of moon.tower.ledges) {
      if (l.hi < lo) continue;
      if (l.lo > hi) break;
      drawLedge(ctx, l.x, ninjaScreenY(cam, l.hi), ninjaScreenY(cam, l.lo));
    }
    moon.tower.sky.forEach((l, i) => {
      if (moon.gotSky[i]) return;
      const p = moonSkyAt(l, t);
      if (!p || p.y < lo || p.y > hi) return;
      drawSkyLantern(ctx, p.x, ninjaScreenY(cam, p.y), t);
    });
  }
  tower.lanterns.forEach((l, i) => {
    if (s.gotLanterns[i]) return;
    const p = lanternAt(l, t);
    if (p.y < lo || p.y > hi) return;
    drawLantern(ctx, p.x, ninjaScreenY(cam, p.y), t);
  });
  tower.coins.forEach((c, i) => {
    if (s.gotCoins[i] || c.y < lo || c.y > hi) return;
    drawCoin(ctx, c.x, ninjaScreenY(cam, c.y), t);
  });
  tower.scrolls.forEach((c, i) => {
    if (s.gotScrolls[i] || c.y < lo || c.y > hi) return;
    drawScroll(ctx, c.x, ninjaScreenY(cam, c.y), t);
  });
  for (const sh of tower.shurikens) {
    if (Math.max(sh.y0, sh.y0 + sh.dy) < lo) continue;
    if (Math.min(sh.y0, sh.y0 + sh.dy) > hi) break;
    const p = shurikenAt(sh, t);
    drawShuriken(ctx, p.x, ninjaScreenY(cam, p.y), t);
  }
  // The ninja: blinking while stunned or in its grace.
  const at = ninjaDrawPoint(s);
  const blink = s.safe > 0 && s.mode !== MODE_STUN && Math.trunc(t / 4) % 2 === 0;
  // On a mid-ledge the ninja faces away from it (its side is the wall it was heading for).
  const onLedge = moon !== null && moon.mode !== MODE_FLIGHT && moon.ledge >= 0;
  const face = s.mode === MODE_FLIGHT ? (s.wall === 1 ? 1 : -1) : onLedge ? (s.wall === 1 ? -1 : 1) : s.wall === 0 ? 1 : -1;
  const pose = s.mode === MODE_STUN ? 3 : s.mode === MODE_RIDE ? 4 : s.mode === MODE_FLIGHT ? (s.dj && s.hang > 0 ? 2 : 1) : 0;
  // The ridden lantern above the ninja's hands.
  if (moon && moon.mode === MODE_RIDE) drawSkyLantern(ctx, at.x, at.y - MOON_RIDE_HANG, t, true);
  if (blink) ctx.globalAlpha = 0.4;
  drawNinja(ctx, at.x, at.y, pose, face, t, s.dj ? ((NINJA_HANG - s.hang) / NINJA_HANG) * Math.PI * 2 : 0);
  ctx.globalAlpha = 1;
  if (s.mode === MODE_STUN) {
    // Stars round the head.
    ctx.fillStyle = NINJA_GOLD;
    for (let i = 0; i < 3; i++) {
      const a = t / 6 + (i * Math.PI * 2) / 3;
      ctx.fillRect(at.x + Math.cos(a) * 11 - 1.5, at.y - NINJA_HH - 2 + Math.sin(a) * 3 - 1.5, 3, 3);
    }
  }
  // A red wash on a hit.
  if (t - s.hitTick < 12) {
    ctx.fillStyle = `rgba(224,40,58,${0.22 * (1 - (t - s.hitTick) / 12)})`;
    ctx.fillRect(0, 0, W, H);
  }
  drawHud(ctx, s);
}

const isMoon = (s: NinjaState): s is MoonState => s.rev === MOON_REV;

/**
 * The shared success layer: coins (Moon Climb: each Flow step), gold lanterns (Moon Climb: a sky lantern grabbed) and
 * scrolls taken, every 50 m, and the core's full height.
 */
export const NINJA_FX: ArcadeFxSpec<NinjaState> = {
  game: "ricochet",
  world: "realworld",
  width: NINJA_WORLD_W,
  height: NINJA_WORLD_H,
  shake: true,
  textInset: 40,
  events: [
    { kind: "pop", count: (s) => (isMoon(s) ? s.flow : s.coins), at: (s) => ninjaDrawPoint(s), label: (s) => (isMoon(s) ? `FLOW ×${s.streak}` : "+COIN"), colour: (s) => (isMoon(s) ? NINJA_GOLD : undefined) },
    { kind: "combo", count: (s) => (isMoon(s) ? s.rides : s.lanterns), at: (s) => ninjaDrawPoint(s), label: (s) => (isMoon(s) ? "LANTERN RIDE!" : "LANTERN!"), colour: (s) => (isMoon(s) ? "#FFB259" : NINJA_GOLD) },
    { kind: "perfect", count: (s) => s.scrolls, at: (s) => ninjaDrawPoint(s), label: () => "SCROLL!", colour: () => "#FFF3C9" },
    { kind: "streak", count: (s) => ninjaMetres(s), every: 50, min: 50, label: (_s, n) => `${Math.floor(n / 50) * 50} m` },
    { kind: "final", count: (s) => (ninjaMetres(s) >= (isMoon(s) ? MOON_CORE_FULL_M : NINJA_CORE_FULL_M) ? 1 : 0), label: () => "FULL HEIGHT!" },
  ],
  misses: [{ count: (s) => s.hits, at: (s) => ninjaDrawPoint(s) }],
};

export function drawNinjaFrame(ctx: CanvasRenderingContext2D, state: NinjaState, size: CanvasSize): void {
  arcadeFx(ctx, NINJA_FX, state, () => {
    ctx.save();
    ctx.scale(size.width / NINJA_WORLD_W, size.height / NINJA_WORLD_H);
    drawNinjaWorld(ctx, state);
    ctx.restore();
  }, size);
}

/** The game with its art (the stage, the reveal's frame and the replay player draw through it). */
export const ninjaArtGame = { ...ninjaGame, draw: drawNinjaFrame };
/** Moon Climb (ricoRev 3) with its art. */
export const moonArtGame = { ...moonGame, draw: drawNinjaFrame };
/** The art game for a stamp. */
export function ninjaArtGameFor(rev: number | null | undefined) {
  return (rev ?? 0) >= MOON_REV ? moonArtGame : ninjaArtGame;
}

/** The metres to px factor, for the reveal. */
export const NINJA_M = NINJA_PX_PER_M;
