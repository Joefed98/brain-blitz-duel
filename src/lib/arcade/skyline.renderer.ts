import { drawActionHud } from "./actionHud.renderer";
import { ARCADE_FX_DISPLAY_FONT } from "./arcadeFx.renderer";
import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { SKYLINE_FX, skylineFxFor } from "./arcadeFxGames.renderer";
import type { ArcadeFxSpec } from "./arcadeFx.renderer";
/**
 * Skyline art (Real World construction site). Render only: reads SkylineState,
 * never mutates it. Blocks fill exactly the sim's block rectangles; the camera
 * is the same render-only eased zoom/scroll as skyline.ts.
 */
import { px, type CanvasSize } from "./engine";
import { skylineFlagAt, skylineGustAt, skylineWorldH, SKYLINE_STREAK_FROM, SKYLINE_WIND_FROM } from "./skyline";
import { skylineGame, SKYLINE_BLOCK_H, SKYLINE_MIN_ZOOM, SKYLINE_PERFECT_GROW, SKYLINE_WORLD_W, type SkylineState } from "./skyline";
import {
  skylineKindAt,
  skylineNextMult,
  skylineShownMult,
  SKYLINE_REV_STD,
  SKYLINE_V9_STREAK_MAX,
  SKYLINE_KIND_GOLD,
  SKYLINE_KIND_NARROW,
  SKYLINE_KIND_NORMAL,
  SKYLINE_KIND_WIDE,
  SKYLINE_MILESTONE_EVERY,
  SKYLINE_SKY_H,
  skylineLivesLeft,
  SKYLINE_V11_LIVES,
} from "./skyline";
import { artHash, reducedMotion } from "./art.renderer";
import { APP_FLAG_LOGO_URL } from "@/lib/brand";
import { realMemo, realNow, REAL_GOLD, REAL_SHADOW, REAL_NIGHT_BG, REAL_NIGHT_TEXT, REAL_LAMP } from "./realworld.renderer";
import { artCanvas, artContext, deviceLayer, type ArtCanvas } from "./cache.renderer";
import { arcadeReducedEffects } from "../fx/lowEnd";
import { fillBelow, fillGradient, fillSides } from "./arenaFills.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";

/** City glass tints, cycled per level. */
const GLASS = ["#7FB3D5", "#9CC9C2", "#A9B8D8", "#8FBCE0", "#B5C7D3", "#7FA8C9", "#A4C4B4", "#98AEC8"];
const STEEL = "#788DA4";
export const STEEL_LIGHT = "#A9BED0";
const WINDOW_LIGHT = "#FFC966";
const PANE_GLOW = "rgba(216,243,255,0.18)";
const GROUND = "#424F60";
/** The plaza under the tower (the Action overhaul, display only): the tower is drawn this far above the world's bottom. */
const GROUND_LIFT = 22;
/** The sim's world width in fixed point (the base block is centred in it). */
const SKYLINE_WORLD_RIGHT_FP = SKYLINE_WORLD_W * 256;
const JIB_Y = 30;
const CHUNK_MS = 900;
const SPARK_TICKS = 18;

const zoomMemo = new WeakMap<CanvasRenderingContext2D, number>();

interface Chunk { x: number; w: number; top: number; dir: number; at: number; colour: number }
interface Memory { tick: number; len: number; x: number; w: number; missed: boolean; lost: number; chunks: Chunk[]; placementTicks: number[] }
const memories = new WeakMap<CanvasRenderingContext2D, Memory>();

function remember(ctx: CanvasRenderingContext2D, s: SkylineState): Memory {
  const m = realMemo(memories, ctx, s.tick, () => ({ tick: s.tick, len: s.blocks.length, x: s.x, w: s.w, missed: s.missed, lost: s.livesLost ?? 0, chunks: [], placementTicks: new Array(s.blocks.length).fill(-1e9) }));
  const blockH = px(SKYLINE_BLOCK_H);
  // The tower stands on the plaza (GROUND_LIFT px above the world's bottom; display only).
  const SKYLINE_WORLD_H = skylineWorldH(s) - GROUND_LIFT;
  const now = realNow();
  if (s.tick !== m.tick) {
    if (s.blocks.length > m.len) {
      for (let i = m.len; i < s.blocks.length; i++) m.placementTicks[i] = s.tick;
    }
    if (s.blocks.length > m.len && s.perfectTick !== s.tick) {
      const top = s.blocks[s.blocks.length - 1]!;
      const y = SKYLINE_WORLD_H - (s.blocks.length - 1) * blockH - blockH;
      const idx = s.blocks.length - 1;
      if (top.x > m.x) m.chunks.push({ x: m.x, w: top.x - m.x, top: y, dir: -1, at: now, colour: idx });
      const r0 = top.x + top.w;
      const r1 = m.x + m.w;
      if (r1 > r0) m.chunks.push({ x: r0, w: r1 - r0, top: y, dir: 1, at: now, colour: idx });
    }
    if (s.missed && !m.missed) {
      const y = SKYLINE_WORLD_H - s.blocks.length * blockH - blockH;
      m.chunks.push({ x: m.x, w: m.w, top: y, dir: s.dir, at: now, colour: s.blocks.length });
    } else if ((s.livesLost ?? 0) > m.lost && s.lostW) {
      // skylineRev 11: a life lost; the missed block falls away from where it hung.
      const y = SKYLINE_WORLD_H - s.blocks.length * blockH - blockH;
      m.chunks.push({ x: s.lostX ?? m.x, w: s.lostW, top: y, dir: s.lostX !== undefined && s.lostX > 0 ? 1 : -1, at: now, colour: s.blocks.length });
    }
    m.lost = s.livesLost ?? 0;
    m.tick = s.tick;
    m.len = s.blocks.length;
    m.x = s.x;
    m.w = s.w;
    m.missed = s.missed;
  }
  m.chunks = m.chunks.filter((c) => now - c.at < CHUNK_MS);
  return m;
}

/* ============================ Polish A2: the night ============================ */

/** A deep navy night lifting to indigo at the horizon (canvas-sized, painted once per size). */
export const SKY_TOP = "#060B1F";
export const SKY_MID = "#121A44";
export const SKY_LOW = "#2B2766";
function paintNight(c: CanvasRenderingContext2D, w: number, h: number): void {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(0.55, SKY_MID);
  g.addColorStop(1, SKY_LOW);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  // Stars: many faint, a few brighter with a soft halo, thinning towards the horizon.
  for (let i = 0; i < 90; i++) {
    const r = artHash(i, 211);
    const x = ((r % 10007) / 10007) * w;
    const y = ((((r >>> 14) % 10009) / 10009) ** 1.6) * h * 0.78;
    const bright = i % 11 === 0;
    // Clear of the HUD lines in the top corners.
    if (y < h * 0.11 && (x < w * 0.45 || x > w * 0.6)) continue;
    c.globalAlpha = bright ? 0.9 : 0.25 + ((r >>> 5) % 5) * 0.09;
    c.fillStyle = i % 4 === 0 ? "#FFF1D0" : "#E5EDFF";
    c.fillRect(x, y, bright ? 2 : 1, bright ? 2 : 1);
    if (bright) {
      c.globalAlpha = 0.25;
      c.fillRect(x - 2, y + 0.5, 6, 1);
      c.fillRect(x + 0.5, y - 2, 1, 6);
    }
  }
  c.globalAlpha = 1;
  // The moon, where it always was, glowing.
  const mx = w * 0.84;
  const my = h * 0.15;
  const mr = Math.min(w, h) * 0.035;
  const halo = c.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 5);
  halo.addColorStop(0, "rgba(236,240,214,0.32)");
  halo.addColorStop(0.35, "rgba(200,210,240,0.10)");
  halo.addColorStop(1, "rgba(200,210,240,0)");
  c.fillStyle = halo;
  c.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
  const disc = c.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, mr * 0.1, mx, my, mr);
  disc.addColorStop(0, "#FBFCEF");
  disc.addColorStop(1, "#D6DCC0");
  c.fillStyle = disc;
  c.beginPath();
  c.arc(mx, my, mr, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(150,160,140,0.22)";
  for (const [dx, dy, rr] of [[-0.3, -0.1, 0.22], [0.25, 0.3, 0.16], [0.15, -0.4, 0.12]] as const) {
    c.beginPath();
    c.arc(mx + dx * mr, my + dy * mr, rr * mr, 0, Math.PI * 2);
    c.fill();
  }
  // The city's glow low on the horizon.
  const glow = c.createLinearGradient(0, h * 0.7, 0, h);
  glow.addColorStop(0, "rgba(120,90,200,0)");
  glow.addColorStop(1, "rgba(150,110,210,0.22)");
  c.fillStyle = glow;
  c.fillRect(0, h * 0.7, w, h * 0.3);
}
function drawNight(ctx: CanvasRenderingContext2D, w: number, h: number, night = 1): void {
  deviceLayer(ctx, `skyline-night-${w}x${h}`, (c) => paintNight(c, w, h));
  if (night >= 1) return;
  // The Action overhaul (15 Nov 2026): the round starts at dusk and turns to night as the tower climbs.
  const dusk = sprite(`dusk-${w}x${h}`, w / 2, h / 2, (c) => paintDusk(c, w / 2, h / 2));
  if (!dusk) return;
  ctx.save();
  ctx.globalAlpha = 1 - night;
  ctx.drawImage(dusk as CanvasImageSource, 0, 0, w, h);
  ctx.restore();
}

