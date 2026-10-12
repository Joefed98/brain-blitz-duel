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
import { bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";

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
const CAR_POINTS = 2;
/** Ambulances: from 20 s, one every 15 s, 1.3× speed, ±4 points each. */
export const JUNC_AMB_FROM = 20 * TICKS_PER_SECOND;
export const JUNC_AMB_EVERY = 15 * TICKS_PER_SECOND;
const AMB_SPEED_NUM = 13;
const AMB_SPEED_DEN = 10;
const AMB_POINTS = 4;
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
  /** junctionRev 2 only: 1 for a bus (long vehicle). */
  kind?: number;
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
  /** junctionRev 2 only: 1 for a bus (long vehicle). */
  kind?: number;
}

export interface JuncState extends BandFields {
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
  /** junctionRev 2 only (absent on stored original rounds). */
  rev?: number;
  /** Diagonal approach built at each 12 s step, in order (seeded). */
  builds?: number[];
  /** Buses cleared, and cars cleared from diagonal roads (both also in `cleared`). */
  busCleared?: number;
  diagCleared?: number;
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
        // An ambulance never gives up; being made to stop costs 4, once.
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

/** 2 per car cleared, −1 per car that gave up, ±4 per ambulance, +40 for the minute; 0–150. */
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
  // junctionRev 2: bus and diagonal counters fold into the checksum; encoded fields are unchanged.
  if (state.rev === JUNC_REV) values.push(state.busCleared ?? 0, state.diagCleared ?? 0);
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
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: JUNC_INPUT_RANGES,
};

/* ================= junctionRev 2: the growing eight-way junction ================= */

/**
 * Stored as puzzle.junctionRev. At 12, 24, 36 and 48 s a diagonal one-way road
 * is built into a corner of the junction (the order is seeded), each with its
 * own light at its stop line, so the crossroads becomes an eight-way junction.
 * Diagonal traffic bears left onto the main road. Buses are long and take
 * longer to clear the box. Two vehicles from different roads in the box crash,
 * except straight-on traffic from opposite main roads (as before). Ambulances
 * (main roads only) keep ±4. Unstamped rounds keep the original rules and score.
 */
export const JUNC_REV = 2;
/** Diagonal approaches: from the top-right, bottom-right, bottom-left and top-left corners. */
export const JUNC_NE = 4;
export const JUNC_SE = 5;
export const JUNC_SW = 6;
export const JUNC_NW = 7;
export const JUNC_APPROACHES_V2 = 8;
export const JUNC_BUILD_EVERY = 12 * TICKS_PER_SECOND;
export const JUNC_BUILDS = 4;
/** The build animation, and the wait before a new road's first car. */
export const JUNC_BUILD_TICKS = 60;
export const JUNC_DIAG_FIRST_CAR = 90;
/** Buses: from 6 s on the main roads, about one arrival in five, straight on, 1.7× a car. */
export const JUNC_BUS_FROM = 6 * TICKS_PER_SECOND;
export const JUNC_BUS_PX = 70;
const BUS_LEN = JUNC_BUS_PX * FP;
/** Rev-2 traffic: a little denser than the original as roads are added. */
const ARRIVE_START_V2 = 80;
const ARRIVE_END_V2 = 27;
/** Rev-2 points: per car, per bus, −1 per driver who gives up, ±4 per ambulance, + the minute. */
export const JUNC_V2_CAR_POINTS = 2;
export const JUNC_V2_BUS_POINTS = 3;
export const JUNC_V2_SURVIVE_BONUS = 20;
/** Rev 2: main-road vehicles keep the box until their tail is this far past it (diagonal lanes cross just outside). */
const ORTH_TAIL_V2 = 24 * FP;
/** Diagonal lane, in its own path units (1/256 px from the spawn point): stop line, turn onto the main road, box exit. */
const DIAG_STOP = 62_464;
const DIAG_PIVOT = 83_617;
const DIAG_EXIT = 93_249;

