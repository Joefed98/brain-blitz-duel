import { sceneryTexture } from "./sceneryTexture.renderer";
/**
 * Clay Shoot — a speed round on the shared arcade engine.
 *
 * Twenty-five clays fly seeded trajectories across a side-on sky. Twenty-two
 * are orange and three harder clays are gold. The schedule is drawn
 * entirely from the seed at init. A tap is a shot (kind 11, `a` = x px,
 * `b` = y px in world pixels) judged against the clays' positions on the tick
 * it was recorded. Physics is integer 1/256-pixel units; no floats in the sim.
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
import { icos, isin } from "./trig";

/* ============================== Config ============================== */

export const CLAY_CONFIG = {
  runSeconds: 60,
  /** World size in pixels; the canvas letterboxes it. */
  worldW: 360,
  worldH: 400,
  clays: 25,
  orangeClays: 22,
  goldClays: 3,
  /** Clays 1–11 fly alone; the final fourteen launch as seven pairs. */
  singles: 11,
  firstLaunchTick: 75,
  singleGapTicks: 180,
  singleJitterTicks: 24,
  firstPairTick: 2020,
  pairGapTicks: 230,
  pairJitterTicks: 24,
  /** Second clay of a pair leaves 24–43 ticks after the first. */
  pairOffsetMin: 24,
  pairOffsetSpan: 20,
  /**
   * Launch heights, px from the top. Nothing launches from the top quarter.
   * 15 clays leave from the lower half; 10 (all gold included) from the
   * middle band, a quarter down to a quarter up.
   */
  lowerYMin: 200,
  lowerYSpan: 171,
  middleYMin: 100,
  middleYSpan: 201,
  middleClays: 10,
  /** Launch x just off each edge, px. */
  launchInset: 12,
  /** Orange speed in 1/256 px per tick. */
  orangeSpeedMin: 1650,
  orangeSpeedSpan: 451,
  /** Orange launch angle above horizontal, 65536 units per turn (20°–58°). */
  orangeAngleMin: 3641,
  orangeAngleSpan: 6918,
  /** Gold speed and two hard trajectory bands: near-horizontal or steep. */
  goldSpeedMin: 2200,
  goldSpeedSpan: 401,
  goldFlatAngleMin: 1456,
  goldFlatAngleSpan: 1821,
  goldSteepAngleMin: 9102,
  goldSteepAngleSpan: 1457,
  /** Every path covers ⅔ of the width (px) and stays ≥ 0.6 s on screen. */
  minCoverage: 240,
  minOnScreenTicks: 36,
  rerollTries: 64,
  scanAngleMin: 1024,
  scanAngleCount: 40,
  rerollAngleStep: 256,
  rerollSpeedStep: 32,
  rerollSpeedFloor: 900,
  /** Gravity, 1/256 px per tick². */
  gravity: 20,
  /** Shot radii and drawn clay radius, px. */
  orangeHitRadius: 30,
  goldHitRadius: 24,
  clayRadius: 13,
  /** A clay this far past an edge (px) has left the arena. */
  exitMargin: 20,
  orangePoints: 5,
  goldPoints: 10,
  perfectBonus: 10,
  birdPenalty: 10,
} as const;

/** Bird-hazard revisions. Stored rounds without clayRev retain the clay-only sim and score. */
export const CLAY_REV2 = 2;
export const CLAY_REV3 = 3;
/**
 * rev 4 (13 Oct 2026): rev 3's clays and birds, plus a cost for shots that hit
 * nothing (no clay, no bird): the first CLAY_FREE_EMPTY_SHOTS are free, then 1
 * point for every CLAY_EMPTY_SHOTS_PER_POINT more. Honest runs miss well under
 * the allowance; mashing (300+ empty shots) loses about 15.
 */
export const CLAY_REV4 = 4;
/**
 * rev 5 (14 Oct 2026, Speed tuning): rev 4's clays, scoring and empty-shot cost
 * with more birds, 14–16 instead of 10–12 (CLAY_BIRD_MIN_V5 / MAX_V5), on the same
 * cadence rules (the gap shrinks so every bird still crosses before the end).
 */
