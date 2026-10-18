/**
 * Whack-a-Target — an attention round built on the shared arcade engine.
 *
 * The whole run is a seeded schedule built at init: irregular rule flips
 * (3–5, periods ≥ 6 s, none in the last 5 s) and pops into the 4×4 holes with
 * a shrinking up-window (900 ms → 450 ms), at most three up at once and never
 * the same hole twice in a row. 10% of pops after 5 s are bombs. Taps only
 * shorten a pop, so the schedule is identical for every player and the replay.
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
import { bandCurve, bandPoints } from "./scoreBands";

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
export const WHACK_BOMB = 2;

/** Up-window: 54 ticks (900 ms) at the start shrinking to 36 (600 ms) at the end. */
export const WHACK_LIFE_START_TICKS = 54;
export const WHACK_LIFE_END_TICKS = 36;
/** Gap between pops: 42 ticks at the start ramping to 13 at the end, plus 0…5 jitter,
 *  so the final third regularly has two or three balls up together (cap 3). */
const POP_GAP_START = 42;
const POP_GAP_END = 13;
const POP_GAP_JITTER = 6;
const FIRST_POP_TICK = 30;
export const WHACK_MAX_UP = 3;
export const WHACK_BOMB_PERCENT = 10;
export const WHACK_NO_BOMB_TICKS = 5 * TICKS_PER_SECOND;
/** Flip schedule bounds. */
export const WHACK_MIN_FLIPS = 3;
export const WHACK_MAX_FLIPS = 5;
export const WHACK_MIN_PERIOD_TICKS = 6 * TICKS_PER_SECOND;
export const WHACK_NO_FLIP_TAIL_TICKS = 5 * TICKS_PER_SECOND;
/** No target of the current colour pops in the final second. */
export const WHACK_NO_TARGET_TAIL_TICKS = TICKS_PER_SECOND;
export const WHACK_HIT_POINTS = 135;
export const WHACK_WRONG_PENALTY = 3;
export const WHACK_BOMB_PENALTY = 5;
/** A tap on an empty hole. */
export const WHACK_EMPTY_PENALTY = 3;
export const WHACK_PERFECT_BONUS = 15;
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

/** Up-window for a pop starting on `tick`. */
export function whackLife(tick: number): number {
  const t = clampInt(tick, 0, WHACK_RUN_TICKS);
  return WHACK_LIFE_START_TICKS - Math.floor(((WHACK_LIFE_START_TICKS - WHACK_LIFE_END_TICKS) * t) / WHACK_RUN_TICKS);
}

/** Which colour to tap on a tick, given the seeded flip ticks (starts on gold). */
export function whackRule(flips: readonly number[], tick: number): number {
  let rule = WHACK_GOLD;
  for (const flip of flips) if (tick >= flip) rule ^= 1;
  return rule;
}

/* =============================== Schedule =============================== */

export interface WhackSchedule {
  flips: number[];
  /** Pop tick, hole, kind (gold/red/bomb) and up-window per pop. */
  at: number[];
  hole: number[];
  kind: number[];
  life: number[];
  /** Pops that are the correct colour when they appear. */
  total: number;
}

