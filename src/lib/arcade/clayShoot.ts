/**
 * Clay Shoot — a speed round on the shared arcade engine.
 *
 * Fifteen clays fly a parabola across a side-on sky on a schedule drawn
 * entirely from the seed at init. A tap is a shot (kind 11, `a` = x px,
 * `b` = y px in world pixels) judged against the clays' positions on the tick
 * it was recorded. Physics is integer 1/256-pixel units; no floats in the sim.
 */

import {
  clampInt,
  inputRange,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { icos, isin } from "./trig";

/* ============================== Config ============================== */

export const CLAY_CONFIG = {
  runSeconds: 45,
  /** World size in pixels; the canvas letterboxes it. */
  worldW: 360,
  worldH: 560,
  clays: 15,
  /** Clays 1–7 fly alone; 8–15 come in pairs. */
  singles: 7,
  firstLaunchTick: 60,
  singleGapTicks: 180,
  singleJitterTicks: 30,
  firstPairTick: 1320,
  pairGapTicks: 300,
  pairJitterTicks: 30,
  /** Second clay of a pair leaves 20–50 ticks after the first. */
  pairOffsetMin: 20,
  pairOffsetSpan: 31,
  /** Launch height, px from the top. */
  launchY: 500,
  /** Launch x just off each edge, px. */
  launchInset: 12,
  /** Launch speed in 1/256 px per tick: base + seeded spread + rise per clay. */
  speedBase: 1840,
  speedSpread: 121,
  speedRisePerClay: 16,
  /** Launch angle above horizontal, 65536 units per turn (58°–70°). */
  angleMin: 10559,
  angleSpan: 2185,
  /** Gravity, 1/256 px per tick². */
  gravity: 20,
  /** Shot hit radius and drawn clay radius, px. */
  hitRadius: 30,
  clayRadius: 13,
  /** A clay this far past an edge (px) has left the arena. */
  exitMargin: 20,
  pointsPerHit: 10,
} as const;

export const CLAY_RUN_TICKS = CLAY_CONFIG.runSeconds * TICKS_PER_SECOND;
export const CLAY_W = CLAY_CONFIG.worldW;
export const CLAY_H = CLAY_CONFIG.worldH;
export const CLAY_COUNT = CLAY_CONFIG.clays;

/** A shot: kind 11, a = x px, b = y px. */
export const CLAY_INPUT_SHOT = 11;
export const CLAY_INPUT_RANGES: readonly InputRange[] = [
  inputRange(CLAY_INPUT_SHOT, [0, CLAY_W], [0, CLAY_H]),
];

export const CLAY_WAITING = 0;
export const CLAY_FLYING = 1;
export const CLAY_HIT = 2;
export const CLAY_MISSED = 3;

/** Log codes. */
export const CLAY_LOG_HIT = 1;
export const CLAY_LOG_MISS_SHOT = 2;
export const CLAY_LOG_ESCAPED = 3;
const LOG_KEEP = 16;

/* ============================== Schedule ============================== */

export interface ClaySchedule {
  launch: number[];
  /** 0 = from the left, 1 = from the right. */
  side: number[];
  vx: number[];
  vy: number[];
}

function buildSchedule(seed: number): { rng: number; schedule: ClaySchedule } {
  const c = CLAY_CONFIG;
  let rng = seed | 0;
  const draw = (bound: number): number => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const launch: number[] = [];
  const side: number[] = [];
  for (let i = 0; i < c.singles; i++) {
    launch.push(c.firstLaunchTick + i * c.singleGapTicks + draw(c.singleJitterTicks));
    side.push(draw(2));
  }
  for (let p = 0; launch.length < c.clays; p++) {
    const t = c.firstPairTick + p * c.pairGapTicks + draw(c.pairJitterTicks);
    const s = draw(2);
    launch.push(t);
    side.push(s);
    if (launch.length < c.clays) {
      launch.push(t + c.pairOffsetMin + draw(c.pairOffsetSpan));
      side.push(1 - s);
    }
  }
  const vx: number[] = [];
  const vy: number[] = [];
  for (let i = 0; i < c.clays; i++) {
    const speed = c.speedBase + draw(c.speedSpread) + i * c.speedRisePerClay;
    const angle = c.angleMin + draw(c.angleSpan);
    const h = (speed * icos(angle)) >> 14;
    vx.push(side[i] === 0 ? h : -h);
    vy.push(-((speed * isin(angle)) >> 14));
  }
  return { rng, schedule: { launch, side, vx, vy } };
}

/* ================================ State ================================ */

export interface ClayState {
  tick: number;
  rng: number;
  schedule: ClaySchedule;
  x: number[];
  y: number[];
  vy: number[];
  status: number[];
  doneTick: number[];
  /** Next clay in the launch queue. */
  next: number;
  hits: number;
  missed: number;
  shots: number;
  shotX: number;
  shotY: number;
  shotTick: number;
  shotHit: number;
  /** Recent events, packed tick·256 + code·32 + clay. */
  log: number[];
}

function init(seed: number): ClayState {
  const built = buildSchedule(seed);
  const n = CLAY_CONFIG.clays;
  return {
    tick: 0,
    rng: built.rng,
    schedule: built.schedule,
    x: new Array(n).fill(0),
    y: new Array(n).fill(0),
    vy: new Array(n).fill(0),
    status: new Array(n).fill(CLAY_WAITING),
    doneTick: new Array(n).fill(0),
    next: 0,
    hits: 0,
    missed: 0,
    shots: 0,
    shotX: 0,
    shotY: 0,
    shotTick: -100,
    shotHit: 0,
    log: [],
  };
}

function isOver(state: ClayState): boolean {
  return state.tick >= CLAY_RUN_TICKS;
}

function pushLog(log: number[], tick: number, code: number, clay: number): number[] {
  const out = [...log, tick * 256 + code * 32 + clay];
  return out.length > LOG_KEEP ? out.slice(out.length - LOG_KEEP) : out;
}

export function unpackClayLog(entry: number): { tick: number; code: number; clay: number } {
  return { tick: Math.floor(entry / 256), code: Math.floor(entry / 32) % 8, clay: entry % 32 };
}

function step(state: ClayState, input: ArcadeInputEvent | null): ClayState {
  if (isOver(state)) return state;
  const c = CLAY_CONFIG;
  const tick = state.tick + 1;
  const x = [...state.x];
  const y = [...state.y];
  const vy = [...state.vy];
  const status = [...state.status];
  const doneTick = [...state.doneTick];
  const next: ClayState = { ...state, tick, x, y, vy, status, doneTick };
  const { launch, side, vx } = state.schedule;

  while (next.next < c.clays && launch[next.next]! <= tick) {
    const i = next.next;
    status[i] = CLAY_FLYING;
    x[i] = (side[i] === 0 ? -c.launchInset : c.worldW + c.launchInset) * 256;
    y[i] = c.launchY * 256;
    vy[i] = state.schedule.vy[i]!;
    next.next = i + 1;
  }

  for (let i = 0; i < c.clays; i++) {
    if (status[i] !== CLAY_FLYING) continue;
    x[i] = x[i]! + vx[i]!;
    vy[i] = vy[i]! + c.gravity;
    y[i] = y[i]! + vy[i]!;
  }

  if (input && input.k === CLAY_INPUT_SHOT) {
    const sx = clampInt(input.a, 0, c.worldW) * 256;
    const sy = clampInt(input.b, 0, c.worldH) * 256;
    next.shots += 1;
    next.shotX = sx;
    next.shotY = sy;
    next.shotTick = tick;
    const r = c.hitRadius * 256;
    let best = -1;
    let bestD = r * r + 1;
    for (let i = 0; i < c.clays; i++) {
      if (status[i] !== CLAY_FLYING) continue;
      const dx = x[i]! - sx;
      const dy = y[i]! - sy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      status[best] = CLAY_HIT;
      doneTick[best] = tick;
      next.hits += 1;
      next.shotHit = 1;
      next.log = pushLog(next.log, tick, CLAY_LOG_HIT, best);
    } else {
      next.shotHit = 0;
      next.log = pushLog(next.log, tick, CLAY_LOG_MISS_SHOT, 0);
    }
  }

  const m = c.exitMargin * 256;
  for (let i = 0; i < c.clays; i++) {
    if (status[i] !== CLAY_FLYING) continue;
    const gone =
      (vx[i]! > 0 && x[i]! > c.worldW * 256 + m) ||
      (vx[i]! < 0 && x[i]! < -m) ||
      y[i]! > c.worldH * 256 + m;
    if (gone) {
      status[i] = CLAY_MISSED;
      doneTick[i] = tick;
      next.missed += 1;
      next.log = pushLog(next.log, tick, CLAY_LOG_ESCAPED, i);
    }
  }
  return next;
}

export function clayScore(hits: number): number {
  return clampInt(hits * CLAY_CONFIG.pointsPerHit, 0, CLAY_CONFIG.clays * CLAY_CONFIG.pointsPerHit);
}

function score(state: ClayState): number {
  return clayScore(state.hits);
}

/* ============================= Checkpoints ============================= */

export const CLAY_CHECKPOINT_INTERVAL = 300;

export interface ClayCheckpointState {
  tick: number;
  hits: number;
  missed: number;
  shots: number;
  next: number;
  posHash: number;
}

export interface ClayCheckpoint extends ClayCheckpointState {
  checksum: number;
}

export const CLAY_CHECKPOINT_FIELDS = ["tick", "hits", "missed", "shots", "next", "posHash"] as const;

export function clayCheckpoint(state: ClayState): ClayCheckpoint {
  let posHash = 0;
  for (let i = 0; i < state.status.length; i++) {
    posHash =
      (Math.imul(posHash, 31) + state.status[i]! * 7 + state.x[i]! + Math.imul(state.y[i]!, 3)) | 0;
  }
  const snapshot: ClayCheckpointState = {
    tick: state.tick,
    hits: state.hits,
    missed: state.missed,
    shots: state.shots,
    next: state.next,
    posHash,
  };
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const CLAY_ORANGE = "#E8762C";

/** Letterbox mapping shared by drawing and tap conversion. */
export function clayView(size: CanvasSize): { scale: number; ox: number; oy: number } {
  const scale = Math.min(size.width / CLAY_W, size.height / CLAY_H);
  return { scale, ox: (size.width - CLAY_W * scale) / 2, oy: (size.height - CLAY_H * scale) / 2 };
}

function draw(ctx: CanvasRenderingContext2D, state: ClayState, size: CanvasSize): void {
  const { scale, ox, oy } = clayView(size);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  const sky = ctx.createLinearGradient(0, 0, 0, CLAY_H);
  sky.addColorStop(0, "#1D3B5C");
  sky.addColorStop(1, "#6F9BC0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CLAY_W, CLAY_H);
  ctx.fillStyle = "#2F4A2A";
  ctx.fillRect(0, CLAY_CONFIG.launchY + 18, CLAY_W, CLAY_H);

  const r = CLAY_CONFIG.clayRadius;
  const tick = state.tick;
  for (let i = 0; i < state.status.length; i++) {
    const px = state.x[i]! / 256;
    const py = state.y[i]! / 256;
    if (state.status[i] === CLAY_FLYING) {
      ctx.fillStyle = CLAY_ORANGE;
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(px - 3, py - 2, r * 0.45, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (state.status[i] === CLAY_HIT) {
      const age = tick - state.doneTick[i]!;
      if (age < 20) {
        ctx.globalAlpha = 1 - age / 20;
        ctx.fillStyle = CLAY_ORANGE;
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 + i;
          const d = 4 + age * 2.2;
          ctx.fillRect(px + Math.cos(a) * d - 3, py + Math.sin(a) * d + age * age * 0.05 - 2, 6, 4);
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  const shotAge = tick - state.shotTick;
  if (shotAge >= 0 && shotAge < 14 && state.shotHit === 0) {
    ctx.globalAlpha = 1 - shotAge / 14;
    ctx.fillStyle = "#D9D9D9";
    ctx.beginPath();
    ctx.arc(state.shotX / 256, state.shotY / 256, 5 + shotAge * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export const clayGame: ArcadeGame<ClayState, ArcadeInputEvent | null> = {
  key: "clayshoot",
  runTicks: CLAY_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: CLAY_INPUT_RANGES,
};