export const CLAY_REV5 = 5;
export const CLAY_REV = CLAY_REV5;
export const CLAY_BIRD_MIN_V5 = 14;
export const CLAY_BIRD_MAX_V5 = 16;
export const CLAY_FREE_EMPTY_SHOTS = 30;
export const CLAY_EMPTY_SHOTS_PER_POINT = 20;
/** rev2 legacy cadence: 3-4 birds, replays unchanged. */
export const CLAY_BIRD_MIN = 3;
export const CLAY_BIRD_MAX = 4;
export const CLAY_BIRD_RX = 15;
export const CLAY_BIRD_RY = 9;
export const CLAY_BIRD_STARTLED_TICKS = 36;
/** rev3 cadence: 10-12 birds, roughly one every 5-6s, occasional overlaps. */
export const CLAY_BIRD_MIN_V3 = 10;
export const CLAY_BIRD_MAX_V3 = 12;
export const CLAY_BIRD_FIRST_MIN = 60;
export const CLAY_BIRD_FIRST_SPAN = 141;
export const CLAY_BIRD_GAP_TICKS = 300;
export const CLAY_BIRD_GAP_JITTER = 61;
export const CLAY_BIRD_SPEED_MIN = 760;
export const CLAY_BIRD_SPEED_SPAN = 321;
/** One in three games gets at least one moment with two birds up; never more than two such moments. */
export const CLAY_BIRD_OVERLAP_GAME_CHANCE = 3;
export const CLAY_BIRD_OVERLAP_MAX = 2;
export const CLAY_BIRD_OVERLAP_OFFSET_MIN = 24;
export const CLAY_BIRD_OVERLAP_OFFSET_SPAN = 60;
/** Fraction-of-20 chance a bird uses a higher/lower variety band instead of a clay height. */
export const CLAY_BIRD_VARIETY_ROLL = 5;

export function clayHasBirds(rev?: number | null): boolean {
  return rev === CLAY_REV2 || rev === CLAY_REV3 || rev === CLAY_REV4 || rev === CLAY_REV5;
}

/** rev 4 and later: shots that hit nothing cost points beyond the free allowance. */
export function clayChargesEmptyShots(rev?: number | null): boolean {
  return rev === CLAY_REV4 || rev === CLAY_REV5;
}

/** rev 4: shots that hit nothing (no clay, no bird). Every shot hits one clay, one bird or nothing. */
export function clayEmptyShots(shots: number, hits: number, birdHits: number): number {
  return Math.max(0, shots - hits - birdHits);
}

/** rev 4: the points lost to empty shots beyond the free allowance (0 before rev 4). */
export function clayEmptyShotCost(emptyShots: number, rev?: number | null): number {
  if (!clayChargesEmptyShots(rev)) return 0;
  return Math.floor(Math.max(0, emptyShots - CLAY_FREE_EMPTY_SHOTS) / CLAY_EMPTY_SHOTS_PER_POINT);
}

export const CLAY_RUN_TICKS = CLAY_CONFIG.runSeconds * TICKS_PER_SECOND;
export const CLAY_W = CLAY_CONFIG.worldW;
export const CLAY_H = CLAY_CONFIG.worldH;
export const CLAY_COUNT = CLAY_CONFIG.clays;

/** A shot: kind 11, a = x px, b = y px. */
export const CLAY_INPUT_SHOT = 11;
export const CLAY_INPUT_RANGES: readonly InputRange[] = [
  inputRange(CLAY_INPUT_SHOT, [0, CLAY_W], [0, CLAY_H]),
];

export const CLAY_WAITING = 0;
export const CLAY_FLYING = 1;
export const CLAY_HIT = 2;
export const CLAY_MISSED = 3;
export const CLAY_BIRD_WAITING = 0;
export const CLAY_BIRD_FLYING = 1;
export const CLAY_BIRD_STARTLED = 2;
export const CLAY_BIRD_GONE = 3;

/** Log codes. */
export const CLAY_LOG_HIT = 1;
export const CLAY_LOG_MISS_SHOT = 2;
export const CLAY_LOG_ESCAPED = 3;
export const CLAY_LOG_BIRD = 4;
export const CLAY_KIND_ORANGE = 0;
export const CLAY_KIND_GOLD = 1;
const LOG_KEEP = 16;

/* ============================== Schedule ============================== */

export interface ClaySchedule {
  launch: number[];
  /** 0 = from the left, 1 = from the right. */
  side: number[];
  kind: number[];
  launchY: number[];
  vx: number[];
  vy: number[];
}

export interface ClayBirdSchedule {
  launch: number[];
  /** 0 = from the left, 1 = from the right. */
  side: number[];
  launchY: number[];
  vx: number[];
  vy: number[];
}

/**
 * Simulates one clay exactly as `step` moves it and measures the on-screen
 * stretch: from entering the visible arena until it first leaves any edge.
 */