/**
 * The dusk sky (the Action overhaul, display only): deep blue overhead warming through violet and rose to a low amber
 * glow over the city, a pale early moon and the first few stars. Laid over the night and faded out as the tower climbs.
 */
function paintDusk(c: CanvasRenderingContext2D, w: number, h: number): void {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#152056");
  g.addColorStop(0.38, "#3B3478");
  g.addColorStop(0.62, "#7A4686");
  g.addColorStop(0.82, "#C9657A");
  g.addColorStop(1, "#F2A160");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  // The sun just down, a warm bloom low on the left.
  const sun = c.createRadialGradient(w * 0.22, h * 1.02, 0, w * 0.22, h * 1.02, h * 0.55);
  sun.addColorStop(0, "rgba(255,214,140,0.55)");
  sun.addColorStop(0.4, "rgba(255,170,110,0.18)");
  sun.addColorStop(1, "rgba(255,170,110,0)");
  c.fillStyle = sun;
  c.fillRect(0, 0, w, h);
  // A few long, soft clouds catching the light.
  for (let i = 0; i < 6; i++) {
    const r = artHash(i, 977);
    const cy = h * (0.45 + ((r % 1000) / 1000) * 0.35);
    const cx = ((r >>> 10) % 1000) / 1000 * w;
    const len = w * (0.25 + ((r >>> 4) % 5) * 0.06);
    const cg = c.createLinearGradient(cx - len / 2, 0, cx + len / 2, 0);
    cg.addColorStop(0, "rgba(255,190,170,0)");
    cg.addColorStop(0.5, `rgba(255,${190 + (r % 30)},170,0.16)`);
    cg.addColorStop(1, "rgba(255,190,170,0)");
    c.fillStyle = cg;
    c.fillRect(cx - len / 2, cy, len, 1.5 + (r % 3));
  }
  // The first stars, high and faint.
  c.fillStyle = "#FFF4E0";
  for (let i = 0; i < 14; i++) {
    const r = artHash(i, 431);
    c.globalAlpha = 0.35 + (r % 4) * 0.12;
    c.fillRect(((r % 997) / 997) * w, (((r >>> 12) % 997) / 997) * h * 0.3, 1, 1);
  }
  c.globalAlpha = 1;
  // The early moon, pale, where the night's moon hangs.
  const mx = w * 0.84;
  const my = h * 0.15;
  const mr = Math.min(w, h) * 0.035;
  c.fillStyle = "rgba(255,246,228,0.7)";
  c.beginPath();
  c.arc(mx, my, mr, 0, Math.PI * 2);
  c.fill();
}

/** The night is drawn in this many steps (the world and the screen's fill share each step, so they always match). */
export const SKYLINE_NIGHT_STEPS = 24;

/** The drawn night share: skylineNightShare rounded to a step (the world and the fill both use it). */
export function skylineNightStep(placed: number): number {
  return Math.round(skylineNightShare(placed) * SKYLINE_NIGHT_STEPS) / SKYLINE_NIGHT_STEPS;
}

/** How far the round has gone from dusk (0) to night (1): from the floors built (render only, the same for every player). */
export function skylineNightShare(placed: number): number {
  const t = Math.max(0, Math.min(1, (placed - 4) / 40));
  return t * t * (3 - 2 * t);
}

/** A cached sprite (world units, painted at 2×). */
const sprites = new Map<string, ArtCanvas | null>();
function sprite(key: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void): ArtCanvas | null {
  if (sprites.has(key)) return sprites.get(key)!;
  const layer = artCanvas(Math.ceil(w * 2), Math.ceil(h * 2));
  const c = layer && artContext(layer);
  if (layer && c) {
    (c as CanvasRenderingContext2D).scale(2, 2);
    paint(c as CanvasRenderingContext2D);
  }
  const out = layer && c ? layer : null;
  sprites.set(key, out);
  return out;
}

/**
 * The city behind the tower (the Action overhaul, 15 Nov 2026): concept A's skyline, three layers deep, its windows lighting
 * up as night falls. Since the materials pass it is held still, a distant city the camera never moves (the tower climbs
 * past it), so the screen's fill can paint the very same city beside the world and the two meet without a seam.
 */
function drawBackdrop(ctx: CanvasRenderingContext2D, worldH: number, night = 1): void {
  drawCityBand(ctx, -CITY_PAD, SKYLINE_WORLD_W + CITY_PAD, worldH, night);
}

/** The still city over world x [x0, x1] (repeated past its own width for wide screens), its foot on the world's bottom. */
function drawCityBand(ctx: CanvasRenderingContext2D, x0: number, x1: number, worldH: number, night: number): void {
  const W = SKYLINE_WORLD_W + 2 * CITY_PAD;
  const dim = sprite("city-dim", W, CITY_H, (c) => paintCity(c, 0));
  const lit = night > 0 ? sprite("city-lit", W, CITY_H, (c) => paintCity(c, 1)) : null;
  for (let k = -3; k <= 3; k++) {
    const cx = -CITY_PAD + k * W;
    if (cx + W < x0 || cx > x1) continue;
    if (dim) ctx.drawImage(dim as CanvasImageSource, cx, worldH - CITY_H, W, CITY_H);
    else {
      ctx.save();
      ctx.translate(cx, worldH - CITY_H);
      paintCity(ctx, night);
      ctx.restore();
    }
    if (dim && lit) {
      ctx.globalAlpha = night;
      ctx.drawImage(lit as CanvasImageSource, cx, worldH - CITY_H, W, CITY_H);
      ctx.globalAlpha = 1;
    }
  }
}

/** The city backdrop's size (world px) and how far it runs past each side of the world. */
const CITY_H = 300;
const CITY_PAD = 60;

/**
 * The city behind the tower (the Action overhaul, display only; concept A's lit skyline): a hazy far range of towers,
 * a middle layer with setbacks and spires, and a dark near layer with roof lights; every window placed by artHash, so
 * the city is the same on every device. `lights` 0 is dusk (a few windows on), 1 is night (most windows lit, warm and
 * cool, with the far layer's sparkle).
 */
function paintCity(c: CanvasRenderingContext2D, lights: number): void {
  const W = SKYLINE_WORLD_W + 2 * CITY_PAD;
  const H = CITY_H;
  const on = (seed: number, share: number) => (artHash(seed, 61) % 1000) / 1000 < share;
  const layer = (n: number, seedBase: number, minH: number, maxH: number, minW: number, maxW: number, body: string, edge: string, windowShare: number, warm: number, roofLights: boolean) => {
    let x = -10 - (artHash(seedBase, 3) % 20);
    let i = 0;
    while (x < W && i < n) {
      const r = artHash(seedBase + i * 17, 5);
      const bw = minW + (r % (maxW - minW));
      const bh = minH + ((r >>> 8) % (maxH - minH));
      const top = H - bh;
      c.fillStyle = body;
      c.fillRect(x, top, bw, bh);
      // A setback crown on some towers, a spire on a few.
      const kind = (r >>> 16) % 6;
      if (kind === 0 && bw > 18) {
        c.fillRect(x + bw * 0.2, top - 14, bw * 0.6, 14);
        c.fillRect(x + bw * 0.35, top - 24, bw * 0.3, 10);
      } else if (kind === 1) {
        c.fillRect(x + bw / 2 - 1, top - 26, 2, 26);
      } else if (kind === 2 && bw > 22) {
        c.beginPath();
        c.moveTo(x, top);
        c.lineTo(x + bw / 2, top - bw * 0.35);
        c.lineTo(x + bw, top);
        c.closePath();
        c.fill();
      }
      // The lit edge: a thin highlight down the side facing the old sunset.
      c.fillStyle = edge;
      c.fillRect(x, top, 1.5, bh);
      // Windows in rows.
      for (let wy = top + 6; wy < H - 4; wy += 7) {
        for (let wx = x + 3; wx < x + bw - 4; wx += 5) {
          const seed = (wx * 7919 + wy * 31 + seedBase) | 0;
          if (!on(seed, windowShare * (lights > 0 ? 1 : 0.14))) continue;
          const hue = artHash(seed, 9) % 100 < warm ? (artHash(seed, 11) % 4 === 0 ? "#FFE7B0" : "#FFC66B") : "#BFD6FF";
          c.globalAlpha = 0.45 + (artHash(seed, 13) % 5) * 0.11;
          c.fillStyle = hue;
          c.fillRect(wx, wy, 2, 3);
        }
      }
      c.globalAlpha = 1;
      if (roofLights && bh > 120 && lights > 0) {
        c.fillStyle = "#FF5A5A";
        c.fillRect(x + bw / 2 - 1, top - (kind === 1 ? 27 : kind === 0 ? 25 : 2), 2, 2);
      }
      x += bw + 1 + ((r >>> 20) % 6);
      i++;
    }
  };
  // Far: hazy and blue, a sparse sparkle of windows.
  layer(60, 101, 90, 230, 14, 34, "#2B3068", "rgba(190,170,255,0.18)", 0.18, 30, false);
  // A soft haze between the far and middle layers.
  const haze = c.createLinearGradient(0, H * 0.35, 0, H);
  haze.addColorStop(0, "rgba(90,80,160,0)");
  haze.addColorStop(1, "rgba(120,100,190,0.22)");
  c.fillStyle = haze;
  c.fillRect(0, 0, W, H);
  // Middle: setbacks and spires.
  layer(40, 211, 70, 190, 20, 46, "#1A1F45", "rgba(255,200,170,0.14)", 0.42, 70, true);
  // Near: dark, low and wide, with the most windows.
  layer(26, 307, 40, 120, 28, 62, "#0F1530", "rgba(255,210,170,0.12)", 0.55, 80, true);
  // The near layer's foot fades into the plaza.
  const foot = c.createLinearGradient(0, H - 26, 0, H);
  foot.addColorStop(0, "rgba(14,18,40,0)");
  foot.addColorStop(1, "rgba(14,18,40,0.75)");
  c.fillStyle = foot;
  c.fillRect(0, H - 26, W, 26);
}

