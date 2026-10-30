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
   * swingRev 13 only (the expansion, absent on every earlier round): the marker, the wider world, the
   * ledges (set-route sections) and which one the hero stands on, each ledge's first landing tick,
   * the swing chain, the high-route gems and the speed gates (see "swingRev 13" below).
   */
  expand?: number;
  worldW?: number;
  ledges?: SwingLedge[];
  ledgeOn?: number;
  ledgeTicks?: number[];
  /** swingRev 13: each set-route section's par time in ticks, from the course alone (0: no such section). */
  pars?: number[];
  /** A press made while walking to a ledge's centre, held until the hero gets there (1). */
  ledgeHold?: number;
  chain?: number;
  lastGrabX?: number;
  comboPts?: number;
  /** swingRev 13: combo tiers reached (each 5, 10 or 15 links into a chain). */
  comboTiers?: number;
  bestChain?: number;
  gems?: [number, number][];
  gemsTaken?: number;
  gates?: SwingGate[];
  gatesLit?: number;
  /**
   * swingRev 14 only (the assault course, absent on every earlier round): the marker, the sections (each a start
   * ledge, one or two hooks and the landing ledge, `ledges[k]` and `ledges[k + 1]`), the two squeezes, the section the
   * hero is on, when it started, each section's clear tick, the furthest x reached in it, restarts, the respawn hold,
   * the last miss and what was taken in the attempt so far (`bank*`: what an attempt started with, restored on a miss).
   */
  assault?: number;
  sections?: SwingSection[];
  squeezes?: SwingSqueeze[];
  sec?: number;
  secStart?: number;
  secTicks?: number[];
  secReach?: number;
  restarts?: number;
  respawn?: number;
  missTick?: number;
  bankGems?: number;
  bankGates?: number;
  bankStars?: number[];
  /** swingRev 14: times the dragon caught the hero (each a restart). */
  caught?: number;
  /** swingRev 15 only (the swinging course): the marker, and the stretch the dragon appears at (the last quarter). */
  rework?: number;
  chaseFrom?: number;
  /** swingRev 15: the hook a miss on a swinging stretch puts the hero back on (the last one of the stretch held; -1: its start ledge). */
  hangHook?: number;
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
  // swingRev 14 and 15: the assault course and the swinging course have their own rules (below); every earlier revision steps on here.
  if (state.rework) return stepRework(state, input);
  if (state.assault) return stepAssault(state, input);
  const tick = state.tick + 1;
  const s: SwingState = { ...state, tick };
  // swingRev 13 (the expansion): standing on a ledge, only the walk to its centre and a press (a kick off it) move the body.
  const expand = s.expand === 1;
  const px = s.x;
  const py = s.y;
  let standing = expand && (s.ledgeOn ?? -1) >= 0;
  if (standing && expand13LedgeGone(s, s.ledgeOn!, tick)) {
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
        // swingRev 13: the speed the grab is made at (flying only) counts for the swing chain.
        const flying = s.rope < 0 && !standing;
        if (s.rope >= 0) detach(s, s.anchors[s.rope]!);
        if (expand) expand13NoteGrab(s, target, tick, flying ? s.vx * s.vx + s.vy * s.vy : 0);
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
  // swingRev 13: a landing, gems and gates first, then the camera.
  if (expand && !dead && !standing) expand13Move(s, px, py, tick);
  s.camX = s.x - (expand ? SWING_LEAD_V13 : LEAD);
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
  if (state.rework) return swingScoreV15(state);
  if (state.assault) return swingScoreV14(state);
  if (state.expand) return swingScoreV13(state);
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
    ...(s.assault ? swingAssaultCounts(s) : {}),
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
    // swingRev 13: the expansion's state, after every earlier value.
    if (state.expand) values.push(state.expand, state.ledgeOn ?? -1, state.ledgeHold ?? 0, state.chain ?? 0, state.comboPts ?? 0, state.gemsTaken ?? 0, state.gatesLit ?? 0, ...(state.ledgeTicks ?? []), state.comboTiers ?? 0);
  }
  // swingRev 14 (the assault course, which carries no `rev`): its own state, after every earlier value.
  if (state.assault) values.push(state.assault, state.sec ?? 0, state.secStart ?? 0, state.secReach ?? 0, state.ledgeOn ?? -1, state.ledgeHold ?? 0, state.respawn ?? 0, state.restarts ?? 0, state.gemsTaken ?? 0, state.gatesLit ?? 0, state.stars ?? 0, state.chaseX ?? 0, state.chaseY ?? 0, state.caught ?? 0, ...(state.secTicks ?? []));
  // swingRev 15 (the swinging course): its marker and the rope length, after every rev-14 value.
  if (state.rework) values.push(state.rework, state.len, state.bankGems ?? 0, state.bankGates ?? 0, (state.bankStars ?? []).length, state.hangHook ?? -1);
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
  if (rev === SWING_REV_REWORK) return swingReworkGame;
  if (rev === SWING_REV_ASSAULT) return swingAssaultGame;
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
  if (state.rework) return swingBandPartsV15(state);
  if (state.assault) return swingBandPartsV14(state);
  if (state.expand) return swingBandPartsV13(state);
  const units = Math.min(SWING_FINISH_M, swingMetres(state)) + 5 * clampInt(state.stars ?? 0, 0, SWING_STARS);
  const finished = swingMetres(state) >= SWING_FINISH_M;
  return { units, points: bandPoints(bandCurveOf(state, state.worldH ? SWING_V9_BAND_CURVE : state.tunec ? SWING_V7_BAND_CURVE : SWING_BAND_CURVE), units), bonus: finished ? BAND_FINISH_BONUS : 0, penalty: 0, finished, text: `${Math.min(SWING_FINISH_M, swingMetres(state))} m · ${state.stars ?? 0} stars`, bonusText: "Reached 500 m" };
}

