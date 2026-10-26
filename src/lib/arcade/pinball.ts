/**
 * Pinball (working title) — a Retro-world arcade game on the shared engine.
 *
 * One fixed table, identical for every player and every room: two flippers,
 * three pop bumpers, two slingshots, a bank of four drop targets, a spinner in
 * the left orbit lane and three lit rollover lanes under the top arch. Each of
 * the three balls auto-launches up the shooter lane (the launch strength is
 * fixed per ball, never random); a drained ball relaunches until the 60 s
 * clock or the balls run out.
 *
 * The only input is which flippers are held: one event (kind PIN_INPUT_FLIPPERS,
 * `a` = bit 0 left, bit 1 right) on each sim tick the held set changes. The sim
 * holds the last set in between, so the server replays exactly what the phone did.
 *
 * Physics: integer fixed point (1/256 px), a fixed 60-tick step split into
 * substeps. Every contact is swept: within a substep the ball's path is tested
 * against each wall, bumper and target capsule for the earliest contact time,
 * and against each flipper in that flipper's own rotating frame (the ball's
 * start in the frame at the substep's first angle, its end in the frame at the
 * last), so neither a fast ball nor a fast flipper can pass through the other.
 * A penetration pass after each substep holds rolling and resting contacts.
 * No randomness and no floats feed the state (division results are truncated
 * integers; products stay below 2^53).
 */

