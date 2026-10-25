/**
 * Swing — a cavern swinger. The camera follows the figure; holding (k = 12, a = 1)
 * shoots a rope to the nearest anchor ahead within 220 px and the figure swings
 * on it as a pendulum (angle + angular velocity, integer maths); letting go
 * (a = 0) flies with the current velocity under gravity. The floor, the red
 * stalactites end the run.
 */

import {
  clampInt,
  finishScore,
  inputRange,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";
import { ANG_PER_RAD, iatan2, icos, isin, isqrt, TRIG_ONE } from "./trig";

/* ============================== Constants ============================== */

const FP = 256;
export const SWING_WORLD_W = 390;
export const SWING_WORLD_H = 620;
export const SWING_RUN_TICKS = 60 * TICKS_PER_SECOND;
export const SWING_INPUT_HOLD = 12;
export const SWING_INPUT_REEL = 4;
export const SWING_REEL_UP = 0;
export const SWING_REEL_DOWN = 1;
const REEL_TICKS = 8;
const PUMP_MIN_V = 102; // 0.4 px/tick
const MAX_SPEED = 9 * FP;
const GRAVITY = 77; // 0.3 px/tick²
const MAX_FALL = 12 * FP;
const RADIUS = 10 * FP;
const REACH = 220 * FP;
const MIN_ROPE = 24 * FP;
const START_X = 3000 * FP;
/** Follow in either direction while showing previously visited anchors. */
const LEAD = 195 * FP;
const METRE = 40 * FP;
const COL = 40 * FP;
export const SWING_FINISH_M = 500;
/**
 * Current version: swingRev 4 (Oct 2026): no fixed dragons; a chasing dragon from 200 m,
 * falling stalactites, lava jets and star anchors (see "swingRev 4" below).
 * swingRev 3 (bigger, menacing dragons) and swingRev 2 rounds keep their own dragons.
 */
export const SWING_REV = 4;
export const SWING_REV_V3 = 3;
export const SWING_REV_V2 = 2;
/** swingRev 2 dragon box: 40 × 28 px. */
export const SWING_DRAGON_HALF_W_V2 = 20 * FP;
export const SWING_DRAGON_HALF_H_V2 = 14 * FP;
/** swingRev 3 dragon box: 64 × 44 px. */
export const SWING_DRAGON_HALF_W = 32 * FP;
export const SWING_DRAGON_HALF_H = 22 * FP;
/** Collision half-size travels with each dragon so one sim serves every revision's box unchanged. */
export interface SwingDragon { x: number; y: number; hw: number; hh: number; }
/** Anchors run a little past the 500 m finish so the last swing has somewhere to go. */
const COURSE_LEN = START_X + (SWING_FINISH_M + 20) * METRE + 600 * FP;
const COLS = Math.trunc(COURSE_LEN / COL) + 2;
const SPIKE_HALF = 16 * FP;
const SPIKE_DEPTH = 56 * FP;
/** Sub-steps of angle precision. */
const SUB = 16;
const TURN_SUB = 65536 * SUB;

export const SWING_INPUT_RANGES: readonly InputRange[] = [inputRange(SWING_INPUT_HOLD, [0, 1]), inputRange(SWING_INPUT_REEL, [0, 1])];

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
  /** Rope length when grabbed; reel limits are relative to it. */
  grabLen: number;
  reelTo: number;
  reelLeft: number;
  /** Bottom-of-arc passes on the current rope (pumps). */
  pumps: number;
}

const KANG = SUB * ANG_PER_RAD;
function signedTh(th: number): number {
  return th >= TURN_SUB / 2 ? th - TURN_SUB : th;
}
function capOm(b: Body): void {
  const max = Math.trunc((MAX_SPEED * KANG) / b.len);
  b.om = clampInt(b.om, -max, max);
}
/** Starts a reel: up shortens by 20% (min 40% of grab), down lengthens by 20% (max grab). */
function startReel(b: Body, dir: number): void {
  if (b.rope < 0) return;
  const to = dir === SWING_REEL_UP
    ? Math.max(Math.trunc((b.grabLen * 40) / 100), Math.trunc((b.len * 80) / 100))
    : Math.min(b.grabLen, Math.trunc((b.len * 120) / 100));
  b.reelTo = Math.max(MIN_ROPE, to);
  b.reelLeft = REEL_TICKS;
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
  b.grabLen = b.len;
  b.reelLeft = 0;
  b.pumps = 0;
  ropePos(b, a);
}

function detach(b: Body, a: Anchor): void {
  const t = b.th >> 4;
  const k = TRIG_ONE * SUB * ANG_PER_RAD;
  b.vx = Math.trunc((b.len * icos(t) * b.om) / k);
  b.vy = Math.trunc((-b.len * isin(t) * b.om) / k);
  b.rope = -1;
  b.reelLeft = 0;
  void a;
}

