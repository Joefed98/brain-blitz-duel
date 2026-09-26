/**
 * Ricochet — an arcade game on the shared engine.
 *
 * The ball clings to one wall of a shaft and slides slowly down; a tap leaps it
 * diagonally up to the opposite wall. Spikes are laid out in full at init, so
 * the whole shaft is identical for everyone. Positions and speeds are integer
 * fixed-point (1/256 px) and no randomness is drawn during play.
 */

import {
  clampInt,
  px,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type CanvasSize,
} from "./engine";

/* ============================== Constants ============================== */

export const RICO_WORLD_W = 390;
export const RICO_WORLD_H = 560;

export const RICO_RUN_SECONDS = 60;
export const RICO_RUN_TICKS = RICO_RUN_SECONDS * TICKS_PER_SECOND;

/** Shaft geometry, in whole pixels (drawing) and 1/256 units (sim). */
export const RICO_WALL_THICK = 14;
export const RICO_SHAFT_LEFT = 55;
export const RICO_SHAFT_RIGHT = 335;
export const RICO_BALL_R = 9;
export const RICO_BALL_R_FP = 2_304;
/** One ball diameter, fixed-point (18 px). */
export const RICO_BALL_D_FP = RICO_BALL_R_FP * 2;

/** A leap: 18 ticks across the shaft, climbing this far. */
export const RICO_LEAP_TICKS = 18;
export const RICO_LEAP_CLIMB_FP = 30_720;

/** Cling slide: 0.6 px a tick, 10% faster for every 15 m (600 px) climbed. */
export const RICO_SLIDE_START_FP = 154;
export const RICO_SLIDE_PERIOD_PX = 600;

/** The ball starts this high, and dies if it slides back to the floor. */
export const RICO_START_FP = 15_360;

/** Spikes: 15 px tall and 12 px deep, never facing. */
export const RICO_SPIKE_H = 15;
export const RICO_SPIKE_H_FP = 3_840;
export const RICO_SPIKE_DEPTH = 12;
/**
 * Spacing, in quarter ball-diameters. On one wall the clear gap between two
 * spikes (edge to edge) starts at 6 diameters and tightens by 0.5 every
 * 20 m (800 px) of height, never below 2.0. The first 10 m have no spikes. Each gap is drawn from the seed
 * between that minimum and 1.5 diameters more. Spikes on opposite walls keep
 * at least 1.5 diameters (edge to edge) of height between them.
 */
export const RICO_GAP_START_Q = 24;
export const RICO_GAP_MIN_Q = 8;
export const RICO_GAP_BAND_Q = 6;
export const RICO_GAP_STEP_PX = 800;
export const RICO_CROSS_GAP_FP = (RICO_BALL_D_FP * 3) / 2;
export const RICO_SPIKE_FIRST_FP = 102_400;
/** Spikes are laid out beyond the highest climb possible in the run. */
export const RICO_SPIKE_TOP_FP =
  (RICO_RUN_TICKS / RICO_LEAP_TICKS) * RICO_LEAP_CLIMB_FP + RICO_START_FP + 51_200;
/** Reachability margin: a landing zone must be at least this deep. */
const RICO_REACH_MARGIN_FP = 512;
const RICO_MAX_ROLLS = 64;

/** Two points per metre (40 px), including partial metres, capped at 150. */
export const RICO_PX_PER_METRE = 40;

/** The slide speed once the ball has climbed this many whole pixels. */
export function ricoSlide(climbedPx: number): number {
  const steps = Math.trunc(Math.max(0, climbedPx) / RICO_SLIDE_PERIOD_PX);
  let rate = RICO_SLIDE_START_FP;
  for (let i = 0; i < steps; i++) rate = Math.trunc((rate * 11) / 10);
  return rate;
}

/* ================================ State ================================ */

export interface RicoSpike {
  /** 0 = left wall, 1 = right wall. */
  wall: number;
  /** Bottom edge of the spike, in climb units. */
  y: number;
}

