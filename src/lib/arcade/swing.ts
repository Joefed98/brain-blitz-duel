/**
 * Swing — a cavern swinger. The camera scrolls right; holding (k = 12, a = 1)
 * shoots a rope to the nearest anchor ahead within 220 px and the figure swings
 * on it as a pendulum (angle + angular velocity, integer maths); letting go
 * (a = 0) flies with the current velocity under gravity. The floor, the red
 * stalactites and being scrolled off the left edge end the run.
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
import { ANG_PER_RAD, iatan2, icos, isin, isqrt, TRIG_ONE } from "./trig";

/* ============================== Constants ============================== */

const FP = 256;
export const SWING_WORLD_W = 390;
export const SWING_WORLD_H = 620;
export const SWING_RUN_TICKS = 60 * TICKS_PER_SECOND;
export const SWING_INPUT_HOLD = 12;
const GRAVITY = 77; // 0.3 px/tick²
const MAX_FALL = 12 * FP;
const RADIUS = 10 * FP;
const REACH = 220 * FP;
const MIN_ROPE = 24 * FP;
const SPEED_START = 614;
const SPEED_STEP = 77;
const SPEED_STEP_TICKS = 10 * TICKS_PER_SECOND;
const START_X = 150 * FP;
/** The camera never lets the figure get further right than this on screen. */
const LEAD = 260 * FP;
const METRE = 40 * FP;
const COL = 40 * FP;
const COURSE_LEN = 18000 * FP;
const COLS = Math.trunc(COURSE_LEN / COL) + 2;
const SPIKE_HALF = 16 * FP;
const SPIKE_DEPTH = 56 * FP;
/** Sub-steps of angle precision. */
const SUB = 16;
const TURN_SUB = 65536 * SUB;

export const SWING_INPUT_RANGES: readonly InputRange[] = [inputRange(SWING_INPUT_HOLD, [0, 1])];

export function swingSpeed(tick: number): number {
  return SPEED_START + SPEED_STEP * Math.trunc(tick / SPEED_STEP_TICKS);
}

/* ================================ Course =============================== */

export interface Anchor {
  x: number;
  y: number;
}

export interface Spike {
  x: number;
  top: number;
}

interface Course {
  ceil: number[];
  floor: number[];
  anchors: Anchor[];
  spikes: Spike[];
  rng: number;
}

function lerpAt(arr: readonly number[], x: number): number {
  const i = clampInt(Math.trunc(x / COL), 0, arr.length - 2);
  const f = x - i * COL;
  return arr[i]! + Math.trunc(((arr[i + 1]! - arr[i]!) * f) / COL);
}

/** Body shared by the sim and the course check. */
interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** -1 free, else anchor index. */
  rope: number;
  len: number;
  th: number;
  om: number;
}

function ropePos(b: Body, a: Anchor): void {
  const t = b.th >> 4;
  b.x = a.x + Math.trunc((b.len * isin(t)) / TRIG_ONE);
  b.y = a.y + Math.trunc((b.len * icos(t)) / TRIG_ONE);
}

function attach(b: Body, index: number, a: Anchor): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  b.len = Math.max(MIN_ROPE, isqrt(dx * dx + dy * dy));
  const t = iatan2(dx, dy);
  b.th = t * SUB;
  b.om = Math.trunc(((b.vx * icos(t) - b.vy * isin(t)) * SUB * ANG_PER_RAD) / (TRIG_ONE * b.len));
  b.rope = index;
  ropePos(b, a);
}

function detach(b: Body, a: Anchor): void {
  const t = b.th >> 4;
  const k = TRIG_ONE * SUB * ANG_PER_RAD;
  b.vx = Math.trunc((b.len * icos(t) * b.om) / k);
  b.vy = Math.trunc((-b.len * isin(t) * b.om) / k);
  b.rope = -1;
  void a;
}

