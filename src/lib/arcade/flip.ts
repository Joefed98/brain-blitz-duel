/**
 * Flip — a corridor runner. The runner runs on the floor or the ceiling; a tap
 * (k = 0) flips gravity and it arcs across in 12 ticks. Hazards sit on one
 * surface at a time; the course is drawn at init and checked for survivability.
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
import { bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";
import { isin, TRIG_ONE } from "./trig";
import { drawFlipHazard, flipSurfaceLine } from "./flip.renderer";

/* ============================== Constants ============================== */

const FP = 256;
export const FLIP_WORLD_W = 390;
export const FLIP_WORLD_H = 620;
export const FLIP_RUN_TICKS = 60 * TICKS_PER_SECOND;
export const FLIP_INPUT_TAP = 0;
export const FLIP_ARC_TICKS = 12;
/** The course check only flips after this long on a surface. */
const SOLVER_LANDED = 14;

const SPEED_START = 1024;
const SPEED_STEP = 90;
const SPEED_STEP_TICKS = 3 * TICKS_PER_SECOND;
const SPEED_CAP = 2304;
/** After this, the gap between consecutive hazards never exceeds MAX_GAP_TICKS of travel. */
const TIGHT_AFTER = 5 * TICKS_PER_SECOND;
const MAX_GAP_TICKS = 45;
const CLEAR_TICKS = 3 * TICKS_PER_SECOND;

export const FLIP_FLOOR_Y = 440;
export const FLIP_CEIL_Y = 180;
const RUNNER_X = 90;
const RUNNER_HALF = 12 * FP;

export const FLIP_SPIKE = 0;
export const FLIP_GAP = 1;
export const FLIP_OVERHANG = 2;
/** flipRev 2: a tile that cracks on first contact and breaks FLIP_CRUMBLE_TICKS later. */
export const FLIP_CRUMBLE = 3;

/* ------------------------- flipRev 2 (Oct 2026) ------------------------- */

/**
 * Stored as puzzle.flipRev. Rev 2: the bend starts at 15 s, a larger runner
 * (32 px wide), crumbling tiles from 8 s, ten gold stars on a proved route, and
 * survival worth up to 130 plus 2 per star. Rounds without flipRev replay on the
 * original rules.
 */
export const FLIP_REV = 2;
export const FLIP_CRUMBLE_TICKS = 24;
export const FLIP_CRUMBLE_FROM = 8 * TICKS_PER_SECOND;
export const FLIP_STARS = 10;
export const FLIP_STAR_POINTS = 2;
export const FLIP_SURVIVAL_POINTS_V2 = 130;
/** Star pickup reach either side of its centre, px (added to the runner half-width). */
export const FLIP_STAR_R = 9;
export const FLIP_RUNNER_HALF_PX = 12;
export const FLIP_RUNNER_HALF_PX_V2 = 16;
/** Runner box height and its centre's distance from the surface, px. */
export const FLIP_RUNNER_H_PX = 28;
export const FLIP_RUNNER_H_PX_V2 = 36;

export interface FlipRules {
  rev: number;
  runnerHalf: number;
  warpFrom: number;
  crumbles: boolean;
  stars: boolean;
}

const RULES_V1: FlipRules = { rev: 1, runnerHalf: FLIP_RUNNER_HALF_PX * FP, warpFrom: 20 * TICKS_PER_SECOND, crumbles: false, stars: false };
const RULES_V2: FlipRules = { rev: FLIP_REV, runnerHalf: FLIP_RUNNER_HALF_PX_V2 * FP, warpFrom: 15 * TICKS_PER_SECOND, crumbles: true, stars: true };

export function flipRulesFor(rev?: number | null): FlipRules {
  return rev === FLIP_REV ? RULES_V2 : RULES_V1;
}
export const FLIP_DECISION_OVERHANG = 1;
export const FLIP_DECISION_PAIRED_SPIKES = 2;
export const FLIP_DECISION_FALSE_GAP = 3;
/** flipRev 8: a moving spike (it counts towards the decision share). */
export const FLIP_DECISION_MOVER = 4;

/** Shared-band bends: long sweeps until 45 s, then a continuous late-run ramp. */
export const FLIP_WARP_FROM = 20 * TICKS_PER_SECOND;
const WARP_RAMP = 5 * TICKS_PER_SECOND;
const WARP_PERIOD_MIN = 2 * TICKS_PER_SECOND;
const WARP_PERIOD_SPAN = TICKS_PER_SECOND + 1;
const WARP_ANGLE = 65536;
/** Integer control points; interpolate length/displacement/period, never reset phase.
 * length is a complete spatial wave in world px; period is the fastest seeded
 * complete direction cycle in ticks (the existing seed stretches it up to 1.5x).
 */
export const FLIP_BEND_TABLE = [
  { tick: FLIP_WARP_FROM, length: 1560, displacement: 145, period: 720 },
  { tick: 45 * TICKS_PER_SECOND, length: 1560, displacement: 145, period: 720 },
  { tick: 50 * TICKS_PER_SECOND, length: 1040, displacement: 145, period: 360 },
  { tick: 55 * TICKS_PER_SECOND, length: 520, displacement: 145, period: 180 },
  { tick: FLIP_RUN_TICKS, length: 260, displacement: 145, period: WARP_PERIOD_MIN },
] as const;

const FLIP_BEND_TABLE_V2 = [{ ...FLIP_BEND_TABLE[0], tick: 15 * TICKS_PER_SECOND }, ...FLIP_BEND_TABLE.slice(1)] as const;

export function flipBendAt(tick: number, table: readonly { tick: number; length: number; displacement: number; period: number }[] = FLIP_BEND_TABLE) {
  const first = table[0]!;
  let previous: { tick: number; length: number; displacement: number; period: number } = first;
  for (const next of table.slice(1)) {
    if (tick <= next.tick) {
      const elapsed = Math.max(0, tick - previous.tick);
      const duration = next.tick - previous.tick;
      const interpolate = (a: number, b: number) => a + Math.trunc(((b - a) * elapsed) / duration);
      return {
        length: interpolate(previous.length, next.length),
        displacement: interpolate(previous.displacement, next.displacement),
        period: interpolate(previous.period, next.period),
      };
    }
    previous = next;
  }
  return { length: previous.length, displacement: previous.displacement, period: previous.period };
}

/** Integrated fixed-point angle prevents phase jumps when the period changes. */
function warpPhaseTable(from: number, table: readonly { tick: number; length: number; displacement: number; period: number }[]): readonly number[] {
  const out = [0];
  let phase = 0;
  for (let tick = 1; tick <= FLIP_RUN_TICKS; tick++) {
    if (tick > from) phase += Math.trunc((WARP_ANGLE * FP) / flipBendAt(tick, table).period);
    out.push(phase);
  }
  return out;
}
const WARP_PHASE_AT = warpPhaseTable(FLIP_WARP_FROM, FLIP_BEND_TABLE);
const WARP_PHASE_AT_V2 = warpPhaseTable(15 * TICKS_PER_SECOND, FLIP_BEND_TABLE_V2);
/** flipRev 4 (Tuning C): the rev-2 bend, starting at 10 s instead of 15 s. */
export const FLIP_WARP_FROM_V4 = 10 * TICKS_PER_SECOND;
const FLIP_BEND_TABLE_V4 = [{ ...FLIP_BEND_TABLE[0], tick: FLIP_WARP_FROM_V4 }, ...FLIP_BEND_TABLE.slice(1)] as const;
const WARP_PHASE_AT_V4 = warpPhaseTable(FLIP_WARP_FROM_V4, FLIP_BEND_TABLE_V4);

export const FLIP_INPUT_RANGES: readonly InputRange[] = [inputRange(FLIP_INPUT_TAP)];

export function flipSpeed(tick: number): number {
  return Math.min(SPEED_CAP, SPEED_START + SPEED_STEP * Math.trunc(tick / SPEED_STEP_TICKS));
}

const X_AT: readonly number[] = (() => {
  const out = [0];
  let x = 0;
  for (let t = 1; t <= FLIP_RUN_TICKS; t++) {
    x += flipSpeed(t);
    out.push(x);
  }
  return out;
})();

/* ================================ Course =============================== */

export interface FlipSeg {
  x0: number;
  x1: number;
  /** 0 floor, 1 ceiling. */
  side: number;
  kind: number;
  /** Shared non-zero id for segments belonging to one decision pattern. */
  group: number;
  /** Zero for a simple hazard; otherwise one of the decision constants. */
  decision: number;
  /** flipRev 8 moving spikes only: slide amplitude (1/256 px), period (ticks) and phase (angle units). */
  amp?: number;
  per?: number;
  ph?: number;
}

/** Runner timers: side is the surface it is on or heading to; flipT > 0 while airborne. */
interface Mover {
  side: number;
  flipT: number;
}

function moveRunner(m: Mover, tap: boolean): void {
  if (m.flipT > 0) m.flipT -= 1;
  else if (tap) {
    m.side ^= 1;
    m.flipT = FLIP_ARC_TICKS;
  }
}

function blocked(m: Mover, x: number, seg: FlipSeg, half = RUNNER_HALF): boolean {
  return m.flipT === 0 && m.side === seg.side && x + half >= seg.x0 && x - half <= seg.x1;
}

/** Solver codes: side | flipT << 1 | landed << 5 | crumble contact << 9 | star taken << 14. */
const pack = (side: number, flipT: number, landed: number, crumble = 0, got = 0) =>
  side | (flipT << 1) | (landed << 5) | (crumble << 9) | (got << 14);
const CRUMBLE_CAP = FLIP_CRUMBLE_TICKS + 1;

/** The crumble tile under the runner's x-span, if any (crumbles are never adjacent). */
function crumbleUnder(segs: readonly FlipSeg[], x: number, half: number): FlipSeg | null {
  for (const seg of segs) if (seg.kind === FLIP_CRUMBLE && x + half >= seg.x0 && x - half <= seg.x1) return seg;
  return null;
}

/**
 * One solver tick for every code in `set` against `hazards`. Crumble contact
 * counts ticks since first touching the tile under the runner (1 on the first
 * tick); the tile is broken once FLIP_CRUMBLE_TICKS have passed. Optional star:
 * standing on its side within reach sets the taken bit.
 */
