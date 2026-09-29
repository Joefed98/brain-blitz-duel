/**
 * Flip — a corridor runner. The runner runs on the floor or the ceiling; a tap
 * (k = 0) flips gravity and it arcs across in 14 ticks. Hazards sit on one
 * surface at a time; the course is drawn at init and checked for survivability.
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

const FP = 256;
export const FLIP_WORLD_W = 390;
export const FLIP_WORLD_H = 620;
export const FLIP_RUN_TICKS = 60 * TICKS_PER_SECOND;
export const FLIP_INPUT_TAP = 0;
export const FLIP_ARC_TICKS = 14;
/** The course check only flips after this long on a surface. */
const SOLVER_LANDED = 20;

const SPEED_START = 768;
const SPEED_STEP = 77;
const SPEED_STEP_TICKS = 10 * TICKS_PER_SECOND;
const SPEED_CAP = 1382;
const CLEAR_TICKS = 3 * TICKS_PER_SECOND;

export const FLIP_FLOOR_Y = 440;
export const FLIP_CEIL_Y = 180;
const RUNNER_X = 90;
const RUNNER_HALF = 12 * FP;

export const FLIP_SPIKE = 0;
export const FLIP_GAP = 1;
export const FLIP_OVERHANG = 2;

export const FLIP_INPUT_RANGES: readonly InputRange[] = [inputRange(FLIP_INPUT_TAP)];

export function flipSpeed(tick: number): number {
  return Math.min(SPEED_CAP, SPEED_START + SPEED_STEP * Math.trunc(tick / SPEED_STEP_TICKS));
}

const X_AT: readonly number[] = (() => {
  const out = [0];
  let x = 0;
  for (let t = 1; t <= FLIP_RUN_TICKS; t++) {
    x += flipSpeed(t);
    out.push(x);
  }
  return out;
})();

/* ================================ Course =============================== */

export interface FlipSeg {
  x0: number;
  x1: number;
  /** 0 floor, 1 ceiling. */
  side: number;
  kind: number;
}

/** Runner timers: side is the surface it is on or heading to; flipT > 0 while airborne. */
interface Mover {
  side: number;
  flipT: number;
}

function moveRunner(m: Mover, tap: boolean): void {
  if (m.flipT > 0) m.flipT -= 1;
  else if (tap) {
    m.side ^= 1;
    m.flipT = FLIP_ARC_TICKS;
  }
}

function blocked(m: Mover, x: number, seg: FlipSeg): boolean {
  return m.flipT === 0 && m.side === seg.side && x + RUNNER_HALF >= seg.x0 && x - RUNNER_HALF <= seg.x1;
}

