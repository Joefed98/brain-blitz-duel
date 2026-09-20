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

/** At most six ticks of catch-up per drawn frame, so a stall cannot spiral. */
export const MAX_CATCH_UP_TICKS = 6;

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
 * and one registry entry — the engine itself never changes.
 */
export interface ArcadeGame<S> {
  key: string;
  /** Fixed run length in ticks; there is no timer bonus. */
  runTicks: number;
  init: (seed: number) => S;
  step: (state: S, tapped: boolean) => S;
  isOver: (state: S) => boolean;
  score: (state: S) => number;
  draw: (ctx: CanvasRenderingContext2D, state: S, size: CanvasSize) => void;
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
): ReplayOutcome<S> {
  const check = checkInputLog(inputs, game.runTicks);
  const taps = check.ok ? new Set(inputs) : new Set<number>();
  let state = game.init(seed);
  let ticks = 0;

  for (let tick = 1; tick <= game.runTicks; tick++) {
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
