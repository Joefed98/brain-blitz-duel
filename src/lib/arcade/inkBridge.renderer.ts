/**
 * Ink Bridge art (Real World riverside). Render only: reads InkState, never
 * mutates it. The timber bridge follows the sim's segments exactly, the drop
 * is the sim's 7 px ball, the bucket and rim caps are the sim's bucket geometry.
 * Water, banks, pier and raft sit below every bucket (y ≥ bucket bottom).
 */
import type { CanvasSize } from "./engine";
import { inkBridgeGame, inkBucketX, inkBudget, INK_BLOCK_H, INK_BUCKET_H, INK_BUCKET_W, INK_FAILS, INK_LEVELS, INK_WORLD_H, INK_WORLD_W, type InkState } from "./inkBridge";
import { artHash } from "./art.renderer";
import {
  realClock,
  realNightSky,
  REAL_NIGHT_BG,
  REAL_NIGHT_TEXT,
  REAL_MOON,
  REAL_LAMP,
  REAL_LAMP_WASH,
  REAL_INK,
  REAL_RED,
  REAL_SHADOW,
  REAL_WATER,
  REAL_WATER_DARK,
  REAL_WOOD,
  REAL_WOOD_DARK,
  REAL_WOOD_LIGHT,
} from "./realworld.renderer";

/* Mirrors of the sim's private constants (inkBridge.ts). */
const FP = 256;
const BALL_R = 7;
const SPOUT_Y = 50;
const RIM_R = 4;
const WATER_Y = 596;
const TIN = "#C5B598";
const TIN_DARK = "#8F7D65";
const DROP = "#3D8FE0";
const CLOUD_BASE = "#D8E3EB";
const CLOUD_TOP = "#F2F7FA";
const CLOUD_EDGE = "#F3F3E4";
const NIGHT_WATER = "#243F59";
const NIGHT_STONE = "#404C55";
const NIGHT_GRASS = "#364A3C";
const NIGHT_GRASS_DARK = "#25352E";
const MOON_RIPPLE = "rgba(227,233,207,0.32)";

function drawRiver(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.fillStyle = NIGHT_WATER;
  ctx.fillRect(0, WATER_Y, INK_WORLD_W, INK_WORLD_H - WATER_Y);
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 3; row++) {
    const y = WATER_Y + 5 + row * 7;
    ctx.beginPath();
    for (let x = 0; x <= INK_WORLD_W; x += 6) {
      const yy = y + Math.sin(x * 0.06 + t * 1.2 + row * 1.7) * 1.4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = MOON_RIPPLE;
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 6; row++) {
    const half = 8 + row * 3;
    const x = INK_WORLD_W * 0.84 + Math.sin(t * 0.9 + row * 1.7) * 3;
    ctx.beginPath();
    ctx.moveTo(x - half, WATER_Y + 3 + row * 3.5);
    ctx.lineTo(x + half, WATER_Y + 3 + row * 3.5);
    ctx.stroke();
  }
  // Grass-and-stone banks at each edge, in the river band only.
  for (const [x0, w] of [[0, 34], [INK_WORLD_W - 34, 34]] as const) {
    ctx.fillStyle = NIGHT_STONE;
    ctx.fillRect(x0, WATER_Y, w, INK_WORLD_H - WATER_Y);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (let k = 0; k < 6; k++) {
      const h = artHash(k, x0);
      ctx.fillRect(x0 + (h % (w - 8)), WATER_Y + 6 + ((h >>> 6) % 16), 8, 1);
    }
    ctx.fillStyle = NIGHT_GRASS;
    ctx.fillRect(x0, WATER_Y - 3, w, 5);
    ctx.fillStyle = NIGHT_GRASS_DARK;
    ctx.fillRect(x0, WATER_Y + 2, w, 1);
  }
}

