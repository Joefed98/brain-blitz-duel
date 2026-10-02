/**
 * Junction — a top-down crossroads. Tap a corner (k = 11, a = 0–3 — the
 * approach entering beside that corner) to toggle its light, red or green. Cars queue on red, give up when their patience runs out,
 * and two cars from crossing directions in the box at once is a crash.
 * The whole arrival schedule is drawn at init from the seed.
 *
 * Every car is one number along its own path (the front bumper, 1/256 px);
 * the drawing turns that into screen position.
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
export const JUNC_WORLD_W = 390;
export const JUNC_WORLD_H = 620;
export const JUNC_RUN_TICKS = 60 * TICKS_PER_SECOND;
export const JUNC_INPUT_TAP = 11;
/** Approaches: cars from the top, bottom, left, right. */
export const JUNC_TOP = 0;
export const JUNC_BOTTOM = 1;
export const JUNC_LEFT = 2;
export const JUNC_RIGHT = 3;

export const JUNC_CX = 195;
export const JUNC_CY = 310;
/** Everything on the road is 1.2× the original size. */
const HALF = 31;
const LANE = 16;
const CAR_W = 24;
const CAR_PX = 41;
const BOX = 2 * HALF * FP;
const CAR_LEN = CAR_PX * FP;
const CAR_GAP = Math.trunc(2.4 * FP);
const TURN_EXTRA = 36 * FP;
const SPAWN_OUT = 20;
/** Front-bumper distance from spawn to the stop line, per approach. */
const STOP_V = (JUNC_CY - HALF + SPAWN_OUT) * FP;
const STOP_H = (JUNC_CX - HALF + SPAWN_OUT) * FP;
const STOP: readonly number[] = [STOP_V, STOP_V, STOP_H, STOP_H];

const ARRIVE_START = 84; // 1.4 s
const ARRIVE_END = 30; // 0.5 s
const FIRST_ARRIVAL = 30;
const PATIENCE_START = 360;
const PATIENCE_END = 240;
const TURNS_FROM = 30 * TICKS_PER_SECOND;
export const JUNC_INDICATE_TICKS = 60;
/** 2.4 px a tick, +10% every 15 s. */
const SPEEDS: readonly number[] = [614, 675, 743, 817];
const SPEED_STEP_TICKS = 15 * TICKS_PER_SECOND;
const CAR_POINTS = 3;
/** Ambulances: from 20 s, one every 15 s, 1.3× speed, ±5 points each. */
export const JUNC_AMB_FROM = 20 * TICKS_PER_SECOND;
export const JUNC_AMB_EVERY = 15 * TICKS_PER_SECOND;
const AMB_SPEED_NUM = 13;
const AMB_SPEED_DEN = 10;
const AMB_POINTS = 5;
const SURVIVE_BONUS = 40;

export const JUNC_INPUT_RANGES: readonly InputRange[] = [inputRange(JUNC_INPUT_TAP, [0, 3])];

export function juncSpeed(tick: number): number {
  return SPEEDS[clampInt(Math.trunc(tick / SPEED_STEP_TICKS), 0, SPEEDS.length - 1)]!;
}

/* =============================== Schedule =============================== */

export interface JuncArrival {
  tick: number;
  ap: number;
  /** 0 straight, 1 left, 2 right. */
  turn: number;
  patience: number;
  colour: number;
  /** 1 for an ambulance. */
  amb: number;
}