export function clayFlight(side: number, launchY: number, vx: number, vy0: number): { coverage: number; ticks: number } {
  const c = CLAY_CONFIG;
  let x = (side === 0 ? -c.launchInset : c.worldW + c.launchInset) * 256;
  let y = launchY * 256;
  let vy = vy0;
  let entered = false;
  let startX = 0;
  let ticks = 0;
  const W = c.worldW * 256;
  const H = c.worldH * 256;
  for (let t = 0; t < 1200; t++) {
    x += vx;
    vy += c.gravity;
    y += vy;
    const visible = x >= 0 && x <= W && y >= 0 && y <= H;
    if (visible) {
      if (!entered) { entered = true; startX = side === 0 ? 0 : W; }
      ticks += 1;
    } else if (entered) {
      return { coverage: Math.abs(Math.max(0, Math.min(W, x)) - startX) >> 8, ticks };
    } else if (t > 30) {
      return { coverage: 0, ticks: 0 };
    }
  }
  return { coverage: Math.abs(Math.max(0, Math.min(W, x)) - startX) >> 8, ticks };
}

function buildSchedule(seed: number): { rng: number; schedule: ClaySchedule } {
  const c = CLAY_CONFIG;
  let rng = seed | 0;
  const draw = (bound: number): number => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const launch: number[] = [];
  const side: number[] = [];
  const sideStart = draw(2);
  for (let i = 0; i < c.singles; i++) {
    launch.push(c.firstLaunchTick + i * c.singleGapTicks + draw(c.singleJitterTicks));
    side.push((sideStart + i) & 1);
  }
  for (let p = 0; launch.length < c.clays; p++) {
    const t = c.firstPairTick + p * c.pairGapTicks + draw(c.pairJitterTicks);
    const s = draw(2);
    launch.push(t);
    side.push(s);
    if (launch.length < c.clays) {
      launch.push(t + c.pairOffsetMin + draw(c.pairOffsetSpan));
      side.push(1 - s);
    }
  }
  const kind = new Array<number>(c.clays).fill(CLAY_KIND_ORANGE);
  const goldBands: readonly [number, number][] = [[4, 8], [12, 17], [19, 24]];
  for (const [lo, hi] of goldBands) kind[lo + draw(hi - lo + 1)] = CLAY_KIND_GOLD;
  const middle = new Array<boolean>(c.clays).fill(false);
  const orange: number[] = [];
  for (let i = 0; i < c.clays; i++) {
    if (kind[i] === CLAY_KIND_GOLD) middle[i] = true;
    else orange.push(i);
  }
  for (let n = c.goldClays; n < c.middleClays; n++) {
    const pick = orange.splice(draw(orange.length), 1)[0]!;
    middle[pick] = true;
  }
  const launchY: number[] = [];
  const vx: number[] = [];
  const vy: number[] = [];
  for (let i = 0; i < c.clays; i++) {
    const gold = kind[i] === CLAY_KIND_GOLD;
    const hardFlat = gold && draw(2) === 0;
    const y0 = middle[i] ? c.middleYMin + draw(c.middleYSpan) : c.lowerYMin + draw(c.lowerYSpan);
    launchY.push(y0);
    // Seeded reroll until the path covers ⅔ of the width and stays ≥ 0.6 s on screen;
    // after rerollTries the angle is lowered step by step so it always terminates.
    const fits = (speed: number, angle: number): [number, number] | null => {
      const h = (speed * icos(angle)) >> 14;
      const hx = side[i] === 0 ? h : -h;
      const hy = -((speed * isin(angle)) >> 14);
      const f = clayFlight(side[i]!, y0, hx, hy);
      return f.coverage >= c.minCoverage && f.ticks >= c.minOnScreenTicks ? [hx, hy] : null;
    };
    let found: [number, number] | null = null;
    for (let tries = 0; tries < c.rerollTries && !found; tries++) {
      const speed = gold
        ? c.goldSpeedMin + draw(c.goldSpeedSpan)
        : c.orangeSpeedMin + draw(c.orangeSpeedSpan);
      const angle = hardFlat
        ? c.goldFlatAngleMin + draw(c.goldFlatAngleSpan)
        : gold
          ? c.goldSteepAngleMin + draw(c.goldSteepAngleSpan)
          : c.orangeAngleMin + draw(c.orangeAngleSpan);
      found = fits(speed, angle);
    }
    // Fallback: deterministic scan, fastest speed first, angles from a seeded offset.
    const top = gold ? c.goldSpeedMin + c.goldSpeedSpan : c.orangeSpeedMin + c.orangeSpeedSpan;
    const offset = draw(c.scanAngleCount);
    for (let speed = top; speed >= c.rerollSpeedFloor && !found; speed -= c.rerollSpeedStep) {
      for (let k = 0; k < c.scanAngleCount && !found; k++) {
        found = fits(speed, c.scanAngleMin + ((offset + k) % c.scanAngleCount) * c.rerollAngleStep);
      }
    }
    const [hx, hy] = found ?? fits(c.rerollSpeedFloor, 8192) ?? [side[i] === 0 ? 900 : -900, -900];
    vx.push(hx);
    vy.push(hy);
  }
  return { rng, schedule: { launch, side, kind, launchY, vx, vy } };
}

