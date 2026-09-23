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

/**
 * The one arcade scoring rule: round(110 x achieved / par), capped at 110.
 * Integer maths only, so the phone and the server can never round differently.
 */
export const ARCADE_PAR_POINTS = 110;
export const ARCADE_COMPLETION_BONUS = 40;
export function parPoints(achieved: number, par: number): number {
  if (par <= 0 || achieved <= 0) return 0;
  const a = Math.trunc(achieved);
  const p = Math.trunc(par);
  return Math.min(ARCADE_PAR_POINTS, Math.floor((2 * ARCADE_PAR_POINTS * a + p) / (2 * p)));
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

/** The largest tap log the server will look at. */
export const MAX_INPUT_TAPS = 6000;

/** The first input the server had to repair, for diagnostics. */
export interface InputIssue {
  index: number;
  t: number;
  k: number;
  a: number;
  b: number;
  c: number;
  d: number;
  reason: string;
}

/** What the server did to a submitted log before replaying it. */
export interface InputDiag {
  received: number;
  /** Events repaired (clamped tick or payload) and replayed. */
  clamped: number;
  /** Events that could not be replayed at all (unknown kind, beyond the cap). */
  dropped: number;
  first: InputIssue | null;
}

export interface InputLogCheck {
  /** True when every event was already clean; repaired logs still replay. */
  ok: boolean;
  reason?: string;
  diag: InputDiag;
}

function toInt(value: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function logIssues(label: string, diag: InputDiag): void {
  if (diag.clamped === 0 && diag.dropped === 0) return;
  console.warn(`[arcade] ${label}: repaired input log`, diag);
}

/**
 * Taps are repaired, never rejected: ticks are clamped into the run and made
 * strictly increasing; one that cannot fit is dropped. Every repair is counted.
 */
export function sanitizeTaps(
  inputs: readonly number[],
  runTicks: number,
): InputLogCheck & { ticks: number[] } {
  const diag: InputDiag = { received: inputs.length, clamped: 0, dropped: 0, first: null };
  const ticks: number[] = [];
  let previous = 0;
  inputs.forEach((raw, index) => {
    const issue = (reason: string) => {
      if (!diag.first) diag.first = { index, t: raw, k: 0, a: 0, b: 0, c: 0, d: 0, reason };
    };
    if (index >= MAX_INPUT_TAPS) {
      diag.dropped += 1;
      issue("beyond the input cap");
      return;
    }
    let tick = clampInt(toInt(raw), 1, runTicks);
    if (tick <= previous) tick = previous + 1;
    if (tick > runTicks) {
      diag.dropped += 1;
      issue("tap after the run");
      return;
    }
    if (tick !== raw) {
      diag.clamped += 1;
      issue(raw < previous + 1 ? "tap out of order" : "tap outside the run");
    }
    ticks.push(tick);
    previous = tick;
  });
  logIssues("taps", diag);
  const ok = diag.clamped === 0 && diag.dropped === 0;
  return { ok, ...(ok ? {} : { reason: diag.first?.reason ?? "input log repaired" }), diag, ticks };
}

/** Back-compatible name: the repaired tap list is on `ticks`. */
export function checkInputLog(inputs: number[], runTicks: number) {
  return sanitizeTaps(inputs, runTicks);
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

/** The largest event log the server will look at — one event per tick of the longest run (Bubble Pop, 5400). */
export const MAX_INPUT_EVENTS = 6000;

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

function clampToRange(event: ArcadeInputEvent, range: InputRange): ArcadeInputEvent {
  return {
    t: event.t,
    k: event.k,
    a: clampInt(toInt(event.a), range.a[0], range.a[1]),
    b: clampInt(toInt(event.b), range.b[0], range.b[1]),
    c: clampInt(toInt(event.c), range.c[0], range.c[1]),
    d: clampInt(toInt(event.d), range.d[0], range.d[1]),
  };
}

/**
 * The client's only way to give the sim an input: the event is quantised and
 * clamped to the game's declared ranges, then appended to the run log — at most
 * one per tick. Returns the event as recorded, or null when nothing was.
 */
export function recordInput(
  log: ArcadeInputEvent[],
  event: ArcadeInputEvent | null,
  ranges: readonly InputRange[] | undefined,
): ArcadeInputEvent | null {
  if (!event) return null;
  const range = (ranges ?? []).find((item) => item.k === event.k);
  if (!range) return null;
  const last = log[log.length - 1];
  if (last && last.t >= event.t) return null;
  if (log.length >= MAX_INPUT_EVENTS) return null;
  const recorded = clampToRange({ ...event, t: toInt(event.t) }, range);
  log.push(recorded);
  return recorded;
}

/** The sim reads its input for a tick from the recorded log, nowhere else. */
export function inputAt(log: readonly ArcadeInputEvent[], tick: number): ArcadeInputEvent | null {
  const last = log[log.length - 1];
  return last && last.t === tick ? last : null;
}

/** Tap games: record a tap on a tick (once), and read it back. */
export function recordTap(log: number[], tick: number): void {
  const last = log[log.length - 1];
  if (last !== undefined && last >= tick) return;
  if (log.length >= MAX_INPUT_TAPS) return;
  log.push(tick);
}

export function tapAt(log: readonly number[], tick: number): boolean {
  return log[log.length - 1] === tick;
}

/**
 * The server's repair pass. A bad event never aborts or silently truncates the
 * replay: ticks are clamped into the run and made non-decreasing, payloads are
 * clamped to the declared ranges, and only events of an unknown kind (or beyond
 * the cap) are dropped. Every repair is counted, and the first is kept.
 */
export function checkInputEvents(
  events: readonly ArcadeInputEvent[],
  runTicks: number,
  ranges: readonly InputRange[],
): InputLogCheck & { events: ArcadeInputEvent[] } {
  const diag: InputDiag = { received: events.length, clamped: 0, dropped: 0, first: null };
  const out: ArcadeInputEvent[] = [];
  let previous = 1;
  events.forEach((event, index) => {
    const issue = (reason: string) => {
      if (!diag.first) diag.first = { index, ...event, reason };
    };
    if (index >= MAX_INPUT_EVENTS) {
      diag.dropped += 1;
      issue("beyond the input cap");
      return;
    }
    const range = ranges.find((item) => item.k === event.k);
    if (!range) {
      diag.dropped += 1;
      issue("unknown input kind");
      return;
    }
    let t = clampInt(toInt(event.t), 1, runTicks);
    let reason = t !== event.t ? "input outside the run" : "";
    if (t < previous) {
      t = previous;
      reason = "input out of order";
    }
    const fixed = clampToRange({ ...event, t }, range);
    if (
      !reason &&
      (fixed.a !== event.a || fixed.b !== event.b || fixed.c !== event.c || fixed.d !== event.d)
    ) {
      reason = "input payload out of range";
    }
    if (reason) {
      diag.clamped += 1;
      issue(reason);
    }
    out.push(fixed);
    previous = t;
  });
  logIssues("events", diag);
  const ok = diag.clamped === 0 && diag.dropped === 0;
  return { ok, ...(ok ? {} : { reason: diag.first?.reason ?? "input log repaired" }), diag, events: out };
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
  const taps = new Set(check.ticks);
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

/* ============================= Drag aiming ============================== */

/**
 * Aiming is by drag POSITION, never by finger speed: the aim vector is the
 * current finger position minus the anchor taken on touch-down. Its direction
 * is the launch direction and its length is the strength, so the predicted path
 * stays exactly where the finger holds it — including when the finger is still.
 */

/** A drag shorter than this many pixels is cancelled without a shot. */
export const DRAG_MIN_PX = 20;
/** Full power: this much drag, in pixels. */
export const DRAG_FULL_PX = 220;

/** Launch scale in 256ths at the shortest and the fullest drag. */
export const DRAG_MIN_SCALE_256 = 112;
export const DRAG_MAX_SCALE_256 = 333;

/** The launch scale for a drag length, in 256ths: 256 is the reference launch. */
export function dragScale256(lengthPx: number): number {
  const length = clampInt(Math.round(lengthPx), DRAG_MIN_PX, DRAG_FULL_PX);
  const span = DRAG_FULL_PX - DRAG_MIN_PX;
  return (
    DRAG_MIN_SCALE_256 +
    Math.floor(((DRAG_MAX_SCALE_256 - DRAG_MIN_SCALE_256) * (length - DRAG_MIN_PX)) / span)
  );
}

export interface DragLaunch {
  /** Launch velocity in 1/256 px a tick; upwards is negative `vy`. */
  vx: number;
  vy: number;
  /** The drag itself, for the aim path. */
  lengthPx: number;
  angleDeg: number;
}

/**
 * Turns an aim vector into a launch velocity. `dx`/`dy` are the world pixels
 * from the anchor to the finger; upwards is negative `dy`, and a downward
 * vector is clamped to horizontal. Returns null for a drag under
 * {@link DRAG_MIN_PX}.
 */
export function dragLaunch(dx: number, dy: number, refSpeed: number): DragLaunch | null {
  const lengthPx = Math.sqrt(dx * dx + dy * dy);
  if (lengthPx < DRAG_MIN_PX) return null;
  // A downward-pointing vector is clamped to horizontal.
  const up = dy < 0 ? dy : 0;
  const dirLen = Math.sqrt(dx * dx + up * up);
  if (dirLen <= 0) return null;
  const speed = Math.round((refSpeed * dragScale256(lengthPx)) / 256);
  return {
    vx: Math.round((speed * dx) / dirLen),
    vy: Math.round((speed * up) / dirLen),
    lengthPx: Math.round(lengthPx),
    angleDeg: Math.round((Math.atan2(-up, dx) * 180) / Math.PI),
  };
}

/* =========================== Drag position input ======================== */

/**
 * Kind 7: a drag POSITION, `a` = x and (where the game says so) `b` = y, in
 * whole world pixels. The phone records one event only on the ticks where the
 * position changes; the simulation holds the last value in between, so a still
 * finger costs nothing and the log stays small.
 */
export const ARCADE_INPUT_DRAG = 7;

/**
 * Kind 10: an on-screen power-up button press, `a` naming which button. The
 * press is recorded on the sim tick it applied on; what it does lives in the
 * game module, so the server sees exactly the same effect.
 */
export const ARCADE_INPUT_BUTTON = 10;

/** Integer square root — used by the ball games so no float enters the sim. */
export function isqrt(value: number): number {
  if (value <= 0) return 0;
  let guess = Math.floor(Math.sqrt(value));
  // Correct the float estimate with integer steps so every device agrees.
  while (guess > 0 && guess * guess > value) guess -= 1;
  while ((guess + 1) * (guess + 1) <= value) guess += 1;
  return guess;
}

/** Rescales a vector to the given length, in the same fixed-point units. */
export function setLength(vx: number, vy: number, length: number): { vx: number; vy: number } {
  const current = isqrt(vx * vx + vy * vy);
  if (current <= 0) return { vx: 0, vy: -length };
  return {
    vx: Math.trunc((vx * length) / current),
    vy: Math.trunc((vy * length) / current),
  };
}
