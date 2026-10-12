import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { JUNCTION_FX } from "./arcadeFxGames.renderer";
/**
 * Junction art (Real World). Render only: reads JuncState, never mutates it.
 * Cars fill the unchanged 41×24 car box; only the 2D visual turn path changes.
 * Simulation progress, clearing and junction occupancy remain untouched. Road geometry
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
  juncBuiltAt,
  juncCarPoseV2,
  juncLanePoint,
  juncLenOf,
  juncStopOf,
  JUNC_APPROACHES_V2,
  JUNC_BUILD_TICKS,
  JUNC_LIGHT_AT_V2,
  JUNC_REV,
  JUNC_REV_BAND,
  junctionBandGame,
  junctionRev2Game,
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
const LANE = 16;
const CAR_W = 24;
const CAR_PX = 41;
const SPAWN_OUT = 20;
const STOP_V = (JUNC_CY - HALF + SPAWN_OUT) * FP;
const STOP_H = (JUNC_CX - HALF + SPAWN_OUT) * FP;
const STOP = [STOP_V, STOP_V, STOP_H, STOP_H];
const FADE_TICKS = 30;

/** Presentation-only turn pivot at the destination arm's outgoing lane. */
export function junctionArtCarPose(car: JuncCar): { x: number; y: number; dx: number; dy: number } {
  if (car.ap >= 4) return juncCarPoseV2(car);
  if (!car.turn) return juncCarPose(car);
  const origin = juncCarPose({ ...car, s: 0, turn: 0 });
  const { dx, dy } = origin;
  const tx = car.turn === 2 ? -dy : dy;
  const ty = car.turn === 2 ? dx : -dx;
  // Eastbound exits below the centre; southbound exits to its left.
  const laneX = JUNC_CX - ty * LANE;
  const laneY = JUNC_CY + tx * LANE;
  const pivot = dx === 0 ? (laneY - origin.y) / dy : (laneX - origin.x) / dx;
  const s = car.s / FP;
  if (s <= pivot) return { x: origin.x + dx * s, y: origin.y + dy * s, dx, dy };
  return { x: origin.x + dx * pivot + tx * (s - pivot), y: origin.y + dy * pivot + ty * (s - pivot), dx: tx, dy: ty };
}

const BUS_COLOUR = "#E8B21C";
/** junctionRev 2: one colour per road, shared by its light's ring, stop line and painted arrow. */
export const JUNC_LANE_COLOURS = ["#38BDF8", "#FB923C", "#C084FC", "#4ADE80", "#F472B6", "#FACC15", "#2DD4BF", "#F87171"] as const;
const DIAG_HALF = 15;
const HIGHLIGHT_MS = 550;
/** Rev 2: how far back from the stop line each lane is tinted in its light's colour, px. */
const LANE_TINT_PX = 70;

interface LightMemory { lights: number; changed: number[] }
const lightMemo = new WeakMap<CanvasRenderingContext2D, LightMemory>();

/** Render only: when each light last changed (a tap), for the lane highlight. */
function lightChanges(ctx: CanvasRenderingContext2D, state: JuncState): number[] {
  const now = realNow();
  let m = lightMemo.get(ctx);
  if (!m || state.tick < 2) {
    m = { lights: state.lights, changed: new Array<number>(JUNC_APPROACHES_V2).fill(-1e9) };
    lightMemo.set(ctx, m);
  }
  const diff = m.lights ^ state.lights;
  for (let ap = 0; ap < JUNC_APPROACHES_V2; ap++) if ((diff >> ap) & 1) m.changed[ap] = now;
  m.lights = state.lights;
  return m.changed;
}

/** Path points of an approach's inbound lane from `s0` to `s1` px. */
function lanePath(ctx: CanvasRenderingContext2D, ap: number, s0: number, s1: number): void {
  const a = juncLanePoint(ap, s0);
  const b = juncLanePoint(ap, s1);
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
}