/**
 * One floor (the Action overhaul's materials pass, 15 Nov 2026; display only, exactly the sim's rectangle): a glass
 * curtain wall, deep blue-black glass between steel mullions, a gold spandrel band along the top with a metal sheen (a
 * heavier one every fifth floor), windows lighting up as night falls (warm and cool), a crisp highlight down the glass
 * where the tower's curve would catch the moon, a lit left edge and a shaded right edge so the floor's outline and its
 * overlap read at once. `index` picks the windows and the bands; `age` fades a new floor's windows in; `night` 0–1.
 */
export function drawBlock(ctx: CanvasRenderingContext2D, x: number, top: number, w: number, h: number, index: number, age = Infinity, night = 1): void {
  if (w <= 0) return;
  // Glass: darker at the foot, the sky's blue caught near the top.
  const glass = ctx.createLinearGradient(0, top, 0, top + h);
  glass.addColorStop(0, "#2C4166");
  glass.addColorStop(0.45, "#18294A");
  glass.addColorStop(1, "#0E1A31");
  ctx.fillStyle = glass;
  ctx.fillRect(x, top, w, h);
  const inset = 2;
  const panes = Math.max(1, Math.round((w - inset * 2) / 11));
  const pw = (w - inset * 2) / panes;
  const lit = 0.16 + 0.44 * night;
  const fade = age === Infinity ? 1 : Math.max(0, Math.min(1, age / 20));
  const winTop = top + 4;
  const winH = h - 7;
  for (let p = 0; p < panes; p++) {
    const px0 = x + inset + p * pw + 1;
    const r = artHash(index * 31 + p, 7);
    if ((r % 1000) / 1000 < lit) {
      // A lit window: warm or cool, brightest in its middle.
      const warm = r % 5 < 3;
      ctx.globalAlpha = (0.55 + ((r >>> 10) % 4) * 0.1) * fade;
      ctx.fillStyle = warm ? "#FFD993" : "#C8DCFF";
      ctx.fillRect(px0, winTop, pw - 2, winH);
      ctx.globalAlpha = 0.5 * fade;
      ctx.fillStyle = warm ? "#FFF0C8" : "#E8F2FF";
      ctx.fillRect(px0 + (pw - 2) * 0.25, winTop + winH * 0.25, (pw - 2) * 0.5, winH * 0.5);
      ctx.globalAlpha = 1;
    } else {
      // Dark glass with the sky's reflection on its upper half.
      ctx.fillStyle = "rgba(120,160,220,0.13)";
      ctx.fillRect(px0, winTop, pw - 2, winH * 0.45);
    }
  }
  // Steel mullions between the panes, each with a lit side.
  for (let p = 1; p < panes; p++) {
    const mx = Math.round(x + inset + p * pw);
    ctx.fillStyle = "#7D90AA";
    ctx.fillRect(mx - 1, top + 2, 1, h - 3);
    ctx.fillStyle = "rgba(225,235,250,0.35)";
    ctx.fillRect(mx - 1, top + 2, 0.5, h - 3);
  }
  // The gold spandrel band along the top, a polished metal: light on its upper edge, shade under.
  const heavy = index % 5 === 0;
  const bandH = heavy ? 3 : 1.5;
  const gold = ctx.createLinearGradient(0, top, 0, top + bandH);
  gold.addColorStop(0, "#FFE7A3");
  gold.addColorStop(0.5, "#E1B04A");
  gold.addColorStop(1, "#9C7224");
  ctx.fillStyle = gold;
  ctx.fillRect(x, top, w, bandH);
  // The floor slab line at the foot (separates floors crisply).
  ctx.fillStyle = "#08101F";
  ctx.fillRect(x, top + h - 1, w, 1);
  // Edges: lit left, shaded right.
  ctx.fillStyle = "rgba(210,226,250,0.55)";
  ctx.fillRect(x, top + bandH, 1, h - bandH - 1);
  ctx.fillStyle = "rgba(4,8,18,0.55)";
  ctx.fillRect(x + w - 1.5, top + bandH, 1.5, h - bandH - 1);
  // The glass's highlight: a soft band and a crisp line at a fixed place on the tower, so they line up floor to floor.
  const hx = SKYLINE_WORLD_W * 0.43;
  const l = Math.max(x + 1, hx - 7);
  const rr = Math.min(x + w - 2, hx + 3);
  if (rr > l) {
    ctx.fillStyle = "rgba(200,225,255,0.09)";
    ctx.fillRect(l, top + bandH, rr - l, h - bandH - 1);
  }
  if (hx + 1 > x + 1 && hx + 1 < x + w - 2) {
    ctx.fillStyle = "rgba(235,245,255,0.42)";
    ctx.fillRect(hx + 1, top + bandH, 1, h - bandH - 1);
  }
}

/** Polish A2: the spotlight's cone, fading down and soft at its edges (a cached sprite). */
function paintCone(c: CanvasRenderingContext2D): void {
  const W = 140;
  const H = 150;
  const fade = c.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0, "rgba(255,221,150,0.16)");
  fade.addColorStop(0.6, "rgba(255,221,150,0.06)");
  fade.addColorStop(1, "rgba(255,221,150,0)");
  for (const [spread, alpha] of [[66, 0.5], [56, 0.6], [44, 0.8]] as const) {
    c.globalAlpha = alpha;
    c.fillStyle = fade;
    c.beginPath();
    c.moveTo(W / 2 - 2, 0);
    c.lineTo(W / 2 + 2, 0);
    c.lineTo(W / 2 + spread, H);
    c.lineTo(W / 2 - spread, H);
    c.closePath();
    c.fill();
  }
  c.globalAlpha = 1;
}
function paintJibGlow(c: CanvasRenderingContext2D): void {
  const g = c.createLinearGradient(0, 0, 0, 28);
  g.addColorStop(0, "rgba(245,184,46,0)");
  g.addColorStop(0.5, "rgba(245,184,46,0.16)");
  g.addColorStop(1, "rgba(245,184,46,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, SKYLINE_WORLD_W, 28);
}

function drawCrane(ctx: CanvasRenderingContext2D, trolleyX: number, tick: number): void {
  // The materials pass (15 Nov 2026): the jib in painted yellow steel, light on its upper faces (no glow).
  drawJib(ctx, 0, SKYLINE_WORLD_W);
  // The trolley: a steel carriage on two wheels, the hook block under it.
  const tg = ctx.createLinearGradient(0, JIB_Y + 11, 0, JIB_Y + 17);
  tg.addColorStop(0, "#C9D5E4");
  tg.addColorStop(1, "#5E6E84");
  ctx.fillStyle = tg;
  ctx.fillRect(trolleyX - 9, JIB_Y + 11, 18, 6);
  ctx.fillStyle = "#1A2230";
  ctx.fillRect(trolleyX - 7, JIB_Y + 10, 3, 2);
  ctx.fillRect(trolleyX + 4, JIB_Y + 10, 3, 2);
  // Polish A2: a softer spotlight, fading as it falls, its edges feathered.
  const cone = sprite("cone", 140, 150, paintCone);
  if (cone) ctx.drawImage(cone as CanvasImageSource, trolleyX - 70, JIB_Y + 16, 140, 150);
  ctx.fillStyle = REAL_LAMP;
  ctx.fillRect(trolleyX - 4, JIB_Y + 17, 8, 2);
  void tick;
}

/**
 * The crane's jib over world x [x0, x1] (the materials pass): two chords of painted yellow steel, each lit on its top face
 * and shaded under, the lattice between them in two tones (the lit diagonal and the one in shade), bolts at the nodes.
 * The pattern is fixed to the world's x, so the screen's fill draws the same jib beside the world without a seam.
 */
function drawJib(ctx: CanvasRenderingContext2D, x0: number, x1: number): void {
  const start = Math.floor(x0 / 12) * 12;
  for (const [y, h] of [[JIB_Y, 3], [JIB_Y + 9, 3]] as const) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#FFE38A");
    g.addColorStop(0.45, "#E9B42C");
    g.addColorStop(1, "#8E6512");
    ctx.fillStyle = g;
    ctx.fillRect(x0, y, x1 - x0, h);
  }
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "#F2C443";
  ctx.beginPath();
  for (let x = start; x < x1; x += 12) {
    ctx.moveTo(x, JIB_Y + 3);
    ctx.lineTo(x + 6, JIB_Y + 9);
  }
  ctx.stroke();
  ctx.strokeStyle = "#A87A1C";
  ctx.beginPath();
  for (let x = start; x < x1; x += 12) {
    ctx.moveTo(x + 6, JIB_Y + 9);
    ctx.lineTo(x + 12, JIB_Y + 3);
  }
  ctx.stroke();
  ctx.fillStyle = "#5A4210";
  for (let x = start; x < x1; x += 12) {
    ctx.fillRect(x - 0.5, JIB_Y + 1, 1, 1);
    ctx.fillRect(x + 5.5, JIB_Y + 10, 1, 1);
  }
}

/**
 * The app icon's gold and its dark bolt (APP_FLAG_LOGO_URL, Prompt R): the cloth, and the bolt drawn on it
 * before the logo file has loaded (display only).
 */
