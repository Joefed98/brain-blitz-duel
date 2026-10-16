/**
 * Fairground theme layer: an evening funfair stall. Render only — never
 * imported by sims, graders or scoring. Games call `fairScreen` with their
 * world size and the counter line (world y); the world uses the same centred
 * fit transform the sims' own drawing uses, so input mapping never moves.
 *
 * Layers: sky, silhouettes and bunting sit behind everything; the wooden
 * counter starts at the given world line (below all play geometry); the
 * striped canopy fills the top margin, never lower than world y 10 (the HUD
 * starts at 12).
 */
import type { CanvasSize } from "./engine";
import { artReady, drawArtSprite } from "./sprites.renderer";
import { artHash, reducedMotion } from "./art.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { sceneBelow, sceneFill, sceneSides, type ArenaSceneView } from "./arenaScene.renderer";

export const FAIR_SKY_TOP = "#0D1838";
export const FAIR_SKY_MID = "#3B2C63";
export const FAIR_HORIZON = "#F08A3C";
export const FAIR_SILHOUETTE = "#1B1330";
export const FAIR_RED = "#D9363E";
export const FAIR_CREAM = "#F4EDE0";
export const FAIR_BULB = "#FFD27A";
export const FAIR_WOOD = "#7C4F2C";
export const FAIR_WOOD_DARK = "#4E3019";
export const FAIR_WOOD_LIGHT = "#B07A47";
export const FAIR_CHALK = "#F4EDE0";
export const FAIR_TEXT = "#F7F7F8";
const BUNTING = ["#D9363E", "#F5B82E", "#3B82F6", "#2ED3B7", "#F4EDE0"];

/** Canopy never reaches below this world line. */
export const FAIR_CANOPY_WORLD = 10;

/** Presentation clock in ms; frozen at 0 under reduced motion. */
export function fairClock(): number {
  if (reducedMotion()) return 0;
  return typeof performance === "undefined" ? 0 : performance.now();
}

