/**
 * Whack-a-Target — an attention round built on the shared arcade engine.
 *
 * A seeded queue of 100 coloured balls feeds free holes. Balls pop up from the
 * queue, remain for three seconds or until tapped, then free the hole. Queue
 * advancement is part of the fixed-tick replay, so phone and server agree.
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

/* ============================== Constants ============================== */

export const WHACK_RUN_SECONDS = 60;
export const WHACK_RUN_TICKS = WHACK_RUN_SECONDS * TICKS_PER_SECOND;

/** A hole tap: kind 11, `a` = hole 0…15. */
export const WHACK_INPUT_TAP = 11;

export const WHACK_COLS = 4;
export const WHACK_HOLES = WHACK_COLS * WHACK_COLS;
/** Gap between holes in CSS pixels — the overlay grid uses the same value. */
export const WHACK_GAP_PX = 8;

export const WHACK_GOLD = 0;
export const WHACK_RED = 1;

/** The rule flips to TAP RED at 10 s and back to TAP GOLD at 20 s. */
export const WHACK_FLIP_TICKS: readonly number[] = [600, 1200];
export const WHACK_QUEUE_SIZE = 100;
export const WHACK_POP_LIFETIME_TICKS = 3 * TICKS_PER_SECOND;
/** Feed at most one queued ball every three fifths of a second. */
export const WHACK_FEED_INTERVAL_TICKS = 36;
const POP_IN_TICKS = 7;
const FALL_TICKS = 10;

export const WHACK_STATUS_UP = 0;
export const WHACK_STATUS_HIT = 1;
export const WHACK_STATUS_WRONG = 2;
export const WHACK_STATUS_WAITING = 3;
export const WHACK_STATUS_RETIRED = 4;

export const WHACK_INPUT_RANGES: readonly InputRange[] = [
  inputRange(WHACK_INPUT_TAP, [0, WHACK_HOLES - 1]),
];

/** Which colour to tap on a given tick. */
export function whackRule(tick: number): number {
  return tick >= WHACK_FLIP_TICKS[0]! && tick < WHACK_FLIP_TICKS[1]! ? WHACK_RED : WHACK_GOLD;
}

/* =============================== Schedule =============================== */

export interface WhackSchedule {
  /** Seeded queue order; runtime occupancy decides when and where each appears. */
  kind: number[];
}

function buildSchedule(seed: number): { rng: number; schedule: WhackSchedule } {
  let rng = seed | 0;
  const kind: number[] = [];
  for (let i = 0; i < WHACK_QUEUE_SIZE; i++) {
    const draw = rngBelow(rng, 2);
    rng = draw.state;
    kind.push(draw.value);
  }
  return { rng, schedule: { kind } };
}

/* ================================ State ================================ */

export interface WhackState {
  tick: number;
  rng: number;
  schedule: WhackSchedule;
  /** Runtime placement for each queued ball. */
  spawn: number[];
  hole: number[];
  status: number[];
  /** Tick each pop was resolved by a tap (0 while unresolved). */
  doneTick: number[];
  hits: number;
  wrong: number;
  taps: number;
  next: number;
}

function feedNextBall(state: WhackState, tick: number): WhackState {
  const spawn = [...state.spawn];
  const hole = [...state.hole];
  const status = [...state.status];
  const occupied = new Set<number>();
  for (let i = 0; i < state.next; i++) {
    if (status[i] === WHACK_STATUS_UP) occupied.add(hole[i]!);
  }
  const free: number[] = [];
  for (let h = 0; h < WHACK_HOLES; h++) if (!occupied.has(h)) free.push(h);
  let rng = state.rng;
  let next = state.next;
  if (free.length > 0 && next < WHACK_QUEUE_SIZE) {
    const draw = rngBelow(rng, free.length);
    rng = draw.state;
    const h = free.splice(draw.value, 1)[0];
    if (h === undefined) return state;
    spawn[next] = tick;
    hole[next] = h;
    status[next] = WHACK_STATUS_UP;
    next += 1;
  }
  return { ...state, rng, spawn, hole, status, next };
}

function init(seed: number): WhackState {
  const built = buildSchedule(seed);
  return {
    tick: 0,
    rng: built.rng,
    schedule: built.schedule,
    spawn: new Array(WHACK_QUEUE_SIZE).fill(-1),
    hole: new Array(WHACK_QUEUE_SIZE).fill(-1),
    status: new Array(WHACK_QUEUE_SIZE).fill(WHACK_STATUS_WAITING),
    doneTick: new Array(WHACK_QUEUE_SIZE).fill(0),
    hits: 0,
    wrong: 0,
    taps: 0,
    next: 0,
  };
}

function isOver(state: WhackState): boolean {
  return state.tick >= WHACK_RUN_TICKS;
}

/** The pop standing in a hole on a tick, or -1. */
export function whackPopAt(state: WhackState, hole: number, tick: number): number {
  for (let i = 0; i < state.next; i++) {
    if (state.spawn[i]! > tick) continue;
    if (state.hole[i] !== hole) continue;
    if (state.status[i] !== WHACK_STATUS_UP) continue;
    return i;
  }
  return -1;
}