function buildSchedule(seed: number) {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const arrivals: JuncArrival[] = [];
  for (let t = FIRST_ARRIVAL; t <= JUNC_RUN_TICKS; ) {
    const turn = t >= TURNS_FROM && draw(3) === 0 ? 1 + draw(2) : 0;
    arrivals.push({
      tick: t,
      ap: draw(4),
      turn,
      patience: PATIENCE_START - Math.trunc(((PATIENCE_START - PATIENCE_END) * t) / JUNC_RUN_TICKS),
      colour: draw(4),
      amb: 0,
    });
    t += ARRIVE_START - Math.trunc(((ARRIVE_START - ARRIVE_END) * t) / JUNC_RUN_TICKS);
  }
  // Ambulances come from their own stream off the seed, so the car schedule is untouched.
  let ambRng = (seed ^ 0x5bd1e995) | 0;
  const ambDraw = (bound: number) => {
    const r = rngBelow(ambRng, bound);
    ambRng = r.state;
    return r.value;
  };
  for (let t = JUNC_AMB_FROM; t < JUNC_RUN_TICKS - 3 * TICKS_PER_SECOND; t += JUNC_AMB_EVERY) {
    const at = t + ambDraw(TICKS_PER_SECOND);
    arrivals.push({ tick: at, ap: ambDraw(4), turn: 0, patience: 1 << 30, colour: 0, amb: 1 });
  }
  arrivals.sort((a, b) => a.tick - b.tick || a.amb - b.amb);
  return { arrivals, rng };
}

/* ================================ State ================================ */

export interface JuncCar {
  id: number;
  ap: number;
  turn: number;
  s: number;
  wait: number;
  patience: number;
  cleared: number;
  colour: number;
  amb: number;
  /** Set once an ambulance has had to stop. */
  stopped: number;
}

export interface JuncState {
  tick: number;
  rng: number;
  arrivals: JuncArrival[];
  next: number;
  cars: JuncCar[];
  /** Bit per approach: 1 = green. */
  lights: number;
  cleared: number;
  gaveUp: number;
  /** Ambulances let straight through, and ones made to stop. */
  ambThrough: number;
  ambStopped: number;
  ended: number;
  endedTick: number;
  /** Render only. */
  crashX: number;
  crashY: number;
  honkTick: number;
  honkAp: number;
}

const cache = new Map<number, ReturnType<typeof buildSchedule>>();

function init(seed: number): JuncState {
  let plan = cache.get(seed | 0);
  if (!plan) {
    plan = buildSchedule(seed);
    if (cache.size > 16) cache.clear();
    cache.set(seed | 0, plan);
  }
  return {
    tick: 0,
    rng: plan.rng,
    arrivals: plan.arrivals,
    next: 0,
    cars: [],
    lights: (1 << JUNC_TOP) | (1 << JUNC_BOTTOM),
    cleared: 0,
    gaveUp: 0,
    ambThrough: 0,
    ambStopped: 0,
    ended: 0,
    endedTick: 0,
    crashX: 0,
    crashY: 0,
    honkTick: -100,
    honkAp: 0,
  };
}

function isOver(state: JuncState): boolean {
  return state.ended !== 0;
}

const exitOf = (car: JuncCar) => STOP[car.ap]! + BOX + (car.turn ? TURN_EXTRA : 0);
const removeOf = (car: JuncCar) => 2 * STOP[car.ap]! + BOX + 40 * FP;
const inBox = (car: JuncCar) => car.s > STOP[car.ap]! && car.s - CAR_LEN < exitOf(car);
const vertical = (ap: number) => ap === JUNC_TOP || ap === JUNC_BOTTOM;