export interface RicoState {
  tick: number;
  rng: number;
  /** Ascending by height; both walls in one list. */
  spikes: RicoSpike[];
  /** The wall the ball clings to (or leapt from while in flight). */
  wall: number;
  /** Height above the floor, fixed-point. */
  y: number;
  /** Best height reached, fixed-point. */
  best: number;
  /** Ticks left in the leap; 0 means clinging. */
  flight: number;
  /** Where the leap started and where it lands. */
  fromY: number;
  toY: number;
  leaps: number;
  dead: boolean;
  /** True when a spike ended the run rather than the floor. */
  spiked: boolean;
  endedTick: number;
}

/** Minimum clear gap on one wall at this height, fixed-point. */
export function ricoMinGapFp(yFp: number): number {
  const steps = Math.trunc(Math.max(0, yFp) / 256 / RICO_GAP_STEP_PX);
  const quarters = Math.max(RICO_GAP_MIN_Q, RICO_GAP_START_Q - 2 * steps);
  return (RICO_BALL_D_FP * quarters) / 4;
}

function rollSpikes(rngIn: number): { rng: number; spikes: RicoSpike[] } {
  let rng = rngIn;
  const walls: RicoSpike[][] = [[], []];
  for (let wall = 0; wall < 2; wall++) {
    const offset = rngBelow(rng, RICO_BALL_D_FP * 4);
    rng = offset.state;
    let y = RICO_SPIKE_FIRST_FP + (wall === 1 ? RICO_CROSS_GAP_FP + RICO_SPIKE_H_FP : 0) + offset.value;
    const other = walls[0]!;
    let cursor = 0;
    while (y < RICO_SPIKE_TOP_FP) {
      // Push clear of the other wall's spikes (edge to edge).
      if (wall === 1) {
        let moved = true;
        while (moved) {
          moved = false;
          while (cursor < other.length && other[cursor]!.y + RICO_SPIKE_H_FP + RICO_CROSS_GAP_FP <= y) cursor++;
          const near = other[cursor];
          if (near && near.y < y + RICO_SPIKE_H_FP + RICO_CROSS_GAP_FP) {
            y = near.y + RICO_SPIKE_H_FP + RICO_CROSS_GAP_FP;
            moved = true;
          }
        }
      }
      walls[wall]!.push({ wall, y });
      const band = rngBelow(rng, (RICO_BALL_D_FP * RICO_GAP_BAND_Q) / 4 + 1);
      rng = band.state;
      y += RICO_SPIKE_H_FP + ricoMinGapFp(y) + band.value;
    }
  }
  const spikes = [...walls[0]!, ...walls[1]!].sort((a, b) => a.y - b.y || a.wall - b.wall);
  return { rng, spikes };
}

/**
 * Search: can the ball keep climbing to the top of the laid-out shaft without
 * ever resting on or landing on a spike? Clinging zones are the stretches of
 * wall clear of every spike; from a zone the ball can slide to any lower point
 * in it and leap exactly one climb up to the other wall.
 */
export function ricoShaftReachable(spikes: RicoSpike[]): boolean {
  const zones: { low: number; high: number }[][] = [[], []];
  for (let wall = 0; wall < 2; wall++) {
    let low = 0;
    for (const spike of spikes) {
      if (spike.wall !== wall) continue;
      const high = spike.y - RICO_BALL_R_FP - 1;
      if (high > low) zones[wall]!.push({ low, high });
      low = spike.y + RICO_SPIKE_H_FP + RICO_BALL_R_FP + 1;
    }
    zones[wall]!.push({ low, high: RICO_SPIKE_TOP_FP * 2 });
  }
  const best: number[][] = [zones[0]!.map(() => -1), zones[1]!.map(() => -1)];
  const start = zones[0]!.findIndex((z) => z.low <= RICO_START_FP && RICO_START_FP <= z.high);
  if (start < 0) return false;
  best[0]![start] = RICO_START_FP;
  const work: [number, number][] = [[0, start]];
  let top = RICO_START_FP;
  while (work.length > 0) {
    const [wall, index] = work.pop()!;
    const zone = zones[wall]![index]!;
    const reached = best[wall]![index]!;
    const from = Math.max(zone.low, 1) + RICO_LEAP_CLIMB_FP;
    const to = reached + RICO_LEAP_CLIMB_FP;
    const otherWall = 1 - wall;
    const others = zones[otherWall]!;
    for (let j = 0; j < others.length; j++) {
      const target = others[j]!;
      if (target.low > to) break;
      if (target.high < from) continue;
      const lo = Math.max(target.low, from);
      const hi = Math.min(target.high, to);
      if (hi - lo < RICO_REACH_MARGIN_FP) continue;
      if (hi > best[otherWall]![j]!) {
        best[otherWall]![j] = hi;
        if (hi > top) top = hi;
        work.push([otherWall, j]);
      }
    }
  }
  return top >= RICO_SPIKE_TOP_FP - 25_600;
}

