/**
 * Ricochet's ninja wall-climb art (ricoRev 2; display only, never imported by the sim or server): night over two
 * temple walls of dark stone, a moon and a distant pagoda behind, the ninja (a clean black silhouette with a red
 * headband and sash), katanas in the walls (a gold guard and a steel blade that glints), spinning shurikens, moss and
 * ice patches, coins, gold lanterns and scrolls. Moon Climb (ricoRev 3) draws a larger moon and the pagoda under it,
 * the mid-ledges (slim hanging stone pieces), the sky lanterns (paper, glowing orange; the ninja hangs from one it
 * rides) and the Height and Flow pills, and no coins or gold lanterns. Every object is drawn inside its sim bounds (within 2 px: the
 * arcade bounds rule). The sky is painted once per canvas size (deviceLayer); only the walls, the objects in view and
 * the HUD are drawn each frame. The stage-2 look pass (15 Nov 2026, docs/arcade-standard/ricochet.md): a deeper night,
 * drifting wisps, far lanterns, a larger cratered moon, the walls' raking moonlight and cast shadows, lanterns lighting
 * the stone near them; ricoRev 4's bigger ninja drawn at ninjaArtScale(rev).
 */
import { ACTION_CHIP_H, ACTION_HUD_EDGE, ACTION_HUD_TOP, ACTION_ROW_STEP, actionChipWidth, drawActionHud, type ActionHudRow } from "./actionHud.renderer";
import { artCanvas, artContext, deviceLayer } from "./cache.renderer";
import { drawHero, heroPose, type HeroPose } from "./hero.renderer";
import { artHash, reducedMotion } from "./art.renderer";
import { arcadeReducedEffects } from "../fx/lowEnd";
import { arcadeFx, ARCADE_FX_DISPLAY_FONT, type ArcadeFxSpec } from "./arcadeFx.renderer";
import type { CanvasSize } from "./engine";
import {
  KATANA_HALF,
  KATANA_LEN,
  lanternAt,
  LANTERN_R,
  MODE_FLIGHT,
  MODE_STUN,
  MOON_FLOW_SLIDE,
  MOON_RIDE,
  NINJA_FALL_TICKS,
  NINJA_KNOCK,
  NINJA_STUN,
  ninjaSurface,
  NINJA_CORE_FULL_M,
  NINJA_HANG,
  NINJA_PX_PER_M,
  NINJA_HH,
  NINJA_HW,
  NINJA_WALL_L,
  NINJA_WALL_R,
  NINJA_WORLD_H,
  NINJA_WORLD_W,
  ninjaGame,
  moonGame,
  moonBigGame,
  moonRideHang,
  ninjaBodyFor,
  isMoonState,
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
  MOON_LEDGE_HW,
  MOON_REV,
  MOON_SCROLLS,
  MOON_SKY_R,
  moonSkyAt,
  moonFullM,
  moonGameFor,
  moonKnockPx,
  moonSkyCount,
  type MoonLevel,
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
export function moonNight(state: Pick<NinjaState, "best"> & { rev?: number; lvl?: MoonLevel }): number {
  // (A level's own full height: the night reaches its deepest there.)
  const p = Math.max(0, Math.min(1, ninjaClimbedPx(state) / (moonFullM(state) * NINJA_PX_PER_M)));
  return p * p * (3 - 2 * p);
}
/** The moon's centre and radius for a night's progress (world px): large and low over the ridge, rising and a little smaller. */
export function moonPlace(p: number): { x: number; y: number; r: number } {
  return { x: NINJA_WORLD_W / 2, y: Math.round(610 - 440 * p), r: Math.round(84 - 18 * p) };
}

/*
 * The stage-2 look pass (15 Nov 2026; concept ricochet-A, docs/design/pages-review/action/GALLERY.md): a deeper,
 * layered night. The sky (painted once per size): an indigo-to-blue gradient in five stops, a faint band of star dust
 * across it and 170 stars of every kind (dim pinpoints, small cool and warm stars, a few bright ones with a four-point
 * glint). Each frame: the night's deepening as the climb goes on, the stars that come out with it (some twinkling),
 * the moon (a cratered disc, warm and large low down, paler as it rises), the cloud wisps drifting across with their
 * moon-facing edges lit, the mist band the moon lights where it sits, and far paper lanterns rising through the sky
 * (display only, never touched), one at a time crossing the moon. Then the ridges, the pagoda and the valley mist
 * (painted once per size), over the moon so it rises from behind them.
 */
const SKY_STOPS: [number, string][] = [[0, "#03050F"], [0.28, "#081029"], [0.56, "#122253"], [0.82, "#1D3471"], [1, "#2A4584"]];

function paintMoonSky(ctx: CanvasRenderingContext2D): void {
  const W = NINJA_WORLD_W;
  const H = NINJA_WORLD_H;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (const [o, c] of SKY_STOPS) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // A faint band of star dust running down the sky at a slant, its own fine stars in it.
  ctx.save();
  ctx.translate(W * 0.5, H * 0.34);
  ctx.rotate(-0.42);
  const band = ctx.createLinearGradient(0, -46, 0, 46);
  band.addColorStop(0, "rgba(150,170,235,0)");
  band.addColorStop(0.5, "rgba(150,170,235,0.075)");
  band.addColorStop(1, "rgba(150,170,235,0)");
  ctx.fillStyle = band;
  ctx.fillRect(-W, -46, 2 * W, 92);
  // The polish plan's C3.4 (Joe, 20 Nov 2026): a calmer sky, fewer stars (were 140 + 170 painted and 46 a frame).
  for (let i = 0; i < 60; i++) {
    const h = artHash(i, 77);
    ctx.fillStyle = `rgba(220,230,255,${(0.12 + ((h >>> 20) % 5) * 0.05).toFixed(2)})`;
    const along = (h % (2 * W)) - W;
    const across = (((h >>> 11) % 61) - 30) * (0.4 + ((h >>> 26) % 4) * 0.2);
    ctx.fillRect(along, across, 1, 1);
  }
  ctx.restore();
  // Stars: dim pinpoints, small cool and warm ones, a few bright with a soft core.
  for (let i = 0; i < 70; i++) {
    const h = artHash(i, 43);
    const x = h % W;
    const y = (h >>> 12) % Math.round(H * 0.78);
    const kind = (h >>> 24) % 16;
    const fade = 1 - (0.55 * y) / H;
    const tone = (h >>> 5) % 3 === 0 ? "255,236,205" : (h >>> 5) % 3 === 1 ? "205,222,255" : "238,242,255";
    if (kind < 9) {
      ctx.fillStyle = `rgba(${tone},${(0.22 + ((h >>> 9) % 4) * 0.08) * fade})`;
      ctx.fillRect(x, y, 1, 1);
    } else if (kind < 14) {
      ctx.fillStyle = `rgba(${tone},${0.55 * fade})`;
      ctx.fillRect(x - 0.5, y - 0.5, 1.6, 1.6);
    } else drawStar(ctx, x, y, 1.1 + ((h >>> 3) % 3) * 0.35, 0.85 * fade, tone);
  }
}

/** A bright star: a small soft core and a thin four-point glint (crisp, no halo wash). */
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, a: number, tone: string): void {
  const core = ctx.createRadialGradient(x, y, 0, x, y, 2.4 * s);
  core.addColorStop(0, `rgba(255,255,255,${a})`);
  core.addColorStop(0.35, `rgba(${tone},${0.55 * a})`);
  core.addColorStop(1, `rgba(${tone},0)`);
  ctx.fillStyle = core;
  ctx.fillRect(x - 2.4 * s, y - 2.4 * s, 4.8 * s, 4.8 * s);
  ctx.fillStyle = `rgba(${tone},${0.6 * a})`;
  ctx.fillRect(x - 4.5 * s, y - 0.3, 9 * s, 0.6);
  ctx.fillRect(x - 0.3, y - 4.5 * s, 0.6, 9 * s);
}