const FLAG_CLOTH = "#F7BF2F";
const FLAG_BOLT = "#0D0D0F";
/** BoltGlyph's bolt (24-unit box), the stand-in until the logo file is ready. */
const FLAG_BOLT_PATH = [[14, 2], [5, 14], [11, 14], [9, 22], [19, 9], [13, 9], [14, 2]] as const;

/** The app icon (APP_FLAG_LOGO_URL), loaded once per page; null until it is ready or if it fails. */
let flagLogo: HTMLImageElement | null = null;
let flagLogoStarted = false;
function flagLogoImage(): HTMLImageElement | null {
  if (!flagLogoStarted && typeof Image !== "undefined") {
    flagLogoStarted = true;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => (flagLogo = img);
    img.src = APP_FLAG_LOGO_URL;
  }
  return flagLogo;
}

/**
 * The logo, `s` px square, centred at (cx, cy) inside the current clip: the app
 * logo file when it has loaded, else its black square and bolt drawn in code.
 */
function drawFlagLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  const img = flagLogoImage();
  if (img) {
    ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
    return;
  }
  ctx.fillStyle = FLAG_BOLT;
  ctx.beginPath();
  for (const [bx, by] of FLAG_BOLT_PATH) ctx.lineTo(cx + ((bx - 12) / 24) * s, cy + ((by - 12) / 24) * s);
  ctx.fill();
}

/**
 * skylineRev 2: the flag on the top block (pole at its centre, behind the
 * sliding block), showing the app icon (the dark bolt on gold, since Prompt R). Hanging
 * still = calm; streaming and rippling = a gust is about to blow or is
 * blowing, toward `dir`. Presentation only.
 */
function drawFlag(ctx: CanvasRenderingContext2D, x: number, top: number, dir: number, tick: number, zoom: number): void {
  // Screen-sized whatever the camera zoom; the pole clears the sliding block (one block high) so the cloth is never hidden.
  const k = 1 / zoom;
  const poleH = px(SKYLINE_BLOCK_H) + 34 * k;
  const lw = 2 * k;
  ctx.save();
  ctx.strokeStyle = STEEL_LIGHT;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top - poleH);
  ctx.stroke();
  ctx.fillStyle = REAL_GOLD;
  ctx.beginPath();
  ctx.arc(x, top - poleH, 3 * k, 0, Math.PI * 2);
  ctx.fill();
  const still = dir === 0 || reducedMotion();
  // A little smaller than the old red-and-white flag (34 × 20).
  const len = 28 * k;
  const h = 17 * k;
  const phase = (tick / 60) * Math.PI * 2 * 2.2;
  const y0 = top - poleH + 2 * k;
  if (dir === 0) {
    // Hanging limp down the pole: the icon's gold cloth with the bolt upright on it.
    const w = 8 * k;
    const drop = len * 0.75;
    ctx.fillStyle = FLAG_CLOTH;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + w, y0 + 2 * k);
    ctx.lineTo(x + w - k, y0 + 2 * k + drop);
    ctx.lineTo(x, y0 + drop);
    ctx.closePath();
    ctx.fill();
    ctx.clip();
    drawFlagLogo(ctx, x + w / 2, y0 + drop / 2 + k, w * 1.9);
    ctx.restore();
    return;
  }
  const wave = (u: number) => (still ? 0 : Math.sin(phase - u * 5) * 4 * k * u);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    pts.push([x + dir * len * u, y0 + wave(u)]);
  }
  ctx.fillStyle = FLAG_CLOTH;
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (const [px0, py0] of pts) ctx.lineTo(px0, py0);
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i]![0], pts[i]![1] + h);
  ctx.closePath();
  ctx.fill();
  // The logo rides the ripple: each eighth of the cloth draws its slice of the logo
  // shifted by that slice's wave, clipped to the slice (never mirrored, whichever way it flies).
  const s = h * 1.15;
  const cx = x + (dir * len) / 2;
  for (let i = 0; i < 8; i++) {
    const xa = Math.min(pts[i]![0], pts[i + 1]![0]);
    const xb = Math.max(pts[i]![0], pts[i + 1]![0]);
    const dy = (pts[i]![1] + pts[i + 1]![1]) / 2 - y0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(xa - 0.25 * k, y0 + dy, xb - xa + 0.5 * k, h);
    ctx.clip();
    drawFlagLogo(ctx, cx, y0 + dy + h / 2, s);
    ctx.restore();
  }
  ctx.restore();
}

/** skylineRev 2: faint streaks across the sky while a gust actually blows (presentation only). */
function drawGustLines(ctx: CanvasRenderingContext2D, dir: number, tick: number, viewH = 560): void {
  if (dir === 0 || reducedMotion()) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = 0; k < 7; k++) {
    const y = 70 + ((k * 67) % (viewH - 200));
    const span = SKYLINE_WORLD_W + 120;
    const x = ((tick * 9 + k * 113) % span) - 60;
    const sx = dir > 0 ? x : SKYLINE_WORLD_W - x;
    ctx.moveTo(sx, y);
    ctx.lineTo(sx - dir * (30 + (k % 3) * 14), y);
  }
  ctx.stroke();
  ctx.restore();
}

/** The game's drawing through the shared success layer (presentation only). */
export function drawSkylineArt(ctx: CanvasRenderingContext2D, state: SkylineState, size: CanvasSize, crashIndicator = true): void {
  arcadeFx(ctx, state.expandRev ? SKYLINE_FX_EXPAND : skylineFxFor(state), state, () => drawSkylineArtWorld(ctx, state, size, crashIndicator), size);
}