function buildBirdSchedule(rngStart: number): { rng: number; schedule: ClayBirdSchedule } {
  let rng = rngStart | 0;
  const draw = (bound: number) => {
    const out = rngBelow(rng, bound);
    rng = out.state;
    return out.value;
  };
  const count = CLAY_BIRD_MIN + draw(CLAY_BIRD_MAX - CLAY_BIRD_MIN + 1);
  const launch: number[] = [];
  const side: number[] = [];
  const launchY: number[] = [];
  const vx: number[] = [];
  const vy: number[] = [];
  const firstSide = draw(2);
  for (let i = 0; i < count; i++) {
    // Broad, non-overlapping windows spread the birds through the full minute.
    launch.push(360 + i * 840 + draw(301));
    const from = (firstSide + i + draw(2)) & 1;
    side.push(from);
    launchY.push(62 + draw(231));
    const speed = 760 + draw(321);
    vx.push(from === 0 ? speed : -speed);
    vy.push(draw(121) - 60);
  }
  return { rng, schedule: { launch, side, launchY, vx, vy } };
}

function buildBirdScheduleV3(rngStart: number, minBirds = CLAY_BIRD_MIN_V3, maxBirds = CLAY_BIRD_MAX_V3): { rng: number; schedule: ClayBirdSchedule } {
  const c = CLAY_CONFIG;
  let rng = rngStart | 0;
  const draw = (bound: number) => {
    const out = rngBelow(rng, bound);
    rng = out.state;
    return out.value;
  };
  const count = minBirds + draw(maxBirds - minBirds + 1);
  const launch: number[] = [];
  const side: number[] = [];
  const launchY: number[] = [];
  const vx: number[] = [];
  const vy: number[] = [];
  const firstSide = draw(2);
  let t = CLAY_BIRD_FIRST_MIN + draw(CLAY_BIRD_FIRST_SPAN);
  // Every bird must fully cross and exit before the round ends; cap the gap so
  // the last launch leaves room for its full flight (worst case ~230 ticks).
  const runMargin = 240;
  const maxLast = CLAY_RUN_TICKS - runMargin;
  const avgGap = count > 1 ? Math.floor((maxLast - t) / (count - 1)) : 0;
  const gap = Math.max(1, Math.min(CLAY_BIRD_GAP_TICKS, avgGap));
  const jitterCap = Math.max(0, Math.min(CLAY_BIRD_GAP_JITTER, avgGap - gap));
  for (let i = 0; i < count; i++) {
    launch.push(t);
    t += gap + (jitterCap > 0 ? draw(jitterCap + 1) : 0);
    const from = (firstSide + i + draw(2)) & 1;
    side.push(from);
    // Mostly clay heights (lower or middle band), with some higher/lower variety.
    if (draw(CLAY_BIRD_VARIETY_ROLL) === 0) {
      launchY.push(draw(2) === 0 ? 40 + draw(40) : 330 + draw(50));
    } else {
      launchY.push(draw(2) === 0 ? c.middleYMin + draw(c.middleYSpan) : c.lowerYMin + draw(c.lowerYSpan));
    }
    const speed = CLAY_BIRD_SPEED_MIN + draw(CLAY_BIRD_SPEED_SPAN);
    vx.push(from === 0 ? speed : -speed);
    vy.push(draw(121) - 60);
  }
  // Occasionally two birds overlap on screen: ~1/3 of games, at most twice.
  if (count > 2 && draw(CLAY_BIRD_OVERLAP_GAME_CHANCE) === 0) {
    const overlaps = 1 + draw(CLAY_BIRD_OVERLAP_MAX);
    const used = new Set<number>();
    for (let n = 0; n < overlaps; n++) {
      const i = draw(count - 1);
      // Never pull in a pair adjacent to an already-chosen pair: chaining
      // (e.g. pulling i,i+1 and then i+1,i+2) could put 3 birds up at once.
      if (used.has(i - 1) || used.has(i) || used.has(i + 1)) continue;
      used.add(i);
      const offset = CLAY_BIRD_OVERLAP_OFFSET_MIN + draw(CLAY_BIRD_OVERLAP_OFFSET_SPAN);
      launch[i + 1] = Math.min(launch[i + 1]!, launch[i]! + offset);
    }
    // Keep launches non-decreasing after any pull-ins.
    for (let i = 1; i < launch.length; i++) {
      if (launch[i]! < launch[i - 1]!) launch[i] = launch[i - 1]!;
    }
  }
  return { rng, schedule: { launch, side, launchY, vx, vy } };
}