export const JUNC_INPUT_RANGES_V2: readonly InputRange[] = [inputRange(JUNC_INPUT_TAP, [0, JUNC_APPROACHES_V2 - 1])];

/** The diagonal road built at each step, from its own stream off the seed. */
export function juncBuildOrder(seed: number): number[] {
  let rng = (seed ^ 0x3c6e_f372) | 0;
  const pool = [JUNC_NE, JUNC_SE, JUNC_SW, JUNC_NW];
  const out: number[] = [];
  while (pool.length) {
    const r = rngBelow(rng, pool.length);
    rng = r.state;
    out.push(pool.splice(r.value, 1)[0]!);
  }
  return out;
}

/** Tick a diagonal approach is built (Infinity for a main road, which is always there: −1). */
export function juncBuiltAt(builds: readonly number[], ap: number): number {
  if (ap < 4) return -1;
  const k = builds.indexOf(ap);
  return k < 0 ? Infinity : (k + 1) * JUNC_BUILD_EVERY;
}

export function juncIsDiagonal(ap: number): boolean {
  return ap >= 4;
}

function buildScheduleV2(seed: number) {
  const builds = juncBuildOrder(seed);
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const arrivals: JuncArrival[] = [];
  const served = new Set<number>();
  for (let t = FIRST_ARRIVAL; t <= JUNC_RUN_TICKS; ) {
    const open: number[] = [0, 1, 2, 3];
    for (const ap of builds) if (juncBuiltAt(builds, ap) + JUNC_DIAG_FIRST_CAR <= t) open.push(ap);
    // A new road's first car is the next arrival once it opens; after that roads are drawn evenly.
    const drawn = open[draw(open.length)]!;
    const fresh = open.find((road) => road >= 4 && !served.has(road));
    const ap = fresh ?? drawn;
    served.add(ap);
    const turn = ap < 4 && t >= TURNS_FROM && draw(3) === 0 ? 1 + draw(2) : 0;
    const kind = ap < 4 && !turn && t >= JUNC_BUS_FROM && draw(5) === 0 ? 1 : 0;
    arrivals.push({
      tick: t,
      ap,
      turn,
      patience: PATIENCE_START - Math.trunc(((PATIENCE_START - PATIENCE_END) * t) / JUNC_RUN_TICKS),
      colour: draw(4),
      amb: 0,
      kind,
    });
    t += ARRIVE_START_V2 - Math.trunc(((ARRIVE_START_V2 - ARRIVE_END_V2) * t) / JUNC_RUN_TICKS);
  }
  // Ambulances: the original stream and timing, on the main roads.
  let ambRng = (seed ^ 0x5bd1e995) | 0;
  const ambDraw = (bound: number) => {
    const r = rngBelow(ambRng, bound);
    ambRng = r.state;
    return r.value;
  };
  for (let t = JUNC_AMB_FROM; t < JUNC_RUN_TICKS - 3 * TICKS_PER_SECOND; t += JUNC_AMB_EVERY) {
    const at = t + ambDraw(TICKS_PER_SECOND);
    arrivals.push({ tick: at, ap: ambDraw(4), turn: 0, patience: 1 << 30, colour: 0, amb: 1, kind: 0 });
  }
  arrivals.sort((a, b) => a.tick - b.tick || a.amb - b.amb);
  return { arrivals, rng, builds };
}

const cacheV2 = new Map<number, ReturnType<typeof buildScheduleV2>>();

function initV2(seed: number): JuncState {
  let plan = cacheV2.get(seed | 0);
  if (!plan) {
    plan = buildScheduleV2(seed);
    if (cacheV2.size > 16) cacheV2.clear();
    cacheV2.set(seed | 0, plan);
  }
  return { ...init(seed), rng: plan.rng, arrivals: plan.arrivals, rev: JUNC_REV, builds: plan.builds, busCleared: 0, diagCleared: 0 };
}

