/**
 * Whack-a-Target — an attention round built on the shared arcade engine.
 *
 * The whole pop schedule (tick, hole, colour, window) is generated from the
 * seed at init, independent of how the player taps, so everyone faces the
 * identical run. Taps arrive as kind 11 with the hole in `a`; judging compares
 * the tap's sim tick against the schedule, so phone and server always agree.
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

export const WHACK_RUN_SECONDS = 30;
export const WHACK_RUN_TICKS = WHACK_RUN_SECONDS * TICKS_PER_SECOND;

/** A hole tap: kind 11, `a` = hole 0…15. */
export const WHACK_INPUT_TAP = 11;

export const WHACK_COLS = 4;
export const WHACK_HOLES = WHACK_COLS * WHACK_COLS;
/** Gap between holes in CSS pixels — the overlay grid uses the same value. */
export const WHACK_GAP_PX = 8;

export const WHACK_GOLD = 0;
export const WHACK_RED = 1;
export const WHACK_BOMB = 2;

/** The rule flips to TAP RED at 10 s and back to TAP GOLD at 20 s. */
export const WHACK_FLIP_TICKS: readonly number[] = [600, 1200];
/** No bombs in the first five seconds. */
export const WHACK_BOMB_FROM = 300;
export const WHACK_MAX_UP = 3;

/** Window a target stays up: 900 ms at the start, 450 ms by the end. */
export const WHACK_WINDOW_START = 54;
export const WHACK_WINDOW_END = 27;
/** Ticks between scheduled pops: 40 at the start, 26 by the end. */
const SPAWN_GAP_START = 40;
const SPAWN_GAP_END = 26;
const POP_IN_TICKS = 7;
const FALL_TICKS = 10;

export const WHACK_STATUS_UP = 0;
export const WHACK_STATUS_HIT = 1;
export const WHACK_STATUS_WRONG = 2;

export const WHACK_INPUT_RANGES: readonly InputRange[] = [
  inputRange(WHACK_INPUT_TAP, [0, WHACK_HOLES - 1]),
];

/** Which colour to tap on a given tick. */
export function whackRule(tick: number): number {
  return tick >= WHACK_FLIP_TICKS[0]! && tick < WHACK_FLIP_TICKS[1]! ? WHACK_RED : WHACK_GOLD;
}

export function whackWindow(tick: number): number {
  return (
    WHACK_WINDOW_START -
    Math.floor(((WHACK_WINDOW_START - WHACK_WINDOW_END) * tick) / WHACK_RUN_TICKS)
  );
}

/* =============================== Schedule =============================== */

export interface WhackSchedule {
  spawn: number[];
  hole: number[];
  kind: number[];
  dur: number[];
  /** Correct-colour targets in the run — the round's par. */
  totalTargets: number;
}

function buildSchedule(seed: number): { rng: number; schedule: WhackSchedule } {
  let rng = seed | 0;
  const spawn: number[] = [];
  const hole: number[] = [];
  const kind: number[] = [];
  const dur: number[] = [];
  let totalTargets = 0;
  let previousHole = -1;
  let t = 30;
  const lastSpawn = WHACK_RUN_TICKS - WHACK_WINDOW_END - 4;

  while (t <= lastSpawn) {
    const window = whackWindow(t);
    // A target never straddles a rule flip, so its colour is unambiguous.
    const flip = WHACK_FLIP_TICKS.find((f) => t < f && t + window > f);
    if (flip !== undefined) {
      t = flip + 6;
      continue;
    }
    const occupied = new Set<number>();
    for (let i = spawn.length - 1; i >= 0 && i >= spawn.length - 8; i--) {
      if (spawn[i]! <= t && t < spawn[i]! + dur[i]!) occupied.add(hole[i]!);
    }
    if (occupied.size >= WHACK_MAX_UP) {
      t += 6;
      continue;
    }
    const free: number[] = [];
    for (let h = 0; h < WHACK_HOLES; h++) {
      if (h !== previousHole && !occupied.has(h)) free.push(h);
    }
    const holeDraw = rngBelow(rng, free.length);
    rng = holeDraw.state;
    const chosen = free[holeDraw.value]!;

    const kindDraw = rngBelow(rng, 100);
    rng = kindDraw.state;
    const rule = whackRule(t);
    let chosenKind: number;
    if (t >= WHACK_BOMB_FROM && kindDraw.value < 10) chosenKind = WHACK_BOMB;
    else if (kindDraw.value < 10 + 60) chosenKind = rule;
    else chosenKind = rule === WHACK_GOLD ? WHACK_RED : WHACK_GOLD;
    if (chosenKind === rule) totalTargets += 1;

    spawn.push(t);
    hole.push(chosen);
    kind.push(chosenKind);
    dur.push(window);
    previousHole = chosen;

    const gapBase =
      SPAWN_GAP_START - Math.floor(((SPAWN_GAP_START - SPAWN_GAP_END) * t) / WHACK_RUN_TICKS);
    const jitter = rngBelow(rng, 9);
    rng = jitter.state;
    t += gapBase - 4 + jitter.value;
  }

  return { rng, schedule: { spawn, hole, kind, dur, totalTargets } };
}

/* ================================ State ================================ */

