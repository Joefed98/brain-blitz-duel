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
import { bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";
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
  if (input !== null && input.k === SWING_INPUT_HOLD) {
    if (input.a === 1) {
      const target = nearestAhead(s.anchors, s, 0);
      if (target >= 0) {
        if (s.rope >= 0) detach(s, s.anchors[s.rope]!);
        attach(s, target, s.anchors[target]!);
        s.grabTick = tick;
        // swingRev 4: grabbing a star anchor takes its star (once).
        if (s.starAnchors && s.starAnchors.includes(target) && !(s.starsTaken ?? []).includes(target)) {
          s.starsTaken = [...(s.starsTaken ?? []), target];
          s.stars = (s.stars ?? 0) + 1;
        }
      }
    } else if (s.rope >= 0) detach(s, s.anchors[s.rope]!);
  } else if (input !== null && input.k === SWING_INPUT_REEL) {
    startReel(s, clampInt(input.a, 0, 1));
  }
  let dead = moveBody(s, s);
  s.camX = s.x - LEAD;
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
    // swingRev 8 only, last.
    if (state.spread) values.push(state.spread);
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
  const units = Math.min(SWING_FINISH_M, swingMetres(state)) + 5 * clampInt(state.stars ?? 0, 0, SWING_STARS);
  const finished = swingMetres(state) >= SWING_FINISH_M;
  return { units, points: bandPoints(state.tunec ? SWING_V7_BAND_CURVE : SWING_BAND_CURVE, units), bonus: finished ? BAND_FINISH_BONUS : 0, penalty: 0, finished, text: `${Math.min(SWING_FINISH_M, swingMetres(state))} m · ${state.stars ?? 0} stars`, bonusText: "Reached 500 m" };
}

function scoreBand(state: SwingState): number {
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