/** The far ridges, the pagoda and the mist (transparent elsewhere): drawn over the moon. */
function paintMoonRidge(ctx: CanvasRenderingContext2D): void {
  const W = NINJA_WORLD_W;
  const H = NINJA_WORLD_H;
  const band = (y: number, h: number, a: number) => {
    const g = ctx.createLinearGradient(0, y - h, 0, y + h);
    g.addColorStop(0, "rgba(150,170,230,0)");
    g.addColorStop(0.5, `rgba(150,170,230,${a})`);
    g.addColorStop(1, "rgba(150,170,230,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - h, W, 2 * h);
  };
  const ridge = (base: number, amp: number, f1: number, f2: number, top: string, bottom: string, rim: string) => {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) ctx.lineTo(x, base + amp * Math.sin(x / f1 + 1.3) + amp * 0.42 * Math.sin(x / f2));
      ctx.lineTo(W, H);
      ctx.closePath();
    };
    const g = ctx.createLinearGradient(0, base - amp, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    path();
    ctx.fill();
    // Moonlight along the crest: a thin lit line, the ridge's own shape.
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const y = base + amp * Math.sin(x / f1 + 1.3) + amp * 0.42 * Math.sin(x / f2);
      if (x === 0) ctx.moveTo(x, y + 0.5);
      else ctx.lineTo(x, y + 0.5);
    }
    ctx.stroke();
  };
  // The farthest range in haze, a small far pagoda on it, mist; the middle range; mist; the near ridge, the temple's
  // pagoda, and the valley mist rising.
  ridge(H * 0.765, 13, 31, 9, "#2C407C", "#22346A", "rgba(190,205,250,0.24)");
  ctx.save();
  ctx.globalAlpha = 0.5;
  drawPagoda(ctx, W * 0.24, Math.round(H * 0.775), 0.5);
  ctx.restore();
  band(H * 0.8, 18, 0.2);
  ridge(H * 0.84, 15, 37, 11, "#1D2D61", "#15224D", "rgba(175,192,245,0.2)");
  ctx.save();
  ctx.globalAlpha = 0.72;
  drawPagoda(ctx, W * 0.8, Math.round(H * 0.85), 0.62);
  ctx.restore();
  band(H * 0.865, 13, 0.18);
  ridge(H * 0.895, 10, 41, 12, "#121C42", "#0C1430", "rgba(160,178,235,0.18)");
  drawPagoda(ctx, W / 2, Math.round(H * 0.9), 1.25);
  const mist = ctx.createLinearGradient(0, H * 0.82, 0, H);
  mist.addColorStop(0, "rgba(140,158,220,0)");
  mist.addColorStop(0.6, "rgba(140,158,220,0.14)");
  mist.addColorStop(1, "rgba(140,158,220,0.26)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, H * 0.82, W, H * 0.18);
}

