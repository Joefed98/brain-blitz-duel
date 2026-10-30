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
} from "./skyline";
import { artHash, reducedMotion } from "./art.renderer";
import { APP_FLAG_LOGO_URL } from "@/lib/brand";
import { realMemo, realNow, REAL_GOLD, REAL_SHADOW, REAL_NIGHT_BG, REAL_NIGHT_TEXT, REAL_LAMP } from "./realworld.renderer";
import { artCanvas, artContext, deviceLayer, type ArtCanvas } from "./cache.renderer";
import { arcadeReducedEffects } from "../fx/lowEnd";
import { fillBelow, fillGradient } from "./arenaFills.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";

/** City glass tints, cycled per level. */
const GLASS = ["#7FB3D5", "#9CC9C2", "#A9B8D8", "#8FBCE0", "#B5C7D3", "#7FA8C9", "#A4C4B4", "#98AEC8"];
const STEEL = "#788DA4";
export const STEEL_LIGHT = "#A9BED0";
const TOWER_DARK = "#131D2C";
const TOWER_NEAR = "#202C3D";
const WINDOW_LIGHT = "#FFC966";
const PANE_GLOW = "rgba(216,243,255,0.18)";
const GROUND = "#424F60";
const JIB_Y = 30;
const CHUNK_MS = 900;
const SPARK_TICKS = 18;

const zoomMemo = new WeakMap<CanvasRenderingContext2D, number>();

interface Chunk { x: number; w: number; top: number; dir: number; at: number; colour: number }
interface Memory { tick: number; len: number; x: number; w: number; missed: boolean; chunks: Chunk[]; placementTicks: number[] }
const memories = new WeakMap<CanvasRenderingContext2D, Memory>();