function solverTick(set: readonly number[], t: number, hazards: readonly FlipSeg[], rules: FlipRules,
  star?: { x: number; side: number }): number[] {
  const x = X_AT[t]!;
  const half = rules.runnerHalf;
  const onCrumble = rules.crumbles && crumbleUnder(hazards, x, half) !== null;
  const seen = new Set<number>();
  const out: number[] = [];
  for (const code of set) {
    const side = code & 1;
    const flipT = (code >> 1) & 15;
    const landed = (code >> 5) & 15;
    const crumble = onCrumble ? (code >> 9) & 31 : 0;
    const got = (code >> 14) & 1;
    for (const tap of [false, true]) {
      if (tap && (flipT > 0 || landed < SOLVER_LANDED)) continue;
      const m: Mover = { side, flipT };
      moveRunner(m, tap);
      let c = crumble > 0 ? Math.min(CRUMBLE_CAP, crumble + 1) : 0;
      let dead = false;
      for (const seg of hazards) {
        if (!blocked(m, x, seg, half)) continue;
        if (seg.kind !== FLIP_CRUMBLE) dead = true;
        else if (c === 0) c = 1;
        else if (c - 1 >= FLIP_CRUMBLE_TICKS) dead = true;
        if (dead) break;
      }
      if (dead) continue;
      const nl = m.flipT > 0 ? 0 : Math.min(SOLVER_LANDED, landed + 1);
      const taken = got || (star && m.flipT === 0 && m.side === star.side &&
        Math.abs(x - star.x) <= half + FLIP_STAR_R * FP) ? 1 : 0;
      const next = pack(m.side, m.flipT, nl, c, taken);
      if (seen.has(next)) continue;
      seen.add(next);
      out.push(next);
    }
  }
  return out;
}

function buildCourse(seed: number, rules: FlipRules = RULES_V1): { segs: FlipSeg[]; rng: number } {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const half = rules.runnerHalf;
  let frontier: number[] = [pack(0, 0, SOLVER_LANDED)];
  let tick = 0;
  const end = X_AT[FLIP_RUN_TICKS]!;
  const segs: FlipSeg[] = [];
  let group = 0;
  let groupsAfterTen = 0;
  let decisionsAfterTen = 0;
  let lastWasCrumble = false;

  /** Advance the frontier until the runner has passed xEnd, dying on `hazards`. */
  const advance = (from: number[], t0: number, xEnd: number, hazards: readonly FlipSeg[]) => {
    let set = from;
    let t = t0;
    while (t < FLIP_RUN_TICKS && X_AT[t]! - half <= xEnd) {
      t += 1;
      set = solverTick(set, t, hazards, rules);
      if (!set.length) break;
    }
    return { set, tick: t };
  };

  let x = X_AT[CLEAR_TICKS]!;
  let lastEnd = x;
  while (x < end) {
    const speed = flipSpeed(tick);
    // Spacing scales with speed so flips stay as far apart in time as at the start.
    const tight = x >= X_AT[TIGHT_AFTER]!;
    // Budget measured from the last hazard's end, so a skipped slot never widens the gap.
    const budget = Math.max(speed * 4, speed * MAX_GAP_TICKS - (x - lastEnd) - speed * 2);
    const gap = tight
      ? Math.min(budget, speed * (FLIP_ARC_TICKS + SOLVER_LANDED + draw(MAX_GAP_TICKS - FLIP_ARC_TICKS - SOLVER_LANDED + 1)))
      : Math.trunc(((33 + draw(88)) * FP * speed) / SPEED_START);
    const start = x + gap;
    if (start >= end) break;
    let accepted: FlipSeg[] = [];
    let result: { set: number[]; tick: number } | null = null;
    const afterTen = start >= X_AT[10 * TICKS_PER_SECOND]!;
    const requireDecision = afterTen && decisionsAfterTen * 100 < (groupsAfterTen + 1) * 75;
    // Rev 2: crumbling tiles join the plain patterns from 8 s, never twice running and never crowded.
    const crumbleOk = rules.crumbles && start >= X_AT[FLIP_CRUMBLE_FROM]! && !lastWasCrumble &&
      start - lastEnd >= 2 * half + 8 * speed;
    for (let attempt = 0; attempt < 48 && !result; attempt++) {
      const pattern = requireDecision && attempt < 40 ? 3 + draw(3) : draw(rules.crumbles ? 8 : 6);
      const side = draw(2);
      const len = Math.trunc(((40 + draw(120)) * FP * speed) / SPEED_START);
      let trial: FlipSeg[];
      const nextGroup = group + 1;
      if (pattern >= 6) {
        if (!crumbleOk) continue;
        // Longer than the runner can cross before it breaks, so a second flip is needed.
        const crumbleLen = speed * (FLIP_CRUMBLE_TICKS + 18 + draw(30));
        trial = [{ x0: start, x1: start + crumbleLen, side, kind: FLIP_CRUMBLE, group: nextGroup, decision: 0 }];
      } else if (pattern === 3) {
        // Overhang pair: block on one side, then soon after on the other — two quick flips.
        const len1 = (30 + draw(40)) * FP;
        const between = speed * (FLIP_ARC_TICKS + SOLVER_LANDED + 4 + draw(12));
        trial = [
          { x0: start, x1: start + len1, side, kind: FLIP_OVERHANG, group: nextGroup, decision: FLIP_DECISION_OVERHANG },
          { x0: start + len1 + between, x1: start + len1 + between + len1, side: side ^ 1, kind: FLIP_OVERHANG, group: nextGroup, decision: FLIP_DECISION_OVERHANG },
        ];
      } else if (pattern === 4) {
        // Offset opposing spikes: the safe surface changes between them.
        const spikeLen = (32 + draw(34)) * FP;
        const between = speed * (25 + draw(16));
        trial = [
          { x0: start, x1: start + spikeLen, side, kind: FLIP_SPIKE, group: nextGroup, decision: FLIP_DECISION_PAIRED_SPIKES },
          { x0: start + spikeLen + between, x1: start + spikeLen + between + spikeLen, side: side ^ 1, kind: FLIP_SPIKE, group: nextGroup, decision: FLIP_DECISION_PAIRED_SPIKES },
        ];
      } else if (pattern === 5) {
        // The visible gap invites a flip, then an offset spike on that surface forces the return.
        const gapLen = (55 + draw(45)) * FP;
        const offset = speed * (FLIP_ARC_TICKS + 8 + draw(12));
        trial = [
          { x0: start, x1: start + gapLen, side, kind: FLIP_GAP, group: nextGroup, decision: FLIP_DECISION_FALSE_GAP },
          { x0: start + gapLen + offset, x1: start + gapLen + offset + 38 * FP, side: side ^ 1, kind: FLIP_SPIKE, group: nextGroup, decision: FLIP_DECISION_FALSE_GAP },
        ];
      } else {
        trial = [{ x0: start, x1: start + len, side, kind: pattern === 2 ? FLIP_GAP : FLIP_SPIKE, group: nextGroup, decision: 0 }];
      }
      const last = trial[trial.length - 1]!;
      if (last.x1 >= end) continue;
      const tried = advance(frontier, tick, last.x1, trial);
      if (tried.set.length) {
        accepted = trial;
        result = tried;
      }
    }
    if (!result) {
      // Nothing fitted: move on only a little so the following gap stays tight.
      const step = tight ? x + speed * 6 : start;
      result = advance(frontier, tick, step, []);
      x = step;
    } else {
      segs.push(...accepted);
      group += 1;
      lastWasCrumble = accepted[0]?.kind === FLIP_CRUMBLE;
      if (afterTen) {
        groupsAfterTen += 1;
        if (accepted[0]?.decision) decisionsAfterTen += 1;
      }
      x = accepted[accepted.length - 1]!.x1;
      lastEnd = x;
    }
    frontier = result.set;
    tick = result.tick;
    if (tick >= FLIP_RUN_TICKS) break;
  }
  return { segs, rng };
}

export interface FlipStar {
  /** World x (1/256 px) and the surface it sits on (0 floor, 1 ceiling). */
  x: number;
  side: number;
}

/** Ten seconds marks the stars aim for, then nudged forward until each is collectible. */
const STAR_SECONDS = Array.from({ length: FLIP_STARS }, (_, k) => 4 + (k * 11) / 2);

/**
 * Places ten stars that one surviving route collects every one of: the solver
 * runs the whole course, keeps only routes that took each star so far, and the
 * stars sit clear of every hazard on their surface. Null if a placement fails.
 */
function placeStars(segs: readonly FlipSeg[], rng: number, rules: FlipRules): { stars: FlipStar[]; rng: number } | null {
  let state = rng;
  const draw = (bound: number) => {
    const r = rngBelow(state, bound);
    state = r.state;
    return r.value;
  };
  const half = rules.runnerHalf;
  const reach = half + FLIP_STAR_R * FP;
  const near = (t: number) => {
    const x = X_AT[t]!;
    return segs.filter((seg) => seg.x0 <= x + half + 64 * FP && seg.x1 >= x - half - 64 * FP);
  };
  const clear = (x: number, side: number) =>
    !segs.some((seg) => seg.side === side && seg.x0 <= x + reach + 8 * FP && seg.x1 >= x - reach - 8 * FP);
  let set = [pack(0, 0, SOLVER_LANDED)];
  let t = 0;
  const stars: FlipStar[] = [];
  for (const second of STAR_SECONDS) {
    const target = X_AT[Math.trunc(second * TICKS_PER_SECOND)]!;
    const firstSide = draw(2);
    let placed = false;
    for (let j = 0; j < 16 && !placed; j++) {
      const x = target + j * 24 * FP;
      for (const side of [firstSide, firstSide ^ 1]) {
        if (!clear(x, side)) continue;
        // Run up to the star, then through its reach, keeping only routes that took it.
        let trySet = set;
        let tt = t;
        while (tt < FLIP_RUN_TICKS && X_AT[tt + 1]! < x - reach) {
          tt += 1;
          trySet = solverTick(trySet, tt, near(tt), rules);
        }
        trySet = trySet.map((code) => code & ~(1 << 14));
        while (tt < FLIP_RUN_TICKS && X_AT[tt]! <= x + reach) {
          tt += 1;
          trySet = solverTick(trySet, tt, near(tt), rules, { x, side });
        }
        const took = trySet.filter((code) => (code >> 14) & 1);
        if (!took.length) continue;
        stars.push({ x, side });
        set = took.map((code) => code & ~(1 << 14));
        t = tt;
        placed = true;
        break;
      }
    }
    if (!placed) return null;
  }
  while (t < FLIP_RUN_TICKS && set.length) {
    t += 1;
    set = solverTick(set, t, near(t), rules);
  }
  return set.length ? { stars, rng: state } : null;
}

/** Hazard statistics for reports: decision share after 10 s, hazards in a 10 s window, largest gap after 5 s (ticks). */
export function flipCourseStats(seed: number) {
  const course = buildCourse(seed);
  const at = (sec: number) => X_AT[Math.min(FLIP_RUN_TICKS, sec * TICKS_PER_SECOND)]!;
  const groupsIn = (a: number, b: number) =>
    new Set(course.segs.filter((seg) => seg.x0 >= at(a) && seg.x0 < at(b)).map((seg) => seg.group)).size;
  let maxGapTicks = 0;
  for (let i = 1; i < course.segs.length; i++) {
    const prev = course.segs[i - 1]!;
    const seg = course.segs[i]!;
    if (prev.x1 < at(5)) continue;
    const t0 = X_AT.findIndex((v) => v >= prev.x1);
    const t1 = X_AT.findIndex((v) => v >= seg.x0);
    if (t0 >= 0 && t1 >= 0) maxGapTicks = Math.max(maxGapTicks, t1 - t0);
  }
  return { around30: groupsIn(25, 35), around60: groupsIn(50, 60), maxGapTicks };
}

