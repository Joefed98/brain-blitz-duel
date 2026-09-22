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
export const RICO_BALL_R = 12;
export const RICO_BALL_R_FP = 3_072;

/** A leap: 18 ticks across the shaft, climbing this far. */
export const RICO_LEAP_TICKS = 18;
export const RICO_LEAP_CLIMB_FP = 30_720;

/** Cling slide: 0.6 px a tick, 10% faster every ten seconds. */
export const RICO_SLIDE_START_FP = 154;
export const RICO_SLIDE_PERIOD_TICKS = 10 * TICKS_PER_SECOND;

/** The ball starts this high, and dies if it slides back to the floor. */
export const RICO_START_FP = 15_360;

/** Spikes: 18 px tall, at least 90 px apart on one wall, never facing. */
export const RICO_SPIKE_H = 18;
export const RICO_SPIKE_H_FP = 4_608;
export const RICO_SPIKE_MIN_GAP_FP = 23_040;
export const RICO_SPIKE_FIRST_FP = 76_800;
export const RICO_SPIKE_COUNT = 240;
/** Global rise between consecutive spikes: 40 px plus up to 60 px. */
export const RICO_SPIKE_RISE_FP = 10_240;
export const RICO_SPIKE_JITTER_FP = 15_360;

/** One point per 40 px climbed. */
export const RICO_PX_PER_POINT = 40;
export const RICO_POINTS_CAP = 110;
export const RICO_SURVIVE_BONUS = 40;

/** The slide speed after this many ticks. */
export function ricoSlide(tick: number): number {
  const steps = Math.trunc(tick / RICO_SLIDE_PERIOD_TICKS);
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

function buildSpikes(seed: number): { rng: number; spikes: RicoSpike[] } {
  let rng = seed | 0;
  const spikes: RicoSpike[] = [];
  const lastOnWall = [-RICO_SPIKE_MIN_GAP_FP * 4, -RICO_SPIKE_MIN_GAP_FP * 4];
  let y = RICO_SPIKE_FIRST_FP;
  for (let index = 0; index < RICO_SPIKE_COUNT; index++) {
    const pick = rngBelow(rng, 2);
    rng = pick.state;
    let wall = pick.value;
    // Keep 90 px between spikes on the same wall; the other wall takes it
    // instead, and if neither can, the height moves on.
    if (y - (lastOnWall[wall] ?? 0) < RICO_SPIKE_MIN_GAP_FP) wall = 1 - wall;
    if (y - (lastOnWall[wall] ?? 0) >= RICO_SPIKE_MIN_GAP_FP) {
      spikes.push({ wall, y });
      lastOnWall[wall] = y;
    }
    const jump = rngBelow(rng, RICO_SPIKE_JITTER_FP);
    rng = jump.state;
    y += RICO_SPIKE_RISE_FP + jump.value;
  }
  return { rng, spikes };
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
    y -= ricoSlide(state.tick);
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
  const earned = Math.min(RICO_POINTS_CAP, Math.trunc(ricoHeightPx(state) / RICO_PX_PER_POINT));
  return clampInt(earned + (ricoSurvived(state) ? RICO_SURVIVE_BONUS : 0), 0, 150);
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
    slide: ricoSlide(state.tick),
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
    const tip = spike.wall === 0 ? inner + 14 : inner - 14;
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

  const remaining = Math.max(0, RICO_RUN_TICKS - state.tick) / TICKS_PER_SECOND;
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(
    `Height ${Math.trunc(ricoHeightPx(state) / 40).toLocaleString("en-GB")} m`,
    14,
    14,
  );
  ctx.textAlign = "right";
  ctx.fillText(`${remaining.toFixed(1)}s`, RICO_WORLD_W - 14, 14);

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
