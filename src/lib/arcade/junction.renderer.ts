/**
 * Junction art (Real World). Render only: reads JuncState, never mutates it.
 * Cars fill exactly the sim's 41×24 car box from juncCarPose; road geometry
 * mirrors the sim's private HALF/LANE constants.
 */
import type { CanvasSize } from "./engine";
import {
  juncCarPose,
  junctionGame,
  juncSpeed,
  JUNC_CX,
  JUNC_CY,
  JUNC_INDICATE_TICKS,
  JUNC_LIGHT_AT,
  JUNC_WORLD_H,
  JUNC_WORLD_W,
  type JuncCar,
  type JuncState,
} from "./junction";
import { CROSS_BLOCK_COLOURS } from "./cross";
import {
  realMemo,
  realNow,
  realTree,
  realVehicle,
  REAL_ASPHALT,
  REAL_GRASS,
  REAL_GRASS_DARK,
  REAL_INK,
  REAL_KERB,
  REAL_MARK,
  REAL_RED,
  REAL_SHADOW,
} from "./realworld.renderer";
import { artHash } from "./art.renderer";

/* Mirrors of the sim's private constants (junction.ts). */
const FP = 256;
const HALF = 31;
const CAR_W = 24;
const CAR_PX = 41;
const SPAWN_OUT = 20;
const STOP_V = (JUNC_CY - HALF + SPAWN_OUT) * FP;
const STOP_H = (JUNC_CX - HALF + SPAWN_OUT) * FP;
const STOP = [STOP_V, STOP_V, STOP_H, STOP_H];
const FADE_TICKS = 30;

/** Daylight versions of the car colours, taken from Cross's palette. */
const CAR_COLOURS = [CROSS_BLOCK_COLOURS[2], CROSS_BLOCK_COLOURS[4], CROSS_BLOCK_COLOURS[1], CROSS_BLOCK_COLOURS[5]];

interface Ghost { x: number; y: number; dx: number; dy: number; colour: number; start: number }
interface Memory { tick: number; gaveUp: number; seen: Map<number, { car: JuncCar; x: number; y: number; dx: number; dy: number }>; ghosts: Ghost[] }
const memories = new WeakMap<object, Memory>();
const crashSeen = new WeakMap<CanvasRenderingContext2D, number>();

function remember(state: JuncState): Memory {
  const m = realMemo(memories, state.arrivals, state.tick, () => ({ tick: state.tick, gaveUp: state.gaveUp, seen: new Map(), ghosts: [] }));
  if (state.tick !== m.tick) {
    if (state.gaveUp > m.gaveUp) {
      const live = new Set(state.cars.map((c) => c.id));
      for (const [id, prev] of m.seen) {
        if (!live.has(id) && !prev.car.cleared && !prev.car.amb) m.ghosts.push({ x: prev.x, y: prev.y, dx: prev.dx, dy: prev.dy, colour: prev.car.colour, start: state.tick });
      }
    }
    m.ghosts = m.ghosts.filter((g) => state.tick - g.start < FADE_TICKS);
    m.gaveUp = state.gaveUp;
    m.tick = state.tick;
    m.seen = new Map(state.cars.map((car) => [car.id, { car, ...juncCarPose(car) }]));
  }
  return m;
}