function nearestAhead(anchors: readonly Anchor[], b: Body, from: number): number {
  let best = -1;
  let bestD = REACH * REACH;
  for (let i = Math.max(0, from); i < anchors.length; i++) {
    const a = anchors[i]!;
    if (a.x - b.x > REACH) break;
    if (a.x <= b.x) continue;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Moves the body one tick; returns true if it died on the floor or a spike. */
function moveBody(b: Body, c: { ceil: number[]; floor: number[]; spikes: Spike[]; anchors: Anchor[] }): boolean {
  if (b.rope >= 0) {
    const a = c.anchors[b.rope]!;
    const t = b.th >> 4;
    b.om -= Math.trunc((GRAVITY * isin(t) * SUB * ANG_PER_RAD) / (TRIG_ONE * b.len));
    const prevTh = b.th;
    b.th = (b.th + b.om) & (TURN_SUB - 1);
    const px = b.x;
    const py = b.y;
    ropePos(b, a);
    if (b.y - RADIUS < lerpAt(c.ceil, b.x)) {
      b.th = prevTh;
      b.x = px;
      b.y = py;
      b.om = -Math.trunc(b.om / 2);
    }
  } else {
    b.vy = Math.min(MAX_FALL, b.vy + GRAVITY);
    b.x += b.vx;
    b.y += b.vy;
    const ceil = lerpAt(c.ceil, b.x);
    if (b.y - RADIUS < ceil) {
      b.y = ceil + RADIUS;
      if (b.vy < 0) b.vy = 0;
    }
  }
  if (b.y + RADIUS >= lerpAt(c.floor, b.x)) return true;
  for (const s of c.spikes) {
    if (s.x - b.x > SPIKE_HALF + RADIUS) break;
    if (b.x - s.x > SPIKE_HALF + RADIUS) continue;
    if (b.y - RADIUS < s.top + SPIKE_DEPTH) return true;
  }
  return false;
}

/** From a standard swing on anchor i, can some release reach anchor i + 1? */
function reachable(c: Course, i: number): boolean {
  const a = c.anchors[i]!;
  const next = c.anchors[i + 1]!;
  const spikes = c.spikes.filter((s) => s.x > a.x - 400 * FP && s.x < next.x + 400 * FP);
  const view = { ...c, spikes };
  const start: Body = { x: 0, y: 0, vx: 0, vy: 0, rope: i, len: 130 * FP, th: 55000 * SUB, om: 0 };
  ropePos(start, a);
  const swing = { ...start };
  for (let r = 0; r < 160; r++) {
    if (moveBody(swing, view)) return false;
    if (r % 2) continue;
    const fly = { ...swing };
    detach(fly, a);
    for (let t = 0; t < 110; t++) {
      if (moveBody(fly, view)) break;
      if (nearestAhead(c.anchors, fly, i + 1) === i + 1 && fly.x < next.x) return true;
    }
  }
  return false;
}

function buildCourse(seed: number): Course {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const ceil: number[] = [];
  const floor: number[] = [];
  for (let i = 0; i < COLS; i++) {
    ceil.push((40 + draw(60)) * FP);
    floor.push((540 + draw(50)) * FP);
  }
  const course: Course = { ceil, floor, anchors: [], spikes: [], rng: 0 };
  const hangY = (x: number, depth: number) => lerpAt(ceil, x) + depth * FP;
  course.anchors.push({ x: START_X + 70 * FP, y: hangY(START_X + 70 * FP, 110) });
  while (course.anchors[course.anchors.length - 1]!.x < COURSE_LEN - 600 * FP) {
    const prev = course.anchors[course.anchors.length - 1]!;
    let ok = false;
    for (let attempt = 0; attempt < 20 && !ok; attempt++) {
      const x = prev.x + (110 + draw(81)) * FP;
      const anchor = { x, y: hangY(x, 60 + draw(110)) };
      const spike =
        course.anchors.length > 4 && draw(100) < 30
          ? { x: Math.trunc((prev.x + x) / 2), top: lerpAt(ceil, Math.trunc((prev.x + x) / 2)) }
          : null;
      course.anchors.push(anchor);
      if (spike) course.spikes.push(spike);
      if (reachable(course, course.anchors.length - 2)) ok = true;
      else {
        course.anchors.pop();
        if (spike) course.spikes.pop();
      }
    }
    if (!ok) {
      const x = prev.x + 120 * FP;
      course.anchors.push({ x, y: prev.y });
    }
  }
  course.rng = rng;
  return course;
}

/* ================================ State ================================ */

export interface SwingState extends Body {
  tick: number;
  rng: number;
  camX: number;
  maxX: number;
  grabTick: number;
  ended: number;
  endedTick: number;
  ceil: number[];
  floor: number[];
  anchors: Anchor[];
  spikes: Spike[];
}

const cache = new Map<number, Course>();

function init(seed: number): SwingState {
  let course = cache.get(seed | 0);
  if (!course) {
    course = buildCourse(seed);
    if (cache.size > 16) cache.clear();
    cache.set(seed | 0, course);
  }
  const a = course.anchors[0]!;
  const body: Body = { x: 0, y: 0, vx: 0, vy: 0, rope: 0, len: 110 * FP, th: 56000 * SUB, om: 0 };
  ropePos(body, a);
  return {
    ...body,
    tick: 0,
    rng: course.rng,
    camX: 0,
    maxX: body.x,
    grabTick: -100,
    ended: 0,
    endedTick: 0,
    ceil: course.ceil,
    floor: course.floor,
    anchors: course.anchors,
    spikes: course.spikes,
  };
}

function isOver(state: SwingState): boolean {
  return state.ended !== 0;
}

function step(state: SwingState, input: ArcadeInputEvent | null): SwingState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: SwingState = { ...state, tick };
  if (input !== null && input.k === SWING_INPUT_HOLD) {
    if (input.a === 1) {
      const target = nearestAhead(s.anchors, s, 0);
      if (target >= 0) {
        if (s.rope >= 0) detach(s, s.anchors[s.rope]!);
        attach(s, target, s.anchors[target]!);
        s.grabTick = tick;
      }
    } else if (s.rope >= 0) detach(s, s.anchors[s.rope]!);
  }
  const dead = moveBody(s, s);
  s.camX = Math.max(s.camX + swingSpeed(tick), s.x - LEAD);
  if (s.x > s.maxX) s.maxX = s.x;
  if (dead || s.x < s.camX - RADIUS) {
    s.ended = 2;
    s.endedTick = tick;
  } else if (tick >= SWING_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

export function swingMetres(s: SwingState): number {
  return Math.max(0, Math.trunc((s.maxX - START_X) / METRE));
}

function score(state: SwingState): number {
  // floor(150 × (seconds survived ÷ 60)²); distance is for the reveal only.
  const t = Math.min(state.tick, SWING_RUN_TICKS);
  return clampInt(Math.floor((150 * t * t) / (SWING_RUN_TICKS * SWING_RUN_TICKS)), 0, 150);
}

export function swingExtra(s: SwingState) {
  return { metres: swingMetres(s), survived: s.ended !== 2, survivedSeconds: s.tick / 60 };
}

/* ============================= Checkpoints ============================= */

export const SWING_CHECKPOINT_INTERVAL = 300;
export const SWING_CHECKPOINT_KEYS = [
  "tick",
  "x",
  "y",
  "rope",
  "th",
  "om",
  "camX",
  "ended",
  "rng",
  "checksum",
] as const;

export interface SwingCheckpoint {
  tick: number;
  x: number;
  y: number;
  rope: number;
  th: number;
  om: number;
  camX: number;
  ended: number;
  rng: number;
  checksum: number;
}

export function swingCheckpoint(state: SwingState): SwingCheckpoint {
  const snap = {
    tick: state.tick,
    x: state.x,
    y: state.y,
    rope: state.rope,
    th: state.th,
    om: state.om,
    camX: state.camX,
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

export const SWING_BG = "#07070D";
export const SWING_GOLD = "#F5B82E";
export const SWING_RED = "#FF4D5E";

function draw(ctx: CanvasRenderingContext2D, state: SwingState, size: CanvasSize): void {
  const scale = Math.min(size.width / SWING_WORLD_W, size.height / SWING_WORLD_H);
  const ox = (size.width - SWING_WORLD_W * scale) / 2;
  const oy = (size.height - SWING_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = SWING_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, SWING_WORLD_W, SWING_WORLD_H);
  ctx.clip();
  const cam = state.camX / FP;
  const sx = (x: number) => x / FP - cam;
  const first = Math.max(0, Math.trunc(state.camX / COL) - 1);
  const last = Math.min(state.ceil.length - 1, first + 12);

  // Rock above the ceiling and below the floor, jagged gold edges.
  for (const [arr, edge] of [
    [state.ceil, 0],
    [state.floor, SWING_WORLD_H],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(sx(first * COL), edge);
    for (let i = first; i <= last; i++) ctx.lineTo(sx(i * COL), arr[i]! / FP);
    ctx.lineTo(sx(last * COL), edge);
    ctx.closePath();
    ctx.fillStyle = "#12121C";
    ctx.fill();
    ctx.strokeStyle = SWING_GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = first; i <= last; i++) {
      const x = sx(i * COL);
      const y = arr[i]! / FP;
      if (i === first) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Floor spikes.
  ctx.fillStyle = SWING_RED;
  ctx.beginPath();
  const startPx = Math.floor(cam / 16) * 16;
  for (let wx = startPx; wx < cam + SWING_WORLD_W + 16; wx += 16) {
    const y = lerpAt(state.floor, wx * FP) / FP;
    ctx.moveTo(wx - cam, y + 1);
    ctx.lineTo(wx - cam + 8, y - 10);
    ctx.lineTo(wx - cam + 16, y + 1);
  }
  ctx.fill();
  // Stalactites.
  for (const s of state.spikes) {
    const x = sx(s.x);
    if (x < -40 || x > SWING_WORLD_W + 40) continue;
    const top = s.top / FP;
    ctx.beginPath();
    ctx.moveTo(x - SPIKE_HALF / FP, top);
    ctx.lineTo(x - 8, top + SPIKE_DEPTH / FP);
    ctx.lineTo(x, top + 24);
    ctx.lineTo(x + 8, top + SPIKE_DEPTH / FP);
    ctx.lineTo(x + SPIKE_HALF / FP, top);
    ctx.closePath();
    ctx.fill();
  }
  // Anchors.
  state.anchors.forEach((a, i) => {
    const x = sx(a.x);
    if (x < -20 || x > SWING_WORLD_W + 20) return;
    const flash = i === state.rope && state.tick - state.grabTick < 12;
    ctx.strokeStyle = SWING_GOLD;
    ctx.lineWidth = flash ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(x, a.y / FP, flash ? 8 : 6, 0, Math.PI * 2);
    ctx.stroke();
  });
  // Rope and figure.
  const fx = sx(state.x);
  const fy = state.y / FP;
  let armX = -0.6;
  let armY = 0.8;
  if (state.rope >= 0) {
    const a = state.anchors[state.rope]!;
    ctx.strokeStyle = SWING_GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx(a.x), a.y / FP);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    const d = Math.hypot(sx(a.x) - fx, a.y / FP - fy) || 1;
    armX = (sx(a.x) - fx) / d;
    armY = (a.y / FP - fy) / d;
  } else {
    const d = Math.hypot(state.vx, state.vy) || 1;
    armX = -state.vx / d;
    armY = -state.vy / d;
  }
  ctx.strokeStyle = SWING_GOLD;
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(fx - 3, fy - 6);
  ctx.lineTo(fx - 3 + armX * 14 - armY * 3, fy - 6 + armY * 14 + armX * 3);
  ctx.moveTo(fx + 3, fy - 6);
  ctx.lineTo(fx + 3 + armX * 14 + armY * 3, fy - 6 + armY * 14 - armX * 3);
  ctx.stroke();
  ctx.fillStyle = state.ended === 2 ? SWING_RED : SWING_GOLD;
  ctx.beginPath();
  ctx.roundRect(fx - 8, fy - 14, 16, 28, 8);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 16px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`${swingMetres(state)} m`, 14, 26);
  ctx.restore();
}

export const swingGame: ArcadeGame<SwingState, ArcadeInputEvent | null> = {
  key: "swing",
  runTicks: SWING_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: SWING_INPUT_RANGES,
};