function drawSkylineArtWorld(ctx: CanvasRenderingContext2D, state: SkylineState, size: CanvasSize, crashIndicator = true): void {
  const SKYLINE_WORLD_H = skylineWorldH(state);
  const scale = Math.min(size.width / SKYLINE_WORLD_W, size.height / SKYLINE_WORLD_H);
  const offsetX = (size.width - SKYLINE_WORLD_W * scale) / 2;
  const offsetY = (size.height - SKYLINE_WORLD_H * scale) / 2;
  const blockH = px(SKYLINE_BLOCK_H);
  const mem = remember(ctx, state);
  const night = skylineNightStep(state.placed);
  // The tower stands on the plaza, GROUND_LIFT px above the world's bottom (display only: the sim has no heights).
  const floorH = SKYLINE_WORLD_H - GROUND_LIFT;

  ctx.save();
  drawNight(ctx, size.width, size.height, night);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const towerH = state.blocks.length * blockH;
  const expand = Boolean(state.expandRev);
  // skylineRev 7: more sky. The tower climbs to 60 % of the taller view before the camera pulls back, and
  // zooms out further; for a moment after each height milestone it pulls right back to show the city.
  const middle = SKYLINE_WORLD_H * (expand ? EXPAND_CLIMB : 0.5);
  let target = towerH + blockH <= middle ? 1 : Math.max(expand ? EXPAND_MIN_ZOOM : SKYLINE_MIN_ZOOM, middle / (towerH + blockH));
  if (expand && milestoneAge(state) < MILESTONE_TICKS) target = Math.min(target, Math.max(MILESTONE_ZOOM_MIN, (SKYLINE_WORLD_H * 0.55) / (towerH + blockH * 3)));
  const prev = zoomMemo.get(ctx);
  const ease = expand ? (reducedMotion() ? 1 : 0.09) : 0.12;
  const zoom = prev === undefined || state.tick < 2 ? target : prev + (target - prev) * ease;
  zoomMemo.set(ctx, zoom);
  const visibleH = SKYLINE_WORLD_H / zoom;
  const camScroll = Math.max(0, towerH + blockH + GROUND_LIFT - visibleH * (expand ? EXPAND_CLIMB : 0.5));

  drawBackdrop(ctx, SKYLINE_WORLD_H, night);

  ctx.save();
  ctx.translate(SKYLINE_WORLD_W / 2, SKYLINE_WORLD_H);
  ctx.scale(zoom, zoom);
  ctx.translate(-SKYLINE_WORLD_W / 2, -SKYLINE_WORLD_H + camScroll);

  state.blocks.forEach((block, index) => {
    const top = floorH - index * blockH - blockH;
    if (index > 0) {
      const below = state.blocks[index - 1]!;
      // Soft shadow on the block below, inside its own rectangle.
      const l = Math.max(px(block.x), px(below.x));
      const r = Math.min(px(block.x + block.w), px(below.x + below.w));
      ctx.fillStyle = REAL_SHADOW;
      if (r > l) ctx.fillRect(l, top + blockH, r - l, 3);
    }
    drawBlock(ctx, px(block.x), top, px(block.w), blockH, index, state.tick - (mem.placementTicks[index] ?? state.tick), night);
    // skylineRev 7: a special block keeps its look once placed (block 0 is the base).
    if (expand && index > 0) drawKindMark(ctx, skylineKindAt(state, index - 1), px(block.x), top, px(block.w), blockH, state.tick, false);
  });

  const hangTop = floorH - state.blocks.length * blockH - blockH;
  // skylineRev 2: the flag flies from the top block once the wind can blow.
  if (state.rev && state.placed >= SKYLINE_WIND_FROM && !state.missed) {
    const top = state.blocks[state.blocks.length - 1]!;
    drawFlag(ctx, px(top.x + top.w / 2), hangTop + blockH, skylineFlagAt(state, state.tick), state.tick, zoom);
  }
  let hookX = SKYLINE_WORLD_W / 2;
  if (!state.missed) {
    const bx = px(state.x);
    const bw = px(state.w);
    hookX = bx + bw / 2;
    // Cable and slings from far above down to the hook.
    ctx.strokeStyle = STEEL_LIGHT;
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(hookX, hangTop - 4000);
    ctx.lineTo(hookX, hangTop - 14);
    ctx.moveTo(hookX, hangTop - 14);
    ctx.lineTo(bx + 3, hangTop);
    ctx.moveTo(hookX, hangTop - 14);
    ctx.lineTo(bx + bw - 3, hangTop);
    ctx.stroke();
    ctx.fillStyle = REAL_GOLD;
    ctx.fillRect(hookX - 3, hangTop - 18, 6, 5);
    drawBlock(ctx, bx, hangTop, bw, blockH, state.blocks.length, Infinity, night);
    if (expand) drawKindMark(ctx, skylineKindAt(state, state.placed), bx, hangTop, bw, blockH, state.tick, true);
  }

  // Perfect drop: sparks at the two seam ends (tick-driven, deterministic).
  const age = state.tick - state.perfectTick;
  if (state.perfectTick > 0 && age < SPARK_TICKS && !reducedMotion()) {
    const top = state.blocks[state.blocks.length - 1]!;
    const seamY = floorH - (state.blocks.length - 1) * blockH;
    ctx.fillStyle = REAL_GOLD;
    for (const ex of [px(top.x), px(top.x + top.w)]) {
      for (let k = 0; k < 4; k++) {
        const h = artHash(state.perfectTick, k + (ex > 195 ? 10 : 0));
        const vx = ((h % 9) - 4) * 0.4 + (ex > px(top.x) ? 0.8 : -0.8);
        const vy = -1.2 - ((h >>> 5) % 5) * 0.3;
        ctx.fillRect(ex + vx * age, seamY + vy * age + 0.06 * age * age, 2, 2);
      }
    }
  } else if (state.perfectTick > 0 && age < SPARK_TICKS) {
    const seamY = floorH - (state.blocks.length - 1) * blockH;
    ctx.fillStyle = REAL_GOLD;
    ctx.fillRect(-SKYLINE_WORLD_W, seamY - 1, SKYLINE_WORLD_W * 3, 2);
  }

  void SKYLINE_PERFECT_GROW;

  // Overhangs (and a missed block) fall away as chunks.
  const now = realNow();
  for (const c of mem.chunks) {
    const k = (now - c.at) / CHUNK_MS;
    const fall = 900 * k * k;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.translate(px(c.x) + px(c.w) / 2 + c.dir * 40 * k, c.top + blockH / 2 + fall);
    ctx.rotate(c.dir * k * 1.4);
    drawBlock(ctx, -px(c.w) / 2, -blockH / 2, px(c.w), blockH, c.colour, Infinity, night);
    ctx.restore();
  }
  ctx.restore();

  // The stone plaza in the foreground, held still like the city: the tower stands on it at the start, and as the camera
  // climbs the tower carries on behind it. Its foot is the quay's colour the fill below starts from.
  drawPlaza(ctx, floorH, SKYLINE_WORLD_H, state.blocks[0]!);
  drawQuayStrip(ctx, 0, SKYLINE_WORLD_W, SKYLINE_WORLD_H);

  if (state.rev && !state.missed) drawGustLines(ctx, skylineGustAt(state, state.tick), state.tick, SKYLINE_WORLD_H);

  const perfectTop=state.blocks.at(-1);
  const popX=perfectTop?(px(perfectTop.x+perfectTop.w/2)-SKYLINE_WORLD_W/2)*zoom+SKYLINE_WORLD_W/2:0;
  const popY=SKYLINE_WORLD_H+(-(state.blocks.length-1)*blockH-GROUND_LIFT+camScroll)*zoom;
  if(perfectTop)successFrame(ctx,{id:'skyline',tick:state.tick,count:state.perfects,eventTick:state.perfectTick,colour:REAL_GOLD,width:SKYLINE_WORLD_W,height:SKYLINE_WORLD_H,point:{x:popX,y:popY,shape:'spark'},hud:{x:12,y:12,text:`Blocks ${state.placed}`}});
  if(perfectTop)drawPerfectPop(ctx,state,popX,popY);
  if (expand && perfectTop) {
    drawGoldPop(ctx, state, popX, popY);
    drawMilestone(ctx, state, popX, popY);
  }
  // skylineRev 11: a life lost shows "−1 LIFE" where the block was lost.
  if (perfectTop) drawLifeLost(ctx, state, popY);
  // Crane jib at the top, trolley above the hook's screen x.
  drawCrane(ctx, (hookX - SKYLINE_WORLD_W / 2) * zoom + SKYLINE_WORLD_W / 2, state.tick);

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = REAL_NIGHT_TEXT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  // skylineRev 9 (the revision rooms deal): the Action HUD's chips and the larger NEXT panel (3 Nov 2026).
  const actionHud = state.expandRev === SKYLINE_REV_STD;
  if (actionHud) drawSkylineActionHud(ctx, state);
  else successHud(ctx,'skyline',state.tick,12,12,()=>{ctx.fillText(`Blocks ${state.placed}`, 12, 12);});
  // skylineRev 7–8: the streak multiplier and the next-block preview (skylineRev 9's are in its Action HUD).
  if (actionHud) { /* the streak and NEXT are in the Action HUD */ }
  else if (expand) drawExpandHud(ctx, state);
  // skylineRev 2: the perfect-streak counter, gold once it is scoring.
  else if (state.rev && (state.streak ?? 0) > 0) {
    const streak = state.streak ?? 0;
    ctx.textAlign = "right";
    ctx.fillStyle = streak >= SKYLINE_STREAK_FROM ? REAL_GOLD : REAL_NIGHT_TEXT;
    ctx.fillText(`Streak ×${streak}`, SKYLINE_WORLD_W - 12, 12);
    ctx.textAlign = "left";
  }

  if (state.missed && crashIndicator) {
    ctx.fillStyle = "rgba(229, 72, 77, 0.18)";
    ctx.fillRect(0, 0, SKYLINE_WORLD_W, SKYLINE_WORLD_H);
  }
  ctx.restore();
}

/**
 * The plaza the tower stands on (the Action overhaul, 15 Nov 2026; display only): a lit concrete kerb, paving with
 * joints, and a darker footing slab under the base block, ending at the world's bottom in the quay's colour
 * (skylineRiverFill's #3E4B5E), so the fill below runs on without a seam. Below the world the ground carries on dark.
 */