/** Rev 2: built diagonal roads (growing out from the junction while being built), with cones while building. */
function drawDiagonalRoads(ctx: CanvasRenderingContext2D, state: JuncState): void {
  const builds = state.builds ?? [];
  for (const ap of builds) {
    const at = juncBuiltAt(builds, ap);
    const end = juncStopOf(ap) / FP + 44;
    if (state.tick < at - 60) continue;
    if (state.tick < at) {
      // Cones mark where the next road will join, a second before it is built.
      for (const s of [end - 6, end - 26]) {
        const p = juncLanePoint(ap, s);
        cone(ctx, p.x - p.dy * 12, p.y + p.dx * 12);
        cone(ctx, p.x + p.dy * 12, p.y - p.dx * 12);
      }
      continue;
    }
    const k = Math.min(1, (state.tick - at) / JUNC_BUILD_TICKS);
    const start = end - (end + 20) * k;
    ctx.save();
    ctx.lineCap = "butt";
    ctx.strokeStyle = REAL_KERB;
    ctx.lineWidth = DIAG_HALF * 2 + 6;
    ctx.beginPath();
    lanePath(ctx, ap, start, end - 30);
    ctx.stroke();
    ctx.strokeStyle = REAL_ASPHALT;
    ctx.lineWidth = DIAG_HALF * 2;
    ctx.beginPath();
    lanePath(ctx, ap, start, end);
    ctx.stroke();
    ctx.restore();
    if (k < 1) {
      const p = juncLanePoint(ap, start);
      cone(ctx, p.x - p.dy * 11, p.y + p.dx * 11);
      cone(ctx, p.x + p.dy * 11, p.y - p.dx * 11);
    }
  }
}

function cone(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#FF7A1A";
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x + 4.5, y + 4);
  ctx.lineTo(x - 4.5, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x - 2.5, y - 1, 5, 2);
}

/** Rev 2: each built road's coloured stop line and painted arrow, and a glow along a lane whose light just changed. */
function drawLaneMarks(ctx: CanvasRenderingContext2D, state: JuncState, changed: number[]): void {
  const builds = state.builds ?? [];
  const now = realNow();
  for (let ap = 0; ap < JUNC_APPROACHES_V2; ap++) {
    const at = juncBuiltAt(builds, ap);
    if (at > state.tick || (ap >= 4 && state.tick - at < JUNC_BUILD_TICKS)) continue;
    const colour = JUNC_LANE_COLOURS[ap]!;
    const stop = juncStopOf(ap) / FP;
    const glow = 1 - (now - changed[ap]!) / HIGHLIGHT_MS;
    if (glow > 0) {
      ctx.save();
      ctx.globalAlpha = 0.45 * glow;
      ctx.strokeStyle = colour;
      ctx.lineWidth = 24;
      ctx.lineCap = "round";
      ctx.beginPath();
      lanePath(ctx, ap, 0, stop);
      ctx.stroke();
      ctx.restore();
    }
    // Tuning B: the last stretch of the lane is tinted in its light's colour, so
    // with eight roads each light reads as owning its lane, not its neighbour's.
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 20;
    ctx.lineCap = "butt";
    ctx.beginPath();
    lanePath(ctx, ap, stop - LANE_TINT_PX, stop);
    ctx.stroke();
    ctx.restore();
    // Stop line across the lane, in the road's colour, joined to its light along the kerb.
    const p = juncLanePoint(ap, stop);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x - p.dy * 14, p.y + p.dx * 14);
    ctx.lineTo(p.x + p.dy * 14, p.y - p.dx * 14);
    ctx.stroke();
    const [lx, ly] = JUNC_LIGHT_AT_V2[ap]!;
    const fromX = p.x - p.dy * 15;
    const fromY = p.y + p.dx * 15;
    // The link: a dark casing under the coloured dashes so it reads over asphalt,
    // kerb and grass alike, and a dot where it meets the stop line.
    ctx.strokeStyle = "rgba(20, 26, 36, 0.7)";
    ctx.lineWidth = 5.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "butt";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colour;
    ctx.strokeStyle = "rgba(20, 26, 36, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(fromX, fromY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Painted arrow behind the stop line: straight on for main roads, bear left for diagonals.
    const q = juncLanePoint(ap, stop - 34);
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(Math.atan2(q.dy, q.dx));
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    if (ap < 4) {
      ctx.rect(-12, -2, 14, 4);
      ctx.moveTo(10, 0);
      ctx.lineTo(1, -6);
      ctx.lineTo(1, 6);
    } else {
      ctx.rect(-12, -2, 11, 4);
      // Shaft bending 45° to the driver's left, then the head.
      ctx.moveTo(-2, -2);
      ctx.lineTo(4, -8);
      ctx.lineTo(7, -5);
      ctx.lineTo(1, 2);
      ctx.closePath();
      ctx.moveTo(9, -13);
      ctx.lineTo(1, -11);
      ctx.lineTo(7, -5);
    }
    ctx.fill();
    ctx.restore();
  }
}