function buildCourse(seed: number): { segs: FlipSeg[]; rng: number } {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  // Solver states: side | flipT << 1 | landed << 5 (landed capped at SOLVER_LANDED).
  const pack = (side: number, flipT: number, landed: number) => side | (flipT << 1) | (landed << 5);
  let frontier: number[] = [pack(0, 0, SOLVER_LANDED)];
  let tick = 0;
  const end = X_AT[FLIP_RUN_TICKS]!;
  const segs: FlipSeg[] = [];

  /** Advance the frontier until the runner has passed xEnd, dying on `hazards`. */
  const advance = (from: number[], t0: number, xEnd: number, hazards: readonly FlipSeg[]) => {
    let set = from;
    let t = t0;
    while (t < FLIP_RUN_TICKS && X_AT[t]! - RUNNER_HALF <= xEnd) {
      t += 1;
      const seen = new Set<number>();
      const out: number[] = [];
      for (const code of set) {
        const side = code & 1;
        const flipT = (code >> 1) & 15;
        const landed = code >> 5;
        for (const tap of [false, true]) {
          if (tap && (flipT > 0 || landed < SOLVER_LANDED)) continue;
          const m: Mover = { side, flipT };
          moveRunner(m, tap);
          if (hazards.some((seg) => blocked(m, X_AT[t]!, seg))) continue;
          const nl = m.flipT > 0 ? 0 : Math.min(SOLVER_LANDED, landed + 1);
          const next = pack(m.side, m.flipT, nl);
          if (seen.has(next)) continue;
          seen.add(next);
          out.push(next);
        }
      }
      set = out;
      if (!out.length) break;
    }
    return { set, tick: t };
  };

  let x = X_AT[CLEAR_TICKS]!;
  while (x < end) {
    const speed = flipSpeed(tick);
    const gap = (60 + draw(160)) * FP;
    const start = x + gap;
    if (start >= end) break;
    let accepted: FlipSeg[] = [];
    let result: { set: number[]; tick: number } | null = null;
    for (let attempt = 0; attempt < 12 && !result; attempt++) {
      const pattern = draw(4);
      const side = draw(2);
      const len = (40 + draw(120)) * FP;
      let trial: FlipSeg[];
      if (pattern === 3) {
        // Overhang pair: block on one side, then soon after on the other — two quick flips.
        const len1 = (30 + draw(40)) * FP;
        const between = speed * (FLIP_ARC_TICKS + SOLVER_LANDED + 4 + draw(20));
        trial = [
          { x0: start, x1: start + len1, side, kind: FLIP_OVERHANG },
          { x0: start + len1 + between, x1: start + len1 + between + len1, side: side ^ 1, kind: FLIP_OVERHANG },
        ];
      } else {
        trial = [{ x0: start, x1: start + len, side, kind: pattern === 2 ? FLIP_GAP : FLIP_SPIKE }];
      }
      const last = trial[trial.length - 1]!;
      if (last.x1 >= end) continue;
      const tried = advance(frontier, tick, last.x1, trial);
      if (tried.set.length) {
        accepted = trial;
        result = tried;
      }
    }
    if (!result) {
      result = advance(frontier, tick, start, []);
      x = start;
    } else {
      segs.push(...accepted);
      x = accepted[accepted.length - 1]!.x1;
    }
    frontier = result.set;
    tick = result.tick;
    if (tick >= FLIP_RUN_TICKS) break;
  }
  return { segs, rng };
}

/* ================================ State ================================ */

export interface FlipState {
  tick: number;
  rng: number;
  x: number;
  side: number;
  flipT: number;
  cursor: number;
  ended: number;
  endedTick: number;
  segs: FlipSeg[];
}

const cache = new Map<number, { segs: FlipSeg[]; rng: number }>();

function init(seed: number): FlipState {
  let course = cache.get(seed | 0);
  if (!course) {
    course = buildCourse(seed);
    if (cache.size > 16) cache.clear();
    cache.set(seed | 0, course);
  }
  return { tick: 0, rng: course.rng, x: 0, side: 0, flipT: 0, cursor: 0, ended: 0, endedTick: 0, segs: course.segs };
}

function isOver(state: FlipState): boolean {
  return state.ended !== 0;
}