/* ================================ State ================================ */

export interface ClayState {
  tick: number;
  rng: number;
  schedule: ClaySchedule;
  x: number[];
  y: number[];
  vy: number[];
  status: number[];
  doneTick: number[];
  /** Next clay in the launch queue. */
  next: number;
  hits: number;
  orangeHits: number;
  goldHits: number;
  missed: number;
  shots: number;
  shotX: number;
  shotY: number;
  shotTick: number;
  shotHit: number;
  /** Recent events, packed tick·256 + code·32 + clay. */
  log: number[];
  /** Present only in clayRev 2 states; absent keeps legacy state/replays unchanged. */
  rev?: number;
  birds?: ClayBirdSchedule;
  birdX?: number[];
  birdY?: number[];
  birdStatus?: number[];
  birdDoneTick?: number[];
  birdNext?: number;
  birdHits?: number;
}

function init(seed: number): ClayState {
  const built = buildSchedule(seed);
  const n = CLAY_CONFIG.clays;
  return {
    tick: 0,
    rng: built.rng,
    schedule: built.schedule,
    x: new Array(n).fill(0),
    y: new Array(n).fill(0),
    vy: new Array(n).fill(0),
    status: new Array(n).fill(CLAY_WAITING),
    doneTick: new Array(n).fill(0),
    next: 0,
    hits: 0,
    orangeHits: 0,
    goldHits: 0,
    missed: 0,
    shots: 0,
    shotX: 0,
    shotY: 0,
    shotTick: -100,
    shotHit: 0,
    log: [],
  };
}

function initRev2(seed: number): ClayState {
  const base = init(seed);
  const built = buildBirdSchedule(base.rng);
  const count = built.schedule.launch.length;
  return {
    ...base,
    rng: built.rng,
    rev: CLAY_REV2,
    birds: built.schedule,
    birdX: new Array(count).fill(0),
    birdY: new Array(count).fill(0),
    birdStatus: new Array(count).fill(CLAY_BIRD_WAITING),
    birdDoneTick: new Array(count).fill(0),
    birdNext: 0,
    birdHits: 0,
  };
}

function initRev3(seed: number, rev: number = CLAY_REV3): ClayState {
  const base = init(seed);
  const built = rev === CLAY_REV5 ? buildBirdScheduleV3(base.rng, CLAY_BIRD_MIN_V5, CLAY_BIRD_MAX_V5) : buildBirdScheduleV3(base.rng);
  const count = built.schedule.launch.length;
  return {
    ...base,
    rng: built.rng,
    rev,
    birds: built.schedule,
    birdX: new Array(count).fill(0),
    birdY: new Array(count).fill(0),
    birdStatus: new Array(count).fill(CLAY_BIRD_WAITING),
    birdDoneTick: new Array(count).fill(0),
    birdNext: 0,
    birdHits: 0,
  };
}

function isOver(state: ClayState): boolean {
  return state.tick >= CLAY_RUN_TICKS;
}

function pushLog(log: number[], tick: number, code: number, clay: number): number[] {
  const out = [...log, tick * 256 + code * 32 + clay];
  return out.length > LOG_KEEP ? out.slice(out.length - LOG_KEEP) : out;
}

export function unpackClayLog(entry: number): { tick: number; code: number; clay: number } {
  return { tick: Math.floor(entry / 256), code: Math.floor(entry / 32) % 8, clay: entry % 32 };
}