function drawDispenser(ctx: CanvasRenderingContext2D, x: number): void {
  // Wooden post arm from the top edge, with a tin bucket tipped over the drop (y 26–41).
  ctx.fillStyle = REAL_WOOD;
  ctx.fillRect(x - 16, 27, 32, 3);
  ctx.fillStyle = REAL_WOOD_DARK;
  ctx.fillRect(x - 16, 29, 32, 1);
  ctx.fillStyle = REAL_LAMP_WASH;
  ctx.beginPath();
  ctx.moveTo(x + 14, 30);
  ctx.lineTo(INK_WORLD_W, WATER_Y);
  ctx.lineTo(0, WATER_Y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = REAL_LAMP;
  ctx.fillRect(x + 9, 29, 10, 4);
  ctx.save();
  ctx.translate(x, 36);
  ctx.rotate(0.35);
  ctx.fillStyle = TIN;
  ctx.beginPath();
  ctx.moveTo(-9, -5);
  ctx.lineTo(9, -5);
  ctx.lineTo(6, 6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = TIN_DARK;
  ctx.fillRect(-9, -5, 18, 2);
  ctx.fillRect(-5, 0, 10, 1);
  ctx.restore();
}

function drawBucket(ctx: CanvasRenderingContext2D, bx: number, by: number, flash: boolean, raft: boolean): void {
  const left = bx - INK_BUCKET_W / 2;
  const bottom = by + INK_BUCKET_H;
  if (raft) {
    ctx.fillStyle = REAL_WOOD_DARK;
    ctx.fillRect(left, bottom, INK_BUCKET_W, 6);
    ctx.fillStyle = REAL_WOOD;
    for (let k = 0; k < 4; k++) ctx.fillRect(left + k * 16 + 1, bottom, 14, 5);
  } else {
    // Stone pier under the bucket down to the river, narrower than the bucket.
    ctx.fillStyle = NIGHT_STONE;
    ctx.fillRect(left + 8, bottom, INK_BUCKET_W - 16, WATER_Y - bottom);
    ctx.fillStyle = NIGHT_GRASS;
    ctx.fillRect(left + 4, bottom, INK_BUCKET_W - 8, 4);
  }
  ctx.fillStyle = REAL_SHADOW;
  ctx.fillRect(left + 3, by + 3, INK_BUCKET_W - 2, INK_BUCKET_H - 2);
  ctx.fillStyle = flash ? "#E8F6FF" : TIN;
  ctx.fillRect(left, by, INK_BUCKET_W, INK_BUCKET_H);
  ctx.fillStyle = "rgba(78,155,214,0.45)";
  ctx.fillRect(left + 3, by + INK_BUCKET_H - 10, INK_BUCKET_W - 6, 8);
  ctx.fillStyle = TIN_DARK;
  for (let k = 1; k < 3; k++) ctx.fillRect(left, by + (INK_BUCKET_H * k) / 3, INK_BUCKET_W, 1.5);
  ctx.fillRect(left, by, 3, INK_BUCKET_H);
  ctx.fillRect(left + INK_BUCKET_W - 3, by, 3, INK_BUCKET_H);
  ctx.fillRect(left + 2, by - 2, INK_BUCKET_W - 4, 3);
  ctx.fillStyle = TIN_DARK;
  for (const cx of [left, left + INK_BUCKET_W]) {
    ctx.beginPath();
    ctx.arc(cx, by, RIM_R, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.arc(x - 2.4, y - 2.4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawInkBridgeArt(ctx: CanvasRenderingContext2D, state: InkState, size: CanvasSize): void {
  const scale = Math.min(size.width / INK_WORLD_W, size.height / INK_WORLD_H);
  const ox = (size.width - INK_WORLD_W * scale) / 2;
  const oy = (size.height - INK_WORLD_H * scale) / 2;
  const t = realClock();
  ctx.save();
  realNightSky(ctx, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  const tick = state.tick;
  const lvl = state.list[Math.min(state.level, state.list.length - 1)]!;

  // Distant plane with a navigation blink; static under reduced motion.
  const birdX = (80 + t * 5) % (INK_WORLD_W + 30) - 15;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = REAL_NIGHT_TEXT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(birdX - 7, 88);
  ctx.lineTo(birdX + 7, 88);
  ctx.moveTo(birdX, 84);
  ctx.lineTo(birdX, 91);
  ctx.stroke();
  ctx.globalAlpha = t === 0 || Math.floor(t * 2) % 4 === 0 ? 0.6 : 0.12;
  ctx.fillStyle = REAL_LAMP;
  ctx.fillRect(birdX + 6, 87, 1.5, 1.5);
  ctx.restore();
  drawRiver(ctx, t);
  drawDispenser(ctx, lvl.spoutX);

  // Thin clouds fill the exact platform rectangle, with a firm straight top.
  for (const b of lvl.blocks) {
    const w = b.x1 - b.x0;
    ctx.fillStyle = CLOUD_BASE;
    ctx.fillRect(b.x0, b.y, b.x1 - b.x0, INK_BLOCK_H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x0, b.y, w, INK_BLOCK_H);
    ctx.clip();
    ctx.fillStyle = CLOUD_TOP;
    const puffs = Math.max(2, Math.ceil(w / 16));
    for (let i = 0; i < puffs; i++) {
      ctx.beginPath();
      ctx.ellipse(b.x0 + (i + 0.5) * w / puffs, b.y + INK_BLOCK_H * 0.45, w / puffs * 0.7, INK_BLOCK_H * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = CLOUD_EDGE;
    ctx.fillRect(b.x0, b.y, w, 1);
  }

  const bx = inkBucketX(lvl, tick);
  drawBucket(ctx, bx, lvl.bucketY, tick - state.flashTick < 20 && state.flashKind === 1, lvl.slideAmp !== 0);

  // Timber bridge on the sim's segments.
  ctx.lineCap = "round";
  for (const seg of state.segs) {
    ctx.beginPath();
    ctx.moveTo(seg.x0, seg.y0);
    ctx.lineTo(seg.x1, seg.y1);
    ctx.strokeStyle = REAL_WOOD_DARK;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = REAL_WOOD;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = REAL_WOOD_LIGHT;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawDrop(ctx, state.ball.x / FP, state.ball.y / FP, DROP);

  const failAge = tick - state.flashTick;
  if (state.failedBall && failAge < 30 && state.flashKind === 2) {
    drawDrop(ctx, state.failedBall.x / FP, state.failedBall.y / FP, REAL_WATER_DARK, 1 - failAge / 30);
  }
  if (failAge < 30 && state.flashKind === 2) {
    ctx.fillStyle = REAL_RED;
    ctx.globalAlpha = 1 - failAge / 30;
    ctx.font = "bold 22px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Missed — try again", INK_WORLD_W / 2, 300);
    ctx.globalAlpha = 1;
  }

  const budget = inkBudget(state.level) * FP;
  ctx.strokeStyle = REAL_WOOD_DARK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(INK_WORLD_W - 120, 12, 104, 12);
  ctx.fillStyle = REAL_WOOD;
  ctx.fillRect(INK_WORLD_W - 118, 14, (100 * state.ink) / budget, 8);
  for (let i = 0; i < INK_FAILS; i++) {
    ctx.fillStyle = i < state.fails ? REAL_RED : "rgba(30,38,48,0.2)";
    ctx.beginPath();
    ctx.arc(INK_WORLD_W - 162 + i * 14, 18, 5, 0, Math.PI * 2);
    ctx.fill();
  }
   ctx.fillStyle = REAL_NIGHT_TEXT;
  ctx.font = "bold 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Level ${Math.min(state.level + 1, INK_LEVELS)} / ${INK_LEVELS}`, 12, 22);
  ctx.restore();
}

void SPOUT_Y;
export const inkBridgeArtGame = { ...inkBridgeGame, draw: drawInkBridgeArt };
export const INK_ART_BG = REAL_NIGHT_BG;
