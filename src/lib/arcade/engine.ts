/**
 * The deterministic arcade engine.
 *
 * One source of truth: this folder is imported by the phone (rendering) and by
 * the server grading path (replay). Nothing about the simulation lives anywhere
 * else, so a run always produces the same result on every device.
 *
 * Rules this file enforces:
 *  - a fixed timestep of 60 ticks a second; `step` is pure
 *  - integer maths only, positions and speeds in 1/256-pixel units
 *  - randomness comes from a seeded PRNG carried inside the state
 */

/** Simulation rate. Rendering is separate and never drives the sim. */
export const TICKS_PER_SECOND = 60;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

/** Fixed-point unit: one pixel is 256 units. */
export const FP_ONE = 256;

/**
 * At most twelve ticks of catch-up per drawn frame, so a stall cannot spiral.
 * Time above the cap is carried forward by the caller, never discarded.
 */
export const MAX_CATCH_UP_TICKS = 12;

/** Pixels (whole or with a fixed fraction) to fixed-point units. */
export function fp(pixels: number): number {
  return Math.round(pixels * FP_ONE);
}

/** Fixed-point units back to pixels, for drawing only. */
export function px(units: number): number {
  return units / FP_ONE;
}

export function clampInt(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

/* ================================ PRNG ================================ */

/**
 * mulberry32, kept as a plain integer state so it can be copied into the state
 * object. Every draw is integer arithmetic — no `Math.random` anywhere.
 */
export function rngStep(state: number): number {
  return (state + 0x6d2b79f5) | 0;
}

/** A uint32 from the given state; the caller advances the state itself. */
export function rngValue(state: number): number {
  let t = state | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Advances the state and returns an integer in [0, bound). */
export function rngBelow(state: number, bound: number): { state: number; value: number } {
  const next = rngStep(state);
  const value = bound <= 1 ? 0 : rngValue(next) % bound;
  return { state: next, value };
}

/* ============================ Game modules ============================ */

/** Canvas size in CSS pixels; the game scales its own world to fit. */
export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * One arcade game. Adding a second game means adding one module of this shape
 * and one registry entry — the engine itself never changes. `I` is the input a
 * tick takes: a plain tap for most games, a direction for Swerve.
 */
export interface ArcadeGame<S, I = boolean> {
  key: string;
  /** Fixed run length in ticks; there is no timer bonus. */
  runTicks: number;
  init: (seed: number) => S;
  step: (state: S, input: I) => S;
  isOver: (state: S) => boolean;
  score: (state: S) => number;
  draw: (ctx: CanvasRenderingContext2D, state: S, size: CanvasSize) => void;
  /** Declared payload ranges, for games that take structured input events. */
  inputRanges?: readonly InputRange[];
}

/** The largest input log the server will look at. */
export const MAX_INPUT_TAPS = 2000;

export interface InputLogCheck {
  ok: boolean;
  reason?: string;
}

/** Taps must be whole ticks, inside the run, and strictly increasing. */
export function checkInputLog(inputs: number[], runTicks: number): InputLogCheck {
  if (inputs.length > MAX_INPUT_TAPS) return { ok: false, reason: "too many taps" };
  let previous = -1;
  for (const tick of inputs) {
    if (!Number.isInteger(tick) || tick < 1 || tick > runTicks) {
      return { ok: false, reason: "tap outside the run" };
    }
    if (tick <= previous) return { ok: false, reason: "taps out of order" };
    previous = tick;
  }
  return { ok: true };
}

/* ========================== Structured inputs ========================== */

/**
 * One input event. Every field is an integer: `t` is the sim tick the client
 * applied it on, `k` the kind (0 = a plain tap, as the first three games use)
 * and `a`–`d` the payload. A game module declares the ranges its payload may
 * take, and the server refuses anything outside them.
 */
export interface ArcadeInputEvent {
  t: number;
  k: number;
  a: number;
  b: number;
  c: number;
  d: number;
}

/** The largest event log the server will look at. */
export const MAX_INPUT_EVENTS = 2000;

export type InputBound = readonly [number, number];

export interface InputRange {
  k: number;
  a: InputBound;
  b: InputBound;
  c: InputBound;
  d: InputBound;
}

const ZERO: InputBound = [0, 0];

/** Declares one kind of event and the range each payload field may take. */
export function inputRange(
  k: number,
  a: InputBound = ZERO,
  b: InputBound = ZERO,
  c: InputBound = ZERO,
  d: InputBound = ZERO,
): InputRange {
  return { k, a, b, c, d };
}

function withinBound(value: number, bound: InputBound): boolean {
  return Number.isInteger(value) && value >= bound[0] && value <= bound[1];
}

/**
 * Events must be whole ticks inside the run, non-decreasing in tick, of a kind
 * the game declares, and carry payload values inside that kind's ranges.
 */
export function checkInputEvents(
  events: readonly ArcadeInputEvent[],
  runTicks: number,
  ranges: readonly InputRange[],
): InputLogCheck {
  if (events.length > MAX_INPUT_EVENTS) return { ok: false, reason: "too many inputs" };
  let previous = 0;
  for (const event of events) {
    if (!Number.isInteger(event.t) || event.t < 1 || event.t > runTicks) {
      return { ok: false, reason: "input outside the run" };
    }
    if (event.t < previous) return { ok: false, reason: "inputs out of order" };
    previous = event.t;
    const range = ranges.find((item) => item.k === event.k);
    if (!range) return { ok: false, reason: "unknown input kind" };
    if (
      !withinBound(event.a, range.a) ||
      !withinBound(event.b, range.b) ||
      !withinBound(event.c, range.c) ||
      !withinBound(event.d, range.d)
    ) {
      return { ok: false, reason: "input payload out of range" };
    }
  }
  return { ok: true };
}

export function encodeInputEvents(events: readonly ArcadeInputEvent[]): string {
  return events
    .map((event) => [event.t, event.k, event.a, event.b, event.c, event.d].join(":"))
    .join(",");
}

export function decodeInputEvents(raw: string): ArcadeInputEvent[] {
  return String(raw ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, MAX_INPUT_EVENTS + 1)
    .map((part) => part.split(":").map((value) => Number.parseInt(value, 10)))
    .filter((values) => values.length === 6 && values.every(Number.isInteger))
    .map(([t, k, a, b, c, d]) => ({
      t: t ?? 0,
      k: k ?? 0,
      a: a ?? 0,
      b: b ?? 0,
      c: c ?? 0,
      d: d ?? 0,
    }));
}

export interface ReplayOutcome<S> {
  state: S;
  score: number;
  /** How many ticks actually ran before the run ended. */
  ticks: number;
  valid: boolean;
  reason?: string;
}

/**
 * The server's replay, and the only place a score comes from. The tap list is
 * applied at the ticks it claims; the run then plays out to a crash or the end.
 */
export function replayArcadeRun<S>(
  game: ArcadeGame<S>,
  seed: number,
  inputs: number[],
  /** Stop here instead of the full run — used when a phone lagged behind. */
  untilTick?: number,
): ReplayOutcome<S> {
  const check = checkInputLog(inputs, game.runTicks);
  const taps = check.ok ? new Set(inputs) : new Set<number>();
  const lastTick =
    untilTick && untilTick > 0 ? Math.min(game.runTicks, Math.floor(untilTick)) : game.runTicks;
  let state = game.init(seed);
  let ticks = 0;

  for (let tick = 1; tick <= lastTick; tick++) {
    state = game.step(state, taps.has(tick));
    ticks = tick;
    if (game.isOver(state)) break;
  }

  const outcome: ReplayOutcome<S> = {
    state,
    score: game.score(state),
    ticks,
    valid: check.ok,
  };
  if (check.reason) outcome.reason = check.reason;
  return outcome;
}

/* ============================= Flick gestures ============================ */

/** One sampled pointer position, in world pixels, with its wall-clock reading. */
export interface FlickSample {
  x: number;
  y: number;
  time: number;
}

/** The movement window a flick is measured over: the last 80 ms of the swipe. */
export const FLICK_WINDOW_MS = 80;

/**
 * The finger's movement over the last {@link FLICK_WINDOW_MS} of a swipe, taken
 * from the earliest sample still inside the window — never from the start point.
 */
export function flickWindow(
  samples: readonly FlickSample[],
  endTime: number,
): { dx: number; dy: number; dtMs: number } | null {
  const last = samples[samples.length - 1];
  if (!last || samples.length < 2) return null;
  let first = samples[0]!;
  for (const sample of samples) {
    if (endTime - sample.time <= FLICK_WINDOW_MS) {
      first = sample;
      break;
    }
    first = sample;
  }
  const dtMs = last.time - first.time;
  if (dtMs <= 0) return null;
  return { dx: last.x - first.x, dy: last.y - first.y, dtMs };
}

/* --------------------------- Flick calibration -------------------------- */

/**
 * A real phone flick runs at roughly 800–1500 px/s, so the reference swipe is
 * 1000 px/s: each game states the launch speed that swipe produces and every
 * other swipe is scaled from it.
 */
export const FLICK_REF_PXS = 1_300;
/** Swipe speed is clamped to this band; below the floor the gesture is ignored. */
export const FLICK_MIN_PXS = 250;
export const FLICK_MAX_PXS = 2_200;
/** A swipe shorter than this many pixels is ignored. */
export const FLICK_MIN_PX = 30;

/** One table entry per {@link FLICK_TABLE_STEP} px/s of swipe speed. */
export const FLICK_TABLE_STEP = 50;
/**
 * round(256 × sqrt(speed ÷ 1300)) at every table step, so launch speed grows
 * with the square root of swipe speed: twice as fast a flick throws about 1.4×
 * as hard. Integer-only, so client and server agree exactly.
 */
export const FLICK_SQRT_256: readonly number[] = [
  0, 50, 71, 87, 100, 112, 123, 133, 142, 151, 159, 167, 174, 181, 188, 194, 201, 207, 213, 219,
  225, 230, 235, 241, 246, 251, 256, 261, 266, 270, 275, 280, 284, 288, 293, 297, 301, 305, 309,
  314, 318, 321, 325, 329, 333,
];

/** The launch scale for a swipe speed, in 256ths: 256 at the reference speed. */
export function flickScale256(speedPxS: number): number {
  const speed = clampInt(Math.round(speedPxS), FLICK_MIN_PXS, FLICK_MAX_PXS);
  const index = Math.floor(speed / FLICK_TABLE_STEP);
  const last = FLICK_SQRT_256.length - 1;
  const low = FLICK_SQRT_256[Math.min(index, last)]!;
  const high = FLICK_SQRT_256[Math.min(index + 1, last)]!;
  const fraction = speed - index * FLICK_TABLE_STEP;
  return low + Math.floor(((high - low) * fraction) / FLICK_TABLE_STEP);
}

export interface FlickLaunch {
  /** Launch velocity in 1/256 px a tick; upwards is negative `vy`. */
  vx: number;
  vy: number;
  /** The swipe itself, for the dev readout. */
  speedPxS: number;
  angleDeg: number;
}

/**
 * Turns the last stretch of finger movement into a launch velocity. `dx`/`dy`
 * are world pixels moved over `dtMs` milliseconds; upwards is negative `dy`.
 * `refSpeed` is the launch speed the reference 1300 px/s swipe produces.
 * Returns null for a short, slow or downward swipe.
 */
export function flickLaunch(
  dx: number,
  dy: number,
  dtMs: number,
  refSpeed: number,
): FlickLaunch | null {
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < FLICK_MIN_PX) return null;
  if (dy >= 0) return null;
  const dt = Math.max(TICK_MS, dtMs);
  const speedPxS = Math.round((length * 1000) / dt);
  if (speedPxS < FLICK_MIN_PXS) return null;
  const speed = Math.round((refSpeed * flickScale256(speedPxS)) / 256);
  const angleDeg = Math.round((Math.atan2(-dy, dx) * 180) / Math.PI);
  return {
    vx: Math.round((speed * dx) / length),
    vy: Math.round((speed * dy) / length),
    speedPxS,
    angleDeg,
  };
}