export function juncLenOf(car: { kind?: number }): number {
  return car.kind === 1 ? BUS_LEN : CAR_LEN;
}
export function juncStopOf(ap: number): number {
  return ap < 4 ? STOP[ap]! : DIAG_STOP;
}
function exitOfV2(car: JuncCar): number {
  return car.ap < 4 ? STOP[car.ap]! + BOX + (car.turn ? TURN_EXTRA : 0) + ORTH_TAIL_V2 : DIAG_EXIT;
}
function removeOfV2(car: JuncCar): number {
  return car.ap < 4 ? 2 * STOP[car.ap]! + BOX + 40 * FP + juncLenOf(car) : DIAG_EXIT + 380 * FP;
}
function inBoxV2(car: JuncCar): boolean {
  return car.s > juncStopOf(car.ap) && car.s - juncLenOf(car) < exitOfV2(car);
}

function stepV2(state: JuncState, input: ArcadeInputEvent | null): JuncState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const builds = state.builds ?? [];
  const s: JuncState = { ...state, tick, cars: state.cars.map((car) => ({ ...car })) };
  if (input && input.k === JUNC_INPUT_TAP) {
    const ap = clampInt(input.a, 0, JUNC_APPROACHES_V2 - 1);
    // A road that is not built yet has no light to switch.
    if (juncBuiltAt(builds, ap) <= tick) s.lights ^= 1 << ap;
  }

  while (s.next < s.arrivals.length && s.arrivals[s.next]!.tick <= tick) {
    const a = s.arrivals[s.next]!;
    let back: JuncCar | undefined;
    for (const car of s.cars) if (car.ap === a.ap && car.s - juncLenOf(car) < exitOfV2(car)) back = car;
    const start = back ? Math.min(0, back.s - juncLenOf(back) - CAR_GAP) : 0;
    if (s.cars.length < 16 || a.amb)
      s.cars.push({ id: s.next, ap: a.ap, turn: a.turn, s: start, wait: 0, patience: a.patience, cleared: 0, colour: a.colour, amb: a.amb, stopped: 0, kind: a.kind ?? 0 });
    s.next += 1;
  }

  const speed = juncSpeed(tick);
  const leader: (JuncCar | null)[] = new Array<JuncCar | null>(JUNC_APPROACHES_V2).fill(null);
  const kept: JuncCar[] = [];
  for (const car of s.cars) {
    const stop = juncStopOf(car.ap);
    const own = car.amb ? Math.trunc((speed * AMB_SPEED_NUM) / AMB_SPEED_DEN) : speed;
    let target = car.s + own;
    const ahead = leader[car.ap];
    if (ahead && ahead.s - juncLenOf(ahead) < exitOfV2(ahead)) target = Math.min(target, ahead.s - juncLenOf(ahead) - CAR_GAP);
    const green = (s.lights >> car.ap) & 1;
    if (!green && car.s <= stop) target = Math.min(target, stop);
    const moved = Math.max(0, target - car.s);
    car.s += moved;
    if (car.s <= stop && moved * 2 < own) {
      if (car.amb) {
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
    if (!car.cleared && car.s - juncLenOf(car) >= exitOfV2(car)) {
      car.cleared = 1;
      if (!car.amb) {
        s.cleared += 1;
        if (car.kind === 1) s.busCleared = (s.busCleared ?? 0) + 1;
        if (car.ap >= 4) s.diagCleared = (s.diagCleared ?? 0) + 1;
      } else if (!car.stopped) s.ambThrough += 1;
    }
    leader[car.ap] = car;
    if (car.s < removeOfV2(car)) kept.push(car);
  }
  s.cars = kept;

  // Two roads in the box at once crash, except straight-on traffic from opposite main roads.
  const box = kept.filter((car) => !car.amb && inBoxV2(car));
  for (let i = 0; i < box.length && !s.ended; i++) {
    for (let j = i + 1; j < box.length; j++) {
      const a = box[i]!;
      const b = box[j]!;
      if (a.ap === b.ap) continue;
      const opposite = a.ap < 4 && b.ap < 4 && vertical(a.ap) === vertical(b.ap) && !a.turn && !b.turn;
      if (!opposite) {
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

/** Rev 2: 2 per car, 3 per bus, −1 per driver who gave up, ±4 per ambulance, +20 for the minute; 0–150. */
export function juncScoreV2(cleared: number, busCleared: number, gaveUp: number, survived: boolean, ambThrough: number, ambStopped: number): number {
  return clampInt(
    JUNC_V2_CAR_POINTS * (cleared - busCleared) + JUNC_V2_BUS_POINTS * busCleared - gaveUp + AMB_POINTS * (ambThrough - ambStopped) + (survived ? JUNC_V2_SURVIVE_BONUS : 0),
    0,
    150,
  );
}

function scoreV2(state: JuncState): number {
  return juncScoreV2(state.cleared, state.busCleared ?? 0, state.gaveUp, state.ended === 1, state.ambThrough, state.ambStopped);
}

/* ---------------------------- Rev-2 geometry (render + input) ---------------------------- */

const R2 = Math.SQRT1_2;
/** NE diagonal (heading down-left): spawn point, inbound heading, the bend onto the main road, outbound heading. */
const NE_SPAWN: readonly [number, number] = [JUNC_CX + 214.96, JUNC_CY - 237.588];
const NE_PIVOT: readonly [number, number] = [JUNC_CX - LANE, JUNC_CY - 6.627];
/** Rotate a vector about the junction centre by `q` quarter turns clockwise (screen axes). */
function rot(q: number, x: number, y: number): [number, number] {
  let a = x;
  let b = y;
  for (let k = 0; k < q; k++) [a, b] = [-b, a];
  return [a, b];
}
function diagQuarter(ap: number): number {
  return ap - JUNC_NE;
}

/** Screen pose of any rev-2 vehicle's front and heading (render only). */
export function juncCarPoseV2(car: JuncCar): { x: number; y: number; dx: number; dy: number } {
  if (car.ap < 4) return juncCarPose(car);
  const q = diagQuarter(car.ap);
  const s = car.s / FP;
  const [sx, sy] = rot(q, NE_SPAWN[0] - JUNC_CX, NE_SPAWN[1] - JUNC_CY);
  const [ix, iy] = rot(q, -R2, R2);
  const pivot = DIAG_PIVOT / FP;
  if (s <= pivot) return { x: JUNC_CX + sx + ix * s, y: JUNC_CY + sy + iy * s, dx: ix, dy: iy };
  const [px0, py0] = rot(q, NE_PIVOT[0] - JUNC_CX, NE_PIVOT[1] - JUNC_CY);
  const [ox, oy] = rot(q, 0, 1);
  return { x: JUNC_CX + px0 + ox * (s - pivot), y: JUNC_CY + py0 + oy * (s - pivot), dx: ox, dy: oy };
}

/** A point on an approach's inbound lane at path distance `s` px (render and taps). */
export function juncLanePoint(ap: number, s: number): { x: number; y: number; dx: number; dy: number } {
  return juncCarPoseV2({ id: 0, ap, turn: 0, s: Math.trunc(s * FP), wait: 0, patience: 1, cleared: 0, colour: 0, amb: 0, stopped: 0 });
}

/**
 * Where each rev-2 light stands: on the kerb beside its own lane, just behind
 * the stop line (28 px back, 27 px to the driver's right), which keeps every
 * light at least 25 px clear of every lane and 60 px from any other light.
 */
export const JUNC_LIGHT_BACK = 28;
export const JUNC_LIGHT_SIDE = 27;
export const JUNC_LIGHT_AT_V2: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [];
  for (let ap = 0; ap < JUNC_APPROACHES_V2; ap++) {
    const p = juncLanePoint(ap, juncStopOf(ap) / FP - JUNC_LIGHT_BACK);
    // The driver's right-hand side on screen is (−dy, dx).
    out.push([p.x - p.dy * JUNC_LIGHT_SIDE, p.y + p.dx * JUNC_LIGHT_SIDE]);
  }
  return out;
})();

/**
 * Which light a tap means (rev 2): the nearest built light within 34 px, else
 * the nearest built inbound lane (stop line back to the screen edge) within
 * 22 px; −1 otherwise.
 */
export function juncApproachAtV2(x: number, y: number, builds: readonly number[], tick: number): number {
  let best = -1;
  let bestD = 34 * 34;
  for (let ap = 0; ap < JUNC_APPROACHES_V2; ap++) {
    if (juncBuiltAt(builds, ap) > tick) continue;
    const [lx, ly] = JUNC_LIGHT_AT_V2[ap]!;
    const d = (x - lx) ** 2 + (y - ly) ** 2;
    if (d < bestD) {
      bestD = d;
      best = ap;
    }
  }
  if (best >= 0) return best;
  bestD = 22 * 22;
  for (let ap = 0; ap < JUNC_APPROACHES_V2; ap++) {
    if (juncBuiltAt(builds, ap) > tick) continue;
    const a = juncLanePoint(ap, 0);
    const b = juncLanePoint(ap, juncStopOf(ap) / FP);
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const u = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy)));
    const d = (x - a.x - vx * u) ** 2 + (y - a.y - vy * u) ** 2;
    if (d < bestD) {
      bestD = d;
      best = ap;
    }
  }
  return best;
}