function nearestAhead(anchors: readonly Anchor[], b: Body, from: number): number {
  let best = -1;
  let bestD = REACH * REACH;
  for (let i = Math.max(0, from); i < anchors.length; i++) {
    const a = anchors[i]!;
    if (a.x - b.x > REACH) break;
    if (a.x <= b.x && from !== 0) continue;
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
function moveBody(b: Body, c: { ceil: number[]; floor: number[]; spikes: Spike[]; anchors: Anchor[]; dragons?: SwingDragon[] }): boolean {
  if (b.rope >= 0) {
    const a = c.anchors[b.rope]!;
    const t = b.th >> 4;
    b.om -= Math.trunc((GRAVITY * isin(t) * SUB * ANG_PER_RAD) / (TRIG_ONE * b.len));
    if (b.reelLeft > 0) {
      // Conserve angular momentum (len² · ω) while the rope length changes.
      const old = b.len;
      b.len = b.len + Math.trunc((b.reelTo - b.len) / b.reelLeft);
      b.reelLeft -= 1;
      b.om = Math.trunc((b.om * old * old) / (b.len * b.len));
    }
    const prevTh = b.th;
    b.th = (b.th + b.om) & (TURN_SUB - 1);
    const s0 = signedTh(prevTh);
    const s1 = signedTh(b.th);
    if (b.om !== 0 && (s0 < 0) !== (s1 < 0) && Math.abs(s0) < TURN_SUB / 4 && Math.abs(s1) < TURN_SUB / 4) {
      // Pump: +6% angular speed (min 0.4 px/tick) at the bottom of the arc.
      const minOm = Math.max(1, Math.trunc((PUMP_MIN_V * KANG) / b.len));
      const add = Math.max(minOm, Math.trunc((Math.abs(b.om) * 6) / 100));
      b.om += b.om > 0 ? add : -add;
      b.pumps += 1;
    }
    capOm(b);
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
  for (const d of c.dragons ?? []) {
    if (Math.abs(b.x - d.x) <= d.hw + RADIUS && Math.abs(b.y - d.y) <= d.hh + RADIUS) return true;
  }
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
  const start: Body = { x: 0, y: 0, vx: 0, vy: 0, rope: i, len: 130 * FP, th: 55000 * SUB, om: 0, grabLen: 130 * FP, reelTo: 0, reelLeft: 0, pumps: 0 };
  ropePos(start, a);
  const swing = { ...start };
  for (let r = 0; r < 600; r++) {
    if (moveBody(swing, view)) return false;
    if (swing.pumps > 4) return false;
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

/**
 * swingRev 4: from a standard swing on anchor `i`, can some release then grab take
 * `star` (it is the nearest anchor at the grab), and from a standard swing on the
 * star can some release reach the anchor after it? Same probe shape as reachable().
 */
function starTakeable(c: Course, i: number, star: number): boolean {
  const a = c.anchors[i]!;
  const s = c.anchors[star]!;
  const next = c.anchors[star + 1]!;
  const spikes = c.spikes.filter((sp) => sp.x > a.x - 400 * FP && sp.x < next.x + 400 * FP);
  const view = { ...c, spikes };
  const start: Body = { x: 0, y: 0, vx: 0, vy: 0, rope: i, len: 130 * FP, th: 55000 * SUB, om: 0, grabLen: 130 * FP, reelTo: 0, reelLeft: 0, pumps: 0 };
  ropePos(start, a);
  const swing = { ...start };
  for (let r = 0; r < 400; r++) {
    if (moveBody(swing, view)) return false;
    if (swing.pumps > 4) return false;
    if (r % 3) continue;
    const fly = { ...swing };
    detach(fly, a);
    for (let t = 0; t < 90; t++) {
      if (moveBody(fly, view)) break;
      if (t % 2 || nearestAhead(c.anchors, fly, 0) !== star) continue;
      // Grab the star here, then swing on it: some release must reach the next anchor.
      const on = { ...fly };
      attach(on, star, s);
      for (let k = 0; k < 240; k++) {
        if (moveBody(on, view)) break;
        if (k % 3) continue;
        const off = { ...on };
        detach(off, s);
        for (let u = 0; u < 90; u++) {
          if (moveBody(off, view)) break;
          if (nearestAhead(c.anchors, off, star + 1) === star + 1 && off.x < next.x) return true;
        }
      }
      return false;
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
  for (let x = START_X - 2800 * FP; x < START_X; x += 140 * FP) {
    course.anchors.push({ x, y: hangY(x, 110) });
  }
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

/* ============================== swingRev 4 ============================== */

/** The chasing dragon appears this far in, this far behind the ninja, and flies at a set pace. */
export const SWING_CHASE_FROM_M = 200;
export const SWING_CHASE_GAP = 400 * FP;
export const SWING_CHASE_PACE = 4 * FP;
/** How far ahead of the dragon's centre its jaws reach (the catch line). */
export const SWING_CHASE_REACH = 34 * FP;
/** Falling stalactites: count, where they may hang, trigger distance range, warning and fall. */
export const SWING_ROCKS = 8;
export const SWING_ROCK_WARN = 60;
export const SWING_ROCK_HALF_W = 9 * FP;
export const SWING_ROCK_HALF_H = 16 * FP;
const ROCK_TRIGGER_MIN = 280;
const ROCK_TRIGGER_SPAN = 201;
const ROCK_FALL_START = 2 * FP;
const ROCK_FALL_ACCEL = 64;
const ROCK_FALL_MAX = 14 * FP;
/** Lava jets: count, cycle length range, bubbling warning and eruption, half-width, height range. */
export const SWING_JETS = 8;
export const SWING_JET_BUBBLE = 60;
export const SWING_JET_ERUPT = 40;
export const SWING_JET_HALF_W = 12 * FP;
const JET_RISE = 8;
const JET_PERIOD_MIN = 200;
const JET_PERIOD_SPAN = 81;
const JET_H_MIN = 150;
const JET_H_SPAN = 101;
/** Star anchors: grabbing one takes its star. They hang high, close under the ceiling. */
export const SWING_STARS = 10;
export const SWING_STAR_DEPTH = 60;
/** swingRev 4 score: distance up to 120, a point a star (10), reaching 500 m adds 20. */
export const SWING_V4_DISTANCE_SCORE = 120;
export const SWING_V4_FINISH_BONUS = 20;

export interface SwingRock {
  x: number;
  /** Ceiling under which it hangs (1/256 px), and the ninja distance that starts its warning. */
  top: number;
  trigger: number;
  /** 0 hanging, 1 warning (shadow), 2 falling, 3 shattered. */
  phase: number;
  /** Ticks into its phase; while falling, its centre y and speed (1/256 px). */
  t: number;
  y: number;
  vy: number;
}

export interface SwingJet {
  x: number;
  period: number;
  phase: number;
  /** Full eruption height above the lava, 1/256 px. */
  h: number;
}

/** A jet's height above the lava at a tick (0 when quiet), and whether it is bubbling (the warning). */
export function swingJetAt(jet: SwingJet, tick: number): { h: number; bubbling: boolean } {
  const c = (tick + jet.phase) % jet.period;
  const erupt = jet.period - SWING_JET_ERUPT;
  if (c < erupt - SWING_JET_BUBBLE) return { h: 0, bubbling: false };
  if (c < erupt) return { h: 0, bubbling: true };
  const k = c - erupt;
  const left = SWING_JET_ERUPT - 1 - k;
  const ramp = Math.min(JET_RISE, k + 1, left + 1);
  return { h: Math.trunc((jet.h * ramp) / JET_RISE), bubbling: false };
}

/* ================================ State ================================ */

export interface SwingState extends Body, BandFields {
  dragons?: SwingDragon[];
  /** swingRev 4 only (absent on older rounds). */
  rev?: number;
  /** swingRev 4: the chasing dragon's centre (0 until it appears). */
  chaseX?: number;
  chaseY?: number;
  rocks?: SwingRock[];
  jets?: SwingJet[];
  /** swingRev 4: anchor indices that carry a star, stars taken, and how the run ended (1 dragon, 2 rock, 3 jet). */
  starAnchors?: number[];
  stars?: number;
  starsTaken?: number[];
  cause?: number;
  /** swingRev 6 only: set on the revision; its stars are touch pickups at these [x, y] centres (1/256 px), not anchors. */
  tuned?: number;
  /** swingRev 7 only (Tuning C): 1 = rev-6 play scored on the lower SWING_V7_BAND_CURVE. Absent on every earlier round. */
  tunec?: number;
  /** swingRev 8 only (Tuning F): 1 = stars spread evenly along the run. Absent on every earlier round. */
  spread?: number;
  starSpots?: [number, number][];
  /** swingRev 9 only (taller worlds): the world height in px (SWING_TALL_H). Absent = SWING_WORLD_H. */
  worldH?: number;
  /**
   * swingRev 12 only (the expansion, absent on every earlier round): the marker, the wider world, the
   * ledges (set-route sections) and which one the hero stands on, each ledge's first landing tick,
   * the swing chain, the high-route gems and the speed gates (see "swingRev 12" below).
   */
  expand?: number;
  worldW?: number;
  ledges?: SwingLedge[];
  ledgeOn?: number;
  ledgeTicks?: number[];
  /** A press made while walking to a ledge's centre, held until the hero gets there (1). */
  ledgeHold?: number;
  chain?: number;
  lastGrabX?: number;
  comboPts?: number;
  bestChain?: number;
  gems?: [number, number][];
  gemsTaken?: number;
  gates?: SwingGate[];
  gatesLit?: number;
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
  const startAnchor = course.anchors.findIndex((a) => a.x >= START_X);
  const a = course.anchors[startAnchor]!;
  const body: Body = { x: 0, y: 0, vx: 0, vy: 0, rope: startAnchor, len: 110 * FP, th: 56000 * SUB, om: 0, grabLen: 110 * FP, reelTo: 0, reelLeft: 0, pumps: 0 };
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

/** swingRev 2 legacy placement: 4–6 dragons, 40 × 28 px box. Stored rounds replay unchanged. */
function initDragonsV2(seed: number): SwingState {
  const s = init(seed);
  let rng = s.rng;
  const draw = (bound: number) => { const r = rngBelow(rng, bound); rng = r.state; return r.value; };
  const count = 4 + draw(3);
  const dragons: SwingDragon[] = [];
  for (let i = 0; i < count; i++) {
    const metre = 350 + Math.trunc(((i * 2 + 1) * 140) / (count * 2)) + draw(7) - 3;
    const x = START_X + metre * METRE;
    const y = (i % 2 === 0 ? 200 + draw(61) : 330 + draw(61)) * FP;
    dragons.push({ x, y, hw: SWING_DRAGON_HALF_W_V2, hh: SWING_DRAGON_HALF_H_V2 });
  }
  return { ...s, dragons };
}

/** swingRev 3 placement: same 350–500 m alternating bands, 3–5 bigger (64 × 44 px) dragons. */
function initDragonsV3(seed: number): SwingState {
  const s = init(seed);
  let rng = s.rng;
  const draw = (bound: number) => { const r = rngBelow(rng, bound); rng = r.state; return r.value; };
  const count = 3 + draw(3);
  const dragons: SwingDragon[] = [];
  for (let i = 0; i < count; i++) {
    const metre = 350 + Math.trunc(((i * 2 + 1) * 140) / (count * 2)) + draw(7) - 3;
    const x = START_X + metre * METRE;
    const y = (i % 2 === 0 ? 200 + draw(61) : 330 + draw(61)) * FP;
    dragons.push({ x, y, hw: SWING_DRAGON_HALF_W, hh: SWING_DRAGON_HALF_H });
  }
  return { ...s, dragons };
}

/** swingRev 4: the same cavern plus star anchors, falling stalactites and lava jets, all from the seed. */
const v4Cache = new Map<number, SwingState>();
function initV4(seed: number): SwingState {
  const cached = v4Cache.get(seed | 0);
  if (cached) return { ...cached, rocks: cached.rocks!.map((r) => ({ ...r })) };
  const s = init(seed);
  let rng = s.rng;
  const draw = (bound: number) => { const r = rngBelow(rng, bound); rng = r.state; return r.value; };
  const base = s.anchors;
  const startIndex = base.findIndex((a) => a.x >= START_X);
  const metreOf = (x: number) => Math.trunc((x - START_X) / METRE);
  // Course gaps (anchor i to i + 1) in the run, by metre band.
  const gaps: number[] = [];
  // Gaps under a ceiling spike are left alone: a star anchor or a stalactite would hang inside it.
  const spiked = (i: number) => s.spikes.some((sp) => sp.x > base[i]!.x - SPIKE_HALF && sp.x < base[i + 1]!.x + SPIKE_HALF);
  for (let i = startIndex; i + 1 < base.length; i++)
    if (metreOf(base[i]!.x) >= 30 && metreOf(base[i + 1]!.x) <= 490 && !spiked(i)) gaps.push(i);
  /** One gap from each of `count` equal bands of the list, never one already used. */
  const pickGaps = (count: number, used: Set<number>, from: number) => {
    const list = gaps.filter((i) => metreOf(base[i]!.x) >= from);
    const out: number[] = [];
    for (let k = 0; k < count; k++) {
      const lo = Math.trunc((k * list.length) / count);
      const hi = Math.max(lo + 1, Math.trunc(((k + 1) * list.length) / count));
      let pick = list[lo + draw(hi - lo)]!;
      for (let j = lo; used.has(pick) && j < hi; j++) pick = list[j]!;
      used.add(pick);
      out.push(pick);
    }
    return out;
  };
  const used = new Set<number>();
  const starGaps = pickGaps(SWING_STARS, used, 30);
  const rockGaps = pickGaps(SWING_ROCKS, used, 120);
  // Star anchors: high in the gap, under the ceiling. Each is proved takeable (and leavable)
  // from a standard swing; a gap whose spots all fail moves on to the next free gap.
  const extra: Anchor[] = [];
  const spare = gaps.filter((i) => !used.has(i));
  const course: Course = { ceil: s.ceil, floor: s.floor, anchors: base, spikes: s.spikes, rng: 0 };
  const tryGap = (i: number): boolean => {
    for (let k = 0; k < 3; k++) {
      const x = base[i]!.x + Math.trunc(((base[i + 1]!.x - base[i]!.x) * (40 + draw(31))) / 100);
      const star = { x, y: lerpAt(s.ceil, x) + (SWING_STAR_DEPTH + draw(21)) * FP };
      const trial = [...base.slice(0, i + 1), star, ...base.slice(i + 1)];
      if (starTakeable({ ...course, anchors: trial }, i, i + 1)) {
        extra.push(star);
        return true;
      }
    }
    return false;
  };
  for (const i of starGaps) {
    if (tryGap(i)) continue;
    while (spare.length > 0) {
      const j = spare.shift()!;
      if (tryGap(j)) break;
    }
  }
  const anchors = [...base, ...extra].sort((a, b) => a.x - b.x);
  const starAnchors = extra.map((a) => anchors.indexOf(a));
  const rocks: SwingRock[] = rockGaps.map((i) => {
    const x = Math.trunc((base[i]!.x + base[i + 1]!.x) / 2) + (draw(41) - 20) * FP;
    return { x, top: lerpAt(s.ceil, x), trigger: (ROCK_TRIGGER_MIN + draw(ROCK_TRIGGER_SPAN)) * FP, phase: 0, t: 0, y: 0, vy: 0 };
  });
  rocks.sort((a, b) => a.x - b.x);
  const jets: SwingJet[] = [];
  for (let k = 0; k < SWING_JETS; k++) {
    // Even bands from 120 m to 490 m, seeded spot in each.
    const m = 120 + Math.trunc((k * 370) / SWING_JETS) + draw(Math.trunc(370 / SWING_JETS));
    const period = JET_PERIOD_MIN + draw(JET_PERIOD_SPAN);
    jets.push({ x: START_X + m * METRE + draw(METRE / FP) * FP, period, phase: draw(period), h: (JET_H_MIN + draw(JET_H_SPAN)) * FP });
  }
  const startAnchor = anchors.findIndex((a) => a.x >= START_X);
  const v4: SwingState = {
    ...s,
    rope: startAnchor,
    rng,
    anchors,
    rev: SWING_REV,
    chaseX: 0,
    chaseY: 0,
    rocks,
    jets,
    starAnchors,
    stars: 0,
    starsTaken: [],
    cause: 0,
  };
  if (v4Cache.size > 16) v4Cache.clear();
  v4Cache.set(seed | 0, v4);
  return { ...v4, rocks: rocks.map((r) => ({ ...r })) };
}

function isOver(state: SwingState): boolean {
  return state.ended !== 0;
}

function step(state: SwingState, input: ArcadeInputEvent | null): SwingState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: SwingState = { ...state, tick };
  // swingRev 12 (the expansion): standing on a ledge, only the walk to its centre and a press (a kick off it) move the body.
  const expand = s.expand === 1;
  const px = s.x;
  const py = s.y;
  let standing = expand && (s.ledgeOn ?? -1) >= 0;
  if (standing && expand12LedgeGone(s, s.ledgeOn!, tick)) {
    // A collapsing ledge gives way under the hero: they fall from where they stood.
    s.ledgeOn = -1;
    s.ledgeHold = 0;
    standing = false;
  }
  // On a ledge the hero first walks to its centre (every kick off a ledge is the proved one); a press
  // while walking is held until they get there, a let-go cancels it.
  let press = input !== null && input.k === SWING_INPUT_HOLD && input.a === 1;
  if (standing) {
    const centre = s.ledges![s.ledgeOn!]!.x;
    if (s.x !== centre) s.x += clampInt(centre - s.x, -SWING_LEDGE_WALK, SWING_LEDGE_WALK);
    if (input !== null && input.k === SWING_INPUT_HOLD) s.ledgeHold = input.a === 1 ? 1 : 0;
    press = s.x === centre && s.ledgeHold === 1;
    if (press) s.ledgeHold = 0;
  }
  if (standing ? press : input !== null && input.k === SWING_INPUT_HOLD) {
    if (press) {
      const target = nearestAhead(s.anchors, s, 0);
      if (target >= 0) {
        // swingRev 12: the speed the grab is made at (flying only) counts for the swing chain.
        const flying = s.rope < 0 && !standing;
        if (s.rope >= 0) detach(s, s.anchors[s.rope]!);
        if (expand) expand12NoteGrab(s, target, tick, flying ? s.vx * s.vx + s.vy * s.vy : 0);
        attach(s, target, s.anchors[target]!);
        if (standing) {
          s.ledgeOn = -1;
          standing = false;
          kickOff(s);
        }
        s.grabTick = tick;
        // swingRev 4: grabbing a star anchor takes its star (once).
        if (s.starAnchors && s.starAnchors.includes(target) && !(s.starsTaken ?? []).includes(target)) {
          s.starsTaken = [...(s.starsTaken ?? []), target];
          s.stars = (s.stars ?? 0) + 1;
        }
      }
    } else if (s.rope >= 0) detach(s, s.anchors[s.rope]!);
  } else if (input !== null && input.k === SWING_INPUT_REEL && !standing) {
    startReel(s, clampInt(input.a, 0, 1));
  }
  let dead = standing ? false : moveBody(s, s);
  // swingRev 12: a landing, gems and gates first, then the camera.
  if (expand && !dead && !standing) expand12Move(s, px, py, tick);
  s.camX = s.x - (expand ? SWING_LEAD_V12 : LEAD);
  if (s.x > s.maxX) s.maxX = s.x;
  // swingRev 6: a star is taken by touching it (the ninja's disc over the star's), on a rope or flying.
  if (s.starSpots && !dead) {
    s.starSpots.forEach(([x, y], i) => {
      if ((s.starsTaken ?? []).includes(i)) return;
      const dx = s.x - x;
      const dy = s.y - y;
      if (dx * dx + dy * dy <= SWING_STAR_TOUCH * SWING_STAR_TOUCH) {
        s.starsTaken = [...(s.starsTaken ?? []), i];
        s.stars = (s.stars ?? 0) + 1;
      }
    });
  }
  if (s.rev === SWING_REV && !dead) {
    const cause = stepHazards(s, tick);
    if (cause > 0) {
      dead = true;
      s.cause = cause;
    }
  }
  if (dead) {
    s.ended = 2;
    s.endedTick = tick;
  } else if (swingMetres(s) >= SWING_FINISH_M) {
    s.ended = 1;
    s.endedTick = tick;
  } else if (tick >= SWING_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** swingRev 4 hazards for one tick; returns 0, or what ended the run (1 dragon, 2 stalactite, 3 lava jet). */
function stepHazards(s: SwingState, tick: number): number {
  let cause = 0;
  // The chasing dragon: appears behind the ninja at 200 m, then flies at its set pace.
  if ((s.chaseX ?? 0) === 0 && swingMetres(s) >= SWING_CHASE_FROM_M) {
    s.chaseX = s.x - SWING_CHASE_GAP;
    s.chaseY = s.y;
  } else if ((s.chaseX ?? 0) !== 0) {
    s.chaseX = (s.chaseX ?? 0) + SWING_CHASE_PACE;
    // It drifts toward the ninja's height (a quarter of the gap a tick, at most 3 px).
    s.chaseY = (s.chaseY ?? 0) + clampInt(Math.trunc((s.y - (s.chaseY ?? 0)) / 4), -3 * FP, 3 * FP);
    if ((s.chaseX ?? 0) + SWING_CHASE_REACH >= s.x - RADIUS) cause = 1;
  }
  // Stalactites: warn when the ninja comes within the trigger distance, fall a second later.
  s.rocks = (s.rocks ?? []).map((r) => {
    const rock = { ...r };
    if (rock.phase === 0 && rock.x - s.x <= rock.trigger) {
      rock.phase = 1;
      rock.t = 0;
    } else if (rock.phase === 1) {
      rock.t += 1;
      if (rock.t >= (s.tuned ? SWING_ROCK_WARN_V6 : SWING_ROCK_WARN)) {
        rock.phase = 2;
        rock.t = 0;
        rock.y = rock.top + SWING_ROCK_HALF_H;
        rock.vy = ROCK_FALL_START;
      }
    } else if (rock.phase === 2) {
      rock.t += 1;
      rock.y += rock.vy;
      rock.vy = Math.min(ROCK_FALL_MAX, rock.vy + ROCK_FALL_ACCEL);
      if (rock.y + SWING_ROCK_HALF_H >= lerpAt(s.floor, rock.x)) rock.phase = 3;
      else if (Math.abs(s.x - rock.x) <= SWING_ROCK_HALF_W + RADIUS && Math.abs(s.y - rock.y) <= SWING_ROCK_HALF_H + RADIUS) cause = cause || 2;
    }
    return rock;
  });
  // Lava jets: a pure function of the tick.
  for (const jet of s.jets ?? []) {
    if (Math.abs(s.x - jet.x) > SWING_JET_HALF_W + RADIUS) continue;
    const { h } = swingJetAt(jet, tick);
    if (h > 0 && s.y + RADIUS >= lerpAt(s.floor, jet.x) - h) cause = cause || 3;
  }
  return cause;
}

export function swingMetres(s: SwingState): number {
  return Math.max(0, Math.trunc((s.maxX - START_X) / METRE));
}

/** swingRev 4: 120 × metres ÷ 500 + a point a star (130 max unfinished); reaching 500 m adds 20. */
export function swingScoreV4(metres: number, stars: number): number {
  const m = Math.min(SWING_FINISH_M, metres);
  const st = clampInt(stars, 0, SWING_STARS);
  if (m >= SWING_FINISH_M) return clampInt(SWING_V4_DISTANCE_SCORE + st + SWING_V4_FINISH_BONUS, 0, 150);
  return clampInt(Math.round((SWING_V4_DISTANCE_SCORE * m) / SWING_FINISH_M) + st, 0, 130);
}

function score(state: SwingState): number {
  if (state.expand) return swingScoreV12(state);
  if (state.rev === SWING_REV) return swingScoreV4(swingMetres(state), state.stars ?? 0);
  const m = Math.min(SWING_FINISH_M, swingMetres(state));
  if (m >= SWING_FINISH_M) return finishScore(SWING_RUN_TICKS, state.endedTick);
  return clampInt(Math.round((130 * m) / SWING_FINISH_M), 0, 130);
}

export function swingExtra(s: SwingState) {
  return {
    metres: swingMetres(s),
    survived: s.ended !== 2,
    survivedSeconds: s.tick / 60,
    ...(s.dragons ? { dragonTotal: s.dragons.length } : {}),
    ...(s.rev === SWING_REV ? { stars: s.stars ?? 0, starTotal: swingStarTotal(s), cause: s.cause ?? 0 } : {}),
    ...(s.expand ? swingFeatureCounts(s) : {}),
  };
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
  const values = Object.values(snap);
  // swingRev 4 only, so older checksums are unchanged.
  if (state.rev !== undefined) {
    values.push(state.rev, state.chaseX ?? 0, state.chaseY ?? 0, state.stars ?? 0, state.cause ?? 0);
    for (const r of state.rocks ?? []) values.push(r.phase, r.t, r.y);
    // swingRev 6 only, after every rev-4 value.
    if (state.tuned) values.push(state.tuned, ...(state.starsTaken ?? []));
    // swingRev 7 only.
    if (state.tunec) values.push(state.tunec);
    // swingRev 8 only.
    if (state.spread) values.push(state.spread);
    // swingRev 9 (taller worlds): the world height, last.
    if (state.worldH) values.push(state.worldH);
    // swingRev 12: the expansion's state, after every earlier value.
    if (state.expand) values.push(state.expand, state.ledgeOn ?? -1, state.ledgeHold ?? 0, state.chain ?? 0, state.comboPts ?? 0, state.gemsTaken ?? 0, state.gatesLit ?? 0, ...(state.ledgeTicks ?? []));
  }
  for (const value of values) {
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
  // swingRev 9: the taller cavern's height (the original 620 otherwise).
  const SWING_WORLD_H = swingWorldH(state);
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
  const first = clampInt(Math.trunc(state.camX / COL) - 1, 0, state.ceil.length - 2);
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
  // Finish line at 500 m.
  {
    const x = sx(START_X + SWING_FINISH_M * METRE);
    if (x > -10 && x < SWING_WORLD_W + 10) {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SWING_WORLD_H);
      ctx.stroke();
      ctx.setLineDash([]);
    }
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
  ctx.fillText(`${Math.min(SWING_FINISH_M, swingMetres(state))} / ${SWING_FINISH_M} m`, 14, 26);
  ctx.restore();
}

export const swingGame: ArcadeGame<SwingState, ArcadeInputEvent | null> = {
  key: "swing",
  runTicks: SWING_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: SWING_INPUT_RANGES,
};

const dragonGameV2 = { ...swingGame, init: initDragonsV2 };
const dragonGameV3 = { ...swingGame, init: initDragonsV3 };
const chaseGameV4 = { ...swingGame, init: initV4 };
export function swingGameFor(rev?: number): typeof swingGame {
  if (rev === SWING_REV_EXPAND) return swingExpandGame;
  if (rev === SWING_REV_STRICT) return swingStrictGame;
  if (rev === SWING_REV_TARGET) return swingTargetGame;
  if (rev === SWING_REV_TALL) return swingTallGame;
  if (rev === SWING_REV_SPREAD) return swingSpreadGame;
  if (rev === SWING_REV_TUNEC) return swingTunecGame;
  if (rev === SWING_REV_TUNED) return swingTunedGame;
  if (rev === SWING_REV_BAND) return swingBandGame;
  if (rev === SWING_REV) return chaseGameV4;
  if (rev === SWING_REV_V3) return dragonGameV3;
  if (rev === SWING_REV_V2) return dragonGameV2;
  return swingGame;
}

/* ================= Oct 2026 score bands (swingRev 5) ================= */

/** Score-band revision (puzzle.swingRev = 5): rev-4 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const SWING_REV_BAND = 5;
/** Metres count 1 and stars 5; 140 at 500 m with all ten stars; reaching 500 m adds 10. */
export const SWING_BAND_CURVE = bandCurve([0, 86, 162, 245, 400, 499, 550], [0, 70, 100, 125, 136, 138, 140]);
export function swingBandParts(state: SwingState): BandParts {
  if (state.expand) return swingBandPartsV12(state);
  const units = Math.min(SWING_FINISH_M, swingMetres(state)) + 5 * clampInt(state.stars ?? 0, 0, SWING_STARS);
  const finished = swingMetres(state) >= SWING_FINISH_M;
  return { units, points: bandPoints(bandCurveOf(state, state.worldH ? SWING_V9_BAND_CURVE : state.tunec ? SWING_V7_BAND_CURVE : SWING_BAND_CURVE), units), bonus: finished ? BAND_FINISH_BONUS : 0, penalty: 0, finished, text: `${Math.min(SWING_FINISH_M, swingMetres(state))} m · ${state.stars ?? 0} stars`, bonusText: "Reached 500 m" };
}

function scoreBand(state: SwingState): number {
  if (state.expand) return swingScoreV12(state);
  return bandTotal(swingBandParts(state), Boolean(state.acted));
}

export const swingBandGame: typeof swingGame = { ...chaseGameV4, init: (seed) => bandInit(chaseGameV4.init(seed)) };

/* ================= Tuning A (swingRev 6, Oct 2026) ================= */
/*
 * Rev-5 play (same cavern, anchors, chasing dragon, lava jets and band curve)
 * with two changes, only on states that carry `tuned`:
 *  - stars are touch pickups: SWING_STARS of them, each worth what a star
 *    anchor was (5 band units). The anchors that carried stars stay as plain
 *    anchors, so the course's proofs and the dragon are unchanged. Each star
 *    sits on a line proved from a standard swing in its gap (swing, let go,
 *    grab the next anchor, swing on and reach the one after), at a seeded
 *    height: high at the top of a flight, low at the bottom of a swing, or on
 *    a risky line dipping toward the lava;
 *  - a loose stalactite crumbles for SWING_ROCK_WARN_V6 (2 s) before it drops,
 *    and starts that a second's flight (SWING_CHASE_PACE × 60) further ahead.
 */
export const SWING_REV_TUNED = 6;
export const SWING_ROCK_WARN_V6 = 120;
/** How much further ahead a rev-6 stalactite starts to crumble (1/256 px): the extra second at a typical 6 px a tick. */
export const SWING_ROCK_LEAD_V6 = 360 * FP;
/** A star pickup's radius, and the centre distance at which the ninja's disc touches it (1/256 px). */
export const SWING_STAR_R = 11 * FP;
export const SWING_STAR_TOUCH = SWING_STAR_R + RADIUS;
/** How far from any anchor ring a star sits, at least (so it never reads as one), 1/256 px. */
const STAR_CLEAR_OF_ANCHOR = 30 * FP;

/** Stars on the course: pickups on swingRev 6, star anchors on rev 4/5. */
export function swingStarTotal(s: SwingState): number {
  return s.starSpots ? s.starSpots.length : (s.starAnchors ?? []).length;
}

type Line = { swing: [number, number][]; flight: [number, number][] };

/**
 * Proved lines through the gap before anchor `j`: from a standard swing on
 * anchor j - 1, a release whose flight grabs j, and from that grab a release
 * that reaches j + 1 (the probe shape of starTakeable). Each line's body
 * centres, on the ropes and in the air. At most `max` lines.
 */
function provedLines(c: Course, j: number, max: number): Line[] {
  const i = j - 1;
  const a = c.anchors[i]!;
  const s = c.anchors[j]!;
  const next = c.anchors[j + 1];
  if (!next) return [];
  const spikes = c.spikes.filter((sp) => sp.x > a.x - 400 * FP && sp.x < next.x + 400 * FP);
  const view = { ...c, spikes };
  const start: Body = { x: 0, y: 0, vx: 0, vy: 0, rope: i, len: 130 * FP, th: 55000 * SUB, om: 0, grabLen: 130 * FP, reelTo: 0, reelLeft: 0, pumps: 0 };
  ropePos(start, a);
  const swing = { ...start };
  const swingPts: [number, number][] = [];
  const out: Line[] = [];
  for (let r = 0; r < 400 && out.length < max; r++) {
    if (moveBody(swing, view)) break;
    if (swing.pumps > 4) break;
    swingPts.push([swing.x, swing.y]);
    if (r % 3) continue;
    const fly = { ...swing };
    detach(fly, a);
    const flightPts: [number, number][] = [];
    for (let t = 0; t < 90; t++) {
      if (moveBody(fly, view)) break;
      flightPts.push([fly.x, fly.y]);
      if (t % 2 || nearestAhead(c.anchors, fly, 0) !== j) continue;
      const on = { ...fly };
      attach(on, j, s);
      const onPts: [number, number][] = [];
      let leads = false;
      for (let k = 0; k < 240 && !leads; k++) {
        if (moveBody(on, view)) break;
        onPts.push([on.x, on.y]);
        if (k % 3) continue;
        const off = { ...on };
        detach(off, s);
        const offPts: [number, number][] = [];
        for (let u = 0; u < 90; u++) {
          if (moveBody(off, view)) break;
          offPts.push([off.x, off.y]);
          if (nearestAhead(c.anchors, off, j + 1) === j + 1 && off.x < next.x) {
            leads = true;
            out.push({ swing: [...swingPts, ...onPts], flight: [...flightPts, ...offPts] });
            break;
          }
        }
      }
      break;
    }
  }
  return out;
}

const v6Cache = new Map<number, SwingState>();
function initV6(seed: number): SwingState {
  const cached = v6Cache.get(seed | 0);
  if (cached) return { ...cached, rocks: cached.rocks!.map((r) => ({ ...r })) };
  const v4 = initV4(seed);
  // Its own stream, so every rev-4 draw (and the stored rng) is unchanged.
  let rng = (seed ^ 0x57a25eed) | 0;
  const draw = (bound: number) => { const r = rngBelow(rng, bound); rng = r.state; return r.value; };
  const course: Course = { ceil: v4.ceil, floor: v4.floor, anchors: v4.anchors, spikes: v4.spikes, rng: 0 };
  // Never over a lava jet's column: a star there would be a trap rather than a risk.
  const clearOfAnchors = ([x, y]: [number, number]) =>
    v4.anchors.every((a) => Math.abs(a.x - x) > STAR_CLEAR_OF_ANCHOR || Math.abs(a.y - y) > STAR_CLEAR_OF_ANCHOR) &&
    (v4.jets ?? []).every((jet) => Math.abs(jet.x - x) > SWING_JET_HALF_W + SWING_STAR_TOUCH);
  const spots: [number, number][] = [];
  for (const j of [...(v4.starAnchors ?? [])].sort((p, q) => p - q)) {
    const lines = provedLines(course, j, 4);
    if (lines.length === 0) continue;
    // High: the top of a flight. Low: the bottom of a swing. Risky: a flight's lowest point, near the lava.
    const kind = draw(3);
    const pool: [number, number][] = [];
    for (const line of lines) {
      const pts = (kind === 1 ? line.swing : line.flight).filter(clearOfAnchors);
      if (pts.length === 0) continue;
      let best = pts[0]!;
      for (const p of pts) if (kind === 0 ? p[1] < best[1] : p[1] > best[1]) best = p;
      pool.push(best);
    }
    if (pool.length === 0) continue;
    spots.push(pool[draw(pool.length)]!);
  }
  const tuned: SwingState = {
    ...v4,
    tuned: 1,
    starAnchors: [],
    starSpots: spots,
    rocks: v4.rocks!.map((r) => ({ ...r, trigger: r.trigger + SWING_ROCK_LEAD_V6 })),
  };
  if (v6Cache.size > 16) v6Cache.clear();
  v6Cache.set(seed | 0, tuned);
  return { ...tuned, rocks: tuned.rocks!.map((r) => ({ ...r })) };
}

export const swingTunedGame: typeof swingGame = { ...swingBandGame, init: (seed) => bandInit(initV6(seed)) };

/* ================= Tuning C (swingRev 7, Oct 2026) ================= */

/**
 * swingRev 7 (Tuning C): swingRev 6 play unchanged, scored about 10 % lower
 * (Joe found Grappler a little lenient): every knot below the top keeps its
 * units and drops to nine tenths of its points; 500 m with every star still
 * reaches 140, plus 10 for the finish. States add `tunec: 1`.
 */
export const SWING_REV_TUNEC = 7;
export const SWING_V7_BAND_CURVE = bandCurve([0, 86, 162, 245, 400, 499, 550], [0, 63, 90, 112, 122, 124, 140]);
export const swingTunecGame: typeof swingGame = { ...swingTunedGame, init: (seed) => ({ ...swingTunedGame.init(seed), tunec: 1 }) };

/* ================= Tuning F (swingRev 8, Oct 2026) ================= */

/**
 * swingRev 8 (Tuning F): swingRev 7 play, cavern, hazards and curve unchanged;
 * only where the ten touch stars sit. Rev 6/7 put one on a proved line in each
 * star-anchor gap, and a gap whose star spots all failed handed its star to the
 * earliest spare gap, so stars bunched near the start. Rev 8 aims one star at
 * the middle of each of ten equal stretches of the run (30–490 m) and takes
 * the proved spot nearest it: a point of the drawn kind (top of a flight,
 * bottom of a swing, a flight's lowest point) within SWING_SPREAD_WINDOW of
 * the aim on a line provedLines finds through the gap at the aim or a
 * neighbour, else the nearest proved point of any kind. Same proof as rev 6,
 * same count, same clearances (anchor rings, lava jets) plus clear of a loose
 * stalactite's column. Its draws come from their own stream, so the course is
 * unchanged. States add `spread: 1` (folded into the checkpoint checksum last).
 */
export const SWING_REV_SPREAD = 8;
/** The stretch of the run the stars spread over (metres) and how far from its aim a star may sit (1/256 px). */
export const SWING_SPREAD_FROM_M = 30;
export const SWING_SPREAD_TO_M = 490;
export const SWING_SPREAD_WINDOW = 60 * FP;

/** Where swingRev 8 aims star `k` (1/256 px): the middle of the k-th of SWING_STARS equal stretches. */
export function swingSpreadAim(k: number): number {
  const span = SWING_SPREAD_TO_M - SWING_SPREAD_FROM_M;
  return START_X + Math.trunc(((SWING_SPREAD_FROM_M * 2 * SWING_STARS + (2 * k + 1) * span) * METRE) / (2 * SWING_STARS));
}

function spreadSpots(v4: SwingState, seed: number): [number, number][] {
  // Its own stream (not rev 6's), so every rev-4 draw and the stored rng are unchanged.
  let rng = (seed ^ 0x5b8ead17) | 0;
  const draw = (bound: number) => { const r = rngBelow(rng, bound); rng = r.state; return r.value; };
  const anchors = v4.anchors;
  const course: Course = { ceil: v4.ceil, floor: v4.floor, anchors, spikes: v4.spikes, rng: 0 };
  const clear = ([x, y]: [number, number]) =>
    anchors.every((a) => Math.abs(a.x - x) > STAR_CLEAR_OF_ANCHOR || Math.abs(a.y - y) > STAR_CLEAR_OF_ANCHOR) &&
    (v4.jets ?? []).every((jet) => Math.abs(jet.x - x) > SWING_JET_HALF_W + SWING_STAR_TOUCH) &&
    (v4.rocks ?? []).every((r) => Math.abs(r.x - x) > SWING_ROCK_HALF_W + SWING_STAR_TOUCH);
  const lineCache = new Map<number, Line[]>();
  const linesAt = (j: number) => {
    let lines = lineCache.get(j);
    if (!lines) lineCache.set(j, (lines = provedLines(course, j, 4)));
    return lines;
  };
  const startIndex = anchors.findIndex((a) => a.x >= START_X);
  const spots: [number, number][] = [];
  for (let k = 0; k < SWING_STARS; k++) {
    const aim = swingSpreadAim(k);
    const kind = draw(3);
    const ahead = anchors.findIndex((a) => a.x > aim);
    const order = [0, 1, -1, 2, -2, 3, -3].map((d) => ahead + d).filter((j) => j > startIndex && j + 1 < anchors.length);
    let chosen: [number, number] | null = null;
    // The drawn kind near the aim: the top of a flight, the bottom of a swing, or a flight's lowest point.
    for (const j of order) {
      const pool: [number, number][] = [];
      for (const line of linesAt(j)) {
        const pts = (kind === 1 ? line.swing : line.flight).filter((p) => Math.abs(p[0] - aim) <= SWING_SPREAD_WINDOW && clear(p));
        if (pts.length === 0) continue;
        let best = pts[0]!;
        for (const p of pts) if (kind === 0 ? p[1] < best[1] : p[1] > best[1]) best = p;
        pool.push(best);
      }
      if (pool.length > 0) {
        chosen = pool[draw(pool.length)]!;
        break;
      }
    }
    // Otherwise the proved point nearest the aim, of any kind.
    if (!chosen) {
      let bestD = Infinity;
      for (const j of order)
        for (const line of linesAt(j))
          for (const p of [...line.swing, ...line.flight]) {
            const d = Math.abs(p[0] - aim);
            if (d < bestD && clear(p)) {
              bestD = d;
              chosen = p;
            }
          }
    }
    if (chosen) spots.push(chosen);
  }
  return spots;
}

/**
 * Every body centre on the lines provedLines finds through the gap before
 * anchor `j` of a swingRev 6+ course (checks use it to show each star sits on
 * a proved line; not used in play).
 */
export function swingProvedPoints(state: SwingState, j: number): [number, number][] {
  const course: Course = { ceil: state.ceil, floor: state.floor, anchors: state.anchors, spikes: state.spikes, rng: 0 };
  return provedLines(course, j, 4).flatMap((line) => [...line.swing, ...line.flight]);
}

const v8Cache = new Map<number, SwingState>();
function initV8(seed: number): SwingState {
  const cached = v8Cache.get(seed | 0);
  if (cached) return { ...cached, rocks: cached.rocks!.map((r) => ({ ...r })) };
  const v4 = initV4(seed);
  const spread: SwingState = {
    ...v4,
    tuned: 1,
    starAnchors: [],
    starSpots: spreadSpots(v4, seed),
    rocks: v4.rocks!.map((r) => ({ ...r, trigger: r.trigger + SWING_ROCK_LEAD_V6 })),
    tunec: 1,
    spread: 1,
  };
  if (v8Cache.size > 16) v8Cache.clear();
  v8Cache.set(seed | 0, spread);
  return { ...spread, rocks: spread.rocks!.map((r) => ({ ...r })) };
}

/** swingRev 8: rev-7 play and curve (it carries `tunec`), stars spread evenly. */
export const swingSpreadGame: typeof swingGame = { ...swingTunecGame, init: (seed) => bandInit(initV8(seed)) };

/* ================= Taller worlds (swingRev 9, Oct 2026) ================= */

/**
 * swingRev 9 (taller worlds, batch 3): swingRev 8 play in a taller cavern,
 * 390 × SWING_TALL_H, the same for every player. The ceiling, anchors, ceiling
 * spikes, stalactites and every course draw are rev 8's; the lava floor sits
 * SWING_TALL_DROP lower (every floor point moved down by the same 110 px), so
 * the extra height is all between the swing lines and the lava. Each lava jet
 * erupts that much higher from the lower lava, so its top (the height that
 * kills) is exactly where it was; a loose stalactite falls on to the lower lava.
 * The ten touch stars are re-proved on the taller cavern: rev 8's spread
 * (swingSpreadAim, provedLines from a standard swing, the same clearances) run
 * on the lowered floor. Lowering the floor only removes deaths, so every line
 * proved on the rev-8 cavern still holds, and provedLines may now find lines
 * that swoop below the old lava. States carry rev 8's fields plus `worldH`,
 * folded into the checkpoint checksum last. Scored on SWING_V9_BAND_CURVE.
 */
export const SWING_REV_TALL = 9;
export const SWING_TALL_H = 730;
/** How far the rev-9 lava (and each jet's base) sits below rev 8's, 1/256 px. */
export const SWING_TALL_DROP = (SWING_TALL_H - SWING_WORLD_H) * FP;

/** The world height (px) a state plays in: swingRev 9's taller cavern, or the original 620. */
export function swingWorldH(state: { worldH?: number }): number {
  // swingRev 12 carries its own (taller) height in worldH as well.
  return state.worldH ?? SWING_WORLD_H;
}
/** The world height (px) a stored round's swingRev plays in. */
export function swingWorldHFor(rev?: number | null): number {
  if (rev === SWING_REV_EXPAND) return SWING_V12_H;
  return rev === SWING_REV_TALL || rev === SWING_REV_TARGET || rev === SWING_REV_STRICT ? SWING_TALL_H : SWING_WORLD_H;
}

/**
 * swingRev 9 band knots (metres + 5 a star, as rev 5), refitted on the taller
 * cavern with scripts/arcade-skill-bands.ts --rev=g3 (60 seeds: unit medians
 * 87 / 204.5 / 290.5 / 500, the near-perfect median a finish) to land average,
 * good, great and near-perfect players near 70 / 100 / 125 / 140–150; 140 at
 * 500 m with every star, reaching 500 m adds 10.
 */
export const SWING_V9_BAND_CURVE = bandCurve([0, 87, 204, 290, 400, 499, 550], [0, 70, 100, 125, 130, 133, 140]);

const v9Cache = new Map<number, SwingState>();
function initV9(seed: number): SwingState {
  const cached = v9Cache.get(seed | 0);
  if (cached) return { ...cached, rocks: cached.rocks!.map((r) => ({ ...r })) };
  const v4 = initV4(seed);
  const floor = v4.floor.map((y) => y + SWING_TALL_DROP);
  const jets = (v4.jets ?? []).map((jet) => ({ ...jet, h: jet.h + SWING_TALL_DROP }));
  const deep: SwingState = { ...v4, floor, jets };
  const tall: SwingState = {
    ...deep,
    tuned: 1,
    starAnchors: [],
    starSpots: spreadSpots(deep, seed),
    rocks: v4.rocks!.map((r) => ({ ...r, trigger: r.trigger + SWING_ROCK_LEAD_V6 })),
    tunec: 1,
    spread: 1,
    worldH: SWING_TALL_H,
  };
  if (v9Cache.size > 16) v9Cache.clear();
  v9Cache.set(seed | 0, tall);
  return { ...tall, rocks: tall.rocks!.map((r) => ({ ...r })) };
}

/** swingRev 9: rev-8 play and stars in the taller cavern, on SWING_V9_BAND_CURVE. */
export const swingTallGame: typeof swingGame = { ...swingTunecGame, init: (seed) => bandInit(initV9(seed)) };

/* ================= Scoring targets (swingRev 10, 18 Oct 2026) ================= */

/**
 * swingRev 10 (scoring targets, docs/scoring-targets.md): swingRev 9 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const SWING_REV_TARGET = 10;
export const swingTargetGame = bandTargetGame(swingTallGame);
/** The curve new rounds score on: SWING_V9_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const SWING_V10_BAND_CURVE = bandRetarget(SWING_V9_BAND_CURVE);


/* ================= Score bands (swingRev 11, 19 Oct 2026) ================= */

/**
 * swingRev 11 (score bands, docs/scoring-targets.md): swingRev 10 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const SWING_REV_STRICT = 11;
export const swingStrictGame = bandStrictGame(swingTargetGame);
/** The curve new rounds score on: SWING_V9_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const SWING_V11_BAND_CURVE = bandStrict(SWING_V9_BAND_CURVE);

/* ================= The expansion (swingRev 12, 25 Oct 2026) ================= */

/**
 * swingRev 12 (world expansion and depth, docs/expansions/e7-swing.md; the round's maximum is 200,
 * src/lib/duel/roundMax.ts). Every rule below is gated on the state's `expand` marker, so every
 * earlier revision plays and scores exactly as before.
 *
 *  - More world: a 450 × 844 view (SWING_V12_W × SWING_V12_H, the box's shape on an iPhone 11), the
 *    lava SWING_V12_DROP below rev 8's (each jet's top where it was), the hero 225 px from the left.
 *    The ceiling, anchors, ceiling spikes, stalactites, dragon and every course draw are rev 9's; the
 *    ten touch stars are re-proved on the deeper cavern (spreadSpots).
 *  - High and low routes: above the anchor line, SWING_GEMS gold gems sit at the tops of proved flights
 *    (a high route: strong releases close under the ceiling); below it, SWING_GATES speed gates hang
 *    under anchors, their openings around the deepest proved fast swing (a low route: grab early for a
 *    long rope and swoop through at SWING_GATE_SPEED or faster). A gate lights on any forward pass
 *    through its opening at that speed; neither ever ends a run.
 *  - Swing combos: a flying grab of an anchor further ahead at SWING_COMBO_SPEED or faster, within
 *    SWING_COMBO_GAP ticks of the last grab, adds one to the chain (a fast grab after a slow one starts
 *    a new chain at 1; a slow grab, a grab from a ledge or a landing ends it). Every fifth link of a
 *    chain is a combo point.
 *  - Course sections: three set routes before the dragon (from about 25, 85 and 150 m): a start ledge,
 *    three landing ledges and a finish-flag ledge, each placed where a proved swing from rest on the
 *    ledge before lands (swing, let go, fly, land). Ledges are one-way: falling on to one from above, off
 *    the rope, lands the hero (standing still, the chain ended); a press grabs the anchor ahead from
 *    rest (a kick: SWING_LEDGE_KICK along the swing). The middle landing ledge of sections 2 and 3
 *    collapses SWING_LEDGE_CRUMBLE ticks after the hero first lands on it. Every ledge landed counts
 *    once. Landed, the hero walks to the ledge's centre (SWING_LEDGE_WALK a tick; a press on the way is
 *    held until there), so every kick off a ledge is the proved one (each ledge sits where releases a
 *    tick or two either side of the proved one land too).
 *  - Score: a base curve on metres + 5 a star (to 140, plus 10 for 500 m; the same base as
 *    today, refitted to the deeper cave) plus up to 50 for the features: combo points (at most 25), a
 *    point a gem (12), a point a lit gate (8) and 15 shared by the ledges landed (a point each with three
 *    sections, 1.5 with two), capped at 50: 200 needs nearly everything.
 */
export const SWING_REV_EXPAND = 12;
export const SWING_V12_W = 450;
export const SWING_V12_H = 844;
/** How far the rev-12 lava (and each jet's base) sits below rev 8's, 1/256 px. */
export const SWING_V12_DROP = (SWING_V12_H - SWING_WORLD_H) * FP;
export const SWING_LEAD_V12 = 225 * FP;
export const SWING_GEMS = 12;
export const SWING_GEM_R = 12 * FP;
export const SWING_GEM_TOUCH = SWING_GEM_R + RADIUS;
export const SWING_GATES = 8;
/** A gate lights only at this speed or more (px a tick), measured over the tick that passes it. */
export const SWING_GATE_SPEED = 7;
/** A gate post's half-width (art only; the pass test is the line x = gate.x). */
export const SWING_GATE_HALF_W = 6 * FP;
export const SWING_COMBO_GAP = 60;
/** A chain link is a flying grab at this speed or more (px a tick). */
export const SWING_COMBO_SPEED = 7;
export const SWING_COMBO_EVERY = 5;
export const SWING_SECTIONS = 3;
/** Each section: start, three landings, the finish flag. */
export const SWING_SECTION_LEDGES = 5;
export const SWING_LEDGE_HALF = 30 * FP;
/** Landed on a ledge, the hero walks to its centre at this speed (1/256 px a tick) before kicking off. */
export const SWING_LEDGE_WALK = 6 * FP;
/** The start ledge is wider: open swinging drops on to it from many different flights. */
export const SWING_START_LEDGE_HALF = 56 * FP;
/** The ledge slab's thickness below its top (art; landing tests the top line only). */
export const SWING_LEDGE_THICK = 10 * FP;
export const SWING_LEDGE_CRUMBLE = 45;
/** Pressing on a ledge kicks off it at this speed along the swing (1/256 px a tick, forward) as the rope takes hold. */
export const SWING_LEDGE_KICK = 8 * FP;
export const SWING_SECTION_FROM_M = [22, 80, 145] as const;
/** Feature caps on the 200 scale; the ledges share SWING_LEDGE_POINTS however many sections a course has (two or three). */
export const SWING_COMBO_CAP = 25;
export const SWING_LEDGE_POINTS = 15;
export const SWING_FEATURE_CAP = 50;
export const SWING_V12_MAX = 200;
/**
 * The base part of a rev-12 score (metres + 5 a star, as every band revision): 140 at 500 m with every
 * star, as rev 11. The deeper cave takes fewer runs into the lava, so the same players go further; the
 * knots were fitted by matching the skill-band players' unit quantiles on rev 12 to their curve points
 * on rev 11 (the same bank courses, 30 a level), so today's players keep today's base score
 * (docs/expansions/e7-swing.md has the fit and the tuning table).
 */
export const SWING_V12_BAND_CURVE = bandCurve([0, 55, 74, 129, 166, 215, 260, 329, 489, 515, 550], [0, 46, 60, 84, 93, 107, 117, 129, 133, 135, 140]);

/** A set-route ledge: its centre x and top (1/256 px), half-width, kind (0 start, 1 landing, 2 finish flag), section, order and whether it collapses. */
export interface SwingLedge {
  x: number;
  top: number;
  half: number;
  kind: number;
  section: number;
  order: number;
  crumble: number;
}

/** A speed gate: its x and opening (1/256 px, y0 above y1). */
export interface SwingGate {
  x: number;
  y0: number;
  y1: number;
}

/** True once a collapsing ledge has given way (rev 12). */
export function expand12LedgeGone(s: Pick<SwingState, "ledges" | "ledgeTicks">, i: number, tick: number): boolean {
  const ledge = s.ledges?.[i];
  if (!ledge || !ledge.crumble) return false;
  const first = s.ledgeTicks?.[i] ?? 0;
  return first > 0 && tick - first >= SWING_LEDGE_CRUMBLE;
}

function expand12NoteGrab(s: SwingState, target: number, tick: number, speed2: number): void {
  const a = s.anchors[target]!;
  const forward = a.x > (s.lastGrabX ?? 0);
  const fast = forward && speed2 >= SWING_COMBO_SPEED * SWING_COMBO_SPEED * FP * FP;
  const chain = s.chain ?? 0;
  if (fast && chain > 0 && tick - s.grabTick <= SWING_COMBO_GAP) s.chain = chain + 1;
  else s.chain = fast ? 1 : 0;
  if (forward) s.lastGrabX = a.x;
  if (s.chain > (s.bestChain ?? 0)) s.bestChain = s.chain;
  if (s.chain > 0 && s.chain % SWING_COMBO_EVERY === 0) s.comboPts = (s.comboPts ?? 0) + 1;
}

/** One tick of rev-12 pickups after the body moved from (px, py): a ledge landing, gems, gates. */
function expand12Move(s: SwingState, px: number, py: number, tick: number): void {
  if (s.rope < 0 && s.vy > 0 && s.ledges) {
    for (let i = 0; i < s.ledges.length; i++) {
      const l = s.ledges[i]!;
      if (Math.abs(s.x - l.x) > l.half || expand12LedgeGone(s, i, tick)) continue;
      if (py + RADIUS <= l.top && s.y + RADIUS >= l.top) {
        s.y = l.top - RADIUS;
        s.ledgeHold = 0;
        s.vx = 0;
        s.vy = 0;
        s.ledgeOn = i;
        s.chain = 0;
        if (!(s.ledgeTicks?.[i] ?? 0)) {
          const ticks = [...(s.ledgeTicks ?? [])];
          ticks[i] = tick;
          s.ledgeTicks = ticks;
        }
        break;
      }
    }
  }
  if (s.gems) {
    let taken = s.gemsTaken ?? 0;
    for (let i = 0; i < s.gems.length; i++) {
      if (taken & (1 << i)) continue;
      const dx = s.x - s.gems[i]![0];
      const dy = s.y - s.gems[i]![1];
      if (dx * dx + dy * dy <= SWING_GEM_TOUCH * SWING_GEM_TOUCH) taken |= 1 << i;
    }
    s.gemsTaken = taken;
  }
  if (s.gates) {
    let lit = s.gatesLit ?? 0;
    const dx = s.x - px;
    const dy = s.y - py;
    const fast = dx * dx + dy * dy >= SWING_GATE_SPEED * SWING_GATE_SPEED * FP * FP;
    for (let i = 0; i < s.gates.length; i++) {
      const g = s.gates[i]!;
      if (lit & (1 << i) || !(px < g.x && s.x >= g.x)) continue;
      const y = py + Math.trunc((dy * (g.x - px)) / dx);
      if (fast && y >= g.y0 && y <= g.y1) lit |= 1 << i;
    }
    s.gatesLit = lit;
  }
}

function bitCount(n: number): number {
  let c = 0;
  for (let b = n; b; b &= b - 1) c += 1;
  return c;
}

/** The rev-12 feature counts (reveal lines, effects, the score). */
export function swingFeatureCounts(s: SwingState) {
  const landed = (i: number) => (s.ledgeTicks?.[i] ?? 0) > 0;
  const ledges = (s.ledges ?? []).filter((_, i) => landed(i)).length;
  const sectionIds = [...new Set((s.ledges ?? []).map((l) => l.section))];
  const sections = sectionIds.filter((k) => (s.ledges ?? []).every((l, i) => l.section !== k || landed(i))).length;
  return {
    comboPts: s.comboPts ?? 0,
    bestChain: s.bestChain ?? 0,
    gems: bitCount(s.gemsTaken ?? 0),
    gemTotal: (s.gems ?? []).length,
    gates: bitCount(s.gatesLit ?? 0),
    gateTotal: (s.gates ?? []).length,
    ledges,
    ledgeTotal: (s.ledges ?? []).length,
    sections,
    sectionTotal: sectionIds.length,
  };
}

/** The feature points of a rev-12 run (0…50) and their parts. */
export function swingFeaturePoints(s: SwingState) {
  const c = swingFeatureCounts(s);
  const combo = Math.min(SWING_COMBO_CAP, c.comboPts);
  const ledgePts = c.ledgeTotal ? Math.trunc((SWING_LEDGE_POINTS * c.ledges) / c.ledgeTotal) : 0;
  const total = Math.min(SWING_FEATURE_CAP, combo + c.gems + c.gates + ledgePts);
  return { ...c, combo, ledgePts, total };
}

export function swingBandPartsV12(state: SwingState): BandParts {
  const metres = Math.min(SWING_FINISH_M, swingMetres(state));
  const units = metres + 5 * clampInt(state.stars ?? 0, 0, SWING_STARS);
  const finished = swingMetres(state) >= SWING_FINISH_M;
  const f = swingFeaturePoints(state);
  const words = `combos ${f.combo} · gems ${f.gems} · gates ${f.gates} · ledges ${f.ledgePts}`;
  return {
    units,
    points: bandPoints(SWING_V12_BAND_CURVE, units),
    bonus: (finished ? BAND_FINISH_BONUS : 0) + f.total,
    penalty: 0,
    finished,
    text: `${metres} m · ${state.stars ?? 0} stars`,
    bonusText: finished ? `Reached 500 m +${BAND_FINISH_BONUS} · ${words}` : words,
  };
}

export function swingScoreV12(state: SwingState): number {
  return bandTotal(swingBandPartsV12(state), Boolean(state.acted), SWING_V12_MAX);
}

/** The world width (px) a state plays in: swingRev 12's wider view, or 390. */
export function swingWorldW(state: { worldW?: number }): number {
  return state.worldW ?? SWING_WORLD_W;
}
/** The world width (px) a stored round's swingRev plays in. */
export function swingWorldWFor(rev?: number | null): number {
  return rev === SWING_REV_EXPAND ? SWING_V12_W : SWING_WORLD_W;
}
/**
 * The height (px) a stored round's reveal and demo draw at in the shared 390-wide reveal box: the
 * world's own height, or for swingRev 12's 450-wide view the height that keeps its shape (731).
 */
export function swingRevealHFor(rev?: number | null): number {
  return rev === SWING_REV_EXPAND ? Math.round((SWING_V12_H * SWING_WORLD_W) / SWING_V12_W) : swingWorldHFor(rev);
}

/** Grabbing from a ledge, the hero kicks off it: SWING_LEDGE_KICK of forward speed along the swing. */
function kickOff(b: Body): void {
  b.om += Math.trunc((SWING_LEDGE_KICK * KANG) / b.len);
  capOm(b);
}

/** The hero standing at (x, y) (1/256 px), off any rope. */
function restBody(x: number, y: number): Body {
  return { x, y, vx: 0, vy: 0, rope: -1, len: MIN_ROPE, th: 0, om: 0, grabLen: MIN_ROPE, reelTo: 0, reelLeft: 0, pumps: 0 };
}

/** The hero on a ledge at `at` after pressing for anchor j: attached and kicked off. */
function kickedFrom(c: Course, at: [number, number], j: number): Body {
  const b = restBody(at[0], at[1]);
  attach(b, j, c.anchors[j]!);
  kickOff(b);
  return b;
}

/** A standard swing on anchor i (provedLines' probe: a 130 px rope let go from behind). */
function standardSwing(c: Course, i: number): Body {
  const b: Body = { x: 0, y: 0, vx: 0, vy: 0, rope: i, len: 130 * FP, th: 55000 * SUB, om: 0, grabLen: 130 * FP, reelTo: 0, reelLeft: 0, pumps: 0 };
  ropePos(b, c.anchors[i]!);
  return b;
}

/**
 * From a body swinging on anchor j (a kick off a ledge, or a standard swing into a section): the landing points of proved releases (a forward upswing, then a
 * flight that descends on to the spot without dying). A spot qualifies behind and a little below the
 * anchor a press from rest there would take (one further ahead than j), far enough out for a swing
 * from rest to carry. Each is [x, y, that anchor]: the body centre on the tick it lands (the ledge's
 * top is that y + RADIUS).
 */
function ledgeLandings(c: Course, onRope: Body, j: number, deep = 110 * FP, half = SWING_LEDGE_HALF): [number, number, number][] {
  const a = c.anchors[j]!;
  const swing = { ...onRope };
  // Up to three passes of pumping from rest (each bottom pass adds speed): the body each tick, and whether it is on a forward upswing.
  const bodies: Body[] = [];
  const up: boolean[] = [];
  let px = swing.x;
  let py = swing.y;
  for (let r = 0; r < 420; r++) {
    if (moveBody(swing, c)) break;
    up.push(swing.x > px && swing.y < py && swing.x >= a.x);
    px = swing.x;
    py = swing.y;
    bodies.push({ ...swing });
  }
  /** Does a release after body r land on a ledge with this centre and top (descending through the top line within reach of the centre)? */
  const lands = (r: number, x: number, top: number) => {
    if (!bodies[r] || !up[r]) return false;
    const fly = { ...bodies[r]! };
    detach(fly, a);
    for (let t = 0; t < 100; t++) {
      const fy = fly.y;
      if (moveBody(fly, c)) return false;
      if (fy + RADIUS <= top && fly.y + RADIUS >= top) return Math.abs(fly.x - x) <= half - 4 * FP;
    }
    return false;
  };
  const out: [number, number, number][] = [];
  for (let r = 6; r < bodies.length; r += 2) {
    if (!up[r]) continue;
    const fly = { ...bodies[r]! };
    detach(fly, a);
    for (let t = 0; t < 100; t++) {
      const fy = fly.y;
      if (moveBody(fly, c)) break;
      if (fly.vy <= 0 || fly.y <= fy || fly.x < a.x + 30 * FP) continue;
      if (fly.y > lerpAt(c.floor, fly.x) - 160 * FP || fly.y - RADIUS < lerpAt(c.ceil, fly.x) + 30 * FP) continue;
      const m = nearestAhead(c.anchors, restBody(fly.x, fly.y), 0);
      if (m <= j) continue;
      const next = c.anchors[m]!;
      const dx = next.x - fly.x;
      const dy = fly.y - next.y;
      if (dx < 55 * FP || dx > 170 * FP || dy < 10 * FP || dy > deep || (deep <= 110 * FP && 5 * dx < 4 * dy)) continue;
      // A forgiving spot: releases a tick or two either side land on it too (four of the five).
      const top = fly.y + RADIUS;
      let near = 0;
      for (const d of [-2, -1, 1, 2]) if (lands(r + d, fly.x, top)) near += 1;
      if (near >= 2) out.push([fly.x, fly.y, m]);
      break;
    }
  }
  return out;
}

/** From a kick off the finish ledge on anchor j, can a release reach anchor j + 1 (open swinging resumes)? */
function leavesLedge(c: Course, onRope: Body, j: number): boolean {
  const a = c.anchors[j]!;
  const next = c.anchors[j + 1];
  if (!next) return false;
  const swing = { ...onRope };
  for (let r = 0; r < 260; r++) {
    if (moveBody(swing, c)) return false;
    if (r % 2) continue;
    const fly = { ...swing };
    detach(fly, a);
    for (let t = 0; t < 110; t++) {
      if (moveBody(fly, c)) break;
      if (nearestAhead(c.anchors, fly, j + 1) === j + 1 && fly.x < next.x) return true;
    }
  }
  return false;
}

/**
 * Start-ledge spots for a section entered from anchor i: the places where the most flights come down
 * (nine probe swings on i, ropes of 110–190 px let go from three angles, every other release), each
 * a spot from which a press takes an anchor ahead, below it by 10–200 px and behind it by 55–170 px.
 * Best covered first; the coverage is the number of flights descending through the ledge's top line
 * within its reach, read from a 16 × 8 px grid of their descending points.
 */
function entrySpots(c: Course, i: number): [number, number, number][] {
  const a = c.anchors[i]!;
  const cell = new Map<number, number>();
  const key = (gx: number, gy: number) => gx * 8192 + gy;
  const points: [number, number][] = [];
  for (const len of [110, 150, 190])
    for (const th of [52000, 56000, 60000]) {
      const swing: Body = { x: 0, y: 0, vx: 0, vy: 0, rope: i, len: len * FP, th: th * SUB, om: 0, grabLen: len * FP, reelTo: 0, reelLeft: 0, pumps: 0 };
      ropePos(swing, a);
      for (let r = 0; r < 240; r++) {
        if (moveBody(swing, c) || swing.pumps > 3) break;
        if (r % 2) continue;
        const fly = { ...swing };
        detach(fly, a);
        const seen = new Set<number>();
        for (let t = 0; t < 90; t++) {
          const fy = fly.y;
          if (moveBody(fly, c)) break;
          if (fly.y <= fy || fly.x < a.x + 30 * FP) continue;
          const k = key(Math.trunc(fly.x / (16 * FP)), Math.trunc(fly.y / (8 * FP)));
          if (seen.has(k)) continue;
          seen.add(k);
          cell.set(k, (cell.get(k) ?? 0) + 1);
          if (cell.get(k) === 1) points.push([fly.x, fly.y]);
        }
      }
    }
  const reach = Math.trunc((SWING_START_LEDGE_HALF - 4 * FP) / (16 * FP));
  const scored: [number, number, number, number][] = [];
  for (const [x, y] of points) {
    if (y > lerpAt(c.floor, x) - 160 * FP || y - RADIUS < lerpAt(c.ceil, x) + 30 * FP) continue;
    const m = nearestAhead(c.anchors, restBody(x, y), 0);
    if (m <= i) continue;
    const next = c.anchors[m]!;
    const dx = next.x - x;
    const dy = y - next.y;
    if (dx < 55 * FP || dx > 170 * FP || dy < 10 * FP || dy > 200 * FP) continue;
    const gx = Math.trunc(x / (16 * FP));
    const gy = Math.trunc(y / (8 * FP));
    let cover = 0;
    for (let d = -reach; d <= reach; d++) cover += cell.get(key(gx + d, gy)) ?? 0;
    scored.push([x, y, m, cover]);
  }
  scored.sort((p, q) => q[3] - p[3] || p[0] - q[0]);
  return scored.slice(0, 6).map(([x, y, m]) => [x, y, m]);
}

/**
 * One set-route section from anchor i0: a start ledge under and behind it, then four ledges, each on
 * a proved landing from a swing from rest on the ledge before (the last is the finish flag), and a
 * proved way on from the flag. Null if no chain is found.
 */
/** The most ledge searches one section start may spend (each a kick off a ledge and its flights). */
const SECTION_SEARCH_NODES = 40;
/** The most anchors a section tries to start from. */
const SECTION_STARTS = 4;

function buildSection(c: Course, i0: number, section: number, draw: (n: number) => number): SwingLedge[] | null {
  let tries = 0;
  /** Ledges from the one at `at` (whose press takes anchor j) to the flag. */
  const chain = (at: [number, number], j: number, k: number): [number, number][] | null => {
    if (++tries > SECTION_SEARCH_NODES) return null;
    if (k === SWING_SECTION_LEDGES) return leavesLedge(c, kickedFrom(c, at, j), j) ? [] : null;
    // Distinct options: one spot per next anchor and 24 px of x.
    const seen = new Set<number>();
    const spots = ledgeLandings(c, kickedFrom(c, at, j), j).filter(([x, , m]) => {
      const key = m * 4096 + Math.trunc(x / (24 * FP));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (spots.length === 0) return null;
    // The seed picks among the first few options; the rest follow in release order.
    const startAt = draw(Math.min(3, spots.length));
    for (let n = 0; n < spots.length; n++) {
      const [x, y, m] = spots[(startAt + n) % spots.length]!;
      const rest = chain([x, y], m, k + 1);
      if (rest) return [[x, y], ...rest];
      if (tries > SECTION_SEARCH_NODES) return null;
    }
    return null;
  };
  // The start ledge: where the most open flights off the anchor before come down (so open swinging can drop on to it).
  const entries = entrySpots(c, i0 - 1);
  const startAt = draw(Math.max(1, Math.min(3, entries.length)));
  for (let n = 0; n < entries.length; n++) {
    const [x, y, m] = entries[(startAt + n) % entries.length]!;
    const rest = chain([x, y], m, 1);
    if (tries > SECTION_SEARCH_NODES) return null;
    if (!rest) continue;
    return [[x, y] as [number, number], ...rest].map(([lx, ly], order) => ({
      x: lx,
      top: ly + RADIUS,
      half: order === 0 ? SWING_START_LEDGE_HALF : SWING_LEDGE_HALF,
      kind: order === 0 ? 0 : order === SWING_SECTION_LEDGES - 1 ? 2 : 1,
      section,
      order,
      crumble: section > 0 && order === 2 ? 1 : 0,
    }));
  }
  return null;
}

const v12Cache = new Map<number, SwingState>();
function initV12(seed: number): SwingState {
  const cached = v12Cache.get(seed | 0);
  if (cached) return { ...cached, rocks: cached.rocks!.map((r) => ({ ...r })) };
  const v4 = initV4(seed);
  const floor = v4.floor.map((y) => y + SWING_V12_DROP);
  const jets = (v4.jets ?? []).map((jet) => ({ ...jet, h: jet.h + SWING_V12_DROP }));
  const deep: SwingState = { ...v4, floor, jets };
  const rocks = v4.rocks!.map((r) => ({ ...r, trigger: r.trigger + SWING_ROCK_LEAD_V6 }));
  const starSpots = spreadSpots(deep, seed);
  // Its own stream, so every earlier draw (and the stored rng) is unchanged.
  let rng = (seed ^ 0x3c6ef372) | 0;
  const draw = (bound: number) => { const r = rngBelow(rng, bound); rng = r.state; return r.value; };
  const anchors = deep.anchors;
  const course: Course = { ceil: deep.ceil, floor, anchors, spikes: deep.spikes, rng: 0 };
  const startIndex = anchors.findIndex((a) => a.x >= START_X);
  const metreX = (m: number) => START_X + m * METRE;
  const nearHazard = (x0: number, x1: number) =>
    jets.some((j) => j.x > x0 - 90 * FP && j.x < x1 + 90 * FP) ||
    rocks.some((r) => r.x > x0 - 70 * FP && r.x < x1 + 70 * FP);

  // Sections: the first anchor from each section's metre whose span is clear of jets and loose stalactites (ceiling spikes are in the proofs).
  const ledges: SwingLedge[] = [];
  const spans: [number, number][] = [];
  SWING_SECTION_FROM_M.forEach((from, section) => {
    let starts = 0;
    for (let i0 = anchors.findIndex((a) => a.x >= metreX(from)); i0 > startIndex && i0 + SWING_SECTION_LEDGES + 3 < anchors.length; i0++) {
      if (anchors[i0]!.x > metreX(from + 45) || starts >= SECTION_STARTS) break;
      const x0 = anchors[i0 - 1]!.x;
      const x1 = anchors[i0 + SWING_SECTION_LEDGES + 2]!.x;
      if (nearHazard(x0, x1)) continue;
      starts += 1;
      const built = buildSection(course, i0, section, draw);
      if (!built) continue;
      ledges.push(...built);
      spans.push([x0 - 40 * FP, x1 + 40 * FP]);
      break;
    }
  });
  const inSection = (x: number) => spans.some(([a, b]) => x >= a && x <= b);
  const clearOf = ([x, y]: [number, number], gap: number) =>
    anchors.every((a) => Math.abs(a.x - x) > STAR_CLEAR_OF_ANCHOR || Math.abs(a.y - y) > STAR_CLEAR_OF_ANCHOR) &&
    jets.every((jet) => Math.abs(jet.x - x) > SWING_JET_HALF_W + gap) &&
    rocks.every((r) => Math.abs(r.x - x) > SWING_ROCK_HALF_W + gap) &&
    starSpots.every(([sx, sy]) => Math.abs(sx - x) > 45 * FP || Math.abs(sy - y) > 45 * FP) &&
    !inSection(x);
  const lineCache = new Map<number, Line[]>();
  const linesAt = (j: number) => {
    let lines = lineCache.get(j);
    if (!lines) lineCache.set(j, (lines = provedLines(course, j, 6)));
    return lines;
  };
  const gapAt = (x: number) => anchors.findIndex((a) => a.x > x);
  /** The k-th of n evenly spread aims over [from, to] metres with the sections' spans left out. */
  const freeAim = (k: number, n: number, from: number, to: number) => {
    const cuts = spans.filter(([a, b]) => b > metreX(from) && a < metreX(to)).sort((p, q) => p[0] - q[0]);
    const pieces: [number, number][] = [];
    let at = metreX(from);
    for (const [a, b] of cuts) {
      if (a > at) pieces.push([at, a]);
      at = Math.max(at, b);
    }
    if (metreX(to) > at) pieces.push([at, metreX(to)]);
    const total = pieces.reduce((sum, [a, b]) => sum + (b - a), 0);
    let left = Math.trunc(((2 * k + 1) * total) / (2 * n));
    for (const [a, b] of pieces) {
      if (left <= b - a) return a + left;
      left -= b - a;
    }
    return metreX(to);
  };

  // High-route gems: the highest proved flight point near each aim (aims spread over 40–480 m outside the sections).
  const gems: [number, number][] = [];
  for (let k = 0; k < SWING_GEMS; k++) {
    const aim = freeAim(k, SWING_GEMS, 40, 480) + (draw(41) - 20) * FP;
    const ahead = gapAt(aim);
    let best: [number, number] | null = null;
    for (const j of [0, 1, -1, 2, -2].map((d) => ahead + d).filter((j) => j > startIndex && j + 1 < anchors.length)) {
      for (const line of linesAt(j))
        for (const p of line.flight)
          if (Math.abs(p[0] - aim) <= 140 * FP && clearOf(p, SWING_GEM_TOUCH) && gems.every(([gx]) => Math.abs(gx - p[0]) > 80 * FP) && (!best || p[1] < best[1])) best = p;
      if (best) break;
    }
    if (best) gems.push(best);
  }
  gems.sort((p, q) => p[0] - q[0]);

  // Low-route speed gates: under an anchor near each aim (50–470 m outside the sections), the opening around the deepest proved fast swing.
  const gates: SwingGate[] = [];
  for (let k = 0; k < SWING_GATES; k++) {
    const aim = freeAim(k, SWING_GATES, 50, 470);
    const ahead = gapAt(aim);
    let made: SwingGate | null = null;
    for (const j of [0, 1, -1, 2, -2, 3].map((d) => ahead + d).filter((j) => j > startIndex + 1 && j + 1 < anchors.length)) {
      const a = anchors[j]!;
      if (inSection(a.x) || nearHazard(a.x - 40 * FP, a.x + 40 * FP) || gates.some((g) => Math.abs(g.x - a.x) < 400 * FP)) continue;
      // The deepest crossing of x = a.x at gate speed on the proved swings through j.
      let deepest = -1;
      for (const line of linesAt(j)) {
        const pts = line.swing;
        for (let n = 1; n < pts.length; n++) {
          const [x0, y0] = pts[n - 1]!;
          const [x1, y1] = pts[n]!;
          if (!(x0 < a.x && x1 >= a.x)) continue;
          const dx = x1 - x0;
          const dy = y1 - y0;
          if (dx * dx + dy * dy < SWING_GATE_SPEED * SWING_GATE_SPEED * FP * FP) continue;
          const y = y0 + Math.trunc((dy * (a.x - x0)) / dx);
          if (y > deepest) deepest = y;
        }
      }
      if (deepest < 0 || deepest < a.y + 110 * FP) continue;
      made = { x: a.x, y0: deepest - 40 * FP, y1: Math.min(deepest + 40 * FP, lerpAt(floor, a.x) - 90 * FP) };
      break;
    }
    if (made) gates.push(made);
  }
  gates.sort((p, q) => p.x - q.x);

  const v12: SwingState = {
    ...deep,
    tuned: 1,
    starAnchors: [],
    starSpots,
    rocks,
    tunec: 1,
    spread: 1,
    worldH: SWING_V12_H,
    expand: 1,
    worldW: SWING_V12_W,
    camX: deep.x - SWING_LEAD_V12,
    ledges,
    ledgeOn: -1,
    ledgeTicks: ledges.map(() => 0),
    chain: 0,
    lastGrabX: anchors[deep.rope]!.x,
    comboPts: 0,
    bestChain: 0,
    gems,
    gemsTaken: 0,
    gates,
    gatesLit: 0,
  };
  if (v12Cache.size > 16) v12Cache.clear();
  v12Cache.set(seed | 0, v12);
  return { ...v12, rocks: v12.rocks!.map((r) => ({ ...r })) };
}

/** swingRev 12: the expansion. Band 3 like rev 11, so shared readers stay on strict curves; the score is swingScoreV12. */
export const swingExpandGame: typeof swingGame = { ...swingTunecGame, init: (seed) => ({ ...bandInit(initV12(seed)), band: 3 }) };