/* ---- The moon: a cratered disc (cached per radius and warmth step where a canvas can be made) ---- */
const MOON_CRATERS: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  for (let i = 0; i < 28; i++) {
    const h = artHash(i, 211);
    const a = ((h % 3600) / 3600) * Math.PI * 2;
    const d = Math.sqrt(((h >>> 12) % 1000) / 1000) * 0.84;
    const r = i < 4 ? 0.085 + ((h >>> 22) % 5) * 0.012 : i < 12 ? 0.04 + ((h >>> 22) % 5) * 0.006 : 0.014 + ((h >>> 22) % 6) * 0.003;
    out.push([Math.cos(a) * d, Math.sin(a) * d, r]);
  }
  return out;
})();
/** Paints the moon's disc at (x, y), radius r; `warm` 1 low and amber, 0 high and pale. */
function paintMoonDisc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, warm: number): void {
  const mix = (a: number, b: number) => Math.round(a + (b - a) * warm);
  // The face: lit from the upper left, darkening to the limb (the sphere's own shading, never a flat disc).
  const face = ctx.createRadialGradient(x - r * 0.3, y - r * 0.32, r * 0.08, x, y, r);
  face.addColorStop(0, `rgb(${mix(255, 255)},${mix(249, 238)},${mix(226, 196)})`);
  face.addColorStop(0.62, `rgb(${mix(242, 248)},${mix(230, 210)},${mix(196, 150)})`);
  face.addColorStop(1, `rgb(${mix(208, 218)},${mix(192, 162)},${mix(160, 104)})`);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  // Maria: broad soft darker seas.
  const sea = `rgba(${mix(150, 160)},${mix(136, 116)},${mix(118, 78)},`;
  for (const [mx, my, rx, ry, a] of [[-0.25, -0.18, 0.4, 0.28, 0.34], [0.24, 0.1, 0.32, 0.24, 0.3], [-0.05, 0.4, 0.24, 0.15, 0.26], [0.36, -0.38, 0.18, 0.13, 0.22], [-0.5, 0.22, 0.15, 0.22, 0.2], [0.05, -0.05, 0.16, 0.12, 0.18]] as const) {
    const g = ctx.createRadialGradient(x + mx * r, y + my * r, 0, x + mx * r, y + my * r, Math.max(rx, ry) * r);
    g.addColorStop(0, `${sea}${a})`);
    g.addColorStop(1, `${sea}0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x + mx * r, y + my * r, rx * r, ry * r, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Craters: a shadowed floor on the side towards the light, a lit rim on the far side, a central peak on the big ones.
  for (const [cx0, cy0, cr0] of MOON_CRATERS) {
    const cx = x + cx0 * r;
    const cy = y + cy0 * r;
    const cr = cr0 * r;
    if (cr < 0.7) continue;
    // The floor: shadowed towards the upper left (the wall facing away from the light), lighter across.
    const floor = ctx.createRadialGradient(cx + cr * 0.3, cy + cr * 0.3, 0, cx, cy, cr);
    floor.addColorStop(0, `${sea}0.12)`);
    floor.addColorStop(1, `rgba(${mix(96, 112)},${mix(86, 72)},${mix(76, 46)},0.42)`);
    ctx.fillStyle = floor;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,251,236,0.55)";
    ctx.lineWidth = Math.max(0.5, cr * 0.16);
    ctx.beginPath();
    ctx.arc(cx, cy, cr, Math.PI * 0.02, Math.PI * 0.8);
    ctx.stroke();
    if (cr > 6) {
      ctx.fillStyle = "rgba(255,250,232,0.45)";
      ctx.beginPath();
      ctx.arc(cx + cr * 0.12, cy + cr * 0.12, cr * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Fine grain across the face.
  for (let i = 0; i < 160; i++) {
    const h = artHash(i, 233);
    const a = ((h % 3600) / 3600) * Math.PI * 2;
    const d = Math.sqrt(((h >>> 12) % 1000) / 1000) * r;
    ctx.fillStyle = (h >>> 23) % 3 === 0 ? "rgba(255,255,245,0.22)" : `${sea}0.22)`;
    ctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1, 1);
  }
  // The limb: a soft darkening to the edge on the shadowed side.
  const limb = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.7, x - r * 0.1, y - r * 0.1, r * 1.15);
  limb.addColorStop(0, "rgba(40,30,20,0)");
  limb.addColorStop(1, `rgba(${mix(40, 90)},${mix(44, 40)},${mix(60, 20)},0.35)`);
  ctx.fillStyle = limb;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
}
const moonSprites = new Map<string, CanvasImageSource>();
function drawMoonDisc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, warm: number): void {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const k = t ? Math.max(1, Math.min(4, Math.hypot(t.a, t.b))) : 1;
  const step = Math.round(warm * 8);
  const key = `${r}|${step}|${k.toFixed(2)}`;
  let sprite = moonSprites.get(key) ?? null;
  if (!sprite) {
    const size = Math.ceil((2 * r + 4) * k);
    const surface = artCanvas(size, size);
    const c = surface ? (artContext(surface) as CanvasRenderingContext2D | null) : null;
    if (surface && c) {
      c.scale(k, k);
      paintMoonDisc(c, r + 2, r + 2, r, step / 8);
      if (moonSprites.size > 12) moonSprites.clear();
      moonSprites.set(key, surface as CanvasImageSource);
      sprite = surface as CanvasImageSource;
    }
  }
  if (sprite) ctx.drawImage(sprite, x - r - 2, y - r - 2, 2 * r + 4, 2 * r + 4);
  else paintMoonDisc(ctx, x, y, r, step / 8);
}

/* ---- Clouds: soft wisps drifting across, their edge towards the moon lit ---- */
interface Wisp {
  y: number;
  w: number;
  h: number;
  speed: number;
  phase: number;
}
const WISPS: Wisp[] = Array.from({ length: 7 }, (_, i) => {
  const h = artHash(i, 97);
  return { y: 70 + i * 82 + ((h >>> 3) % 40), w: 110 + ((h >>> 9) % 90), h: 9 + ((h >>> 17) % 8), speed: 0.05 + ((h >>> 21) % 5) * 0.02, phase: h % 600 };
});
/** One wisp at (x, y): a few overlapping soft lobes, its lower edge lit by `lit` (0 … 1). */
function drawWisp(ctx: CanvasRenderingContext2D, x: number, y: number, wsp: Wisp, lit: number, seed: number): void {
  for (let j = 0; j < 4; j++) {
    const h = artHash(seed, j + 5);
    const lx = x + ((j - 1.5) * wsp.w) / 4.2 + ((h % 11) - 5);
    const ly = y + ((h >>> 8) % 5) - 2;
    const rx = wsp.w * (0.28 + ((h >>> 12) % 10) * 0.012);
    const ry = wsp.h * (0.8 + ((h >>> 16) % 6) * 0.06);
    const g = ctx.createRadialGradient(lx, ly + ry * 0.35, 0, lx, ly, rx);
    g.addColorStop(0, `rgba(${Math.round(120 + 100 * lit)},${Math.round(132 + 88 * lit)},${Math.round(180 + 55 * lit)},${(0.2 + 0.2 * lit).toFixed(3)})`);
    g.addColorStop(1, "rgba(90,105,160,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(lx, ly, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The night's deepening, its stars, the moon, the drifting wisps and the moonlit mist (each frame). */
function drawMoonNight(ctx: CanvasRenderingContext2D, p: number, tick: number): void {
  const W = NINJA_WORLD_W;
  const H = NINJA_WORLD_H;
  const m = moonPlace(p);
  const warm = 1 - 0.75 * p;
  // Warm moonlight in the sky round the moon: a wide, faint lift of the sky's own blue (no ring, no glare).
  const lift = ctx.createRadialGradient(m.x, m.y, m.r * 0.9, m.x, m.y, m.r * 3.2);
  lift.addColorStop(0, `rgba(${Math.round(150 + 70 * warm)},${Math.round(160 + 30 * warm)},${Math.round(225 - 60 * warm)},0.2)`);
  lift.addColorStop(1, "rgba(120,140,220,0)");
  ctx.fillStyle = lift;
  ctx.fillRect(m.x - m.r * 3.2, m.y - m.r * 3.2, m.r * 6.4, m.r * 6.4);
  if (p > 0.01) {
    const d = ctx.createLinearGradient(0, 0, 0, H * 0.85);
    d.addColorStop(0, `rgba(1,2,10,${(0.6 * p).toFixed(3)})`);
    d.addColorStop(1, `rgba(1,2,10,${(0.28 * p).toFixed(3)})`);
    ctx.fillStyle = d;
    ctx.fillRect(0, 0, W, H);
    // More stars come out as the night deepens; the bright ones glint.
    for (let i = 0; i < 20; i++) {
      const h = artHash(i, 57);
      const tw = (h >>> 3) % 5 === 0 ? 0.55 + 0.45 * Math.sin((tick + (h % 97)) / 13) : 1;
      const a = Math.min(1, p * 1.4 * (0.45 + ((h >>> 9) % 6) * 0.1)) * tw;
      const x = NINJA_WALL_L + 4 + (h % (NINJA_WALL_R - NINJA_WALL_L - 8));
      const y = (h >>> 12) % Math.round(H * 0.62);
      if ((h >>> 26) % 6 === 0) drawStar(ctx, x, y, 1 + 0.3 * tw, a, (h >>> 5) % 2 ? "255,236,205" : "205,222,255");
      else {
        ctx.fillStyle = `rgba(242,244,255,${a.toFixed(3)})`;
        ctx.fillRect(x, y, 1.4, 1.4);
      }
    }
  }
  drawMoonDisc(ctx, m.x, m.y, m.r, warm);
  // Wisps drifting across; those near the moon are lit on their edge towards it.
  WISPS.forEach((wsp, i) => {
    const span = W + wsp.w * 2;
    const x = ((tick * wsp.speed + wsp.phase * 3) % span) - wsp.w;
    const y = wsp.y;
    const near = Math.max(0, 1 - Math.hypot(x - m.x, y - m.y) / (m.r * 3));
    drawWisp(ctx, x, y, wsp, near, i);
  });
  // The mist band the moon lights where it sits.
  const mist = ctx.createRadialGradient(m.x, m.y + m.r * 0.7, 0, m.x, m.y + m.r * 0.7, W * 0.62);
  mist.addColorStop(0, `rgba(${Math.round(200 + 40 * warm)},${Math.round(205 + 15 * warm)},${Math.round(240 - 50 * warm)},0.13)`);
  mist.addColorStop(1, "rgba(160,175,230,0)");
  ctx.save();
  ctx.translate(0, m.y + m.r * 0.7);
  ctx.scale(1, 0.16);
  ctx.translate(0, -(m.y + m.r * 0.7));
  ctx.fillStyle = mist;
  ctx.fillRect(0, m.y + m.r * 0.7 - W * 0.62, W, W * 1.24);
  ctx.restore();
  // The polish plan's C3.4: no decorative far lanterns in the sky any more (the six real sky lanterns, the pickups,
  // are drawn by drawSkyLantern).
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
    if (i < 4) {
      // A lit window: paper glowing warm, a darker frame bar (the stage-2 look pass: brighter, two panes low down).
      ctx.fillStyle = "rgba(255,196,104,0.85)";
      ctx.fillRect(x - 2 * s, y - h * 0.72, 3.4 * s, 6 * s);
      if (i < 2) {
        ctx.fillRect(x - 9 * s, y - h * 0.72, 3.4 * s, 6 * s);
        ctx.fillRect(x + 5.6 * s, y - h * 0.72, 3.4 * s, 6 * s);
      }
      ctx.fillStyle = "#0E1226";
      ctx.fillRect(x - 0.3 * (s + 1), y - h * 0.72, Math.max(0.5, 0.6 * s), 6 * s);
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
 * The stage-2 look pass (15 Nov 2026): each block stands proud of a lighter mortar bed and casts a short shadow on it,
 * down and away from the gap (the moon is over the shaft), its face rounded by a light falling across it towards the
 * gap, a brighter lit top and gap-side edge; the moon's raking light is laid over it each frame (wallRake).
 */
const SLATE_BED = "#1C2032";
const SLATE_TONES = ["#434C64", "#3B4359", "#4B5570", "#363E52", "#454E67", "#3F475E"] as const;
/** Paints courses r0 … r0 + n − 1 of one wall between x0 and x1; `rowAt(r)` is course r's top edge (y grows down). */
export function paintSlate(c: CanvasRenderingContext2D, wall: number, x0: number, x1: number, rowAt: (r: number) => number, r0: number, n: number): void {
  c.fillStyle = SLATE_BED;
  c.fillRect(x0, rowAt(r0 + n - 1), x1 - x0, n * ROW);
  const inner = wall === 0 ? 1 : -1;
  // Each block's cast shadow on the bed: down and away from the gap (painted under every block first).
  c.fillStyle = "rgba(2,3,9,0.62)";
  for (let k = 0; k < n; k++) {
    const r = r0 + k;
    const m = ((r % SLATE_ROWS) + SLATE_ROWS) % SLATE_ROWS;
    const off = m % 2 === 0 ? 0 : 22;
    const start = wall === 0 ? x0 - off : x0 - off - 4;
    for (let bx = start; bx < x1; bx += 44) {
      const a = Math.max(x0, bx + 1 - inner * 2);
      const b = Math.min(x1, bx + 43 - inner * 2);
      if (b > a) c.fillRect(a, rowAt(r) + 3, b - a, ROW - 2);
    }
  }
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
      // The face rounded: darker on the far side, catching the light towards the gap.
      const across = c.createLinearGradient(inner === 1 ? a : b, 0, inner === 1 ? b : a, 0);
      across.addColorStop(0, "rgba(0,0,8,0.2)");
      across.addColorStop(0.55, "rgba(0,0,8,0)");
      across.addColorStop(1, "rgba(205,218,255,0.1)");
      c.fillStyle = across;
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
      c.fillStyle = "rgba(214,226,255,0.46)";
      c.fillRect(a, top, b - a, 1.5);
      c.fillStyle = "rgba(214,226,255,0.14)";
      c.fillRect(a, top + 1.5, b - a, 1);
      c.fillStyle = "rgba(205,218,255,0.28)";
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

/**
 * The moon's raking light across a wall (the stage-2 look pass; display only): strongest on the face towards the gap
 * and at the moon's own height, falling off along the wall and into the stone, warmer while the moon is low. Laid in
 * bands of 8 px, faded out over the world's bottom 120 px (the play screen's fill below carries no rake: no seam).
 */
export function wallRake(ctx: CanvasRenderingContext2D, wall: number, moonY: number, warm: number): void {
  const x0 = wall === 0 ? 0 : NINJA_WALL_R;
  const x1 = wall === 0 ? NINJA_WALL_L : NINJA_WORLD_W;
  const H = NINJA_WORLD_H;
  const tone = `${Math.round(200 + 50 * warm)},${Math.round(212 + 8 * warm)},${Math.round(255 - 75 * warm)}`;
  const g = ctx.createLinearGradient(wall === 0 ? x1 : x0, 0, wall === 0 ? x0 : x1, 0);
  g.addColorStop(0, `rgba(${tone},1)`);
  g.addColorStop(0.45, `rgba(${tone},0.35)`);
  g.addColorStop(1, `rgba(${tone},0)`);
  ctx.save();
  ctx.fillStyle = g;
  for (let y = 0; y < H; y += 8) {
    const mid = y + 4;
    const near = Math.max(0, 1 - Math.abs(mid - moonY) / 330);
    const foot = Math.max(0, Math.min(1, (H - 40 - mid) / 80));
    const a = 0.2 * near * near * foot;
    if (a < 0.004) continue;
    ctx.globalAlpha = a;
    ctx.fillRect(x0, y, x1 - x0, 8);
  }
  ctx.restore();
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

function drawFloor(ctx: CanvasRenderingContext2D, cam: number, rev: number): void {
  const body = ninjaBodyFor(rev);
  const sy = ninjaScreenY(cam, (body.start >> 8) - body.hh);
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
export function drawPatch(ctx: CanvasRenderingContext2D, wall: number, kind: number, top: number, bottom: number, tick: number, moonY: number | null = null): void {
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
    if (moonY !== null) moonCatch(ctx, face, wall, top, bottom, moonY, "210,255,190");
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
    if (moonY !== null) moonCatch(ctx, face, wall, top, bottom, moonY, "235,248,255");
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

/**
 * Moss and ice catching the moon (the stage-2 look pass, display only): a wet or glassy sheen along the lip at the
 * moon's height, brightest level with it and fading along the patch, a crisp line, never a glow past the patch.
 */
function moonCatch(ctx: CanvasRenderingContext2D, face: number, wall: number, top: number, bottom: number, moonY: number, tone: string): void {
  const near = Math.max(0, 1 - Math.abs((top + bottom) / 2 - moonY) / 360);
  if (near <= 0.02) return;
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  const mid = Math.max(0, Math.min(1, (moonY - top) / Math.max(1, bottom - top)));
  g.addColorStop(0, `rgba(${tone},${(0.25 * near).toFixed(3)})`);
  g.addColorStop(mid, `rgba(${tone},${(0.85 * near).toFixed(3)})`);
  g.addColorStop(1, `rgba(${tone},${(0.25 * near).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(wall === 0 ? face - 3.4 : face + 2.2, top + 2, 1.2, Math.max(0, bottom - top - 4));
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
 * A mid-ledge (Moon Climb): a slim hanging pillar of the walls' own carved slate, MOON_LEDGE_HW × 2 px wide from `top`
 * to `bottom` (screen y), in short blocks (each lit along its top and on its left, the moon's side of the shaft, shaded
 * underneath and on its right), an iron band with a bright edge at each end and a twisted rope up from its top. Drawn
 * inside its sim box (the stage-2 look pass, 15 Nov 2026: the same slate as the walls).
 */
export function drawLedge(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number): void {
  const w = MOON_LEDGE_HW * 2;
  const l = x - MOON_LEDGE_HW;
  // The rope: two strands twisted, lit on one side.
  for (let k = 0; k < 6; k++) {
    const y0 = top - 24 + k * 4;
    ctx.fillStyle = k % 2 ? "#6E5A3C" : "#9C8460";
    ctx.fillRect(x - 1.4, y0, 2.8, 4);
    ctx.fillStyle = "rgba(255,235,190,0.45)";
    ctx.fillRect(x - 1.4 + (k % 2), y0 + 0.5, 1, 2.5);
  }
  ctx.fillStyle = SLATE_BED;
  ctx.fillRect(l, top, w, bottom - top);
  const bh = 20;
  for (let y = top + 4, i = 0; y < bottom - 4; y += bh, i++) {
    const yb = Math.min(bottom - 4, y + bh);
    const h = artHash(Math.round(x), i + Math.round(top));
    const g = ctx.createLinearGradient(0, y + 1, 0, yb - 1);
    g.addColorStop(0, SLATE_TONES[h % SLATE_TONES.length]!);
    g.addColorStop(1, "#2A3043");
    ctx.fillStyle = g;
    ctx.fillRect(l + 1, y + 1, w - 2, yb - y - 2);
    const across = ctx.createLinearGradient(l, 0, l + w, 0);
    across.addColorStop(0, "rgba(205,218,255,0.16)");
    across.addColorStop(1, "rgba(0,0,8,0.32)");
    ctx.fillStyle = across;
    ctx.fillRect(l + 1, y + 1, w - 2, yb - y - 2);
    ctx.fillStyle = "rgba(214,226,255,0.48)";
    ctx.fillRect(l + 1, y + 1, w - 2, 1.4);
    ctx.fillRect(l + 1, y + 1, 1.2, yb - y - 2);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(l + 1, yb - 3, w - 2, 2);
    ctx.fillStyle = "rgba(5,7,14,0.3)";
    ctx.fillRect(l + 4 + (h % 8), y + 5 + ((h >>> 5) % 9), 3, 1);
  }
  // Iron bands at each end, lit along the top.
  for (const y of [top, bottom - 4]) {
    const g = ctx.createLinearGradient(0, y, 0, y + 4);
    g.addColorStop(0, "#8A93A8");
    g.addColorStop(0.4, "#4A5266");
    g.addColorStop(1, "#1C2130");
    ctx.fillStyle = g;
    ctx.fillRect(l, y, w, 4);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(l + 1, y, w - 2, 0.8);
  }
}

/**
 * The sky lanterns' warm light falling on the walls and ledges near them (the stage-2 look pass, display only): a soft
 * pool round each lantern, added to the stone only (clipped to the walls and the ledges in view), so a lantern lights
 * what is near it and is never ringed by a glow of its own.
 */
function drawLanternLight(ctx: CanvasRenderingContext2D, lights: { x: number; y: number }[], moon: MoonState, cam: number, lo: number, hi: number, tick: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, NINJA_WALL_L, NINJA_WORLD_H);
  ctx.rect(NINJA_WALL_R, 0, NINJA_WORLD_W - NINJA_WALL_R, NINJA_WORLD_H);
  for (const l of moon.tower.ledges) {
    if (l.hi < lo || l.lo > hi) continue;
    const top = ninjaScreenY(cam, l.hi);
    ctx.rect(l.x - MOON_LEDGE_HW, top, MOON_LEDGE_HW * 2, ninjaScreenY(cam, l.lo) - top);
  }
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  for (const [i, p] of lights.entries()) {
    const f = 0.9 + 0.1 * Math.sin(tick / 6 + i * 2.1);
    const g = ctx.createRadialGradient(p.x, p.y + 4, 0, p.x, p.y + 4, LANTERN_LIGHT_R);
    g.addColorStop(0, `rgba(255,178,92,${(0.6 * f).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(255,150,64,${(0.26 * f).toFixed(3)})`);
    g.addColorStop(1, "rgba(255,140,50,0)");
    ctx.fillStyle = g;
    ctx.fillRect(p.x - LANTERN_LIGHT_R, p.y + 4 - LANTERN_LIGHT_R, 2 * LANTERN_LIGHT_R, 2 * LANTERN_LIGHT_R);
  }
  ctx.restore();
}
/** How far (px) a sky lantern's light reaches across the stone. */
export const LANTERN_LIGHT_R = 210;

/**
 * A sky lantern (Moon Climb): a paper lantern glowing orange, its body inside the touch radius (MOON_SKY_R round its
 * centre), a dark cap and base and a short tassel; the glow round it is light only.
 */
export function drawSkyLantern(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number, ridden = false, sway = 0, flare = 0): void {
  if (sway !== 0) {
    // Swaying about its base, where the ninja's hands hold it (the stage-2 effects: a grabbed lantern swings).
    ctx.save();
    ctx.translate(x, y + MOON_SKY_R - 2.5);
    ctx.rotate(sway);
    ctx.translate(-x, -(y + MOON_SKY_R - 2.5));
    drawSkyLantern(ctx, x, y, tick, ridden, 0, flare);
    ctx.restore();
    return;
  }
  // Translucent paper lit from within (the stage-2 look pass; no glow round it: its light falls on the walls instead,
  // drawLanternLight): a sky lantern's body, wider at the shoulder, its flame low in the open base. The paper glows
  // brightest round the flame and deepens to orange-red at the curved edge; bamboo ribs show dark against the light
  // with the paper beside each a touch brighter; a crisp sheen down the curve; a lacquered rim at the top and the base
  // ring round the flame. Everything inside MOON_SKY_R of the centre.
  const r = MOON_SKY_R;
  const flick = Math.sin(tick / 6 + x) * 0.6;
  const top = y - r + 1.5;
  const base = y + r - 2.5;
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(x - 7.5, top);
    ctx.bezierCurveTo(x - 12.5, top + 4, x - 12, base - 6, x - 7, base);
    ctx.lineTo(x + 7, base);
    ctx.bezierCurveTo(x + 12, base - 6, x + 12.5, top + 4, x + 7.5, top);
    ctx.closePath();
  };
  const lit = ctx.createRadialGradient(x, base - 2 + flick, 1, x, y - 2, r + 2);
  lit.addColorStop(0, ridden ? "#FFF6DA" : "#FFF0C8");
  lit.addColorStop(0.32, "#FFCB72");
  lit.addColorStop(0.7, "#F58A33");
  lit.addColorStop(1, "#C24E1C");
  ctx.fillStyle = lit;
  body();
  ctx.fill();
  ctx.save();
  body();
  ctx.clip();
  // The ribs: four bamboo ribs curving with the body, dark against the light, the paper beside each a little brighter.
  for (const k of [-0.62, -0.22, 0.22, 0.62]) {
    ctx.strokeStyle = "rgba(255,236,190,0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + k * 7.5 + 0.9, top);
    ctx.quadraticCurveTo(x + k * 13.5 + 0.9, y, x + k * 7 + 0.9, base);
    ctx.stroke();
    ctx.strokeStyle = "rgba(105,36,8,0.6)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x + k * 7.5, top);
    ctx.quadraticCurveTo(x + k * 13.5, y, x + k * 7, base);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(120,44,10,0.32)";
  ctx.lineWidth = 0.7;
  for (const yy of [y - 4, y + 4]) {
    ctx.beginPath();
    ctx.moveTo(x - 13, yy);
    ctx.quadraticCurveTo(x, yy + 1.6, x + 13, yy);
    ctx.stroke();
  }
  // Brightening as it is grabbed: the paper itself lit whiter (inside its body only, never a halo).
  if (flare > 0.01) {
    ctx.fillStyle = `rgba(255,246,214,${(0.5 * flare).toFixed(3)})`;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // The sheen down the left of the curve: a crisp highlight on the paper, never a halo.
  ctx.strokeStyle = "rgba(255,250,232,0.75)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x - 7, top + 2.5);
  ctx.bezierCurveTo(x - 10.5, top + 6, x - 10.5, base - 9, x - 7.5, base - 4);
  ctx.stroke();
  ctx.restore();
  // The lacquered top rim and the base ring, the flame seen through the opening.
  const rim = ctx.createLinearGradient(0, top - 1, 0, top + 2.5);
  rim.addColorStop(0, "#8A4A22");
  rim.addColorStop(1, "#2A140A");
  ctx.fillStyle = rim;
  ctx.fillRect(x - 7.5, top - 1, 15, 3);
  ctx.fillStyle = "rgba(255,215,170,0.8)";
  ctx.fillRect(x - 6.5, top - 1, 13, 0.7);
  ctx.fillStyle = "#3A1A0A";
  ctx.beginPath();
  ctx.ellipse(x, base, 7, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFF6D8";
  ctx.beginPath();
  ctx.ellipse(x, base - 1.2 + flick * 0.4, 1.6, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFB040";
  ctx.beginPath();
  ctx.ellipse(x, base - 0.2, 2.2, 1, 0, 0, Math.PI * 2);
  ctx.fill();
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
/**
 * The ninja's drawing scale for a stamp: 1 up to ricoRev 3 (its 26 × 52 body box), MOON_BIG_HW ÷ NINJA_HW on ricoRev 4
 * (the bigger ninja, 15 Nov 2026), the same figure grown to fill its 34 × 68 box (art-check holds each pose's extent to
 * main's figure × this scale); MOON_MID_HW ÷ NINJA_HW = 15 / 13 on ricoRev 5 (the 30 × 60 ninja, 22 Nov 2026).
 */
export function ninjaArtScale(rev: number | null | undefined): number {
  return ninjaBodyFor(rev).hw / NINJA_HW;
}
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
  // A soft moonlit backing behind the figure (inside its body box), so it reads on the night sky and the dark stone;
  // since the stage-2 look pass (15 Nov 2026) it fades out to its edge, with no rim (Joe: no glowing edges).
  ctx.save();
  ctx.scale(1, (NINJA_HH + 1) / (NINJA_HW + 1));
  const backing = ctx.createRadialGradient(0, 0, 0, 0, 0, NINJA_HW + 1);
  backing.addColorStop(0, "rgba(175,195,255,0.42)");
  backing.addColorStop(0.7, "rgba(175,195,255,0.3)");
  backing.addColorStop(1, "rgba(175,195,255,0)");
  ctx.fillStyle = backing;
  ctx.beginPath();
  ctx.arc(0, 0, NINJA_HW + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

/* ================================ Effects (stage 2) ================================ */
/*
 * Moon Climb's effects (the Action overhaul's stage 2, 15 Nov 2026; Joe's list; display only, no stamp). Each observes
 * the sim (its counters, ticks and modes) and draws in the world, never over the HUD's numbers but the two meant to:
 *  - a leap kicks dust off the wall (or ledge) it leaves: flecks of the surface's own colour, slate grit, moss or ice;
 *  - a double jump puffs a ring of air under the feet;
 *  - sliding on moss or ice scuffs a trail down the face, red from the point where the slide breaks the flow (the
 *    sim's MOON_FLOW_SLIDE) while a streak runs; a broken streak's trail flashes red as it fades (sounds ricochet.scuff,
 *    ricochet.flowBreak);
 *  - a grabbed lantern brightens and sways under the hands, settling over its ride (ricochet.lanternSway);
 *  - a scroll flies into the HUD's SCROLLS count, the chip flashing as it lands (ricochet.scrollTally);
 *  - a hit tumbles the ninja through the 3 m knock-down (ricochet.fallWhistle) and a short red "−3 m" shows beside the
 *    height.
 * Ages are in sim ticks (the same picture for the same state). Every physical action ends within 900 ms (54 ticks).
 * Reduced motion: no tumble or sway, rings and dust shown still for a moment; reduced effects: no dust.
 * Events are noticed by comparing each drawn state with the one drawn before on the same canvas (MoonFxMem), so a
 * replay or reveal drawing one frame shows none, and a jump back in time starts afresh.
 */
/** Ticks: dust, the air ring, a scroll's flight to the HUD, the red "−n m", a trail's fade once left. */
export const MOON_FX_DUST_TICKS = 30;
export const MOON_FX_RING_TICKS = 24;
export const MOON_FX_SCROLL_TICKS = 24;
export const MOON_FX_LOSS_TICKS = 60;
export const MOON_FX_TRAIL_FADE = 30;
/** The tumble's length: the sim's knock-down fall (NINJA_FALL_TICKS). */
export const MOON_FX_TUMBLE_TICKS = NINJA_FALL_TICKS;

interface MoonFxEvent {
  kind: "dust" | "ring" | "scroll" | "loss" | "trail";
  t: number;
  /** World x and height (px above the floor); for a trail its bottom and top heights. */
  x: number;
  y: number;
  y2?: number;
  /** dust: +1 kicked rightwards, −1 leftwards; trail: the red part's top height (or -1). */
  dir?: number;
  surf?: number;
  /** loss: metres lost; trail: 1 when the flow broke. */
  n?: number;
}
interface MoonFxMem {
  tick: number;
  seed: string;
  prev: MoonState;
  events: MoonFxEvent[];
}
const moonFxMems = new WeakMap<object, MoonFxMem>();

/** The flow-breaking part of the current slide: the heights (px) of its trail and where it turns red, or null. */
export function moonScuff(s: MoonState): { top: number; bottom: number; redFrom: number | null; surf: number } | null {
  if (s.mode !== 0 || s.ledge >= 0 || s.slid <= 0) return null;
  const y = s.y >> 8;
  const surf = ninjaSurface(s.tower.patches, s.wall, y);
  if (surf !== SURF_MOSS && surf !== SURF_ICE) return null;
  const top = (s.y + s.slid) >> 8;
  // From MOON_FLOW_SLIDE below the landing on, a take-off would break the streak (only while there is one).
  const redFrom = s.streak > 0 && s.slid >= MOON_FLOW_SLIDE ? top - (MOON_FLOW_SLIDE >> 8) : null;
  return { top, bottom: y, redFrom, surf };
}

/** Notices the events between the last state drawn on this canvas and this one. */
export function moonFxEvents(ctx: object, s: MoonState): MoonFxEvent[] {
  const key = `${s.tower.katanas.length}:${s.tower.sky[0]?.t0 ?? 0}:${s.rev}`;
  let mem = moonFxMems.get(ctx);
  if (!mem || mem.seed !== key || s.tick < mem.tick || s.tick > mem.tick + 30) {
    mem = { tick: s.tick, seed: key, prev: s, events: [] };
    moonFxMems.set(ctx, mem);
    return mem.events;
  }
  if (s.tick === mem.tick) return mem.events;
  const p = mem.prev;
  const b = ninjaBodyFor(s.rev);
  if (s.leaps > p.leaps && s.mode !== MODE_STUN) {
    // A take-off from a wall or a ledge (never from a lantern: the ride's leap-off has nothing to push from).
    if (p.mode === 0) {
      const onLedge = p.ledge >= 0;
      // The side of the surface pushed off (a ledge lies the way the ninja was heading when it clung there).
      const side = onLedge ? (p.toX > p.x ? 1 : -1) : p.x < NINJA_WORLD_W / 2 ? -1 : 1;
      const surf = onLedge ? 0 : ninjaSurface(p.tower.patches, p.wall, p.y >> 8);
      mem.events.push({ kind: "dust", t: s.tick, x: p.x + side * b.hw, y: (p.y >> 8) - b.hh + 6, dir: -side, surf });
    }
  }
  if (s.djs > p.djs) mem.events.push({ kind: "ring", t: s.tick, x: s.x, y: (s.y >> 8) - b.hh });
  if (s.scrolls > p.scrolls) mem.events.push({ kind: "scroll", t: s.tick, x: s.x, y: s.y >> 8 });
  if (s.hits > p.hits) {
    const lost = Math.max(1, Math.round((p.y - s.knockTo) / 256 / NINJA_PX_PER_M));
    mem.events.push({ kind: "loss", t: s.tick, x: 0, y: 0, n: Math.min(lost, Math.round((isMoon(s) ? moonKnockPx(s as MoonState) : NINJA_KNOCK) / NINJA_PX_PER_M)) });
  }
  // A slide's trail left behind (a take-off or a hit): kept to fade, red where it broke the flow.
  const was = moonScuff(p);
  if (was && !(s.mode === 0 && s.ledge < 0 && s.wall === p.wall && s.slid > 0)) {
    const broke = p.streak >= 1 && s.streak === 0 && s.hits === p.hits;
    mem.events.push({ kind: "trail", t: s.tick, x: p.wall === 0 ? NINJA_WALL_L : NINJA_WALL_R, y: was.bottom, y2: was.top, dir: was.redFrom ?? -1, surf: was.surf, n: broke ? 1 : 0 });
  }
  const keep = Math.max(MOON_FX_LOSS_TICKS, MOON_FX_DUST_TICKS, MOON_FX_TRAIL_FADE);
  mem.events = mem.events.filter((e) => s.tick - e.t <= keep);
  mem.tick = s.tick;
  mem.prev = s;
  return mem.events;
}

/** Scuff marks down a wall face from height `top` to `bottom` (px), red below `redFrom` when given. */
function drawScuffTrail(ctx: CanvasRenderingContext2D, cam: number, wall: number, top: number, bottom: number, redFrom: number | null, surf: number, alpha: number, tick: number): void {
  const face = wall === 0 ? NINJA_WALL_L : NINJA_WALL_R;
  const inward = wall === 0 ? 1 : -1;
  const y0 = ninjaScreenY(cam, top);
  const y1 = ninjaScreenY(cam, bottom);
  if (y1 - y0 < 1) return;
  const base = surf === SURF_ICE ? "235,248,255" : "198,236,150";
  // Three gouges in the patch beside the face (the hands and feet dragging down it), never behind the ninja's body.
  for (let k = 0; k < 3; k++) {
    const x = face - inward * (2 + k * 3.2);
    const split = redFrom === null ? y1 : Math.min(y1, Math.max(y0, ninjaScreenY(cam, redFrom)));
    ctx.fillStyle = `rgba(${base},${(alpha * (0.85 - k * 0.15)).toFixed(3)})`;
    ctx.fillRect(x - 1, y0 + (k * 3) % 5, 2, Math.max(0, split - y0 - ((k * 3) % 5)));
    if (redFrom !== null && split < y1) {
      ctx.fillStyle = `rgba(236,56,68,${(alpha * (0.95 - k * 0.15)).toFixed(3)})`;
      ctx.fillRect(x - 1.1, split, 2.2, y1 - split);
    }
  }
  // Flecks thrown off at the foot of a live slide.
  if (alpha >= 1 && !reducedMotion()) {
    ctx.fillStyle = `rgba(${base},0.8)`;
    for (let i = 0; i < 3; i++) {
      const h = artHash(tick + i, 71);
      ctx.fillRect(face + inward * (3 + (h % 6)), y1 + 2 + ((h >>> 5) % 6), 1.5, 1.5);
    }
  }
}

/** The effects drawn behind the ninja: the live scuff trail, the trails left fading, the dust and the air ring. */
function drawMoonFxUnder(ctx: CanvasRenderingContext2D, s: MoonState, events: readonly MoonFxEvent[], cam: number): void {
  const still = reducedMotion();
  const lite = arcadeReducedEffects();
  const live = moonScuff(s);
  const hh = ninjaBodyFor(s.rev).hh;
  // Two tracks, the hands' and the feet's, each from where it landed down to where it is now.
  const tracks = [Math.round(hh * 0.6), -hh + 6];
  if (live) for (const o of tracks) drawScuffTrail(ctx, cam, s.wall, live.top + o, live.bottom + o, live.redFrom === null ? null : live.redFrom + o, live.surf, 1, s.tick);
  for (const e of events) {
    const age = s.tick - e.t;
    if (e.kind === "trail" && age <= MOON_FX_TRAIL_FADE) {
      const f = 1 - age / MOON_FX_TRAIL_FADE;
      const wall = e.x === NINJA_WALL_L ? 0 : 1;
      // A broken streak's whole trail turns red as it fades.
      for (const o of tracks) drawScuffTrail(ctx, cam, wall, e.y2! + o, e.y + o, e.n ? e.y2! + o : e.dir! >= 0 ? e.dir! + o : null, e.surf ?? SURF_MOSS, f * 0.9, s.tick);
    } else if (e.kind === "dust" && age <= MOON_FX_DUST_TICKS && !lite) {
      const f = age / MOON_FX_DUST_TICKS;
      const sy = ninjaScreenY(cam, e.y);
      const tone = e.surf === SURF_MOSS ? "128,182,86" : e.surf === SURF_ICE ? "232,246,255" : "182,190,212";
      const t = still ? 5 : age;
      // A soft puff where the feet pushed off, spreading along the face and out into the gap.
      for (let i = 0; i < 3; i++) {
        const h = artHash(e.t * 7 + i, 61);
        const px = e.x + (e.dir ?? 1) * (3 + i * 4 + t * 0.35 * (1 + i * 0.3));
        const py = sy - 4 + i * 6 + ((h % 7) - 3) + t * 0.12;
        const r = 6 + i * 2 + t * 0.4;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(${tone},${(0.55 * (1 - f)).toFixed(3)})`);
        g.addColorStop(1, `rgba(${tone},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(px - r, py - r, 2 * r, 2 * r);
      }
      // Grit kicked off the face, falling as it flies.
      for (let i = 0; i < 14; i++) {
        const h = artHash(e.t * 13 + i, 59);
        const vx = (0.5 + (h % 100) / 55) * (e.dir ?? 1);
        const vy = -0.9 + ((h >>> 8) % 100) / 60;
        const x = e.x + vx * t * 1.5;
        const y = sy + vy * t + 0.05 * t * t + (((h >>> 16) % 24) - 12);
        ctx.fillStyle = `rgba(${tone},${(0.9 * (1 - f)).toFixed(3)})`;
        const r = 2 + ((h >>> 24) % 4) * 0.7;
        ctx.fillRect(x - r / 2, y - r / 2, r, r);
      }
    } else if (e.kind === "ring" && age <= MOON_FX_RING_TICKS) {
      const f = age / MOON_FX_RING_TICKS;
      const r = still ? 14 : 8 + 20 * Math.sqrt(f);
      const sy = ninjaScreenY(cam, e.y);
      ctx.strokeStyle = `rgba(225,235,255,${(0.7 * (1 - f)).toFixed(3)})`;
      ctx.lineWidth = 2 * (1 - f) + 0.6;
      ctx.beginPath();
      ctx.ellipse(e.x, sy + 2, r, r * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(225,235,255,${(0.35 * (1 - f)).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(e.x, sy + 6, r * 0.7, r * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** Where the HUD's SCROLLS chip sits (world px): the second row's right chip. */
export function moonScrollChipAt(ctx: CanvasRenderingContext2D, s: MoonState): { x: number; y: number } {
  const chip = moonHudRows(s)[1]!.right![0]!;
  const w = actionChipWidth(ctx, chip);
  return { x: NINJA_WORLD_W - ACTION_HUD_EDGE - w / 2, y: ACTION_HUD_TOP + ACTION_ROW_STEP + ACTION_CHIP_H / 2 };
}

/** The effects drawn over the HUD: a scroll flying into its count and the red "−n m" beside the height. */
function drawMoonFxOver(ctx: CanvasRenderingContext2D, s: MoonState, events: readonly MoonFxEvent[], cam: number): void {
  for (const e of events) {
    const age = s.tick - e.t;
    if (e.kind === "scroll" && age < MOON_FX_SCROLL_TICKS) {
      const to = moonScrollChipAt(ctx, s);
      const u = reducedMotion() ? 1 : age / MOON_FX_SCROLL_TICKS;
      const e2 = u * u * (3 - 2 * u);
      const fx = e.x + (to.x - e.x) * e2;
      const fy0 = ninjaScreenY(cam, e.y);
      const fy = fy0 + (to.y - fy0) * e2 - Math.sin(Math.PI * u) * 40;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.scale(2.2 - 1.2 * e2, 2.2 - 1.2 * e2);
      drawScrollIcon(ctx, 0, 0);
      ctx.restore();
    } else if (e.kind === "loss" && age < MOON_FX_LOSS_TICKS) {
      const chip = moonHudRows(s)[0]!.left[0]!;
      const x = ACTION_HUD_EDGE + actionChipWidth(ctx, chip) + 8;
      const a = age < 40 ? 1 : 1 - (age - 40) / 20;
      const rise = reducedMotion() ? 0 : Math.min(4, age * 0.3);
      ctx.save();
      ctx.font = `800 15px ${ARCADE_FX_DISPLAY_FONT}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillStyle = `rgba(6,8,18,${(0.7 * a).toFixed(3)})`;
      const text = `−${e.n ?? 3} m`;
      const w = ctx.measureText(text).width;
      ctx.beginPath();
      ctx.roundRect(x - 6, ACTION_HUD_TOP + 1 - rise, w + 12, ACTION_CHIP_H - 2, 8);
      ctx.fill();
      ctx.fillStyle = `rgba(255,92,100,${a.toFixed(3)})`;
      ctx.fillText(text, x, ACTION_HUD_TOP + ACTION_CHIP_H / 2 - rise);
      ctx.restore();
    }
  }
}

/** The ridden lantern's sway (radians) and brightening (0 … 1) this many ticks after the grab. */
export function moonLanternSway(age: number): { angle: number; flare: number } {
  if (reducedMotion()) return { angle: 0, flare: age < 18 ? 0.6 : 0 };
  return { angle: 0.2 * Math.exp(-age / 28) * Math.sin(age / 4.2), flare: Math.exp(-age / 14) };
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
  // The SCROLLS chip flashes as the scroll flying into it lands (stage 2's effects: MOON_FX_SCROLL_TICKS after the take).
  const landed = s.tick - s.pickTick - MOON_FX_SCROLL_TICKS;
  const scroll = landed >= 0 && landed < 30 ? 1 - landed / 30 : 0;
  return [
    {
      left: [{ label: "HEIGHT", value: `${m} m`, tone: m >= moonFullM(s) ? "gold" : "plain", pulse: { id: "ricochet", tick: s.tick } }],
      right: [{ label: "FLOW", value: `×${s.streak}`, tone: s.streak > 0 ? "gold" : "dim", flash: lit ? 1 - (s.tick - s.flowTick) / 30 : 0 }],
    },
    {
      left: [{ label: "RIDES", value: `${s.rides}/${moonSkyCount(s)}`, tone: s.rides >= moonSkyCount(s) ? "gold" : "plain", flash: grab, icon: (c, x, y) => drawSkyLanternIcon(c, x, y) }],
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
  if (isMoonState(s)) {
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
  const moon = isMoonState(s) ? (s as MoonState) : null;
  const night = moon ? moonNight(s) : 0;
  if (moon) {
    deviceLayer(ctx, "moon-sky-v3", paintMoonSky);
    drawMoonNight(ctx, night, t);
    deviceLayer(ctx, "moon-ridge-v3", paintMoonRidge);
  } else deviceLayer(ctx, "ninja-sky", paintSky);
  drawWall(ctx, 0, cam);
  drawWall(ctx, 1, cam);
  if (moon) {
    const mp = moonPlace(night);
    wallRake(ctx, 0, mp.y, 1 - night);
    wallRake(ctx, 1, mp.y, 1 - night);
  }
  drawFloor(ctx, cam, s.rev);
  const lo = cam - (H - EYE) - 40;
  const hi = cam + EYE + 40;
  const tower = s.tower;
  for (const p of tower.patches) {
    if (p.hi < lo) continue;
    if (p.lo > hi) break;
    drawPatch(ctx, p.wall, p.kind, ninjaScreenY(cam, p.hi), ninjaScreenY(cam, p.lo), t, moon ? moonPlace(night).y : null);
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
    // The sky lanterns' warm light on the walls and ledges near them (the light itself, never a glow round the lantern).
    const lights: { x: number; y: number }[] = [];
    moon.tower.sky.forEach((l, i) => {
      if (moon.gotSky[i]) return;
      const p = moonSkyAt(l, t);
      if (p && p.y >= lo - 120 && p.y <= hi + 120) lights.push({ x: p.x, y: ninjaScreenY(cam, p.y) });
    });
    if (moon.mode === MODE_RIDE) {
      const at = ninjaDrawPoint(s);
      lights.push({ x: at.x, y: at.y - moonRideHang(s.rev) });
    }
    if (lights.length) drawLanternLight(ctx, lights, moon, cam, lo, hi, t);
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
  // Stage 2's effects behind the ninja (scuffs, dust, the air ring), noticed against the last frame drawn here.
  const fxEvents = moon ? moonFxEvents(ctx, moon) : [];
  if (moon) drawMoonFxUnder(ctx, moon, fxEvents, cam);
  // The ninja: blinking while stunned or in its grace.
  const at = ninjaDrawPoint(s);
  const blink = s.safe > 0 && s.mode !== MODE_STUN && Math.trunc(t / 4) % 2 === 0;
  // On a mid-ledge the ninja faces away from it (its side is the wall it was heading for).
  const onLedge = moon !== null && moon.mode !== MODE_FLIGHT && moon.ledge >= 0;
  const face = s.mode === MODE_FLIGHT ? (s.wall === 1 ? 1 : -1) : onLedge ? (s.wall === 1 ? -1 : 1) : s.wall === 0 ? 1 : -1;
  // A hit on Moon Climb tumbles the ninja through the knock-down (one turn over the fall), then it hangs stunned.
  const fallAge = moon && s.mode === MODE_STUN ? NINJA_STUN - s.stun : MOON_FX_TUMBLE_TICKS;
  const tumbling = moon !== null && fallAge < MOON_FX_TUMBLE_TICKS && !reducedMotion();
  const pose = tumbling ? 2 : s.mode === MODE_STUN ? 3 : s.mode === MODE_RIDE ? 4 : s.mode === MODE_FLIGHT ? (s.dj && s.hang > 0 ? 2 : 1) : 0;
  const spin = tumbling ? (fallAge / MOON_FX_TUMBLE_TICKS) * Math.PI * 2 : s.dj ? ((NINJA_HANG - s.hang) / NINJA_HANG) * Math.PI * 2 : 0;
  // The ridden lantern above the ninja's hands, brightening and swaying as it is grabbed.
  const body = ninjaBodyFor(s.rev);
  if (moon && moon.mode === MODE_RIDE) {
    const sw = moonLanternSway(MOON_RIDE - moon.ride);
    drawSkyLantern(ctx, at.x, at.y - moonRideHang(s.rev), t, true, sw.angle, sw.flare);
  }
  if (blink) ctx.globalAlpha = 0.4;
  drawNinja(ctx, at.x, at.y, pose, face, t, spin, ninjaArtScale(s.rev));
  ctx.globalAlpha = 1;
  if (s.mode === MODE_STUN && !tumbling) {
    // Stars round the head.
    ctx.fillStyle = NINJA_GOLD;
    for (let i = 0; i < 3; i++) {
      const a = t / 6 + (i * Math.PI * 2) / 3;
      ctx.fillRect(at.x + Math.cos(a) * 11 - 1.5, at.y - body.hh - 2 + Math.sin(a) * 3 - 1.5, 3, 3);
    }
  }
  // A red wash on a hit.
  if (t - s.hitTick < 12) {
    ctx.fillStyle = `rgba(224,40,58,${0.22 * (1 - (t - s.hitTick) / 12)})`;
    ctx.fillRect(0, 0, W, H);
  }
  drawHud(ctx, s);
  if (moon) drawMoonFxOver(ctx, moon, fxEvents, cam);
}

const isMoon = (s: NinjaState): s is MoonState => isMoonState(s);

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
    { kind: "final", count: (s) => (ninjaMetres(s) >= (isMoon(s) ? moonFullM(s as MoonState) : NINJA_CORE_FULL_M) ? 1 : 0), label: () => "FULL HEIGHT!" },
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
/** Moon Climb's bigger ninja (ricoRev 4) with its art. */
export const moonBigArtGame = { ...moonBigGame, draw: drawNinjaFrame };
/** Each of the sim's Moon Climb games (moonGameFor: a stamp and a level) with its art; Normal's rev 3 and 4 the two above. */
const moonArtGames = new Map<object, typeof moonBigArtGame>([[moonGame, moonArtGame], [moonBigGame, moonBigArtGame]]);
/**
 * Moon Climb's art game for a stamp (rev 3, 4 or 5) and, on rev 4 and 5, the puzzle's stored level (absent: Normal):
 * the sim's own game for them (moonGameFor) with the art, so the stage plays exactly the game the server replays.
 */
export function moonArtGameFor(rev: number | null | undefined, level?: unknown) {
  const game = moonGameFor(rev, level);
  let g = moonArtGames.get(game);
  if (!g) moonArtGames.set(game, (g = { ...game, draw: drawNinjaFrame } as typeof moonBigArtGame));
  return g;
}
/** The art game for a stamp (and its stored level). */
export function ninjaArtGameFor(rev: number | null | undefined, level?: unknown) {
  return (rev ?? 0) >= MOON_REV ? moonArtGameFor(rev, level) : ninjaArtGame;
}

/** The metres to px factor, for the reveal. */
export const NINJA_M = NINJA_PX_PER_M;

/* ============================== The run picture (stage 2) ============================== */

/** The run picture's colours (the reveal's legend uses the same). */
export const MOON_RUN_COLOURS = { route: "rgba(225,232,255,0.6)", flow: NINJA_GOLD, hit: "#FF5C66", full: "#F2C75C", reached: "#FFFFFF" } as const;

/** What the run picture draws (moonSummary.ts builds it from the stored log; the renderer never imports the summary). */
export interface MoonRunPictureData {
  route: readonly { x: number; y: number }[];
  hits: readonly { x: number; y: number; lostM: number }[];
  rides: readonly { x: number; y: number }[];
  scrolls: readonly { x: number; y: number }[];
  bestRun: { from: number; to: number } | null;
  bestPx: number;
  metres: number;
  fullM: number;
}

/**
 * Moon Climb's run picture for the answer reveal (the Action overhaul, stage 2, 15 Nov 2026; display only): the shaft
 * drawn tall between two slate walls, the route the ninja climbed as a pale line (the longest Flow streak's stretch in
 * gold), each hit a red mark with its drop and the metres lost, each lantern ridden and scroll taken where it happened,
 * a dashed gold line at the core's full height and the height reached labelled at the top of the climb.
 */
export function drawMoonRunPicture(ctx: CanvasRenderingContext2D, d: MoonRunPictureData, size: { width: number; height: number }): void {
  const W = size.width;
  const H = size.height;
  const wall = 20;
  const top = 26;
  const bottom = H - 12;
  const fullPx = d.fullM * NINJA_PX_PER_M;
  const span = Math.max(d.bestPx, fullPx) * 1.04 + 1;
  const sx = (x: number) => wall + ((x - NINJA_WALL_L) / (NINJA_WALL_R - NINJA_WALL_L)) * (W - 2 * wall);
  const sy = (h: number) => bottom - (h / span) * (bottom - top);
  // The night and the walls.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (const [o, c] of SKY_STOPS) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    const h = artHash(i, 301);
    ctx.fillStyle = `rgba(230,236,255,${(0.25 + ((h >>> 8) % 4) * 0.12).toFixed(2)})`;
    ctx.fillRect(wall + (h % Math.max(1, W - 2 * wall)), (h >>> 12) % H, 1.2, 1.2);
  }
  for (const left of [true, false]) {
    const x0 = left ? 0 : W - wall;
    const sg = ctx.createLinearGradient(x0, 0, x0 + wall, 0);
    sg.addColorStop(0, left ? "#232839" : "#3F475E");
    sg.addColorStop(1, left ? "#3F475E" : "#232839");
    ctx.fillStyle = sg;
    ctx.fillRect(x0, 0, wall, H);
    ctx.fillStyle = SLATE_BED;
    for (let y = H; y > 0; y -= 12) ctx.fillRect(x0, y, wall, 1.5);
    ctx.fillStyle = "rgba(214,226,255,0.35)";
    ctx.fillRect(left ? wall - 1.5 : W - wall, 0, 1.5, H);
  }
  ctx.fillStyle = MOON_FLOOR;
  ctx.fillRect(wall, bottom, W - 2 * wall, H - bottom);
  ctx.font = `800 13px ${ARCADE_FX_DISPLAY_FONT}`;
  ctx.textBaseline = "middle";
  const label = (text: string, x: number, y: number, colour: string, align: CanvasTextAlign) => {
    ctx.textAlign = align;
    const w = ctx.measureText(text).width;
    const lx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    ctx.fillStyle = "rgba(6,8,18,0.72)";
    ctx.beginPath();
    ctx.roundRect(lx - 5, y - 10, w + 10, 20, 6);
    ctx.fill();
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y + 0.5);
  };
  // The core's full height.
  const fy = sy(fullPx);
  ctx.strokeStyle = MOON_RUN_COLOURS.full;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(wall, fy);
  ctx.lineTo(W - wall, fy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  // The climb as a column up the middle of the shaft (the route itself is too dense to read at this size): pale from the
  // floor to the height reached, the longest Flow streak's stretch of it gold, a ruler every 50 m along the walls.
  const cx = W / 2;
  const bw = 12;
  ctx.textAlign = "left";
  ctx.font = `700 12px ${ARCADE_FX_DISPLAY_FONT}`;
  for (let m = 50; m * NINJA_PX_PER_M < span; m += 50) {
    const y = sy(m * NINJA_PX_PER_M);
    ctx.fillStyle = "rgba(214,226,255,0.32)";
    ctx.fillRect(wall, y, 8, 1.2);
    ctx.fillRect(W - wall - 8, y, 8, 1.2);
    // The ruler's number, unless the full-height or reached line sits on it.
    if (Math.abs(y - fy) < 14 || Math.abs(y - sy(d.bestPx)) < 14) continue;
    ctx.fillStyle = "rgba(214,226,255,0.6)";
    ctx.fillText(String(m), wall + 11, y);
  }
  const col = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
  col.addColorStop(0, "rgba(160,180,240,0.55)");
  col.addColorStop(0.5, "rgba(225,232,255,0.85)");
  col.addColorStop(1, "rgba(160,180,240,0.55)");
  ctx.fillStyle = col;
  ctx.fillRect(cx - bw / 2, sy(d.bestPx), bw, bottom - sy(d.bestPx));
  if (d.bestRun) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = d.bestRun.from; i <= d.bestRun.to && i < d.route.length; i++) {
      lo = Math.min(lo, d.route[i]!.y);
      hi = Math.max(hi, d.route[i]!.y);
    }
    if (hi > lo) {
      ctx.fillStyle = MOON_RUN_COLOURS.flow;
      ctx.fillRect(cx - bw / 2, sy(hi), bw, Math.max(2, sy(lo) - sy(hi)));
    }
  }
  // Lanterns ridden and scrolls taken, beside the column on the right at their heights.
  let lastIcon = Infinity;
  const items = [...d.rides.map((r) => ({ y: r.y, ride: true })), ...d.scrolls.map((c) => ({ y: c.y, ride: false }))].sort((a, b) => a.y - b.y);
  for (const it of items) {
    let y = sy(it.y);
    if (lastIcon - y < 22) y = lastIcon - 22;
    lastIcon = y;
    ctx.strokeStyle = "rgba(225,232,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + bw / 2, sy(it.y));
    ctx.lineTo(cx + bw / 2 + 16, y);
    ctx.stroke();
    ctx.save();
    ctx.translate(cx + bw / 2 + 28, y);
    if (it.ride) {
      ctx.scale(0.7, 0.7);
      drawSkyLantern(ctx, 0, 0, 0, true);
    } else {
      ctx.scale(1.3, 1.3);
      drawScrollIcon(ctx, 0, 0);
    }
    ctx.restore();
  }
  // Hits: on the column's left, a red mark where it struck and its drop; the metres lost labelled to the left where
  // the label has room (every mark is drawn; the breakdown's hits line gives the count).
  let lastLabel = sy(d.bestPx) - 8;
  for (const hit of [...d.hits].sort((a, b) => b.y - a.y)) {
    const x = cx - bw / 2 - 5;
    const y0 = sy(hit.y);
    const y1 = sy(Math.max(0, hit.y - hit.lostM * NINJA_PX_PER_M));
    ctx.strokeStyle = MOON_RUN_COLOURS.hit;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
    ctx.fillStyle = MOON_RUN_COLOURS.hit;
    ctx.beginPath();
    ctx.arc(x, y0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (hit.lostM > 0 && y0 - lastLabel >= 22) {
      ctx.font = `800 13px ${ARCADE_FX_DISPLAY_FONT}`;
      label(`\u2212${hit.lostM} m`, x - 10, y0, MOON_RUN_COLOURS.hit, "right");
      lastLabel = y0;
    }
  }
  // The height reached.
  const ry = sy(d.bestPx);
  const reachedFull = d.metres >= d.fullM;
  ctx.strokeStyle = reachedFull ? MOON_RUN_COLOURS.full : MOON_RUN_COLOURS.reached;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wall, ry);
  ctx.lineTo(W - wall, ry);
  ctx.stroke();
  ctx.font = `800 15px ${ARCADE_FX_DISPLAY_FONT}`;
  label(`${d.metres} m`, W / 2, Math.max(12, ry - 13), reachedFull ? MOON_RUN_COLOURS.full : MOON_RUN_COLOURS.reached, "center");
  ctx.font = `800 13px ${ARCADE_FX_DISPLAY_FONT}`;
  if (Math.abs(fy - ry) > 22) label(`${d.fullM} m`, W - wall - 6, fy - 12, MOON_RUN_COLOURS.full, "right");
}