function buildSchedule(seed: number): { rng: number; schedule: WhackSchedule } {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const flipCount = WHACK_MIN_FLIPS + draw(WHACK_MAX_FLIPS - WHACK_MIN_FLIPS + 1);
  const lastFlip = WHACK_RUN_TICKS - WHACK_NO_FLIP_TAIL_TICKS;
  const slack = lastFlip - WHACK_MIN_PERIOD_TICKS * flipCount;
  const offsets: number[] = [];
  for (let i = 0; i < flipCount; i++) offsets.push(draw(slack + 1));
  offsets.sort((a, b) => a - b);
  const flips = offsets.map((off, i) => WHACK_MIN_PERIOD_TICKS * (i + 1) + off);

  const at: number[] = [];
  const hole: number[] = [];
  const kind: number[] = [];
  const life: number[] = [];
  let total = 0;
  let tick = FIRST_POP_TICK;
  let prevHole = -1;
  while (tick < WHACK_RUN_TICKS) {
    const l = whackLife(tick);
    // A pop must not straddle a flip, so its role never changes while up.
    const crossing = flips.find((f) => tick < f && tick + l > f);
    if (crossing !== undefined) { tick = crossing; continue; }
    const busy = new Set<number>();
    for (let i = 0; i < at.length; i++) if (at[i]! + life[i]! > tick) busy.add(hole[i]!);
    if (busy.size >= WHACK_MAX_UP) { tick += 1; continue; }
    const free: number[] = [];
    for (let h = 0; h < WHACK_HOLES; h++) if (!busy.has(h) && h !== prevHole) free.push(h);
    const h = free[draw(free.length)]!;
    const rule = whackRule(flips, tick);
    let k: number;
    if (tick >= WHACK_NO_BOMB_TICKS && draw(100) < WHACK_BOMB_PERCENT) k = WHACK_BOMB;
    else k = draw(100) < 65 ? rule : rule ^ 1;
    if (k === rule && tick >= WHACK_RUN_TICKS - WHACK_NO_TARGET_TAIL_TICKS) k = rule ^ 1;
    if (k === rule) total += 1;
    at.push(tick); hole.push(h); kind.push(k); life.push(l);
    prevHole = h;
    const progress = Math.floor(((POP_GAP_START - POP_GAP_END) * tick) / WHACK_RUN_TICKS);
    tick += POP_GAP_START - progress + draw(POP_GAP_JITTER);
  }
  return { rng, schedule: { flips, at, hole, kind, life, total } };
}

/* ================================ State ================================ */

export interface WhackState {
  /** whackRev 1 only (scoring targets): 1 = the score is lifted through WHACK_TARGET_LIFT. Absent on older rounds. */
  tgt?: number;
  tick: number;
  rng: number;
  schedule: WhackSchedule;
  status: number[];
  /** Tick each pop was resolved (0 while unresolved). */
  doneTick: number[];
  hits: number;
  /** Taps on the wrong-colour ball. */
  wrong: number;
  /** Taps on bombs. */
  bombs: number;
  /** Taps that hit no ball. */
  empty: number;
  taps: number;
  /** Pops released so far. */
  next: number;
}

function init(seed: number): WhackState {
  const built = buildSchedule(seed);
  const n = built.schedule.at.length;
  return {
    tick: 0,
    rng: built.rng,
    schedule: built.schedule,
    status: new Array(n).fill(WHACK_STATUS_WAITING),
    doneTick: new Array(n).fill(0),
    hits: 0,
    wrong: 0,
    bombs: 0,
    empty: 0,
    taps: 0,
    next: 0,
  };
}

function isOver(state: WhackState): boolean {
  return state.tick >= WHACK_RUN_TICKS;
}

/** The pop standing in a hole, or -1. */
export function whackPopAt(state: WhackState, hole: number): number {
  for (let i = 0; i < state.next; i++) {
    if (state.status[i] === WHACK_STATUS_UP && state.schedule.hole[i] === hole) return i;
  }
  return -1;
}

function step(state: WhackState, input: ArcadeInputEvent | null): WhackState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s = state.schedule;
  const status = [...state.status];
  const doneTick = [...state.doneTick];
  let { hits, wrong, bombs, empty, taps, next } = state;
  // Retire expired pops, then release pops due this tick.
  for (let i = 0; i < next; i++) {
    if (status[i] === WHACK_STATUS_UP && tick >= s.at[i]! + s.life[i]!) {
      status[i] = WHACK_STATUS_RETIRED;
      doneTick[i] = tick;
    }
  }
  while (next < s.at.length && s.at[next]! <= tick) {
    status[next] = WHACK_STATUS_UP;
    next += 1;
  }
  if (input && input.k === WHACK_INPUT_TAP) {
    const h = clampInt(input.a, 0, WHACK_HOLES - 1);
    taps += 1;
    let struck = false;
    for (let i = 0; i < next; i++) {
      if (status[i] !== WHACK_STATUS_UP || s.hole[i] !== h) continue;
      if (s.kind[i] === whackRule(s.flips, s.at[i]!)) { status[i] = WHACK_STATUS_HIT; hits += 1; }
      else if (s.kind[i] === WHACK_BOMB) { status[i] = WHACK_STATUS_WRONG; bombs += 1; }
      else { status[i] = WHACK_STATUS_WRONG; wrong += 1; }
      doneTick[i] = tick;
      struck = true;
      break;
    }
    if (!struck) empty += 1;
  }
  return { ...state, tick, status, doneTick, hits, wrong, bombs, empty, taps, next };
}

