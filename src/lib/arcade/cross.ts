/**
 * Cross — an arcade game on the shared engine.
 *
 * Nine lanes of traffic between a start kerb and a goal kerb. Every crossing's
 * course (lane directions, speeds, block widths and spacings) is generated in
 * full at init and proved crossable by a search over lane, column and tick, so
 * everyone drives through the identical traffic. All sim values are integers in
 * 1/256-pixel units and no randomness is drawn during play.
 */

import {
  clampInt,
  inputRange,
  px,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { BAND_STRICT_MARK, bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, type BandFields, type BandParts } from "./scoreBands";
import { roundMaxFor } from "../duel/roundMax";

/* ============================== Constants ============================== */

export const CROSS_WORLD_W = 390;
export const CROSS_WORLD_H = 580;

export const CROSS_RUN_SECONDS = 60;
export const CROSS_RUN_TICKS = CROSS_RUN_SECONDS * TICKS_PER_SECOND;

export const CROSS_LANES = 9;
export const CROSS_LANE_H = 52;
/** Thirteen half-column positions: sideways swipes move 26 px. */
export const CROSS_COLS = 13;
export const CROSS_COL_W = 26;
export const CROSS_BOARD_W = (CROSS_COLS + 1) * CROSS_COL_W;
export const CROSS_BOARD_X = (CROSS_WORLD_W - CROSS_BOARD_W) / 2;

export const CROSS_HUD_H = 36;
export const CROSS_KERB_H = 34;
/** Top of the first (topmost) lane. */
export const CROSS_LANES_Y = CROSS_HUD_H + CROSS_KERB_H;

/** The player: a gold disc, 16 px across the half-width. */
export const CROSS_PLAYER_R = 16;
export const CROSS_PLAYER_HALF_FP = 4_096;

/** A hop takes six ticks and moves one lane up. */
export const CROSS_HOP_TICKS = 6;

/** How many crossings are laid out at init; later crossings reuse the last. */
export const CROSS_COURSES = 10;
/** Crossing 2 retains the original 10% increase; later crossings add a fixed step. */
export const CROSS_SPEED_GROWTH_INITIAL = 11;
export const CROSS_SPEED_GROWTH_DEN = 10;
export const CROSS_SPEED_RAMP_FROM = 3;
export const CROSS_SPEED_STEP_FP = 64;
export const CROSS_SPEED_MIN_FP = 96;
export const CROSS_SPEED_SPAN_FP = 120;
export const CROSS_BLOCK_MIN_FP = 16_384;
export const CROSS_BLOCK_SPAN_FP = 14_336;
export const CROSS_GAP_MIN_FP = 28_672;
export const CROSS_GAP_SPAN_FP = 23_040;

/** 2 per lane advanced, +4 per completed crossing (a full crossing = 22). */
export const CROSS_LANE_POINTS = 2;
export const CROSS_CROSSING_POINTS = 4;
export const CROSS_LIVES = 3;

/** A move: a = 0 up, 1 down, 2 left, 3 right — each from a swipe. */
export const CROSS_INPUT_MOVE = 5;
export const CROSS_INPUT_RANGES: readonly InputRange[] = [inputRange(CROSS_INPUT_MOVE, [0, 3])];

/** Swipes shorter than this, in screen pixels, are not a move. */
export const CROSS_SWIPE_PX = 24;

/** The breather on the kerb between one crossing and the next. */
export const CROSS_PAUSE_TICKS = TICKS_PER_SECOND;

/* ------------------------- crossRev 2 (Oct 2026) ------------------------- */

/**
 * Stored as puzzle.crossRev. Rev 2 keeps the scoring, lives, timing and input
 * encoding and changes only the generated courses: fair early crossings,
 * cyclist lanes from crossing 3 and roadworks from crossing 4. Rounds without
 * crossRev replay on the original courses.
 */
export const CROSS_REV2 = 2;
/**
 * crossRev 3 (current): as rev 2, but each cyclist lane carries a few riders at
 * seeded, uneven spacing (CROSS_CYCLE3_*), so they come far less often and never
 * on a fixed rhythm.
 */
export const CROSS_REV = 3;
export const CROSS_CYCLE3_RIDERS = 3;
/** Gap between one rider's tail and the next rider's nose, px × 256: 400–960 px. */
export const CROSS_CYCLE3_GAP_MIN_FP = 102_400;
export const CROSS_CYCLE3_GAP_SPAN_FP = 143_360;
export const CROSS_KIND_CYCLE = 1;
export const CROSS_KIND_ROADWORKS = 2;
/** crossRev 9 only: the grass checkpoint island (never blocked), long buses and fast motorbikes. */
export const CROSS_KIND_ISLAND = 3;
export const CROSS_KIND_BUS = 4;
export const CROSS_KIND_MOTO = 5;
/** Crossings 1–2 (indices 0–1): every lane's gaps stay open this long at any column. */
export const CROSS_FAIR_COURSES = 2;
export const CROSS_FAIR_WINDOW_TICKS = 90;
export const CROSS_FAIR_BLOCK_SPAN_FP = 8_192;
export const CROSS_FAIR_GAP_MIN_FP = 36_864;
/** A straight-up walker who stands at least this long in every lane can cross. */
export const CROSS_FAIR_DWELL_TICKS = 24;
/** Cyclist lanes: one from crossing 3, two from crossing 6. Narrow, fast riders. */
export const CROSS_CYCLE_FROM = 2;
export const CROSS_CYCLE_TWO_FROM = 5;
export const CROSS_CYCLE_BLOCK_MIN_FP = 8_192;
export const CROSS_CYCLE_BLOCK_SPAN_FP = 2_048;
/** Added on top of the fastest car speed for the crossing. */
export const CROSS_CYCLE_SPEED_MIN_FP = 64;
export const CROSS_CYCLE_SPEED_SPAN_FP = 100;
export const CROSS_CYCLE_GAP_MIN_FP = 28_672;
export const CROSS_CYCLE_GAP_SPAN_FP = 16_384;
/** Roadworks: one closed lane from crossing 4; from crossing 7 a chicane of two, one traffic lane apart. */
export const CROSS_ROADWORKS_FROM = 3;
export const CROSS_ROADWORKS_TWO_FROM = 6;
/** Half-column positions left open through the cones. */
export const CROSS_ROADWORKS_OPENING = 3;

/* ----------------------- crossRev 9: the expansion (x200, 26 Oct 2026) ----------------------- */

/**
 * crossRev 9 (x200, docs/expansions/x200-cross.md; the parked Expansion E1 crossRev 8, never dealt,
 * renumbered): a taller world (390×727, filling the iPhone 11 play box) with
 * thirteen traffic lanes and a grass checkpoint island halfway (row 7 of 14), a shorter start
 * pavement, long buses and fast motorbikes, gold coins in the riskiest lanes and a streak
 * multiplier for back-to-back crossings without a hit. Twenty coins a run (four on each of the
 * first five crossings), whatever the seed. Scored to 200 (roundMax.ts): the play
 * itself (rows and crossings) on CROSS_V9_BAND_CURVE up to 150, plus up to 50 from coins and the
 * streak paid on CROSS_V9_SKILL_PAY.
 */
export const CROSS_REV_EXPAND = 9;
export const CROSS_X_WORLD_H = 727;
/** Rows between the kerbs: 13 lanes and the island. */
export const CROSS_X_ROWS = 14;
/** The island's row (1-based from the bottom): six lanes below it, seven above. */
export const CROSS_X_ISLAND = 7;
export const CROSS_X_LANE_H = 44;
/** The start pavement, shorter than the goal kerb (34 px). */
export const CROSS_X_START_H = 28;
/** Courses are proved over a longer horizon: a crossing has 14 rows. */
export const CROSS_X_SEARCH_TICKS = 1200;
/** Buses: long (136–168 px), a little slower than the lane's cars, small gaps (80–112 px). */
export const CROSS_X_BUS_BLOCK_MIN_FP = 34_816;
export const CROSS_X_BUS_BLOCK_SPAN_FP = 8_192;
export const CROSS_X_BUS_GAP_MIN_FP = 20_480;
export const CROSS_X_BUS_GAP_SPAN_FP = 8_192;
export const CROSS_X_BUS_SPEED_NUM = 4;
export const CROSS_X_BUS_SPEED_DEN = 5;
/** One bus lane from crossing 2, two from crossing 5. */
export const CROSS_X_BUS_FROM = 1;
export const CROSS_X_BUS_TWO_FROM = 4;
/** Motorbikes: narrow (36–43 px), far faster than the fastest car, two per lane with 560–1,060 px between. */
export const CROSS_X_MOTO_BLOCK_MIN_FP = 9_216;
export const CROSS_X_MOTO_BLOCK_SPAN_FP = 1_792;
export const CROSS_X_MOTO_SPEED_MIN_FP = 200;
export const CROSS_X_MOTO_SPEED_SPAN_FP = 140;
export const CROSS_X_MOTO_RIDERS = 2;
export const CROSS_X_MOTO_GAP_MIN_FP = 143_360;
export const CROSS_X_MOTO_GAP_SPAN_FP = 128_000;
/** One motorbike lane from crossing 3, two from crossing 6. */
export const CROSS_X_MOTO_FROM = 2;
export const CROSS_X_MOTO_TWO_FROM = 5;
/** Coins: one in each of the riskiest lanes, two below the island and two above, columns 1–2 or 10–11, on crossings 1–5 only. */
export const CROSS_X_COIN_CROSSINGS = 5;
export const CROSS_X_COINS_PER_HALF = 2;
/** Every run holds exactly this many coins (four on each of the first five crossings). */
export const CROSS_X_COINS_PER_RUN = CROSS_X_COIN_CROSSINGS * CROSS_X_COINS_PER_HALF * 2;
export const CROSS_X_COIN_POINTS = 3;
/** The streak multiplier: ×1 on the first crossing without a hit, then ×2, ×3, ×4 at most. */
export const CROSS_X_MULT_MAX = 4;
/** Each crossing without a hit adds this × (multiplier − 1) to the streak pool (1: ×2 pays 1, ×3 pays 2, ×4 pays 3). */
export const CROSS_X_STREAK_POINTS = 1;
/** Coins and the streak together add at most this. */
export const CROSS_X_BONUS_MAX = 50;

/** One world's layout. Every revision before crossRev 9 uses CROSS_GEOM. */
export interface CrossGeom {
  worldH: number;
  /** Rows between the kerbs (lanes, plus the island on crossRev 9). */
  rows: number;
  laneH: number;
  goalH: number;
  startH: number;
  /** The island's row, 0 when there is none. */
  island: number;
  /** Vehicles are drawn this far inside their lane, top and bottom. */
  inset: number;
}
export const CROSS_GEOM: CrossGeom = { worldH: CROSS_WORLD_H, rows: CROSS_LANES, laneH: CROSS_LANE_H, goalH: CROSS_KERB_H, startH: CROSS_KERB_H, island: 0, inset: 7 };
export const CROSS_GEOM_X: CrossGeom = { worldH: CROSS_X_WORLD_H, rows: CROSS_X_ROWS, laneH: CROSS_X_LANE_H, goalH: CROSS_KERB_H, startH: CROSS_X_START_H, island: CROSS_X_ISLAND, inset: 6 };

/** The layout a run is played in (crossRev 9 states carry `wide`). */
export function crossGeomOf(state: { wide?: number }): CrossGeom {
  return state.wide ? CROSS_GEOM_X : CROSS_GEOM;
}
/** The rows between the kerbs for a run. */
export function crossRowsOf(state: { wide?: number }): number {
  return state.wide ? CROSS_X_ROWS : CROSS_LANES;
}
/** The world height for a stored crossRev (reveals, intros and the arena slot). */
export function crossWorldHFor(rev?: number | null): number {
  return rev === CROSS_REV_EXPAND ? CROSS_X_WORLD_H : CROSS_WORLD_H;
}
/** The streak multiplier a crossing completed as the `streak`-th in a row without a hit pays. */
export function crossMultiplierFor(streak: number): number {
  return clampInt(streak, 1, CROSS_X_MULT_MAX);
}

/* ============================== Course ================================= */

export interface CrossLane {
  /** crossRev 2 only: CROSS_KIND_CYCLE or CROSS_KIND_ROADWORKS; absent = cars. */
  kind?: number;
  /** crossRev 2 roadworks only: columns closed by cones and barriers. */
  closed?: number[];
  /** crossRev 3 cyclists (and crossRev 9 motorbikes) only: each rider's start within the period (blockW wide each). */
  offsets?: number[];
  /** +1 moves right, −1 moves left. */
  dir: number;
  /** Fixed-point units a tick. */
  speed: number;
  blockW: number;
  period: number;
  phase: number;
}

export interface CrossCourse {
  lanes: CrossLane[];
  /** crossRev 9 only: the crossing's gold coins, each a cell `lane * 16 + col` (lane 1-based). */
  coins?: number[];
}

function mod(value: number, m: number): number {
  const r = value % m;
  return r < 0 ? r + m : r;
}

/** True when the player's disc at this column centre touches a block (half: the disc's half-width, 1/256 px). */
export function crossBlocked(lane: CrossLane, centreFp: number, rel: number, half = CROSS_PLAYER_HALF_FP): boolean {
  if (lane.kind === CROSS_KIND_ROADWORKS || lane.kind === CROSS_KIND_ISLAND) return false;
  const left = centreFp - half;
  const span = half * 2;
  const u = mod(left - lane.dir * lane.speed * rel - lane.phase, lane.period);
  if (lane.offsets) {
    // Uneven riders: the disc's span [u, u + span) against each rider, wrapping at the period.
    for (const start of lane.offsets) {
      const d = mod(u - start, lane.period);
      if (d < lane.blockW || d + span > lane.period) return true;
    }
    return false;
  }
  return u < lane.blockW || u + span > lane.period;
}

export function crossColumnCentreFp(col: number): number {
  return (CROSS_BOARD_X + (col + 1) * CROSS_COL_W) * 256;
}

/** The search horizon used when proving a crossing is passable. */
export const CROSS_SEARCH_TICKS = 900;

/**
 * A breadth-first search over (lane, column, hop progress, tick). A crossing is
 * only accepted when the goal kerb can be reached from the start kerb. The lane
 * count is the course's own (9 on every revision before crossRev 9, whose 14
 * rows include the island), so older courses search exactly as before.
 */
export function crossPassable(course: CrossCourse, horizon = CROSS_SEARCH_TICKS): boolean {
  const rows = course.lanes.length;
  // Key: (lane * columns + column) * 7 + ticks left in the hop.
  const key = (lane: number, col: number, hop: number) => (lane * CROSS_COLS + col) * 7 + hop;
  let frontier = new Set<number>([key(0, CROSS_COLS >> 1, 0)]);
  for (let rel = 1; rel <= horizon && frontier.size > 0; rel++) {
    const next = new Set<number>();
    let arrived = false;
    const consider = (lane: number, col: number, hop: number) => {
      if (lane > rows) {
        arrived = true;
        return;
      }
      if (hop === 0 && lane >= 1) {
        const laneDef = course.lanes[lane - 1];
        if (laneDef && crossBlocked(laneDef, crossColumnCentreFp(col), rel)) return;
      }
      next.add(key(lane, col, hop));
    };
    for (const id of frontier) {
      const hop = id % 7;
      const rest = Math.trunc(id / 7);
      const col = rest % CROSS_COLS;
      const lane = Math.trunc(rest / CROSS_COLS);
      if (hop > 0) {
        const left = hop - 1;
        if (left === 0) consider(lane + 1, col, 0);
        else consider(lane, col, left);
        continue;
      }
      consider(lane, col, 0);
      if (col > 0 && !crossClosed(course, lane, col - 1)) consider(lane, col - 1, 0);
      if (col < CROSS_COLS - 1 && !crossClosed(course, lane, col + 1)) consider(lane, col + 1, 0);
      if (!crossClosed(course, lane + 1, col)) consider(lane, col, CROSS_HOP_TICKS);
    }
    if (arrived) return true;
    frontier = next;
  }
  return false;
}

/** True when roadworks close this column of a lane (1…9, 1…14 on crossRev 9); kerbs are never closed. */
export function crossClosed(course: CrossCourse, lane: number, col: number): boolean {
  if (lane < 1 || lane > course.lanes.length) return false;
  const closed = course.lanes[lane - 1]?.closed;
  return !!closed && closed.includes(col);
}

export function crossSpeedFor(base: number, index: number): number {
  if (index === 0) return base;
  const second = Math.trunc(base * CROSS_SPEED_GROWTH_INITIAL / CROSS_SPEED_GROWTH_DEN);
  return second + Math.max(0, index - CROSS_SPEED_RAMP_FROM + 2) * CROSS_SPEED_STEP_FP;
}

function rollCourse(rng: number, index: number): { rng: number; course: CrossCourse } {
  let state = rng;
  for (let attempt = 0; attempt < 40; attempt++) {
    const lanes: CrossLane[] = [];
    for (let lane = 0; lane < CROSS_LANES; lane++) {
      const d = rngBelow(state, 2);
      state = d.state;
      const s = rngBelow(state, CROSS_SPEED_SPAN_FP);
      state = s.state;
      const w = rngBelow(state, CROSS_BLOCK_SPAN_FP);
      state = w.state;
      const g = rngBelow(state, CROSS_GAP_SPAN_FP);
      state = g.state;
      const blockW = CROSS_BLOCK_MIN_FP + w.value;
      const gap = CROSS_GAP_MIN_FP + g.value;
      const speed = crossSpeedFor(CROSS_SPEED_MIN_FP + s.value, index);
      const period = blockW + gap;
      const p = rngBelow(state, period);
      state = p.state;
      lanes.push({
        dir: d.value === 0 ? 1 : -1,
        speed,
        blockW,
        period,
        phase: p.value,
      });
    }
    const course = { lanes };
    if (crossPassable(course)) return { rng: state, course };
  }
  // A last-resort course with wide gaps; still deterministic.
  const lanes: CrossLane[] = [];
  for (let lane = 0; lane < CROSS_LANES; lane++) {
    lanes.push({
      dir: lane % 2 === 0 ? 1 : -1,
      speed: index < CROSS_SPEED_RAMP_FROM - 1 ? CROSS_SPEED_MIN_FP
        : crossSpeedFor(CROSS_SPEED_MIN_FP, index),
      blockW: CROSS_BLOCK_MIN_FP,
      period: CROSS_BLOCK_MIN_FP + CROSS_GAP_MIN_FP + CROSS_GAP_SPAN_FP,
      phase: lane * 4_096,
    });
  }
  return { rng: state, course: { lanes } };
}

/** A car lane drawn from the rev-2 stream: fair (wide, slow-blocked) on crossings 1–2. */
function rollCarLaneV2(rng: number, index: number): { rng: number; lane: CrossLane } {
  let state = rng;
  const draw = (bound: number) => {
    const r = rngBelow(state, bound);
    state = r.state;
    return r.value;
  };
  const dir = draw(2) === 0 ? 1 : -1;
  const speed = crossSpeedFor(CROSS_SPEED_MIN_FP + draw(CROSS_SPEED_SPAN_FP), index);
  const fair = index < CROSS_FAIR_COURSES;
  const blockW = CROSS_BLOCK_MIN_FP + draw(fair ? CROSS_FAIR_BLOCK_SPAN_FP : CROSS_BLOCK_SPAN_FP);
  let gap = (fair ? CROSS_FAIR_GAP_MIN_FP : CROSS_GAP_MIN_FP) + draw(CROSS_GAP_SPAN_FP);
  // The gap must clear the walker's disc and still stay open for the fair window.
  if (fair) gap = Math.max(gap, CROSS_PLAYER_HALF_FP * 2 + CROSS_FAIR_WINDOW_TICKS * speed);
  const period = blockW + gap;
  return { rng: state, lane: { dir, speed, blockW, period, phase: draw(period) } };
}

/** crossRev 3: a few riders per lane, spaced unevenly from the seed (no fixed rhythm). */
function rollCycleLaneV3(rng: number, index: number): { rng: number; lane: CrossLane } {
  let state = rng;
  const draw = (bound: number) => {
    const r = rngBelow(state, bound);
    state = r.state;
    return r.value;
  };
  const dir = draw(2) === 0 ? 1 : -1;
  const speed = crossSpeedFor(CROSS_SPEED_MIN_FP + CROSS_SPEED_SPAN_FP, index) +
    CROSS_CYCLE_SPEED_MIN_FP + draw(CROSS_CYCLE_SPEED_SPAN_FP);
  const blockW = CROSS_CYCLE_BLOCK_MIN_FP + draw(CROSS_CYCLE_BLOCK_SPAN_FP);
  const offsets: number[] = [];
  let at = 0;
  for (let k = 0; k < CROSS_CYCLE3_RIDERS; k++) {
    offsets.push(at);
    at += blockW + CROSS_CYCLE3_GAP_MIN_FP + draw(CROSS_CYCLE3_GAP_SPAN_FP);
  }
  return { rng: state, lane: { kind: CROSS_KIND_CYCLE, dir, speed, blockW, period: at, phase: draw(at), offsets } };
}

function rollCycleLaneV2(rng: number, index: number): { rng: number; lane: CrossLane } {
  let state = rng;
  const draw = (bound: number) => {
    const r = rngBelow(state, bound);
    state = r.state;
    return r.value;
  };
  const dir = draw(2) === 0 ? 1 : -1;
  // Always quicker than the fastest car this crossing can roll.
  const speed = crossSpeedFor(CROSS_SPEED_MIN_FP + CROSS_SPEED_SPAN_FP, index) +
    CROSS_CYCLE_SPEED_MIN_FP + draw(CROSS_CYCLE_SPEED_SPAN_FP);
  const blockW = CROSS_CYCLE_BLOCK_MIN_FP + draw(CROSS_CYCLE_BLOCK_SPAN_FP);
  const period = blockW + CROSS_CYCLE_GAP_MIN_FP + draw(CROSS_CYCLE_GAP_SPAN_FP);
  return { rng: state, lane: { kind: CROSS_KIND_CYCLE, dir, speed, blockW, period, phase: draw(period) } };
}

/** A closed lane: no traffic, cones on every column but one opening away from the middle. */
function roadworksLane(openFrom: number): CrossLane {
  const closed: number[] = [];
  for (let col = 0; col < CROSS_COLS; col++)
    if (col < openFrom || col >= openFrom + CROSS_ROADWORKS_OPENING) closed.push(col);
  return { kind: CROSS_KIND_ROADWORKS, closed, dir: 1, speed: 0, blockW: 0, period: 1 << 20, phase: 0 };
}

/**
 * Up-only walker proof for the fair crossings: starting at rel 0 on the middle
 * column, hopping only forward and standing at least CROSS_FAIR_DWELL_TICKS in
 * each lane, the goal kerb is still reachable.
 */
export function crossFairPassable(course: CrossCourse, horizon = CROSS_SEARCH_TICKS): boolean {
  const col = CROSS_COLS >> 1;
  const centre = crossColumnCentreFp(col);
  // Per lane, the set of ticks the walker can be standing there (dwell counted).
  let ready = new Set<number>();
  for (let rel = CROSS_FAIR_DWELL_TICKS; rel <= horizon; rel++) ready.add(rel);
  for (let lane = 1; lane <= course.lanes.length; lane++) {
    const laneDef = course.lanes[lane - 1];
    if (!laneDef || crossClosed(course, lane, col)) return false;
    const next = new Set<number>();
    for (const start of [...ready].sort((a, b) => a - b)) {
      const land = start + CROSS_HOP_TICKS;
      let ok = true;
      for (let rel = land; rel < land + CROSS_FAIR_DWELL_TICKS && ok; rel++)
        if (crossBlocked(laneDef, centre, rel)) ok = false;
      if (!ok) continue;
      // Standing on: every later tick while the lane stays clear is a hop-off point.
      for (let rel = land + CROSS_FAIR_DWELL_TICKS; rel <= horizon && !crossBlocked(laneDef, centre, rel); rel++) {
        if (next.has(rel)) break;
        next.add(rel);
      }
    }
    if (next.size === 0) return false;
    ready = next;
  }
  return true;
}

function rollCourseV2(rng: number, index: number, rev = CROSS_REV2): { rng: number; course: CrossCourse } {
  let state = rng;
  const draw = (bound: number) => {
    const r = rngBelow(state, bound);
    state = r.state;
    return r.value;
  };
  for (let attempt = 0; attempt < 40; attempt++) {
    // Which lanes (0-based) close for roadworks and which carry cyclists.
    const special = new Map<number, CrossLane>();
    /** The traffic lane inside a chicane stays a car lane. */
    let between = -1;
    if (index >= CROSS_ROADWORKS_FROM) {
      const two = index >= CROSS_ROADWORKS_TWO_FROM;
      const first = 1 + draw(two ? CROSS_LANES - 3 : CROSS_LANES - 2);
      // Openings sit to one side of the middle column so the walker must sidestep.
      const side = draw(2);
      const span = (CROSS_COLS >> 1) - CROSS_ROADWORKS_OPENING;
      const open = side === 0 ? draw(span + 1) : (CROSS_COLS >> 1) + 1 + draw(span + 1);
      special.set(first, roadworksLane(open));
      if (two) {
        const other = side === 0 ? (CROSS_COLS >> 1) + 1 + draw(span + 1) : draw(span + 1);
        special.set(first + 2, roadworksLane(other));
        between = first + 1;
      }
    }
    const cycles = index >= CROSS_CYCLE_TWO_FROM ? 2 : index >= CROSS_CYCLE_FROM ? 1 : 0;
    for (let k = 0; k < cycles; k++) {
      let lane = draw(CROSS_LANES);
      while (special.has(lane) || lane === between) lane = (lane + 1) % CROSS_LANES;
      const rolled = rev >= CROSS_REV ? rollCycleLaneV3(state, index) : rollCycleLaneV2(state, index);
      state = rolled.rng;
      special.set(lane, rolled.lane);
    }
    const lanes: CrossLane[] = [];
    for (let lane = 0; lane < CROSS_LANES; lane++) {
      const fixed = special.get(lane);
      if (fixed) {
        lanes.push(fixed);
        continue;
      }
      const rolled = rollCarLaneV2(state, index);
      state = rolled.rng;
      lanes.push(rolled.lane);
    }
    const course = { lanes };
    const fair = index >= CROSS_FAIR_COURSES || crossFairPassable(course);
    if (fair && crossPassable(course)) return { rng: state, course };
  }
  // A last resort: wide, slow car lanes (the fair rules), still deterministic.
  const lanes: CrossLane[] = [];
  for (let lane = 0; lane < CROSS_LANES; lane++) {
    const period = CROSS_BLOCK_MIN_FP + CROSS_FAIR_GAP_MIN_FP + CROSS_GAP_SPAN_FP;
    lanes.push({ dir: lane % 2 === 0 ? 1 : -1, speed: CROSS_SPEED_MIN_FP, blockW: CROSS_BLOCK_MIN_FP, period, phase: lane * 9_000 });
  }
  return { rng: state, course: { lanes } };
}

/* ------------------------- crossRev 9 courses ------------------------- */

/** The grass island: no traffic, never blocked, never closed. */
function islandLane(): CrossLane {
  return { kind: CROSS_KIND_ISLAND, dir: 1, speed: 0, blockW: 0, period: 1 << 20, phase: 0 };
}

/** A bus lane: long vehicles a little slower than the crossing's cars, with small gaps (fair-rule aware). */
function rollBusLaneX(rng: number, index: number): { rng: number; lane: CrossLane } {
  let state = rng;
  const draw = (bound: number) => {
    const r = rngBelow(state, bound);
    state = r.state;
    return r.value;
  };
  const dir = draw(2) === 0 ? 1 : -1;
  const base = crossSpeedFor(CROSS_SPEED_MIN_FP + draw(CROSS_SPEED_SPAN_FP), index);
  const speed = Math.trunc((base * CROSS_X_BUS_SPEED_NUM) / CROSS_X_BUS_SPEED_DEN);
  const blockW = CROSS_X_BUS_BLOCK_MIN_FP + draw(CROSS_X_BUS_BLOCK_SPAN_FP);
  let gap = CROSS_X_BUS_GAP_MIN_FP + draw(CROSS_X_BUS_GAP_SPAN_FP);
  if (index < CROSS_FAIR_COURSES) gap = Math.max(gap, CROSS_PLAYER_HALF_FP * 2 + CROSS_FAIR_WINDOW_TICKS * speed);
  const period = blockW + gap;
  return { rng: state, lane: { kind: CROSS_KIND_BUS, dir, speed, blockW, period, phase: draw(period) } };
}

/** A motorbike lane: two narrow riders far faster than any car, far apart at seeded uneven spacing. */
function rollMotoLaneX(rng: number, index: number): { rng: number; lane: CrossLane } {
  let state = rng;
  const draw = (bound: number) => {
    const r = rngBelow(state, bound);
    state = r.state;
    return r.value;
  };
  const dir = draw(2) === 0 ? 1 : -1;
  const speed = crossSpeedFor(CROSS_SPEED_MIN_FP + CROSS_SPEED_SPAN_FP, index) + CROSS_X_MOTO_SPEED_MIN_FP + draw(CROSS_X_MOTO_SPEED_SPAN_FP);
  const blockW = CROSS_X_MOTO_BLOCK_MIN_FP + draw(CROSS_X_MOTO_BLOCK_SPAN_FP);
  const offsets: number[] = [];
  let at = 0;
  for (let k = 0; k < CROSS_X_MOTO_RIDERS; k++) {
    offsets.push(at);
    at += blockW + CROSS_X_MOTO_GAP_MIN_FP + draw(CROSS_X_MOTO_GAP_SPAN_FP);
  }
  return { rng: state, lane: { kind: CROSS_KIND_MOTO, dir, speed, blockW, period: at, phase: draw(at), offsets } };
}

/** The columns a coin may sit on: out near the edges, so a coin is gone for, not stumbled on. */
export const CROSS_X_COIN_COLS = [1, 2, 10, 11] as const;

/**
 * The crossing's coins (crossings 1–CROSS_X_COIN_CROSSINGS only, so every run holds exactly
 * CROSS_X_COINS_PER_RUN): in each half (below and above the island) the fastest traffic lanes
 * (cars, buses, bikes or motorbikes; never roadworks) get one coin each on a seeded column
 * 1–2 or 10–11 that the lane below leaves open (so it can be hopped into straight from below;
 * a lane above roadworks takes one of the columns through the cones, or is passed over).
 */
function placeCoinsX(rng: number, lanes: CrossLane[], index: number): { rng: number; coins: number[] } {
  if (index >= CROSS_X_COIN_CROSSINGS) return { rng, coins: [] };
  let state = rng;
  const coins: number[] = [];
  const course: CrossCourse = { lanes };
  for (const [from, to] of [[0, CROSS_X_ISLAND - 1], [CROSS_X_ISLAND, lanes.length]] as const) {
    const pool: number[] = [];
    for (let i = from; i < to; i++) {
      const kind = lanes[i]?.kind;
      if (kind !== CROSS_KIND_ROADWORKS && kind !== CROSS_KIND_ISLAND) pool.push(i);
    }
    pool.sort((a, b) => lanes[b]!.speed - lanes[a]!.speed || a - b);
    let placed = 0;
    for (const i of pool) {
      if (placed === CROSS_X_COINS_PER_HALF) break;
      // Lane i + 1 (1-based); the lane below is i (0 = the pavement, the island never closed).
      const cols = CROSS_X_COIN_COLS.filter((c) => !crossClosed(course, i, c));
      if (cols.length === 0) continue;
      const r = rngBelow(state, cols.length);
      state = r.state;
      coins.push((i + 1) * 16 + cols[r.value]!);
      placed += 1;
    }
  }
  return { rng: state, coins };
}

function rollCourseV9(rng: number, index: number): { rng: number; course: CrossCourse } {
  let state = rng;
  const draw = (bound: number) => {
    const r = rngBelow(state, bound);
    state = r.state;
    return r.value;
  };
  const rows = CROSS_X_ROWS;
  const island = CROSS_X_ISLAND - 1;
  for (let attempt = 0; attempt < 40; attempt++) {
    const special = new Map<number, CrossLane>([[island, islandLane()]]);
    /** The traffic lane inside a chicane stays a car lane. */
    let between = -1;
    if (index >= CROSS_ROADWORKS_FROM) {
      const two = index >= CROSS_ROADWORKS_TWO_FROM;
      // Starts that keep the closed lanes (and a chicane's middle) off the outer lanes and the island.
      const starts: number[] = [];
      for (let first = 1; first + (two ? 2 : 0) <= rows - 2; first++)
        if (first !== island && (!two || (first + 1 !== island && first + 2 !== island))) starts.push(first);
      const first = starts[draw(starts.length)]!;
      const side = draw(2);
      const span = (CROSS_COLS >> 1) - CROSS_ROADWORKS_OPENING;
      const open = side === 0 ? draw(span + 1) : (CROSS_COLS >> 1) + 1 + draw(span + 1);
      special.set(first, roadworksLane(open));
      if (two) {
        const other = side === 0 ? (CROSS_COLS >> 1) + 1 + draw(span + 1) : draw(span + 1);
        special.set(first + 2, roadworksLane(other));
        between = first + 1;
      }
    }
    const free = () => {
      let lane = draw(rows);
      while (special.has(lane) || lane === between) lane = (lane + 1) % rows;
      return lane;
    };
    const cycles = index >= CROSS_CYCLE_TWO_FROM ? 2 : index >= CROSS_CYCLE_FROM ? 1 : 0;
    for (let k = 0; k < cycles; k++) {
      const lane = free();
      const rolled = rollCycleLaneV3(state, index);
      state = rolled.rng;
      special.set(lane, rolled.lane);
    }
    const buses = index >= CROSS_X_BUS_TWO_FROM ? 2 : index >= CROSS_X_BUS_FROM ? 1 : 0;
    for (let k = 0; k < buses; k++) {
      const lane = free();
      const rolled = rollBusLaneX(state, index);
      state = rolled.rng;
      special.set(lane, rolled.lane);
    }
    const motos = index >= CROSS_X_MOTO_TWO_FROM ? 2 : index >= CROSS_X_MOTO_FROM ? 1 : 0;
    for (let k = 0; k < motos; k++) {
      const lane = free();
      const rolled = rollMotoLaneX(state, index);
      state = rolled.rng;
      special.set(lane, rolled.lane);
    }
    const lanes: CrossLane[] = [];
    for (let lane = 0; lane < rows; lane++) {
      const fixed = special.get(lane);
      if (fixed) {
        lanes.push(fixed);
        continue;
      }
      const rolled = rollCarLaneV2(state, index);
      state = rolled.rng;
      lanes.push(rolled.lane);
    }
    const course: CrossCourse = { lanes };
    const fair = index >= CROSS_FAIR_COURSES || crossFairPassable(course, CROSS_X_SEARCH_TICKS);
    if (fair && crossPassable(course, CROSS_X_SEARCH_TICKS)) {
      const placed = placeCoinsX(state, lanes, index);
      return { rng: placed.rng, course: { lanes, coins: placed.coins } };
    }
  }
  // A last resort: wide, slow car lanes round the island (the fair rules), still deterministic.
  const lanes: CrossLane[] = [];
  for (let lane = 0; lane < rows; lane++) {
    const period = CROSS_BLOCK_MIN_FP + CROSS_FAIR_GAP_MIN_FP + CROSS_GAP_SPAN_FP;
    lanes.push(lane === island ? islandLane() : { dir: lane % 2 === 0 ? 1 : -1, speed: CROSS_SPEED_MIN_FP, blockW: CROSS_BLOCK_MIN_FP, period, phase: lane * 9_000 });
  }
  const placed = placeCoinsX(state, lanes, index);
  return { rng: placed.rng, course: { lanes, coins: placed.coins } };
}

/* ================================ State ================================ */

export interface CrossState extends BandFields {
  /** crossRev 2 only; absent on stored original rounds. */
  rev?: number;
  tick: number;
  rng: number;
  courses: CrossCourse[];
  /** Crossings completed. */
  crossings: number;
  /** 0 = start kerb, 1…9 = lanes, 10 = goal kerb. */
  lane: number;
  col: number;
  /** Ticks left in the hop; 0 means standing. */
  hop: number;
  /** Which way the hop under way is going: +1 forward, −1 back. */
  hopDir: number;
  /** The highest lane reached in the crossing under way. */
  reached: number;
  /** The tick the current crossing began, so traffic is timed from it. */
  crossStart: number;
  /** While the tick is at or below this, the disc waits on the kerb. */
  pauseUntil: number;
  dead: boolean;
  endedTick: number;
  /** Lives left, clean crossings banked, and whether this crossing has been hit. */
  lives: number;
  clean: number;
  hitThisCrossing: boolean;
  /** After a respawn the disc ignores traffic until its cell is first clear. */
  ghost: boolean;
  /** Render only: the tick of the last hit. */
  hitTick: number;
  /** crossRev 5 only (Tuning F): the walker's smaller hit box. Absent on every earlier round. */
  tunef?: number;
  /**
   * crossRev 9 only (the expansion, 25 Oct 2026); absent on every earlier round. `wide` marks the
   * 14-row world (13 lanes and the island); `coins` the bits of this crossing's coins collected,
   * `coinTotal` every coin collected; `streak` back-to-back crossings without a hit, `streakPts`
   * the streak bonus banked; `banked` 1 once the island is reached in this crossing.
   */
  wide?: number;
  coins?: number;
  coinTotal?: number;
  streak?: number;
  streakPts?: number;
  banked?: number;
}

function init(seed: number): CrossState {
  return initFor(seed, rollCourse);
}

/**
 * Proven courses per (revision, seed). Proving them is slow (passability searches),
 * and a stage may call init more than once for one run; the courses are read-only.
 */
const courseCache = new Map<string, { rng: number; courses: CrossCourse[] }>();

function initFor(seed: number, roll: (rng: number, index: number) => { rng: number; course: CrossCourse }, key = "1"): CrossState {
  const id = `${key}:${seed | 0}`;
  let built = courseCache.get(id);
  if (!built) {
    let rng = seed | 0;
    const courses: CrossCourse[] = [];
    for (let index = 0; index < CROSS_COURSES; index++) {
      const rolled = roll(rng, index);
      rng = rolled.rng;
      courses.push(rolled.course);
    }
    built = { rng, courses };
    if (courseCache.size >= 16) courseCache.clear();
    courseCache.set(id, built);
  }
  const { rng, courses } = built;
  return {
    tick: 0,
    rng,
    courses,
    crossings: 0,
    lane: 0,
    col: CROSS_COLS >> 1,
    hop: 0,
    hopDir: 1,
    reached: 0,
    crossStart: 0,
    pauseUntil: 0,
    dead: false,
    endedTick: 0,
    lives: CROSS_LIVES,
    clean: 0,
    hitThisCrossing: false,
    ghost: false,
    hitTick: -1000,
  };
}

/** True while the disc is parked on the kerb between crossings. */
export function crossPaused(state: CrossState): boolean {
  return state.tick < state.pauseUntil;
}

export function crossCourse(state: CrossState): CrossCourse {
  const index = Math.min(state.crossings, CROSS_COURSES - 1);
  return state.courses[index] ?? { lanes: [] };
}

function isOver(state: CrossState): boolean {
  return state.dead || state.tick >= CROSS_RUN_TICKS;
}

export function crossSurvived(state: CrossState): boolean {
  return !state.dead && state.tick >= CROSS_RUN_TICKS;
}

function step(state: CrossState, input: ArcadeInputEvent | null): CrossState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  let { lane, col, hop, hopDir, reached, crossings, crossStart, pauseUntil, clean, hitThisCrossing, ghost } = state;
  /** Rows between the kerbs: 9 lanes, or crossRev 9's 13 lanes and the island. */
  const rows = crossRowsOf(state);
  const wide = !!state.wide;
  let coins = state.coins ?? 0;
  let coinTotal = state.coinTotal ?? 0;
  let streak = state.streak ?? 0;
  let streakPts = state.streakPts ?? 0;
  let banked = state.banked ?? 0;
  // Everything sent while the disc waits on the kerb is dropped, so a swipe at
  // the end of one crossing can never carry into the next.
  const paused = tick < pauseUntil;

  if (!paused && hop === 0 && input && input.k === CROSS_INPUT_MOVE) {
    const move = clampInt(input.a, 0, 3);
    // Roadworks (crossRev 2) refuse a move onto a coned-off cell; original courses have none.
    const here = crossCourse({ ...state, crossings });
    if (move === 0) {
      if (!crossClosed(here, lane + 1, col)) {
        hop = CROSS_HOP_TICKS;
        hopDir = 1;
      }
    } else if (move === 1) {
      if (lane > 0 && !crossClosed(here, lane - 1, col)) {
        hop = CROSS_HOP_TICKS;
        hopDir = -1;
      }
    } else if (move === 2) {
      if (!crossClosed(here, lane, col - 1)) col = Math.max(0, col - 1);
    } else if (!crossClosed(here, lane, col + 1)) col = Math.min(CROSS_COLS - 1, col + 1);
  }

  if (hop > 0) {
    hop -= 1;
    if (hop === 0) {
      lane += hopDir;
      if (lane < 0) lane = 0;
      if (lane > reached) reached = lane;
      if (lane > rows) {
        // The goal kerb: bank the crossing, then a second on the start kerb
        // while the traffic of the next crossing keeps rolling.
        crossings += 1;
        if (!hitThisCrossing) clean += 1;
        if (wide) {
          // crossRev 9: a crossing without a hit raises the streak; its multiplier (×1…×4) pays
          // the streak pool. A new crossing has fresh coins and no island banked.
          if (!hitThisCrossing) {
            streak += 1;
            streakPts += CROSS_X_STREAK_POINTS * (crossMultiplierFor(streak) - 1);
          }
          coins = 0;
          banked = 0;
        }
        hitThisCrossing = false;
        ghost = false;
        lane = 0;
        col = CROSS_COLS >> 1;
        reached = 0;
        hopDir = 1;
        pauseUntil = tick + CROSS_PAUSE_TICKS;
        crossStart = pauseUntil;
      } else if (wide && lane === CROSS_X_ISLAND) {
        // crossRev 9: the island banks this crossing's progress.
        banked = 1;
      }
    }
  }

  if (!paused && hop === 0 && lane >= 1 && lane <= rows) {
    const course = crossCourse({ ...state, crossings });
    const laneDef = course.lanes[lane - 1];
    const blocked = !!laneDef && crossBlocked(laneDef, crossColumnCentreFp(col), tick - crossStart, crossPlayerHalfFp(state));
    if (ghost && !blocked) ghost = false;
    if (blocked && !ghost) {
      const lives = state.lives - 1;
      const base = { ...state, tick, lane, hop: 0, hopDir: 1, reached, crossings, crossStart, clean, lives, hitTick: tick };
      // crossRev 9: a hit ends the streak; with the island banked the walker restarts there.
      const extra = wide ? { coins, coinTotal, streak: 0, streakPts, banked } : {};
      if (lives <= 0) return { ...base, ...extra, col, pauseUntil, hitThisCrossing: true, ghost, dead: true, endedTick: tick };
      // Respawn on the start lane of this crossing; keep its progress and traffic clock.
      return { ...base, ...extra, lane: wide && banked ? CROSS_X_ISLAND : 0, col: CROSS_COLS >> 1, pauseUntil: tick + CROSS_PAUSE_TICKS, hitThisCrossing: true, ghost: false };
    }
    // crossRev 9: standing on a coin's cell collects it.
    if (wide && course.coins) {
      const at = course.coins.indexOf(lane * 16 + col);
      if (at >= 0 && !(coins & (1 << at))) {
        coins |= 1 << at;
        coinTotal += 1;
      }
    }
  }

  const next: CrossState = {
    ...state,
    tick,
    lane,
    col,
    hop,
    hopDir,
    reached,
    crossings,
    crossStart,
    pauseUntil,
    clean,
    hitThisCrossing,
    ghost,
    ...(wide ? { coins, coinTotal, streak, streakPts, banked } : {}),
  };
  if (tick >= CROSS_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

/** Bank completed crossings plus the furthest lane reached in the current one (crossRev 9: rows, the island one of them). */
export function crossTotalLanes(state: Pick<CrossState, "crossings" | "reached"> & Pick<CrossState, "wide">): number {
  const rows = crossRowsOf(state);
  return state.crossings * rows + clampInt(state.reached, 0, rows);
}

function score(state: CrossState): number {
  return clampInt(
    CROSS_LANE_POINTS * crossTotalLanes(state) + CROSS_CROSSING_POINTS * state.crossings,
    0,
    150,
  );
}

/* =========================== Integrity checks ========================== */

export const CROSS_CHECKPOINT_INTERVAL = 300;

export interface CrossCheckpointState {
  tick: number;
  crossings: number;
  lane: number;
  col: number;
  hop: number;
  hopDir: number;
  reached: number;
  crossStart: number;
  pauseUntil: number;
  laneSpeed: number;
  lives: number;
  clean: number;
  flags: number;
}

export interface CrossCheckpoint extends CrossCheckpointState {
  checksum: number;
}

export function crossCheckpointState(state: CrossState): CrossCheckpointState {
  const course = crossCourse(state);
  return {
    tick: state.tick,
    crossings: state.crossings,
    lane: state.lane,
    col: state.col,
    hop: state.hop,
    hopDir: state.hopDir,
    reached: state.reached,
    crossStart: state.crossStart,
    pauseUntil: state.pauseUntil,
    laneSpeed: course.lanes[0]?.speed ?? 0,
    lives: state.lives,
    clean: state.clean,
    flags: (state.hitThisCrossing ? 1 : 0) | (state.ghost ? 2 : 0),
  };
}

/** 32-bit FNV-1a over the integer snapshot. */
export function crossCheckpoint(state: CrossState): CrossCheckpoint {
  const snapshot = crossCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  // crossRev 5 folds its flag in after the unchanged fields.
  if (state.tunef) {
    checksum ^= state.tunef | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  // crossRev 9 folds its fields in last, only when present.
  if (state.wide) {
    for (const value of [state.wide, state.coins ?? 0, state.coinTotal ?? 0, state.streak ?? 0, state.streakPts ?? 0, state.banked ?? 0]) {
      checksum ^= value | 0;
      checksum = Math.imul(checksum, 0x01000193) >>> 0;
    }
  }
  return { ...snapshot, checksum };
}

/* ================================ Drawing ============================== */

export const CROSS_BG = "#0B0B0F";
export const CROSS_PLAYER = "#F5B82E";
export const CROSS_ROAD = "#0F0F15";
export const CROSS_KERB = "#25252E";
export const CROSS_GOAL = "#2ED3B7";
export const CROSS_BLOCK = "#4F9CF9";
export const CROSS_BLOCK_COLOURS = [CROSS_BLOCK, "#F25C54", "#F5B82E", "#A56A43", "#2ED3B7", "#F080AB"] as const;

/** Top of a lane row on screen; lane 1 is the bottom lane. */
export function crossLaneTop(lane: number, g: CrossGeom = CROSS_GEOM): number {
  return CROSS_HUD_H + g.goalH + (g.rows - lane) * g.laneH;
}

/** The centre y of a lane, the start kerb (0) or the goal kerb (rows + 1). */
export function crossLaneCentre(lane: number, g: CrossGeom = CROSS_GEOM): number {
  if (lane <= 0) return crossStartTop(g) + g.startH / 2;
  if (lane > g.rows) return CROSS_HUD_H + g.goalH / 2;
  return crossLaneTop(lane, g) + g.laneH / 2;
}

/** Top of the start pavement (the bottom of the lowest lane). */
export function crossStartTop(g: CrossGeom = CROSS_GEOM): number {
  return CROSS_HUD_H + g.goalH + g.rows * g.laneH;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A car (or a lorry with a cab) filling exactly its collision box. Render only. */
function drawVehicle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: number, colour: string, lorry: boolean): void {
  const front = dir > 0 ? x + w : x;
  const back = dir > 0 ? x : x + w;
  ctx.fillStyle = colour;
  if (lorry) {
    const cab = Math.min(26, w * 0.28);
    const gap = 3;
    // Trailer, then cab at the front.
    roundRect(ctx, dir > 0 ? x : x + cab + gap, y, w - cab - gap, h, 4);
    ctx.fill();
    roundRect(ctx, dir > 0 ? x + w - cab : x, y + 2, cab, h - 4, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(11, 11, 15, 0.55)";
    ctx.fillRect(dir > 0 ? x + w - cab * 0.55 : x + cab * 0.2, y + 6, cab * 0.35, h - 12);
  } else {
    roundRect(ctx, x, y, w, h, Math.min(12, h / 2));
    ctx.fill();
    // Windscreen and rear window.
    ctx.fillStyle = "rgba(11, 11, 15, 0.5)";
    const ws = Math.min(14, w * 0.18);
    ctx.fillRect(dir > 0 ? x + w * 0.62 : x + w * 0.38 - ws, y + 5, ws, h - 10);
    ctx.fillRect(dir > 0 ? x + w * 0.18 : x + w * 0.82 - ws * 0.7, y + 6, ws * 0.7, h - 12);
  }
  // Headlights (white, at the front) and tail lights (red, at the back).
  ctx.fillStyle = "#FFFFFF";
  const hx = front - dir * 4;
  ctx.beginPath();
  ctx.arc(hx, y + 6, 2.6, 0, Math.PI * 2);
  ctx.arc(hx, y + h - 6, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.beginPath();
  ctx.moveTo(front, y + 2);
  ctx.lineTo(front + dir * 18, y - 2);
  ctx.lineTo(front + dir * 18, y + h + 2);
  ctx.lineTo(front, y + h - 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#FF3B3B";
  const tx = back + dir * 2;
  ctx.fillRect(tx - 1.5, y + 3, 3, 5);
  ctx.fillRect(tx - 1.5, y + h - 8, 3, 5);
}

function draw(ctx: CanvasRenderingContext2D, state: CrossState, size: CanvasSize): void {
  const scale = Math.min(size.width / CROSS_WORLD_W, size.height / CROSS_WORLD_H);
  const offsetX = (size.width - CROSS_WORLD_W * scale) / 2;
  const offsetY = (size.height - CROSS_WORLD_H * scale) / 2;
  const rel = state.tick - state.crossStart;
  const course = crossCourse(state);

  ctx.save();
  ctx.fillStyle = CROSS_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Safe lanes have asphalt, kerbs and dashed markings like the traffic road.
  const road = (top: number, height: number) => {
    ctx.fillStyle = CROSS_ROAD;
    ctx.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, height);
    ctx.fillStyle = "#6A7280";
    ctx.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, 2);
    ctx.fillRect(CROSS_BOARD_X, top + height - 2, CROSS_BOARD_W, 2);
    ctx.fillStyle = "#C9CED6";
    for (let x = CROSS_BOARD_X + 8; x < CROSS_BOARD_X + CROSS_BOARD_W; x += 40)
      ctx.fillRect(x, top + height / 2 - 1, Math.min(18, CROSS_BOARD_X + CROSS_BOARD_W - x), 2);
  };
  road(CROSS_HUD_H, CROSS_KERB_H);
  road(CROSS_LANES_Y + CROSS_LANES * CROSS_LANE_H, CROSS_KERB_H);

  for (let lane = 1; lane <= CROSS_LANES; lane++) {
    const top = crossLaneTop(lane);
    ctx.fillStyle = "#000000";
    ctx.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, CROSS_LANE_H);
    const laneDef = course.lanes[lane - 1];
    if (!laneDef) continue;
    const start = mod(laneDef.dir * laneDef.speed * rel + laneDef.phase, laneDef.period);
    const count = Math.ceil((CROSS_BOARD_W * 256) / laneDef.period) + 2;
    // Faster lanes (top third of this crossing's speeds) carry lorries.
    const speeds = course.lanes.map((l) => l.speed).sort((a, b) => a - b);
    const lorry = laneDef.speed >= (speeds[Math.floor((speeds.length * 2) / 3)] ?? Infinity);
    for (let index = -1; index <= count; index++) {
      const x = px(start + index * laneDef.period);
      const colour = CROSS_BLOCK_COLOURS[(lane + index + 8) % CROSS_BLOCK_COLOURS.length] ?? CROSS_BLOCK;
      drawVehicle(ctx, x, top + 7, px(laneDef.blockW), CROSS_LANE_H - 14, laneDef.dir, colour, lorry);
    }
  }

  // The board edges mask the traffic beyond the crossing.
  ctx.fillStyle = CROSS_BG;
  ctx.fillRect(0, CROSS_HUD_H, CROSS_BOARD_X, CROSS_WORLD_H - CROSS_HUD_H);
  ctx.fillRect(
    CROSS_BOARD_X + CROSS_BOARD_W,
    CROSS_HUD_H,
    CROSS_WORLD_W - CROSS_BOARD_X - CROSS_BOARD_W,
    CROSS_WORLD_H - CROSS_HUD_H,
  );

  const from = crossLaneCentre(state.lane);
  const to = crossLaneCentre(state.lane + state.hopDir);
  const done = state.hop > 0 ? (CROSS_HOP_TICKS - state.hop) / CROSS_HOP_TICKS : 0;
  const cy = state.hop > 0 ? from + (to - from) * done : from;
  ctx.fillStyle = CROSS_PLAYER;
  ctx.globalAlpha = state.ghost && Math.floor(state.tick / 6) % 2 === 0 ? 0.45 : 1;
  ctx.beginPath();
  ctx.arc(px(crossColumnCentreFp(state.col)), cy, CROSS_PLAYER_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Lives, top right.
  for (let i = 0; i < CROSS_LIVES; i++) {
    ctx.fillStyle = i < state.lives ? CROSS_PLAYER : "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(CROSS_WORLD_W - 22 - i * 18, 18, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Crossings ${state.crossings}`, 14, 10);
  ctx.textAlign = "right";

  // The breather between crossings, announced over the board.
  if (state.tick - state.hitTick < 20 && !state.dead) {
    ctx.fillStyle = `rgba(255, 77, 77, ${0.25 * (1 - (state.tick - state.hitTick) / 20)})`;
    ctx.fillRect(0, 0, CROSS_WORLD_W, CROSS_WORLD_H);
  }
  if (crossPaused(state) && state.tick - state.hitTick >= CROSS_PAUSE_TICKS) {
    ctx.fillStyle = "rgba(11, 11, 15, 0.55)";
    ctx.fillRect(CROSS_BOARD_X, CROSS_WORLD_H / 2 - 30, CROSS_BOARD_W, 60);
    ctx.fillStyle = CROSS_PLAYER;
    ctx.font = "700 24px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Crossing ${state.crossings + 1}`, CROSS_WORLD_W / 2, CROSS_WORLD_H / 2);
  }

  if (state.dead) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(0, 0, CROSS_WORLD_W, CROSS_WORLD_H);
  }

  ctx.restore();
}

export const crossGame: ArcadeGame<CrossState, ArcadeInputEvent | null> = {
  key: "cross",
  runTicks: CROSS_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: CROSS_INPUT_RANGES,
};

const crossRev2Game: ArcadeGame<CrossState, ArcadeInputEvent | null> = {
  ...crossGame,
  init: (seed: number) => ({ ...initFor(seed, (rng, index) => rollCourseV2(rng, index, CROSS_REV2), "2"), rev: CROSS_REV2 }),
};

const crossRev3Game: ArcadeGame<CrossState, ArcadeInputEvent | null> = {
  ...crossGame,
  init: (seed: number) => ({ ...initFor(seed, (rng, index) => rollCourseV2(rng, index, CROSS_REV), "3"), rev: CROSS_REV }),
};

/** Takes puzzle.crossRev (2 or 3); anything else is the original traffic. */
export function crossGameFor(rev?: number | null): ArcadeGame<CrossState, ArcadeInputEvent | null> {
  if (rev === CROSS_REV_EXPAND) return crossExpandGame;
  if (rev === CROSS_REV_STRICT) return crossStrictGame;
  if (rev === CROSS_REV_TARGET) return crossTargetGame;
  if (rev === CROSS_REV_SMALL) return crossSmallGame;
  if (rev === CROSS_REV_BAND) return crossBandGame;
  return rev === CROSS_REV ? crossRev3Game : rev === CROSS_REV2 ? crossRev2Game : crossGame;
}

/** Lanes of one kind crossed so far (render/effects only; a pure read of state). */
export function crossKindCrossed(state: Pick<CrossState, "courses" | "crossings" | "reached">, kind: number): number {
  let total = 0;
  const count = (course: CrossCourse | undefined, upTo: number) => {
    for (let lane = 1; lane <= upTo; lane++) if (course?.lanes[lane - 1]?.kind === kind) total += 1;
  };
  for (let index = 0; index < state.crossings; index++) {
    const course = state.courses[Math.min(index, CROSS_COURSES - 1)];
    count(course, course?.lanes.length ?? CROSS_LANES);
  }
  const now = state.courses[Math.min(state.crossings, CROSS_COURSES - 1)];
  count(now, clampInt(state.reached, 0, now?.lanes.length ?? CROSS_LANES));
  return total;
}

/* ================= Oct 2026 score bands (crossRev 4) ================= */

/** Score-band revision (puzzle.crossRev = 4): rev-3 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const CROSS_REV_BAND = 4;
/** Each lane crossed counts 1 and each full crossing 2 more; 150 at 77 (seven crossings). */
export const CROSS_BAND_CURVE = bandCurve([0, 41, 50, 59, 66, 77], [0, 70, 100, 125, 145, 150]);

export function crossBandParts(state: CrossState): BandParts {
  if (state.wide) return crossExpandParts(state);
  const lanes = crossTotalLanes(state);
  const units = lanes + 2 * state.crossings;
  return { units, points: bandPoints(bandCurveOf(state, CROSS_BAND_CURVE), units), bonus: 0, penalty: 0, finished: false, text: `${lanes} lanes · ${state.crossings} crossings` };
}

function scoreBand(state: CrossState): number {
  // crossRev 9 scores to the game's maximum (200, roundMax.ts); every earlier revision to 150.
  return bandTotal(crossBandParts(state), Boolean(state.acted), state.wide ? roundMaxFor("cross") : undefined);
}

export const crossBandGame: ArcadeGame<CrossState, ArcadeInputEvent | null> = { ...crossRev3Game, init: (seed) => bandInit(crossRev3Game.init(seed)) };

/* ============ Tuning F (crossRev 5): a smaller walker ============ */

/**
 * crossRev 5 (Tuning F, Oct 2026): crossRev 4's courses, traffic, inputs and
 * band curve, with the walker's hit box narrowed from 16 px to 13 px either side
 * of its column centre (the stick figure's arms reach about 13.75 px, so the
 * drawn walker is what collides). Courses are still proved with the 16 px disc,
 * so every proved gap stays open at least as long. States add `tunef: 1`.
 */
export const CROSS_REV_SMALL = 5;
export const CROSS_PLAYER_R_V5 = 13;
export const CROSS_PLAYER_HALF_V5_FP = CROSS_PLAYER_R_V5 * 256;

/** The walker's hit-box half-width for this run, in 1/256 px. */
export function crossPlayerHalfFp(state: Pick<CrossState, "tunef">): number {
  return state.tunef ? CROSS_PLAYER_HALF_V5_FP : CROSS_PLAYER_HALF_FP;
}

/** The walker's hit-box half-width for this run, in world px (art and hit flash). */
export function crossPlayerR(state: Pick<CrossState, "tunef">): number {
  return state.tunef ? CROSS_PLAYER_R_V5 : CROSS_PLAYER_R;
}

export const crossSmallGame: ArcadeGame<CrossState, ArcadeInputEvent | null> = { ...crossBandGame, init: (seed) => ({ ...crossBandGame.init(seed), tunef: 1 }) };

/* ================= Scoring targets (crossRev 6, 18 Oct 2026) ================= */

/**
 * crossRev 6 (scoring targets, docs/scoring-targets.md): crossRev 5 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const CROSS_REV_TARGET = 6;
export const crossTargetGame = bandTargetGame(crossSmallGame);
/** The curve new rounds score on: CROSS_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const CROSS_V6_BAND_CURVE = bandRetarget(CROSS_BAND_CURVE);


/* ================= Score bands (crossRev 7, 19 Oct 2026) ================= */

/**
 * crossRev 7 (score bands, docs/scoring-targets.md): crossRev 6 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const CROSS_REV_STRICT = 7;
export const crossStrictGame = bandStrictGame(crossTargetGame);
/** The curve new rounds score on: CROSS_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const CROSS_V7_BAND_CURVE = bandStrict(CROSS_BAND_CURVE);


/* ================= The expansion (crossRev 9, x200, 26 Oct 2026) ================= */

/**
 * crossRev 9's play curve: units are rows crossed (14 a crossing, the island one of them) plus 2
 * per crossing, so a full crossing counts 16. Fitted with the skill pay (scripts/cross-x200-bands.ts, 60 tuning
 * seeds, checked on 200 fresh ones) so good play scores about what it did on crossRev 7 and
 * near-perfect and elite play reach the 200 scale's top bands (docs/expansions/x200-cross.md).
 */
export const CROSS_V9_BAND_CURVE = bandCurve([0, 40, 50, 58, 66, 74, 82], [0, 55, 75, 92, 125, 147, 150]);

/** crossRev 9's raw skill points: CROSS_X_COIN_POINTS a coin plus the streak pool. */
export function crossSkillRaw(state: Pick<CrossState, "coinTotal" | "streakPts">): number {
  return (state.coinTotal ?? 0) * CROSS_X_COIN_POINTS + (state.streakPts ?? 0);
}

/**
 * crossRev 9's skill pay (x200, 26 Oct 2026): the raw skill points paid on a rising scale up to
 * CROSS_X_BONUS_MAX, so a few coins and a short streak pay little and the full 50 needs (nearly)
 * every coin of the run and a long streak.
 */
export const CROSS_V9_SKILL_PAY = bandCurve([0, 15, 30, 45, 60, 66], [0, 3, 40, 43, 47, CROSS_X_BONUS_MAX]);

/** crossRev 9's bonus: the skill points paid on CROSS_V9_SKILL_PAY, at most CROSS_X_BONUS_MAX. */
export function crossBonusOf(state: Pick<CrossState, "coinTotal" | "streakPts">): number {
  return Math.min(CROSS_X_BONUS_MAX, bandPoints(CROSS_V9_SKILL_PAY, crossSkillRaw(state)));
}

/** The streak multiplier the crossing under way pays if finished without a hit (render and HUD). */
export function crossNextMultiplier(state: Pick<CrossState, "streak" | "hitThisCrossing">): number {
  return state.hitThisCrossing ? 1 : crossMultiplierFor((state.streak ?? 0) + 1);
}

function crossExpandParts(state: CrossState): BandParts {
  const lanes = crossTotalLanes(state);
  const units = lanes + 2 * state.crossings;
  const coins = state.coinTotal ?? 0;
  return {
    units,
    points: bandPoints(CROSS_V9_BAND_CURVE, units),
    bonus: crossBonusOf(state),
    penalty: 0,
    finished: false,
    text: `${lanes} rows · ${state.crossings} crossings`,
    bonusText: `${coins} coin${coins === 1 ? "" : "s"} · streak ${state.streakPts ?? 0}`,
  };
}

export const crossExpandGame: ArcadeGame<CrossState, ArcadeInputEvent | null> = {
  ...crossStrictGame,
  init: (seed: number) => ({
    ...initFor(seed, rollCourseV9, "9"),
    rev: CROSS_REV_EXPAND,
    band: BAND_STRICT_MARK,
    acted: 0,
    tunef: 1,
    wide: 1,
    coins: 0,
    coinTotal: 0,
    streak: 0,
    streakPts: 0,
    banked: 0,
  }),
};