function drawPlaza(ctx: CanvasRenderingContext2D, floorH: number, worldH: number, base: { x: number; w: number }): void {
  void GROUND;
  const g = ctx.createLinearGradient(0, floorH, 0, worldH);
  g.addColorStop(0, "#6F7C92");
  g.addColorStop(0.2, "#58657C");
  g.addColorStop(1, "#3E4B5E");
  ctx.fillStyle = g;
  ctx.fillRect(-SKYLINE_WORLD_W, floorH, SKYLINE_WORLD_W * 3, worldH - floorH);
  ctx.fillStyle = "#3E4B5E";
  ctx.fillRect(-SKYLINE_WORLD_W, worldH, SKYLINE_WORLD_W * 3, 400);
  // The kerb's lit edge and its shadow line.
  ctx.fillStyle = "#C9D3E2";
  ctx.fillRect(-SKYLINE_WORLD_W, floorH, SKYLINE_WORLD_W * 3, 2);
  ctx.fillStyle = "rgba(10,14,30,0.45)";
  ctx.fillRect(-SKYLINE_WORLD_W, floorH + 6, SKYLINE_WORLD_W * 3, 1);
  // Paving joints.
  ctx.fillStyle = "rgba(20,26,44,0.35)";
  for (let x = -SKYLINE_WORLD_W; x < SKYLINE_WORLD_W * 2; x += 26) ctx.fillRect(x, floorH + 7, 1, worldH - floorH - 7);
  // The footing under the base: a darker slab a little wider than the base, with hazard stripes at its ends.
  const fx = px(base.x) - 8;
  const fw = px(base.w) + 16;
  ctx.fillStyle = "#2B3447";
  ctx.fillRect(fx, floorH + 2, fw, 8);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(fx, floorH + 2, fw, 1);
  for (const sx of [fx, fx + fw - 8]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, floorH + 3, 8, 7);
    ctx.clip();
    ctx.fillStyle = REAL_GOLD;
    ctx.fillRect(sx, floorH + 3, 8, 7);
    ctx.fillStyle = "#1A1A1A";
    for (let k = -8; k < 16; k += 4) {
      ctx.beginPath();
      ctx.moveTo(sx + k, floorH + 10);
      ctx.lineTo(sx + k + 2, floorH + 10);
      ctx.lineTo(sx + k + 9, floorH + 3);
      ctx.lineTo(sx + k + 7, floorH + 3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

/** The quay strip's height (world px): it fades from clear to the quay colour at the world's bottom edge. */
const QUAY_STRIP_H = 12;
const QUAY = "#3E4B5E";
function drawQuayStrip(ctx: CanvasRenderingContext2D, x: number, w: number, worldH: number): void {
  const g = ctx.createLinearGradient(0, worldH - QUAY_STRIP_H, 0, worldH);
  g.addColorStop(0, "rgba(62,75,94,0)");
  g.addColorStop(0.5, "rgba(62,75,94,0.85)");
  g.addColorStop(0.7, QUAY);
  g.addColorStop(1, QUAY);
  ctx.fillStyle = g;
  ctx.fillRect(x, worldH - QUAY_STRIP_H, w, QUAY_STRIP_H);
}

/** The sky alone, in world units over [0, worldH]: the night's gradient and city glow, the dusk laid over it. */
function paintSkyStatic(ctx: CanvasRenderingContext2D, x: number, w: number, worldH: number, night: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, worldH);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(0.55, SKY_MID);
  g.addColorStop(1, SKY_LOW);
  ctx.fillStyle = g;
  ctx.fillRect(x, 0, w, worldH);
  const glow = ctx.createLinearGradient(0, worldH * 0.7, 0, worldH);
  glow.addColorStop(0, "rgba(120,90,200,0)");
  glow.addColorStop(1, "rgba(150,110,210,0.22)");
  ctx.fillStyle = glow;
  ctx.fillRect(x, worldH * 0.7, w, worldH * 0.3);
  if (night >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - night;
  const d = ctx.createLinearGradient(0, 0, 0, worldH);
  d.addColorStop(0, "#152056");
  d.addColorStop(0.38, "#3B3478");
  d.addColorStop(0.62, "#7A4686");
  d.addColorStop(0.82, "#C9657A");
  d.addColorStop(1, "#F2A160");
  ctx.fillStyle = d;
  ctx.fillRect(x, 0, w, worldH);
  const sx = SKYLINE_WORLD_W * 0.22;
  const sun = ctx.createRadialGradient(sx, worldH * 1.02, 0, sx, worldH * 1.02, worldH * 0.55);
  sun.addColorStop(0, "rgba(255,214,140,0.55)");
  sun.addColorStop(0.4, "rgba(255,170,110,0.18)");
  sun.addColorStop(1, "rgba(255,170,110,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(x, 0, w, worldH);
  ctx.restore();
}

/**
 * The scene beside the world (edge to edge, 15 Nov 2026; the materials pass): the sky as the world draws it (night with
 * the dusk laid over it at the same step), stars kept clear of the world, the same still city and the same stone plaza
 * the world draws, in world units over `rect`. The world draws its city and plaza held still too, so wherever the camera
 * is, the world's edge and the scene beside it are one picture with no seam.
 */
export function paintSkylineStatic(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }, worldH: number, night: number, strip = true): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  paintSkyStatic(ctx, rect.x, rect.w, worldH, night);
  // Stars beside the world only (never within 4 px of it), fewer at dusk.
  ctx.fillStyle = "#E5EDFF";
  for (let i = 0; i < 160; i++) {
    const r = artHash(i, 733);
    const x = -SKYLINE_WORLD_W + ((r % 10007) / 10007) * SKYLINE_WORLD_W * 3;
    if (x > -4 && x < SKYLINE_WORLD_W + 4) continue;
    if (x < rect.x || x > rect.x + rect.w) continue;
    const y = ((((r >>> 14) % 10009) / 10009) ** 1.6) * worldH * 0.5;
    ctx.globalAlpha = (0.2 + ((r >>> 5) % 5) * 0.1) * (0.25 + 0.75 * night);
    ctx.fillRect(x, y, i % 9 === 0 ? 1.6 : 1, i % 9 === 0 ? 1.6 : 1);
  }
  ctx.globalAlpha = 1;
  drawCityBand(ctx, rect.x, rect.x + rect.w, worldH, night);
  drawPlaza(ctx, worldH - GROUND_LIFT, worldH, { x: (SKYLINE_WORLD_RIGHT_FP - 51_200) / 2, w: 51_200 });
  drawJib(ctx, rect.x, rect.x + rect.w);
  if (strip) drawQuayStrip(ctx, rect.x, rect.w, worldH);
  ctx.restore();
}

/**
 * The play screen's fill for the dealt night step (edge to edge, 15 Nov 2026): the still scene beside the world, then
 * the quay and the river below it (skylineRiverFill), painted once per size and night step (the stage passes the step as
 * its sceneKey).
 */
const sceneFills = new Map<number, (ctx: CanvasRenderingContext2D, view: ArenaSceneView) => void>();
export function skylineSceneFill(night: number): (ctx: CanvasRenderingContext2D, view: ArenaSceneView) => void {
  let fill = sceneFills.get(night);
  if (!fill) {
    fill = (ctx, view) => {
      for (const r of fillSides(view)) paintSkylineStatic(ctx, r, view.worldH, night);
      skylineRiverFill(ctx, view, night);
    };
    sceneFills.set(night, fill);
  }
  return fill;
}

/** How long "−1 LIFE" shows after a life is lost, in sim ticks. */
const LIFE_POP_TICKS = 60;
/** skylineRev 11: "−1 LIFE" in red over the tower top for a second after a life is lost (display only). */
function drawLifeLost(ctx: CanvasRenderingContext2D, state: SkylineState, topY: number): void {
  const at = state.lostTick ?? 0;
  const age = state.tick - at;
  if (!at || age < 0 || age >= LIFE_POP_TICKS || skylineLivesLeft(state) === null) return;
  const p = age / LIFE_POP_TICKS;
  const still = reducedMotion();
  ctx.save();
  ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
  ctx.font = `800 22px ${ARCADE_FX_DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  const y = Math.max(110, topY - 70 - (still ? 0 : p * 16));
  const word = state.missed ? "LAST LIFE LOST" : "−1 LIFE";
  ctx.strokeStyle = "rgba(20,8,12,0.85)";
  ctx.strokeText(word, SKYLINE_WORLD_W / 2, y);
  ctx.fillStyle = "#FF6B74";
  ctx.fillText(word, SKYLINE_WORLD_W / 2, y);
  ctx.restore();
}

/** A small heart for the LIVES chip (14 px square). */
function heartIcon(colour: string) {
  return (ctx: CanvasRenderingContext2D, cx: number, cy: number) => {
    ctx.save();
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 5);
    ctx.bezierCurveTo(cx - 8, cy - 1, cx - 4, cy - 7, cx, cy - 3);
    ctx.bezierCurveTo(cx + 4, cy - 7, cx + 8, cy - 1, cx, cy + 5);
    ctx.fill();
    ctx.restore();
  };
}

/** How long the "PERFECT" pop shows, in sim ticks. */
const PERFECT_POP_TICKS = 45;
/**
 * Polish A2: "PERFECT" pops over the seam of a perfect drop (from the sim's perfectTick): it springs
 * in a little larger, settles, rises and fades. Still under reduced motion (no spring or rise).
 */
function drawPerfectPop(ctx: CanvasRenderingContext2D, state: SkylineState, x: number, seamY: number): void {
  const age = state.tick - state.perfectTick;
  // skylineRev 7–8: the pop carries the streak multiplier the drop scored at (rev 9 scores none: plain PERFECT).
  const mult = state.expandRev ? skylineShownMult(state) : 1;
  const word = mult > 1 ? `PERFECT ×${mult}` : "PERFECT";
  if (state.perfectTick <= 0 || age < 0 || age >= PERFECT_POP_TICKS) return;
  const p = age / PERFECT_POP_TICKS;
  const still = reducedMotion();
  const scale = still ? 1 : age < 8 ? 0.7 + 0.45 * (age / 8) : 1.15 - 0.15 * Math.min(1, (age - 8) / 8);
  const y = Math.max(70, seamY - 36 - (still ? 0 : p * 18));
  const cx = Math.max(70, Math.min(SKYLINE_WORLD_W - 70, x));
  ctx.save();
  ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
  ctx.translate(cx, y);
  ctx.scale(scale, scale);
  ctx.font = "800 22px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(20,14,40,0.85)";
  ctx.strokeText(word, 0, 0);
  if (!arcadeReducedEffects()) {
    ctx.shadowColor = "rgba(245,184,46,0.8)";
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = REAL_GOLD;
  ctx.fillText(word, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,248,220,0.55)";
  ctx.fillText(word, 0, -1);
  ctx.restore();
}

export const skylineArtGame = { ...skylineGame, draw: drawSkylineArt };
export const skylineRevealGame = { draw: (ctx: CanvasRenderingContext2D, state: SkylineState, size: CanvasSize) => drawSkylineArt(ctx, state, size, false) };
export const SKYLINE_ART_BG = REAL_NIGHT_BG;

/**
 * Polish A2 (display only): the play screen's fill under the tower: a lit stone quay the base stands
 * on, then a river reflecting the city: gold window streaks and the moon's pale path on dark water,
 * settling darker towards the screen's bottom. Painted once per size (ArcadeArenaSlot's scene canvas).
 */
export function skylineRiverFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView, night = 1): void {
  const r = fillBelow(view);
  if (!r) return;
  // The quay's top runs on from the plaza's foot colour (at least 10 px, so no seam at the world's edge).
  const quay = Math.min(12, r.h);
  fillGradient(ctx, r, r.y, r.y + r.h, [
    [0, "#3E4B5E"],
    [Math.min(0.9, (quay - 3) / r.h), "#36435A"],
    [Math.min(0.95, quay / r.h), "#141C3E"],
    [1, "#060918"],
  ]);
  ctx.fillStyle = "rgba(190,205,230,0.22)";
  ctx.fillRect(r.x, r.y + 2, r.w, 1);
  ctx.fillStyle = "rgba(10,14,30,0.6)";
  ctx.fillRect(r.x, r.y + quay - 1, r.w, 1);
  const water = { x: r.x, y: r.y + quay, w: r.w, h: r.h - quay };
  if (water.h <= 2) return;
  // The materials pass (15 Nov 2026): glossy harbour water. At dusk it carries the sky's rose; a soft sheen near the quay.
  if (night < 1) {
    const dusk = ctx.createLinearGradient(0, water.y, 0, water.y + Math.min(water.h, 90));
    dusk.addColorStop(0, `rgba(214,120,140,${(0.32 * (1 - night)).toFixed(3)})`);
    dusk.addColorStop(1, "rgba(214,120,140,0)");
    ctx.fillStyle = dusk;
    ctx.fillRect(water.x, water.y, water.w, Math.min(water.h, 90));
  }
  const sheen = ctx.createLinearGradient(0, water.y, 0, water.y + 14);
  sheen.addColorStop(0, "rgba(170,190,240,0.16)");
  sheen.addColorStop(1, "rgba(170,190,240,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(water.x, water.y, water.w, 14);
  // The city's lights reflected: columns of short broken dashes under the skyline, fading with depth.
  const light = 0.35 + 0.65 * night;
  const deep = Math.max(1, Math.min(water.h - 4, 110));
  for (let k = 0; k < Math.round(water.w / 4); k++) {
    const h = artHash(k, 211);
    if (h % 3 === 0) continue;
    const x = Math.round(water.x + ((h % 10007) / 10007) * water.w);
    const warm = h % 4 !== 0;
    const len = 18 + ((h >>> 9) % 60);
    for (let y = 0; y < Math.min(len, deep); y += 3) {
      const a = (0.34 - (0.3 * y) / len) * light;
      if (a <= 0.02) continue;
      const wob = (artHash(k * 31 + y, 5) % 3) - 1;
      ctx.fillStyle = warm ? `rgba(255,214,140,${a.toFixed(3)})` : `rgba(190,215,255,${a.toFixed(3)})`;
      ctx.fillRect(x + wob, water.y + 2 + y, 1 + ((h >>> 3) % 2), 1);
    }
  }
  // The moon's path: soft pale dashes under where the moon hangs.
  const mx = view.worldW * 0.84;
  for (let k = 0, y = water.y + 3; y < water.y + water.h - 2; k++, y += 4) {
    const span = 6 + (k % 3) * 5 + k * 0.8;
    ctx.fillStyle = `rgba(236,240,214,${(Math.max(0.05, 0.34 - k * 0.02) * light).toFixed(3)})`;
    ctx.fillRect(mx - span / 2 + ((artHash(k, 5) % 7) - 3), y, span, 1);
  }
  // Long, faint ripple lines, a glint on every third.
  for (let y = water.y + 5, i = 0; y < water.y + water.h; y += 7, i++) {
    ctx.fillStyle = "rgba(160,170,230,0.06)";
    ctx.fillRect(water.x, Math.round(y), water.w, 1);
    if (i % 3 === 0) {
      ctx.fillStyle = "rgba(220,230,255,0.10)";
      ctx.fillRect(water.x + ((artHash(i, 9) % 1000) / 1000) * water.w, Math.round(y), 22, 1);
    }
  }
}

/* ============ skylineRev 7: special blocks, the multiplier, the preview and milestones ============ */

/** The tower climbs to this share of the taller view before the camera pulls back (rev 7), and zooms out to this. */
const EXPAND_CLIMB = 0.6;
const EXPAND_MIN_ZOOM = 0.34;
/** A milestone's celebration and camera pull-back, in sim ticks, and how far out the pull-back may go. */
const MILESTONE_TICKS = 100;
const MILESTONE_ZOOM_MIN = 0.22;
const MILESTONE_GOLD = "#FFD24A";
/** Special block looks: gold glass, a red hazard band (narrow), a green band (wide). */
const KIND_LOOK: Record<number, { band: string; glow: string; label: string }> = {
  [SKYLINE_KIND_GOLD]: { band: "#FFD24A", glow: "rgba(255,210,74,0.38)", label: "GOLD" },
  [SKYLINE_KIND_NARROW]: { band: "#FF5D5D", glow: "rgba(255,93,93,0.3)", label: "NARROW" },
  [SKYLINE_KIND_WIDE]: { band: "#46E39A", glow: "rgba(70,227,154,0.3)", label: "WIDE" },
};

function milestoneAge(state: SkylineState): number {
  return state.milestoneTick ? state.tick - state.milestoneTick : Infinity;
}

/**
 * A special block's marks over drawBlock's art, inside the block's own rectangle (the bounds rule): gold
 * glass with a glint for gold, a striped red hazard band for narrow, a green band with arrows for wide.
 */
function drawKindMark(ctx: CanvasRenderingContext2D, kind: number, x: number, top: number, w: number, h: number, tick: number, sliding: boolean): void {
  if (kind === SKYLINE_KIND_NORMAL) return;
  const look = KIND_LOOK[kind]!;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, top, w, h);
  ctx.clip();
  if (kind === SKYLINE_KIND_GOLD) {
    const g = ctx.createLinearGradient(0, top, 0, top + h);
    g.addColorStop(0, "rgba(255,231,140,0.62)");
    g.addColorStop(0.5, "rgba(245,184,46,0.5)");
    g.addColorStop(1, "rgba(160,104,10,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = "#FFE79A";
    ctx.fillRect(x, top, w, 2);
    // A glint sweeping across the sliding gold block (still under reduced motion).
    if (sliding && !reducedMotion()) {
      const gx = x + (((tick * 4) % (w + 60)) - 30);
      ctx.fillStyle = "rgba(255,252,230,0.55)";
      ctx.beginPath();
      ctx.moveTo(gx, top);
      ctx.lineTo(gx + 10, top);
      ctx.lineTo(gx - 2, top + h);
      ctx.lineTo(gx - 12, top + h);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.fillStyle = look.band;
    ctx.fillRect(x, top, w, 4);
    if (kind === SKYLINE_KIND_NARROW) {
      // Hazard stripes along the band.
      ctx.fillStyle = "rgba(30,10,10,0.55)";
      for (let sx = x - 6; sx < x + w; sx += 8) {
        ctx.beginPath();
        ctx.moveTo(sx, top + 4);
        ctx.lineTo(sx + 4, top);
        ctx.lineTo(sx + 7, top);
        ctx.lineTo(sx + 3, top + 4);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Wide: small outward arrows at both ends of the band.
      ctx.fillStyle = "rgba(10,40,26,0.7)";
      for (const [ax, d] of [[x + 3, -1], [x + w - 3, 1]] as const) {
        ctx.beginPath();
        ctx.moveTo(ax + d * 2, top + 2);
        ctx.lineTo(ax - d * 2, top);
        ctx.lineTo(ax - d * 2, top + 4);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = look.glow;
    ctx.fillRect(x, top + 4, w, 2);
  }
  ctx.restore();
}

/**
 * High Rise's Action HUD (skylineRev 9, 3 Nov 2026): BLOCKS (the main count) left, STREAK right (gold once it fills the
 * streak part); under STREAK the NEXT panel, larger than before (its block preview 1.6× the old one), with the kind's name.
 */
function drawSkylineActionHud(ctx: CanvasRenderingContext2D, state: SkylineState): void {
  const streak = state.streak ?? 0;
  // skylineRev 11: the lives left, beside BLOCKS (red on the last one; a ring for a second after one is lost).
  const lives = skylineLivesLeft(state);
  const lostAge = state.tick - (state.lostTick ?? -1e9);
  const livesChip =
    lives === null
      ? []
      : [{ label: "LIVES", value: `${lives} / ${SKYLINE_V11_LIVES}`, tone: (lives <= 1 ? "bad" : "plain") as "bad" | "plain", icon: heartIcon(lives <= 1 ? "#FF5D6A" : "#FF8A93"), flash: lostAge >= 0 && lostAge < 60 ? 1 - lostAge / 60 : 0 }];
  drawActionHud(ctx, SKYLINE_WORLD_W, [
    {
      left: [{ label: "BLOCKS", value: String(state.placed), pulse: { id: "skyline", tick: state.tick } }, ...livesChip],
      right: [{ label: "STREAK", value: String(streak), tone: streak >= SKYLINE_V9_STREAK_MAX ? "gold" : streak > 0 ? "plain" : "dim" }],
    },
  ]);
  if (state.missed) return;
  const nextKind = skylineKindAt(state, state.placed + 1);
  const look = KIND_LOOK[nextKind];
  const named = Boolean(look && nextKind !== SKYLINE_KIND_NORMAL);
  const w = 132;
  const h = named ? 62 : 48;
  const x0 = SKYLINE_WORLD_W - 10 - w;
  const y0 = 46;
  ctx.save();
  ctx.fillStyle = "rgba(10,12,18,0.82)";
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `700 10px ${ARCADE_FX_DISPLAY_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#A9AEC0";
  ctx.fillText("NEXT", x0 + 12, y0 + 24);
  // The block, 1.6× the old preview (narrow 35, normal 48, wide 64 px by 19).
  const bw = Math.round((nextKind === SKYLINE_KIND_NARROW ? 22 : nextKind === SKYLINE_KIND_WIDE ? 40 : 30) * 1.6);
  const bh = 19;
  const bx = x0 + 50 + (68 - bw) / 2;
  const by = y0 + 24 - bh / 2;
  // The next floor in the tower's own glass and steel (the materials pass).
  drawBlock(ctx, bx, by, bw, bh, state.blocks.length + 1, Infinity, skylineNightStep(state.placed));
  if (look) drawKindMark(ctx, nextKind, bx, by, bw, bh, state.tick, nextKind === SKYLINE_KIND_GOLD);
  if (named && look) {
    ctx.font = `800 12px ${ARCADE_FX_DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = look.band;
    ctx.fillText(look.label, x0 + w / 2, y0 + 50);
  }
  ctx.restore();
}

/** A rounded dark pill (the HUD's backing). */
function hudPill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "rgba(6,10,28,0.62)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, h / 2);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

/**
 * skylineRev 7's HUD (top right, clear of the crane): the streak and its multiplier (gold while a perfect
 * drop scores more than ×1), and the next block preview with its kind's look and name.
 */
function drawExpandHud(ctx: CanvasRenderingContext2D, state: SkylineState): void {
  const streak = state.streak ?? 0;
  const mult = skylineShownMult(state);
  // skylineRev 9: no multiplier; the streak turns gold once it fills the streak part (10 in a row).
  const std = state.expandRev === SKYLINE_REV_STD;
  ctx.save();
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textBaseline = "top";
  ctx.textAlign = "right";
  if (streak > 0) {
    ctx.fillStyle = mult > 1 || (std && streak >= SKYLINE_V9_STREAK_MAX) ? REAL_GOLD : REAL_NIGHT_TEXT;
    ctx.fillText(mult > 1 ? `Streak ${streak} ×${mult}` : `Streak ${streak}`, SKYLINE_WORLD_W - 12, 12);
  }
  // The next block: a pill under the crane's jib, right side.
  if (!state.missed) {
    const nextKind = skylineKindAt(state, state.placed + 1);
    const look = KIND_LOOK[nextKind];
    const px0 = SKYLINE_WORLD_W - 112;
    const py0 = 50;
    hudPill(ctx, px0, py0, 100, 26);
    ctx.font = "700 10px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(229,237,255,0.75)";
    ctx.fillText("NEXT", px0 + 10, py0 + 13);
    const bw = nextKind === SKYLINE_KIND_NARROW ? 22 : nextKind === SKYLINE_KIND_WIDE ? 40 : 30;
    const bx = px0 + 44 + (40 - bw) / 2;
    ctx.fillStyle = STEEL;
    ctx.fillRect(bx, py0 + 7, bw, 12);
    ctx.fillStyle = GLASS[(state.blocks.length + 1) % GLASS.length]!;
    ctx.fillRect(bx + 2, py0 + 10, bw - 4, 6);
    if (look) drawKindMark(ctx, nextKind, bx, py0 + 7, bw, 12, state.tick, nextKind === SKYLINE_KIND_GOLD);
    if (look && nextKind !== SKYLINE_KIND_NORMAL) {
      // The name above the pill, in the kind's colour.
      ctx.font = "800 11px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillStyle = look.band;
      ctx.fillText(look.label, SKYLINE_WORLD_W - 12, py0 + 30);
    }
  }
  // The multiplier the next perfect drop would score at, once it is more than ×1.
  const nextMult = std ? 1 : skylineNextMult(state);
  if (!state.missed && nextMult > mult && streak > 0) {
    ctx.font = "700 10px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(245,184,46,0.8)";
    ctx.fillText(`next perfect ×${nextMult}`, SKYLINE_WORLD_W - 12, 32);
  }
  ctx.restore();
}

/** How long the "GOLD +" pop shows, in sim ticks. */
const GOLD_POP_TICKS = 50;
/** skylineRev 7: a gold block landed perfectly: "GOLD BONUS" rises beside the PERFECT pop with a few gold motes. */
function drawGoldPop(ctx: CanvasRenderingContext2D, state: SkylineState, x: number, seamY: number): void {
  const age = state.tick - (state.lastPerfect ?? 0);
  if (!state.lastPerfect || state.lastKind !== SKYLINE_KIND_GOLD || age < 0 || age >= GOLD_POP_TICKS) return;
  const p = age / GOLD_POP_TICKS;
  const still = reducedMotion();
  const cx = Math.max(70, Math.min(SKYLINE_WORLD_W - 70, x));
  const y = Math.max(96, seamY - 62 - (still ? 0 : p * 16));
  ctx.save();
  ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
  ctx.font = "800 15px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(20,14,40,0.85)";
  ctx.strokeText("GOLD BONUS", cx, y);
  ctx.fillStyle = MILESTONE_GOLD;
  ctx.fillText("GOLD BONUS", cx, y);
  if (!still && !arcadeReducedEffects()) {
    ctx.fillStyle = "#FFF1B8";
    for (let k = 0; k < 8; k++) {
      const h = artHash(state.lastPerfect, 40 + k);
      const ang = (k / 8) * Math.PI * 2 + (h % 7) * 0.1;
      const r = 14 + p * 40;
      ctx.fillRect(cx + Math.cos(ang) * r * 1.6, seamY + Math.sin(ang) * r * 0.6, 2, 2);
    }
  }
  ctx.restore();
}

/**
 * skylineRev 7: a height milestone. A gold banner ("FLOOR 20 · CITY BONUS") over the city while the camera
 * pulls back, gold sparks bursting off the top block, and the rooftop's beacon flashing. Reduced motion: the
 * banner fades in still, no sparks; reduced effects: no glow.
 */
function drawMilestone(ctx: CanvasRenderingContext2D, state: SkylineState, x: number, seamY: number): void {
  const age = milestoneAge(state);
  if (age < 0 || age >= MILESTONE_TICKS) return;
  const p = age / MILESTONE_TICKS;
  const still = reducedMotion();
  ctx.save();
  if (!still) {
    ctx.fillStyle = MILESTONE_GOLD;
    for (let k = 0; k < 18; k++) {
      const h = artHash(state.milestoneTick ?? 0, k);
      const ang = -Math.PI * (0.1 + 0.8 * ((h % 1000) / 1000));
      const v = 1.6 + ((h >>> 10) % 7) * 0.35;
      const t = Math.min(age, 60);
      const sx = x + Math.cos(ang) * v * t;
      const sy = seamY + Math.sin(ang) * v * t + 0.035 * t * t;
      ctx.globalAlpha = Math.max(0, 1 - age / 60);
      ctx.fillRect(sx, sy, 2.5, 2.5);
    }
  }
  const floor = (state.milestones ?? 0) * SKYLINE_MILESTONE_EVERY;
  const fade = p < 0.12 ? p / 0.12 : p > 0.8 ? (1 - p) / 0.2 : 1;
  ctx.globalAlpha = Math.max(0, fade);
  const y = skylineWorldH(state) * 0.24;
  hudPill(ctx, SKYLINE_WORLD_W / 2 - 128, y - 20, 256, 40);
  ctx.font = "800 20px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (!arcadeReducedEffects()) {
    ctx.shadowColor = "rgba(255,210,74,0.75)";
    ctx.shadowBlur = 10;
  }
  ctx.fillStyle = MILESTONE_GOLD;
  ctx.fillText(`FLOOR ${floor}`, SKYLINE_WORLD_W / 2, y - 4);
  ctx.shadowBlur = 0;
  ctx.font = "700 11px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#FFF1C8";
  // skylineRev 9: a milestone is a celebration only (its floors are in the core), so no "bonus".
  ctx.fillText(state.expandRev === SKYLINE_REV_STD ? "CITY VIEW" : "CITY BONUS", SKYLINE_WORLD_W / 2, y + 12);
  ctx.restore();
}

/**
 * skylineRev 7's success layer: Tuning E's events in the taller view (390 × SKYLINE_SKY_H), the streak
 * banner naming the multiplier, the milestone banner left to the game's own (drawMilestone), and a burst for
 * a gold block landed perfectly.
 */
export const SKYLINE_FX_EXPAND: ArcadeFxSpec<SkylineState> = {
  ...SKYLINE_FX,
  height: SKYLINE_SKY_H,
  // skylineRev 11 (lives): every lost life is a miss moment (the red edge pulse), not just the last.
  misses: [{ count: (s) => s.livesLost ?? (s.missed ? 1 : 0) }],
  events: [
    { kind: "perfect", count: (s) => s.perfects, at: () => ({ x: SKYLINE_WORLD_W / 2, y: SKYLINE_SKY_H * 0.42 }), label: () => null },
    // The milestone's banner is the game's own; this adds the edge glow and burst only.
    { kind: "streak", count: (s) => s.milestones ?? 0, at: () => ({ x: SKYLINE_WORLD_W / 2, y: SKYLINE_SKY_H * 0.3 }), label: () => null },
    // skylineRev 9: no multiplier; the banner counts the perfect streak from its 3rd drop.
    {
      kind: "combo",
      count: (s) => (s.expandRev === SKYLINE_REV_STD ? ((s.streak ?? 0) >= 3 ? s.streak ?? 0 : 0) : skylineShownMult(s)),
      min: 2,
      label: (s, n) => (s.expandRev === SKYLINE_REV_STD ? `STREAK ${n}` : `STREAK ×${n}`),
    },
    { kind: "pop", count: (s) => (s.rev && s.placed >= 20 ? 1 : 0), at: () => ({ x: SKYLINE_WORLD_W / 2, y: SKYLINE_SKY_H * 0.3 }), label: () => "FLAG UP: WATCH THE WIND!" },
    { kind: "perfect", count: (s) => s.golds ?? 0, at: () => ({ x: SKYLINE_WORLD_W / 2, y: SKYLINE_SKY_H * 0.36 }), label: () => null, lights: ["#FFD24A", "#FFF1B8"] },
    { kind: "perfect", count: (s) => s.gustPerfects ?? 0, at: () => ({ x: SKYLINE_WORLD_W / 2, y: SKYLINE_SKY_H * 0.36 }), label: () => "PERFECT IN THE WIND!" },
  ],
};