function scoreBand(state: SwingState): number {
  if (state.rework) return swingScoreV15(state);
  if (state.assault) return swingScoreV14(state);
  if (state.expand) return swingScoreV13(state);
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
  // swingRev 13 carries its own (taller) height in worldH as well.
  return state.worldH ?? SWING_WORLD_H;
}
/** The world height (px) a stored round's swingRev plays in. */
export function swingWorldHFor(rev?: number | null): number {
  if (rev === SWING_REV_EXPAND || rev === SWING_REV_ASSAULT || rev === SWING_REV_REWORK) return SWING_V13_H;
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

/* ================= The expansion (swingRev 13, 25 Oct 2026) ================= */

/**
 * swingRev 13 (world expansion and depth, docs/expansions/e7.md; the round's maximum is 200,
 * src/lib/duel/roundMax.ts). Every rule below is gated on the state's `expand` marker, so every
 * earlier revision plays and scores exactly as before.
 *
 *  - More world: a 450 × 844 view (SWING_V13_W × SWING_V13_H, the box's shape on an iPhone 11), the
 *    lava SWING_V13_DROP below rev 8's (each jet's top where it was), the hero 225 px from the left.
 *    The ceiling, anchors, ceiling spikes, stalactites, dragon and every course draw are rev 9's; the
 *    ten touch stars are re-proved on the deeper cavern (spreadSpots).
 *  - High and low routes: above the anchor line, SWING_GEMS gold gems sit at the tops of proved flights
 *    (a high route: strong releases close under the ceiling); below it, SWING_GATES speed gates hang
 *    under anchors, their openings around the deepest proved fast swing (a low route: grab early for a
 *    long rope and swoop through at SWING_GATE_SPEED or faster). A gate lights on any forward pass
 *    through its opening at that speed; neither ever ends a run.
 *  - Swing combos: a flying grab of an anchor further ahead at SWING_COMBO_SPEED or faster, within
 *    SWING_COMBO_GAP ticks of the last grab, adds one to the chain (a fast grab after a slow one starts
 *    a new chain at 1; a slow grab, a grab from a ledge or a landing ends it). A chain reaching 5, 10
 *    and 15 links pays 2, 3 and 5 combo points (SWING_COMBO_TIERS).
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
export const SWING_REV_EXPAND = 13;
export const SWING_V13_W = 450;
export const SWING_V13_H = 844;
/** How far the rev-13 lava (and each jet's base) sits below rev 8's, 1/256 px. */
export const SWING_V13_DROP = (SWING_V13_H - SWING_WORLD_H) * FP;
export const SWING_LEAD_V13 = 225 * FP;
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
/** The chain length shown gold in the HUD (the first combo tier). */
export const SWING_COMBO_EVERY = 5;
/**
 * Combo tiers (swingRev 13, 26 Oct 2026 phase 1): a chain that reaches 5, 10 and 15 fast regrabs pays 2, 3 and 5 raw
 * skill points at each tier reached (10 for a full 15-link chain), counted per chain, capped by SWING_COMBO_CAP.
 * Achievable chains for a strong human, where the old "a point every fifth link" needed 25+ in a row to matter.
 */
export const SWING_COMBO_TIERS = [5, 10, 15] as const;
export const SWING_COMBO_TIER_PAY = [2, 3, 5] as const;
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
/**
 * The features' raw skill points (before the pay scale): combo points (at most SWING_COMBO_CAP), a point a gem and a
 * point a lit gate, SWING_LEDGE_POINTS shared by the ledges landed and SWING_PAR_POINTS shared by the sections'
 * par times (however many sections a course has, two or three).
 */
export const SWING_COMBO_CAP = 10;
export const SWING_LEDGE_POINTS = 15;
export const SWING_PAR_POINTS = 25;
/**
 * Par times (swingRev 13's new precision feature): each section's par is its proved route's time (the course's own,
 * found when the section was built: every hop's proved release with the press on the tick after each landing, plus
 * SWING_PAR_START_WALK for the longest walk to the start ledge's centre) plus SWING_PAR_MARGIN. A section cleared
 * (every ledge landed) with its flag landed under par pays its share of SWING_PAR_POINTS scaled by the margin it
 * was beaten by, the full share from SWING_PAR_FULL ticks under par: so within SWING_PAR_MARGIN − SWING_PAR_FULL
 * ticks of the proved route. Nothing in it reads how a player has played: par is fixed when the course is built.
 */
export const SWING_PAR_START_WALK = 9;
export const SWING_PAR_MARGIN = 48;
export const SWING_PAR_FULL = 36;
/**
 * The pay scale (raw skill points → paid, at most SWING_FEATURE_CAP), Breaker's rising shape (BRK_V9_SKILL_PAY):
 * light use pays little, the full 50 only near everything a course guarantees (SWING_GUARANTEED_RAW).
 */
export const SWING_SKILL_PAY = bandCurve([0, 10, 20, 26, 34, 42, 46], [0, 4, 12, 20, 28, 38, 50]);
export const SWING_FEATURE_CAP = 50;
export const SWING_V13_MAX = 200;
/**
 * The base part of a rev-13 score (metres + 5 a star, as every band revision): 140 at 500 m with three of the ten
 * stars (515 units; 26 Oct 2026: all ten were needed, which no human-paced run managed), plus 10 for
 * reaching 500 m, so it tops out at 150 as rev 11 does. The knots were fitted (26 Oct 2026) by matching the weak,
 * average and good skill-band players' unit quantiles on rev 13 to their scores on rev 11 on the same bank courses
 * (60 each, paired), so players who ignore the features keep today's score (docs/expansions/x200-swing.md).
 */
export const SWING_V13_BAND_CURVE = bandCurve([0, 20, 40, 60, 75, 95, 120, 170, 245, 315, 440, 489, 500, 515], [0, 19, 36, 50, 64, 82, 91, 99, 110, 122, 130, 133, 135, 140]);

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

/** True once a collapsing ledge has given way (rev 13). */
export function expand13LedgeGone(s: Pick<SwingState, "ledges" | "ledgeTicks">, i: number, tick: number): boolean {
  const ledge = s.ledges?.[i];
  if (!ledge || !ledge.crumble) return false;
  const first = s.ledgeTicks?.[i] ?? 0;
  return first > 0 && tick - first >= SWING_LEDGE_CRUMBLE;
}

function expand13NoteGrab(s: SwingState, target: number, tick: number, speed2: number): void {
  const a = s.anchors[target]!;
  const forward = a.x > (s.lastGrabX ?? 0);
  const fast = forward && speed2 >= SWING_COMBO_SPEED * SWING_COMBO_SPEED * FP * FP;
  const chain = s.chain ?? 0;
  if (fast && chain > 0 && tick - s.grabTick <= SWING_COMBO_GAP) s.chain = chain + 1;
  else s.chain = fast ? 1 : 0;
  if (forward) s.lastGrabX = a.x;
  if (s.chain > (s.bestChain ?? 0)) s.bestChain = s.chain;
  const tier = (SWING_COMBO_TIERS as readonly number[]).indexOf(s.chain);
  if (tier >= 0) {
    s.comboPts = (s.comboPts ?? 0) + SWING_COMBO_TIER_PAY[tier]!;
    s.comboTiers = (s.comboTiers ?? 0) + 1;
  }
}

/** One tick of rev-13 pickups after the body moved from (px, py): a ledge landing, gems, gates. */
function expand13Move(s: SwingState, px: number, py: number, tick: number): void {
  if (s.rope < 0 && s.vy > 0 && s.ledges) {
    for (let i = 0; i < s.ledges.length; i++) {
      const l = s.ledges[i]!;
      if (Math.abs(s.x - l.x) > l.half || expand13LedgeGone(s, i, tick)) continue;
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

/** The rev-13 feature counts (reveal lines, effects, the score). */
export function swingFeatureCounts(s: SwingState) {
  const landed = (i: number) => (s.ledgeTicks?.[i] ?? 0) > 0;
  const ledges = (s.ledges ?? []).filter((_, i) => landed(i)).length;
  const sectionIds = [...new Set((s.ledges ?? []).map((l) => l.section))];
  const sections = sectionIds.filter((k) => (s.ledges ?? []).every((l, i) => l.section !== k || landed(i))).length;
  const pars = sectionIds.map((k) => swingSectionPar(s, k));
  return {
    parsBeaten: pars.filter((p) => p.beat > 0).length,
    parBeat: pars.reduce((sum, p) => sum + Math.min(SWING_PAR_FULL, Math.max(0, p.beat)), 0),
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

/** The feature points of a rev-13 run (0…50) and their parts. */
export function swingFeaturePoints(s: SwingState) {
  const c = swingFeatureCounts(s);
  const combo = Math.min(SWING_COMBO_CAP, c.comboPts);
  const ledgePts = c.ledgeTotal ? Math.trunc((SWING_LEDGE_POINTS * c.ledges) / c.ledgeTotal) : 0;
  const parPts = c.sectionTotal ? Math.trunc((SWING_PAR_POINTS * c.parBeat) / (SWING_PAR_FULL * c.sectionTotal)) : 0;
  const raw = combo + c.gems + c.gates + ledgePts + parPts;
  const total = Math.min(SWING_FEATURE_CAP, bandPoints(SWING_SKILL_PAY, raw));
  return { ...c, combo, ledgePts, parPts, raw, total };
}

/** The raw skill points every rev-13 course guarantees a perfect player (no combos counted): gems, gates, ledges, pars. */
export const SWING_GUARANTEED_RAW = SWING_GEMS + SWING_GATES + SWING_LEDGE_POINTS + SWING_PAR_POINTS;

/**
 * Section k's par (rev 13): its par in ticks, the start and flag ledges' first landings, the time between them once
 * the section is cleared (every ledge landed, the flag after the start; else -1) and how far under par that was
 * (ticks; ≤ 0 is not under par).
 */
export function swingSectionPar(s: Pick<SwingState, "ledges" | "ledgeTicks" | "pars">, k: number): { par: number; start: number; flag: number; time: number; beat: number } {
  const par = s.pars?.[k] ?? 0;
  let start = 0;
  let flag = 0;
  let cleared = true;
  (s.ledges ?? []).forEach((l, i) => {
    if (l.section !== k) return;
    const t = s.ledgeTicks?.[i] ?? 0;
    if (t <= 0) cleared = false;
    if (l.kind === 0) start = t;
    if (l.kind === 2) flag = t;
  });
  const time = cleared && par > 0 && start > 0 && flag > start ? flag - start : -1;
  return { par, start, flag, time, beat: time >= 0 ? par - time : 0 };
}

/**
 * The section whose par clock is running (rev 13, display only): its start ledge landed, its flag not yet, every one
 * of its ledges the hero has passed landed on (so the par can still be won) and the hero not past its flag. Null otherwise.
 */
export function swingRunningSection(s: SwingState): { section: number; par: number; elapsed: number } | null {
  for (const k of new Set((s.ledges ?? []).map((l) => l.section))) {
    const p = swingSectionPar(s, k);
    if (p.par <= 0 || p.start <= 0 || p.flag > 0) continue;
    const mine = (s.ledges ?? []).map((l, i) => ({ l, i })).filter(({ l }) => l.section === k);
    const flag = mine.find(({ l }) => l.kind === 2)!.l;
    if (s.x > flag.x + flag.half + 60 * FP) continue;
    if (mine.some(({ l, i }) => l.x + l.half < s.x - 40 * FP && !((s.ledgeTicks?.[i] ?? 0) > 0))) continue;
    return { section: k, par: p.par, elapsed: s.tick - p.start };
  }
  return null;
}

/** The effect pop for the latest section finished under par: "−0.8 s · PAR". */
export function swingParLabel(s: SwingState): string {
  let best: { flag: number; beat: number } | null = null;
  for (const k of new Set((s.ledges ?? []).map((l) => l.section))) {
    const p = swingSectionPar(s, k);
    if (p.beat > 0 && (!best || p.flag > best.flag)) best = p;
  }
  return best ? `−${(best.beat / 60).toFixed(1)} s UNDER PAR` : "UNDER PAR";
}

export function swingBandPartsV13(state: SwingState): BandParts {
  const metres = Math.min(SWING_FINISH_M, swingMetres(state));
  const units = metres + 5 * clampInt(state.stars ?? 0, 0, SWING_STARS);
  const finished = swingMetres(state) >= SWING_FINISH_M;
  const f = swingFeaturePoints(state);
  const words = `skill +${f.total} (${f.raw} skill points: combos ${f.combo} · gems ${f.gems} · gates ${f.gates} · ledges ${f.ledgePts} · par ${f.parPts})`;
  return {
    units,
    points: bandPoints(SWING_V13_BAND_CURVE, units),
    bonus: (finished ? BAND_FINISH_BONUS : 0) + f.total,
    penalty: 0,
    finished,
    text: `${metres} m · ${state.stars ?? 0} stars`,
    bonusText: finished ? `Reached 500 m +${BAND_FINISH_BONUS} · ${words}` : words,
  };
}

export function swingScoreV13(state: SwingState): number {
  return bandTotal(swingBandPartsV13(state), Boolean(state.acted), SWING_V13_MAX);
}

/** The world width (px) a state plays in: swingRev 13's wider view, or 390. */
export function swingWorldW(state: { worldW?: number }): number {
  return state.worldW ?? SWING_WORLD_W;
}
/** The world width (px) a stored round's swingRev plays in. */
export function swingWorldWFor(rev?: number | null): number {
  return rev === SWING_REV_EXPAND || rev === SWING_REV_ASSAULT || rev === SWING_REV_REWORK ? SWING_V13_W : SWING_WORLD_W;
}
/**
 * The height (px) a stored round's reveal and demo draw at in the shared 390-wide reveal box: the
 * world's own height, or for swingRev 13's 450-wide view the height that keeps its shape (731).
 */
export function swingRevealHFor(rev?: number | null): number {
  return rev === SWING_REV_EXPAND || rev === SWING_REV_ASSAULT || rev === SWING_REV_REWORK ? Math.round((SWING_V13_H * SWING_WORLD_W) / SWING_V13_W) : swingWorldHFor(rev);
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

/** The ticks a hero walking from x to a ledge's centre takes before a press can kick off it (at least the tick after landing). */
function walkTicks(x: number, centre: number): number {
  return Math.max(1, Math.ceil(Math.abs(x - centre) / SWING_LEDGE_WALK));
}

/**
 * swingRev 13: a section's fastest route, the course's own witness time behind its par. Each hop kicks off a ledge's
 * centre (as every kick in the game does) and lets go on the release whose flight comes down first on the next
 * ledge of the section (the game's landing test, no other ledge of the section caught first, nothing hit), counting
 * the walk from that landing to the next ledge's centre; the hops add up, plus the longest walk on the start ledge
 * (SWING_PAR_START_WALK + 1). Collapsing ledges never give way inside the fastest route (it stands on each for at
 * most a walk). Null when a hop has no landing release (never on a built section: each ledge sits on one).
 */
function sectionWitness(c: Course, ledges: SwingLedge[]): number | null {
  let total = SWING_PAR_START_WALK + 1;
  for (let k = 0; k + 1 < ledges.length; k++) {
    const from = ledges[k]!;
    const to = ledges[k + 1]!;
    const at: [number, number] = [from.x, from.top - RADIUS];
    const j = nearestAhead(c.anchors, restBody(at[0], at[1]), 0);
    if (j < 0) return null;
    const rope = kickedFrom(c, at, j);
    if (moveBody(rope, c)) return null;
    const last = k + 2 === ledges.length;
    let best = Infinity;
    // r: ticks on the rope after the press tick's move; the let-go is the tick after.
    for (let r = 0; r < 420 && r + 1 < best; r++) {
      const fly = { ...rope };
      detach(fly, c.anchors[j]!);
      for (let t = 0; t < 110; t++) {
        const py = fly.y;
        if (moveBody(fly, c)) break;
        if (fly.vy <= 0) continue;
        const hit = ledges.findIndex((l, i) => i > k && Math.abs(fly.x - l.x) <= l.half && py + RADIUS <= l.top && fly.y + RADIUS >= l.top);
        if (hit < 0) continue;
        if (hit === k + 1) best = Math.min(best, r + 1 + t + (last ? 0 : walkTicks(fly.x, to.x)));
        break;
      }
      if (moveBody(rope, c)) break;
    }
    if (best === Infinity) return null;
    total += best;
  }
  return total;
}

const v13Cache = new Map<number, SwingState>();
function initV13(seed: number): SwingState {
  const cached = v13Cache.get(seed | 0);
  if (cached) return { ...cached, rocks: cached.rocks!.map((r) => ({ ...r })) };
  const v4 = initV4(seed);
  const floor = v4.floor.map((y) => y + SWING_V13_DROP);
  const jets = (v4.jets ?? []).map((jet) => ({ ...jet, h: jet.h + SWING_V13_DROP }));
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
  /** swingRev 13: each section's par in ticks (0 for a section the course has no room for). */
  const pars = SWING_SECTION_FROM_M.map(() => 0);
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
      // swingRev 13's par: the section's fastest route plus the margin (built from the course alone).
      const witness = sectionWitness(course, built);
      pars[section] = witness === null ? 0 : witness + SWING_PAR_MARGIN;
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

  const v13: SwingState = {
    ...deep,
    tuned: 1,
    starAnchors: [],
    starSpots,
    rocks,
    tunec: 1,
    spread: 1,
    worldH: SWING_V13_H,
    expand: 1,
    worldW: SWING_V13_W,
    camX: deep.x - SWING_LEAD_V13,
    ledges,
    pars,
    ledgeOn: -1,
    ledgeTicks: ledges.map(() => 0),
    chain: 0,
    lastGrabX: anchors[deep.rope]!.x,
    comboPts: 0,
    comboTiers: 0,
    bestChain: 0,
    gems,
    gemsTaken: 0,
    gates,
    gatesLit: 0,
  };
  if (v13Cache.size > 16) v13Cache.clear();
  v13Cache.set(seed | 0, v13);
  return { ...v13, rocks: v13.rocks!.map((r) => ({ ...r })) };
}

/** swingRev 13: the expansion. Band 3 like rev 11, so shared readers stay on strict curves; the score is swingScoreV13. */
export const swingExpandGame: typeof swingGame = { ...swingTunecGame, init: (seed) => ({ ...bandInit(initV13(seed)), band: 3 }) };

/* ================= The assault course (swingRev 14, 27 Oct 2026) ================= */

/**
 * swingRev 14 (docs/grappler-assault-oct-2026.md): Grappler as a tactical assault course. Every rule below is gated
 * on the state's `assault` marker, so every earlier revision plays and scores exactly as before. The course is its
 * own (it shares the rope physics, the world size of swingRev 13 and nothing else): SWING_V14_SECTIONS sections in
 * a row, each a small decision built and proved from the seed alone, the same for every player.
 *
 *  - A section is a start ledge, one or two hooks and a landing ledge (the next section's start): the hero kicks
 *    off the start ledge on to the section's first hook (a press), swings, lets go and lands. Only the section's
 *    own hooks can be grabbed (the nearest of them within reach). A two-hook section catches its second hook in
 *    flight. A squeeze (two a course) closes the cave's roof and floor to a narrow opening: one hook before it,
 *    one behind it; fly through the gap, catch the far hook, swing on to the landing ledge.
 *  - A miss (the lava, or a squeeze's rock) puts the hero back on the section's start ledge (after a short
 *    SWING_V14_RESPAWN hold); the clock keeps running and what the attempt picked up is put back. No single miss
 *    ends the run (only the clock does): the dragon (from section SWING_V14_CHASE_FROM, SWING_V14_CHASE_PACE: 40 %
 *    slower than swingRev 4–13's) catching the hero is a restart too, and on every restart it backs off to at least
 *    SWING_V14_CHASE_BACKOFF behind the start ledge.
 *  - Speed gates (SWING_V14_GATES) sit on a one-hook section's flight line: a well-timed release passes through.
 *    Gems (SWING_V14_GEMS) sit on a late release's line, stars (SWING_V14_STARS) on a reeled-in swing's: never
 *    off-route, each proved to land.
 *  - Each section's par: its fastest proved route plus SWING_V14_PAR_MARGIN, fixed when the course is built.
 *  - Score: sections cleared (and the furthest point into the next) on SWING_V14_BAND_CURVE (to 120), 10 for the
 *    last section, up to SWING_V14_PAR_POINTS for pars and 3 a gate, gem or star: 200 at most.
 */
export const SWING_REV_ASSAULT = 14;
export const SWING_V14_SECTIONS = 36;
export const SWING_V14_SQUEEZES = 2;
export const SWING_V14_GATES = 4;
export const SWING_V14_GEMS = 4;
export const SWING_V14_STARS = 4;
/** Every ledge's half-width (the start ledge of section 0 included). */
export const SWING_V14_LEDGE_HALF = 30 * FP;
export const SWING_V14_RESPAWN = 24;
/** The dragon's pace: swingRev 4–13's 4 px a tick, 40 % slower. */
export const SWING_V14_CHASE_PACE = Math.trunc((SWING_CHASE_PACE * 3) / 5);
/** The dragon appears behind the hero when they start this section (0-based). */
export const SWING_V14_CHASE_FROM = 3;
/** On a restart the dragon is at least this far behind the start ledge. */
export const SWING_V14_CHASE_BACKOFF = 300 * FP;
/** The camera frames a section with its start ledge this far from the left edge. */
export const SWING_V14_CAM_LEFT = 70 * FP;
/** A gate lights on a forward pass through its opening at this speed or more (px a tick). */
export const SWING_V14_GATE_SPEED = 5;
/** A gate opening's half-height (1/256 px) around its flight line. */
export const SWING_V14_GATE_HALF = 22 * FP;
/** A squeeze's opening clears the planned flight by this much above and below the hero's body. */
const V14_SQUEEZE_CLEAR = 14 * FP;
export const SWING_V14_PICKUP_POINTS = 3;
export const SWING_V14_PAR_POINTS = 34;
/** Par = the fastest proved route + this margin (ticks); a section beaten by SWING_V14_PAR_FULL or more pays its whole share. */
export const SWING_V14_PAR_MARGIN = 45;
export const SWING_V14_PAR_FULL = 30;
/** The walk allowance on a start ledge in the par (ticks: a landing up to the ledge's half-width from its centre). */
export const SWING_V14_PAR_WALK = 5;
export const SWING_V14_MAX = 200;
/** Units: 10 a section cleared plus 0–9 for the furthest point into the next. */
export const SWING_V14_BAND_CURVE = bandCurve([0, 2, 20, 60, 120, 200, 280, 360], [0, 3, 14, 36, 64, 92, 110, 120]);

/** A section: kind (0 one hook, 1 two hooks, 2 squeeze), its first hook's index and hook count, its squeeze (-1: none) and par (ticks). */
export interface SwingSection {
  kind: number;
  hook0: number;
  hooks: number;
  sq: number;
  par: number;
  /** swingRev 15 only: the start and landing ledges (-1: it starts hanging from hook0 / ends by grabbing the next stretch's), and its span along the course (1/256 px). */
  from?: number;
  to?: number;
  x0?: number;
  x1?: number;
}

/** A squeeze: rock above `top` and below `bottom` for x in [x0, x1] (1/256 px). */
export interface SwingSqueeze {
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}

/** True when the hero's 10 px body (its box) touches a squeeze's rock. */
export function swingInSqueeze(sq: SwingSqueeze, x: number, y: number): boolean {
  return x + RADIUS > sq.x0 && x - RADIUS < sq.x1 && (y - RADIUS < sq.top || y + RADIUS > sq.bottom);
}

/** The nearest of section k's hooks within reach of (x, y), or -1. */
function assaultTarget(s: Pick<SwingState, "anchors" | "sections">, k: number, x: number, y: number): number {
  const sec = s.sections?.[k];
  if (!sec) return -1;
  let best = -1;
  let bestD = REACH * REACH;
  for (let i = sec.hook0; i < sec.hook0 + sec.hooks; i++) {
    const dx = s.anchors[i]!.x - x;
    const dy = s.anchors[i]!.y - y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** The section's start and landing ledges. */
export function swingAssaultLedges(s: Pick<SwingState, "ledges">, k: number): { from: SwingLedge; to: SwingLedge } {
  return { from: s.ledges![k]!, to: s.ledges![Math.min(k + 1, s.ledges!.length - 1)]! };
}

function bits(n: number): number {
  let c = 0;
  for (let b = n; b; b &= b - 1) c += 1;
  return c;
}

/** A miss: back to the section's start ledge, what the attempt picked up put back, the dragon held off. */
function assaultRestart(s: SwingState, tick: number): void {
  const k = s.sec ?? 0;
  const from = s.ledges![k]!;
  s.x = from.x;
  s.y = from.top - RADIUS;
  s.vx = 0;
  s.vy = 0;
  if (s.rope >= 0) s.rope = -1;
  s.reelLeft = 0;
  s.om = 0;
  s.ledgeOn = k;
  s.ledgeHold = 0;
  s.respawn = SWING_V14_RESPAWN;
  s.restarts = (s.restarts ?? 0) + 1;
  s.missTick = tick;
  s.gemsTaken = s.bankGems ?? 0;
  s.gatesLit = s.bankGates ?? 0;
  s.starsTaken = [...(s.bankStars ?? [])];
  s.stars = s.starsTaken.length;
  if ((s.chaseX ?? 0) !== 0) s.chaseX = Math.min(s.chaseX!, from.x - SWING_V14_CHASE_BACKOFF);
}

/** One tick of the assault course (swingRev 14). */
function stepAssault(state: SwingState, input: ArcadeInputEvent | null): SwingState {
  const tick = state.tick + 1;
  const s: SwingState = { ...state, tick };
  const total = s.sections!.length;
  const k = s.sec ?? 0;
  const px = s.x;
  const py = s.y;
  let standing = (s.ledgeOn ?? -1) >= 0;
  if ((s.respawn ?? 0) > 0) {
    // Back on the start ledge: held still for a moment; a press made now waits for the next one.
    s.respawn = s.respawn! - 1;
  } else {
    let press = input !== null && input.k === SWING_INPUT_HOLD && input.a === 1;
    if (standing) {
      // As swingRev 13: the hero walks to the ledge's centre first; a press on the way is held until they get there.
      const centre = s.ledges![s.ledgeOn!]!.x;
      if (s.x !== centre) s.x += clampInt(centre - s.x, -SWING_LEDGE_WALK, SWING_LEDGE_WALK);
      if (input !== null && input.k === SWING_INPUT_HOLD) s.ledgeHold = input.a === 1 ? 1 : 0;
      press = s.x === centre && s.ledgeHold === 1;
      if (press) s.ledgeHold = 0;
    }
    if (standing ? press : input !== null && input.k === SWING_INPUT_HOLD) {
      if (press) {
        const target = assaultTarget(s, k, s.x, s.y);
        if (target >= 0) {
          if (s.rope >= 0) detach(s, s.anchors[s.rope]!);
          attach(s, target, s.anchors[target]!);
          if (standing) {
            s.ledgeOn = -1;
            standing = false;
            kickOff(s);
          }
          s.grabTick = tick;
        }
      } else if (s.rope >= 0) detach(s, s.anchors[s.rope]!);
    } else if (input !== null && input.k === SWING_INPUT_REEL && !standing) {
      startReel(s, clampInt(input.a, 0, 1));
    }
  }
  let missed = false;
  if (!standing) {
    missed = moveBody(s, s);
    const sq = s.squeezes?.[s.sections![k]!.sq];
    if (!missed && sq && swingInSqueeze(sq, s.x, s.y)) missed = true;
  }
  let cleared = false;
  if (!missed && !standing) {
    // Landing: falling on to the section's start or landing ledge from above, off the rope.
    if (s.rope < 0 && s.vy > 0) {
      for (const i of [k + 1, k]) {
        const l = s.ledges![i]!;
        if (Math.abs(s.x - l.x) > l.half || !(py + RADIUS <= l.top && s.y + RADIUS >= l.top)) continue;
        s.y = l.top - RADIUS;
        s.vx = 0;
        s.vy = 0;
        s.ledgeHold = 0;
        s.ledgeOn = i;
        cleared = i === k + 1;
        break;
      }
    }
    // Pickups (put back on a miss): stars and gems by touch, gates on a fast forward pass through the opening.
    let taken = s.gemsTaken ?? 0;
    (s.gems ?? []).forEach(([gx, gy], i) => {
      const dx = s.x - gx;
      const dy = s.y - gy;
      if (!(taken & (1 << i)) && dx * dx + dy * dy <= SWING_GEM_TOUCH * SWING_GEM_TOUCH) taken |= 1 << i;
    });
    s.gemsTaken = taken;
    (s.starSpots ?? []).forEach(([sx, sy], i) => {
      if ((s.starsTaken ?? []).includes(i)) return;
      const dx = s.x - sx;
      const dy = s.y - sy;
      if (dx * dx + dy * dy <= SWING_STAR_TOUCH * SWING_STAR_TOUCH) {
        s.starsTaken = [...(s.starsTaken ?? []), i];
        s.stars = s.starsTaken.length;
      }
    });
    let lit = s.gatesLit ?? 0;
    const dx = s.x - px;
    const dy = s.y - py;
    const fast = dx * dx + dy * dy >= SWING_V14_GATE_SPEED * SWING_V14_GATE_SPEED * FP * FP;
    (s.gates ?? []).forEach((g, i) => {
      if (lit & (1 << i) || !(px < g.x && s.x >= g.x)) return;
      const y = py + Math.trunc((dy * (g.x - px)) / dx);
      if (fast && y >= g.y0 && y <= g.y1) lit |= 1 << i;
    });
    s.gatesLit = lit;
  }
  if (s.x > s.maxX) s.maxX = s.x;
  if (s.x > (s.secReach ?? 0)) s.secReach = s.x;
  if (missed) assaultRestart(s, tick);
  else if (cleared) {
    const ticks = [...s.secTicks!];
    ticks[k] = tick;
    s.secTicks = ticks;
    s.sec = k + 1;
    s.secStart = tick;
    s.secReach = s.x;
    s.bankGems = s.gemsTaken ?? 0;
    s.bankGates = s.gatesLit ?? 0;
    s.bankStars = [...(s.starsTaken ?? [])];
  }
  const sec = s.sec ?? 0;
  // The dragon: appears behind the hero as they start section SWING_V14_CHASE_FROM, then flies at its pace.
  if ((s.chaseX ?? 0) === 0 && sec >= SWING_V14_CHASE_FROM && sec < total) {
    s.chaseX = s.x - SWING_CHASE_GAP;
    s.chaseY = s.y;
  } else if ((s.chaseX ?? 0) !== 0 && sec < total) {
    s.chaseX = s.chaseX! + SWING_V14_CHASE_PACE;
    s.chaseY = s.chaseY! + clampInt(Math.trunc((s.y - s.chaseY!) / 4), -3 * FP, 3 * FP);
    // Caught: like a miss, back to the start ledge (the dragon held off behind it). Nothing ends a run but the clock.
    if (s.chaseX! + SWING_CHASE_REACH >= s.x - RADIUS) {
      s.caught = (s.caught ?? 0) + 1;
      assaultRestart(s, tick);
    }
  }
  // The camera frames the section (its start ledge SWING_V14_CAM_LEFT from the left), easing on to the next one and
  // never letting the hero leave the view.
  const frame = s.ledges![Math.min(sec, total - 1)]!.x - SWING_V14_CAM_LEFT;
  s.camX += Math.trunc((frame - s.camX) / 6);
  const w = (s.worldW ?? SWING_WORLD_W) * FP;
  if (s.x - s.camX > w - 40 * FP) s.camX = s.x - (w - 40 * FP);
  if (s.x - s.camX < 30 * FP) s.camX = s.x - 30 * FP;
  if (sec >= total || tick >= SWING_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** Sections cleared and the 0–9 tenths of the next one reached (its furthest x between its two ledges). */
export function swingAssaultProgress(s: SwingState): { cleared: number; partial: number } {
  const total = s.sections?.length ?? 0;
  const cleared = clampInt(s.sec ?? 0, 0, total);
  if (cleared >= total) return { cleared, partial: 0 };
  const { from, to } = swingAssaultLedges(s, cleared);
  const span = Math.max(1, to.x - from.x);
  return { cleared, partial: clampInt(Math.trunc((9 * ((s.secReach ?? from.x) - from.x)) / span), 0, 9) };
}

/** Section k's time (ticks from its start to its landing; -1 if not cleared) and how far under par it was. */
export function swingAssaultPar(s: Pick<SwingState, "sections" | "secTicks">, k: number): { par: number; time: number; beat: number } {
  const par = s.sections?.[k]?.par ?? 0;
  const end = s.secTicks?.[k] ?? 0;
  if (end <= 0) return { par, time: -1, beat: 0 };
  const start = k === 0 ? 0 : s.secTicks![k - 1]!;
  const time = end - start;
  return { par, time, beat: par - time };
}

/** The rev-14 counts (reveal lines, effects, the score). */
export function swingAssaultCounts(s: SwingState) {
  const total = s.sections?.length ?? 0;
  const pars = (s.sections ?? []).map((_, k) => swingAssaultPar(s, k));
  return {
    sections: clampInt(s.sec ?? 0, 0, total),
    sectionTotal: total,
    restarts: s.restarts ?? 0,
    caught: s.caught ?? 0,
    parsBeaten: pars.filter((p) => p.time >= 0 && p.beat > 0).length,
    parBeat: pars.reduce((sum, p) => sum + (p.time >= 0 ? clampInt(p.beat, 0, SWING_V14_PAR_FULL) : 0), 0),
    gems: bits(s.bankGems ?? 0),
    gemTotal: (s.gems ?? []).length,
    gates: bits(s.bankGates ?? 0),
    gateTotal: (s.gates ?? []).length,
    starsBanked: (s.bankStars ?? []).length,
    starTotal: (s.starSpots ?? []).length,
  };
}

/** Score parts (rev 14): sections on the curve, the last section's 10, pars and the pickups banked in cleared sections. */
export function swingBandPartsV14(state: SwingState): BandParts {
  const c = swingAssaultCounts(state);
  const p = swingAssaultProgress(state);
  const units = 10 * p.cleared + p.partial;
  const finished = c.sections >= c.sectionTotal && c.sectionTotal > 0;
  const parPts = c.sectionTotal ? Math.trunc((SWING_V14_PAR_POINTS * c.parBeat) / (SWING_V14_PAR_FULL * c.sectionTotal)) : 0;
  const pickups = SWING_V14_PICKUP_POINTS * (c.gates + c.gems + c.starsBanked);
  const words = `par +${parPts} (${c.parsBeaten} under) · gates ${c.gates} · gems ${c.gems} · stars ${c.starsBanked} +${pickups}`;
  return {
    units,
    points: bandPoints(SWING_V14_BAND_CURVE, units),
    bonus: (finished ? BAND_FINISH_BONUS : 0) + parPts + pickups,
    penalty: 0,
    finished,
    text: `Section ${c.sections} / ${c.sectionTotal}`,
    bonusText: finished ? `Course cleared +${BAND_FINISH_BONUS} · ${words}` : words,
  };
}

export function swingScoreV14(state: SwingState): number {
  return bandTotal(swingBandPartsV14(state), Boolean(state.acted), SWING_V14_MAX);
}

/** The par clock of the section running (display only): its par and the ticks since it started. */
export function swingAssaultClock(s: SwingState): { section: number; par: number; elapsed: number } | null {
  const k = s.sec ?? 0;
  const sec = s.sections?.[k];
  if (!sec || s.ended) return null;
  return { section: k, par: sec.par, elapsed: s.tick - (s.secStart ?? 0) };
}

/* ---- The course builder (rev 14) ---- */

interface V14Course {
  ceil: number[];
  floor: number[];
  spikes: Spike[];
  anchors: Anchor[];
}

/** A flight's outcome: the ledge it lands on (index into the list given) and the flight tick, or null (lava, rock, or still in the air). */
interface V14Landing {
  ledge: number;
  t: number;
  x: number;
}

/**
 * Flies a body already let go (no grabs) for up to n ticks, as the game's step does: move, the squeeze's rock and the
 * lava end it, a descending pass through a ledge's top within its half-width lands it. `path` collects each tick's body.
 */
function v14Fly(c: V14Course, b: Body, ledges: readonly SwingLedge[], sq: SwingSqueeze | null, n: number, path?: Body[]): V14Landing | null {
  for (let t = 1; t <= n; t++) {
    const py = b.y;
    if (moveBody(b, c) || (sq && swingInSqueeze(sq, b.x, b.y))) return null;
    path?.push({ ...b });
    if (b.vy <= 0) continue;
    for (let i = 0; i < ledges.length; i++) {
      const l = ledges[i]!;
      if (Math.abs(b.x - l.x) <= l.half && py + RADIUS <= l.top && b.y + RADIUS >= l.top) return { ledge: i, t, x: b.x };
    }
  }
  return null;
}

/** The body on its rope, tick by tick, for its first forward pass (bodies[0] is the body given; stops at the forward apex or a miss). */
function v14Pass(c: V14Course, b: Body, sq: SwingSqueeze | null, max = 160): Body[] {
  const out: Body[] = [{ ...b }];
  const body = { ...b };
  for (let r = 1; r <= max; r++) {
    if (moveBody(body, c) || (sq && swingInSqueeze(sq, body.x, body.y))) break;
    out.push({ ...body });
    if (body.om <= 0) break;
  }
  return out;
}

/** Lets go of the body at pass index r and flies it; the flight's path and landing (or null). */
function v14Release(c: V14Course, pass: readonly Body[], r: number, ledges: readonly SwingLedge[], sq: SwingSqueeze | null, n = 150, path?: Body[]): V14Landing | null {
  const b = { ...pass[r]! };
  detach(b, c.anchors[b.rope]!);
  return v14Fly(c, b, ledges, sq, n, path);
}

/** Where a flight comes down through the line y = top − RADIUS (descending), or null. */
function v14Crossing(path: readonly Body[], top: number): number | null {
  for (let t = 1; t < path.length; t++) {
    const a = path[t - 1]!;
    const b = path[t]!;
    if (b.vy > 0 && a.y + RADIUS <= top && b.y + RADIUS >= top) return b.x;
  }
  return null;
}

function v14Ledge(x: number, top: number, section: number, kind: number): SwingLedge {
  return { x, top, half: SWING_V14_LEDGE_HALF, kind, section, order: 0, crumble: 0 };
}

/** A section's build: its hooks, landing ledge, squeeze, and the proved plays (for the par and the features). */
interface V14Built {
  hooks: Anchor[];
  to: SwingLedge;
  sq: SwingSqueeze | null;
  /** Pass index of each release from the first hook that lands (one-hook sections), with its landing tick. */
  lands: [number, number][];
  /** The fastest proved route's ticks from the press to the landing. */
  fastest: number;
  /** swingRev 15's witness (recorded only; nothing in the build reads it): each release's pass index and the grab's flight tick after it (-1: a landing). */
  plan: [number, number][];
}

/**
 * Builds one section from the start ledge `from` (one draw of its shape; null if this draw does not prove). The
 * hooks are pushed on to c.anchors only for the probes and popped before returning.
 */
function v14Section(c: V14Course, from: SwingLedge, kind: number, k: number, draw: (n: number) => number): V14Built | null {
  const floorAt = (x: number) => lerpAt(c.floor, x);
  const ceilAt = (x: number) => lerpAt(c.ceil, x);
  const n0 = c.anchors.length;
  const pop = () => {
    c.anchors.length = n0;
    return null;
  };
  const a: Anchor = kind === 0 ? { x: from.x + (75 + draw(46)) * FP, y: from.top - RADIUS - (125 + draw(56)) * FP } : { x: from.x + (55 + draw(36)) * FP, y: from.top - RADIUS - (110 + draw(51)) * FP };
  if (a.y < ceilAt(a.x) + 40 * FP) return pop();
  c.anchors.push(a);
  const kick = restBody(from.x, from.top - RADIUS);
  attach(kick, n0, a);
  kickOff(kick);
  const pass1 = v14Pass(c, kick, null);
  if (pass1.length < 20) return pop();
  // The planned release: the seed picks one in the middle of the forward upswing.
  const rising = pass1.map((b, r) => ({ b, r })).filter(({ b, r }) => r >= 4 && b.om > 0 && b.y < pass1[r - 1]!.y && b.x > a.x).map(({ r }) => r);
  if (rising.length < 8) return pop();
  const lo = Math.trunc(rising.length / 4);
  const r1 = rising[lo + draw(Math.max(1, Math.trunc(rising.length / 2)))]!;
  // One hook: the landing ledge 70 px above to 80 px below the start; two hooks and squeezes land a little higher (shorter flights).
  const top = clampInt(from.top + (kind === 0 ? draw(151) - 70 : draw(131) - 100) * FP, 380 * FP, 650 * FP);
  const maxSpan = (kind === 0 ? 360 : 400) * FP;
  const landOn = (path: Body[], startX: number): SwingLedge | null => {
    const x = v14Crossing(path, top);
    if (x === null || x - from.x < 170 * FP || x - from.x > maxSpan || x - startX < 50 * FP) return null;
    if (top > floorAt(x) - 120 * FP) return null;
    return v14Ledge(x, top, k + 1, 1);
  };
  const pathOf = (pass: Body[], r: number, sq: SwingSqueeze | null, n = 150) => {
    const path: Body[] = [];
    const b = { ...pass[r]! };
    detach(b, c.anchors[b.rope]!);
    v14Fly(c, b, [], sq, n, path);
    return path;
  };
  if (kind === 0) {
    const path = pathOf(pass1, r1, null);
    const to = landOn(path, a.x);
    if (!to) return pop();
    const lands: [number, number][] = [];
    for (let r = 1; r < pass1.length; r++) {
      const hit = v14Release(c, pass1, r, [from, to], null);
      if (hit && hit.ledge === 1) lands.push([r, hit.t]);
    }
    if (lands.length < 4) return pop();
    const fastest = Math.min(...lands.map(([r, t]) => r + t));
    const best = lands.find(([r, t]) => r + t === fastest)!;
    c.anchors.length = n0;
    return { hooks: [a], to, sq: null, lands, fastest, plan: [[best[0], -1]] };
  }
  // Two hooks, or a squeeze: the planned release from the first hook flies on to the second (through the gap).
  const flight = pathOf(pass1, r1, null, 90);
  let sq: SwingSqueeze | null = null;
  let g0 = 4 + draw(8);
  if (kind === 2) {
    // The gap near the top of the planned flight (where it runs flattest), a tick or two either side.
    let apex = 5;
    for (let t = 5; t <= 30 && t < flight.length; t++) if (Math.abs(flight[t]!.vy) < Math.abs(flight[apex]!.vy)) apex = t;
    const f = apex + draw(5) - 2;
    const p = flight[f];
    if (!p) return pop();
    const w = (24 + draw(13)) * FP;
    const x0 = p.x - Math.trunc(w / 2);
    const x1 = x0 + w;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const b of flight) if (b.x + RADIUS > x0 && b.x - RADIUS < x1) {
      minY = Math.min(minY, b.y);
      maxY = Math.max(maxY, b.y);
    }
    // A narrow opening: the planned flight runs nearly level through the rock (at most 24 px of rise or fall).
    if (minY === Infinity || maxY - minY > 24 * FP) return pop();
    sq = { x0, x1, top: minY - RADIUS - V14_SQUEEZE_CLEAR, bottom: maxY + RADIUS + V14_SQUEEZE_CLEAR };
    if (sq.top < ceilAt(x0) + 30 * FP || sq.top < ceilAt(x1) + 30 * FP || sq.bottom > floorAt(x0) - 60 * FP || x0 < a.x + 20 * FP) return pop();
    // The hook swing must clear the rock, and several releases around the planned one must pass the gap.
    if (v14Pass(c, kick, sq).length < r1 + 1) return pop();
    const exit = flight.findIndex((b) => b.x - RADIUS > x1 + 8 * FP);
    if (exit < 0) return pop();
    g0 = Math.max(g0, exit + draw(6));
  }
  const p = flight[g0];
  if (!p || p.y > floorAt(p.x) - 140 * FP) return pop();
  // The far hook ahead and above the grab point (behind a squeeze, where the flight is near its top, a little lower).
  const b: Anchor = { x: p.x + (25 + draw(46)) * FP, y: p.y - (kind === 2 ? 60 + draw(61) : 90 + draw(51)) * FP };
  if (b.y < ceilAt(b.x) + 40 * FP || (sq && b.x < sq.x1 + 50 * FP)) return pop();
  const dA = (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
  const dB = (p.x - b.x) ** 2 + (p.y - b.y) ** 2;
  if (dB >= dA || dB > (REACH - 20 * FP) ** 2) return pop();
  c.anchors.push(b);
  /** Grabs the second hook g ticks into the flight let go at r (or null if the flight is lost by then). */
  const grabbed = (r: number, g: number): Body[] | null => {
    const fl = pathOf(pass1, r, sq, g);
    if (fl.length < g) return null;
    const body = { ...fl[g - 1]! };
    if (assaultTarget({ anchors: c.anchors, sections: [{ kind, hook0: n0, hooks: 2, sq: -1, par: 0 }] }, 0, body.x, body.y) !== n0 + 1) return null;
    attach(body, n0 + 1, b);
    const pass2 = v14Pass(c, body, sq);
    return pass2.length >= 16 ? pass2 : null;
  };
  const pass2 = grabbed(r1, g0);
  if (!pass2) return pop();
  const rising2 = pass2.map((q, r) => ({ q, r })).filter(({ q, r }) => r >= 4 && q.om > 0 && q.y < pass2[r - 1]!.y && q.x > b.x).map(({ r }) => r);
  if (rising2.length < 6) return pop();
  // The planned release from the second hook: late on its upswing (a short, high flight on to the ledge).
  const r2 = rising2[Math.trunc(rising2.length / 2) + draw(Math.max(1, Math.trunc((rising2.length * 2) / 5)))]!;
  const to = landOn(pathOf(pass2, r2, sq), b.x);
  if (!to) return pop();
  /** Releases from the second hook (after a grab) that land on the ledge: [pass index, landing tick]. */
  const landings = (pass: Body[]): [number, number][] => {
    const out: [number, number][] = [];
    for (let r = 1; r < pass.length; r++) {
      const hit = v14Release(c, pass, r, [from, to], sq);
      if (hit && hit.ledge === 1) out.push([r, hit.t]);
    }
    return out;
  };
  const planned = landings(pass2);
  if (planned.length < 4) return pop();
  // Fair: grabs two ticks either side, and releases a tick either side of the planned one, still have a landing.
  let fastest = r1 + g0 + Math.min(...planned.map(([r, t]) => r + t));
  for (const [dr, dg] of [[0, -2], [0, 2], [-1, 0], [1, 0]] as const) {
    const pass = grabbed(r1 + dr, g0 + dg);
    const got = pass ? landings(pass) : [];
    if (got.length < 2) return pop();
    fastest = Math.min(fastest, r1 + dr + g0 + dg + Math.min(...got.map(([r, t]) => r + t)));
  }
  const quick = planned.reduce((p, q) => (q[0] + q[1] < p[0] + p[1] ? q : p));
  c.anchors.length = n0;
  return { hooks: [a, b], to, sq, lands: [], fastest, plan: [[r1, g0], [quick[0], -1]] };
}

const v14Cache = new Map<number, SwingState>();
function initV14(seed: number): SwingState {
  const cached = v14Cache.get(seed | 0);
  if (cached) return { ...cached };
  let rng = (seed ^ 0x2545f491) | 0;
  const draw = (bound: number) => { const r = rngBelow(rng, bound); rng = r.state; return r.value; };
  const total = SWING_V14_SECTIONS;
  const cols = Math.trunc((START_X + (total * 420 + 1600) * FP) / COL) + 2;
  const ceil: number[] = [];
  const floor: number[] = [];
  for (let i = 0; i < cols; i++) {
    ceil.push((40 + draw(50)) * FP);
    floor.push((790 + draw(24)) * FP);
  }
  const c: V14Course = { ceil, floor, spikes: [], anchors: [] };
  // Kinds: two squeezes in seeded bands, two-hook sections mixed in after the first two.
  const kinds: number[] = Array.from({ length: total }, (_, k) => (k >= 2 && draw(100) < 35 ? 1 : 0));
  const sq1 = 8 + draw(8);
  const sq2 = total - 14 + draw(7);
  kinds[sq1] = 2;
  kinds[sq2] = 2;
  const ledges: SwingLedge[] = [v14Ledge(START_X + 60 * FP, 520 * FP, 0, 0)];
  const sections: SwingSection[] = [];
  const squeezes: SwingSqueeze[] = [];
  const built: V14Built[] = [];
  for (let k = 0; k < total; k++) {
    const from = ledges[k]!;
    let made: V14Built | null = null;
    const squeeze = kinds[k] === 2;
    // The seed's draws first; then the same kind with fresh draws; then a one-hook section (always found).
    const tries = kinds[k] === 2 ? 240 : 60;
    for (let attempt = 0; attempt < tries + 60 && !made; attempt++) {
      const kind = attempt < tries ? kinds[k]! : 0;
      made = v14Section(c, from, kind, k, draw);
      if (made && attempt >= tries) kinds[k] = 0;
    }
    if (!made) throw new Error(`Grappler course ${seed}: section ${k} found no proved shape`);
    // A squeeze that fell back to one hook moves to the next section, so every course keeps two.
    if (squeeze && kinds[k] !== 2 && k + 1 < total) kinds[k + 1] = 2;
    const hook0 = c.anchors.length;
    c.anchors.push(...made.hooks);
    if (made.sq) squeezes.push(made.sq);
    sections.push({ kind: kinds[k]!, hook0, hooks: made.hooks.length, sq: made.sq ? squeezes.length - 1 : -1, par: SWING_V14_PAR_WALK + made.fastest + SWING_V14_PAR_MARGIN });
    ledges.push({ ...made.to, kind: k + 1 === total ? 2 : 1 });
    built.push(made);
  }

  // Features on one-hook sections from the third on, each spread over the course in its own bands.
  const oneHook = sections.map((_, k) => k).filter((k) => k >= 1 && sections[k]!.kind === 0);
  const bands = <T>(count: number, make: (k: number) => T | null, used: Set<number>): T[] => {
    const out: T[] = [];
    for (let i = 0; i < count; i++) {
      const lo = Math.trunc((i * oneHook.length) / count);
      const hi = Math.max(lo + 1, Math.trunc(((i + 1) * oneHook.length) / count));
      const start = lo + draw(hi - lo);
      for (let n = 0; n < oneHook.length; n++) {
        const k = oneHook[(start + n) % oneHook.length]!;
        if (used.has(k)) continue;
      const got = make(k);
        if (got) {
          used.add(k);
          out.push(got);
          break;
        }
      }
    }
    return out;
  };
  const probe = (k: number) => {
    const from = ledges[k]!;
    const to = ledges[k + 1]!;
    const a = c.anchors[sections[k]!.hook0]!;
    const kick = restBody(from.x, from.top - RADIUS);
    attach(kick, sections[k]!.hook0, a);
    kickOff(kick);
    return { from, to, a, kick, pass: v14Pass(c, kick, null), lands: built[k]!.lands };
  };
  const flightOf = (pass: Body[], r: number) => {
    const path: Body[] = [];
    const b = { ...pass[r]! };
    detach(b, c.anchors[b.rope]!);
    v14Fly(c, b, [], null, 150, path);
    return path;
  };
  const touches = (path: readonly Body[], x: number, y: number, r: number, until?: (b: Body) => boolean) => {
    for (const b of path) {
      if (until && until(b)) break;
      if ((b.x - x) ** 2 + (b.y - y) ** 2 <= r * r) return true;
    }
    return false;
  };
  /** A landing release's flight, up to the landing tick. */
  const landedFlight = (pass: Body[], r: number, to: SwingLedge) => {
    const path = flightOf(pass, r);
    const end = path.findIndex((q, i) => i > 0 && q.vy > 0 && path[i - 1]!.y + RADIUS <= to.top && q.y + RADIUS >= to.top);
    return end < 0 ? path : path.slice(0, end);
  };
  /** Does a path cross the line x = g.x inside its opening at gate speed (forward)? */
  const passesGate = (path: readonly Body[], g: SwingGate) => {
    for (let i = 1; i < path.length; i++) {
      const p0 = path[i - 1]!;
      const p1 = path[i]!;
      if (!(p0.x < g.x && p1.x >= g.x)) continue;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const y = p0.y + Math.trunc((dy * (g.x - p0.x)) / dx);
      if (dx * dx + dy * dy >= SWING_V14_GATE_SPEED * SWING_V14_GATE_SPEED * FP * FP && y >= g.y0 && y <= g.y1) return true;
    }
    return false;
  };
  // Speed gates: on the natural line (the middle release of the widest landing window), early in its flight while it is fast.
  const gates = bands(SWING_V14_GATES, (k) => {
    const { to, pass, lands } = probe(k);
    const runs: number[][] = [];
    for (const [r] of lands) {
      const last = runs[runs.length - 1];
      if (last && last[last.length - 1] === r - 1) last.push(r);
      else runs.push([r]);
    }
    const widest = runs.reduce((p, q) => (q.length > p.length ? q : p));
    const mid = widest[Math.trunc(widest.length / 2)]!;
    const path = landedFlight(pass, mid, to);
    for (let i = 4; i < path.length - 4; i++) {
      const at = path[i]!;
      const prev = path[i - 1]!;
      if ((at.x - prev.x) ** 2 + (at.y - prev.y) ** 2 < (SWING_V14_GATE_SPEED + 0.5) ** 2 * FP * FP) continue;
      const gate: SwingGate = { x: at.x, y0: at.y - SWING_V14_GATE_HALF, y1: at.y + SWING_V14_GATE_HALF };
      if (gate.y0 < lerpAt(ceil, gate.x) + 30 * FP || passesGate(pass, gate)) continue;
      const takers = lands.filter(([r]) => passesGate([pass[r]!, ...landedFlight(pass, r, to)], gate)).length;
      if (takers >= 2 && takers < lands.length) return gate;
    }
    return null;
  }, new Set());
  // Gems: on a harder line (a landing flight only two or three of the landing releases share), never touched on the rope.
  const pickupUsed = new Set<number>();
  const gems = bands(SWING_V14_GEMS, (k) => {
    const { to, pass, lands } = probe(k);
    const flights = lands.map(([r]) => landedFlight(pass, r, to));
    const options: [number, number][] = [];
    flights.forEach((path) => {
      for (let i = 4; i < path.length - 4; i += 2) {
        const p = path[i]!;
        if (p.y < lerpAt(ceil, p.x) + 30 * FP || touches(pass, p.x, p.y, SWING_GEM_TOUCH + 4 * FP)) continue;
        const takers = flights.filter((f) => touches(f, p.x, p.y, SWING_GEM_TOUCH)).length;
        if (takers >= 2 && takers <= 3 && takers * 2 < flights.length) options.push([p.x, p.y]);
      }
    });
    return options.length ? options[draw(options.length)]! : null;
  }, pickupUsed);
  // Stars: on a tighter swing (the rope reeled in early on the first hook), where the plain swing never passes.
  const starSpots = bands(SWING_V14_STARS, (k) => {
    const { from, to, pass } = probe(k);
    for (const u of [6, 8, 10, 12, 14, 16, 18]) {
      if (u >= pass.length) break;
      const body = { ...pass[u]! };
      startReel(body, SWING_REEL_UP);
      const reeled = v14Pass(c, body, null);
      const lands: number[] = [];
      for (let r = 1; r < reeled.length; r++) {
        const hit = v14Release(c, reeled, r, [from, to], null);
        if (hit && hit.ledge === 1) lands.push(r);
      }
      if (lands.length < 2) continue;
      // The star: where the tighter swing runs furthest inside the plain one, at least two landing releases before its end.
      const gap = (b: Body) => { let d = Infinity; for (const q of pass) d = Math.min(d, (q.x - b.x) ** 2 + (q.y - b.y) ** 2); return d; };
      const until = lands[lands.length - 2]!;
      let at = Math.min(8, until);
      for (let i = at; i <= until; i++) if (gap(reeled[i]!) > gap(reeled[at]!)) at = i;
      const low = reeled[at]!;
      if (gap(low) < (SWING_STAR_TOUCH + 4 * FP) ** 2 || low.y < lerpAt(ceil, low.x) + 30 * FP) continue;
      return [low.x, low.y] as [number, number];
    }
    return null;
  }, pickupUsed);
  gems.sort((p, q) => p[0] - q[0]);
  starSpots.sort((p, q) => p[0] - q[0]);
  gates.sort((p, q) => p.x - q.x);

  const first = ledges[0]!;
  const body = restBody(first.x, first.top - RADIUS);
  const v14: SwingState = {
    ...body,
    tick: 0,
    rng,
    camX: first.x - SWING_V14_CAM_LEFT,
    maxX: body.x,
    grabTick: -100,
    ended: 0,
    endedTick: 0,
    ceil,
    floor,
    anchors: c.anchors,
    spikes: [],
    assault: 1,
    worldW: SWING_V13_W,
    worldH: SWING_V13_H,
    sections,
    squeezes,
    ledges,
    ledgeOn: 0,
    ledgeHold: 0,
    sec: 0,
    secStart: 0,
    secTicks: sections.map(() => 0),
    secReach: first.x,
    restarts: 0,
    respawn: 0,
    missTick: 0,
    gems,
    gemsTaken: 0,
    gates,
    gatesLit: 0,
    starSpots,
    starsTaken: [],
    stars: 0,
    bankGems: 0,
    bankGates: 0,
    bankStars: [],
    chaseX: 0,
    chaseY: 0,
    caught: 0,
  };
  if (v14Cache.size > 16) v14Cache.clear();
  v14Cache.set(seed | 0, v14);
  return { ...v14 };

  function ceilAt(x: number): number {
    return lerpAt(ceil, x);
  }
}

/** swingRev 14: the assault course. Band 3 like rev 11 and 13; the score is swingScoreV14. */
export const swingAssaultGame: typeof swingGame = { ...swingTunecGame, init: (seed) => ({ ...bandInit(initV14(seed)), band: 3 }) };

/* ================= The swinging course (swingRev 15, 29 Oct 2026) ================= */

/**
 * swingRev 15 (docs/grappler-rework-oct-2026.md): Joe's direction after swingRev 14 ("all ledges and hooks"): the
 * course is mostly the old swinging game again, with short stretches of the assault course mixed in. Every rule
 * below is gated on the state's `rework` marker (rev-15 states also carry rev 14's `assault`, so the sections, the
 * restart, the banked pickups and the reveal's counts are rev 14's machinery); every earlier revision plays and
 * scores exactly as before.
 *
 *  - The course is SWING_V15_BLOCKS blocks: swinging stretches of 3–5 hooks (about 80 % of the course's length)
 *    and four ledge runs of SWING_V15_RUNS swingRev 14 sections (start ledge, one or two hooks, landing ledge;
 *    SWING_V15_SQUEEZES of them squeezes). Each stretch (a swinging stretch, or one
 *    ledge section) is a section of the course: its own par and restart point.
 *  - Swinging: hold grabs the nearest hook within reach among the stretch's own hooks and the next stretch's first
 *    one (grabbing that one clears the stretch); let go to fly. The hooks are spaced wider than the old cave's
 *    (about 1 in reach at a time), so each grab is a choice. A swinging stretch before a ledge run ends by landing on
 *    its first ledge; the last stretch ends on the finish ledge.
 *  - A miss (the lava, or a squeeze's rock): on a ledge section, back to its start ledge (rev 14); on a swinging
 *    stretch, back hanging from the last of its hooks held (its start ledge if none yet), still for SWING_V14_RESPAWN
 *    ticks. The clock runs on; what was picked up since that hook (or ledge) was reached is put back: a swinging
 *    stretch banks its pickups at each new hook, a ledge section when cleared.
 *  - The dragon chases only over the last quarter of the course: it appears as the hero starts the first stretch
 *    beyond three quarters of the course's length (rev 14's pace, catch and back-off).
 *  - Speed gates, gems and stars (SWING_V15_GATES / _GEMS / _STARS) sit on the swinging stretches' hook-to-hook
 *    flights: gates on the planned (natural) line, gems on a line only a few of the releases that reach the next
 *    hook share, stars on a reeled-in swing that still reaches it.
 *  - Identical for every player: built and proved from the seed alone (see initV15).
 *  - Score (200): SWING_V15_CORE for distance and sections cleared in a straight line (the share of the course's
 *    length behind the hero: every stretch cleared, and up to nine tenths of the one in play), SWING_V15_PAR_POINTS
 *    shared by the stretches' pars, SWING_V15_PICKUP_POINTS a gate, gem or star banked (30 in all), nothing for
 *    clearing the course; anyone who plays scores at least 1.
 */
export const SWING_REV_REWORK = 15;
export const SWING_V15_BLOCKS = 24;
/** The ledge runs' sizes (sections), in course order; SWING_V15_SQUEEZE_RUNS carry a squeeze. */
export const SWING_V15_RUNS = [3, 2, 2, 3] as const;
export const SWING_V15_SQUEEZE_RUNS: readonly number[] = [0, 3];
/** A gate lights on a forward pass through its opening at this speed or more (px a tick): the swinging course flies slower than rev 14's kicks. */
export const SWING_V15_GATE_SPEED = 3.5;
export const SWING_V15_SQUEEZES = 2;
export const SWING_V15_GATES = 5;
export const SWING_V15_GEMS = 5;
export const SWING_V15_STARS = 5;
export const SWING_V15_CORE = 140;
export const SWING_V15_PAR_POINTS = 30;
export const SWING_V15_PICKUP_POINTS = 2;
export const SWING_V15_MAX = 200;
/** Par: a swinging stretch's planned route + SWING_V15_PAR_MARGIN + SWING_V15_PAR_HOOK a hook; a ledge section rev 14's. Beaten by SWING_V15_PAR_FULL or more pays its whole share. */
export const SWING_V15_PAR_MARGIN = 15;
export const SWING_V15_PAR_HOOK = 5;
export const SWING_V15_PAR_FULL = 30;
/** The dragon appears when the hero starts a stretch past this share of the course (per mille). */
export const SWING_V15_CHASE_FROM = 750;
/** A swinging stretch's restart: hanging from its first hook on this rope, held this far behind (swingRev 4's start pose). */
export const SWING_V15_HANG_LEN = 110 * FP;
export const SWING_V15_HANG_TH = 56000 * SUB;
/** Core units: per mille of the course; the straight line to SWING_V15_CORE. */
export const SWING_V15_BAND_CURVE = bandCurve([0, 1000], [0, SWING_V15_CORE]);
/** The share (tenths) of a stretch in play that counts before it is cleared. */
const V15_PARTIAL_TENTHS = 9;

/** Section kind 3 (swingRev 15): a swinging stretch. Kinds 0–2 are rev 14's ledge sections. */
export const SWING_KIND_SWING = 3;

/** The hero hanging still from anchor a (a swinging stretch's restart pose). */
function hangBody(a: Anchor, index: number): Body {
  const b: Body = { x: 0, y: 0, vx: 0, vy: 0, rope: index, len: SWING_V15_HANG_LEN, th: SWING_V15_HANG_TH, om: 0, grabLen: SWING_V15_HANG_LEN, reelTo: 0, reelLeft: 0, pumps: 0 };
  ropePos(b, a);
  return b;
}

/** The nearest anchor of [lo, hi) within reach of (x, y), or -1 (swingRev 15's grab rule). */
function rangeTarget(anchors: readonly Anchor[], lo: number, hi: number, x: number, y: number): number {
  let best = -1;
  let bestD = REACH * REACH;
  for (let i = lo; i < hi && i < anchors.length; i++) {
    const dx = anchors[i]!.x - x;
    const dy = anchors[i]!.y - y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** The anchors stretch k can grab: its own hooks, and the next stretch's first when that one starts on a hook. */
export function swingReworkRange(s: Pick<SwingState, "sections">, k: number): [number, number] {
  const sec = s.sections?.[k];
  if (!sec) return [0, 0];
  const next = s.sections![k + 1];
  return [sec.hook0, sec.hook0 + sec.hooks + (next && (next.from ?? 0) < 0 ? 1 : 0)];
}

/** A stretch's restart: a ledge section (or a swinging stretch after a ledge run) on its start ledge, else hanging from its first hook. */
function reworkRestart(s: SwingState, tick: number): void {
  const k = s.sec ?? 0;
  const sec = s.sections![k]!;
  s.reelLeft = 0;
  s.respawn = SWING_V14_RESPAWN;
  s.restarts = (s.restarts ?? 0) + 1;
  s.missTick = tick;
  s.ledgeHold = 0;
  let backX: number;
  const hang = sec.kind === SWING_KIND_SWING ? (s.hangHook ?? -1) : -1;
  if (hang >= 0) {
    Object.assign(s, hangBody(s.anchors[hang]!, hang));
    s.ledgeOn = -1;
    s.grabTick = tick;
    backX = s.x;
  } else if ((sec.from ?? -1) >= 0) {
    const from = s.ledges![sec.from!]!;
    s.x = from.x;
    s.y = from.top - RADIUS;
    s.vx = 0;
    s.vy = 0;
    s.rope = -1;
    s.om = 0;
    s.ledgeOn = sec.from!;
    backX = from.x;
  } else {
    Object.assign(s, hangBody(s.anchors[sec.hook0]!, sec.hook0));
    s.ledgeOn = -1;
    s.grabTick = tick;
    backX = s.x;
  }
  s.gemsTaken = s.bankGems ?? 0;
  s.gatesLit = s.bankGates ?? 0;
  s.starsTaken = [...(s.bankStars ?? [])];
  s.stars = s.starsTaken.length;
  if ((s.chaseX ?? 0) !== 0) s.chaseX = Math.min(s.chaseX!, backX - SWING_V14_CHASE_BACKOFF);
}

/** One tick of the swinging course (swingRev 15). */
function stepRework(state: SwingState, input: ArcadeInputEvent | null): SwingState {
  const tick = state.tick + 1;
  const s: SwingState = { ...state, tick };
  const total = s.sections!.length;
  const k = s.sec ?? 0;
  const sec = s.sections![k]!;
  const [lo, hi] = swingReworkRange(s, k);
  const px = s.x;
  const py = s.y;
  let standing = (s.ledgeOn ?? -1) >= 0;
  const held = (s.respawn ?? 0) > 0;
  let cleared = false;
  if (held) {
    // Back at the stretch's start (on its ledge, or hanging from its first hook): held still; inputs wait.
    s.respawn = s.respawn! - 1;
  } else {
    let press = input !== null && input.k === SWING_INPUT_HOLD && input.a === 1;
    if (standing) {
      // As swingRev 13 and 14: the hero walks to the ledge's centre first; a press on the way is held until they get there.
      const centre = s.ledges![s.ledgeOn!]!.x;
      if (s.x !== centre) s.x += clampInt(centre - s.x, -SWING_LEDGE_WALK, SWING_LEDGE_WALK);
      if (input !== null && input.k === SWING_INPUT_HOLD) s.ledgeHold = input.a === 1 ? 1 : 0;
      press = s.x === centre && s.ledgeHold === 1;
      if (press) s.ledgeHold = 0;
    }
    if (standing ? press : input !== null && input.k === SWING_INPUT_HOLD) {
      if (press) {
        const target = rangeTarget(s.anchors, lo, hi, s.x, s.y);
        if (target >= 0) {
          if (s.rope >= 0) detach(s, s.anchors[s.rope]!);
          attach(s, target, s.anchors[target]!);
          if (standing) {
            s.ledgeOn = -1;
            standing = false;
            kickOff(s);
          }
          s.grabTick = tick;
          // Grabbing the next stretch's first hook clears this one; a hook further on in a swinging stretch is the new
          // restart point and banks what was picked up so far.
          if (target >= sec.hook0 + sec.hooks) cleared = true;
          else if (sec.kind === SWING_KIND_SWING && target > (s.hangHook ?? -1)) {
            s.hangHook = target;
            s.bankGems = s.gemsTaken ?? 0;
            s.bankGates = s.gatesLit ?? 0;
            s.bankStars = [...(s.starsTaken ?? [])];
          }
        }
      } else if (s.rope >= 0) detach(s, s.anchors[s.rope]!);
    } else if (input !== null && input.k === SWING_INPUT_REEL && !standing) {
      startReel(s, clampInt(input.a, 0, 1));
    }
  }
  let missed = false;
  if (!standing && !held) {
    missed = moveBody(s, s);
    const sq = s.squeezes?.[sec.sq];
    if (!missed && sq && swingInSqueeze(sq, s.x, s.y)) missed = true;
  }
  if (!missed && !standing && !held) {
    // Landing: falling on to the stretch's start or landing ledge from above, off the rope.
    if (!cleared && s.rope < 0 && s.vy > 0) {
      for (const i of [sec.to ?? -1, sec.from ?? -1]) {
        if (i < 0) continue;
        const l = s.ledges![i]!;
        if (Math.abs(s.x - l.x) > l.half || !(py + RADIUS <= l.top && s.y + RADIUS >= l.top)) continue;
        s.y = l.top - RADIUS;
        s.vx = 0;
        s.vy = 0;
        s.ledgeHold = 0;
        s.ledgeOn = i;
        cleared = i === sec.to;
        break;
      }
    }
    // Pickups (put back on a miss), as swingRev 14.
    let taken = s.gemsTaken ?? 0;
    (s.gems ?? []).forEach(([gx, gy], i) => {
      const dx = s.x - gx;
      const dy = s.y - gy;
      if (!(taken & (1 << i)) && dx * dx + dy * dy <= SWING_GEM_TOUCH * SWING_GEM_TOUCH) taken |= 1 << i;
    });
    s.gemsTaken = taken;
    (s.starSpots ?? []).forEach(([sx, sy], i) => {
      if ((s.starsTaken ?? []).includes(i)) return;
      const dx = s.x - sx;
      const dy = s.y - sy;
      if (dx * dx + dy * dy <= SWING_STAR_TOUCH * SWING_STAR_TOUCH) {
        s.starsTaken = [...(s.starsTaken ?? []), i];
        s.stars = s.starsTaken.length;
      }
    });
    let lit = s.gatesLit ?? 0;
    const dx = s.x - px;
    const dy = s.y - py;
    const fast = dx * dx + dy * dy >= SWING_V15_GATE_SPEED * SWING_V15_GATE_SPEED * FP * FP;
    (s.gates ?? []).forEach((g, i) => {
      if (lit & (1 << i) || !(px < g.x && s.x >= g.x)) return;
      const y = py + Math.trunc((dy * (g.x - px)) / dx);
      if (fast && y >= g.y0 && y <= g.y1) lit |= 1 << i;
    });
    s.gatesLit = lit;
  }
  if (s.x > s.maxX) s.maxX = s.x;
  if (s.x > (s.secReach ?? 0)) s.secReach = s.x;
  if (missed) reworkRestart(s, tick);
  else if (cleared) {
    const ticks = [...s.secTicks!];
    ticks[k] = tick;
    s.secTicks = ticks;
    s.sec = k + 1;
    s.secStart = tick;
    s.secReach = s.x;
    s.bankGems = s.gemsTaken ?? 0;
    s.bankGates = s.gatesLit ?? 0;
    s.bankStars = [...(s.starsTaken ?? [])];
    // The next stretch's restart point: its first hook when it starts on one (just grabbed), else its start ledge.
    const next = s.sections![k + 1];
    s.hangHook = next && next.kind === SWING_KIND_SWING && (next.from ?? -1) < 0 ? next.hook0 : -1;
  }
  const now = s.sec ?? 0;
  // The dragon: appears behind the hero as they start stretch `chaseFrom` (the last quarter), then as rev 14's.
  if ((s.chaseX ?? 0) === 0 && now >= (s.chaseFrom ?? total) && now < total) {
    s.chaseX = s.x - SWING_CHASE_GAP;
    s.chaseY = s.y;
  } else if ((s.chaseX ?? 0) !== 0 && now < total) {
    s.chaseX = s.chaseX! + SWING_V14_CHASE_PACE;
    s.chaseY = s.chaseY! + clampInt(Math.trunc((s.y - s.chaseY!) / 4), -3 * FP, 3 * FP);
    if (s.chaseX! + SWING_CHASE_REACH >= s.x - RADIUS) {
      s.caught = (s.caught ?? 0) + 1;
      reworkRestart(s, tick);
    }
  }
  // The camera: following the hero (swingRev 13's lead) on a swinging stretch, framing the section (rev 14) on a ledge one; it eases between.
  const cur = s.sections![Math.min(now, total - 1)]!;
  const frame = cur.kind === SWING_KIND_SWING ? s.x - SWING_LEAD_V13 : s.ledges![cur.from!]!.x - SWING_V14_CAM_LEFT;
  s.camX += Math.trunc((frame - s.camX) / 6);
  const w = (s.worldW ?? SWING_WORLD_W) * FP;
  if (s.x - s.camX > w - 60 * FP) s.camX = s.x - (w - 60 * FP);
  if (s.x - s.camX < 40 * FP) s.camX = s.x - 40 * FP;
  if (now >= total || tick >= SWING_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** The course's progress (swingRev 15): stretches cleared, the length behind the hero (cleared, plus up to nine tenths of the one in play) and that as per mille of the course. */
export function swingReworkProgress(s: SwingState): { cleared: number; done: number; length: number; permille: number } {
  const secs = s.sections ?? [];
  const total = secs.length;
  const cleared = clampInt(s.sec ?? 0, 0, total);
  if (total === 0) return { cleared, done: 0, length: 1, permille: 0 };
  const length = Math.max(1, secs[total - 1]!.x1! - secs[0]!.x0!);
  let done = secs[Math.min(cleared, total) - 1]?.x1 ?? secs[0]!.x0!;
  done -= secs[0]!.x0!;
  if (cleared < total) {
    const sec = secs[cleared]!;
    const span = sec.x1! - sec.x0!;
    done += clampInt((s.secReach ?? sec.x0!) - sec.x0!, 0, Math.trunc((span * V15_PARTIAL_TENTHS) / 10));
  } else done = length;
  return { cleared, done, length, permille: clampInt(Math.trunc((1000 * done) / length), 0, 1000) };
}

/** The three parts of a rev-15 score (they add up to it, at most 200): the core (at least 1 once the player has acted), the pars and the pickups. */
export function swingReworkParts(state: SwingState): { core: number; par: number; pickups: number; permille: number } {
  const c = swingAssaultCounts(state);
  const p = swingReworkProgress(state);
  const parFull = c.sectionTotal ? (state.sections ?? []).reduce((sum, _, k) => {
    const q = swingAssaultPar(state, k);
    return sum + (q.time >= 0 ? clampInt(q.beat, 0, SWING_V15_PAR_FULL) : 0);
  }, 0) : 0;
  return {
    core: state.acted ? Math.max(1, bandPoints(SWING_V15_BAND_CURVE, p.permille)) : bandPoints(SWING_V15_BAND_CURVE, p.permille),
    par: c.sectionTotal ? Math.trunc((SWING_V15_PAR_POINTS * parFull) / (SWING_V15_PAR_FULL * c.sectionTotal)) : 0,
    pickups: SWING_V15_PICKUP_POINTS * (c.gates + c.gems + c.starsBanked),
    permille: p.permille,
  };
}

/** Score parts (rev 15): the core on SWING_V15_BAND_CURVE, then the pars and pickups; no finish bonus. */
export function swingBandPartsV15(state: SwingState): BandParts {
  const c = swingAssaultCounts(state);
  const p = swingReworkParts(state);
  const finished = c.sectionTotal > 0 && c.sections >= c.sectionTotal;
  return {
    units: p.permille,
    points: p.core,
    bonus: p.par + p.pickups,
    penalty: 0,
    finished,
    text: `${Math.trunc(p.permille / 10)} % of the course · ${c.sections} / ${c.sectionTotal} stretches`,
    bonusText: `par +${p.par} (${c.parsBeaten} under) · gates ${c.gates} · gems ${c.gems} · stars ${c.starsBanked} +${p.pickups}`,
  };
}

/** A rev-15 score: the parts' sum (at most 200); a run with any input scores at least 1 (its core does), none scores 0. */
export function swingScoreV15(state: SwingState): number {
  return bandTotal(swingBandPartsV15(state), Boolean(state.acted), SWING_V15_MAX);
}

/* ---- The course builder (rev 15) ---- */

/** The body on its rope for its first forward pass (bodies[0] is the body given), and whether it hit the lava or a rock before its apex. */
function v15Pass(c: V14Course, b: Body, max = 160): { pass: Body[]; died: boolean } {
  const pass: Body[] = [{ ...b }];
  const body = { ...b };
  for (let r = 1; r <= max; r++) {
    if (moveBody(body, c)) return { pass, died: true };
    pass.push({ ...body });
    if (body.om <= 0) break;
  }
  return { pass, died: false };
}

/** The forward upswing's ticks of a pass: rising, moving forward, ahead of its anchor. */
function v15Rising(c: V14Course, pass: readonly Body[]): number[] {
  const out: number[] = [];
  for (let r = 4; r < pass.length; r++) {
    const b = pass[r]!;
    if (b.om > 0 && b.y < pass[r - 1]!.y && b.x > c.anchors[b.rope]!.x) out.push(r);
  }
  return out;
}

/** A fresh grab worth having: its first forward pass clear of the lava, long enough and with an upswing to release on (v15Pass and v15Rising, without keeping the pass). */
function v15Good(c: V14Course, body: Body): boolean {
  const b = { ...body };
  const ax = c.anchors[b.rope]!.x;
  let length = 1;
  let rising = 0;
  for (let r = 1; r <= 160; r++) {
    const py = b.y;
    if (moveBody(b, c)) return false;
    length += 1;
    if (r >= 4 && b.om > 0 && b.y < py && b.x > ax) rising += 1;
    if (b.om <= 0) break;
  }
  return length >= 16 && rising >= 6;
}

/**
 * A body let go flies up to n ticks; the first tick a press there would grab anchor `b` (the nearest of [lo, hi) in
 * reach) with a good swing after it: that tick (1-based, the press comes the tick after), the grabbed body and the
 * flight so far. Null if it dies, lands on one of `ledges` or never can.
 */
function v15FlyTo(c: V14Course, start: Body, lo: number, hi: number, b: number, ledges: readonly SwingLedge[], n = 60, keep = false): { t: number; body: Body; at: Body; path: Body[] } | null {
  const body = { ...start };
  const path: Body[] = [];
  for (let t = 1; t <= n; t++) {
    const py = body.y;
    if (moveBody(body, c)) return null;
    if (keep) path.push({ ...body });
    if (body.vy > 0 && ledges.some((l) => Math.abs(body.x - l.x) <= l.half && py + RADIUS <= l.top && body.y + RADIUS >= l.top)) return null;
    if (rangeTarget(c.anchors, lo, hi, body.x, body.y) !== b) continue;
    const grab = { ...body };
    attach(grab, b, c.anchors[b]!);
    if (v15Good(c, grab)) return { t, body: grab, at: { ...body }, path };
  }
  return null;
}

/** Lets go of pass[r] (a forward swing only) and flies it towards anchor b (v15FlyTo). */
function v15ReleaseTo(c: V14Course, pass: readonly Body[], r: number, lo: number, hi: number, b: number, ledges: readonly SwingLedge[], keep = false) {
  const q = pass[r];
  if (!q || q.om <= 0) return null;
  const off = { ...q };
  detach(off, c.anchors[off.rope]!);
  if (off.vx <= 0) return null;
  return v15FlyTo(c, off, lo, hi, b, ledges, 60, keep);
}

/** From a body on a rope (any number of swings, up to `max` ticks): the first release whose flight grabs anchor b, or null. */
function v15Reaches(c: V14Course, body: Body, lo: number, hi: number, b: number, ledges: readonly SwingLedge[], max = 240): [number, number, number] | null {
  const rope = { ...body };
  const one: Body[] = [rope];
  for (let r = 1; r <= max; r++) {
    if (moveBody(rope, c)) return null;
    const got = v15ReleaseTo(c, one, 0, lo, hi, b, ledges);
    if (got) return [got.at.x, got.at.y, r + got.t];
  }
  return null;
}

/**
 * A restart's window: from a body hanging still on a rope (up to `max` ticks, a few swings), the grab points of the
 * first `need` releases whose flight grabs anchor b, or null if fewer release ticks do (a restart must be fair to an
 * ordinary player's timing, not only possible).
 */
function v15Window(c: V14Course, body: Body, lo: number, hi: number, b: number, ledges: readonly SwingLedge[], need = 4, max = 150): [number, number, number][] | null {
  const rope = { ...body };
  const one: Body[] = [rope];
  const out: [number, number, number][] = [];
  for (let r = 1; r <= max && out.length < need; r++) {
    if (moveBody(rope, c)) break;
    const got = v15ReleaseTo(c, one, 0, lo, hi, b, ledges);
    if (got) out.push([got.at.x, got.at.y, b]);
  }
  return out.length >= need ? out : null;
}

/** From a body on a rope (up to `max` ticks): releases that land on ledges[0] (of the ledges given), at most `need`. */
function v15Landings(c: V14Course, body: Body, ledges: readonly SwingLedge[], need: number, max = 240): [number, number][] {
  const out: [number, number][] = [];
  const rope = { ...body };
  const one: Body[] = [rope];
  for (let r = 1; r <= max && out.length < need; r++) {
    if (moveBody(rope, c)) break;
    if (rope.om <= 0) continue;
    const hit = v14Release(c, one, 0, ledges, null);
    if (hit && hit.ledge === 0) out.push([r, hit.t]);
  }
  return out;
}

/** One hook-to-hook hop of a swinging stretch, as proved (kept for the par and the features). */
interface V15Hop {
  /** The hook let go of, the hook grabbed, the stretch's first hook (its grab range starts there) and the planned body on the first hook. */
  h: number;
  b: number;
  lo: number;
  body: Body;
  /** The ledge the hop's stretch started on (-1: none). */
  from: number;
  /** The section (stretch) and the step of its plan the hop is. */
  sec: number;
  step: number;
}

/**
 * A course's witness (swingRev 15, recorded by the build; checks and tools read it, play never does): each section's
 * plan as [release, grab] steps (the release's pass index after the grab or press it follows, the grab's flight tick
 * after the release; -1: let the flight land), and the line each gate, gem and star was proved on: the section and
 * step whose rope it starts from, an optional reel (its pass index, -1 none) and the release on that rope; the grab
 * after it is the first that takes the step's next hook with a good swing.
 */
export interface SwingReworkPlan {
  sections: [number, number][][];
  features: { kind: "gate" | "gem" | "star"; index: number; sec: number; step: number; reel: number; r: number }[];
}

/**
 * Places the next hook of a swinging stretch from the bodies on hook h (S[0] the planned one, the rest a restart's
 * hang and the near misses of the hop before): the planned release, a seeded grab point on its flight and the hook
 * ahead of and above it. Proved: the planned grab takes it with a good swing after; releases a tick either side and
 * grabs two ticks either side do too; at least four release ticks on the planned swing reach it; a restart's hang
 * (`hangLast`) reaches it on four or more release ticks within a few swings; every other body in S reaches it; and
 * every earlier grab of the stretch (`points`) still takes its own hook.
 * Returns the new hook's bodies (planned first), the grabs proved and the planned ticks (release + flight).
 */
function v15Hop(c: V14Course, S: readonly Body[], lo: number, ledges: readonly SwingLedge[], points: readonly [number, number, number][], draw: (n: number) => number, hangLast = false): { S: Body[]; grabs: [number, number, number][]; ticks: number; r: number; g: number } | null {
  const P = S[0]!;
  const a = c.anchors[P.rope]!;
  const { pass } = v15Pass(c, P);
  const rising = v15Rising(c, pass);
  if (rising.length < 8) return null;
  const n = c.anchors.length;
  for (let attempt = 0; attempt < 24; attempt++) {
    const r = rising[Math.trunc(rising.length / 4) + draw(Math.max(1, Math.trunc(rising.length / 2)))]!;
    const off = { ...pass[r]! };
    detach(off, a);
    const path: Body[] = [];
    v14Fly(c, off, ledges, null, 70, path);
    if (path.length < 14) continue;
    const g = 6 + draw(Math.min(24, path.length - 8));
    const p = path[g - 1]!;
    const b: Anchor = { x: p.x + (25 + draw(46)) * FP, y: p.y - (60 + draw(81)) * FP };
    if (b.y < lerpAt(c.ceil, b.x) + 50 * FP || b.y > 430 * FP || b.x - a.x < 140 * FP) continue;
    const dB = (p.x - b.x) ** 2 + (p.y - b.y) ** 2;
    if (dB >= (p.x - a.x) ** 2 + (p.y - a.y) ** 2 || dB > (REACH - 20 * FP) ** 2) continue;
    c.anchors.push(b);
    const hi = n + 1;
    const fail = () => {
      c.anchors.length = n;
    };
    if (points.some(([x, y, t]) => rangeTarget(c.anchors, lo, hi, x, y) !== t)) { fail(); continue; }
    /** The grab of the new hook from the flight let go at r, pressed after g flight ticks (or null). */
    const grabAt = (rr: number, gg: number): [Body, Body] | null => {
      const q = pass[rr];
      if (!q || q.om <= 0 || gg < 1) return null;
      const fl: Body[] = [];
      const o = { ...q };
      detach(o, a);
      if (v14Fly(c, o, ledges, null, gg, fl) || fl.length < gg) return null;
      const at = fl[gg - 1]!;
      if (rangeTarget(c.anchors, lo, hi, at.x, at.y) !== n) return null;
      const grab = { ...at };
      attach(grab, n, b);
      return v15Good(c, grab) ? [grab, at] : null;
    };
    const planned = grabAt(r, g);
    if (!planned) { fail(); continue; }
    const variants: [Body, Body][] = [];
    let ok = true;
    for (const [dr, dg] of [[-1, 0], [1, 0], [0, -2], [0, 2]] as const) {
      const v = grabAt(r + dr, g + dg);
      if (!v) { ok = false; break; }
      variants.push(v);
    }
    if (!ok) { fail(); continue; }
    let window = 0;
    for (let rr = 1; rr < pass.length && window < 4; rr++) if (v15ReleaseTo(c, pass, rr, lo, hi, n, ledges)) window += 1;
    if (window < 4) { fail(); continue; }
    const grabs: [number, number, number][] = [planned, ...variants].map(([, at]) => [at.x, at.y, n]);
    for (let i = 1; i < S.length && ok; i++) {
      // A restart's hang on this hook (S's last, `hangLast`) needs a window of release ticks; a near miss of the hop before, a way on.
      if (hangLast && i === S.length - 1) {
        const window = v15Window(c, S[i]!, lo, hi, n, ledges);
        if (!window) ok = false;
        else grabs.push(...window);
        continue;
      }
      const got = v15Reaches(c, S[i]!, lo, hi, n, ledges);
      if (!got) ok = false;
      else grabs.push([got[0], got[1], n]);
    }
    if (!ok) { fail(); continue; }
    return { S: [planned[0], ...variants.map(([v]) => v)], grabs, ticks: r + g, r, g };
  }
  return null;
}

/**
 * The landing that ends a swinging stretch before a ledge run (or the course): a ledge where the planned release from
 * hook S[0].rope comes down. Proved: four or more release ticks of the planned swing land on it, the restart's hang
 * (S's last) four or more within a few swings, and every other body in S twice or more. Returns the ledge and the planned ticks (release + flight).
 */
function v15Land(c: V14Course, S: readonly Body[], ledges: readonly SwingLedge[], draw: (n: number) => number): { to: SwingLedge; ticks: number; r: number } | null {
  const P = S[0]!;
  const a = c.anchors[P.rope]!;
  const { pass } = v15Pass(c, P);
  const rising = v15Rising(c, pass);
  if (rising.length < 8) return null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const r = rising[Math.trunc(rising.length / 4) + draw(Math.max(1, Math.trunc(rising.length / 2)))]!;
    const off = { ...pass[r]! };
    detach(off, a);
    const path: Body[] = [];
    v14Fly(c, off, ledges, null, 150, path);
    const top = clampInt(a.y + (180 + draw(170)) * FP, 380 * FP, 650 * FP);
    const x = v14Crossing(path, top);
    if (x === null || x - a.x < 110 * FP || x - a.x > 360 * FP || top > lerpAt(c.floor, x) - 120 * FP) continue;
    const to = v14Ledge(x, top, 0, 1);
    const all = [to, ...ledges];
    const hit = v14Release(c, pass, r, all, null);
    if (!hit || hit.ledge !== 0) continue;
    if (v15Landings(c, P, all, 4, pass.length - 1).length < 4) continue;
    // S's last is the hang a miss puts the hero back on: a fair window of landings from it; the near misses, a way down.
    if (S.slice(1, -1).some((other) => v15Landings(c, other, all, 2).length < 2) || (S.length > 1 && v15Landings(c, S[S.length - 1]!, all, 4, 150).length < 4)) continue;
    return { to, ticks: r + hit.t - 1, r };
  }
  return null;
}

const v15Cache = new Map<number, SwingState>();
const v15Plans = new Map<number, SwingReworkPlan>();
/** The witness of a seed's swingRev 15 course (building it if need be). */
export function swingReworkPlan(seed: number): SwingReworkPlan {
  if (!v15Plans.has(seed | 0)) {
    v15Cache.delete(seed | 0);
    initV15(seed);
  }
  return v15Plans.get(seed | 0)!;
}
/** The most whole-course builds a seed may take (each carries on the seed's stream, so the course is still the seed's alone). */
const V15_BUILDS = 12;
/** The most failed blocks one build may roll back before it starts the course again. */
const V15_BLOCK_FAILURES = 40;
function initV15(seed: number): SwingState {
  const cached = v15Cache.get(seed | 0);
  if (cached) return { ...cached };
  let rng = (seed ^ 0x6a09e667) | 0;
  const draw = (bound: number) => { const r = rngBelow(rng, bound); rng = r.state; return r.value; };
  // A stretch that proves no shape from where the course has got to starts the course again, further along the same stream.
  for (let attempt = 0; attempt < V15_BUILDS; attempt++) {
    const built = buildV15(draw);
    if (!built) continue;
    built.state.rng = rng;
    if (v15Cache.size > 16) {
      v15Cache.clear();
      v15Plans.clear();
    }
    v15Cache.set(seed | 0, built.state);
    v15Plans.set(seed | 0, built.plan);
    return { ...built.state };
  }
  throw new Error(`Grappler course ${seed}: no proved course`);
}

function buildV15(draw: (n: number) => number): { state: SwingState; plan: SwingReworkPlan } | null {
  const cols = Math.trunc((START_X + 46000 * FP) / COL) + 2;
  const ceil: number[] = [];
  const floor: number[] = [];
  for (let i = 0; i < cols; i++) {
    ceil.push((40 + draw(50)) * FP);
    floor.push((790 + draw(24)) * FP);
  }
  const c: V14Course = { ceil, floor, spikes: [], anchors: [] };
  // The plan: SWING_V15_BLOCKS blocks, swinging stretches but for the ledge runs (in seeded bands; squeezes in the first and last).
  const runAt = SWING_V15_RUNS.map((_, i) => 3 + i * 6 + draw(2));
  const sections: SwingSection[] = [];
  const ledges: SwingLedge[] = [];
  const squeezes: SwingSqueeze[] = [];
  const hops: V15Hop[] = [];
  const plan: [number, number][][] = [];
  // The course starts hanging from its first hook (swingRev 4's start pose).
  c.anchors.push({ x: START_X, y: (230 + draw(60)) * FP });
  /** The bodies on the hook the next swinging stretch starts on (a hook boundary), or null when it starts on the last ledge. */
  let arrive: Body[] | null = [hangBody(c.anchors[0]!, 0)];
  const ledgeX = (i: number) => ledges[i]!.x;
  /** Builds one block on to the course so far; false if it finds no proved shape (the caller rolls the course back). */
  const buildBlock = (block: number): boolean => {
    const run = runAt.indexOf(block);
    if (run >= 0) {
      // A ledge run: rev 14's sections from the ledge the stretch before landed on.
      let squeeze = SWING_V15_SQUEEZE_RUNS.includes(run);
      for (let j = 0; j < SWING_V15_RUNS[run]!; j++) {
        const fromIndex = ledges.length - 1;
        const from = ledges[fromIndex]!;
        // The squeeze from the run's second section (one that falls back to one hook moves it on to the next).
        const want = squeeze && j >= 1 ? 2 : draw(100) < 35 ? 1 : 0;
        let made: V14Built | null = null;
        let kind = want;
        const tries = want === 2 ? 240 : 60;
        for (let attempt = 0; attempt < tries + 60 && !made; attempt++) {
          kind = attempt < tries ? want : 0;
          made = v14Section(c, from, kind, sections.length, draw);
        }
        if (!made) return false;
        if (kind === 2) squeeze = false;
        const hook0 = c.anchors.length;
        c.anchors.push(...made.hooks);
        if (made.sq) squeezes.push(made.sq);
        ledges.push({ ...made.to, section: sections.length + 1 });
        sections.push({ kind, hook0, hooks: made.hooks.length, sq: made.sq ? squeezes.length - 1 : -1, par: SWING_V14_PAR_WALK + made.fastest + SWING_V14_PAR_MARGIN, from: fromIndex, to: ledges.length - 1, x0: from.x, x1: made.to.x });
        plan.push(made.plan);
      }
      arrive = null;
      // A squeeze run whose squeeze found no shape in any of its sections is built again.
      return !squeeze;
    }
    // A swinging stretch: 3–5 hooks, ending on the next stretch's first hook, or on a ledge before a ledge run or at the end.
    const hooks = 3 + draw(3);
    const endsOnLedge = runAt.includes(block + 1) || block + 1 === SWING_V15_BLOCKS;
    const fromIndex = arrive ? -1 : ledges.length - 1;
    const fromLedges = fromIndex >= 0 ? [ledges[fromIndex]!] : [];
    const base = c.anchors.length;
    let built: { hook0: number; S: Body[]; ticks: number; to: SwingLedge | null; hops: V15Hop[]; steps: [number, number][] } | null = null;
    for (let attempt = 0; attempt < 10 && !built; attempt++) {
      c.anchors.length = base;
      let hook0: number;
      let S: Body[];
      let ticks = 0;
      if (arrive) {
        hook0 = base - 1;
        S = arrive;
        // The course's start: the first release is a tick later than after a grab (the hang is the state before tick 1).
        if (base === 1) ticks = 1;
      } else {
        // From the ledge: rev 14's one-hook geometry for the first hook, a kick off the ledge on to it.
        const from = ledges[fromIndex]!;
        const a: Anchor = { x: from.x + (75 + draw(46)) * FP, y: from.top - RADIUS - (125 + draw(56)) * FP };
        if (a.y < lerpAt(ceil, a.x) + 40 * FP) continue;
        hook0 = base;
        c.anchors.push(a);
        const kick = restBody(from.x, from.top - RADIUS);
        attach(kick, hook0, a);
        kickOff(kick);
        // The kick, and the hang a miss after grabbing it puts the hero back on.
        S = [kick, hangBody(a, hook0)];
        if (v15Rising(c, v15Pass(c, S[0]!).pass).length < 8) continue;
        ticks = SWING_V14_PAR_WALK + 1;
      }
      const points: [number, number, number][] = [];
      const stretchHops: V15Hop[] = [];
      const steps: [number, number][] = [];
      let failed = false;
      // Hooks 1 … hooks − 1 of the stretch, then (on a hook boundary) the next stretch's first.
      const hopCount = hooks - 1 + (endsOnLedge ? 0 : 1);
      for (let j = 0; j < hopCount && !failed; j++) {
        // Every hook is a restart point: the hang from it (S's last) must have a fair window on to the next.
        const hop = v15Hop(c, S, hook0, fromLedges, points, draw, S.length > 1);
        if (!hop) { failed = true; break; }
        stretchHops.push({ h: S[0]!.rope, b: c.anchors.length - 1, lo: hook0, body: { ...S[0]! }, from: fromIndex, sec: sections.length, step: j });
        steps.push([hop.r, hop.g]);
        points.push(...hop.grabs);
        ticks += hop.ticks;
        // The next stretch's first hook: its restart hangs from it, so the hang must carry on too.
        S = [...hop.S, hangBody(c.anchors[c.anchors.length - 1]!, c.anchors.length - 1)];
      }
      if (failed) continue;
      let to: SwingLedge | null = null;
      if (endsOnLedge) {
        const land = v15Land(c, S, fromLedges, draw);
        if (!land) continue;
        to = land.to;
        ticks += land.ticks;
        steps.push([land.r, -1]);
      }
      built = { hook0, S, ticks, to, hops: stretchHops, steps };
    }
    if (!built) return false;
    const k = sections.length;
    const own = built.to ? c.anchors.length - built.hook0 : c.anchors.length - 1 - built.hook0;
    const x0 = fromIndex >= 0 ? ledgeX(fromIndex) : c.anchors[built.hook0]!.x;
    if (built.to) ledges.push({ ...built.to, section: k + 1, kind: block + 1 === SWING_V15_BLOCKS ? 2 : 1 });
    sections.push({
      kind: SWING_KIND_SWING,
      hook0: built.hook0,
      hooks: own,
      sq: -1,
      par: built.ticks + SWING_V15_PAR_MARGIN + SWING_V15_PAR_HOOK * own,
      from: fromIndex,
      to: built.to ? ledges.length - 1 : -1,
      x0,
      x1: built.to ? built.to.x : c.anchors[c.anchors.length - 1]!.x,
    });
    hops.push(...built.hops);
    plan.push(built.steps);
    arrive = built.to ? null : built.S;
    return true;
  };
  // Block by block; a block that finds no proved shape is built again from where the course was, and after two
  // failures the block before it is built again too (all on the seed's stream, so the course is still the seed's alone).
  type Snap = { anchors: number; sections: number; ledges: number; squeezes: number; hops: number; plan: number; arrive: Body[] | null };
  const take = (): Snap => ({ anchors: c.anchors.length, sections: sections.length, ledges: ledges.length, squeezes: squeezes.length, hops: hops.length, plan: plan.length, arrive });
  const restore = (q: Snap) => {
    c.anchors.length = q.anchors;
    sections.length = q.sections;
    ledges.length = q.ledges;
    squeezes.length = q.squeezes;
    hops.length = q.hops;
    plan.length = q.plan;
    arrive = q.arrive;
  };
  const snaps: Snap[] = [take()];
  const fails: number[] = [];
  let failures = 0;
  for (let block = 0; block < SWING_V15_BLOCKS; ) {
    if (buildBlock(block)) {
      block += 1;
      snaps[block] = take();
      continue;
    }
    if (++failures > V15_BLOCK_FAILURES) return null;
    fails[block] = (fails[block] ?? 0) + 1;
    if (block > 0 && fails[block]! >= 2) {
      fails[block] = 0;
      block -= 1;
    }
    restore(snaps[block]!);
  }
  if (squeezes.length !== SWING_V15_SQUEEZES) return null;
  const made = reworkCourse(c, sections, ledges, squeezes, hops, draw);
  return made && { state: made.state, plan: { sections: plan, features: made.features } };
}

/**
 * The features and the starting state of a built swinging course (rev 15): gates, gems and stars each in their own
 * seeded bands over the hook-to-hook hops (one feature a hop at most for gems and stars), each proved on a line that
 * still reaches the hop's next hook; the dragon's stretch; the hero hanging from the first hook. Null if a feature
 * finds too few places (the course is built again).
 */
function reworkCourse(c: V14Course, sections: SwingSection[], ledges: SwingLedge[], squeezes: SwingSqueeze[], hops: V15Hop[], draw: (n: number) => number): { state: SwingState; features: SwingReworkPlan["features"] } | null {
  const { ceil } = c;
  const ranged = { sections };
  const sectionOf = (hook: number) => sections.findIndex((sec, k) => { const [lo, hi] = swingReworkRange(ranged, k); return sec.kind === SWING_KIND_SWING && hook >= lo && hook < hi && hook < sec.hook0 + sec.hooks; });
  /** A hop's proof material: its planned swing and the releases that reach its next hook (with their flights up to the grab). */
  const probe = (hop: V15Hop) => {
    const [lo, hi] = swingReworkRange(ranged, sectionOf(hop.h));
    const fl = hop.from >= 0 ? [ledges[hop.from]!] : [];
    const { pass } = v15Pass(c, hop.body);
    const reach: { r: number; path: Body[] }[] = [];
    for (let r = 1; r < pass.length; r++) {
      const got = v15ReleaseTo(c, pass, r, lo, hi, hop.b, fl, true);
      if (got) reach.push({ r, path: [pass[r]!, ...got.path] });
    }
    return { lo, hi, fl, pass, reach };
  };
  const probes = new Map<number, ReturnType<typeof probe>>();
  const probeOf = (i: number) => {
    let p = probes.get(i);
    if (!p) probes.set(i, (p = probe(hops[i]!)));
    return p;
  };
  type Line = { reel: number; r: number };
  const lines = new Map<object, { hop: number } & Line>();
  const bands = <T extends object>(count: number, make: (i: number) => [T, Line] | null, used: Set<number>): T[] => {
    const out: T[] = [];
    for (let n = 0; n < count; n++) {
      const lo = Math.trunc((n * hops.length) / count);
      const hi = Math.max(lo + 1, Math.trunc(((n + 1) * hops.length) / count));
      const start = lo + draw(hi - lo);
      for (let m = 0; m < hops.length; m++) {
        const i = (start + m) % hops.length;
        if (used.has(i)) continue;
        const got = make(i);
        if (got) {
          used.add(i);
          out.push(got[0]);
          lines.set(got[0], { hop: i, ...got[1] });
          break;
        }
      }
    }
    return out;
  };
  const touches = (path: readonly Body[], x: number, y: number, r: number) => path.some((b) => (b.x - x) ** 2 + (b.y - y) ** 2 <= r * r);
  const passesGate = (path: readonly Body[], g: SwingGate) => {
    for (let i = 1; i < path.length; i++) {
      const p0 = path[i - 1]!;
      const p1 = path[i]!;
      if (!(p0.x < g.x && p1.x >= g.x)) continue;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const y = p0.y + Math.trunc((dy * (g.x - p0.x)) / dx);
      if (dx * dx + dy * dy >= SWING_V15_GATE_SPEED * SWING_V15_GATE_SPEED * FP * FP && y >= g.y0 && y <= g.y1) return true;
    }
    return false;
  };
  // Speed gates: on the natural line (the middle release of the widest window reaching the next hook), where it flies fast.
  const gates = bands(SWING_V15_GATES, (i) => {
    const { pass, reach } = probeOf(i);
    if (reach.length < 4) return null;
    const runs: (typeof reach)[] = [];
    for (const q of reach) {
      const last = runs[runs.length - 1];
      if (last && last[last.length - 1]!.r === q.r - 1) last.push(q);
      else runs.push([q]);
    }
    const widest = runs.reduce((p, q) => (q.length > p.length ? q : p));
    // The middle release of the window, then its neighbours outwards.
    const mid = Math.trunc(widest.length / 2);
    for (let d = 0; d < widest.length; d++) {
      const q = widest[mid + (d % 2 ? -(d + 1) / 2 : d / 2)];
      if (!q) continue;
      const path = q.path;
      for (let n = 3; n < path.length - 3; n++) {
        const at = path[n]!;
        const prev = path[n - 1]!;
        if ((at.x - prev.x) ** 2 + (at.y - prev.y) ** 2 < (SWING_V15_GATE_SPEED + 0.3) ** 2 * FP * FP) continue;
        const gate: SwingGate = { x: at.x, y0: at.y - SWING_V14_GATE_HALF, y1: at.y + SWING_V14_GATE_HALF };
        if (gate.y0 < lerpAt(ceil, gate.x) + 30 * FP || passesGate(pass, gate)) continue;
        const takers = reach.filter((q) => passesGate(q.path, gate)).length;
        if (takers >= 2 && takers < reach.length) return [gate, { reel: -1, r: q.r }];
      }
    }
    return null;
  }, new Set());
  // Gems: on a harder line (a flight to the next hook only two or three of the reaching releases share), never touched on the rope.
  const used = new Set<number>();
  const gems = bands(SWING_V15_GEMS, (i) => {
    const { pass, reach } = probeOf(i);
    if (reach.length < 5) return null;
    const options: [[number, number], number][] = [];
    for (const { path, r } of reach) {
      for (let n = 3; n < path.length - 2; n += 2) {
        const p = path[n]!;
        if (p.y < lerpAt(ceil, p.x) + 30 * FP || touches(pass, p.x, p.y, SWING_GEM_TOUCH + 4 * FP)) continue;
        const takers = reach.filter((q) => touches(q.path, p.x, p.y, SWING_GEM_TOUCH)).length;
        if (takers >= 2 && takers <= 3 && takers * 2 < reach.length) options.push([[p.x, p.y], r]);
      }
    }
    if (!options.length) return null;
    const [spot, r] = options[draw(options.length)]!;
    return [spot, { reel: -1, r }];
  }, used);
  // Stars: on a tighter swing (the rope reeled in early on the hook), where the plain swing never passes; it still reaches the next hook.
  const starSpots = bands(SWING_V15_STARS, (i) => {
    const hop = hops[i]!;
    const { lo, hi, fl, pass } = probeOf(i);
    for (const u of [6, 8, 10, 12, 14, 16, 18]) {
      if (u >= pass.length) break;
      const body = { ...pass[u]! };
      startReel(body, SWING_REEL_UP);
      const { pass: reeled, died } = v15Pass(c, body);
      if (died) continue;
      const goes: number[] = [];
      for (let r = 1; r < reeled.length; r++) if (v15ReleaseTo(c, reeled, r, lo, hi, hop.b, fl)) goes.push(r);
      if (goes.length < 2) continue;
      const gap = (b: Body) => { let d = Infinity; for (const q of pass) d = Math.min(d, (q.x - b.x) ** 2 + (q.y - b.y) ** 2); return d; };
      const until = goes[goes.length - 2]!;
      let at = Math.min(8, until);
      for (let n = at; n <= until; n++) if (gap(reeled[n]!) > gap(reeled[at]!)) at = n;
      const low = reeled[at]!;
      if (gap(low) < (SWING_STAR_TOUCH + 4 * FP) ** 2 || low.y < lerpAt(ceil, low.x) + 30 * FP) continue;
      return [[low.x, low.y] as [number, number], { reel: u, r: goes[goes.length - 1]! }];
    }
    return null;
  }, used);
  // Every course carries the full count of each (the pickups' 30 points need them all); a short one is built again.
  if (gates.length !== SWING_V15_GATES || gems.length !== SWING_V15_GEMS || starSpots.length !== SWING_V15_STARS) return null;
  gems.sort((p, q) => p[0] - q[0]);
  starSpots.sort((p, q) => p[0] - q[0]);
  gates.sort((p, q) => p.x - q.x);
  const length = sections[sections.length - 1]!.x1! - sections[0]!.x0!;
  let chaseFrom = sections.findIndex((sec) => 1000 * (sec.x0! - sections[0]!.x0!) >= SWING_V15_CHASE_FROM * length);
  if (chaseFrom < 0) chaseFrom = sections.length;
  const body = hangBody(c.anchors[0]!, 0);
  const features: SwingReworkPlan["features"] = [];
  for (const [kind, list] of [["gate", gates], ["gem", gems], ["star", starSpots]] as const) {
    list.forEach((item, index) => {
      const line = lines.get(item)!;
      features.push({ kind, index, sec: hops[line.hop]!.sec, step: hops[line.hop]!.step, reel: line.reel, r: line.r });
    });
  }
  const state: SwingState = {
    ...body,
    tick: 0,
    rng: 0,
    camX: body.x - SWING_LEAD_V13,
    maxX: body.x,
    grabTick: -100,
    ended: 0,
    endedTick: 0,
    ceil: c.ceil,
    floor: c.floor,
    anchors: c.anchors,
    spikes: [],
    assault: 1,
    rework: 1,
    chaseFrom,
    hangHook: 0,
    worldW: SWING_V13_W,
    worldH: SWING_V13_H,
    sections,
    squeezes,
    ledges,
    ledgeOn: -1,
    ledgeHold: 0,
    sec: 0,
    secStart: 0,
    secTicks: sections.map(() => 0),
    secReach: sections[0]!.x0!,
    restarts: 0,
    respawn: 0,
    missTick: 0,
    gems,
    gemsTaken: 0,
    gates,
    gatesLit: 0,
    starSpots,
    starsTaken: [],
    stars: 0,
    bankGems: 0,
    bankGates: 0,
    bankStars: [],
    chaseX: 0,
    chaseY: 0,
    caught: 0,
  };
  return { state, features };
}

/** The rope's body (swingRev 15's look-ahead kit below). */
export type SwingBody = Body;
/**
 * The rope physics and swingRev 15's grab rule, for the skill-band bots' look-ahead (perception only, scripts/arcade-
 * skill-bands/bots/swingRework.ts): nothing in play reads it, and every input a bot makes still goes through the step.
 */
export const swingBotKit = {
  body: (s: SwingState): Body => ({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, rope: s.rope, len: s.len, th: s.th, om: s.om, grabLen: s.grabLen, reelTo: s.reelTo, reelLeft: s.reelLeft, pumps: s.pumps }),
  move: (b: Body, s: SwingState): boolean => moveBody(b, s),
  attach: (b: Body, i: number, s: SwingState): void => attach(b, i, s.anchors[i]!),
  detach: (b: Body, s: SwingState): void => detach(b, s.anchors[b.rope]!),
  reel: (b: Body): void => startReel(b, SWING_REEL_UP),
  target: (s: SwingState, k: number, x: number, y: number): number => {
    const [lo, hi] = swingReworkRange(s, k);
    return rangeTarget(s.anchors, lo, hi, x, y);
  },
  radius: RADIUS,
  reach: REACH,
};

/** swingRev 15: the swinging course. Band 3 like rev 11, 13 and 14; the score is swingScoreV15. */
export const swingReworkGame: typeof swingGame = { ...swingTunecGame, init: (seed) => ({ ...bandInit(initV15(seed)), band: 3 }) };
