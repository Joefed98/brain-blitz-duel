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
import { reducedMotion } from "./art.renderer";

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

  // Silhouettes: a big wheel and a row of tents, faint, on the horizon.
  const s = frame.scale;
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
  ctx.fillStyle = FAIR_WOOD;
  ctx.fillRect(0, top, size.width, size.height - top);
  ctx.fillStyle = FAIR_WOOD_LIGHT;
  ctx.fillRect(0, top, size.width, Math.max(2, 3 * scale));
  ctx.fillStyle = FAIR_WOOD_DARK;
  const plank = 48 * scale;
  for (let x = plank; x < size.width; x += plank) ctx.fillRect(Math.round(x), top + 4 * scale, 1, size.height - top);
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, top + 3 * scale, size.width, Math.max(1, 2 * scale));
  ctx.globalAlpha = 1;
}

function canopy(ctx: CanvasRenderingContext2D, size: CanvasSize, bottom: number): void {
  const stripe = 18;
  const scallop = Math.min(6, bottom / 2);
  const body = bottom - scallop;
  for (let x = 0, i = 0; x < size.width; x += stripe, i++) {
    ctx.fillStyle = i % 2 ? FAIR_CREAM : FAIR_RED;
    ctx.fillRect(x, 0, stripe, body);
    ctx.beginPath();
    ctx.arc(x + stripe / 2, body, stripe / 2, 0, Math.PI);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, body, stripe, scallop);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(x + stripe / 2, body, stripe / 2, scallop, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  }
  // String of warm bulbs along the canopy, twinkling slowly.
  const t = fairClock();
  const y = Math.max(2.5, body - 3.5);
  const r = Math.min(2.4, Math.max(1.4, body / 4));
  ctx.strokeStyle = "rgba(20, 12, 8, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(size.width, y);
  ctx.stroke();
  for (let x = 11, i = 0; x < size.width; x += 22, i++) {
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
  }
  ctx.globalAlpha = 1;
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
  sky(ctx, size, counterTop, frame, tents);
  counter(ctx, size, counterTop, frame.scale);
  ctx.save();
  ctx.translate(frame.offsetX, frame.offsetY);
  ctx.scale(frame.scale, frame.scale);
  drawWorld(frame);
  ctx.restore();
  canopy(ctx, size, Math.max(frame.offsetY, FAIR_CANOPY_WORLD * frame.scale));
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