export interface WhackState {
  tick: number;
  rng: number;
  schedule: WhackSchedule;
  /** One status per pop: up/unresolved, hit, or wrongly tapped. */
  status: number[];
  /** Tick each pop was resolved by a tap (0 while unresolved). */
  doneTick: number[];
  hits: number;
  wrong: number;
  taps: number;
}

function init(seed: number): WhackState {
  const built = buildSchedule(seed);
  return {
    tick: 0,
    rng: built.rng,
    schedule: built.schedule,
    status: built.schedule.spawn.map(() => WHACK_STATUS_UP),
    doneTick: built.schedule.spawn.map(() => 0),
    hits: 0,
    wrong: 0,
    taps: 0,
  };
}

function isOver(state: WhackState): boolean {
  return state.tick >= WHACK_RUN_TICKS;
}

/** The pop standing in a hole on a tick, or -1. */
export function whackPopAt(state: WhackState, hole: number, tick: number): number {
  const { spawn, dur } = state.schedule;
  for (let i = 0; i < spawn.length; i++) {
    if (spawn[i]! > tick) break;
    if (state.schedule.hole[i] !== hole) continue;
    if (state.status[i] !== WHACK_STATUS_UP) continue;
    if (tick < spawn[i]! + dur[i]!) return i;
  }
  return -1;
}

function step(state: WhackState, input: ArcadeInputEvent | null): WhackState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const next: WhackState = { ...state, tick };
  if (input && input.k === WHACK_INPUT_TAP) {
    const hole = clampInt(input.a, 0, WHACK_HOLES - 1);
    next.taps += 1;
    const index = whackPopAt(state, hole, tick);
    if (index >= 0) {
      const status = [...state.status];
      const doneTick = [...state.doneTick];
      const kind = state.schedule.kind[index]!;
      if (kind !== WHACK_BOMB && kind === whackRule(tick)) {
        status[index] = WHACK_STATUS_HIT;
        next.hits += 1;
      } else {
        status[index] = WHACK_STATUS_WRONG;
        next.wrong += 1;
      }
      doneTick[index] = tick;
      next.status = status;
      next.doneTick = doneTick;
    }
  }
  return next;
}

/** round(100 × hits ÷ targets) − 10 per wrong tap, min 0; +50 perfect; cap 150. */
export function whackScore(hits: number, total: number, wrong: number): number {
  if (total <= 0) return 0;
  const base = Math.floor((200 * hits + total) / (2 * total));
  let points = Math.max(0, base - 10 * wrong);
  if (hits >= total && wrong === 0) points += 50;
  return clampInt(points, 0, 150);
}

function score(state: WhackState): number {
  return whackScore(state.hits, state.schedule.totalTargets, state.wrong);
}

/* ============================= Checkpoints ============================= */

export const WHACK_CHECKPOINT_INTERVAL = 300;

export interface WhackCheckpointState {
  tick: number;
  hits: number;
  wrong: number;
  taps: number;
  statusHash: number;
}

export interface WhackCheckpoint extends WhackCheckpointState {
  checksum: number;
}

export function whackCheckpointState(state: WhackState): WhackCheckpointState {
  let statusHash = 0;
  for (let i = 0; i < state.status.length; i++) {
    statusHash = (Math.imul(statusHash, 31) + state.status[i]! * 7 + state.doneTick[i]!) | 0;
  }
  return {
    tick: state.tick,
    hits: state.hits,
    wrong: state.wrong,
    taps: state.taps,
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
  return kind === WHACK_GOLD ? WHACK_GOLD_HEX : kind === WHACK_RED ? WHACK_RED_HEX : "#050507";
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
  if (kind === WHACK_BOMB) {
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = WHACK_GOLD_HEX;
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.5, cy - r * 0.6);
    ctx.lineTo(cx + r * 0.8, cy - r * 1.0);
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
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
      flashWrong.add(state.schedule.hole[i]!);
    }
  }

  for (let h = 0; h < WHACK_HOLES; h++) {
    const { x, y } = origin(h);
    ctx.fillStyle = flashWrong.has(h) ? "rgba(224,80,60,0.45)" : WHACK_HOLE;
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, Math.min(14, cell * 0.18));
    ctx.fill();
  }

  const { spawn, dur, hole, kind } = state.schedule;
  const tick = state.tick;
  const r = cell * 0.3;
  for (let i = 0; i < spawn.length; i++) {
    if (spawn[i]! > tick) break;
    const end = spawn[i]! + dur[i]!;
    if (end + FALL_TICKS + 12 < tick) continue;
    const { x, y } = origin(hole[i]!);
    const cx = x + cellW / 2;
    const cy = y + cellH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, Math.min(14, cell * 0.18));
    ctx.clip();
    if (state.status[i] === WHACK_STATUS_UP) {
      if (tick < end) {
        const grow = Math.min(1, (tick - spawn[i]! + 1) / POP_IN_TICKS);
        drawDisc(ctx, cx, cy + (1 - grow) * cellH * 0.35, r * (0.4 + 0.6 * grow), kind[i]!);
      } else if (tick < end + FALL_TICKS) {
        const fall = (tick - end) / FALL_TICKS;
        ctx.globalAlpha = 1 - fall;
        drawDisc(ctx, cx, cy + fall * cellH * 0.5, r * (1 - 0.3 * fall), kind[i]!);
      }
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
