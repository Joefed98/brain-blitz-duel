/**
 * Bubble Pop art: an underwater reef in the High Seas world. Render only.
 * Uses the sim's own stretched world transform (scaleX/scaleY) and draws every
 * bubble at the sim's radius on its sim cell; rock, kelp and coral sit only in
 * the side wall margins and above the sim ceiling line.
 */
import type { CanvasSize } from "./engine";
import { artReady, drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { BUBBLE_FX } from "./arcadeFxGames.renderer";
import { successHud, successFrame } from './success.renderer';
import {
  bubbleGame,
  bubCellX,
  bubCellY,
  bubColour,
  bubNextColour,
  bubRowCols,
  BUB_COLS,
  BUB_HUD_H,
  BUB_MAX_ROWS,
  BUB_R,
  BUB_ROW_H,
  BUB_SHOOTER_LINE,
  BUB_SHOOTER_X,
  BUB_SHOOTER_Y,
  BUB_TOP,
  BUB_WALL,
  BUB_WORLD_H,
  BUB_WORLD_W,
  type BubState,
} from "./bubble";
import { reducedMotion } from "./art.renderer";
import {
  seaClock,
  seaCoral,
  seaDeviceScale,
  seaKelp,
  seaNow,
  seaSprite,
  seaUnderwater,
  SEA_BRASS,
  SEA_BRASS_DARK,
  SEA_GOLD,
  SEA_TEXT,
} from "./seas.renderer";

export type BubCreature = "crab" | "starfish" | "fish" | "jellyfish" | "shell";
/** Colour value 1…5 → creature, one-to-one. */
export const BUB_CREATURES: readonly BubCreature[] = ["crab", "starfish", "fish", "jellyfish", "shell"];
export function bubCreature(value: number): BubCreature {
  return BUB_CREATURES[(value - 1) % BUB_CREATURES.length] ?? "fish";
}

/** True once all five creature sprites are ready; art is all five or none. */
function creatureArtReady(): boolean {
  return BUB_CREATURES.every((k) => artReady("underwater", k));
}

/** Draws a creature centred at (cx, cy), fitting radius r. */
export function drawCreature(c: CanvasRenderingContext2D, kind: BubCreature, cx: number, cy: number, r: number): void {
  // Art pilot (Underwater): creature sprites inside the bubble (the bubble circle stays the drawn bound),
  // only once all five are ready so art and drawn symbols never mix.
  if (creatureArtReady() && drawArtSprite(c, "underwater", kind, cx - r * 0.62, cy - r * 0.62, r * 1.24, r * 1.24)) return;
  c.save();
  c.fillStyle = "rgba(8,20,36,0.82)";
  c.strokeStyle = "rgba(8,20,36,0.82)";
  c.lineWidth = Math.max(1, r * 0.13);
  c.lineCap = "round";
  switch (kind) {
    case "fish":
      c.beginPath();
      c.ellipse(cx - r * 0.12, cy, r * 0.55, r * 0.34, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(cx + r * 0.35, cy);
      c.lineTo(cx + r * 0.78, cy - r * 0.34);
      c.lineTo(cx + r * 0.78, cy + r * 0.34);
      c.closePath();
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.beginPath();
      c.arc(cx - r * 0.38, cy - r * 0.07, r * 0.09, 0, Math.PI * 2);
      c.fill();
      break;
    case "starfish":
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const d = i % 2 === 0 ? r * 0.72 : r * 0.3;
        c.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
      }
      c.closePath();
      c.fill();
      break;
    case "shell":
      c.beginPath();
      c.moveTo(cx, cy + r * 0.6);
      c.arc(cx, cy + r * 0.05, r * 0.62, Math.PI * 1.05, Math.PI * 1.95);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.55)";
      c.lineWidth = Math.max(0.8, r * 0.07);
      c.beginPath();
      for (const dx of [-0.36, -0.12, 0.12, 0.36]) {
        c.moveTo(cx, cy + r * 0.55);
        c.lineTo(cx + dx * r * 1.4, cy - r * 0.38);
      }
      c.stroke();
      break;
    case "crab":
      c.beginPath();
      c.ellipse(cx, cy + r * 0.1, r * 0.42, r * 0.28, 0, 0, Math.PI * 2);
      c.fill();
      for (const side of [-1, 1]) {
        c.beginPath();
        c.arc(cx + side * r * 0.55, cy - r * 0.32, r * 0.17, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(cx + side * r * 0.3, cy);
        c.lineTo(cx + side * r * 0.52, cy - r * 0.22);
        for (const k of [0, 1, 2]) {
          c.moveTo(cx + side * r * 0.3, cy + r * (0.12 + k * 0.1));
          c.lineTo(cx + side * r * 0.66, cy + r * (0.26 + k * 0.14));
        }
        c.stroke();
      }
      break;
    case "jellyfish":
      c.beginPath();
      c.arc(cx, cy - r * 0.05, r * 0.5, Math.PI, 0);
      c.closePath();
      c.fill();
      c.beginPath();
      for (const dx of [-0.32, -0.1, 0.12, 0.34]) {
        c.moveTo(cx + dx * r, cy);
        c.quadraticCurveTo(cx + (dx - 0.12) * r, cy + r * 0.32, cx + dx * r, cy + r * 0.62);
      }
      c.stroke();
      break;
  }
  c.restore();
}

function paintBubble(value: number) {
  return (c: CanvasRenderingContext2D, size: number) => {
    const r = size / 2;
    const colour = bubColour(value);
    const g = c.createRadialGradient(r * 0.75, r * 0.7, r * 0.1, r, r, r);
    g.addColorStop(0, colour + "B0");
    g.addColorStop(0.8, colour + "D8");
    g.addColorStop(1, colour);
    c.fillStyle = g;
    c.beginPath();
    c.arc(r, r, r - 0.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.55)";
    c.lineWidth = Math.max(1, r * 0.08);
    c.beginPath();
    c.arc(r, r, r - c.lineWidth, 0, Math.PI * 2);
    c.stroke();
    drawCreature(c, bubCreature(value), r, r + r * 0.04, r);
    // Rim highlight.
    c.strokeStyle = "rgba(255,255,255,0.85)";
    c.lineWidth = Math.max(1, r * 0.12);
    c.lineCap = "round";
    c.beginPath();
    c.arc(r, r, r * 0.74, Math.PI * 1.1, Math.PI * 1.45);
    c.stroke();
  };
}

/** Blits a cached bubble sprite at CSS-px centre with CSS-px radius. */
function blitBubble(ctx: CanvasRenderingContext2D, value: number, x: number, y: number, radius: number, dpr: number, alpha = 1): void {
  const sprite = seaSprite(`bub${value}${creatureArtReady() ? "-art" : ""}`, radius * 2 * dpr, paintBubble(value));
  if (!sprite) return;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(sprite as CanvasImageSource, x - radius, y - radius, radius * 2, radius * 2);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

interface Fx { kind: 0 | 1; value: number; x: number; y: number; born: number; seed: number }
interface Memo { tick: number; grid: number[]; descents: number; fx: Fx[] }
const memos = new WeakMap<object, Memo>();
const FX_CAP = 4;

function memoFor(ctx: CanvasRenderingContext2D, state: BubState): Memo {
  let m = memos.get(ctx);
  if (!m || state.tick < m.tick) {
    m = { tick: state.tick, grid: [...state.grid], descents: state.descents, fx: [] };
    memos.set(ctx, m);
  }
  return m;
}

function trackRemovals(m: Memo, state: BubState, colour: number): void {
  if (state.tick === m.tick) return;
  const now = seaNow();
  if (state.popped + state.dropped > 0 && state.grid !== m.grid) {
    for (let row = 0; row < BUB_MAX_ROWS; row++) {
      for (let col = 0; col < bubRowCols(row); col++) {
        const i = row * BUB_COLS + col;
        const was = m.grid[i]!;
        if (!was || state.grid[i]) continue;
        if (m.fx.length >= FX_CAP) m.fx.shift();
        m.fx.push({
          kind: was === colour ? 0 : 1,
          value: was,
          x: bubCellX(row, col),
          y: bubCellY(row, m.descents),
          born: now,
          seed: i * 7919,
        });
      }
    }
  }
  m.tick = state.tick;
  m.grid = [...state.grid];
  m.descents = state.descents;
}

let lastFlight = 0;

/** The game's drawing through the shared success layer (presentation only). */
export function drawBubbleArt(ctx: CanvasRenderingContext2D, state: BubState, size: CanvasSize): void {
  arcadeFx(ctx, BUBBLE_FX, state, () => drawBubbleArtWorld(ctx, state, size), size);
}

function drawBubbleArtWorld(ctx: CanvasRenderingContext2D, state: BubState, size: CanvasSize): void {
  const sx = size.width / BUB_WORLD_W;
  const sy = size.height / BUB_WORLD_H;
  const rs = Math.min(sx, sy);
  const dpr = seaDeviceScale(ctx);
  const t = seaClock();
  const X = (x: number) => x * sx;
  const Y = (y: number) => y * sy;

  ctx.save();
  seaUnderwater(ctx, size.width, size.height);

  // Rising background bubbles (margins and open water, behind everything).
  if (!reducedMotion()) {
    ctx.fillStyle = "rgba(220,240,255,0.22)";
    for (let i = 0; i < 10; i++) {
      const speed = 18 + (i * 37) % 23;
      const yy = size.height - ((t * speed + i * 97) % (size.height + 20));
      const xx = ((i * 131) % 100) / 100 * size.width + Math.sin(t + i) * 4;
      ctx.beginPath();
      ctx.arc(xx, yy, 1.2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Kelp and coral in the side margins only.
  const margin = X(BUB_WALL);
  const floor = size.height;
  seaKelp(ctx, margin * 0.45, floor, size.height * 0.42, Math.max(2, margin * 0.16), 0);
  seaKelp(ctx, size.width - margin * 0.5, floor, size.height * 0.34, Math.max(2, margin * 0.16), 2.1);
  seaCoral(ctx, margin * 0.55, floor, margin * 0.8, "#E0705A");
  seaCoral(ctx, size.width - margin * 0.45, floor, margin * 0.7, "#E58FB4");

  // Rock ledge from the top down to the sim ceiling line.
  const ceiling = Y(BUB_TOP + state.descents * BUB_ROW_H);
  ctx.fillStyle = "#2A2F38";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size.width, 0);
  ctx.lineTo(size.width, ceiling);
  const bumps = 14;
  for (let i = bumps; i >= 0; i--) {
    const x = (i / bumps) * size.width;
    const dip = (((i * 53) % 7) / 7) * Y(5);
    ctx.lineTo(x, ceiling - dip);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3B424D";
  for (let i = 0; i < 9; i++) {
    const x = ((i * 0.13 + 0.05) % 1) * size.width;
    const y = (((i * 41) % 10) / 10) * Math.max(2, ceiling - Y(10)) + Y(4);
    ctx.beginPath();
    ctx.ellipse(x, y, X(14), Y(5), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shooter line, faint.
  ctx.strokeStyle = "rgba(245,197,66,0.28)";
  ctx.setLineDash([6 * rs, 6 * rs]);
  ctx.lineWidth = Math.max(1, 1.5 * rs);
  ctx.beginPath();
  ctx.moveTo(X(BUB_WALL), Y(BUB_SHOOTER_LINE));
  ctx.lineTo(X(BUB_WORLD_W - BUB_WALL), Y(BUB_SHOOTER_LINE));
  ctx.stroke();
  ctx.setLineDash([]);

  // Field.
  const radius = (BUB_R - 1) * rs;
  for (let row = 0; row < BUB_MAX_ROWS; row++) {
    for (let col = 0; col < bubRowCols(row); col++) {
      const value = state.grid[row * BUB_COLS + col]!;
      if (!value) continue;
      blitBubble(ctx, value, X(bubCellX(row, col)), Y(bubCellY(row, state.descents)), radius, dpr);
    }
  }

  // Pops and drops (presentation memory only).
  const m = memoFor(ctx, state);
  if (state.flightColour) lastFlight = state.flightColour;
  trackRemovals(m, state, lastFlight);
  const now = seaNow();
  const still = reducedMotion();
  m.fx = m.fx.filter((f) => now - f.born < (still ? 160 : 480));
  for (const f of m.fx) {
    const age = (now - f.born) / 1000;
    if (f.kind === 0) {
      const k = age / (still ? 0.16 : 0.48);
      // Symbol drifts up and fades; a stream of tiny bubbles.
      ctx.save();
      ctx.globalAlpha = 1 - k;
      drawCreature(ctx, 'fish', X(f.x), Y(f.y) - (still ? 0 : age * 60 * rs), radius * 0.3);
      ctx.fillStyle = "rgba(230,245,255,0.85)";
      if (!still) {
        for (let i = 0; i < 3; i++) {
          const a = ((f.seed + i * 1301) % 628) / 100;
          ctx.beginPath();
          ctx.arc(
            X(f.x) + Math.cos(a) * radius * (0.3 + k),
            Y(f.y) - age * (70 + i * 14) * rs,
            Math.max(0.8, (1.6 + (i % 2)) * rs),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      ctx.restore();
    } else {
      const k = age / (still ? 0.16 : 0.48);
      blitBubble(ctx, f.value, X(f.x), Y(f.y) + (still ? 0 : age * age * 520 * rs), radius, dpr, 1 - k);
    }
  }

  // Diver's bubble gun.
  const gx = X(BUB_SHOOTER_X);
  const gy = Y(BUB_SHOOTER_Y);
  ctx.fillStyle = SEA_BRASS_DARK;
  ctx.beginPath();
  ctx.roundRect(gx - 26 * rs, gy + 12 * sy, 52 * rs, 14 * sy, 5 * rs);
  ctx.fill();
  ctx.fillStyle = SEA_BRASS;
  ctx.beginPath();
  ctx.roundRect(gx - 22 * rs, gy + 14 * sy, 44 * rs, 9 * sy, 4 * rs);
  ctx.fill();
  ctx.strokeStyle = SEA_BRASS;
  ctx.lineWidth = Math.max(1.5, 3 * rs);
  ctx.beginPath();
  ctx.arc(gx, gy, (BUB_R + 2) * rs, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  const holding = bubNextColour(state, 0);
  if (holding) blitBubble(ctx, holding, gx, gy, radius, dpr);

  // Loaded queue: the next three in a brass magazine beside the gun.
  const qy = gy + 19 * sy;
  ctx.fillStyle = "rgba(10,30,52,0.7)";
  ctx.beginPath();
  ctx.roundRect(gx + 30 * rs, qy - 9 * rs, 68 * rs, 18 * rs, 9 * rs);
  ctx.fill();
  ctx.strokeStyle = SEA_BRASS;
  ctx.lineWidth = Math.max(1, 1.5 * rs);
  ctx.stroke();
  for (let ahead = 1; ahead <= 3; ahead++) {
    const value = bubNextColour(state, ahead);
    if (value) blitBubble(ctx, value, gx + (30 + ahead * 20 - 6) * rs, qy, 8 * rs, dpr);
  }

  if (state.flightColour) blitBubble(ctx, state.flightColour, X(state.x / 256), Y(state.y / 256), radius, dpr);

  // HUD readout on the rock.
  ctx.fillStyle = SEA_GOLD;
  ctx.font = `bold ${Math.round(18 * rs)}px ui-monospace, monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  successHud(ctx,'bubble',state.tick,14,18,()=>{ctx.fillText(`Popped ${state.popped}`, X(14), Y(BUB_HUD_H * 0.36));});
  const pop=m.fx[m.fx.length-1];
  successFrame(ctx,{id:'bubble',tick:state.tick,count:state.popped,colour:SEA_GOLD,width:size.width,height:size.height,point:{x:X(pop?.x??BUB_SHOOTER_X),y:Y(pop?.y??BUB_TOP),shape:'fish'},hud:{x:X(14),y:Y(8),text:`Popped ${state.popped}`}});
  successFrame(ctx,{id:'bubble-drop',tick:state.tick,count:Math.floor(state.dropped/5),colour:SEA_TEXT,width:size.width,height:size.height,point:{x:X(pop?.x??BUB_SHOOTER_X),y:Y(pop?.y??BUB_TOP),shape:'bubble'}});
  ctx.fillStyle = SEA_TEXT;
  ctx.restore();
}

/** Faint dotted bubble trail for the current aim; same path maths the stage used. */
export function drawBubbleAimTrail(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  shot: { vx: number; vy: number } | null,
  state: BubState,
): void {
  if (!shot || state.flightColour !== 0) return;
  const sx = size.width / BUB_WORLD_W;
  const sy = size.height / BUB_WORLD_H;
  const rs = Math.min(sx, sy);
  const left = BUB_WALL + BUB_R;
  const right = BUB_WORLD_W - BUB_WALL - BUB_R;
  let x = BUB_SHOOTER_X;
  let y = BUB_SHOOTER_Y;
  let vx = shot.vx / 64;
  const vy = shot.vy / 64;
  let travelled = 0;
  let next = 10;
  ctx.save();
  ctx.fillStyle = "rgba(225,242,255,0.5)";
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = Math.max(0.8, rs);
  const stepLen = Math.hypot(vx, vy);
  for (let i = 0; i < 160 && y > 0; i++) {
    x += vx;
    y += vy;
    if (x < left) {
      x = left + (left - x);
      vx = -vx;
    } else if (x > right) {
      x = right - (x - right);
      vx = -vx;
    }
    travelled += stepLen;
    if (travelled >= next) {
      next += 11;
      const r = Math.max(1.2, (2.6 - i * 0.004) * rs);
      ctx.beginPath();
      ctx.arc(x * sx, y * sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export const bubbleArtGame = { ...bubbleGame, draw: drawBubbleArt };