function step(state: ClayState, input: ArcadeInputEvent | null): ClayState {
  if (isOver(state)) return state;
  const c = CLAY_CONFIG;
  const tick = state.tick + 1;
  const x = [...state.x];
  const y = [...state.y];
  const vy = [...state.vy];
  const status = [...state.status];
  const doneTick = [...state.doneTick];
  const birdX = state.birdX ? [...state.birdX] : undefined;
  const birdY = state.birdY ? [...state.birdY] : undefined;
  const birdStatus = state.birdStatus ? [...state.birdStatus] : undefined;
  const birdDoneTick = state.birdDoneTick ? [...state.birdDoneTick] : undefined;
  const next: ClayState = {
    ...state,
    tick,
    x,
    y,
    vy,
    status,
    doneTick,
    ...(birdX && birdY && birdStatus && birdDoneTick ? { birdX, birdY, birdStatus, birdDoneTick } : {}),
  };
  const { launch, side, vx } = state.schedule;

  while (next.next < c.clays && launch[next.next]! <= tick) {
    const i = next.next;
    status[i] = CLAY_FLYING;
    x[i] = (side[i] === 0 ? -c.launchInset : c.worldW + c.launchInset) * 256;
    y[i] = state.schedule.launchY[i]! * 256;
    vy[i] = state.schedule.vy[i]!;
    next.next = i + 1;
  }

  for (let i = 0; i < c.clays; i++) {
    if (status[i] !== CLAY_FLYING) continue;
    x[i] = x[i]! + vx[i]!;
    vy[i] = vy[i]! + c.gravity;
    y[i] = y[i]! + vy[i]!;
  }

  const birds = state.birds;
  if (birds && birdX && birdY && birdStatus && birdDoneTick) {
    let birdNext = state.birdNext ?? 0;
    while (birdNext < birds.launch.length && birds.launch[birdNext]! <= tick) {
      birdStatus[birdNext] = CLAY_BIRD_FLYING;
      birdX[birdNext] = (birds.side[birdNext] === 0 ? -CLAY_BIRD_RX : c.worldW + CLAY_BIRD_RX) * 256;
      birdY[birdNext] = birds.launchY[birdNext]! * 256;
      birdNext += 1;
    }
    next.birdNext = birdNext;
    for (let i = 0; i < birds.launch.length; i++) {
      if (birdStatus[i] === CLAY_BIRD_FLYING) {
        birdX[i] = birdX[i]! + birds.vx[i]!;
        birdY[i] = birdY[i]! + birds.vy[i]!;
      } else if (birdStatus[i] === CLAY_BIRD_STARTLED) {
        birdX[i] = birdX[i]! + Math.trunc((birds.vx[i]! * 3) / 2);
        birdY[i] = birdY[i]! - 1150;
        if (tick - birdDoneTick[i]! >= CLAY_BIRD_STARTLED_TICKS) birdStatus[i] = CLAY_BIRD_GONE;
      }
    }
  }

  if (input && input.k === CLAY_INPUT_SHOT) {
    const sx = clampInt(input.a, 0, c.worldW) * 256;
    const sy = clampInt(input.b, 0, c.worldH) * 256;
    next.shots += 1;
    next.shotX = sx;
    next.shotY = sy;
    next.shotTick = tick;
    let best = -1;
    let bestD = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < c.clays; i++) {
      if (status[i] !== CLAY_FLYING) continue;
      const radius = (state.schedule.kind[i] === CLAY_KIND_GOLD ? c.goldHitRadius : c.orangeHitRadius) * 256;
      const dx = x[i]! - sx;
      const dy = y[i]! - sy;
      const d = dx * dx + dy * dy;
      if (d <= radius * radius && d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      status[best] = CLAY_HIT;
      doneTick[best] = tick;
      next.hits += 1;
      if (state.schedule.kind[best] === CLAY_KIND_GOLD) next.goldHits += 1;
      else next.orangeHits += 1;
      next.shotHit = 1;
      next.log = pushLog(next.log, tick, CLAY_LOG_HIT, best);
    } else {
      next.shotHit = 0;
      next.log = pushLog(next.log, tick, CLAY_LOG_MISS_SHOT, 0);
    }
    if (best < 0 && birds && birdX && birdY && birdStatus && birdDoneTick) {
      let birdBest = -1;
      let birdBestD = Number.MAX_SAFE_INTEGER;
      const rx = CLAY_BIRD_RX * 256;
      const ry = CLAY_BIRD_RY * 256;
      for (let i = 0; i < birds.launch.length; i++) {
        if (birdStatus[i] !== CLAY_BIRD_FLYING) continue;
        const dx = birdX[i]! - sx;
        const dy = birdY[i]! - sy;
        const d = dx * dx * ry * ry + dy * dy * rx * rx;
        if (d <= rx * rx * ry * ry && d < birdBestD) {
          birdBest = i;
          birdBestD = d;
        }
      }
      if (birdBest >= 0) {
        birdStatus[birdBest] = CLAY_BIRD_STARTLED;
        birdDoneTick[birdBest] = tick;
        next.birdHits = (state.birdHits ?? 0) + 1;
        next.log = pushLog(next.log, tick, CLAY_LOG_BIRD, birdBest);
      }
    }
  }

  const m = c.exitMargin * 256;
  for (let i = 0; i < c.clays; i++) {
    if (status[i] !== CLAY_FLYING) continue;
    const gone =
      (vx[i]! > 0 && x[i]! > c.worldW * 256 + m) ||
      (vx[i]! < 0 && x[i]! < -m) ||
      y[i]! > c.worldH * 256 + m;
    if (gone) {
      status[i] = CLAY_MISSED;
      doneTick[i] = tick;
      next.missed += 1;
      next.log = pushLog(next.log, tick, CLAY_LOG_ESCAPED, i);
    }
  }
  if (birds && birdX && birdY && birdStatus) {
    const margin = (CLAY_BIRD_RX + 4) * 256;
    for (let i = 0; i < birds.launch.length; i++) {
      if (birdStatus[i] !== CLAY_BIRD_FLYING) continue;
      if (birdX[i]! < -margin || birdX[i]! > c.worldW * 256 + margin || birdY[i]! < -margin || birdY[i]! > c.worldH * 256 + margin) {
        birdStatus[i] = CLAY_BIRD_GONE;
      }
    }
  }
  return next;
}