export const junctionRev2Game: ArcadeGame<JuncState, ArcadeInputEvent | null> = {
  ...junctionGame,
  init: initV2,
  step: bandStep(stepV2),
  score: bandScoreOf(scoreV2, scoreBand),
  inputRanges: JUNC_INPUT_RANGES_V2,
};
export function junctionGameFor(rev?: number | null): ArcadeGame<JuncState, ArcadeInputEvent | null> {
  if (rev === JUNC_REV_BAND) return junctionBandGame;
  return rev === JUNC_REV ? junctionRev2Game : junctionGame;
}

/* ================= Oct 2026 score bands (junctionRev 3) ================= */

/** Score-band revision (puzzle.junctionRev = 3): rev-2 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const JUNC_REV_BAND = 3;
/** Cars 2, buses 3, ±4 an ambulance, −1 a driver who gave up; 140 at 130; lasting the minute adds 10 (was 20). */
export const JUNC_BAND_CURVE = bandCurve([0, 50, 89, 108, 118, 130], [0, 40, 70, 100, 120, 140]);
export function junctionBandParts(state: JuncState): BandParts {
  const units = Math.max(0, JUNC_V2_CAR_POINTS * (state.cleared - (state.busCleared ?? 0)) + JUNC_V2_BUS_POINTS * (state.busCleared ?? 0) - state.gaveUp + AMB_POINTS * (state.ambThrough - state.ambStopped));
  const finished = state.ended === 1;
  return { units, points: bandPoints(JUNC_BAND_CURVE, units), bonus: finished ? BAND_FINISH_BONUS : 0, penalty: 0, finished, text: `${state.cleared} through (${state.busCleared ?? 0} buses) · ${state.gaveUp} gave up · ambulances +${state.ambThrough} / −${state.ambStopped}`, bonusText: "Lasted the minute" };
}

function scoreBand(state: JuncState): number {
  return bandTotal(junctionBandParts(state), Boolean(state.acted));
}

export const junctionBandGame: ArcadeGame<JuncState, ArcadeInputEvent | null> = { ...junctionRev2Game, init: (seed) => bandInit(junctionRev2Game.init(seed)) };