function drawScene(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = REAL_GRASS;
  ctx.fillRect(0, 0, JUNC_WORLD_W, JUNC_WORLD_H);
  ctx.fillStyle = REAL_GRASS_DARK;
  for (let k = 0; k < 90; k++) {
    const h = artHash(k, 77);
    ctx.fillRect(h % JUNC_WORLD_W, (h >>> 9) % JUNC_WORLD_H, 2, 2);
  }
  // Kerbs then asphalt.
  ctx.fillStyle = REAL_KERB;
  ctx.fillRect(JUNC_CX - HALF - 3, 0, HALF * 2 + 6, JUNC_WORLD_H);
  ctx.fillRect(0, JUNC_CY - HALF - 3, JUNC_WORLD_W, HALF * 2 + 6);
  ctx.fillStyle = REAL_ASPHALT;
  ctx.fillRect(JUNC_CX - HALF, 0, HALF * 2, JUNC_WORLD_H);
  ctx.fillRect(0, JUNC_CY - HALF, JUNC_WORLD_W, HALF * 2);

  // Dashed centre lines, outside the zebra crossings.
  const zebra = 16;
  ctx.strokeStyle = REAL_MARK;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(JUNC_CX, 0);
  ctx.lineTo(JUNC_CX, JUNC_CY - HALF - zebra - 4);
  ctx.moveTo(JUNC_CX, JUNC_CY + HALF + zebra + 4);
  ctx.lineTo(JUNC_CX, JUNC_WORLD_H);
  ctx.moveTo(0, JUNC_CY);
  ctx.lineTo(JUNC_CX - HALF - zebra - 4, JUNC_CY);
  ctx.moveTo(JUNC_CX + HALF + zebra + 4, JUNC_CY);
  ctx.lineTo(JUNC_WORLD_W, JUNC_CY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Zebra crossings on each arm.
  ctx.fillStyle = "rgba(244,246,248,0.85)";
  for (let s = -HALF + 3; s < HALF - 3; s += 8) {
    ctx.fillRect(JUNC_CX + s, JUNC_CY - HALF - zebra - 2, 4, zebra);
    ctx.fillRect(JUNC_CX + s, JUNC_CY + HALF + 2, 4, zebra);
    ctx.fillRect(JUNC_CX - HALF - zebra - 2, JUNC_CY + s, zebra, 4);
    ctx.fillRect(JUNC_CX + HALF + 2, JUNC_CY + s, zebra, 4);
  }
  // Stop lines (same places as before).
  ctx.strokeStyle = REAL_MARK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(JUNC_CX - HALF, JUNC_CY - HALF);
  ctx.lineTo(JUNC_CX, JUNC_CY - HALF);
  ctx.moveTo(JUNC_CX, JUNC_CY + HALF);
  ctx.lineTo(JUNC_CX + HALF, JUNC_CY + HALF);
  ctx.moveTo(JUNC_CX - HALF, JUNC_CY);
  ctx.lineTo(JUNC_CX - HALF, JUNC_CY + HALF);
  ctx.moveTo(JUNC_CX + HALF, JUNC_CY - HALF);
  ctx.lineTo(JUNC_CX + HALF, JUNC_CY);
  ctx.stroke();

  // Trees in the far corners, clear of roads and lights.
  realTree(ctx, 42, 70, 18);
  realTree(ctx, 78, 118, 12);
  realTree(ctx, 348, 76, 16);
  realTree(ctx, 44, 552, 16);
  realTree(ctx, 346, 548, 19);
  realTree(ctx, 312, 590, 11);
}

function drawLight(ctx: CanvasRenderingContext2D, x: number, y: number, green: boolean): void {
  ctx.fillStyle = REAL_SHADOW;
  ctx.beginPath();
  ctx.roundRect(x - 7 + 2, y - 13 + 2, 14, 26, 4);
  ctx.fill();
  ctx.fillStyle = "#23272E";
  ctx.beginPath();
  ctx.roundRect(x - 7, y - 13, 14, 26, 4);
  ctx.fill();
  ctx.fillStyle = green ? "#4A2226" : REAL_RED;
  ctx.beginPath();
  ctx.arc(x, y - 6, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = green ? "#2FD06A" : "#1F3A28";
  ctx.beginPath();
  ctx.arc(x, y + 6, 4.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, colour: string, amb: boolean, tick: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.fillStyle = REAL_SHADOW;
  ctx.beginPath();
  ctx.roundRect(-CAR_PX + 2, -CAR_W / 2 + 2, CAR_PX, CAR_W, 8);
  ctx.fill();
  realVehicle(ctx, -CAR_PX, -CAR_W / 2, CAR_PX, CAR_W, 1, amb ? "#F7F8FA" : colour, false, false);
  if (amb) {
    ctx.fillStyle = REAL_RED;
    ctx.fillRect(-CAR_PX / 2 - 9, -2, 14, 4);
    ctx.fillRect(-CAR_PX / 2 - 4, -7, 4, 14);
    const on = Math.trunc(tick / 6) % 2 === 0;
    ctx.fillStyle = on ? "#2F6FEB" : "#9CC0FF";
    ctx.fillRect(-14, -CAR_W / 2 + 3, 5, CAR_W / 2 - 4);
    ctx.fillStyle = on ? "#9CC0FF" : "#2F6FEB";
    ctx.fillRect(-14, 1, 5, CAR_W / 2 - 4);
  }
  ctx.restore();
}

export function drawJunctionArt(ctx: CanvasRenderingContext2D, state: JuncState, size: CanvasSize): void {
  const scale = Math.min(size.width / JUNC_WORLD_W, size.height / JUNC_WORLD_H);
  const ox = (size.width - JUNC_WORLD_W * scale) / 2;
  const oy = (size.height - JUNC_WORLD_H * scale) / 2;
  const m = remember(state);
  const tick = state.tick;
  ctx.save();
  ctx.fillStyle = REAL_GRASS_DARK;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, JUNC_WORLD_W, JUNC_WORLD_H);
  ctx.clip();
  drawScene(ctx);

  // Given-up cars fade where they were.
  for (const g of m.ghosts) {
    drawCar(ctx, g.x, g.y, g.dx, g.dy, CAR_COLOURS[g.colour % CAR_COLOURS.length]!, false, tick, 1 - (tick - g.start) / FADE_TICKS);
  }

  for (const car of state.cars) {
    const pose = juncCarPose(car);
    drawCar(ctx, pose.x, pose.y, pose.dx, pose.dy, CAR_COLOURS[car.colour % CAR_COLOURS.length]!, car.amb === 1, tick);
    // Indicator before the turn (same timing as the sim's old drawing).
    const toLine = (STOP[car.ap]! - car.s) / juncSpeed(tick);
    if (car.turn && toLine < JUNC_INDICATE_TICKS && toLine > -40 && Math.trunc(tick / 8) % 2 === 0) {
      ctx.save();
      ctx.translate(pose.x, pose.y);
      ctx.rotate(Math.atan2(pose.dy, pose.dx));
      ctx.fillStyle = "#FF9F1C";
      const side = car.turn === 2 ? 1 : -1;
      ctx.fillRect(-6, side * (CAR_W / 2 - 2) - 2, 5, 4);
      ctx.fillRect(-CAR_PX + 1, side * (CAR_W / 2 - 2) - 2, 5, 4);
      ctx.restore();
    }
    if (!car.amb && car.wait > 0 && car.s <= STOP[car.ap]!) {
      const left = 1 - car.wait / car.patience;
      const bx = pose.x - CAR_PX / 2 - (pose.dx * CAR_PX) / 2;
      const by = pose.y - 24 - (pose.dy * CAR_PX) / 2;
      ctx.fillStyle = "rgba(30,38,48,0.35)";
      ctx.fillRect(bx, by, CAR_PX, 4);
      ctx.fillStyle = left < 0.3 ? REAL_RED : "#FFFFFF";
      ctx.fillRect(bx, by, CAR_PX * left, 4);
    }
  }

  for (let ap = 0; ap < 4; ap++) {
    const [lx, ly] = JUNC_LIGHT_AT[ap]!;
    drawLight(ctx, lx, ly, ((state.lights >> ap) & 1) === 1);
  }

  if (tick - state.honkTick < 30) {
    const [lx, ly] = JUNC_LIGHT_AT[state.honkAp]!;
    ctx.fillStyle = REAL_RED;
    ctx.font = "bold 13px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("HONK", lx, ly - 18);
  }

  if (state.ended === 2) {
    let at = crashSeen.get(ctx);
    if (at === undefined) {
      at = realNow();
      crashSeen.set(ctx, at);
    }
    ctx.fillStyle = "#FF8A3D";
    ctx.beginPath();
    for (let p = 0; p < 16; p++) {
      const a = (p * Math.PI) / 8;
      const r = p % 2 === 0 ? 30 : 13;
      const x = state.crashX + Math.cos(a) * r;
      const y = state.crashY + Math.sin(a) * r;
      if (p === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    const flash = Math.max(0, 1 - (realNow() - at) / 350);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.55 * flash})`;
      ctx.fillRect(0, 0, JUNC_WORLD_W, JUNC_WORLD_H);
    }
  } else crashSeen.delete(ctx);

  ctx.fillStyle = REAL_INK;
  ctx.font = "bold 18px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`Cleared ${state.cleared}`, JUNC_WORLD_W / 2 - 70, 30);
  ctx.restore();
}

export const junctionArtGame = { ...junctionGame, draw: drawJunctionArt };
export const JUNC_ART_BG = REAL_GRASS_DARK;