/** Daylight versions of the car colours, taken from Cross's palette. */
const CAR_COLOURS = [CROSS_BLOCK_COLOURS[2], CROSS_BLOCK_COLOURS[4], CROSS_BLOCK_COLOURS[1], CROSS_BLOCK_COLOURS[5]];

interface Ghost { x: number; y: number; dx: number; dy: number; colour: number; start: number }
interface Memory { tick: number; gaveUp: number; seen: Map<number, { car: JuncCar; x: number; y: number; dx: number; dy: number }>; ghosts: Ghost[]; success:{x:number;y:number} }
const memories = new WeakMap<object, Memory>();
const crashSeen = new WeakMap<CanvasRenderingContext2D, number>();

function remember(state: JuncState): Memory {
  const m = realMemo(memories, state.arrivals, state.tick, () => ({ tick: state.tick, gaveUp: state.gaveUp, seen: new Map(), ghosts: [],success:{x:JUNC_CX+HALF+24,y:JUNC_CY} }));
  if (state.tick !== m.tick) {
    for(const car of state.cars)if(car.cleared&&!car.amb&&!m.seen.get(car.id)?.car.cleared){const old=m.seen.get(car.id);m.success=old?{x:old.x,y:old.y}:junctionArtCarPose(car);}
    if (state.gaveUp > m.gaveUp) {
      const live = new Set(state.cars.map((c) => c.id));
      for (const [id, prev] of m.seen) {
        if (!live.has(id) && !prev.car.cleared && !prev.car.amb) m.ghosts.push({ x: prev.x, y: prev.y, dx: prev.dx, dy: prev.dy, colour: prev.car.colour, start: state.tick });
      }
    }
    m.ghosts = m.ghosts.filter((g) => state.tick - g.start < FADE_TICKS);
    m.gaveUp = state.gaveUp;
    m.tick = state.tick;
    m.seen = new Map(state.cars.map((car) => [car.id, { car, ...junctionArtCarPose(car) }]));
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
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.18, 1.18);
  x = 0;
  y = 0;
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
  ctx.restore();
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, colour: string, amb: boolean, tick: number, alpha = 1, len = CAR_PX, bus = false): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.fillStyle = REAL_SHADOW;
  ctx.beginPath();
  ctx.roundRect(-len + 2, -CAR_W / 2 + 2, len, CAR_W, 8);
  ctx.fill();
  realVehicle(ctx, -len, -CAR_W / 2, len, CAR_W, 1, amb ? "#F7F8FA" : bus ? BUS_COLOUR : colour, bus, false);
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

/** The game's drawing through the shared success layer (presentation only). */
export function drawJunctionArt(ctx: CanvasRenderingContext2D, state: JuncState, size: CanvasSize, crashIndicator = true): void {
  arcadeFx(ctx, JUNCTION_FX, state, () => drawJunctionArtWorld(ctx, state, size, crashIndicator), size);
}