export interface FairFrame {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function fairTransform(size: CanvasSize, worldW: number, worldH: number): FairFrame {
  const scale = Math.min(size.width / worldW, size.height / worldH);
  return { scale, offsetX: (size.width - worldW * scale) / 2, offsetY: (size.height - worldH * scale) / 2 };
}

function sky(ctx: CanvasRenderingContext2D, size: CanvasSize, horizon: number, frame: FairFrame, tents: readonly number[]): void {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, FAIR_SKY_TOP);
  g.addColorStop(0.6, FAIR_SKY_MID);
  g.addColorStop(1, FAIR_HORIZON);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size.width, horizon);
  // Stars in the dark upper sky, and a warm glow along the horizon.
  const s = frame.scale;
  ctx.save();
  ctx.fillStyle = FAIR_CREAM;
  for (let i = 0; i < 40; i++) {
    const h = artHash(i, 17);
    const y = ((h >>> 8) % 1000) / 1000 * horizon * 0.5;
    ctx.globalAlpha = (0.15 + (h % 5) * 0.08) * (1 - y / (horizon * 0.55));
    const d = (h % 7 === 0 ? 1.6 : 1) * Math.max(0.6, s);
    ctx.fillRect(((h >>> 18) % 1000) / 1000 * size.width, y, d, d);
  }
  ctx.globalAlpha = 1;
  const glow = ctx.createLinearGradient(0, horizon - 90 * s, 0, horizon);
  glow.addColorStop(0, "rgba(240,138,60,0)");
  glow.addColorStop(1, "rgba(255,190,110,0.28)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, horizon - 90 * s, size.width, 90 * s);
  ctx.restore();

  // Silhouettes: a big wheel and a row of tents, faint, on the horizon.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = FAIR_SILHOUETTE;
  ctx.strokeStyle = FAIR_SILHOUETTE;
  const wr = 70 * s;
  const wx = size.width * 0.76;
  const wy = horizon - wr - 18 * s;
  ctx.lineWidth = Math.max(1.5, 3 * s);
  ctx.beginPath();
  ctx.arc(wx, wy, wr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, 1.4 * s);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr);
  }
  ctx.moveTo(wx - wr * 0.5, horizon);
  ctx.lineTo(wx, wy);
  ctx.lineTo(wx + wr * 0.5, horizon);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.fillRect(wx + Math.cos(a) * wr - 4 * s, wy + Math.sin(a) * wr, 8 * s, 7 * s);
  }
  for (const t of tents) {
    const tx = size.width * t;
    const tw = 54 * s;
    const th = 34 * s;
    ctx.beginPath();
    ctx.moveTo(tx - tw / 2, horizon);
    ctx.lineTo(tx - tw / 2, horizon - th * 0.45);
    ctx.lineTo(tx, horizon - th);
    ctx.lineTo(tx + tw / 2, horizon - th * 0.45);
    ctx.lineTo(tx + tw / 2, horizon);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(tx - 0.8 * s, horizon - th - 8 * s, 1.6 * s, 8 * s);
  }
  ctx.lineWidth = Math.max(1, 1.4 * s);
  ctx.beginPath();
  ctx.arc(wx, wy, wr * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // Warm lamps round the wheel rim and over each tent door, softly lit.
  ctx.save();
  ctx.fillStyle = FAIR_BULB;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 + Math.PI / 16;
    ctx.globalAlpha = 0.16 + (i % 3) * 0.06;
    ctx.beginPath();
    ctx.arc(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr, Math.max(0.8, 1.4 * s), 0, Math.PI * 2);
    ctx.fill();
  }
  for (const t of tents) {
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.ellipse(size.width * t, horizon - 6 * s, 9 * s, 6 * s, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();

  // Bunting: one sagging line of pennants behind the play area.
  const by = frame.offsetY + 104 * s;
  const sag = 14 * s;
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = FAIR_CREAM;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, by);
  ctx.quadraticCurveTo(size.width / 2, by + sag * 2, size.width, by);
  ctx.stroke();
  const flags = Math.max(6, Math.round(size.width / (26 * s)));
  for (let i = 0; i < flags; i++) {
    const u = (i + 0.5) / flags;
    const x = u * size.width;
    const y = by + sag * 2 * 2 * u * (1 - u);
    ctx.fillStyle = BUNTING[i % BUNTING.length]!;
    ctx.beginPath();
    ctx.moveTo(x - 6 * s, y);
    ctx.lineTo(x + 6 * s, y);
    ctx.lineTo(x, y + 11 * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function counter(ctx: CanvasRenderingContext2D, size: CanvasSize, top: number, scale: number): void {
  if (top >= size.height) return;
  // Art pilot (Fairground): wooden stall counter below the play area (no collision); code art when absent.
  // The pack's wood is a square tiling texture, so it is tiled (clipped to the strip), never stretched.
  const art = artReady("fairground", "counter");
  if (art) {
    const tile = 96 * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, size.width, size.height - top);
    ctx.clip();
    for (let y = top; y < size.height; y += tile)
      for (let x = 0; x < size.width; x += tile) drawArtSprite(ctx, "fairground", "counter", x, y, tile, tile);
    ctx.restore();
  } else {
    ctx.fillStyle = FAIR_WOOD;
    ctx.fillRect(0, top, size.width, size.height - top);
  }
  ctx.fillStyle = FAIR_WOOD_LIGHT;
  ctx.fillRect(0, top, size.width, Math.max(2, 3 * scale));
  ctx.fillStyle = "rgba(255,236,200,0.45)";
  ctx.fillRect(0, top, size.width, Math.max(0.75, scale));
  ctx.fillStyle = FAIR_WOOD_DARK;
  const plank = 48 * scale;
  if (!art) for (let x = plank; x < size.width; x += plank) ctx.fillRect(Math.round(x), top + 4 * scale, 1, size.height - top);
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, top + 3 * scale, size.width, Math.max(1, 2 * scale));
  ctx.globalAlpha = 1;
  // Shadow under the lip, and brass nail heads along it.
  const shade = ctx.createLinearGradient(0, top + 3 * scale, 0, top + 14 * scale);
  shade.addColorStop(0, "rgba(30,16,6,0.35)");
  shade.addColorStop(1, "rgba(30,16,6,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, top + 3 * scale, size.width, 11 * scale);
  for (let x = 12 * scale; x < size.width; x += 40 * scale) {
    ctx.fillStyle = "#6E4A1E";
    ctx.beginPath();
    ctx.arc(x, top + 8 * scale, Math.max(1, 1.8 * scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,226,160,0.7)";
    ctx.beginPath();
    ctx.arc(x - 0.4 * scale, top + 7.6 * scale, Math.max(0.5, 0.8 * scale), 0, Math.PI * 2);
    ctx.fill();
  }
}

function canopyCloth(ctx: CanvasRenderingContext2D, width: number, bottom: number): void {
  const stripe = 18;
  const scallop = Math.min(6, bottom / 2);
  const body = bottom - scallop;
  for (let x = 0, i = 0; x < width; x += stripe, i++) {
    ctx.fillStyle = i % 2 ? FAIR_CREAM : FAIR_RED;
    ctx.fillRect(x, 0, stripe, body);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, body, stripe, scallop);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(x + stripe / 2, body, stripe / 2, scallop, 0, 0, Math.PI);
    ctx.fill();
    // Each scallop's lower curve in shadow, so the cloth reads as folded.
    ctx.strokeStyle = "rgba(60,10,10,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x + stripe / 2, body, stripe / 2 - 0.5, scallop - 0.5, 0, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();
  }
  // Cloth shading: darker at the top seam, a soft fold line in every stripe.
  if (body > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, body);
    g.addColorStop(0, "rgba(20,8,8,0.32)");
    g.addColorStop(1, "rgba(20,8,8,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, body);
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    for (let x = 0; x < width; x += stripe) ctx.fillRect(x + stripe - 1, 0, 1, body);
  }
}

function canopyBulbs(ctx: CanvasRenderingContext2D, width: number, bottom: number): void {
  const scallop = Math.min(6, bottom / 2);
  const body = bottom - scallop;
  // String of warm bulbs along the canopy, twinkling slowly.
  const t = fairClock();
  const y = Math.max(2.5, body - 3.5);
  const r = Math.min(2.4, Math.max(1.4, body / 4));
  ctx.strokeStyle = "rgba(20, 12, 8, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  for (let x = 11, i = 0; x < width; x += 22, i++) {
    const glow = t === 0 ? 1 : 0.6 + 0.4 * Math.sin(t / 900 + i * 1.7);
    ctx.globalAlpha = 0.25 * glow;
    ctx.fillStyle = FAIR_BULB;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55 + 0.45 * glow;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.8 * glow;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const layers = new Map<string, ArtCanvas | null>();

/** Device pixels per CSS px under the current transform. */
function deviceScale(ctx: CanvasRenderingContext2D): number {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  return t ? Math.max(0.5, Math.min(3, Math.hypot(t.a, t.b))) : 1;
}

/**
 * A cached canvas-size layer painted once per key by `paint` (CSS px), or
 * painted straight onto ctx where no offscreen canvas exists (SSR, Node checks).
 */
function fairLayer(ctx: CanvasRenderingContext2D, key: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void): void {
  const k = deviceScale(ctx);
  const pw = Math.max(1, Math.round(w * k));
  const ph = Math.max(1, Math.round(h * k));
  const id = `${key}@${pw}x${ph}`;
  let layer = layers.get(id);
  if (layer === undefined) {
    if (layers.size >= 8) layers.clear();
    const canvas = artCanvas(pw, ph);
    const c = canvas ? artContext(canvas) : null;
    if (canvas && c) {
      c.scale(pw / w, ph / h);
      paint(c as CanvasRenderingContext2D);
    }
    layer = canvas && c ? canvas : null;
    layers.set(id, layer);
  }
  if (layer) ctx.drawImage(layer as CanvasImageSource, 0, 0, w, h);
  else paint(ctx);
}

/**
 * Draws the whole stall and calls drawWorld under the world transform.
 * `counterWorldY` is the world line where the counter starts (at or below all
 * play geometry it touches).
 */
export function fairScreen(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  worldW: number,
  worldH: number,
  counterWorldY: number,
  drawWorld: (frame: FairFrame) => void,
  tents: readonly number[] = [0.08, 0.3, 0.52],
): FairFrame {
  const frame = fairTransform(size, worldW, worldH);
  const counterTop = frame.offsetY + counterWorldY * frame.scale;
  ctx.save();
  // Sky, silhouettes, bunting and counter are static: one cached layer per size (and counter art state).
  const art = artReady("fairground", "counter") ? 1 : 0;
  fairLayer(ctx, `stall|${counterTop.toFixed(2)}|${frame.scale.toFixed(4)}|${frame.offsetY.toFixed(2)}|${tents.join(",")}|${art}`, size.width, size.height, (c) => {
    sky(c, size, counterTop, frame, tents);
    counter(c, size, counterTop, frame.scale);
  });
  ctx.save();
  ctx.translate(frame.offsetX, frame.offsetY);
  ctx.scale(frame.scale, frame.scale);
  drawWorld(frame);
  ctx.restore();
  const canopyBottom = Math.max(frame.offsetY, FAIR_CANOPY_WORLD * frame.scale);
  if (canopyBottom > 0) {
    fairLayer(ctx, `canopy|${canopyBottom.toFixed(2)}`, size.width, Math.ceil(canopyBottom), (c) => canopyCloth(c, size.width, canopyBottom));
    canopyBulbs(ctx, size.width, canopyBottom);
  }
  ctx.restore();
  return frame;
}

/**
 * A small pennant on a pole hanging from the canopy (world coords, pole top
 * at y). Angles from hanging limp (no wind) to straight out (max wind) and
 * flutters with strength; static under reduced motion. The numeric readout
 * stays the source of truth.
 */
export function fairPennant(ctx: CanvasRenderingContext2D, x: number, y: number, wind: number, maxWind: number): void {
  const strength = Math.min(1, Math.abs(wind) / Math.max(1, maxWind));
  const dir = wind < 0 ? -1 : 1;
  const t = fairClock();
  const flutter = t === 0 ? 0 : Math.sin(t / 120) * 0.12 * strength;
  const droop = (1 - strength) * (Math.PI / 2 - 0.15) - flutter;
  const len = 22;
  const half = 5;
  ctx.save();
  ctx.strokeStyle = FAIR_CREAM;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 30);
  ctx.stroke();
  ctx.fillStyle = FAIR_CREAM;
  ctx.beginPath();
  ctx.arc(x, y + 1, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, y + 3);
  ctx.scale(dir, 1);
  ctx.rotate(droop);
  ctx.fillStyle = FAIR_RED;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const tip = t === 0 ? 0 : Math.sin(t / 90) * 1.5 * strength;
  ctx.lineTo(len, half + tip);
  ctx.lineTo(0, half * 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Per-canvas presentation memory: ms since a watched value last changed (or Infinity). */
const memos = new WeakMap<CanvasRenderingContext2D, Map<string, { value: number; at: number }>>();
export function fairChangeAge(ctx: CanvasRenderingContext2D, name: string, value: number): number {
  let map = memos.get(ctx);
  if (!map) memos.set(ctx, (map = new Map()));
  const now = typeof performance === "undefined" ? 0 : performance.now();
  const old = map.get(name);
  if (!old) {
    map.set(name, { value, at: -Infinity });
    return Infinity;
  }
  if (old.value !== value) {
    const grew = value > old.value;
    old.value = value;
    old.at = grew ? now : -Infinity;
  }
  return now - old.at;
}

/**
 * Arena scene (15 Oct 2026, display only; arenaScene.renderer.ts) for the fairground
 * stalls: beside the world, more evening sky down to the counter line; below it, the
 * stall counter's front runs on (the same wood and plank lines, or the same tiled art)
 * to a kick board, then the fairground's trodden floor under the bulbs' warm light, out
 * to the arena box's edges. No targets, bunting, pennants or anything that moves.
 */
export function fairArenaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView, counterWorldY: number): void {
  const art = artReady("fairground", "counter");
  const wood = (x: number, y: number, w: number, h: number) => {
    if (h <= 0 || w <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (art) {
      const tile = 96;
      const x0 = Math.floor(x / tile) * tile;
      const y0 = counterWorldY + Math.floor((y - counterWorldY) / tile) * tile;
      for (let ty = y0; ty < y + h; ty += tile)
        for (let tx = x0; tx < x + w; tx += tile) drawArtSprite(ctx, "fairground", "counter", tx, ty, tile, tile);
    } else {
      ctx.fillStyle = FAIR_WOOD;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = FAIR_WOOD_DARK;
      const lineW = 1 / Math.max(0.01, view.scale);
      for (let px = Math.ceil(x / 48) * 48; px < x + w; px += 48) if (px > 0) ctx.fillRect(px, Math.max(y, counterWorldY + 4), lineW, h);
    }
    ctx.restore();
  };
  for (const side of sceneSides(view)) {
    const skyH = Math.max(0, Math.min(side.h, counterWorldY - side.y));
    if (skyH > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, counterWorldY);
      g.addColorStop(0, FAIR_SKY_TOP);
      g.addColorStop(0.6, FAIR_SKY_MID);
      g.addColorStop(1, FAIR_HORIZON);
      ctx.fillStyle = g;
      ctx.fillRect(side.x, side.y, side.w, skyH);
    }
    wood(side.x, counterWorldY, side.w, side.y + side.h - counterWorldY);
  }
  const below = sceneBelow(view);
  if (!below) return;
  // The counter's front panel, then its kick board.
  const front = Math.min(view.bottom, Math.max(below.y, counterWorldY + 72));
  wood(below.x, below.y, below.w, front - below.y);
  if (front >= view.bottom) return;
  const shade = ctx.createLinearGradient(0, front - 16, 0, front);
  shade.addColorStop(0, "rgba(30,16,6,0)");
  shade.addColorStop(1, "rgba(30,16,6,0.4)");
  ctx.fillStyle = shade;
  ctx.fillRect(below.x, Math.max(below.y, front - 16), below.w, front - Math.max(below.y, front - 16));
  const kick = Math.min(6, view.bottom - front);
  ctx.fillStyle = FAIR_WOOD_DARK;
  ctx.fillRect(below.x, front, below.w, kick);
  const floor = { x: below.x, y: front + kick, w: below.w, h: view.bottom - front - kick };
  if (floor.h <= 0) return;
  // The trodden floor: dark earth and sawdust, lit warm near the stall.
  sceneFill(ctx, floor, floor.y, floor.y + Math.max(1, floor.h), [[0, "#3A2A1F"], [1, "#1E1612"]]);
  const glow = ctx.createLinearGradient(0, floor.y, 0, floor.y + 40);
  glow.addColorStop(0, "rgba(30,14,4,0.55)");
  glow.addColorStop(1, "rgba(30,14,4,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(floor.x, floor.y, floor.w, Math.min(40, floor.h));
  ctx.save();
  for (let k = 0; k < 3; k++) {
    const cx = floor.x + floor.w * (0.2 + k * 0.3);
    const pool = ctx.createRadialGradient(cx, floor.y + floor.h * 0.55, 4, cx, floor.y + floor.h * 0.55, Math.max(40, floor.w * 0.28));
    pool.addColorStop(0, "rgba(255,190,110,0.10)");
    pool.addColorStop(1, "rgba(255,190,110,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(floor.x, floor.y, floor.w, floor.h);
  }
  const specks = Math.round((floor.w * floor.h) / 90);
  for (let i = 0; i < specks; i++) {
    const h = artHash(i, 733);
    ctx.globalAlpha = 0.12 + (h % 4) * 0.04;
    ctx.fillStyle = h % 3 === 0 ? FAIR_BULB : FAIR_CREAM;
    ctx.fillRect(floor.x + ((h >>> 4) % 10007) / 10007 * floor.w, floor.y + ((h >>> 16) % 9973) / 9973 * floor.h, 1.2, 0.8);
  }
  ctx.restore();
}