function buildSpikes(seed: number): { rng: number; spikes: RicoSpike[] } {
  let rng = seed | 0;
  let built = rollSpikes(rng);
  for (let roll = 1; roll < RICO_MAX_ROLLS && !ricoShaftReachable(built.spikes); roll++) {
    rng = built.rng;
    built = rollSpikes(rng);
  }
  return built;
}

function init(seed: number): RicoState {
  const built = buildSpikes(seed);
  return {
    tick: 0,
    rng: built.rng,
    spikes: built.spikes,
    wall: 0,
    y: RICO_START_FP,
    best: RICO_START_FP,
    flight: 0,
    fromY: RICO_START_FP,
    toY: RICO_START_FP,
    leaps: 0,
    dead: false,
    spiked: false,
    endedTick: 0,
  };
}

function isOver(state: RicoState): boolean {
  return state.dead || state.tick >= RICO_RUN_TICKS;
}

export function ricoSurvived(state: RicoState): boolean {
  return !state.dead && state.tick >= RICO_RUN_TICKS;
}

/** True when the ball at this height on this wall touches a spike. */
export function ricoOnSpike(state: RicoState, wall: number, y: number): boolean {
  for (const spike of state.spikes) {
    if (spike.wall !== wall) continue;
    if (spike.y > y + RICO_BALL_R_FP) break;
    if (spike.y + RICO_SPIKE_H_FP >= y - RICO_BALL_R_FP) return true;
  }
  return false;
}

/** Height climbed above the start, in whole pixels. */
export function ricoHeightPx(state: RicoState): number {
  return Math.trunc((state.best - RICO_START_FP) / 256);
}