function drawJunctionArtWorld(ctx: CanvasRenderingContext2D, state: JuncState, size: CanvasSize, crashIndicator = true): void {
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
  const changed = state.rev ? lightChanges(ctx, state) : [];
  if (state.rev) {
    drawDiagonalRoads(ctx, state);
    drawLaneMarks(ctx, state, changed);
  }

  const clearPose=m.success;
  successFrame(ctx,{id:'junction',tick:state.tick,count:state.cleared,misses:state.gaveUp,colour:SUCCESS_ACCENTS.green,width:JUNC_WORLD_W,height:JUNC_WORLD_H,point:{x:clearPose.x,y:clearPose.y-18,shape:'tick'},hud:{x:JUNC_CX-65,y:16,text:`Cleared ${state.cleared}`}});
  // Given-up cars fade where they were.
  for (const g of m.ghosts) {
    drawCar(ctx, g.x, g.y, g.dx, g.dy, CAR_COLOURS[g.colour % CAR_COLOURS.length]!, false, tick, 1 - (tick - g.start) / FADE_TICKS);
  }

  for (const car of state.cars) {
    const pose = junctionArtCarPose(car);
    drawCar(ctx, pose.x, pose.y, pose.dx, pose.dy, CAR_COLOURS[car.colour % CAR_COLOURS.length]!, car.amb === 1, tick, 1, juncLenOf(car) / FP, car.kind === 1);
    // Indicator before the turn (same timing as the sim's old drawing).
    const toLine = (juncStopOf(car.ap) - car.s) / juncSpeed(tick);
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
    if (!car.amb && car.wait > 0 && car.s <= juncStopOf(car.ap)) {
      const left = 1 - car.wait / car.patience;
      const bx = pose.x - CAR_PX / 2 - (pose.dx * CAR_PX) / 2;
      const by = pose.y - 24 - (pose.dy * CAR_PX) / 2;
      ctx.fillStyle = "rgba(30,38,48,0.35)";
      ctx.fillRect(bx, by, CAR_PX, 4);
      ctx.fillStyle = left < 0.3 ? REAL_RED : "#FFFFFF";
      ctx.fillRect(bx, by, CAR_PX * left, 4);
    }
  }

  if (state.rev) {
    // Rev 2: each light at its own stop line, ringed in its road's colour; a ring pulse when tapped.
    const now = realNow();
    for (let ap = 0; ap < JUNC_APPROACHES_V2; ap++) {
      const at = juncBuiltAt(state.builds ?? [], ap);
      if (at > tick) continue;
      const [lx, ly] = JUNC_LIGHT_AT_V2[ap]!;
      const grow = ap >= 4 ? Math.min(1, (tick - at) / 20) : 1;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.scale(grow, grow);
      ctx.strokeStyle = JUNC_LANE_COLOURS[ap]!;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-11, -18, 22, 36, 7);
      ctx.stroke();
      const pulse = 1 - (now - changed[ap]!) / HIGHLIGHT_MS;
      if (pulse > 0) {
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 22 + (1 - pulse) * 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      drawLight(ctx, 0, 0, ((state.lights >> ap) & 1) === 1);
      ctx.restore();
    }
  } else {
    for (let ap = 0; ap < 4; ap++) {
      const [lx, ly] = JUNC_LIGHT_AT[ap]!;
      drawLight(ctx, lx, ly, ((state.lights >> ap) & 1) === 1);
    }
  }

  if (tick - state.honkTick < 30) {
    const [lx, ly] = (state.rev ? JUNC_LIGHT_AT_V2 : JUNC_LIGHT_AT)[state.honkAp]!;
    ctx.fillStyle = REAL_RED;
    ctx.font = "bold 13px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("HONK", lx, ly - 18);
  }

  if (state.ended === 2 && crashIndicator) {
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

  ctx.font = "bold 18px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  ctx.strokeStyle = REAL_INK;
  ctx.strokeText(`Cleared ${state.cleared}`, JUNC_WORLD_W / 2, 30);
  ctx.fillStyle = "#FFFFFF";
  successHud(ctx,'junction',state.tick,195,30,()=>{ctx.fillText(`Cleared ${state.cleared}`, JUNC_WORLD_W / 2, 30);});
  ctx.restore();
}

export const junctionArtGame = { ...junctionGame, draw: drawJunctionArt };
export const junctionRev2ArtGame = { ...junctionRev2Game, draw: drawJunctionArt };
const junctionBandArtGame = { ...junctionBandGame, draw: drawJunctionArt };
export function junctionArtGameFor(rev?: number | null) {
  if (rev === JUNC_REV_BAND) return junctionBandArtGame;
  return rev === JUNC_REV ? junctionRev2ArtGame : junctionArtGame;
}
export const junctionRevealGame = { draw: (ctx: CanvasRenderingContext2D, state: JuncState, size: CanvasSize) => drawJunctionArt(ctx, state, size, false) };
export const JUNC_ART_BG = REAL_GRASS_DARK;