import {
  clampInt,
  inputRange,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { bandStrict, bandStrictGame, bandRetarget, bandCurveOf, bandTargetGame, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, type BandFields, type BandParts } from "./scoreBands";
import { icos, isin, isqrt, TRIG_ONE } from "./trig";

/**
 * THE SWITCH. False: Pinball is practice only (registry RETIRED_TYPES and
 * RETIRED_ARCADE_GAMES list it, so rooms never deal it). Set to true once Joe
 * has played it to let rooms deal it like any other active arcade game.
 */
export const PINBALL_IN_ROOMS = true;

/* ============================== Constants ============================== */

/** Rules revision stamped on every stored Pinball puzzle (puzzle.pinRev). */
export const PIN_REV = 1;

export const PIN_WORLD_W = 390;
export const PIN_WORLD_H = 700;
export const PIN_RUN_SECONDS = 60;
export const PIN_RUN_TICKS = PIN_RUN_SECONDS * TICKS_PER_SECOND;
export const PIN_BALLS = 3;

/** Ball radius (px) and fixed-point helpers. */
export const PIN_BALL_R = 8;
const FP = 256;
const R = PIN_BALL_R * FP;

/** Gravity down the tilted table, 1/256 px a tick²; top speed, 1/256 px a tick. */
export const PIN_GRAVITY = 48;
export const PIN_MAX_SPEED = 18 * FP;

/** Input: the held flippers as a bitmask (bit 0 left, bit 1 right). */
export const PIN_INPUT_FLIPPERS = 11;
export const PIN_LEFT = 1;
export const PIN_RIGHT = 2;
export const PIN_INPUT_RANGES: readonly InputRange[] = [inputRange(PIN_INPUT_FLIPPERS, [0, 3])];

/** The table's centre line (between the left wall and the shooter lane). */
export const PIN_MID_X = 181;

/* ------------------------------- Flippers ------------------------------ */

/** Pivots (px), length and capsule radius (px). Mirrored about PIN_MID_X. */
export const PIN_FLIP_PIVOTS: readonly (readonly [number, number])[] = [
  [113, 620],
  [249, 620],
];
export const PIN_FLIP_LEN = 56;
export const PIN_FLIP_R = 6;
/** Flipper lift θ (65536 a turn, the left flipper's frame): resting 30° down, raised 25° up. */
export const PIN_FLIP_REST = 5461;
export const PIN_FLIP_UP = -4551;
/** Angle units a tick: up in four ticks, down in eight. */
export const PIN_FLIP_UP_SPEED = 2560;
export const PIN_FLIP_DOWN_SPEED = 1280;
/** Flipper rubber: restitution in 256ths. */
const FLIP_E = 70;

/** A flipper's absolute angle (screen frame, y down) for its lift θ: the right flipper mirrors the left. */
export function pinFlipAngle(side: number, lift: number): number {
  return side === 0 ? lift : 32768 - lift;
}

/** The flipper's tip in world px for a lift θ (for drawing and bots). */
export function pinFlipTip(side: number, lift: number): { x: number; y: number } {
  const [px0, py0] = PIN_FLIP_PIVOTS[side]!;
  const a = pinFlipAngle(side, lift);
  return {
    x: px0 + (PIN_FLIP_LEN * icos(a)) / TRIG_ONE,
    y: py0 + (PIN_FLIP_LEN * isin(a)) / TRIG_ONE,
  };
}

/* --------------------------------- Walls -------------------------------- */

/** Wall capsules are 3 px thick each side of their line. */
export const PIN_WALL_R = 3;

/** Segment kinds. */
export const PIN_WALL = 0;
export const PIN_SLING = 1;
export const PIN_TARGET = 2;
export const PIN_GATE = 3;

export interface PinSegDef {
  a: readonly [number, number];
  b: readonly [number, number];
  r: number;
  kind: number;
  /** Sling side (0 left, 1 right) or target index. */
  id?: number;
}

/** The top arch: half an ellipse from the shooter lane's outer wall over to the left wall. */
export const PIN_ARCH = { cx: 196, cy: 160, rx: 186, ry: 120, segments: 16 } as const;

function archPoints(): [number, number][] {
  // Literal integer points (cos/sin evaluated with the integer table) so the table never depends on floats.
  const out: [number, number][] = [];
  for (let i = 0; i <= PIN_ARCH.segments; i++) {
    const a = Math.trunc((32768 * i) / PIN_ARCH.segments);
    out.push([
      PIN_ARCH.cx + Math.trunc((PIN_ARCH.rx * icos(a)) / TRIG_ONE),
      PIN_ARCH.cy - Math.trunc((PIN_ARCH.ry * isin(a)) / TRIG_ONE),
    ]);
  }
  return out;
}

/** Shooter lane: inner wall x, outer wall x, the ball's resting point and the one-way gate's height. */
export const PIN_LANE_INNER = 352;
export const PIN_LANE_OUTER = 382;
export const PIN_LANE_X = 367;
export const PIN_LANE_Y = 652;
export const PIN_GATE_Y = 150;
/** Launch speeds (1/256 px a tick) for balls 1–3: three fixed plunges, the same for everyone. */
export const PIN_LAUNCH: readonly number[] = [4224, 4096, 4352];
/** Ticks the ball waits in the shooter lane before it launches (first ball, then after a drain). */
export const PIN_FIRST_LAUNCH = 40;
export const PIN_RELAUNCH = 90;

/** Left orbit lane (with the spinner): outer wall is the table's left wall. */
export const PIN_LEFT_WALL = 10;
export const PIN_ORBIT_INNER = 48;
export const PIN_ORBIT_TOP = 180;
export const PIN_ORBIT_BOTTOM = 520;

/** Spinner across the left orbit lane. */
export const PIN_SPINNER_Y = 300;

/** Top rollover lanes: guide posts and the sensor line. */
export const PIN_LANE_POSTS: readonly number[] = [106, 156, 206, 256];
export const PIN_LANE_POST_TOP = 86;
export const PIN_LANE_POST_BOTTOM = 112;
export const PIN_LANE_SENSOR_Y = 99;

/** Pop bumpers: centres and radius (px). */
export const PIN_BUMPERS: readonly (readonly [number, number])[] = [
  [140, 200],
  [240, 200],
  [190, 262],
];
export const PIN_BUMPER_R = 20;
/** Outgoing speed a bumper gives at least, 1/256 px a tick. */
export const PIN_BUMPER_KICK = 1408;
/** Slingshot kick. */
export const PIN_SLING_KICK = 1152;

/** Drop targets: four in a row across the middle. */
export const PIN_TARGET_Y = 350;
export const PIN_TARGET_XS: readonly number[] = [148, 176, 204, 232];
export const PIN_TARGET_HALF = 7;
export const PIN_TARGET_R = 4;
/** A full bank stays down this long before it pops back up. */
export const PIN_BANK_RESET = 6 * TICKS_PER_SECOND;
/** The spinner stays lit (worth more) this long after a full bank. */
export const PIN_SPIN_LIT_TICKS = 15 * TICKS_PER_SECOND;

/** Table points (before the multiplier). */
export const PIN_PTS_BUMPER = 100;
export const PIN_PTS_SLING = 10;
export const PIN_PTS_TARGET = 400;
export const PIN_PTS_BANK = 2500;
export const PIN_PTS_LANE = 100;
export const PIN_PTS_LANE_AGAIN = 20;
export const PIN_PTS_LANE_SET = 1000;
export const PIN_PTS_SPIN = 25;
export const PIN_PTS_SPIN_LIT = 100;
export const PIN_MULT_MAX = 5;

const LEFT_SLING: readonly [number, number][] = [
  [48, 440],
  [48, 520],
  [95, 545],
];
const mirror = (p: readonly [number, number]): [number, number] => [2 * PIN_MID_X - p[0], p[1]];

function tableSegs(): PinSegDef[] {
  const segs: PinSegDef[] = [];
  const wall = (a: readonly [number, number], b: readonly [number, number], r = PIN_WALL_R, kind = PIN_WALL, id?: number) =>
    segs.push({ a, b, r, kind, ...(id !== undefined ? { id } : {}) });
  const arch = archPoints();
  for (let i = 0; i < arch.length - 1; i++) wall(arch[i]!, arch[i + 1]!);
  const archRight = arch[0]!;
  const archLeft = arch[arch.length - 1]!;
  // Outer walls: the shooter lane's outer wall and the table's left wall, down from the arch.
  wall(archRight, [PIN_LANE_OUTER, PIN_WORLD_H + 20]);
  wall(archLeft, [PIN_LEFT_WALL, 548]);
  // Shooter lane inner wall and the one-way gate over its top.
  wall([PIN_LANE_INNER, PIN_GATE_Y], [PIN_LANE_INNER, 548]);
  wall([PIN_LANE_INNER, 548], [PIN_LANE_INNER, PIN_WORLD_H + 20]);
  wall([PIN_LANE_INNER, PIN_GATE_Y], [PIN_LANE_OUTER - 1, PIN_GATE_Y], 2, PIN_GATE);
  // Left orbit lane's inner wall.
  wall([PIN_ORBIT_INNER, PIN_ORBIT_TOP], [PIN_ORBIT_INNER, PIN_ORBIT_BOTTOM]);
  // Guides down to the flippers.
  wall([PIN_LEFT_WALL, 548], [104, 614]);
  wall(mirror([PIN_LEFT_WALL, 548]), mirror([104, 614]));
  // The apron: straight down from under each flipper's pivot, so a ball below the flippers can only drain.
  for (const [px0, py0] of PIN_FLIP_PIVOTS) wall([px0, py0 + PIN_FLIP_R + PIN_WALL_R], [px0, PIN_WORLD_H + 20]);
  // Slingshots: the long inner face kicks, the other two sides are plain.
  const sling = (pts: readonly (readonly [number, number])[], side: number) => {
    wall(pts[0]!, pts[1]!);
    wall(pts[1]!, pts[2]!);
    wall(pts[0]!, pts[2]!, PIN_WALL_R, PIN_SLING, side);
  };
  sling(LEFT_SLING, 0);
  sling(LEFT_SLING.map(mirror), 1);
  // Top lane guide posts.
  for (const x of PIN_LANE_POSTS) wall([x, PIN_LANE_POST_TOP], [x, PIN_LANE_POST_BOTTOM]);
  // Drop targets.
  PIN_TARGET_XS.forEach((x, i) => wall([x - PIN_TARGET_HALF, PIN_TARGET_Y], [x + PIN_TARGET_HALF, PIN_TARGET_Y], PIN_TARGET_R, PIN_TARGET, i));
  return segs;
}

/** Every static segment of the table, in world px (drawn exactly as collided). */
export const PIN_SEGS: readonly PinSegDef[] = tableSegs();

/** Fixed-point segment with its precomputed direction, length and bounding box. */
export interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  sx: number;
  sy: number;
  len: number;
  len2: number;
  /** Contact radius: ball radius + capsule radius. */
  rr: number;
  kind: number;
  id: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const SEGS: readonly Seg[] = PIN_SEGS.map((d) => {
  const ax = d.a[0] * FP, ay = d.a[1] * FP, bx = d.b[0] * FP, by = d.b[1] * FP;
  const sx = bx - ax, sy = by - ay;
  const len2 = sx * sx + sy * sy;
  const rr = R + d.r * FP;
  return {
    ax, ay, bx, by, sx, sy, len: isqrt(len2), len2, rr, kind: d.kind, id: d.id ?? -1,
    minX: Math.min(ax, bx) - rr, minY: Math.min(ay, by) - rr, maxX: Math.max(ax, bx) + rr, maxY: Math.max(ay, by) + rr,
  };
});

const BUMPER_RR = R + PIN_BUMPER_R * FP;
const FLIP_RR = R + PIN_FLIP_R * FP;
const FLIP_LEN = PIN_FLIP_LEN * FP;
/** Restitution (256ths) for walls, bumpers and targets. */
const WALL_E = 128;
const BUMPER_E = 160;

/* ================================ State ================================ */

export interface PinState extends BandFields {
  tick: number;
  /** Ball centre and velocity, 1/256 px (a tick). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 1 while the ball is in play; 0 while it waits in the shooter lane (or after the last drain). */
  live: number;
  /** Ticks until the waiting ball launches. */
  wait: number;
  /** Balls launched so far and balls drained. */
  launched: number;
  lost: number;
  /** Held flippers (bit 0 left, bit 1 right), as last reported. */
  held: number;
  /** Flipper lift θ, left then right (PIN_FLIP_UP…PIN_FLIP_REST). */
  flips: number[];
  /** Table points so far (multiplier included). */
  points: number;
  /** Bonus multiplier, 1…PIN_MULT_MAX: each completed set of lanes adds one. */
  mult: number;
  /** Lit top lanes (bits 0–2, left to right). */
  lanes: number;
  /** Dropped targets (bits 0–3). */
  targets: number;
  /** Tick the dropped bank pops back up (0: none pending). */
  bankUp: number;
  /** The spinner is lit until this tick. */
  spinLit: number;
  /** Counters (read by effects, reveals and bots). */
  bumps: number;
  slings: number;
  drops: number;
  banks: number;
  spins: number;
  laneLights: number;
  laneSets: number;
  /** Last tick each bumper and slingshot was struck (art and effects only read these). */
  bumperAt: number[];
  slingAt: number[];
  /** Ticks the ball has been nearly still away from the flippers (rescue nudge). */
  still: number;
  /** Tick the run ended (0 while running). */
  endedTick: number;
}

export function pinBallInLane(): { x: number; y: number } {
  return { x: PIN_LANE_X * FP, y: PIN_LANE_Y * FP };
}

function init(_seed: number): PinState {
  const lane = pinBallInLane();
  return {
    tick: 0,
    x: lane.x,
    y: lane.y,
    vx: 0,
    vy: 0,
    live: 0,
    wait: PIN_FIRST_LAUNCH,
    launched: 0,
    lost: 0,
    held: 0,
    flips: [PIN_FLIP_REST, PIN_FLIP_REST],
    points: 0,
    mult: 1,
    lanes: 0,
    targets: 0,
    bankUp: 0,
    spinLit: 0,
    bumps: 0,
    slings: 0,
    drops: 0,
    banks: 0,
    spins: 0,
    laneLights: 0,
    laneSets: 0,
    bumperAt: PIN_BUMPERS.map(() => -999),
    slingAt: [-999, -999],
    still: 0,
    endedTick: 0,
  };
}

export function pinIsOver(state: PinState): boolean {
  return state.endedTick > 0 || state.tick >= PIN_RUN_TICKS;
}

/** Balls left to play, including the one in play or waiting. */
export function pinBallsLeft(state: PinState): number {
  return Math.max(0, PIN_BALLS - state.lost);
}

/* ============================== Collisions ============================= */

/** A contact found by a sweep: when (4096ths of the substep), where, and the unit normal (×1024) towards the ball. */
interface Contact {
  t: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
  /** What was hit: 0 segment, 1 bumper, 2 flipper; and which. */
  what: number;
  index: number;
}

export const T_ONE = 4096;
export const N_ONE = 1024;
/** Within this of touching (1/256 px) a contact is left to the penetration pass. */
export const TOUCH = 64;

/** Unit normal ×1024 of (dx, dy); (0, -1024) for a zero vector. */
export function unit(dx: number, dy: number): [number, number] {
  const len = isqrt(dx * dx + dy * dy);
  if (len <= 0) return [0, -N_ONE];
  return [Math.trunc((dx * N_ONE) / len), Math.trunc((dy * N_ONE) / len)];
}

/**
 * Earliest time (4096ths) a point moving P0→P1 comes within rr of the point C,
 * or -1. Starting within touching distance returns -1 (the penetration pass owns it).
 */
export function sweepCircle(x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, rr: number): number {
  const fx = x0 - cx, fy = y0 - cy;
  const dx = x1 - x0, dy = y1 - y0;
  // Out of reach on either axis: no contact (and keeps every product below 2^53, so all of this stays exact integer maths).
  if (Math.abs(fx) > rr + Math.abs(dx) || Math.abs(fy) > rr + Math.abs(dy)) return -1;
  const c = fx * fx + fy * fy - rr * rr;
  if (c <= 2 * rr * TOUCH) return -1;
  const b = fx * dx + fy * dy;
  if (b >= 0) return -1;
  const a = dx * dx + dy * dy;
  if (a === 0) return -1;
  const disc = b * b - a * c;
  if (disc < 0) return -1;
  const num = -b - isqrt(disc);
  if (num < 0 || num > a) return -1;
  return Math.trunc((num * T_ONE) / a);
}

/**
 * Swept point P0→P1 against a capsule (segment A→B, contact radius rr).
 * Returns the contact (normal from the capsule to the ball) or null.
 */
export function sweepCapsule(
  x0: number, y0: number, x1: number, y1: number,
  ax: number, ay: number, sx: number, sy: number, len: number, len2: number, rr: number,
  oneWayUp = false,
): { t: number; x: number; y: number; nx: number; ny: number } | null {
  let best: { t: number; x: number; y: number; nx: number; ny: number } | null = null;
  // Side faces: signed distance × len is the cross product.
  const d0 = sx * (y0 - ay) - sy * (x0 - ax);
  const d1 = sx * (y1 - ay) - sy * (x1 - ax);
  const sigma = d0 >= 0 ? 1 : -1;
  const a0 = sigma * d0, a1 = sigma * d1;
  const rrL = rr * len;
  // The face normal towards the ball: sigma × (-sy, sx) / len.
  const fnx = Math.trunc((sigma * -sy * N_ONE) / len), fny = Math.trunc((sigma * sx * N_ONE) / len);
  const faceOk = !oneWayUp || fny < 0;
  if (faceOk && a0 > rrL + TOUCH * len && a1 < rrL) {
    const t = Math.trunc(((a0 - rrL) * T_ONE) / (a0 - a1));
    const cx = x0 + Math.trunc(((x1 - x0) * t) / T_ONE);
    const cy = y0 + Math.trunc(((y1 - y0) * t) / T_ONE);
    const u = (cx - ax) * sx + (cy - ay) * sy;
    if (u >= 0 && u <= len2) best = { t, x: cx, y: cy, nx: fnx, ny: fny };
  }
  if (best || oneWayUp) return best;
  // Rounded ends.
  for (const [ex, ey] of [[ax, ay], [ax + sx, ay + sy]] as const) {
    const t = sweepCircle(x0, y0, x1, y1, ex, ey, rr);
    if (t < 0 || (best && t >= best.t)) continue;
    const cx = x0 + Math.trunc(((x1 - x0) * t) / T_ONE);
    const cy = y0 + Math.trunc(((y1 - y0) * t) / T_ONE);
    const [nx, ny] = unit(cx - ex, cy - ey);
    best = { t, x: cx, y: cy, nx, ny };
  }
  return best;
}

/** Closest point on a capsule's segment to P, and the squared distance. */
export function closestOnSeg(px: number, py: number, s: Seg): { qx: number; qy: number; d2: number } {
  const dot = (px - s.ax) * s.sx + (py - s.ay) * s.sy;
  let qx = s.ax, qy = s.ay;
  if (dot >= s.len2) {
    qx = s.bx;
    qy = s.by;
  } else if (dot > 0) {
    qx = s.ax + Math.trunc((s.sx * dot) / s.len2);
    qy = s.ay + Math.trunc((s.sy * dot) / s.len2);
  }
  const dx = px - qx, dy = py - qy;
  return { qx, qy, d2: dx * dx + dy * dy };
}

/** Local frame of a flipper at absolute angle φ: ball offset from the pivot rotated by −φ. */
export function toLocal(dx: number, dy: number, cos: number, sin: number): [number, number] {
  return [Math.trunc((dx * cos + dy * sin) / TRIG_ONE), Math.trunc((-dx * sin + dy * cos) / TRIG_ONE)];
}
export function toWorld(lx: number, ly: number, cos: number, sin: number): [number, number] {
  return [Math.trunc((lx * cos - ly * sin) / TRIG_ONE), Math.trunc((lx * sin + ly * cos) / TRIG_ONE)];
}

/** Surface velocity of a flipper point `r` along the arm at angle φ, turning `omega` angle units a tick. */
export function flipSurface(r: number, omega: number, cos: number, sin: number): [number, number] {
  // r × ω in radians a tick: 2π / 65536 = 411775 / 2^32.
  const speed = Math.trunc((r * omega * 411775) / 4294967296);
  return [Math.trunc((-speed * sin) / TRIG_ONE), Math.trunc((speed * cos) / TRIG_ONE)];
}

/** Velocity response: reflect the normal part (relative to a moving surface) with restitution, at least `kick` out. */
export function respond(
  b: { vx: number; vy: number },
  nx: number, ny: number,
  e: number, kick: number,
  svx = 0, svy = 0,
): number {
  const rvx = b.vx - svx, rvy = b.vy - svy;
  const vn = Math.trunc((rvx * nx + rvy * ny) / N_ONE);
  if (vn >= 0) return 0;
  let out = Math.trunc((-vn * e) / 256);
  if (kick > out) out = kick;
  const delta = out - vn;
  b.vx = rvx + Math.trunc((delta * nx) / N_ONE) + svx;
  b.vy = rvy + Math.trunc((delta * ny) / N_ONE) + svy;
  return -vn;
}

/* ================================= Step ================================= */

/** What a substep's contacts did, for scoring. */
interface Hits {
  bumper: number;
  sling: number;
  target: number;
}

function segActive(s: Seg, targets: number): boolean {
  return s.kind !== PIN_TARGET || ((targets >> s.id) & 1) === 0;
}

function step(state: PinState, input: ArcadeInputEvent | null): PinState {
  if (pinIsOver(state)) return state;
  const tick = state.tick + 1;
  const next: PinState = {
    ...state,
    tick,
    flips: state.flips.slice(),
    bumperAt: state.bumperAt.slice(),
    slingAt: state.slingAt.slice(),
  };
  let held = state.held;
  if (input && input.k === PIN_INPUT_FLIPPERS) held = clampInt(input.a, 0, 3);
  const pressed = held & ~state.held;
  next.held = held;

  // Lane change: a fresh press shifts the lit lanes (left press left, right press right).
  if (pressed & PIN_LEFT) next.lanes = ((next.lanes >> 1) | ((next.lanes & 1) << 2)) & 7;
  if (pressed & PIN_RIGHT) next.lanes = ((next.lanes << 1) | (next.lanes >> 2)) & 7;

  // A dropped bank pops back up.
  if (next.bankUp > 0 && tick >= next.bankUp) {
    next.targets = 0;
    next.bankUp = 0;
  }

  // Flippers move towards raised (held) or rest at a fixed angular speed.
  const from = next.flips.slice();
  for (let side = 0; side < 2; side++) {
    const up = (held >> side) & 1;
    const lift = from[side]!;
    next.flips[side] = up ? Math.max(PIN_FLIP_UP, lift - PIN_FLIP_UP_SPEED) : Math.min(PIN_FLIP_REST, lift + PIN_FLIP_DOWN_SPEED);
  }

  if (!state.live) {
    // Waiting in the shooter lane, or all balls gone.
    if (next.lost >= PIN_BALLS) {
      next.endedTick = tick;
      return next;
    }
    next.wait = Math.max(0, next.wait - 1);
    if (next.wait === 0) {
      const lane = pinBallInLane();
      next.x = lane.x;
      next.y = lane.y;
      next.vx = 0;
      next.vy = -(PIN_LAUNCH[next.launched % PIN_LAUNCH.length] ?? PIN_LAUNCH[0]!);
      next.live = 1;
      next.launched += 1;
      next.still = 0;
    }
    if (tick >= PIN_RUN_TICKS) next.endedTick = tick;
    return next;
  }

  simulateBall(next, from);

  // Stuck rescue: a ball nearly still away from the flippers for 2.5 s gets a small nudge.
  if (next.live) {
    const slow = Math.abs(next.vx) + Math.abs(next.vy) < 40 && next.y < 560 * FP;
    next.still = slow ? next.still + 1 : 0;
    if (next.still >= 150) {
      next.vx = next.tick % 2 === 0 ? 384 : -384;
      next.vy = -256;
      next.still = 0;
    }
  }

  // Drain (or, defensively, any escape from the table).
  if (next.live && (next.y > (PIN_WORLD_H + PIN_BALL_R) * FP || next.y < 0 || next.x < 0 || next.x > PIN_WORLD_W * FP)) {
    next.live = 0;
    next.lost += 1;
    next.vx = 0;
    next.vy = 0;
    const lane = pinBallInLane();
    next.x = lane.x;
    next.y = lane.y;
    next.wait = PIN_RELAUNCH;
    next.still = 0;
    // A drained ball takes its bonuses with it: the multiplier, lit lanes, dropped targets and the lit spinner.
    next.mult = 1;
    next.lanes = 0;
    next.targets = 0;
    next.bankUp = 0;
    next.spinLit = 0;
    if (next.lost >= PIN_BALLS) next.endedTick = tick;
  }
  if (tick >= PIN_RUN_TICKS && next.endedTick === 0) next.endedTick = tick;
  return next;
}

/** One tick of ball physics: gravity, then substeps of swept motion and contact. */
function simulateBall(s: PinState, flipsFrom: number[]): void {
  s.vy += PIN_GRAVITY;
  capSpeed(s);
  const flipsTo = s.flips;
  const moving = flipsFrom[0] !== flipsTo[0] || flipsFrom[1] !== flipsTo[1];
  const fastest = Math.max(Math.abs(s.vx), Math.abs(s.vy));
  // At most 1.5 px of ball travel and a flipper tip moving at most ~2.5 px per substep.
  let n = clampInt(Math.trunc((fastest + 383) / 384), 2, 12);
  if (moving && n < 6) n = 6;
  const hits: Hits = { bumper: -1, sling: -1, target: -1 };
  let lastY = s.y;
  for (let k = 1; k <= n; k++) {
    const angles = [0, 1].map((side) => {
      const f0 = flipsFrom[side]! + Math.trunc(((flipsTo[side]! - flipsFrom[side]!) * (k - 1)) / n);
      const f1 = flipsFrom[side]! + Math.trunc(((flipsTo[side]! - flipsFrom[side]!) * k) / n);
      return { a0: pinFlipAngle(side, f0), a1: pinFlipAngle(side, f1), omega: pinFlipAngle(side, flipsTo[side]!) - pinFlipAngle(side, flipsFrom[side]!) };
    });
    const sx = k === n ? s.vx - (n - 1) * Math.trunc(s.vx / n) : Math.trunc(s.vx / n);
    const sy = k === n ? s.vy - (n - 1) * Math.trunc(s.vy / n) : Math.trunc(s.vy / n);
    const x0 = s.x, y0 = s.y;
    const x1 = x0 + sx, y1 = y0 + sy;
    const contact = earliestContact(s, x0, y0, x1, y1, angles);
    if (contact) {
      s.x = contact.x;
      s.y = contact.y;
      applyContact(s, contact, angles, hits);
    } else {
      s.x = x1;
      s.y = y1;
    }
    resolve(s, angles, hits);
    sensors(s, lastY);
    lastY = s.y;
  }
  capSpeed(s);
  score(s, hits);
}

export function capSpeed(s: { vx: number; vy: number }): void {
  const v2 = s.vx * s.vx + s.vy * s.vy;
  if (v2 <= PIN_MAX_SPEED * PIN_MAX_SPEED) return;
  const v = isqrt(v2);
  s.vx = Math.trunc((s.vx * PIN_MAX_SPEED) / v);
  s.vy = Math.trunc((s.vy * PIN_MAX_SPEED) / v);
}

type Angles = { a0: number; a1: number; omega: number }[];

function earliestContact(s: PinState, x0: number, y0: number, x1: number, y1: number, angles: Angles): Contact | null {
  let best: Contact | null = null;
  const loX = Math.min(x0, x1), hiX = Math.max(x0, x1), loY = Math.min(y0, y1), hiY = Math.max(y0, y1);
  SEGS.forEach((seg, index) => {
    if (hiX < seg.minX || loX > seg.maxX || hiY < seg.minY || loY > seg.maxY) return;
    if (!segActive(seg, s.targets)) return;
    const hit = sweepCapsule(x0, y0, x1, y1, seg.ax, seg.ay, seg.sx, seg.sy, seg.len, seg.len2, seg.rr, seg.kind === PIN_GATE);
    if (hit && (!best || hit.t < best.t)) best = { ...hit, what: 0, index };
  });
  PIN_BUMPERS.forEach(([bx, by], index) => {
    const cx = bx * FP, cy = by * FP;
    if (hiX < cx - BUMPER_RR || loX > cx + BUMPER_RR || hiY < cy - BUMPER_RR || loY > cy + BUMPER_RR) return;
    const t = sweepCircle(x0, y0, x1, y1, cx, cy, BUMPER_RR);
    if (t < 0 || (best && t >= best.t)) return;
    const px0 = x0 + Math.trunc(((x1 - x0) * t) / T_ONE);
    const py0 = y0 + Math.trunc(((y1 - y0) * t) / T_ONE);
    const [nx, ny] = unit(px0 - cx, py0 - cy);
    best = { t, x: px0, y: py0, nx, ny, what: 1, index };
  });
  for (let side = 0; side < 2; side++) {
    const hit = sweepFlipper(side, x0, y0, x1, y1, angles[side]!);
    if (hit && (!best || hit.t < best.t)) best = { ...hit, what: 2, index: side };
  }
  return best;
}

/** Swept ball against a flipper in the flipper's rotating frame. */
function sweepFlipper(side: number, x0: number, y0: number, x1: number, y1: number, ang: { a0: number; a1: number }) {
  const [pxp, pyp] = PIN_FLIP_PIVOTS[side]!;
  const px0 = pxp * FP, py0 = pyp * FP;
  // Broad phase: the move's bounding box against the box the flipper can sweep.
  const reach = FLIP_LEN + FLIP_RR + 4 * FP;
  if (Math.max(x0, x1) < px0 - reach || Math.min(x0, x1) > px0 + reach) return null;
  if (Math.max(y0, y1) < py0 - reach || Math.min(y0, y1) > py0 + reach) return null;
  const c0 = icos(ang.a0), s0 = isin(ang.a0), c1 = icos(ang.a1), s1 = isin(ang.a1);
  const [lx0, ly0] = toLocal(x0 - px0, y0 - py0, c0, s0);
  const [lx1, ly1] = toLocal(x1 - px0, y1 - py0, c1, s1);
  const hit = sweepCapsule(lx0, ly0, lx1, ly1, 0, 0, FLIP_LEN, 0, FLIP_LEN, FLIP_LEN * FLIP_LEN, FLIP_RR);
  if (!hit) return null;
  const a = ang.a0 + Math.trunc(((ang.a1 - ang.a0) * hit.t) / T_ONE);
  const c = icos(a), sn = isin(a);
  const [wx, wy] = toWorld(hit.x, hit.y, c, sn);
  const [nx, ny] = toWorld(hit.nx, hit.ny, c, sn);
  return { t: hit.t, x: px0 + wx, y: py0 + wy, nx: Math.trunc((nx * N_ONE) / Math.max(1, isqrt(nx * nx + ny * ny))), ny: Math.trunc((ny * N_ONE) / Math.max(1, isqrt(nx * nx + ny * ny))), lx: hit.x, angle: a };
}

function applyContact(s: PinState, c: Contact, angles: Angles, hits: Hits): void {
  if (c.what === 1) {
    if (respond(s, c.nx, c.ny, BUMPER_E, PIN_BUMPER_KICK) > 0) hits.bumper = c.index;
    return;
  }
  if (c.what === 2) {
    const ang = angles[c.index]!;
    const [pxp, pyp] = PIN_FLIP_PIVOTS[c.index]!;
    const a = ang.a1;
    const cos = icos(a), sin = isin(a);
    const [lx] = toLocal(c.x - pxp * FP, c.y - pyp * FP, cos, sin);
    const [svx, svy] = flipSurface(clampInt(lx, 0, FLIP_LEN), ang.omega, cos, sin);
    respond(s, c.nx, c.ny, FLIP_E, 0, svx, svy);
    return;
  }
  hitSeg(s, SEGS[c.index]!, c.nx, c.ny, hits);
}

function hitSeg(s: PinState, seg: Seg, nx: number, ny: number, hits: Hits): void {
  if (seg.kind === PIN_SLING) {
    const vn = respond(s, nx, ny, WALL_E, PIN_SLING_KICK);
    if (vn > 128) hits.sling = seg.id;
    return;
  }
  const vn = respond(s, nx, ny, WALL_E, 0);
  if (seg.kind === PIN_TARGET && vn > 0) hits.target = seg.id;
}

/** Penetration pass: push the ball out of anything it overlaps and respond if it is still moving in. */
function resolve(s: PinState, angles: Angles, hits: Hits): void {
  SEGS.forEach((seg) => {
    if (s.x < seg.minX || s.x > seg.maxX || s.y < seg.minY || s.y > seg.maxY) return;
    if (!segActive(seg, s.targets)) return;
    if (seg.kind === PIN_GATE && s.y >= seg.ay) return;
    const { qx, qy, d2 } = closestOnSeg(s.x, s.y, seg);
    if (d2 >= seg.rr * seg.rr) return;
    let nx: number, ny: number;
    if (d2 === 0) [nx, ny] = unit(-seg.sy, seg.sx);
    else [nx, ny] = unit(s.x - qx, s.y - qy);
    s.x = qx + Math.trunc((nx * seg.rr) / N_ONE) + Math.sign(nx);
    s.y = qy + Math.trunc((ny * seg.rr) / N_ONE) + Math.sign(ny);
    hitSeg(s, seg, nx, ny, hits);
  });
  PIN_BUMPERS.forEach(([bx, by], index) => {
    const dx = s.x - bx * FP, dy = s.y - by * FP;
    if (Math.abs(dx) >= BUMPER_RR || Math.abs(dy) >= BUMPER_RR) return;
    if (dx * dx + dy * dy >= BUMPER_RR * BUMPER_RR) return;
    const [nx, ny] = unit(dx, dy);
    s.x = bx * FP + Math.trunc((nx * BUMPER_RR) / N_ONE) + Math.sign(nx);
    s.y = by * FP + Math.trunc((ny * BUMPER_RR) / N_ONE) + Math.sign(ny);
    if (respond(s, nx, ny, BUMPER_E, PIN_BUMPER_KICK) > 0) hits.bumper = index;
  });
  for (let side = 0; side < 2; side++) {
    const [pxp, pyp] = PIN_FLIP_PIVOTS[side]!;
    const px0 = pxp * FP, py0 = pyp * FP;
    const dx = s.x - px0, dy = s.y - py0;
    const reach = FLIP_LEN + FLIP_RR;
    if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
    const ang = angles[side]!;
    const cos = icos(ang.a1), sin = isin(ang.a1);
    const [lx, ly] = toLocal(dx, dy, cos, sin);
    const qx = clampInt(lx, 0, FLIP_LEN);
    const ddx = lx - qx;
    const d2 = ddx * ddx + ly * ly;
    if (d2 >= FLIP_RR * FLIP_RR) continue;
    let lnx: number, lny: number;
    if (d2 === 0) [lnx, lny] = [0, -N_ONE];
    else [lnx, lny] = unit(ddx, ly);
    const [wx, wy] = toWorld(qx + Math.trunc((lnx * FLIP_RR) / N_ONE), Math.trunc((lny * FLIP_RR) / N_ONE), cos, sin);
    const [nx0, ny0] = toWorld(lnx, lny, cos, sin);
    const [nx, ny] = unit(nx0, ny0);
    s.x = px0 + wx + Math.sign(nx);
    s.y = py0 + wy + Math.sign(ny);
    const [svx, svy] = flipSurface(qx, ang.omega, cos, sin);
    respond(s, nx, ny, FLIP_E, 0, svx, svy);
  }
}

/** Rollover lanes and the spinner: crossings of their sensor lines between two ball positions. */
function sensors(s: PinState, y0: number): void {
  const laneY = PIN_LANE_SENSOR_Y * FP;
  if ((y0 < laneY) !== (s.y < laneY)) {
    const x = s.x;
    for (let lane = 0; lane < 3; lane++) {
      if (x > PIN_LANE_POSTS[lane]! * FP && x < PIN_LANE_POSTS[lane + 1]! * FP) {
        if ((s.lanes >> lane) & 1) s.points += PIN_PTS_LANE_AGAIN * s.mult;
        else {
          s.lanes |= 1 << lane;
          s.laneLights += 1;
          s.points += PIN_PTS_LANE * s.mult;
          if (s.lanes === 7) {
            s.lanes = 0;
            s.laneSets += 1;
            s.points += PIN_PTS_LANE_SET * s.mult;
            s.mult = Math.min(PIN_MULT_MAX, s.mult + 1);
          }
        }
      }
    }
  }
  const spinY = PIN_SPINNER_Y * FP;
  if ((y0 < spinY) !== (s.y < spinY) && s.x > PIN_LEFT_WALL * FP && s.x < PIN_ORBIT_INNER * FP) {
    const spins = clampInt(Math.trunc(Math.abs(s.vy) / 192), 1, 16);
    s.spins += spins;
    s.points += spins * (s.tick < s.spinLit ? PIN_PTS_SPIN_LIT : PIN_PTS_SPIN) * s.mult;
  }
}

/** Points for this tick's strikes (each bumper and sling scores at most once every 4 ticks). */
function score(s: PinState, hits: Hits): void {
  if (hits.bumper >= 0 && s.tick - (s.bumperAt[hits.bumper] ?? -999) >= 4) {
    s.bumps += 1;
    s.points += PIN_PTS_BUMPER * s.mult;
    s.bumperAt[hits.bumper] = s.tick;
  }
  if (hits.sling >= 0 && s.tick - (s.slingAt[hits.sling] ?? -999) >= 4) {
    s.slings += 1;
    s.points += PIN_PTS_SLING * s.mult;
    s.slingAt[hits.sling] = s.tick;
  }
  if (hits.target >= 0 && ((s.targets >> hits.target) & 1) === 0) {
    s.targets |= 1 << hits.target;
    s.drops += 1;
    s.points += PIN_PTS_TARGET * s.mult;
    if (s.targets === 15) {
      s.banks += 1;
      s.points += PIN_PTS_BANK * s.mult;
      s.bankUp = s.tick + PIN_BANK_RESET;
      s.spinLit = s.tick + PIN_SPIN_LIT_TICKS;
    }
  }
}

/* ============================== Scoring ============================== */

/**
 * Open game on the Oct 2026 band shape: table points on a straight-line knot
 * curve to 150 (no finish bonus), and 0 with no input. Knots fitted from the
 * simulated average, good, great and near-perfect players
 * (scripts/arcade-skill-bands.ts pinball; docs/arcade-score-bands-oct-2026.md).
 */
export const PIN_BAND_CURVE = bandCurve([0, 5250, 7400, 8650, 15000, 24000], [0, 70, 100, 125, 145, 150]);

export function pinballBandParts(state: PinState): BandParts {
  const units = Math.max(0, state.points);
  return {
    units,
    points: bandPoints(bandCurveOf(state, PIN_BAND_CURVE), units),
    bonus: 0,
    penalty: 0,
    finished: false,
    text: `${units.toLocaleString("en-GB")} table points`,
  };
}

function scoreBand(state: PinState): number {
  return bandTotal(pinballBandParts(state), Boolean(state.acted));
}

/* ============================= Checkpoints ============================= */

export const PIN_CHECKPOINT_INTERVAL = 300;

export interface PinCheckpoint {
  tick: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  points: number;
  lost: number;
  held: number;
  left: number;
  right: number;
  lanes: number;
  targets: number;
  mult: number;
  checksum: number;
}

export function pinCheckpoint(state: PinState): PinCheckpoint {
  const snapshot = {
    tick: state.tick,
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    points: state.points,
    lost: state.lost,
    held: state.held,
    left: state.flips[0] ?? 0,
    right: state.flips[1] ?? 0,
    lanes: state.lanes,
    targets: state.targets,
    mult: state.mult,
  };
  let checksum = 0x811c9dc5;
  const values = [...Object.values(snapshot), state.live, state.wait, state.launched, state.bankUp, state.spinLit, state.bumps, state.slings, state.drops, state.spins, state.acted ?? 0];
  for (const value of values) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Game ================================= */

/** Plain fallback drawing (the art lives in pinball.renderer.ts). */
function draw(ctx: CanvasRenderingContext2D, state: PinState, size: CanvasSize): void {
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.scale(size.width / PIN_WORLD_W, size.height / PIN_WORLD_H);
  ctx.strokeStyle = "#3DFFE0";
  ctx.lineCap = "round";
  for (const seg of PIN_SEGS) {
    ctx.lineWidth = seg.r * 2;
    ctx.beginPath();
    ctx.moveTo(seg.a[0], seg.a[1]);
    ctx.lineTo(seg.b[0], seg.b[1]);
    ctx.stroke();
  }
  ctx.fillStyle = "#F4FFF8";
  ctx.beginPath();
  ctx.arc(state.x / FP, state.y / FP, PIN_BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const pinballGame: ArcadeGame<PinState, ArcadeInputEvent | null> = {
  key: "pinball",
  runTicks: PIN_RUN_TICKS,
  init: (seed) => bandInit(init(seed)),
  step: bandStep(step),
  isOver: pinIsOver,
  score: bandScoreOf(scoreBand, scoreBand),
  draw,
  inputRanges: PIN_INPUT_RANGES,
};

/**
 * pinRev 2 (scoring targets, 18 Oct 2026, docs/scoring-targets.md): pinRev 1 play
 * unchanged, each band knot's points lifted through BAND_TARGET_MAP.
 */
export const PIN_REV_TARGET = 2;
export const pinballTargetGame = bandTargetGame(pinballGame);

/** The game for a stored pinRev: 2 the scoring targets, anything else revision 1. */
export function pinballGameFor(rev?: number | null): ArcadeGame<PinState, ArcadeInputEvent | null> {
  return rev === PIN_REV_STRICT ? pinballStrictGame : rev === PIN_REV_TARGET ? pinballTargetGame : pinballGame;
}

/**
 * The swept-contact primitives, exported for scripts/pinball-check.ts: each
 * answers for a whole straight move in one call (earliest contact time in
 * 4096ths of the move), so a check can show a contact is found however far the
 * ball travels in one substep.
 */
export const pinSweep = {
  T_ONE,
  circle: sweepCircle,
  capsule: sweepCapsule,
  flipper: (side: number, x0: number, y0: number, x1: number, y1: number, a0: number, a1: number) => sweepFlipper(side, x0, y0, x1, y1, { a0, a1 }),
  ballR: R,
  flipRR: FLIP_RR,
  bumperRR: BUMPER_RR,
};
/** The curve new rounds score on: PIN_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const PIN_V2_BAND_CURVE = bandRetarget(PIN_BAND_CURVE);

/* ================= Score bands (pinRev 3, 19 Oct 2026) ================= */

/**
 * pinRev 3 (score bands, docs/scoring-targets.md): pinRev 2 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const PIN_REV_STRICT = 3;
export const pinballStrictGame = bandStrictGame(pinballTargetGame);
/** The curve new rounds score on: PIN_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const PIN_V3_BAND_CURVE = bandStrict(PIN_BAND_CURVE);

/* ============ World expansion (pinRev 4, 25 Oct 2026, docs/expansions/e4.md) ============ */

/** The expansion's revision (the taller table, pinball4.ts). */
export const PIN_REV_EXPAND = 4;