export function clayScore(orangeHits: number, goldHits: number, birdHits = 0, rev?: number, emptyShots = 0): number {
  const hasBirds = clayHasBirds(rev);
  const all = orangeHits === CLAY_CONFIG.orangeClays && goldHits === CLAY_CONFIG.goldClays && (!hasBirds || birdHits === 0);
  return clampInt(
    orangeHits * CLAY_CONFIG.orangePoints +
      goldHits * CLAY_CONFIG.goldPoints +
      (all ? CLAY_CONFIG.perfectBonus : 0) -
      (hasBirds ? birdHits * CLAY_CONFIG.birdPenalty : 0) -
      clayEmptyShotCost(emptyShots, rev),
    0,
    150,
  );
}

function score(state: ClayState): number {
  const birdHits = state.birdHits ?? 0;
  return clayScore(state.orangeHits, state.goldHits, birdHits, state.rev, clayEmptyShots(state.shots, state.hits, birdHits));
}

/* ============================= Checkpoints ============================= */

export const CLAY_CHECKPOINT_INTERVAL = 300;

export interface ClayCheckpointState {
  tick: number;
  hits: number;
  orangeHits: number;
  goldHits: number;
  missed: number;
  shots: number;
  next: number;
  posHash: number;
  birdHits?: number;
  birdPosHash?: number;
}

export interface ClayCheckpoint extends ClayCheckpointState {
  checksum: number;
}

export const CLAY_CHECKPOINT_FIELDS = ["tick", "hits", "orangeHits", "goldHits", "missed", "shots", "next", "posHash"] as const;
export const CLAY_CHECKPOINT_FIELDS_V2 = [...CLAY_CHECKPOINT_FIELDS, "birdHits", "birdPosHash"] as const;

