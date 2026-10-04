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
import { isin, TRIG_ONE } from "./trig";

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
export const FLIP_DECISION_OVERHANG = 1;
export const FLIP_DECISION_PAIRED_SPIKES = 2;
export const FLIP_DECISION_FALSE_GAP = 3;

/** Path warp: starts at 20 s, amplitude ramps 0 → max over the next 20 s; period 4–6 s (seeded). */
export const FLIP_WARP_FROM = 20 * TICKS_PER_SECOND;
const WARP_RAMP = 20 * TICKS_PER_SECOND;
const WARP_MAX = 76;
const WARP_PERIOD_MIN = 4 * TICKS_PER_SECOND;
const WARP_PERIOD_SPAN = 2 * TICKS_PER_SECOND + 1;
/** Spatial wavelength of the bend, px. */
const WARP_WAVE = 1600;

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

function blocked(m: Mover, x: number, seg: FlipSeg): boolean {
  return m.flipT === 0 && m.side === seg.side && x + RUNNER_HALF >= seg.x0 && x - RUNNER_HALF <= seg.x1;
}

function buildCourse(seed: number): { segs: FlipSeg[]; rng: number } {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  // Solver states: side | flipT << 1 | landed << 5 (landed capped at SOLVER_LANDED).
  const pack = (side: number, flipT: number, landed: number) => side | (flipT << 1) | (landed << 5);
  let frontier: number[] = [pack(0, 0, SOLVER_LANDED)];
  let tick = 0;
  const end = X_AT[FLIP_RUN_TICKS]!;
  const segs: FlipSeg[] = [];
  let group = 0;
  let groupsAfterTen = 0;
  let decisionsAfterTen = 0;

  /** Advance the frontier until the runner has passed xEnd, dying on `hazards`. */
  const advance = (from: number[], t0: number, xEnd: number, hazards: readonly FlipSeg[]) => {
    let set = from;
    let t = t0;
    while (t < FLIP_RUN_TICKS && X_AT[t]! - RUNNER_HALF <= xEnd) {
      t += 1;
      const seen = new Set<number>();
      const out: number[] = [];
      for (const code of set) {
        const side = code & 1;
        const flipT = (code >> 1) & 15;
        const landed = code >> 5;
        for (const tap of [false, true]) {
          if (tap && (flipT > 0 || landed < SOLVER_LANDED)) continue;
          const m: Mover = { side, flipT };
          moveRunner(m, tap);
          if (hazards.some((seg) => blocked(m, X_AT[t]!, seg))) continue;
          const nl = m.flipT > 0 ? 0 : Math.min(SOLVER_LANDED, landed + 1);
          const next = pack(m.side, m.flipT, nl);
          if (seen.has(next)) continue;
          seen.add(next);
          out.push(next);
        }
      }
      set = out;
      if (!out.length) break;
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
    for (let attempt = 0; attempt < 48 && !result; attempt++) {
      const pattern = requireDecision && attempt < 40 ? 3 + draw(3) : draw(6);
      const side = draw(2);
      const len = Math.trunc(((40 + draw(120)) * FP * speed) / SPEED_START);
      let trial: FlipSeg[];
      const nextGroup = group + 1;
      if (pattern === 3) {
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

export interface FlipState {
  tick: number;
  rng: number;
  x: number;
  side: number;
  flipT: number;
  cursor: number;
  ended: number;
  endedTick: number;
  segs: FlipSeg[];
  /** Seeded warp period (ticks) and phases for the floor and ceiling (angle units). */
  warpPeriod: number;
  warpFloor: number;
  warpCeil: number;
  /** Runner's warped offset this tick, px (follows the surface it is on or arcing between). */
  warpY: number;
}

export function flipWarpAmp(tick: number): number {
  if (tick <= FLIP_WARP_FROM) return 0;
  return Math.trunc((WARP_MAX * Math.min(WARP_RAMP, tick - FLIP_WARP_FROM)) / WARP_RAMP);
}

/** Integer vertical offset (px) of one surface at world x (FP) on this tick. */
export function flipWarpAt(s: FlipState, side: number, worldX: number, tick = s.tick): number {
  const amp = flipWarpAmp(tick);
  if (amp === 0) return 0;
  const base = side === 0 ? s.warpFloor : s.warpCeil;
  const along = Math.trunc((Math.trunc((worldX - s.x) / FP) * 65536) / WARP_WAVE);
  const time = Math.trunc(((tick - FLIP_WARP_FROM) * 65536) / s.warpPeriod);
  return Math.trunc((amp * isin((base + along + time) & 65535)) / TRIG_ONE);
}

const cache = new Map<number, { segs: FlipSeg[]; rng: number }>();

function init(seed: number): FlipState {
  let course = cache.get(seed | 0);
  if (!course) {
    course = buildCourse(seed);
    if (cache.size > 16) cache.clear();
    cache.set(seed | 0, course);
  }
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
    warpCeil: ceil.value,
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
  while (cursor < s.segs.length && s.segs[cursor]!.x1 < s.x - RUNNER_HALF) cursor += 1;
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
    if (seg.x0 > s.x + RUNNER_HALF) break;
    if (blocked(s, s.x, seg)) hit = true;
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

/** floor(150 × (seconds survived ÷ 60)²), in whole ticks. */
export function flipScoreOf(ticks: number): number {
  const t = clampInt(ticks, 0, FLIP_RUN_TICKS);
  return clampInt(Math.trunc((150 * t * t) / (FLIP_RUN_TICKS * FLIP_RUN_TICKS)), 0, 150);
}

function score(state: FlipState): number {
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
  for (const value of Object.values(snap)) {
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
  const warped = flipWarpAmp(state.tick) > 0;
  const surfaceLine = (side: number, y: number, a: number, b: number) => {
    if (b <= a) return;
    ctx.moveTo(a, y + wy(side, a));
    if (warped) for (let px = Math.ceil(a / 8) * 8; px < b; px += 8) ctx.lineTo(px, y + wy(side, px));
    ctx.lineTo(b, y + wy(side, b));
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
    const y = (seg.side === 0 ? FLIP_FLOOR_Y : FLIP_CEIL_Y) + wy(seg.side, (Math.max(0, a) + Math.min(FLIP_WORLD_W, b)) / 2);
    const dirY = seg.side === 0 ? -1 : 1;
    if (seg.kind === FLIP_SPIKE) {
      ctx.fillStyle = FLIP_RED;
      ctx.beginPath();
      for (let px = a; px < b; px += 16) {
        ctx.moveTo(px, y);
        ctx.lineTo(px + 8, y + dirY * 22);
        ctx.lineTo(Math.min(b, px + 16), y);
      }
      ctx.fill();
    } else if (seg.kind === FLIP_GAP) {
      // Red jagged void with hazard chevrons at both ends.
      const depth = 40;
      ctx.fillStyle = "rgba(255,77,94,0.28)";
      ctx.beginPath();
      ctx.moveTo(a, y);
      let zig = 0;
      for (let px = a; px < b; px += 10) {
        zig ^= 1;
        ctx.lineTo(Math.min(b, px + 10), y - dirY * (zig ? depth : depth - 12));
      }
      ctx.lineTo(b, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = FLIP_RED;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = FLIP_RED;
      for (const [cx, point] of [[a, 1], [b, -1]] as const) {
        for (let k = 0; k < 2; k++) {
          const tip = cx + point * (6 + k * 9);
          ctx.beginPath();
          ctx.moveTo(tip - point * 8, y - dirY * 2);
          ctx.lineTo(tip, y - dirY * 8);
          ctx.lineTo(tip - point * 8, y - dirY * 14);
          ctx.lineTo(tip - point * 4, y - dirY * 8);
          ctx.closePath();
          ctx.fill();
        }
      }
    } else {
      ctx.fillStyle = FLIP_RED;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(a, seg.side === 0 ? y - 34 : y, b - a, 34);
      ctx.globalAlpha = 1;
    }
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
  step,
  isOver,
  score,
  draw,
  inputRanges: FLIP_INPUT_RANGES,
};