function step(state: FlipState, input: ArcadeInputEvent | null): FlipState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: FlipState = { ...state, tick };
  moveRunner(s, input !== null && input.k === FLIP_INPUT_TAP);
  s.x = X_AT[tick]!;
  let cursor = s.cursor;
  while (cursor < s.segs.length && s.segs[cursor]!.x1 < s.x - RUNNER_HALF) cursor += 1;
  s.cursor = cursor;
  let hit = false;
  for (let i = cursor; i < s.segs.length; i++) {
    const seg = s.segs[i]!;
    if (seg.x0 > s.x + RUNNER_HALF) break;
    if (blocked(s, s.x, seg)) hit = true;
  }
  if (hit) {
    s.ended = 2;
    s.endedTick = tick;
  } else if (tick >= FLIP_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** floor(150 × (seconds survived ÷ 60)²), in whole ticks. */
export function flipScoreOf(ticks: number): number {
  const t = clampInt(ticks, 0, FLIP_RUN_TICKS);
  return clampInt(Math.trunc((150 * t * t) / (FLIP_RUN_TICKS * FLIP_RUN_TICKS)), 0, 150);
}

function score(state: FlipState): number {
  return flipScoreOf(state.ended === 1 ? FLIP_RUN_TICKS : state.tick);
}

/* ============================= Checkpoints ============================= */

export const FLIP_CHECKPOINT_INTERVAL = 300;
export const FLIP_CHECKPOINT_KEYS = ["tick", "x", "side", "flipT", "cursor", "ended", "rng", "checksum"] as const;

export interface FlipCheckpoint {
  tick: number;
  x: number;
  side: number;
  flipT: number;
  cursor: number;
  ended: number;
  rng: number;
  checksum: number;
}

export function flipCheckpoint(state: FlipState): FlipCheckpoint {
  const snap = {
    tick: state.tick,
    x: state.x,
    side: state.side,
    flipT: state.flipT,
    cursor: state.cursor,
    ended: state.ended,
    rng: state.rng | 0,
  };
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snap)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* =============================== Drawing =============================== */

export const FLIP_BG = "#07070D";
export const FLIP_GOLD = "#F5B82E";
export const FLIP_RED = "#FF4D5E";

/** Runner y in px for a side and arc timer (render only). */
function runnerY(side: number, flipT: number): number {
  const target = side === 0 ? FLIP_FLOOR_Y - 14 : FLIP_CEIL_Y + 14;
  if (flipT === 0) return target;
  const from = side === 0 ? FLIP_CEIL_Y + 14 : FLIP_FLOOR_Y - 14;
  const f = 1 - flipT / FLIP_ARC_TICKS;
  const eased = f * f * (3 - 2 * f);
  return from + (target - from) * eased;
}

function draw(ctx: CanvasRenderingContext2D, state: FlipState, size: CanvasSize): void {
  const scale = Math.min(size.width / FLIP_WORLD_W, size.height / FLIP_WORLD_H);
  const ox = (size.width - FLIP_WORLD_W * scale) / 2;
  const oy = (size.height - FLIP_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = FLIP_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  const toScreen = (wx: number) => RUNNER_X + (wx - state.x) / FP;
  // Surfaces as gold lines, broken where a gap is.
  ctx.strokeStyle = FLIP_GOLD;
  ctx.lineWidth = 3;
  for (const [side, y] of [[0, FLIP_FLOOR_Y], [1, FLIP_CEIL_Y]] as const) {
    ctx.beginPath();
    let from = 0;
    for (let i = state.cursor; i < state.segs.length; i++) {
      const seg = state.segs[i]!;
      const a = toScreen(seg.x0);
      if (a > FLIP_WORLD_W) break;
      if (seg.side !== side || seg.kind !== FLIP_GAP) continue;
      ctx.moveTo(from, y);
      ctx.lineTo(Math.max(from, a), y);
      from = Math.max(from, toScreen(seg.x1));
    }
    ctx.moveTo(from, y);
    ctx.lineTo(FLIP_WORLD_W, y);
    ctx.stroke();
  }

  for (let i = Math.max(0, state.cursor - 1); i < state.segs.length; i++) {
    const seg = state.segs[i]!;
    const a = toScreen(seg.x0);
    const b = toScreen(seg.x1);
    if (a > FLIP_WORLD_W) break;
    if (b < 0) continue;
    const y = seg.side === 0 ? FLIP_FLOOR_Y : FLIP_CEIL_Y;
    const dirY = seg.side === 0 ? -1 : 1;
    if (seg.kind === FLIP_SPIKE) {
      ctx.fillStyle = FLIP_RED;
      ctx.beginPath();
      for (let px = a; px < b; px += 16) {
        ctx.moveTo(px, y);
        ctx.lineTo(px + 8, y + dirY * 22);
        ctx.lineTo(Math.min(b, px + 16), y);
      }
      ctx.fill();
    } else if (seg.kind === FLIP_GAP) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(a, seg.side === 0 ? y : 0, b - a, seg.side === 0 ? FLIP_WORLD_H - y : y);
    } else {
      ctx.fillStyle = FLIP_RED;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(a, seg.side === 0 ? y - 34 : y, b - a, 34);
      ctx.globalAlpha = 1;
    }
  }

  // Runner with a small trail.
  const y = runnerY(state.side, state.flipT);
  for (let k = 3; k >= 1; k--) {
    ctx.globalAlpha = 0.12 * (4 - k);
    ctx.fillStyle = FLIP_GOLD;
    ctx.beginPath();
    ctx.roundRect(RUNNER_X - 12 - k * 10, y - 12, 24, 24, 12);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = FLIP_GOLD;
  ctx.beginPath();
  ctx.roundRect(RUNNER_X - 12, y - 14, 24, 28, 12);
  ctx.fill();
  ctx.restore();
}

export const flipGame: ArcadeGame<FlipState, ArcadeInputEvent | null> = {
  key: "flip",
  runTicks: FLIP_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: FLIP_INPUT_RANGES,
};