/** round(135 × hits ÷ total) − 3 per wrong-colour tap − 5 per bomb − 3 per empty tap; +15 if every target hit; clamp 0…150. */
export function whackScore(hits: number, wrong: number, total: number, empty = 0, bombs = 0): number {
  if (total <= 0) return 0;
  const base = Math.floor((2 * WHACK_HIT_POINTS * hits + total) / (2 * total));
  const bonus = hits >= total ? WHACK_PERFECT_BONUS : 0;
  return clampInt(base - wrong * WHACK_WRONG_PENALTY - bombs * WHACK_BOMB_PENALTY - empty * WHACK_EMPTY_PENALTY + bonus, 0, 150);
}

function score(state: WhackState): number {
  const raw = whackScore(state.hits, state.wrong, state.schedule.total, state.empty, state.bombs);
  return state.tgt ? whackLift(raw) : raw;
}

/**
 * whackRev 1 (scoring targets, 18 Oct 2026, docs/scoring-targets.md): the same
 * play and the same hit share and costs, then the result lifted so the simulated
 * players' 62 / 102 / 118 / 133 (average / good / great / near-perfect) land
 * about 100 / 120 / 135 / 145; 0 stays 0 and 150 stays 150.
 */
export const WHACK_REV_TARGET = 1;
export const WHACK_TARGET_LIFT = bandCurve([0, 62, 102, 118, 133, 150], [0, 100, 120, 135, 145, 150]);
export function whackLift(raw: number): number {
  return clampInt(bandPoints(WHACK_TARGET_LIFT, raw), 0, 150);
}

/* ============================= Checkpoints ============================= */

export const WHACK_CHECKPOINT_INTERVAL = 300;

export interface WhackCheckpointState {
  tick: number;
  hits: number;
  wrong: number;
  bombs: number;
  empty: number;
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
    statusHash = (Math.imul(statusHash, 31) + state.status[i]! * 7 + state.doneTick[i]!) | 0;
  }
  return {
    tick: state.tick,
    hits: state.hits,
    wrong: state.wrong,
    bombs: state.bombs,
    empty: state.empty,
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
const WHACK_BOMB_HEX = "#2A2A33";

function drawDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  kind: number,
): void {
  ctx.fillStyle = kind === WHACK_GOLD ? WHACK_GOLD_HEX : kind === WHACK_RED ? WHACK_RED_HEX : WHACK_BOMB_HEX;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (kind === WHACK_BOMB) {
    ctx.strokeStyle = "#F2F2F2";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.5, cy - r * 0.7);
    ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 1.2, cx + r * 1.1, cy - r * 0.9);
    ctx.stroke();
    ctx.fillStyle = WHACK_RED_HEX;
    ctx.font = `bold ${Math.round(r)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✕", cx, cy);
    return;
  }
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

  const { kind, hole, at: spawn } = state.schedule;
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

/** whackRev 1: the same game, its score lifted (WHACK_TARGET_LIFT). */
export const whackTargetGame: ArcadeGame<WhackState, ArcadeInputEvent | null> = { ...whackGame, init: (seed) => ({ ...init(seed), tgt: 1 }) };

/** The game for a stored whackRev (absent = the original score). */
export function whackGameFor(rev?: number | null): ArcadeGame<WhackState, ArcadeInputEvent | null> {
  return rev === WHACK_REV_TARGET ? whackTargetGame : whackGame;
}
