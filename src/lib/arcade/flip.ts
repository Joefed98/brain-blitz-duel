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
  if (rev === FLIP_REV_STRICT) return flipStrictGame;
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
  const units = Math.floor((state.ended === 1 ? FLIP_RUN_TICKS : clampInt(state.tick, 0, FLIP_RUN_TICKS)) / 30) + 3 * flipStarsTaken(state);
  const finished = state.ended === 1;
  return { units, points: bandPoints(bandCurveOf(state, state.tunec ? FLIP_V4_BAND_CURVE : FLIP_BAND_CURVE), units), bonus: finished ? BAND_FINISH_BONUS : 0, penalty: 0, finished, text: `${((state.ended === 1 ? FLIP_RUN_TICKS : state.tick) / 60).toFixed(1)} s · ${flipStarsTaken(state)} stars`, bonusText: "Lasted the minute" };
}

function scoreBand(state: FlipState): number {
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