export function flipDecisionShare(seed: number): { decisions: number; groups: number; share: number } {
  const course = buildCourse(seed);
  const afterTen = X_AT[10 * TICKS_PER_SECOND]!;
  const groups = new Map<number, boolean>();
  for (const seg of course.segs) {
    if (seg.x0 < afterTen) continue;
    groups.set(seg.group, seg.decision !== 0);
  }
  const decisions = [...groups.values()].filter(Boolean).length;
  return { decisions, groups: groups.size, share: groups.size ? decisions / groups.size : 0 };
}

/* ================================ State ================================ */

export interface FlipState extends BandFields {
  tick: number;
  rng: number;
  x: number;
  side: number;
  flipT: number;
  cursor: number;
  ended: number;
  endedTick: number;
  segs: FlipSeg[];
  /** Seeded warp period (ticks) and shared phase for the floor and ceiling (angle units). */
  warpPeriod: number;
  warpFloor: number;
  warpCeil: number;
  /** Runner's warped offset this tick, px (follows the surface it is on or arcing between). */
  warpY: number;
  /** flipRev 2 only (absent on original rounds): the stamp, stars, taken-star bits and crumble contacts. */
  rev?: number;
  stars?: FlipStar[];
  got?: number;
  /** Flattened [segment index, first-contact tick] pairs, in contact order. */
  cracks?: number[];
  /** flipRev 4 only (Tuning C): 1 = the bend starts at 10 s and the run scores on FLIP_V4_BAND_CURVE. Absent on every earlier round. */
  tunec?: number;
  /** flipRev 8 only (the expansion, absent on every earlier round): see FlipV8Fields. */
  exp?: number;
  v8?: FlipV8Course;
  arcN?: number;
  land?: number;
  chain?: number;
  combos?: number;
  comboPts?: number;
  save?: number;
  saves?: number;
  inv?: number;
  cpPassed?: number;
  cleanCps?: number;
  zoneSaves?: number;
  zonesOk?: number;
  trailGot?: number[];
  pause?: number;
  lost?: number;
  /** flipRev 8 sweet spots: taken bits (course.sweets order) and the tick of the latest sweet landing (art's glint). */
  sweetGot?: number;
  sweetT?: number;
}

export function flipWarpAmp(tick: number, rev?: number | null, early?: number): number {
  // flipRev 4 (`early` = the state's tunec) bends from 10 s on the rev-2 table.
  const from = early ? FLIP_WARP_FROM_V4 : flipRulesFor(rev).warpFrom;
  if (tick <= from) return 0;
  // Smooth integer onset: zero slope at both ends, full displacement 5 s after the start.
  const elapsed = Math.min(WARP_RAMP, tick - from);
  const bend = early ? flipBendAt(tick, FLIP_BEND_TABLE_V4) : rev === FLIP_REV ? flipBendAt(tick, FLIP_BEND_TABLE_V2) : flipBendAt(tick);
  return Math.trunc((bend.displacement * elapsed * elapsed * (3 * WARP_RAMP - 2 * elapsed)) / (WARP_RAMP * WARP_RAMP * WARP_RAMP));
}

/** Integer vertical offset (px) of one surface at world x (FP) on this tick. */
export function flipWarpAt(s: FlipState, _side: number, worldX: number, tick = s.tick): number {
  const amp = flipWarpAmp(tick, s.rev, s.tunec);
  if (amp === 0) return 0;
  const base = s.warpFloor; // Both boundaries belong to one constant-width band.
  const v2 = s.rev === FLIP_REV;
  const bend = s.tunec ? flipBendAt(tick, FLIP_BEND_TABLE_V4) : v2 ? flipBendAt(tick, FLIP_BEND_TABLE_V2) : flipBendAt(tick);
  const along = Math.trunc(((worldX - s.x) * WARP_ANGLE) / (FP * bend.length));
  const phase = (s.tunec ? WARP_PHASE_AT_V4 : v2 ? WARP_PHASE_AT_V2 : WARP_PHASE_AT)[clampInt(tick, 0, FLIP_RUN_TICKS)] ?? 0;
  const time = Math.trunc((phase * WARP_PERIOD_MIN) / (FP * s.warpPeriod));
  return Math.trunc((amp * isin((base + along + time) & (WARP_ANGLE - 1))) / TRIG_ONE);
}

const cache = new Map<number, { segs: FlipSeg[]; rng: number }>();
const cacheV2 = new Map<number, { segs: FlipSeg[]; rng: number; stars: FlipStar[] }>();

/** Rev-2 course: hazards and crumbles, then ten stars one route can take; re-rolled if stars fail. */
function buildCourseV2(seed: number): { segs: FlipSeg[]; rng: number; stars: FlipStar[] } {
  for (let attempt = 0; attempt < 6; attempt++) {
    const course = buildCourse(attempt === 0 ? seed : (Math.imul(seed | 0, 0x9e3779b1) + attempt) | 0, RULES_V2);
    const placed = placeStars(course.segs, course.rng, RULES_V2);
    if (placed) return { segs: course.segs, rng: placed.rng, stars: placed.stars };
  }
  const course = buildCourse(seed, RULES_V2);
  return { ...course, stars: [] };
}

function initV2(seed: number): FlipState {
  let course = cacheV2.get(seed | 0);
  if (!course) {
    course = buildCourseV2(seed);
    if (cacheV2.size > 16) cacheV2.clear();
    cacheV2.set(seed | 0, course);
  }
  return { ...initFrom(course), rev: FLIP_REV, stars: course.stars, got: 0, cracks: [] };
}

function init(seed: number): FlipState {
  let course = cache.get(seed | 0);
  if (!course) {
    course = buildCourse(seed);
    if (cache.size > 16) cache.clear();
    cache.set(seed | 0, course);
  }
  return initFrom(course);
}

function initFrom(course: { segs: FlipSeg[]; rng: number }): FlipState {
  const period = rngBelow(course.rng, WARP_PERIOD_SPAN);
  const floor = rngBelow(period.state, 65536);
  const ceil = rngBelow(floor.state, 65536);
  return {
    tick: 0,
    rng: ceil.state,
    x: 0,
    side: 0,
    flipT: 0,
    cursor: 0,
    ended: 0,
    endedTick: 0,
    segs: course.segs,
    warpPeriod: WARP_PERIOD_MIN + period.value,
    warpFloor: floor.value,
    warpCeil: floor.value,
    warpY: 0,
  };
}

function isOver(state: FlipState): boolean {
  return state.ended !== 0;
}