function step(state: JuncState, input: ArcadeInputEvent | null): JuncState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: JuncState = { ...state, tick, cars: state.cars.map((car) => ({ ...car })) };
  if (input && input.k === JUNC_INPUT_TAP) s.lights ^= 1 << clampInt(input.a, 0, 3);

  // Arrivals join the back of their queue (off screen if it is long).
  while (s.next < s.arrivals.length && s.arrivals[s.next]!.tick <= tick) {
    const a = s.arrivals[s.next]!;
    let back: JuncCar | undefined;
    for (const car of s.cars) if (car.ap === a.ap && car.s - CAR_LEN < exitOf(car)) back = car;
    const start = back ? Math.min(0, back.s - CAR_LEN - CAR_GAP) : 0;
    if (s.cars.length < 10 || a.amb) s.cars.push({ id: s.next, ap: a.ap, turn: a.turn, s: start, wait: 0, patience: a.patience, cleared: 0, colour: a.colour, amb: a.amb, stopped: 0 });
    s.next += 1;
  }

  // Move, front of each queue first (cars are kept in arrival order).
  const speed = juncSpeed(tick);
  const leader: (JuncCar | null)[] = [null, null, null, null];
  const kept: JuncCar[] = [];
  for (const car of s.cars) {
    const stop = STOP[car.ap]!;
    const own = car.amb ? Math.trunc((speed * AMB_SPEED_NUM) / AMB_SPEED_DEN) : speed;
    let target = car.s + own;
    const ahead = leader[car.ap];
    if (ahead && ahead.s - CAR_LEN < exitOf(ahead)) target = Math.min(target, ahead.s - CAR_LEN - CAR_GAP);
    const green = (s.lights >> car.ap) & 1;
    if (!green && car.s <= stop) target = Math.min(target, stop);
    const moved = Math.max(0, target - car.s);
    car.s += moved;
    if (car.s <= stop && moved * 2 < own) {
      if (car.amb) {
        // An ambulance never gives up; being made to stop costs 5, once.
        if (!car.stopped) {
          car.stopped = 1;
          s.ambStopped += 1;
          s.honkTick = tick;
          s.honkAp = car.ap;
        }
        car.wait += 1;
        leader[car.ap] = car;
        kept.push(car);
        continue;
      }
      car.wait += 1;
      if (car.wait > car.patience) {
        s.gaveUp += 1;
        s.honkTick = tick;
        s.honkAp = car.ap;
        continue;
      }
    }
    if (!car.cleared && car.s - CAR_LEN >= exitOf(car)) {
      car.cleared = 1;
      if (!car.amb) s.cleared += 1;
      else if (!car.stopped) s.ambThrough += 1;
    }
    leader[car.ap] = car;
    if (car.s < removeOf(car)) kept.push(car);
  }
  s.cars = kept;

  // Crossing directions (or any turning car) in the box together is a crash.
  // Ambulances never collide.
  const box = kept.filter((car) => !car.amb && inBox(car));
  for (let i = 0; i < box.length && !s.ended; i++) {
    for (let j = i + 1; j < box.length; j++) {
      const a = box[i]!;
      const b = box[j]!;
      if (a.ap === b.ap) continue;
      if (vertical(a.ap) !== vertical(b.ap) || a.turn || b.turn) {
        s.ended = 2;
        s.endedTick = tick;
        s.crashX = JUNC_CX;
        s.crashY = JUNC_CY;
        break;
      }
    }
  }
  if (!s.ended && tick >= JUNC_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** 3 per car cleared, −1 per car that gave up, ±5 per ambulance, +40 for the minute; 0–150. */
export function juncScoreOf(cleared: number, gaveUp: number, survived: boolean, ambThrough = 0, ambStopped = 0): number {
  return clampInt(
    CAR_POINTS * cleared - gaveUp + AMB_POINTS * (ambThrough - ambStopped) + (survived ? SURVIVE_BONUS : 0),
    0,
    150,
  );
}

function score(state: JuncState): number {
  return juncScoreOf(state.cleared, state.gaveUp, state.ended === 1, state.ambThrough, state.ambStopped);
}

/* ============================= Checkpoints ============================= */

export const JUNC_CHECKPOINT_INTERVAL = 300;
export const JUNC_CHECKPOINT_KEYS = [
  "tick", "next", "cars", "lights", "cleared", "gaveUp", "ended", "rng", "checksum",
] as const;

export interface JuncCheckpoint {
  tick: number;
  next: number;
  cars: number;
  lights: number;
  cleared: number;
  gaveUp: number;
  ended: number;
  rng: number;
  checksum: number;
}

export function juncCheckpoint(state: JuncState): JuncCheckpoint {
  const snap = {
    tick: state.tick,
    next: state.next,
    cars: state.cars.length,
    lights: state.lights,
    cleared: state.cleared,
    gaveUp: state.gaveUp,
    ended: state.ended,
    rng: state.rng | 0,
  };
  let checksum = 0x811c9dc5;
  const values = [...Object.values(snap)];
  values.push(state.ambThrough, state.ambStopped);
  for (const car of state.cars) values.push(car.id, car.s, car.wait, car.stopped);
  for (const value of values) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* =============================== Drawing =============================== */

export const JUNC_BG = "#0B0F0C";
export const JUNC_ROAD = "#1E2228";
export const JUNC_GOLD = "#F5B82E";
export const JUNC_GREEN = "#22C55E";
export const JUNC_RED = "#FF4D5E";
export const JUNC_CAR_COLOURS = ["#F5B82E", "#2ED3B7", "#8FA8FF", "#F2F2F2"] as const;

/** Direction each approach drives in, and where its front starts. */
const DIR: readonly (readonly [number, number])[] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
const ORIGIN: readonly (readonly [number, number])[] = [
  [JUNC_CX - LANE, -SPAWN_OUT],
  [JUNC_CX + LANE, JUNC_WORLD_H + SPAWN_OUT],
  [-SPAWN_OUT, JUNC_CY + LANE],
  [JUNC_WORLD_W + SPAWN_OUT, JUNC_CY - LANE],
];

/** Screen point of a car's front and its heading (render only). */
export function juncCarPose(car: JuncCar): { x: number; y: number; dx: number; dy: number } {
  const [dx, dy] = DIR[car.ap]!;
  const [ox, oy] = ORIGIN[car.ap]!;
  const s = car.s / FP;
  const pivot = (STOP[car.ap]! + (BOX + TURN_EXTRA) / 2) / FP;
  if (!car.turn || s <= pivot) return { x: ox + dx * s, y: oy + dy * s, dx, dy };
  const [tx, ty] = car.turn === 2 ? [-dy, dx] : [dy, -dx];
  const px = ox + dx * pivot;
  const py = oy + dy * pivot;
  return { x: px + tx * (s - pivot), y: py + ty * (s - pivot), dx: tx, dy: ty };
}

/** Screen point of each approach's light. */
export const JUNC_LIGHT_AT: readonly (readonly [number, number])[] = [
  [JUNC_CX - HALF - 14, JUNC_CY - HALF - 14],
  [JUNC_CX + HALF + 14, JUNC_CY + HALF + 14],
  [JUNC_CX - HALF - 14, JUNC_CY + HALF + 14],
  [JUNC_CX + HALF + 14, JUNC_CY - HALF - 14],
];

/**
 * Which approach a tap means: each black corner quadrant switches the road
 * entering beside it (bottom-right → bottom, top-right → right, top-left →
 * top, bottom-left → left). Taps on the roads do nothing (−1).
 */
export function juncApproachAt(x: number, y: number): number {
  const dx = x - JUNC_CX;
  const dy = y - JUNC_CY;
  if (Math.abs(dx) <= HALF || Math.abs(dy) <= HALF) return -1;
  if (dx > 0) return dy > 0 ? JUNC_BOTTOM : JUNC_RIGHT;
  return dy < 0 ? JUNC_TOP : JUNC_LEFT;
}

function draw(ctx: CanvasRenderingContext2D, state: JuncState, size: CanvasSize): void {
  const scale = Math.min(size.width / JUNC_WORLD_W, size.height / JUNC_WORLD_H);
  const ox = (size.width - JUNC_WORLD_W * scale) / 2;
  const oy = (size.height - JUNC_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = JUNC_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, JUNC_WORLD_W, JUNC_WORLD_H);
  ctx.clip();

  // Roads and faint lane lines.
  ctx.fillStyle = JUNC_ROAD;
  ctx.fillRect(JUNC_CX - HALF, 0, HALF * 2, JUNC_WORLD_H);
  ctx.fillRect(0, JUNC_CY - HALF, JUNC_WORLD_W, HALF * 2);
  ctx.strokeStyle = "rgba(245,184,46,0.18)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.moveTo(JUNC_CX, 0);
  ctx.lineTo(JUNC_CX, JUNC_CY - HALF);
  ctx.moveTo(JUNC_CX, JUNC_CY + HALF);
  ctx.lineTo(JUNC_CX, JUNC_WORLD_H);
  ctx.moveTo(0, JUNC_CY);
  ctx.lineTo(JUNC_CX - HALF, JUNC_CY);
  ctx.moveTo(JUNC_CX + HALF, JUNC_CY);
  ctx.lineTo(JUNC_WORLD_W, JUNC_CY);
  ctx.stroke();
  ctx.setLineDash([]);
  // Stop lines.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
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

  // Lights.
  for (let ap = 0; ap < 4; ap++) {
    const [lx, ly] = JUNC_LIGHT_AT[ap]!;
    const green = (state.lights >> ap) & 1;
    ctx.fillStyle = green ? JUNC_GREEN : JUNC_RED;
    ctx.beginPath();
    ctx.arc(lx, ly, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cars, with patience bars and turn indicators.
  const tick = state.tick;
  for (const car of state.cars) {
    const pose = juncCarPose(car);
    const angle = Math.atan2(pose.dy, pose.dx);
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(angle);
    ctx.fillStyle = car.amb ? "#F7F7F8" : JUNC_CAR_COLOURS[car.colour]!;
    ctx.beginPath();
    ctx.roundRect(-CAR_PX, -CAR_W / 2, CAR_PX, CAR_W, 6);
    ctx.fill();
    if (car.amb) {
      // Red cross and a flashing blue light bar.
      ctx.fillStyle = JUNC_RED;
      ctx.fillRect(-CAR_PX / 2 - 7, -2, 14, 4);
      ctx.fillRect(-CAR_PX / 2 - 2, -7, 4, 14);
      const on = Math.trunc(tick / 6) % 2 === 0;
      ctx.fillStyle = on ? "#3B82F6" : "#93C5FD";
      ctx.fillRect(-14, -CAR_W / 2 + 2, 6, CAR_W / 2 - 3);
      ctx.fillStyle = on ? "#93C5FD" : "#3B82F6";
      ctx.fillRect(-14, 1, 6, CAR_W / 2 - 3);
      if (on) {
        ctx.fillStyle = "rgba(59,130,246,0.25)";
        ctx.beginPath();
        ctx.arc(-11, 0, 26, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const toLine = (STOP[car.ap]! - car.s) / juncSpeed(tick);
    if (car.turn && toLine < JUNC_INDICATE_TICKS && toLine > -40 && Math.trunc(tick / 8) % 2 === 0) {
      ctx.fillStyle = "#FF9F1C";
      const side = car.turn === 2 ? 1 : -1;
      ctx.fillRect(-7, side * (CAR_W / 2) - 4, 7, 7);
      ctx.fillRect(-CAR_PX, side * (CAR_W / 2) - 4, 7, 7);
    }
    ctx.restore();
    if (!car.amb && car.wait > 0 && car.s <= STOP[car.ap]!) {
      const left = 1 - car.wait / car.patience;
      ctx.fillStyle = left < 0.3 ? JUNC_RED : "rgba(255,255,255,0.7)";
      ctx.fillRect(pose.x - CAR_PX / 2 - (pose.dx * CAR_PX) / 2, pose.y - 24 - (pose.dy * CAR_PX) / 2, CAR_PX * left, 4);
    }
  }

  if (tick - state.honkTick < 30) {
    const [lx, ly] = JUNC_LIGHT_AT[state.honkAp]!;
    ctx.fillStyle = JUNC_RED;
    ctx.font = "bold 14px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("HONK", lx, ly - 14);
  }

  if (state.ended === 2) {
    ctx.fillStyle = JUNC_RED;
    ctx.beginPath();
    for (let p = 0; p < 16; p++) {
      const a = (p * Math.PI) / 8;
      const r = p % 2 === 0 ? 46 : 20;
      const x = state.crashX + Math.cos(a) * r;
      const y = state.crashY + Math.sin(a) * r;
      if (p === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = JUNC_GOLD;
  ctx.font = "bold 18px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`Cleared ${state.cleared}`, JUNC_WORLD_W / 2, 30);
  ctx.restore();
}

export const junctionGame: ArcadeGame<JuncState, ArcadeInputEvent | null> = {
  key: "junction",
  runTicks: JUNC_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: JUNC_INPUT_RANGES,
};