function remember(ctx: CanvasRenderingContext2D, s: SkylineState): Memory {
  const m = realMemo(memories, ctx, s.tick, () => ({ tick: s.tick, len: s.blocks.length, x: s.x, w: s.w, missed: s.missed, chunks: [], placementTicks: new Array(s.blocks.length).fill(-1e9) }));
  const blockH = px(SKYLINE_BLOCK_H);
  const SKYLINE_WORLD_H = skylineWorldH(s);
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
    }
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
function drawNight(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  deviceLayer(ctx, `skyline-night-${w}x${h}`, (c) => paintNight(c, w, h));
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

const BACKDROP = [
  [0, 34, 120], [30, 26, 180], [54, 40, 140], [92, 22, 210], [112, 36, 160], [146, 30, 240],
  [174, 44, 130], [216, 26, 200], [240, 38, 170], [276, 30, 230], [304, 42, 150], [344, 24, 190], [366, 30, 140],
] as const;

/** The backdrop's height in world units (its tallest far tower, plus a little). */
const BACKDROP_H = 260;
/**
 * Polish A2: two layered skylines (the same towers as before): the far one a hazy indigo with sparse
 * cool windows, the near one darker with warm lit windows and a few roof lights. Painted once into a
 * sprite, drawn under the same parallax as before.
 */
function paintSkylines(c: CanvasRenderingContext2D): void {
  const H = BACKDROP_H;
  c.globalAlpha = 0.9;
  c.fillStyle = "#1E2150";
  for (const [x, w, h] of BACKDROP) c.fillRect(x - 40, H - h, w - 2, h);
  c.fillStyle = "#A9B8FF";
  for (const [x, w, h] of BACKDROP) {
    for (let wy = H - h + 8; wy < H - 6; wy += 12) {
      for (let wx = x - 37; wx < x - 40 + w - 6; wx += 7) {
        const r = artHash(wx * 3, wy);
        if (r % 7 !== 0) continue;
        c.globalAlpha = 0.18 + (r % 3) * 0.08;
        c.fillRect(wx, wy, 2, 3);
      }
    }
  }
  c.globalAlpha = 1;
  c.fillStyle = TOWER_DARK;
  for (const [x, w, h] of BACKDROP) c.fillRect(x + 15, H - h * 0.6, w - 4, h * 0.6);
  c.fillStyle = "rgba(255,255,255,0.05)";
  for (const [x, , h] of BACKDROP) c.fillRect(x + 15, H - h * 0.6, 2, h * 0.6);
  for (const [x, w, h] of BACKDROP) {
    for (let wy = H - h * 0.6 + 8; wy < H - 6; wy += 14) {
      for (let wx = x + 19; wx < x + 15 + w - 8; wx += 8) {
        const r = artHash(wx, wy);
        if (r % 3 === 0) continue;
        c.globalAlpha = r % 5 === 0 ? 0.75 : 0.32;
        c.fillStyle = r % 5 === 0 ? "#FFE3A3" : WINDOW_LIGHT;
        c.fillRect(wx, wy, 3, 5);
      }
    }
  }
  c.globalAlpha = 1;
  c.fillStyle = "#FF5A5A";
  for (const [x, w, h] of BACKDROP) if (h * 0.6 > 110) c.fillRect(x + 15 + (w - 4) / 2 - 1, H - h * 0.6 - 2, 2, 2);
}
function drawBackdrop(ctx: CanvasRenderingContext2D, zoom: number, scroll: number, SKYLINE_WORLD_H: number): void {
  const k = 1 - (1 - zoom) * 0.2;
  ctx.save();
  ctx.translate(SKYLINE_WORLD_W / 2, SKYLINE_WORLD_H + scroll * 0.2 * zoom);
  ctx.scale(k, k);
  ctx.translate(-SKYLINE_WORLD_W / 2, -SKYLINE_WORLD_H);
  const art = sprite("skylines", SKYLINE_WORLD_W + 80, BACKDROP_H, (c) => {
    c.translate(40, 0);
    paintSkylines(c);
  });
  if (art) ctx.drawImage(art as CanvasImageSource, -40, SKYLINE_WORLD_H - BACKDROP_H, SKYLINE_WORLD_W + 80, BACKDROP_H);
  else {
    ctx.translate(0, SKYLINE_WORLD_H - BACKDROP_H);
    paintSkylines(ctx);
  }
  ctx.restore();
}

export function drawBlock(ctx: CanvasRenderingContext2D, x: number, top: number, w: number, h: number, index: number, age = Infinity): void {
  ctx.fillStyle = STEEL;
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = GLASS[index % GLASS.length]!;
  const inset = 3;
  const panes = Math.max(1, Math.round((w - inset * 2) / 16));
  const pw = (w - inset * 2) / panes;
  for (let p = 0; p < panes; p++) ctx.fillRect(x + inset + p * pw + 1, top + inset + 2, pw - 2, h - inset * 2 - 4);
  ctx.fillStyle = PANE_GLOW;
  for (let p = 0; p < panes; p++) ctx.fillRect(x + inset + p * pw + 1, top + inset + 2, pw - 2, h - inset * 2 - 4);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  for (let p = 0; p < panes; p++) ctx.fillRect(x + inset + p * pw + 1, top + inset + 2, Math.max(1, (pw - 2) * 0.3), h - inset * 2 - 4);
  ctx.fillStyle = STEEL_LIGHT;
  ctx.fillRect(x, top, w, 2);
  // Polish A2: shading down the floor (lit from the top, darker at its foot) and a darker right edge.
  ctx.fillStyle = "rgba(10,16,30,0.16)";
  ctx.fillRect(x, top + h * 0.55, w, h * 0.45);
  ctx.fillStyle = "rgba(10,16,30,0.22)";
  ctx.fillRect(x, top + h - 2, w, 2);
  ctx.fillRect(x + w - 2, top + 2, 2, h - 2);

  // Warm lit windows for placed floors (fade in over ~20 ticks after landing).
  if (age !== Infinity) {
    const fade = Math.max(0, Math.min(1, age / 20));
    for (let p = 0; p < panes; p++) {
      const lit = artHash(index * 31 + p, 7) % 5;
      if (lit === 0) continue;
      ctx.globalAlpha = fade * (lit === 1 ? 0.45 : 0.85);
      ctx.fillStyle = lit === 4 ? "#FFE3A3" : WINDOW_LIGHT;
      ctx.fillRect(x + inset + p * pw + 2, top + inset + 3, pw - 4, h - inset * 2 - 6);
      // Polish A2: a warm glow in the pane, brightest at its centre (inside the block).
      ctx.globalAlpha = fade * (lit === 1 ? 0.25 : 0.45);
      ctx.fillStyle = "#FFF4D6";
      ctx.fillRect(x + inset + p * pw + 2 + (pw - 4) * 0.25, top + inset + 3 + (h - inset * 2 - 6) * 0.2, (pw - 4) * 0.5, (h - inset * 2 - 6) * 0.6);
    }
    ctx.globalAlpha = 1;
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
  // Polish A2: the jib glows faintly.
  if (!arcadeReducedEffects()) {
    const glow = sprite("jibglow", SKYLINE_WORLD_W, 28, paintJibGlow);
    if (glow) ctx.drawImage(glow as CanvasImageSource, 0, JIB_Y - 8, SKYLINE_WORLD_W, 28);
  }
  // Lattice jib across the top, from a mast stub at the right.
  ctx.fillStyle = REAL_GOLD;
  ctx.fillRect(0, JIB_Y, SKYLINE_WORLD_W, 3);
  ctx.fillRect(0, JIB_Y + 9, SKYLINE_WORLD_W, 3);
  ctx.strokeStyle = REAL_GOLD;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x < SKYLINE_WORLD_W; x += 12) {
    ctx.moveTo(x, JIB_Y + 3);
    ctx.lineTo(x + 6, JIB_Y + 9);
    ctx.lineTo(x + 12, JIB_Y + 3);
  }
  ctx.stroke();
  // Trolley.
  ctx.fillStyle = STEEL_LIGHT;
  ctx.fillRect(trolleyX - 8, JIB_Y + 11, 16, 5);
  // Polish A2: a softer spotlight, fading as it falls, its edges feathered.
  const cone = sprite("cone", 140, 150, paintCone);
  if (cone) ctx.drawImage(cone as CanvasImageSource, trolleyX - 70, JIB_Y + 16, 140, 150);
  ctx.fillStyle = REAL_LAMP;
  ctx.fillRect(trolleyX - 4, JIB_Y + 16, 8, 3);
  void tick;
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

  ctx.save();
  drawNight(ctx, size.width, size.height);
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
  const camScroll = Math.max(0, towerH + blockH - visibleH * (expand ? EXPAND_CLIMB : 0.5));

  drawBackdrop(ctx, zoom, camScroll, SKYLINE_WORLD_H);

  ctx.save();
  ctx.translate(SKYLINE_WORLD_W / 2, SKYLINE_WORLD_H);
  ctx.scale(zoom, zoom);
  ctx.translate(-SKYLINE_WORLD_W / 2, -SKYLINE_WORLD_H + camScroll);

  // Ground slab under the base.
  ctx.fillStyle = GROUND;
  ctx.fillRect(-SKYLINE_WORLD_W, SKYLINE_WORLD_H, SKYLINE_WORLD_W * 3, 400);

  state.blocks.forEach((block, index) => {
    const top = SKYLINE_WORLD_H - index * blockH - blockH;
    if (index > 0) {
      const below = state.blocks[index - 1]!;
      // Soft shadow on the block below, inside its own rectangle.
      const l = Math.max(px(block.x), px(below.x));
      const r = Math.min(px(block.x + block.w), px(below.x + below.w));
      ctx.fillStyle = REAL_SHADOW;
      if (r > l) ctx.fillRect(l, top + blockH, r - l, 3);
    }
    drawBlock(ctx, px(block.x), top, px(block.w), blockH, index, state.tick - (mem.placementTicks[index] ?? state.tick));
    // skylineRev 7: a special block keeps its look once placed (block 0 is the base).
    if (expand && index > 0) drawKindMark(ctx, skylineKindAt(state, index - 1), px(block.x), top, px(block.w), blockH, state.tick, false);
  });

  const hangTop = SKYLINE_WORLD_H - state.blocks.length * blockH - blockH;
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
    drawBlock(ctx, bx, hangTop, bw, blockH, state.blocks.length);
    if (expand) drawKindMark(ctx, skylineKindAt(state, state.placed), bx, hangTop, bw, blockH, state.tick, true);
  }

  // Perfect drop: sparks at the two seam ends (tick-driven, deterministic).
  const age = state.tick - state.perfectTick;
  if (state.perfectTick > 0 && age < SPARK_TICKS && !reducedMotion()) {
    const top = state.blocks[state.blocks.length - 1]!;
    const seamY = SKYLINE_WORLD_H - (state.blocks.length - 1) * blockH;
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
    const seamY = SKYLINE_WORLD_H - (state.blocks.length - 1) * blockH;
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
    drawBlock(ctx, -px(c.w) / 2, -blockH / 2, px(c.w), blockH, c.colour);
    ctx.restore();
  }
  ctx.restore();

  if (state.rev && !state.missed) drawGustLines(ctx, skylineGustAt(state, state.tick), state.tick, SKYLINE_WORLD_H);

  const perfectTop=state.blocks.at(-1);
  const popX=perfectTop?(px(perfectTop.x+perfectTop.w/2)-SKYLINE_WORLD_W/2)*zoom+SKYLINE_WORLD_W/2:0;
  const popY=SKYLINE_WORLD_H+(-(state.blocks.length-1)*blockH+camScroll)*zoom;
  if(perfectTop)successFrame(ctx,{id:'skyline',tick:state.tick,count:state.perfects,eventTick:state.perfectTick,colour:REAL_GOLD,width:SKYLINE_WORLD_W,height:SKYLINE_WORLD_H,point:{x:popX,y:popY,shape:'spark'},hud:{x:12,y:12,text:`Blocks ${state.placed}`}});
  if(perfectTop)drawPerfectPop(ctx,state,popX,popY);
  if (expand && perfectTop) {
    drawGoldPop(ctx, state, popX, popY);
    drawMilestone(ctx, state, popX, popY);
  }
  // Crane jib at the top, trolley above the hook's screen x.
  drawCrane(ctx, (hookX - SKYLINE_WORLD_W / 2) * zoom + SKYLINE_WORLD_W / 2, state.tick);

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = REAL_NIGHT_TEXT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  successHud(ctx,'skyline',state.tick,12,12,()=>{ctx.fillText(`Blocks ${state.placed}`, 12, 12);});
  // skylineRev 7: the streak multiplier and the next-block preview.
  if (expand) drawExpandHud(ctx, state);
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
export function skylineRiverFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const r = fillBelow(view);
  if (!r) return;
  // The quay's top runs on from the base's ground colour (at least 10 px, so no seam at the world's edge).
  const quay = Math.min(12, r.h);
  fillGradient(ctx, r, r.y, r.y + r.h, [
    [0, "#3E4B5E"],
    [Math.min(0.9, (quay - 3) / r.h), "#36435A"],
    [Math.min(0.95, quay / r.h), "#161C3C"],
    [1, "#0A0D22"],
  ]);
  ctx.fillStyle = "rgba(190,205,230,0.22)";
  ctx.fillRect(r.x, r.y + 2, r.w, 1);
  ctx.fillStyle = "rgba(10,14,30,0.6)";
  ctx.fillRect(r.x, r.y + quay - 1, r.w, 1);
  const water = { x: r.x, y: r.y + quay, w: r.w, h: r.h - quay };
  if (water.h <= 2) return;
  // The moon's path: soft pale dashes under where the moon hangs.
  const mx = view.worldW * 0.84;
  for (let k = 0, y = water.y + 3; y < water.y + water.h - 2; k++, y += 4) {
    const span = 6 + (k % 3) * 5 + k * 0.8;
    ctx.fillStyle = `rgba(236,240,214,${Math.max(0.05, 0.3 - k * 0.02).toFixed(3)})`;
    ctx.fillRect(mx - span / 2 + ((artHash(k, 5) % 7) - 3), y, span, 1);
  }
  // Window lights broken into short gold streaks on the ripples.
  for (let k = 0; k < Math.round(water.w / 6); k++) {
    const h = artHash(k, 97);
    const x = water.x + ((h % 10007) / 10007) * water.w;
    const y = water.y + 3 + (((h >>> 14) % 1000) / 1000) * Math.max(1, Math.min(water.h - 6, 60));
    ctx.fillStyle = h % 4 === 0 ? "rgba(255,227,163,0.32)" : "rgba(255,201,102,0.2)";
    ctx.fillRect(Math.round(x), Math.round(y), 3 + (h % 6), 1);
  }
  // Long, faint ripple lines.
  ctx.fillStyle = "rgba(160,170,230,0.06)";
  for (let y = water.y + 5; y < water.y + water.h; y += 7) ctx.fillRect(water.x, Math.round(y), water.w, 1);
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