export function clayCheckpoint(state: ClayState): ClayCheckpoint {
  let posHash = 0;
  for (let i = 0; i < state.status.length; i++) {
    posHash =
      (Math.imul(posHash, 31) + state.status[i]! * 7 + state.x[i]! + Math.imul(state.y[i]!, 3)) | 0;
  }
  const snapshot: ClayCheckpointState = {
    tick: state.tick,
    hits: state.hits,
    orangeHits: state.orangeHits,
    goldHits: state.goldHits,
    missed: state.missed,
    shots: state.shots,
    next: state.next,
    posHash,
  };
  if (clayHasBirds(state.rev)) {
    let birdPosHash = 0;
    for (let i = 0; i < (state.birdStatus?.length ?? 0); i++) {
      birdPosHash = (Math.imul(birdPosHash, 31) + (state.birdStatus?.[i] ?? 0) * 7 + (state.birdX?.[i] ?? 0) + Math.imul(state.birdY?.[i] ?? 0, 3)) | 0;
    }
    snapshot.birdHits = state.birdHits ?? 0;
    snapshot.birdPosHash = birdPosHash;
  }
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const CLAY_ORANGE = "#E8762C";
export const CLAY_GOLD = "#F5B82E";

/** Full-stage mapping shared by drawing and tap conversion. */
export function clayView(size: CanvasSize): { scaleX: number; scaleY: number } {
  return { scaleX: size.width / CLAY_W, scaleY: size.height / CLAY_H };
}

function draw(ctx: CanvasRenderingContext2D, state: ClayState, size: CanvasSize): void {
  const { scaleX, scaleY } = clayView(size);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.scale(scaleX, scaleY);
  sceneryTexture(ctx, "clay");

  const r = CLAY_CONFIG.clayRadius;
  const tick = state.tick;
  if (state.birds && state.birdX && state.birdY && state.birdStatus && state.birdDoneTick) {
    for (let i = 0; i < state.birds.launch.length; i++) {
      const status = state.birdStatus[i];
      if (status !== CLAY_BIRD_FLYING && status !== CLAY_BIRD_STARTLED) continue;
      const px = state.birdX[i]! / 256;
      const py = state.birdY[i]! / 256;
      const startledAge = status === CLAY_BIRD_STARTLED ? tick - state.birdDoneTick[i]! : -1;
      const flap = ((tick + i * 7) % 12) < 6 ? -6 : 5;
      ctx.save();
      ctx.translate(px, py);
      if (state.birds.side[i] === 1) ctx.scale(-1, 1);
      ctx.fillStyle = "#F7F7F8";
      ctx.strokeStyle = "rgba(11,11,15,0.72)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
      ctx.moveTo(-5, 0);
      ctx.quadraticCurveTo(-12, flap, -15, 0);
      ctx.quadraticCurveTo(-10, 2, -4, 3);
      ctx.moveTo(3, 0);
      ctx.quadraticCurveTo(8, flap, 12, 1);
      ctx.quadraticCurveTo(7, 3, 2, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#0B0B0F";
      ctx.beginPath();
      ctx.arc(6, -1, 1, 0, Math.PI * 2);
      ctx.fill();
      if (startledAge >= 0) {
        ctx.fillStyle = "#F7F7F8";
        for (let k = 0; k < 6; k++) {
          const a = k * Math.PI / 3;
          const d = 8 + startledAge * 0.8;
          ctx.globalAlpha = Math.max(0, 1 - startledAge / CLAY_BIRD_STARTLED_TICKS);
          ctx.fillRect(Math.cos(a) * d - 1, Math.sin(a) * d - 1, 3, 2);
        }
        ctx.globalAlpha = 1;
        ctx.scale(state.birds.side[i] === 1 ? -1 : 1, 1);
        ctx.fillStyle = "#FF4D4D";
        ctx.font = "700 14px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("−10", 0, -16 - startledAge * 0.35);
      }
      ctx.restore();
    }
  }
  for (let i = 0; i < state.status.length; i++) {
    const px = state.x[i]! / 256;
    const py = state.y[i]! / 256;
    if (state.status[i] === CLAY_FLYING) {
      ctx.fillStyle = state.schedule.kind[i] === CLAY_KIND_GOLD ? CLAY_GOLD : CLAY_ORANGE;
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(px - 3, py - 2, r * 0.45, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (state.status[i] === CLAY_HIT) {
      const age = tick - state.doneTick[i]!;
      if (age < 20) {
        ctx.globalAlpha = 1 - age / 20;
        ctx.fillStyle = state.schedule.kind[i] === CLAY_KIND_GOLD ? CLAY_GOLD : CLAY_ORANGE;
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 + i;
          const d = 4 + age * 2.2;
          ctx.fillRect(px + Math.cos(a) * d - 3, py + Math.sin(a) * d + age * age * 0.05 - 2, 6, 4);
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  const shotAge = tick - state.shotTick;
  if (shotAge >= 0 && shotAge < 14 && state.shotHit === 0) {
    ctx.globalAlpha = 1 - shotAge / 14;
    ctx.fillStyle = "#D9D9D9";
    ctx.beginPath();
    ctx.arc(state.shotX / 256, state.shotY / 256, 5 + shotAge * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export const clayGame: ArcadeGame<ClayState, ArcadeInputEvent | null> = {
  key: "clayshoot",
  runTicks: CLAY_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: CLAY_INPUT_RANGES,
};

export const clayRev2Game: ArcadeGame<ClayState, ArcadeInputEvent | null> = { ...clayGame, init: initRev2 };
export const clayRev3Game: ArcadeGame<ClayState, ArcadeInputEvent | null> = { ...clayGame, init: (seed) => initRev3(seed) };
export const clayRev4Game: ArcadeGame<ClayState, ArcadeInputEvent | null> = { ...clayGame, init: (seed) => initRev3(seed, CLAY_REV4) };

export const clayRev5Game: ArcadeGame<ClayState, ArcadeInputEvent | null> = { ...clayGame, init: (seed) => initRev3(seed, CLAY_REV5) };

export function clayGameFor(rev?: number | null): ArcadeGame<ClayState, ArcadeInputEvent | null> {
  if (rev === CLAY_REV5) return clayRev5Game;
  if (rev === CLAY_REV4) return clayRev4Game;
  if (rev === CLAY_REV3) return clayRev3Game;
  if (rev === CLAY_REV2) return clayRev2Game;
  return clayGame;
}