function step(state: RicoState, tapped: boolean): RicoState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;

  let { wall, y, flight, fromY, toY, leaps } = state;

  if (flight > 0) {
    flight -= 1;
    const done = RICO_LEAP_TICKS - flight;
    y = fromY + Math.trunc(((toY - fromY) * done) / RICO_LEAP_TICKS);
    if (flight === 0) {
      y = toY;
      if (ricoOnSpike(state, wall, y)) {
        return { ...state, tick, wall, y, flight, dead: true, spiked: true, endedTick: tick };
      }
    }
  } else if (tapped) {
    wall = 1 - wall;
    fromY = y;
    toY = y + RICO_LEAP_CLIMB_FP;
    flight = RICO_LEAP_TICKS;
    leaps += 1;
    y = fromY + Math.trunc((toY - fromY) / RICO_LEAP_TICKS);
  } else {
    y -= ricoSlide(ricoHeightPx(state));
    if (y <= 0) {
      return { ...state, tick, y: 0, flight, dead: true, spiked: false, endedTick: tick };
    }
    if (ricoOnSpike(state, wall, y)) {
      return { ...state, tick, y, flight, dead: true, spiked: true, endedTick: tick };
    }
  }

  const best = y > state.best ? y : state.best;
  const next: RicoState = { ...state, tick, wall, y, best, flight, fromY, toY, leaps };
  if (tick >= RICO_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

function score(state: RicoState): number {
  return clampInt(Math.trunc((2 * ricoHeightPx(state)) / RICO_PX_PER_METRE), 0, 150);
}

/* =========================== Integrity checks ========================== */

export const RICO_CHECKPOINT_INTERVAL = 300;

export interface RicoCheckpointState {
  tick: number;
  wall: number;
  y: number;
  best: number;
  flight: number;
  fromY: number;
  toY: number;
  leaps: number;
  slide: number;
}

export interface RicoCheckpoint extends RicoCheckpointState {
  checksum: number;
}

export function ricoCheckpointState(state: RicoState): RicoCheckpointState {
  return {
    tick: state.tick,
    wall: state.wall,
    y: state.y,
    best: state.best,
    flight: state.flight,
    fromY: state.fromY,
    toY: state.toY,
    leaps: state.leaps,
    slide: ricoSlide(ricoHeightPx(state)),
  };
}

/** 32-bit FNV-1a over the integer snapshot. */
export function ricoCheckpoint(state: RicoState): RicoCheckpoint {
  const snapshot = ricoCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* ================================ Drawing ============================== */

export const RICO_BG = "#0B0B0F";
export const RICO_BALL = "#F5B82E";
export const RICO_WALL = "#2A2A33";
export const RICO_SPIKE = "#FF4D4D";

function draw(ctx: CanvasRenderingContext2D, state: RicoState, size: CanvasSize): void {
  const scale = Math.min(size.width / RICO_WORLD_W, size.height / RICO_WORLD_H);
  const offsetX = (size.width - RICO_WORLD_W * scale) / 2;
  const offsetY = (size.height - RICO_WORLD_H * scale) / 2;

  ctx.save();
  ctx.fillStyle = RICO_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // The camera keeps the ball two thirds of the way down the shaft.
  const ballWorldY = px(state.y);
  const eye = RICO_WORLD_H * 0.66;
  const screenOf = (worldY: number) => eye - (worldY - ballWorldY);

  ctx.fillStyle = RICO_WALL;
  ctx.fillRect(RICO_SHAFT_LEFT - RICO_WALL_THICK, 0, RICO_WALL_THICK, RICO_WORLD_H);
  ctx.fillRect(RICO_SHAFT_RIGHT, 0, RICO_WALL_THICK, RICO_WORLD_H);

  // The floor.
  const floorY = screenOf(0);
  if (floorY > -20 && floorY < RICO_WORLD_H + 20) {
    ctx.fillStyle = "#3A2A12";
    ctx.fillRect(RICO_SHAFT_LEFT, floorY, RICO_SHAFT_RIGHT - RICO_SHAFT_LEFT, 8);
  }

  ctx.fillStyle = RICO_SPIKE;
  for (const spike of state.spikes) {
    const top = screenOf(px(spike.y) + RICO_SPIKE_H);
    if (top > RICO_WORLD_H + 40) continue;
    if (top < -40) break;
    const inner = spike.wall === 0 ? RICO_SHAFT_LEFT : RICO_SHAFT_RIGHT;
    const tip = spike.wall === 0 ? inner + RICO_SPIKE_DEPTH : inner - RICO_SPIKE_DEPTH;
    ctx.beginPath();
    ctx.moveTo(inner, top);
    ctx.lineTo(tip, top + RICO_SPIKE_H / 2);
    ctx.lineTo(inner, top + RICO_SPIKE_H);
    ctx.closePath();
    ctx.fill();
  }

  // The ball: while in flight it travels across the shaft with its climb.
  const fromX = state.wall === 0 ? RICO_SHAFT_RIGHT - RICO_BALL_R : RICO_SHAFT_LEFT + RICO_BALL_R;
  const toX = state.wall === 0 ? RICO_SHAFT_LEFT + RICO_BALL_R : RICO_SHAFT_RIGHT - RICO_BALL_R;
  const done = state.flight > 0 ? (RICO_LEAP_TICKS - state.flight) / RICO_LEAP_TICKS : 1;
  const ballX = state.flight > 0 ? fromX + (toX - fromX) * done : toX;
  ctx.fillStyle = RICO_BALL;
  ctx.beginPath();
  ctx.arc(ballX, screenOf(ballWorldY), RICO_BALL_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Height ${Math.trunc(ricoHeightPx(state) / 40).toLocaleString("en-GB")} m`, 14, 14);
  ctx.textAlign = "right";

  if (state.dead) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(0, 0, RICO_WORLD_W, RICO_WORLD_H);
  }

  ctx.restore();
}

export const ricoGame: ArcadeGame<RicoState> = {
  key: "ricochet",
  runTicks: RICO_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
};
