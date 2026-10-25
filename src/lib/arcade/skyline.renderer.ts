import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { skylineFxFor } from "./arcadeFxGames.renderer";
/**
 * Skyline art (Real World construction site). Render only: reads SkylineState,
 * never mutates it. Blocks fill exactly the sim's block rectangles; the camera
 * is the same render-only eased zoom/scroll as skyline.ts.
 */
import { px, type CanvasSize } from "./engine";
import { skylineFlagAt, skylineGustAt, skylineWorldH, SKYLINE_STREAK_FROM, SKYLINE_WIND_FROM } from "./skyline";
import { skylineGame, SKYLINE_BLOCK_H, SKYLINE_MIN_ZOOM, SKYLINE_PERFECT_GROW, SKYLINE_WORLD_W, type SkylineState } from "./skyline";
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
const STEEL_LIGHT = "#A9BED0";
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
  arcadeFx(ctx, skylineFxFor(state), state, () => drawSkylineArtWorld(ctx, state, size, crashIndicator), size);
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
  const middle = SKYLINE_WORLD_H / 2;
  const target = towerH + blockH <= middle ? 1 : Math.max(SKYLINE_MIN_ZOOM, middle / (towerH + blockH));
  const prev = zoomMemo.get(ctx);
  const zoom = prev === undefined || state.tick < 2 ? target : prev + (target - prev) * 0.12;
  zoomMemo.set(ctx, zoom);
  const visibleH = SKYLINE_WORLD_H / zoom;
  const camScroll = Math.max(0, towerH + blockH - visibleH * 0.5);

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
  // Crane jib at the top, trolley above the hook's screen x.
  drawCrane(ctx, (hookX - SKYLINE_WORLD_W / 2) * zoom + SKYLINE_WORLD_W / 2, state.tick);

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = REAL_NIGHT_TEXT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  successHud(ctx,'skyline',state.tick,12,12,()=>{ctx.fillText(`Blocks ${state.placed}`, 12, 12);});
  // skylineRev 2: the perfect-streak counter, gold once it is scoring.
  if (state.rev && (state.streak ?? 0) > 0) {
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
  ctx.strokeText("PERFECT", 0, 0);
  if (!arcadeReducedEffects()) {
    ctx.shadowColor = "rgba(245,184,46,0.8)";
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = REAL_GOLD;
  ctx.fillText("PERFECT", 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,248,220,0.55)";
  ctx.fillText("PERFECT", 0, -1);
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
  const quay = Math.min(10, r.h * 0.3);
  fillGradient(ctx, r, r.y, r.y + r.h, [
    [0, "#3E4B5E"],
    [Math.min(0.4, (quay - 3) / r.h), "#2F3A4E"],
    [Math.min(0.5, quay / r.h), "#161C3C"],
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