function step(state: WhackState, input: ArcadeInputEvent | null): WhackState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  let next: WhackState = { ...state, tick };
  const rule = whackRule(tick);
  let resolved = false;
  if (input && input.k === WHACK_INPUT_TAP) {
    const hole = clampInt(input.a, 0, WHACK_HOLES - 1);
    next.taps += 1;
    const index = whackPopAt(state, hole, tick);
    if (index >= 0) {
      const status = [...state.status];
      const doneTick = [...state.doneTick];
      const kind = state.schedule.kind[index]!;
      if (kind === rule) {
        status[index] = WHACK_STATUS_HIT;
        next.hits += 1;
      } else {
        status[index] = WHACK_STATUS_WRONG;
        next.wrong += 1;
      }
      doneTick[index] = tick;
      next.status = status;
      next.doneTick = doneTick;
      resolved = true;
    }
  }
  const expiredStatus = [...next.status];
  const expiredDone = [...next.doneTick];
  let retired = false;
  for (let i = 0; i < next.next; i++) {
    if (
      expiredStatus[i] === WHACK_STATUS_UP &&
      tick - next.spawn[i]! >= WHACK_POP_LIFETIME_TICKS
    ) {
      expiredStatus[i] = WHACK_STATUS_RETIRED;
      expiredDone[i] = tick;
      retired = true;
    }
  }
  if (retired) next = { ...next, status: expiredStatus, doneTick: expiredDone };
  if (
    (retired || resolved || (tick - 1) % WHACK_FEED_INTERVAL_TICKS === 0) &&
    next.next < WHACK_QUEUE_SIZE
  ) {
    next = feedNextBall(next, tick);
  }
  return next;
}

/** 2 per correct whack, minus 5 per wrong-colour tap, clamped to 0–150. */
export function whackScore(hits: number, wrong: number): number {
  return clampInt(hits * 2 - wrong * 5, 0, 150);
}

function score(state: WhackState): number {
  return whackScore(state.hits, state.wrong);
}

/* ============================= Checkpoints ============================= */

export const WHACK_CHECKPOINT_INTERVAL = 300;

export interface WhackCheckpointState {
  tick: number;
  hits: number;
  wrong: number;
  taps: number;
  next: number;
  statusHash: number;
}

export interface WhackCheckpoint extends WhackCheckpointState {
  checksum: number;
}

export function whackCheckpointState(state: WhackState): WhackCheckpointState {
  let statusHash = 0;
  for (let i = 0; i < state.status.length; i++) {
    statusHash = (Math.imul(statusHash, 31) + state.status[i]! * 7 + state.doneTick[i]! + state.hole[i]! * 3 + state.spawn[i]!) | 0;
  }
  return {
    tick: state.tick,
    hits: state.hits,
    wrong: state.wrong,
    taps: state.taps,
    next: state.next,
    statusHash,
  };
}

export function whackCheckpoint(state: WhackState): WhackCheckpoint {
  const snapshot = whackCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const WHACK_BG = "#0B0B0F";
export const WHACK_HOLE = "#1B1B24";
export const WHACK_GOLD_HEX = "#F5B82E";
export const WHACK_RED_HEX = "#E0503C";

function discColour(kind: number): string {
  return kind === WHACK_GOLD ? WHACK_GOLD_HEX : WHACK_RED_HEX;
}

function drawDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  kind: number,
): void {
  ctx.fillStyle = discColour(kind);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** Draws the 4×4 board filling the canvas; the overlay grid shares the geometry. */
function draw(ctx: CanvasRenderingContext2D, state: WhackState, size: CanvasSize): void {
  const gap = WHACK_GAP_PX;
  const cellW = (size.width - gap * (WHACK_COLS - 1)) / WHACK_COLS;
  const cellH = (size.height - gap * (WHACK_COLS - 1)) / WHACK_COLS;
  const cell = Math.min(cellW, cellH);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  const origin = (h: number) => ({
    x: (h % WHACK_COLS) * (cellW + gap),
    y: Math.floor(h / WHACK_COLS) * (cellH + gap),
  });

  const flashWrong = new Set<number>();
  for (let i = 0; i < state.status.length; i++) {
    if (state.status[i] === WHACK_STATUS_WRONG && state.tick - state.doneTick[i]! < 12) {
      flashWrong.add(state.hole[i]!);
    }
  }

  for (let h = 0; h < WHACK_HOLES; h++) {
    const { x, y } = origin(h);
    ctx.fillStyle = flashWrong.has(h) ? "rgba(224,80,60,0.45)" : WHACK_HOLE;
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, Math.min(14, cell * 0.18));
    ctx.fill();
  }

  const { kind } = state.schedule;
  const { spawn, hole } = state;
  const tick = state.tick;
  const r = cell * 0.3;
  for (let i = 0; i < state.next; i++) {
    if (spawn[i]! > tick) continue;
    if (state.status[i] === WHACK_STATUS_RETIRED && tick - state.doneTick[i]! >= FALL_TICKS) continue;
    const { x, y } = origin(hole[i]!);
    const cx = x + cellW / 2;
    const cy = y + cellH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, Math.min(14, cell * 0.18));
    ctx.clip();
    if (state.status[i] === WHACK_STATUS_UP) {
      const grow = Math.min(1, (tick - spawn[i]! + 1) / POP_IN_TICKS);
      drawDisc(ctx, cx, cy + (1 - grow) * cellH * 0.35, r * (0.4 + 0.6 * grow), kind[i]!);
    } else if (state.status[i] === WHACK_STATUS_RETIRED) {
      const fall = (tick - state.doneTick[i]!) / FALL_TICKS;
      ctx.globalAlpha = 1 - fall;
      drawDisc(ctx, cx, cy + fall * cellH * 0.5, r * (1 - 0.3 * fall), kind[i]!);
    } else if (state.status[i] === WHACK_STATUS_HIT) {
      const age = tick - state.doneTick[i]!;
      if (age < 10) {
        ctx.globalAlpha = 1 - age / 10;
        ctx.strokeStyle = WHACK_GOLD_HEX;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1 + age * 0.08), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

export const whackGame: ArcadeGame<WhackState, ArcadeInputEvent | null> = {
  key: "whack",
  runTicks: WHACK_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: WHACK_INPUT_RANGES,
};