function step(state: FlipState, input: ArcadeInputEvent | null): FlipState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: FlipState = { ...state, tick };
  moveRunner(s, input !== null && input.k === FLIP_INPUT_TAP);
  s.x = X_AT[tick]!;
  let cursor = s.cursor;
  const v2 = s.rev === FLIP_REV;
  const half = v2 ? RULES_V2.runnerHalf : RUNNER_HALF;
  while (cursor < s.segs.length && s.segs[cursor]!.x1 < s.x - half) cursor += 1;
  s.cursor = cursor;
  // The runner rides the warped surface; hazards sit on the same warped surface, so contact is
  // tested where both are (the shared x-span on that surface).
  {
    const on = flipWarpAt(s, s.side, s.x, tick);
    if (s.flipT === 0) s.warpY = on;
    else {
      const from = flipWarpAt(s, s.side ^ 1, s.x, tick);
      s.warpY = from + Math.trunc(((on - from) * (FLIP_ARC_TICKS - s.flipT)) / FLIP_ARC_TICKS);
    }
  }
  let hit = false;
  for (let i = cursor; i < s.segs.length; i++) {
    const seg = s.segs[i]!;
    if (seg.x0 > s.x + half) break;
    if (!blocked(s, s.x, seg, half)) continue;
    if (seg.kind !== FLIP_CRUMBLE) {
      hit = true;
      continue;
    }
    // A crumble tile cracks on first contact and is gone FLIP_CRUMBLE_TICKS later.
    const first = flipCrackTick(s, i);
    if (first === null) s.cracks = [...(s.cracks ?? []), i, tick];
    else if (tick - first >= FLIP_CRUMBLE_TICKS) hit = true;
  }
  if (v2 && s.stars) {
    const reach = half + FLIP_STAR_R * FP;
    let got = s.got ?? 0;
    s.stars.forEach((star, i) => {
      if (!(got & (1 << i)) && s.flipT === 0 && s.side === star.side && Math.abs(s.x - star.x) <= reach) got |= 1 << i;
    });
    s.got = got;
  }
  if (hit) {
    s.ended = 2;
    s.endedTick = tick;
  } else if (tick >= FLIP_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** First-contact tick of a crumble tile (by segment index), or null if never touched. */
export function flipCrackTick(state: Pick<FlipState, "cracks">, index: number): number | null {
  const cracks = state.cracks ?? [];
  for (let k = cracks.length - 2; k >= 0; k -= 2) if (cracks[k] === index) return cracks[k + 1]!;
  return null;
}

/** Stars taken (rev 2; 0 on original rounds). */
export function flipStarsTaken(state: Pick<FlipState, "got">): number {
  let n = 0;
  for (let bits = state.got ?? 0; bits; bits &= bits - 1) n += 1;
  return n;
}

/** Rev 2: floor(130 × (seconds survived ÷ 60)²) + 2 per star, capped at 150. */
export function flipScoreOfV2(ticks: number, stars: number): number {
  const t = clampInt(ticks, 0, FLIP_RUN_TICKS);
  const survival = Math.trunc((FLIP_SURVIVAL_POINTS_V2 * t * t) / (FLIP_RUN_TICKS * FLIP_RUN_TICKS));
  return clampInt(survival + FLIP_STAR_POINTS * clampInt(stars, 0, FLIP_STARS), 0, 150);
}

/** floor(150 × (seconds survived ÷ 60)²), in whole ticks. */
export function flipScoreOf(ticks: number): number {
  const t = clampInt(ticks, 0, FLIP_RUN_TICKS);
  return clampInt(Math.trunc((150 * t * t) / (FLIP_RUN_TICKS * FLIP_RUN_TICKS)), 0, 150);
}

function score(state: FlipState): number {
  if (state.rev === FLIP_REV) return flipScoreOfV2(state.ended === 1 ? FLIP_RUN_TICKS : state.tick, flipStarsTaken(state));
  return flipScoreOf(state.ended === 1 ? FLIP_RUN_TICKS : state.tick);
}

/* ============================= Checkpoints ============================= */

export const FLIP_CHECKPOINT_INTERVAL = 300;
export const FLIP_CHECKPOINT_KEYS = ["tick", "x", "side", "flipT", "cursor", "warpY", "ended", "rng", "checksum"] as const;

export interface FlipCheckpoint {
  tick: number;
  x: number;
  side: number;
  flipT: number;
  cursor: number;
  warpY: number;
  ended: number;
  rng: number;
  checksum: number;
}

export function flipCheckpoint(state: FlipState): FlipCheckpoint {
  const snap = {
    tick: state.tick,
    x: state.x,
    side: state.side,
    flipT: state.flipT,
    cursor: state.cursor,
    warpY: state.warpY,
    ended: state.ended,
    rng: state.rng | 0,
  };
  let checksum = 0x811c9dc5;
  // Rev 2 also folds taken stars and crumble contacts into the checksum (same encoded keys).
  const extra = state.rev === FLIP_REV ? [state.got ?? 0, ...(state.cracks ?? [])] : [];
  // flipRev 4 adds its marker last.
  if (state.tunec) extra.push(state.tunec);
  // flipRev 8 folds in its own counters after that.
  if (state.exp) extra.push(state.exp, state.arcN ?? 0, state.land ?? 0, state.chain ?? 0, state.comboPts ?? 0, state.save ?? 0,
    state.saves ?? 0, state.inv ?? 0, state.cpPassed ?? 0, state.cleanCps ?? 0, state.zonesOk ?? 0, state.pause ?? 0, state.lost ?? 0, ...(state.trailGot ?? []), state.sweetGot ?? 0);
  for (const value of [...Object.values(snap), ...extra]) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* =============================== Drawing =============================== */

export const FLIP_BG = "#07070D";
export const FLIP_GOLD = "#F5B82E";
export const FLIP_RED = "#FF4D5E";

/** Runner y in px for a side and arc timer (render only). */
function runnerY(side: number, flipT: number): number {
  const target = side === 0 ? FLIP_FLOOR_Y - 14 : FLIP_CEIL_Y + 14;
  if (flipT === 0) return target;
  const from = side === 0 ? FLIP_CEIL_Y + 14 : FLIP_FLOOR_Y - 14;
  const f = 1 - flipT / FLIP_ARC_TICKS;
  const eased = f * f * (3 - 2 * f);
  return from + (target - from) * eased;
}

function draw(ctx: CanvasRenderingContext2D, state: FlipState, size: CanvasSize): void {
  const scale = Math.min(size.width / FLIP_WORLD_W, size.height / FLIP_WORLD_H);
  const ox = (size.width - FLIP_WORLD_W * scale) / 2;
  const oy = (size.height - FLIP_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = FLIP_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  const toScreen = (wx: number) => RUNNER_X + (wx - state.x) / FP;
  const toWorld = (sx: number) => state.x + (sx - RUNNER_X) * FP;
  const wy = (side: number, sx: number) => flipWarpAt(state, side, toWorld(sx));
  const surfaceLine = (side: number, y: number, a: number, b: number) => {
    flipSurfaceLine(ctx, (x) => y + wy(side, x), a, b);
  };
  // Surfaces as gold lines, broken where a gap is.
  ctx.strokeStyle = FLIP_GOLD;
  ctx.lineWidth = 3;
  for (const [side, y] of [[0, FLIP_FLOOR_Y], [1, FLIP_CEIL_Y]] as const) {
    ctx.beginPath();
    let from = 0;
    for (let i = state.cursor; i < state.segs.length; i++) {
      const seg = state.segs[i]!;
      const a = toScreen(seg.x0);
      if (a > FLIP_WORLD_W) break;
      if (seg.side !== side || seg.kind !== FLIP_GAP) continue;
      surfaceLine(side, y, from, Math.max(from, a));
      from = Math.max(from, toScreen(seg.x1));
    }
    surfaceLine(side, y, from, FLIP_WORLD_W);
    ctx.stroke();
  }

  for (let i = Math.max(0, state.cursor - 1); i < state.segs.length; i++) {
    const seg = state.segs[i]!;
    const a = toScreen(seg.x0);
    const b = toScreen(seg.x1);
    if (a > FLIP_WORLD_W) break;
    if (b < 0) continue;
    const dirY = seg.side === 0 ? -1 : 1;
    drawFlipHazard(
      ctx,
      seg.kind === FLIP_SPIKE ? "spike" : seg.kind === FLIP_GAP ? "gap" : "overhang",
      a, b, dirY,
      (x) => (seg.side === 0 ? FLIP_FLOOR_Y : FLIP_CEIL_Y) + wy(seg.side, x),
      FLIP_RED,
    );
  }

  // Runner (no trail).
  const y = runnerY(state.side, state.flipT) + state.warpY;
  ctx.fillStyle = FLIP_GOLD;
  ctx.beginPath();
  ctx.roundRect(RUNNER_X - 12, y - 14, 24, 28, 12);
  ctx.fill();
  ctx.restore();
}

export const flipGame: ArcadeGame<FlipState, ArcadeInputEvent | null> = {
  key: "flip",
  runTicks: FLIP_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: FLIP_INPUT_RANGES,
};

const flipRev2Game: ArcadeGame<FlipState, ArcadeInputEvent | null> = { ...flipGame, init: initV2 };

/** Takes puzzle.flipRev; anything else is the original corridor. */
export function flipGameFor(rev?: number | null): ArcadeGame<FlipState, ArcadeInputEvent | null> {
  if (rev === FLIP_REV_EXPAND) return flipExpandGame;
  // 7 was the parked expansion's stamp, never dealt or stored: it would play as the revision before it.
  if (rev === FLIP_REV_STRICT || rev === FLIP_REV_STRICT + 1) return flipStrictGame;
  if (rev === FLIP_REV_TARGET) return flipTargetGame;
  if (rev === FLIP_REV_TUNEC) return flipTunecGame;
  if (rev === FLIP_REV_BAND) return flipBandGame;
  return rev === FLIP_REV ? flipRev2Game : flipGame;
}

/** Report helper: the rev-2 course's crumble tiles and stars for a seed. */
export function flipCourseV2(seed: number) {
  return buildCourseV2(seed);
}

/* ================= Oct 2026 score bands (flipRev 3) ================= */

/** Score-band revision (puzzle.flipRev = 3): rev-2 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const FLIP_REV_BAND = 3;
/** Each half second survived counts 1 and each gold star 3; 140 at the full minute with all ten stars; lasting the minute adds 10. */
export const FLIP_BAND_CURVE = bandCurve([0, 40, 105, 130, 140, 150], [0, 15, 70, 100, 120, 140]);
export function flipBandParts(state: FlipState): BandParts {
  if (state.exp) return flipV8Parts(state);
  const units = Math.floor((state.ended === 1 ? FLIP_RUN_TICKS : clampInt(state.tick, 0, FLIP_RUN_TICKS)) / 30) + 3 * flipStarsTaken(state);
  const finished = state.ended === 1;
  return { units, points: bandPoints(bandCurveOf(state, state.tunec ? FLIP_V4_BAND_CURVE : FLIP_BAND_CURVE), units), bonus: finished ? BAND_FINISH_BONUS : 0, penalty: 0, finished, text: `${((state.ended === 1 ? FLIP_RUN_TICKS : state.tick) / 60).toFixed(1)} s · ${flipStarsTaken(state)} stars`, bonusText: "Lasted the minute" };
}

function scoreBand(state: FlipState): number {
  if (state.exp) return flipV8Score(state);
  return bandTotal(flipBandParts(state), Boolean(state.acted));
}

export const flipBandGame: ArcadeGame<FlipState, ArcadeInputEvent | null> = { ...flipRev2Game, init: (seed) => bandInit(flipRev2Game.init(seed)) };

/* ================= Tuning C (flipRev 4, Oct 2026) ================= */

/**
 * flipRev 4 (Tuning C): flipRev 3 play and course, except the corridor starts
 * bending at 10 s (FLIP_WARP_FROM_V4) instead of 15 s, on the same bend table
 * and ramp. The bend is a shared vertical offset that the runner and every
 * hazard ride together, so the course's crumble and star proofs are unchanged.
 * Scored about 10 % higher (Joe found Roofbound slightly harsh): every knot
 * below the top keeps its units and gains a tenth of its points; the full
 * minute with all ten stars still reaches 140, plus 10. States add `tunec: 1`.
 */
export const FLIP_REV_TUNEC = 4;
export const FLIP_V4_BAND_CURVE = bandCurve([0, 40, 105, 130, 140, 150], [0, 17, 77, 110, 132, 140]);
export const flipTunecGame: ArcadeGame<FlipState, ArcadeInputEvent | null> = { ...flipBandGame, init: (seed) => ({ ...flipBandGame.init(seed), tunec: 1 }) };

/* ================= Scoring targets (flipRev 5, 18 Oct 2026) ================= */

/**
 * flipRev 5 (scoring targets, docs/scoring-targets.md): flipRev 4 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const FLIP_REV_TARGET = 5;
export const flipTargetGame = bandTargetGame(flipTunecGame);
/** The curve new rounds score on: FLIP_V4_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const FLIP_V5_BAND_CURVE = bandRetarget(FLIP_V4_BAND_CURVE);


/* ================= Score bands (flipRev 6, 19 Oct 2026) ================= */

/**
 * flipRev 6 (score bands, docs/scoring-targets.md): flipRev 5 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const FLIP_REV_STRICT = 6;
export const flipStrictGame = bandStrictGame(flipTargetGame);
/** The curve new rounds score on: FLIP_V4_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const FLIP_V6_BAND_CURVE = bandStrict(FLIP_V4_BAND_CURVE);

/* ================= The expansion (flipRev 8, expansion E7, 26 Oct 2026) ================= */

/**
 * flipRev 8 (docs/expansions/x200-flip.md, docs/scoring-200.md): a taller 390 × 730 world whose cave
 * height changes along the run (normal 260 px, tight 200 px, tall 340 px sections), so a flip's
 * arc takes 9 to 16 ticks (flipV8Arc: the height under the runner when it leaves), a faster top
 * speed and two speed zones (the run goes 11/8 as fast for 5 s), moving spikes that slide along
 * their surface, four bonus star trails (five stars on a flip's arc, taken in the air), double-flip
 * combos (a flip within 8 ticks of landing with a hazard close by), checkpoints at 15, 30 and 45 s
 * (the next crash after one is saved: a second of shield, 10 s off the survival count), and sweet
 * spots (eight strips of roof; a flip that lands with the runner's centre inside one is a sweet landing).
 * The parked expansion's stamp (7) was never dealt; a round stamped 7 plays as flipRev 6 (flipGameFor).
 *
 * Scored to 200 (roundMaxFor("flip")): the rev-6 shape (half seconds + 3 per gold star on its own
 * curve, FLIP_V8_BAND_CURVE, to 140, plus 10 for the full minute) and up to 50 more from the features
 * only, their raw points (4 a full trail, 4 a sweet landing, 3 a clean speed zone, 3 a clean checkpoint,
 * combo points up to FLIP_V8_COMBO_CAP) paid on a rising scale (FLIP_V8_SKILL_PAY).
 *
 * The guarantee (the arcade rule): every course carries exactly ten gold stars, four trails, eight sweet
 * spots, two speed zones and three checkpoints (flipV8Opportunities), placed by the seed, all on one
 * route the course builder proved lasts the minute (re-rolled from the seed until they fit), so a
 * perfect run reaches 200 on every seed: 150 units on the base curve (140 + 10) and FLIP_V8_SKILL_FULL raw.
 *
 * Collision is the original 1-D rule (side, x-span, on the surface): the height, trails, zones and
 * sweet spots never move a hazard.
 */
export const FLIP_REV_EXPAND = 8;
export const FLIP_V8_WORLD_H = 730;
/** The tunnel's middle line in the tall world; the cave's floor and ceiling sit half its height either side. */
export const FLIP_V8_CY = 365;
export const FLIP_V8_H_NORMAL = 260;
export const FLIP_V8_H_TIGHT = 200;
export const FLIP_V8_H_TALL = 340;
const V8_HEIGHTS = [FLIP_V8_H_TIGHT, FLIP_V8_H_NORMAL, FLIP_V8_H_TALL] as const;
/** A height change eases over this many px of tunnel. */
export const FLIP_V8_RAMP = 160;
const V8_SPEED_CAP = 2560;
/** Speed zones: the run goes ZONE_NUM / ZONE_DEN as fast. */
export const FLIP_V8_ZONE_NUM = 11;
export const FLIP_V8_ZONE_DEN = 8;
export const FLIP_V8_ZONE_TICKS = 5 * TICKS_PER_SECOND;
export const FLIP_V8_CHECKPOINTS = [15, 30, 45].map((s) => s * TICKS_PER_SECOND);
/** A saved crash: this many ticks of shield, and the survival count pauses this many ticks. */
export const FLIP_V8_SHIELD_TICKS = 60;
export const FLIP_V8_SAVE_PAUSE = 10 * TICKS_PER_SECOND;
/** Double flip: the next flip begins within this many ticks of landing, with a hazard this close (px) ahead. */
export const FLIP_V8_COMBO_TICKS = 8;
export const FLIP_V8_COMBO_NEAR = 96;
export const FLIP_V8_TRAILS = 4;
export const FLIP_V8_TRAIL_STARS = 5;
/** Trail stars sit at these points of their arc (per mille) and are taken within this share of the cave height. */
const V8_TRAIL_AT = [150, 325, 500, 675, 850] as const;
export const FLIP_V8_TRAIL_TOL = 230;
export const FLIP_V8_TRAIL_R = 8;
/** Moving spikes join the plain patterns from this tick. */
const V8_MOVERS_FROM = 12 * TICKS_PER_SECOND;
/** Raw skill points: a full trail, combo points (doubled in a speed zone, capped), a clean zone, a clean checkpoint; the paid total caps at 50. */
export const FLIP_V8_TRAIL_POINTS = 4;
export const FLIP_V8_COMBO_CAP = 6;
export const FLIP_V8_ZONE_POINTS = 3;
export const FLIP_V8_CP_POINTS = 3;
export const FLIP_V8_FEATURE_CAP = 50;
/**
 * Sweet spots (the expansion's precision feature): FLIP_V8_SWEETS strips of roof, each FLIP_V8_SWEET_TICKS ticks of
 * travel long, placed by the seed near these seconds (V8_SWEET_SECONDS) on one surface clear of hazards. Landing a
 * flip with the runner's centre inside one (the tick the arc ends) is a sweet landing, worth FLIP_V8_SWEET_POINTS
 * raw skill points, once per spot.
 */
export const FLIP_V8_SWEETS = 8;
export const FLIP_V8_SWEET_TICKS = 1;
export const FLIP_V8_SWEET_POINTS = 4;
const V8_SWEET_SECONDS = [6.5, 13, 19.5, 26, 32.5, 39, 45.5, 52] as const;
/**
 * Readability: a gold star or sweet spot is announced this far beyond the right edge of the view (a small marker at the
 * edge, flipRev 8's art; FLIP_V8_PREVIEW px), so it is readable FLIP_V8_PREVIEW + 300 px ahead of the runner (the 390 px
 * view less the runner's 90), and a player has read it V8_READ_TICKS later (a quick human reaction, 200 ms).
 */
export const FLIP_V8_PREVIEW = 180;
export const FLIP_V8_READ_AHEAD = FLIP_WORLD_W - 90 + FLIP_V8_PREVIEW;
const V8_VIEW_AHEAD = FLIP_V8_READ_AHEAD;
const V8_READ_TICKS = 12;
/** The readability proof lets a player flip again this many ticks after landing (a quick double flip). */
const V8_READ_LANDED = 6;
/**
 * The skill pay (a rising scale, as Breaker's BRK_V9_SKILL_PAY): the features' raw points (trails 4 each, sweet
 * landings 4 each, clean zones 3 each, clean checkpoints 3 each, combo points up to FLIP_V8_COMBO_CAP) paid so a
 * little feature play pays little and the full 50 needs every guaranteed item (FLIP_V8_SKILL_FULL = 63 raw: every
 * trail, sweet spot, zone and checkpoint), or near it with combos on top. Fitted on the 60 tuning seeds
 * (docs/expansions/x200-flip.md), with the base curve.
 */
export const FLIP_V8_SKILL_FULL = FLIP_V8_TRAILS * FLIP_V8_TRAIL_POINTS + FLIP_V8_SWEETS * FLIP_V8_SWEET_POINTS + 2 * FLIP_V8_ZONE_POINTS + 3 * FLIP_V8_CP_POINTS;
export const FLIP_V8_SKILL_PAY = bandCurve([0, 12, 30, 37, 61, FLIP_V8_SKILL_FULL], [0, 0, 1, 7, 30, FLIP_V8_FEATURE_CAP]);
/** The rev-8 survival curve: half seconds + 3 per gold star, to 140 (the full minute adds 10, the features up to 50). */
export const FLIP_V8_BAND_CURVE = bandCurve([0, 40, 105, 130, 140, 146, 150], [0, 11, 33, 38, 43, 95, 140]);

export interface FlipTrail {
  /** Star centres (1/256 px) and heights (per mille of the cave: 0 the floor's runner line, 1000 the ceiling's). */
  x: number[];
  f: number[];
  /** Launch point (1/256 px), its surface (the trail rises from the floor when 0) and the ticks it can be taken in. */
  launch: number;
  from: number;
  t0: number;
  t1: number;
}

/** The stored course's extra geometry, shared by every state of a run (never written after init). */
export interface FlipV8Course {
  /** Runner x (1/256 px) at every tick. */
  xs: number[];
  /** Height sections, flattened [x0, height px, …], x0 ascending. */
  hts: number[];
  /** Speed zones, flattened [first tick, end tick, …]. */
  zones: number[];
  trails: FlipTrail[];
  /** Sweet spots (FLIP_V8_SWEETS on every course), in order along the run. */
  sweets: FlipSweet[];
}

export function flipWorldHFor(rev?: number | null): number {
  return rev === FLIP_REV_EXPAND ? FLIP_V8_WORLD_H : FLIP_WORLD_H;
}
export function flipWorldH(state: Pick<FlipState, "exp">): number {
  return state.exp ? FLIP_V8_WORLD_H : FLIP_WORLD_H;
}

/** Cave height (px) at world x on a rev-8 course: its section, eased in over FLIP_V8_RAMP px. */
export function flipV8HeightAt(course: Pick<FlipV8Course, "hts">, x: number): number {
  const hts = course.hts;
  let i = 0;
  while (i + 2 < hts.length && hts[i + 2]! <= x) i += 2;
  const h = hts[i + 1]!;
  if (i === 0) return h;
  const into = x - hts[i]!;
  const ramp = FLIP_V8_RAMP * FP;
  if (into >= ramp) return h;
  const prev = hts[i - 1]!;
  return prev + Math.trunc(((h - prev) * into) / ramp);
}

/** The ticks a flip takes when it leaves at cave height h (12 at the original 260). */
export function flipV8Arc(h: number): number {
  return clampInt(Math.trunc((h * FLIP_ARC_TICKS + 130) / 260), 9, 16);
}

export function flipV8InZone(course: Pick<FlipV8Course, "zones">, tick: number): boolean {
  const z = course.zones;
  for (let i = 0; i < z.length; i += 2) if (tick > z[i]! && tick <= z[i + 1]!) return true;
  return false;
}

function v8Speed(tick: number): number {
  return Math.min(V8_SPEED_CAP, SPEED_START + SPEED_STEP * Math.trunc(tick / SPEED_STEP_TICKS));
}

/** The base speed step (no zone) a rev-8 run is on at a tick (sounds and art). */
export function flipV8BaseSpeed(tick: number): number {
  return v8Speed(tick);
}

function v8Xs(zones: number[]): number[] {
  const out = [0];
  let x = 0;
  for (let t = 1; t <= FLIP_RUN_TICKS; t++) {
    const v = v8Speed(t);
    x += flipV8InZone({ zones }, t) ? Math.trunc((v * FLIP_V8_ZONE_NUM) / FLIP_V8_ZONE_DEN) : v;
    out.push(x);
  }
  return out;
}

/** A moving spike's slide (1/256 px) on a tick; 0 for every other hazard. */
export function flipSegShift(seg: FlipSeg, tick: number): number {
  if (!seg.amp || !seg.per) return 0;
  const angle = ((seg.ph ?? 0) + Math.trunc((tick * WARP_ANGLE) / seg.per)) & (WARP_ANGLE - 1);
  return Math.trunc((seg.amp * isin(angle)) / TRIG_ONE);
}

function v8Blocked(side: number, flipT: number, x: number, seg: FlipSeg, tick: number, half: number): boolean {
  if (flipT !== 0 || side !== seg.side) return false;
  const d = flipSegShift(seg, tick);
  return x + half >= seg.x0 + d && x - half <= seg.x1 + d;
}

/** Integer smoothstep on per mille (the arc's ease, as the art draws it). */
function smooth(p: number): number {
  const q = clampInt(p, 0, 1000);
  return Math.trunc((q * q * (3000 - 2 * q)) / 1000000);
}

/** Where the runner is across the cave this tick, per mille (0 standing on the floor, 1000 on the ceiling). */
export function flipV8Frac(side: number, flipT: number, arcN: number): number {
  if (flipT <= 0) return side === 1 ? 1000 : 0;
  const up = smooth(Math.trunc(((arcN - flipT) * 1000) / arcN));
  return side === 1 ? up : 1000 - up;
}

/** Trail star bits a runner takes on this tick. */
function trailTake(trail: FlipTrail, x: number, frac: number, half: number, got: number): number {
  const reach = half + FLIP_V8_TRAIL_R * FP;
  for (let k = 0; k < FLIP_V8_TRAIL_STARS; k++) {
    if (got & (1 << k)) continue;
    if (Math.abs(x - trail.x[k]!) <= reach && Math.abs(frac - trail.f[k]!) <= FLIP_V8_TRAIL_TOL) got |= 1 << k;
  }
  return got;
}

/* Solver codes for rev 8: side | flipT << 1 | arcN << 6 | landed << 11 | crumble << 15 | star << 20 | trail bits << 21 | sweet << 26. */
const pack8 = (side: number, flipT: number, arcN: number, landed: number, crumble = 0, got = 0, trail = 0, sweet = 0) =>
  side | (flipT << 1) | (arcN << 6) | (landed << 11) | (crumble << 15) | (got << 20) | (trail << 21) | (sweet << 26);
const STAR8 = 1 << 20;
const TRAIL8 = 31 << 21;
const SWEET8 = 1 << 26;
const FULL_TRAIL = (1 << FLIP_V8_TRAIL_STARS) - 1;

/** A sweet spot (flipRev 8): a strip of roof [x0, x1] (1/256 px, the runner's centre) on one surface. */
export interface FlipSweet {
  x0: number;
  x1: number;
  side: number;
}

/** A sweet landing: the tick a flip ends (flipT 1 → 0) with the runner's centre inside the strip on its surface. */
export function flipSweetLanding(sweet: FlipSweet, side: number, wasFlipT: number, flipT: number, x: number): boolean {
  return wasFlipT === 1 && flipT === 0 && side === sweet.side && x >= sweet.x0 && x <= sweet.x1;
}

function solverTick8(set: readonly number[], t: number, hazards: readonly FlipSeg[], course: FlipV8Course,
  star?: { x: number; side: number }, trail?: FlipTrail, sweet?: FlipSweet, minLanded = SOLVER_LANDED): number[] {
  const x = course.xs[t]!;
  const half = RULES_V2.runnerHalf;
  let onCrumble = false;
  for (const seg of hazards) if (seg.kind === FLIP_CRUMBLE && x + half >= seg.x0 && x - half <= seg.x1) onCrumble = true;
  const arcHere = flipV8Arc(flipV8HeightAt(course, x));
  const seen = new Set<number>();
  const out: number[] = [];
  for (const code of set) {
    const side = code & 1;
    const flipT = (code >> 1) & 31;
    const arcN = (code >> 6) & 31;
    const landed = (code >> 11) & 15;
    const crumble = onCrumble ? (code >> 15) & 31 : 0;
    const got = (code >> 20) & 1;
    const tbits = (code >> 21) & 31;
    const sw = (code >> 26) & 1;
    for (const tap of [false, true]) {
      if (tap && (flipT > 0 || landed < minLanded)) continue;
      let ns = side;
      let nf = flipT;
      let na = arcN;
      if (nf > 0) nf -= 1;
      else if (tap) {
        ns ^= 1;
        na = arcHere;
        nf = na;
      }
      let c = crumble > 0 ? Math.min(CRUMBLE_CAP, crumble + 1) : 0;
      let dead = false;
      for (const seg of hazards) {
        if (!v8Blocked(ns, nf, x, seg, t, half)) continue;
        if (seg.kind !== FLIP_CRUMBLE) dead = true;
        else if (c === 0) c = 1;
        else if (c - 1 >= FLIP_CRUMBLE_TICKS) dead = true;
        if (dead) break;
      }
      if (dead) continue;
      const nl = nf > 0 ? 0 : Math.min(SOLVER_LANDED, landed + 1);
      const taken = got || (star && nf === 0 && ns === star.side && Math.abs(x - star.x) <= half + FLIP_STAR_R * FP) ? 1 : 0;
      const tb = trail ? trailTake(trail, x, flipV8Frac(ns, nf, na), half, tbits) : tbits;
      const sweetTaken = sw || (sweet && flipSweetLanding(sweet, ns, flipT, nf, x)) ? 1 : 0;
      const next = pack8(ns, nf, nf > 0 ? na : 0, nl, c, taken, tb, sweetTaken);
      if (seen.has(next)) continue;
      seen.add(next);
      out.push(next);
    }
  }
  return out;
}

function v8Reach(seg: FlipSeg): number {
  return seg.amp ?? 0;
}

interface V8Built {
  segs: FlipSeg[];
  rng: number;
  course: FlipV8Course;
}

function buildCourseV8(seed: number): V8Built {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const half = RULES_V2.runnerHalf;
  // Speed zones, then the tunnel's x at every tick, then the height sections.
  const z1 = (17 + draw(4)) * TICKS_PER_SECOND;
  const z2 = (37 + draw(4)) * TICKS_PER_SECOND;
  const zones = [z1, z1 + FLIP_V8_ZONE_TICKS, z2, z2 + FLIP_V8_ZONE_TICKS];
  const xs = v8Xs(zones);
  const hts = [0, FLIP_V8_H_NORMAL];
  {
    let prev = 1;
    for (let t = 8 * TICKS_PER_SECOND; t < FLIP_RUN_TICKS; t += (5 + draw(4)) * TICKS_PER_SECOND) {
      const pick = (prev + 1 + draw(2)) % 3;
      hts.push(xs[t]!, V8_HEIGHTS[pick]!);
      prev = pick;
    }
  }
  const course: FlipV8Course = { xs, hts, zones, trails: [], sweets: [] };
  const trailTicks = [7 + draw(2), 20 + draw(3), 33 + draw(3), 48 + draw(3)].map((s) => s * TICKS_PER_SECOND);
  const X = xs;
  const speedAt = (t: number) => X[Math.min(FLIP_RUN_TICKS, t + 1)]! - X[Math.min(FLIP_RUN_TICKS - 1, t)]!;
  let frontier: number[] = [pack8(0, 0, 0, SOLVER_LANDED)];
  let tick = 0;
  const end = X[FLIP_RUN_TICKS]!;
  const segs: FlipSeg[] = [];
  let group = 0;
  let groupsAfterTen = 0;
  let decisionsAfterTen = 0;
  let lastWasCrumble = false;
  let trailIdx = 0;

  const advance = (from: number[], t0: number, xEnd: number, hazards: readonly FlipSeg[]) => {
    let set = from;
    let t = t0;
    const reach = hazards.reduce((m, seg) => Math.max(m, v8Reach(seg)), 0);
    while (t < FLIP_RUN_TICKS && X[t]! - half <= xEnd + reach) {
      t += 1;
      set = solverTick8(set, t, hazards, course);
      if (!set.length) break;
    }
    return { set, tick: t };
  };

  let x = X[CLEAR_TICKS]!;
  let lastEnd = x;
  while (x < end) {
    const speed = speedAt(tick);
    // A star trail: a clear stretch, a launch point and five stars on the arc from it.
    // flipRev 8 (the guarantee): a trail that no route can take here is tried again after the next hazard, so
    // every course carries all four (a course that can't is re-rolled by flipCourseV8).
    if (trailIdx < trailTicks.length && tick + 30 >= trailTicks[trailIdx]!) {
      const tL = tick + 50;
      if (tL + 40 >= FLIP_RUN_TICKS) trailIdx += 1;
      else {
        const from = draw(2);
        const arc = flipV8Arc(flipV8HeightAt(course, X[tL]!));
        const tx: number[] = [];
        const tf: number[] = [];
        for (const p of V8_TRAIL_AT) {
          tx.push(X[tL + Math.trunc((p * arc) / 1000)]!);
          const up = smooth(p);
          tf.push(from === 0 ? up : 1000 - up);
        }
        const reach = half + FLIP_V8_TRAIL_R * FP;
        let t1 = tL;
        while (t1 < FLIP_RUN_TICKS && X[t1]! - reach <= tx[FLIP_V8_TRAIL_STARS - 1]!) t1 += 1;
        const trail: FlipTrail = { x: tx, f: tf, launch: X[tL]!, from, t0: tick + 1, t1 };
        let set = frontier.map((code) => code & ~TRAIL8);
        let t = tick;
        while (t < t1 && set.length) {
          t += 1;
          set = solverTick8(set, t, [], course, undefined, trail);
        }
        const took = set.filter((code) => ((code >> 21) & 31) === FULL_TRAIL).map((code) => code & ~TRAIL8);
        if (took.length) {
          trailIdx += 1;
          course.trails.push(trail);
          frontier = took;
          tick = t;
          x = X[t]! + 20 * speed;
          lastEnd = x;
          continue;
        }
      }
    }
    const tight = x >= X[TIGHT_AFTER]!;
    const budget = Math.max(speed * 4, speed * MAX_GAP_TICKS - (x - lastEnd) - speed * 2);
    const gap = tight
      ? Math.min(budget, speed * (16 + SOLVER_LANDED + draw(MAX_GAP_TICKS - 16 - SOLVER_LANDED + 1)))
      : Math.trunc(((33 + draw(88)) * FP * speed) / SPEED_START);
    const start = x + gap;
    if (start >= end) break;
    let accepted: FlipSeg[] = [];
    let result: { set: number[]; tick: number } | null = null;
    const afterTen = start >= X[10 * TICKS_PER_SECOND]!;
    const requireDecision = afterTen && decisionsAfterTen * 100 < (groupsAfterTen + 1) * 75;
    const crumbleOk = start >= X[FLIP_CRUMBLE_FROM]! && !lastWasCrumble && start - lastEnd >= 2 * half + 8 * speed;
    const moverOk = start >= X[V8_MOVERS_FROM]!;
    for (let attempt = 0; attempt < 48 && !result; attempt++) {
      // Rev 8: moving spikes count as decisions too (the safe moment moves with them).
      const decide = draw(4);
      const pattern = requireDecision && attempt < 40 ? (decide === 3 ? 8 : 3 + decide) : draw(10);
      const side = draw(2);
      const len = Math.trunc(((40 + draw(120)) * FP * speed) / SPEED_START);
      let trial: FlipSeg[];
      const nextGroup = group + 1;
      if (pattern >= 8) {
        if (!moverOk) continue;
        // A moving spike: it slides to and fro along its surface, so the safe moment moves with it.
        const amp = (40 + draw(31)) * FP;
        const per = 90 + draw(61);
        const spikeLen = (30 + draw(24)) * FP;
        trial = [{ x0: start + amp, x1: start + amp + spikeLen, side, kind: FLIP_SPIKE, group: nextGroup, decision: FLIP_DECISION_MOVER, amp, per, ph: draw(65536) }];
      } else if (pattern >= 6) {
        if (!crumbleOk) continue;
        const crumbleLen = speed * (FLIP_CRUMBLE_TICKS + 18 + draw(30));
        trial = [{ x0: start, x1: start + crumbleLen, side, kind: FLIP_CRUMBLE, group: nextGroup, decision: 0 }];
      } else if (pattern === 3) {
        const len1 = (30 + draw(40)) * FP;
        const between = speed * (16 + SOLVER_LANDED + 4 + draw(12));
        trial = [
          { x0: start, x1: start + len1, side, kind: FLIP_OVERHANG, group: nextGroup, decision: FLIP_DECISION_OVERHANG },
          { x0: start + len1 + between, x1: start + len1 + between + len1, side: side ^ 1, kind: FLIP_OVERHANG, group: nextGroup, decision: FLIP_DECISION_OVERHANG },
        ];
      } else if (pattern === 4) {
        const spikeLen = (32 + draw(34)) * FP;
        const between = speed * (25 + draw(16));
        trial = [
          { x0: start, x1: start + spikeLen, side, kind: FLIP_SPIKE, group: nextGroup, decision: FLIP_DECISION_PAIRED_SPIKES },
          { x0: start + spikeLen + between, x1: start + spikeLen + between + spikeLen, side: side ^ 1, kind: FLIP_SPIKE, group: nextGroup, decision: FLIP_DECISION_PAIRED_SPIKES },
        ];
      } else if (pattern === 5) {
        const gapLen = (55 + draw(45)) * FP;
        const offset = speed * (16 + 8 + draw(12));
        trial = [
          { x0: start, x1: start + gapLen, side, kind: FLIP_GAP, group: nextGroup, decision: FLIP_DECISION_FALSE_GAP },
          { x0: start + gapLen + offset, x1: start + gapLen + offset + 38 * FP, side: side ^ 1, kind: FLIP_SPIKE, group: nextGroup, decision: FLIP_DECISION_FALSE_GAP },
        ];
      } else {
        trial = [{ x0: start, x1: start + len, side, kind: pattern === 2 ? FLIP_GAP : FLIP_SPIKE, group: nextGroup, decision: 0 }];
      }
      const last = trial[trial.length - 1]!;
      if (last.x1 + v8Reach(last) >= end) continue;
      const tried = advance(frontier, tick, last.x1, trial);
      if (tried.set.length) {
        accepted = trial;
        result = tried;
      }
    }
    if (!result) {
      const stepTo = tight ? x + speed * 6 : start;
      result = advance(frontier, tick, stepTo, []);
      x = stepTo;
    } else {
      segs.push(...accepted);
      group += 1;
      lastWasCrumble = accepted[0]?.kind === FLIP_CRUMBLE;
      if (afterTen) {
        groupsAfterTen += 1;
        if (accepted[0]?.decision) decisionsAfterTen += 1;
      }
      const last = accepted[accepted.length - 1]!;
      x = last.x1 + v8Reach(last);
      lastEnd = x;
    }
    frontier = result.set;
    tick = result.tick;
    if (tick >= FLIP_RUN_TICKS) break;
  }
  return { segs, rng, course };
}

/**
 * Ten gold stars and FLIP_V8_SWEETS sweet spots that one route takes along with every trail star and lasts the
 * minute (each nudged forward until a route takes it, in the order they come; stars and sweet spots clear of
 * hazards, trails and the stretches a moving spike sweeps). Null if a placement fails (the course is re-rolled).
 */
function placeStarsV8(built: V8Built): { stars: FlipStar[]; sweets: FlipSweet[]; rng: number } | null {
  const { segs, course } = built;
  const X = course.xs;
  let state = built.rng;
  const draw = (bound: number) => {
    const r = rngBelow(state, bound);
    state = r.state;
    return r.value;
  };
  const half = RULES_V2.runnerHalf;
  const reach = half + FLIP_STAR_R * FP;
  const near = (t: number) => {
    const x = X[t]!;
    return segs.filter((seg) => seg.x0 - v8Reach(seg) <= x + half + 64 * FP && seg.x1 + v8Reach(seg) >= x - half - 64 * FP);
  };
  const trailAt = (t: number) => course.trails.find((tr) => t >= tr.t0 && t <= tr.t1);
  const clearSpan = (a: number, b: number, side: number) =>
    !segs.some((seg) => seg.side === side && seg.x0 - v8Reach(seg) <= b + 8 * FP && seg.x1 + v8Reach(seg) >= a - 8 * FP) &&
    !course.trails.some((tr) => X[tr.t0]! <= b + 8 * FP && X[tr.t1]! >= a - 8 * FP);
  /** One tick of the route: a trail's stars are required by the tick after its last can be taken. */
  const stepRoute = (set: number[], t: number, star?: { x: number; side: number }, sweet?: FlipSweet, minLanded = SOLVER_LANDED) => {
    const trail = trailAt(t);
    let out = solverTick8(set, t, near(t), course, star, trail, sweet, minLanded);
    if (trail && t === trail.t1) out = out.filter((code) => ((code >> 21) & 31) === FULL_TRAIL).map((code) => code & ~TRAIL8);
    return out;
  };
  /** The first tick whose x reaches `x`. */
  const tickAt = (x: number) => {
    let lo = 0;
    let hi = FLIP_RUN_TICKS;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (X[mid]! < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const targets = [
    ...STAR_SECONDS.map((sec) => ({ sec, sweet: false })),
    ...V8_SWEET_SECONDS.map((sec) => ({ sec, sweet: true })),
  ].sort((a, b) => a.sec - b.sec);
  let set = [pack8(0, 0, 0, SOLVER_LANDED)];
  let t = 0;
  const stars: FlipStar[] = [];
  const sweets: FlipSweet[] = [];
  for (const target of targets) {
    const at = X[Math.trunc(target.sec * TICKS_PER_SECOND)]!;
    const firstSide = draw(2);
    let placed = false;
    for (let j = 0; j < 24 && !placed; j++) {
      const x = at + j * 24 * FP;
      // A sweet spot is FLIP_V8_SWEET_TICKS ticks of travel long where it lies.
      const t0 = Math.min(FLIP_RUN_TICKS - FLIP_V8_SWEET_TICKS, tickAt(x));
      const span = target.sweet ? { x0: x, x1: x + X[t0 + FLIP_V8_SWEET_TICKS]! - X[t0]! } : { x0: x, x1: x };
      if (span.x1 + reach >= X[FLIP_RUN_TICKS - 60]!) break;
      for (const side of [firstSide, firstSide ^ 1]) {
        if (!clearSpan(span.x0 - reach, span.x1 + reach, side)) continue;
        const bit = target.sweet ? SWEET8 : STAR8;
        const sweet = target.sweet ? { x0: span.x0, x1: span.x1, side } : undefined;
        const star = target.sweet ? undefined : { x, side };
        // Readable in time (phase 1 of the 200 rule): once the item has been on screen a reaction time
        // (V8_VIEW_AHEAD px ahead of the runner, then V8_READ_TICKS), every route situation that can still last
        // past it must be able to take it, so a player who has not seen it yet never has to have planned for it.
        {
          const readAt = tickAt(span.x0 - reach - V8_VIEW_AHEAD * FP) + V8_READ_TICKS;
          let probe = set;
          let pt = t;
          while (pt < readAt && X[pt + 1]! < span.x0 - reach && probe.length) {
            pt += 1;
            probe = stepRoute(probe, pt);
          }
          const takes = (code: number) => {
            let free = [code & ~bit];
            let got = [code & ~bit];
            let tt = pt;
            while (tt < FLIP_RUN_TICKS && X[tt]! <= span.x1 + reach && free.length) {
              tt += 1;
              free = stepRoute(free, tt, undefined, undefined, V8_READ_LANDED);
              got = got.length ? stepRoute(got, tt, star, sweet, V8_READ_LANDED) : got;
            }
            return !free.length || got.some((c) => c & bit);
          };
          // Judged from a settled runner (on either surface, free to flip), however it got there.
          const settled = probe.filter((code) => ((code >> 1) & 31) === 0 && ((code >> 11) & 15) === SOLVER_LANDED);
          if (!settled.every(takes)) continue;
        }
        let trySet = set;
        let tt = t;
        while (tt < FLIP_RUN_TICKS && X[tt + 1]! < span.x0 - reach && trySet.length) {
          tt += 1;
          trySet = stepRoute(trySet, tt);
        }
        trySet = trySet.map((code) => code & ~bit);
        while (tt < FLIP_RUN_TICKS && X[tt]! <= span.x1 + reach && trySet.length) {
          tt += 1;
          trySet = stepRoute(trySet, tt, star, sweet);
        }
        const took = trySet.filter((code) => code & bit);
        if (!took.length) continue;
        if (sweet) sweets.push(sweet);
        else stars.push(star!);
        set = took.map((code) => code & ~bit);
        t = tt;
        placed = true;
        break;
      }
    }
    if (!placed) return null;
  }
  while (t < FLIP_RUN_TICKS && set.length) {
    t += 1;
    set = stepRoute(set, t);
  }
  return set.length ? { stars, sweets, rng: state } : null;
}

export interface FlipCourseV8 {
  segs: FlipSeg[];
  rng: number;
  stars: FlipStar[];
  course: FlipV8Course;
}

const cacheV8 = new Map<number, FlipCourseV8>();
/** Re-rolls a course may take before the full set of stars, trails and sweet spots fits (none needed one in 2,000 seeds tried). */
const V8_ATTEMPTS = 40;

/**
 * The rev-8 course for a seed: hazards, four trails, ten gold stars and FLIP_V8_SWEETS sweet spots, every one of them
 * on one route the builder proved lasts the minute; re-rolled from the seed until all of them fit, so every course
 * offers exactly the same opportunities (flipV8Opportunities).
 */
export function flipCourseV8(seed: number): FlipCourseV8 {
  const hit = cacheV8.get(seed | 0);
  if (hit) return hit;
  let out: FlipCourseV8 | null = null;
  for (let attempt = 0; attempt < V8_ATTEMPTS && !out; attempt++) {
    const built = buildCourseV8(attempt === 0 ? seed : (Math.imul(seed | 0, 0x9e3779b1) + attempt) | 0);
    if (built.course.trails.length !== FLIP_V8_TRAILS) continue;
    const placed = placeStarsV8(built);
    if (placed) out = { segs: built.segs, rng: placed.rng, stars: placed.stars, course: { ...built.course, sweets: placed.sweets } };
  }
  if (!out) {
    // Never reached on any seed checked (flip-x200-check); kept so a deal always has a course.
    const built = buildCourseV8(seed);
    out = { segs: built.segs, rng: built.rng, stars: [], course: { ...built.course, trails: [], sweets: [] } };
  }
  if (cacheV8.size > 16) cacheV8.clear();
  cacheV8.set(seed | 0, out);
  return out;
}

/** Rev 8 states carry the strict band mark for `acted` tracking; their score is flipV8Score's own. */
const BAND_MARK_V8 = 3;

function initV8(seed: number): FlipState {
  const c = flipCourseV8(seed);
  return {
    ...initFrom(c),
    rev: FLIP_REV,
    stars: c.stars,
    got: 0,
    cracks: [],
    tunec: 1,
    band: BAND_MARK_V8,
    acted: 0,
    exp: 1,
    v8: c.course,
    arcN: 0,
    land: 99,
    chain: 0,
    combos: 0,
    comboPts: 0,
    save: 0,
    saves: 0,
    inv: 0,
    cpPassed: 0,
    cleanCps: 0,
    zoneSaves: 0,
    zonesOk: 0,
    trailGot: c.course.trails.map(() => 0),
    pause: 0,
    lost: 0,
    sweetGot: 0,
    sweetT: 0,
  };
}

/** A hazard on either surface within reach of a double flip (under the runner or close ahead). */
function hazardNear(s: FlipState, x: number, tick: number, half: number): boolean {
  for (let i = s.cursor; i < s.segs.length; i++) {
    const seg = s.segs[i]!;
    const d = flipSegShift(seg, tick);
    if (seg.x0 - v8Reach(seg) > x + half + FLIP_V8_COMBO_NEAR * FP) break;
    if (seg.x1 + d >= x - half && seg.x0 + d <= x + half + FLIP_V8_COMBO_NEAR * FP) return true;
  }
  return false;
}

function stepV8(state: FlipState, input: ArcadeInputEvent | null): FlipState {
  if (isOver(state)) return state;
  const course = state.v8!;
  const tick = state.tick + 1;
  const s: FlipState = { ...state, tick };
  const x = course.xs[tick]!;
  const half = RULES_V2.runnerHalf;
  const tap = input !== null && input.k === FLIP_INPUT_TAP;
  const wasFlipT = s.flipT;
  if (s.flipT > 0) {
    s.flipT -= 1;
    if (s.flipT === 0) s.land = 0;
  } else if (tap) {
    // Double flip: off again within FLIP_V8_COMBO_TICKS of landing, with a hazard close by.
    if ((s.land ?? 99) <= FLIP_V8_COMBO_TICKS && hazardNear(s, x, tick, half)) {
      s.chain = (s.chain ?? 0) + 1;
      s.combos = (s.combos ?? 0) + 1;
      s.comboPts = (s.comboPts ?? 0) + Math.min(3, s.chain) * (flipV8InZone(course, tick) ? 2 : 1);
    } else s.chain = 0;
    s.side ^= 1;
    s.arcN = flipV8Arc(flipV8HeightAt(course, x));
    s.flipT = s.arcN;
  } else s.land = Math.min(99, (s.land ?? 99) + 1);
  s.x = x;
  let cursor = s.cursor;
  while (cursor < s.segs.length && s.segs[cursor]!.x1 + v8Reach(s.segs[cursor]!) < s.x - half) cursor += 1;
  s.cursor = cursor;
  s.warpY = flipWarpAt(s, s.side, s.x, tick);
  const shielded = (s.inv ?? 0) > 0;
  if (shielded) s.inv = (s.inv ?? 0) - 1;
  // After a save the survival count pauses (FLIP_V8_SAVE_PAUSE ticks), so lasting on never scores less.
  if ((s.pause ?? 0) > 0) {
    s.pause = (s.pause ?? 0) - 1;
    s.lost = (s.lost ?? 0) + 1;
  }
  let hit = false;
  for (let i = cursor; i < s.segs.length; i++) {
    const seg = s.segs[i]!;
    if (seg.x0 - v8Reach(seg) > s.x + half) break;
    if (shielded || !v8Blocked(s.side, s.flipT, s.x, seg, tick, half)) continue;
    if (seg.kind !== FLIP_CRUMBLE) {
      hit = true;
      continue;
    }
    const first = flipCrackTick(s, i);
    if (first === null) s.cracks = [...(s.cracks ?? []), i, tick];
    else if (tick - first >= FLIP_CRUMBLE_TICKS) hit = true;
  }
  if (s.stars) {
    const reach = half + FLIP_STAR_R * FP;
    let got = s.got ?? 0;
    s.stars.forEach((star, i) => {
      if (!(got & (1 << i)) && s.flipT === 0 && s.side === star.side && Math.abs(s.x - star.x) <= reach) got |= 1 << i;
    });
    s.got = got;
  }
  // A sweet landing: the arc ends with the runner's centre on a sweet spot (once per spot).
  if (wasFlipT === 1 && s.flipT === 0) {
    course.sweets.forEach((sweet, i) => {
      if (!((s.sweetGot ?? 0) & (1 << i)) && flipSweetLanding(sweet, s.side, wasFlipT, s.flipT, s.x)) {
        s.sweetGot = (s.sweetGot ?? 0) | (1 << i);
        s.sweetT = tick;
      }
    });
  }
  course.trails.forEach((trail, i) => {
    if (tick < trail.t0 || tick > trail.t1) return;
    const was = s.trailGot![i]!;
    const now = trailTake(trail, s.x, flipV8Frac(s.side, s.flipT, s.arcN ?? 0), half, was);
    if (now !== was) s.trailGot = s.trailGot!.map((v, k) => (k === i ? now : v));
  });
  if (hit) {
    if (s.save) {
      // A checkpoint's save: a second of shield where it happened, the survival count paused for FLIP_V8_SAVE_PAUSE (10 s), the combo lost.
      s.save = 0;
      s.saves = (s.saves ?? 0) + 1;
      s.inv = FLIP_V8_SHIELD_TICKS;
      s.pause = FLIP_V8_SAVE_PAUSE;
      s.chain = 0;
    } else {
      s.ended = 2;
      s.endedTick = tick;
      return s;
    }
  }
  if (FLIP_V8_CHECKPOINTS.includes(tick)) {
    s.cpPassed = (s.cpPassed ?? 0) + 1;
    s.save = 1;
    if (!s.saves) s.cleanCps = (s.cleanCps ?? 0) + 1;
  }
  const z = course.zones;
  for (let i = 0; i < z.length; i += 2) {
    if (tick === z[i]) s.zoneSaves = s.saves ?? 0;
    if (tick === z[i + 1] && (s.saves ?? 0) === s.zoneSaves) s.zonesOk = (s.zonesOk ?? 0) + 1;
  }
  if (tick >= FLIP_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** Trail stars taken, and full trails, on a rev-8 run. */
export function flipTrailStars(state: Pick<FlipState, "trailGot">): { stars: number; full: number } {
  let stars = 0;
  let full = 0;
  for (const bits of state.trailGot ?? []) {
    for (let b = bits; b; b &= b - 1) stars += 1;
    if (bits === FULL_TRAIL) full += 1;
  }
  return { stars, full };
}

/** Sweet landings on a rev-8 run. */
export function flipSweetsTaken(state: Pick<FlipState, "sweetGot">): number {
  let n = 0;
  for (let b = state.sweetGot ?? 0; b; b &= b - 1) n += 1;
  return n;
}

/**
 * Rev 8's skill points: each feature's raw points (trails, sweet landings, combos, clean speed zones and clean
 * checkpoints), their sum `raw`, and `total`, the raw sum paid on FLIP_V8_SKILL_PAY (0…50, the score's bonus).
 */
export function flipV8Features(state: FlipState): { trails: number; sweets: number; combo: number; zones: number; checkpoints: number; raw: number; total: number } {
  const trails = FLIP_V8_TRAIL_POINTS * flipTrailStars(state).full;
  const sweets = FLIP_V8_SWEET_POINTS * flipSweetsTaken(state);
  const combo = Math.min(FLIP_V8_COMBO_CAP, state.comboPts ?? 0);
  const zones = FLIP_V8_ZONE_POINTS * (state.zonesOk ?? 0);
  const checkpoints = FLIP_V8_CP_POINTS * (state.cleanCps ?? 0);
  const raw = trails + sweets + combo + zones + checkpoints;
  return { trails, sweets, combo, zones, checkpoints, raw, total: Math.min(FLIP_V8_FEATURE_CAP, bandPoints(FLIP_V8_SKILL_PAY, raw)) };
}

/** What every rev-8 course offers, whatever the seed (the arcade rule's guaranteed opportunities). */
export function flipV8Opportunities(state: Pick<FlipState, "stars" | "v8">): Record<string, number> {
  const c = state.v8;
  return {
    goldStars: state.stars?.length ?? 0,
    trails: c?.trails.length ?? 0,
    trailStars: (c?.trails.length ?? 0) * FLIP_V8_TRAIL_STARS,
    sweetSpots: c?.sweets.length ?? 0,
    speedZones: (c?.zones.length ?? 0) / 2,
    checkpoints: FLIP_V8_CHECKPOINTS.length,
  };
}

/** Rev 8 survival units: half seconds lasted (the pauses after saves left out) and 3 per gold star. */
export function flipV8Units(state: FlipState): number {
  const alive = state.ended === 1 ? FLIP_RUN_TICKS : clampInt(state.tick, 0, FLIP_RUN_TICKS);
  return Math.floor(Math.max(0, alive - (state.lost ?? 0)) / 30) + 3 * flipStarsTaken(state);
}

function flipV8Parts(state: FlipState): BandParts {
  const units = flipV8Units(state);
  const finished = state.ended === 1;
  const f = flipV8Features(state);
  const secs = ((state.ended === 1 ? FLIP_RUN_TICKS : state.tick) / 60).toFixed(1);
  const saves = state.saves ? ` · ${state.saves} saved` : "";
  const parts = [`${flipTrailStars(state).full} trails`, `${flipSweetsTaken(state)} sweet`, `combo ${f.combo}`, `${state.zonesOk ?? 0} zones`, `${state.cleanCps ?? 0} checkpoints`];
  const bits = f.raw ? [`skill ${f.total} (${parts.join(", ")})`] : [];
  return {
    units,
    points: bandPoints(FLIP_V8_BAND_CURVE, units),
    bonus: (finished ? BAND_FINISH_BONUS : 0) + f.total,
    penalty: 0,
    finished,
    text: `${secs} s · ${flipStarsTaken(state)} stars${saves}`,
    bonusText: [finished ? "Lasted the minute" : "", ...bits].filter(Boolean).join(" · ") || "Bonus",
  };
}

/** The rev-8 cap: Roofbound's round maximum (roundMax.ts). */
const FLIP_V8_MAX = 200;

function flipV8Score(state: FlipState): number {
  return bandTotal(flipV8Parts(state), Boolean(state.acted), FLIP_V8_MAX);
}

/* Render geometry (art, effects and checks only; the sim never reads it). */

/** A surface's unbent y (px) at world x: the original corridor's fixed lines, or rev 8's cave height about FLIP_V8_CY. */
export function flipSurfaceBase(state: Pick<FlipState, "exp" | "v8">, side: number, worldX: number): number {
  if (!state.exp || !state.v8) return side === 0 ? FLIP_FLOOR_Y : FLIP_CEIL_Y;
  const h = flipV8HeightAt(state.v8, worldX);
  return side === 0 ? FLIP_V8_CY + h / 2 : FLIP_V8_CY - h / 2;
}

/** The runner's drawn centre y (px, before the bend) on a side and arc timer; `lift` is half the runner box's height. */
export function flipRunnerBaseY(state: Pick<FlipState, "exp" | "v8" | "x" | "arcN">, side: number, flipT: number, lift: number): number {
  const fy = flipSurfaceBase(state, 0, state.x) - lift;
  const cy = flipSurfaceBase(state, 1, state.x) + lift;
  const target = side === 0 ? fy : cy;
  if (flipT <= 0) return target;
  const from = side === 0 ? cy : fy;
  const n = state.exp ? Math.max(1, state.arcN || FLIP_ARC_TICKS) : FLIP_ARC_TICKS;
  const f = 1 - Math.min(n, flipT) / n;
  return from + (target - from) * f * f * (3 - 2 * f);
}

/** The runner's drawn centre (px) this tick, the bend included (effects and checks). */
export function flipRunnerPoint(state: FlipState): { x: number; y: number } {
  const lift = state.rev === FLIP_REV ? FLIP_RUNNER_H_PX_V2 / 2 : FLIP_RUNNER_H_PX / 2;
  return { x: 90, y: flipRunnerBaseY(state, state.side, state.flipT, lift) + state.warpY };
}

export const flipExpandGame: ArcadeGame<FlipState, ArcadeInputEvent | null> = {
  ...flipGame,
  init: initV8,
  step: bandStep(stepV8),
};
