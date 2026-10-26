/**
 * Orbit rev 3 — wider zig-zag world with a scrolling camera. Reuses orbit.ts's
 * pure path/physics helpers (shape, release velocity, capture, belts) and its
 * scoring rules unchanged; only the course generator, flight cap and world
 * bounds differ, so rev 1/2 stay byte-identical (see orbit.ts and
 * .lovable/plan.md). This module is self-contained: it is not yet wired into
 * the server/grading/demo registries (a later task).
 */

import {
  clampInt,
  finishScore,
  inputRange,
  isqrt,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { BAND_STRICT_MARK, bandStrict, bandRetarget, bandCurveOf, BAND_TARGET_MARK, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";
import { speedBonusCurve } from "../duel/speedPar";
import { ANG_QUARTER } from "./trig";
import {
  FP,
  ORBIT_CIRCLE,
  ORBIT_EIGHT,
  ORBIT_EIGHT_FROM,
  ORBIT_ELLIPSE,
  ORBIT_ELLIPSE_FROM,
  ORBIT_HAZARD_FROM,
  ORBIT_INPUT_CHECKPOINT,
  ORBIT_INPUT_TAP,
  ORBIT_LOOKAHEAD,
  ORBIT_ROCKET_DIAMETER,
  ORBIT_SAFE_RUN,
  ORBIT_TOTAL,
  ORBIT_TRAIL_TICKS,
  ORBIT_BELT_PERIOD_TICKS,
  captureAt,
  flightHitsBelts,
  innerLobe,
  orbitFlightBeltK,
  orbitSweepSteps,
  ORBIT_REV4,
  ORBIT_REV_BAND,
  ORBIT_REV_TUNED,
  ORBIT_REV_SWEPT,
  ORBIT_REV_TALL,
  ORBIT_REV_TARGET,
  ORBIT_REV_STRICT,
  ORBIT_REV_XP,
  inside,
  lapPhases,
  orbitBeltOffset,
  orbitBeltStart,
  orbitExtent,
  orbitLobes,
  orbitPos,
  pathOffset,
  phaseAt,
  phaseRate,
  planetShape,
  releaseVel,
  type Planet,
} from "./orbit";

/* ============================== Constants ============================== */

export const ORBIT_REV3_WORLD_W = 1000;
export const ORBIT_REV3_FLIGHT_MAX = 190;
const FLIGHT_MAX = ORBIT_REV3_FLIGHT_MAX;
export const ORBIT_REV3_RUN_TICKS = 90 * TICKS_PER_SECOND;
/** Largest sideways step between consecutive planets, 1/256 px. */
export const ORBIT_REV3_LATERAL_MAX = 260 * FP;
/** Forced turn after this many steps in the same lateral direction (inclusive range 2–3). */
const TURN_MIN = 2;
const TURN_SPAN = 2; // draw(2) -> 0 or 1, so turn length is 2 or 3
/** Seeded retries per hop before the proved straight-up fallback. */
const MAX_RETRIES = 8;
/** Off-screen flight margin above/below the current planet (world bounds, not the view). */
const ABOVE_MARGIN = 160 * FP;
const BELOW_MARGIN = 620 * FP;
const SAFE_RUN = ORBIT_SAFE_RUN;

export const ORBIT_REV3_INPUT_RANGES: readonly InputRange[] = [inputRange(ORBIT_INPUT_TAP), inputRange(ORBIT_INPUT_CHECKPOINT)];

/* ========================== World-bounds flight ========================= */

function outsideWorld(worldW: number, from: Planet, x: number, y: number): boolean {
  return (
    x < 0 ||
    x > worldW * FP ||
    y < from.y - ABOVE_MARGIN - BELOW_MARGIN ||
    y > from.y + ABOVE_MARGIN + BELOW_MARGIN
  );
}

/** Real flight sim for one release: does it reach planet i + 1 (not skip past it)? */
function hopOk3(worldW: number, planets: readonly Planet[], i: number, angle: number, releaseTick: number): boolean {
  const from = planets[i]!;
  if (innerLobe(from, angle)) return false;
  let { x, y } = orbitPos(from, angle);
  const { vx, vy } = releaseVel(from, angle);
  for (let t = 1; t <= FLIGHT_MAX; t++) {
    const previousX = x, previousY = y;
    x += vx;
    y += vy;
    if (flightHitsBelts(planets, previousX, previousY, x, y, releaseTick + t)) return false;
    if (outsideWorld(worldW, from, x, y)) return false;
    const j = captureAt(planets, i, x, y);
    if (j < 0) continue;
    return j === i + 1;
  }
  return false;
}

/** Rotates a boolean lap so a false sits first, so wraparound runs are not split. */
function rotateToFalseStart(ok: readonly boolean[]): boolean[] {
  const idx = ok.indexOf(false);
  if (idx < 0) return ok as boolean[];
  return (ok as boolean[]).slice(idx).concat(ok.slice(0, idx));
}

/** Disjoint true-runs of at least `minLen`, as [rotatedStart, len] pairs. */
function windowsOf(ok: readonly boolean[], minLen: number): Array<{ start: number; len: number }> {
  if (ok.length === 0) return [];
  if (ok.every(Boolean)) return [{ start: 0, len: ok.length }];
  const rot = rotateToFalseStart(ok);
  const out: Array<{ start: number; len: number }> = [];
  let i = 0;
  while (i < rot.length) {
    if (!rot[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < rot.length && rot[j]) j++;
    if (j - i >= minLen) out.push({ start: i, len: j - i });
    i = j;
  }
  return out;
}

export interface Rev3HopWindow {
  /** Phase, matching `phases[k % phases.length]` for the window's first safe tick. */
  phase: number;
  /** Release tick offset (epoch) this window was proved at. */
  epoch: number;
  /** First safe tick (k) of the window within its lap, for phase-robust tapping. */
  startK: number;
  /** Width of the window, in ticks. */
  len: number;
}

/** Minimum width (in ticks) of a release window to count as safe. */
export const ORBIT_REV3_MIN_WINDOW = 4;
/** A hop is only accepted when a window this wide reappears this many consecutive laps. */
export const ORBIT_REV3_MIN_LAPS = 2;

/**
 * Per-hop proof: every release tick across one lap (including belts at that
 * tick's rotation). A circular orbit has only one contiguous release arc per
 * lap, so rather than requiring 2 *disjoint* windows within a single lap
 * (impossible), this requires a window of ORBIT_REV3_MIN_WINDOW+ ticks to
 * reappear across ORBIT_REV3_MIN_LAPS consecutive laps — i.e. it survives the
 * belt rotation moving on by a full lap period, not just a lucky single
 * sample. For hops with no belts, consecutive laps are identical, so this
 * reduces to a single >=4-tick window, but both laps are still checked.
 * Returns the earliest window's start/len/phase/epoch for the bot proof, or
 * null if no window survives every lap.
 */
export function orbitRev3HopWindow(worldW: number, planets: readonly Planet[], i: number): Rev3HopWindow | null {
  const from = planets[i];
  if (!from) return null;
  const phases = lapPhases(from);
  if (phases.length === 0) return null;
  const moving = planets.some((p) => p.hazard >= 0);
  const epochs = moving ? Array.from({ length: Math.ceil(ORBIT_BELT_PERIOD_TICKS / 30) }, (_, k) => k * 30) : [0];
  const lapLen = phases.length;
  const requiredLaps = ORBIT_REV3_MIN_LAPS;
  let result: Rev3HopWindow | null = null;
  for (const epoch of epochs) {
    const ok = phases.map((phase, k) => hopOk3(worldW, planets, i, phase, epoch + k));
    const windows = windowsOf(ok, ORBIT_REV3_MIN_WINDOW);
    if (windows.length === 0) continue;
    const falseIdx = ok.indexOf(false) < 0 ? 0 : ok.indexOf(false);
    // Rotated window indices map back to original phase index k via falseIdx.
    let survivor: { start: number; len: number } | null = null;
    for (const w of windows) {
      const startK = (w.start + falseIdx) % lapLen;
      let survives = true;
      for (let lap = 1; lap < requiredLaps && survives; lap++) {
        const lapEpoch = epoch + lap * lapLen;
        for (let off = 0; off < w.len; off++) {
          const k = (startK + off) % lapLen;
          if (!hopOk3(worldW, planets, i, phases[k]!, lapEpoch + k)) {
            survives = false;
            break;
          }
        }
      }
      if (survives) {
        survivor = w;
        break;
      }
    }
    if (!survivor) continue;
    const startK = (survivor.start + falseIdx) % lapLen;
    const mid = (survivor.start + Math.trunc(survivor.len / 2) + falseIdx) % lapLen;
    result = { phase: phases[mid]!, epoch, startK, len: survivor.len };
    break;
  }
  return result;
}

function forwardDelta(dir: number, from: number, to: number): number {
  return dir >= 0 ? (to - from) & 65535 : (from - to) & 65535;
}

/**
 * True once `angle` has entered the proved window's arc. Robust to arbitrary
 * capture entry angle: unlike waiting for an exact phase match (which can
 * stall for nearly a full lap if the entry angle lands just past the proved
 * tick), this fires as soon as the angle is anywhere inside the window.
 */
export function orbitRev3InWindow(from: Planet, phases: readonly number[], win: Rev3HopWindow, angle: number): boolean {
  const startAngle = phases[win.startK]!;
  const endAngle = phases[(win.startK + win.len - 1) % phases.length]!;
  const width = forwardDelta(from.dir, startAngle, endAngle);
  return forwardDelta(from.dir, startAngle, angle) <= width;
}

function hasWindow3(worldW: number, planets: readonly Planet[], i: number): boolean {
  return orbitRev3HopWindow(worldW, planets, i) !== null;
}

/* ============================ Course builder ============================ */

interface ZigState {
  dir: number;
  streak: number;
  turnLen: number;
}

function buildCourse3Raw(seed: number, worldW = ORBIT_REV3_WORLD_W): { planets: Planet[]; rng: number } {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const first = planetShape(0);
  const planets: Planet[] = [
    { x: Math.trunc(worldW / 2) * FP, y: 0, ...first, dir: draw(2) ? 1 : -1, hazard: -1, colour: 0, kind: ORBIT_CIRCLE, rot: 0 },
  ];
  let zig: ZigState = { dir: draw(2) ? 1 : -1, streak: 0, turnLen: TURN_MIN + draw(TURN_SPAN) };
  let fallbacks = 0;
  let maxLateral = 0;

  for (let i = 1; i <= ORBIT_TOTAL; i++) {
    const prev = planets[i - 1]!;
    const shape = planetShape(i);
    let placed = false;
    for (let attempt = 0; attempt < MAX_RETRIES && !placed; attempt++) {
      const roll = draw(12);
      const kind = i === ORBIT_TOTAL ? ORBIT_CIRCLE : i >= ORBIT_EIGHT_FROM && roll < 3 ? ORBIT_EIGHT
        : i >= ORBIT_ELLIPSE_FROM && roll < 7 && roll >= 3 ? ORBIT_ELLIPSE : ORBIT_CIRCLE;
      const rot = kind === ORBIT_ELLIPSE ? draw(16) * 4096 : 0;
      const extent = orbitExtent({ kind, ring: shape.ring });
      const lo = extent + 8 * FP;
      const hi = worldW * FP - extent - 8 * FP;

      // Forced zig-zag turn: flip direction once the streak hits its seeded length.
      if (zig.streak >= zig.turnLen) {
        zig = { dir: -zig.dir, streak: 0, turnLen: TURN_MIN + draw(TURN_SPAN) };
      }
      const lateral = draw(Math.trunc(ORBIT_REV3_LATERAL_MAX / FP) + 1) * FP;
      let x = clampInt(prev.x + zig.dir * lateral, lo, hi);
      // Pinned against an edge: force the turn now regardless of streak.
      if (x === lo || x === hi) {
        zig = { dir: -zig.dir, streak: 0, turnLen: TURN_MIN + draw(TURN_SPAN) };
        x = clampInt(prev.x + zig.dir * lateral, lo, hi);
      }
      zig.streak += 1;
      maxLateral = Math.max(maxLateral, Math.abs(x - prev.x));

      const y = prev.y - Math.trunc(((150 + draw(81)) * 115) / 100) * FP;
      const dx = x - prev.x;
      const dy = y - prev.y;
      const min = orbitExtent(prev) + extent + 24 * FP;
      if (dx * dx + dy * dy < min * min) continue;
      const hazard = i >= ORBIT_HAZARD_FROM && i < ORBIT_TOTAL && draw(2) === 1 ? draw(64) * 1024 : -1;
      const spin = draw(2) ? 1 : -1;
      const candidate: Planet = { x, y, ...shape, dir: kind === ORBIT_EIGHT ? -1 : spin, hazard, colour: i % 4, kind, rot };
      planets.push(candidate);
      if (hasWindow3(worldW, planets, i - 1)) placed = true;
      else planets.pop();
    }
    if (!placed) {
      fallbacks += 1;
      const lo = shape.ring + 8 * FP;
      const hi = worldW * FP - shape.ring - 8 * FP;
      const x = clampInt(prev.x, lo, hi);
      const dir = draw(2) ? 1 : -1;
      let chosen: Planet | null = null;
      for (const lift of [200, 230, 264, 300, 340, 380, 420, 460]) {
        const c: Planet = { x, y: prev.y - lift * FP, ...shape, dir, hazard: -1, colour: i % 4, kind: ORBIT_CIRCLE, rot: 0 };
        planets.push(c);
        const ok = hasWindow3(worldW, planets, i - 1);
        planets.pop();
        if (ok && !chosen) chosen = c;
      }
      if (!chosen) throw new Error(`Orbit rev3 seed ${seed} hop ${i} has no provable fallback`);
      planets.push(chosen);
    }
  }
  for (let i = 0; i < ORBIT_TOTAL; i++) {
    if (!hasWindow3(worldW, planets, i)) throw new Error(`Orbit rev3 seed ${seed} hop ${i} has no verified window`);
  }
  (planets as Planet[] & { __fallbacks?: number; __maxLateral?: number }).__fallbacks = fallbacks;
  (planets as Planet[] & { __fallbacks?: number; __maxLateral?: number }).__maxLateral = maxLateral;
  return { planets, rng };
}

export interface OrbitRev3Stats {
  hops: number;
  safe: number;
  ellipses: number;
  eights: number;
  laps: number[];
  speeds: number[];
  fallbacks: number;
  maxLateral: number;
}

/** Builds (and proves) one rev3 layout for a seed; stats mirror orbitCourseCheck plus zig-zag/fallback counts. */
export function getOrbitRev3Layout(seed: number, worldW = ORBIT_REV3_WORLD_W): { planets: Planet[]; stats: OrbitRev3Stats } {
  const { planets } = buildCourse3(seed, worldW);
  let safe = 0;
  for (let i = 0; i < ORBIT_TOTAL; i++) if (hasWindow3(worldW, planets, i)) safe++;
  const tagged = planets as Planet[] & { __fallbacks?: number; __maxLateral?: number };
  return {
    planets,
    stats: {
      hops: ORBIT_TOTAL,
      safe,
      ellipses: planets.filter((p) => p.kind === ORBIT_ELLIPSE).length,
      eights: planets.filter((p) => p.kind === ORBIT_EIGHT).length,
      laps: planets.map((p) => Math.round(65536 / p.omega)),
      speeds: planets.map((p) => p.speed / FP),
      fallbacks: tagged.__fallbacks ?? 0,
      maxLateral: (tagged.__maxLateral ?? 0) / FP,
    },
  };
}

/* ============================ Whole-run proof ============================ */

export interface OrbitRev3Proof {
  ok: boolean;
  ticks: number;
  reason?: string;
}

/**
 * Chains all 40 hops with the real sim: a bot taps at the middle of the
 * earliest valid window for each hop and must reach planet 40 inside the run.
 */
/**
 * Finds the earliest tap delay (ticks of waiting in orbit before tapping)
 * that both survives and advances a hop, by directly simulating the real
 * step function rather than reasoning about angles/phases. Walks the state
 * forward one tick at a time; at every tick it forks a trial tap-now branch
 * and simulates that branch through flight to capture/death without
 * disturbing the main walk. Taps at the middle of the first contiguous run
 * of at least ORBIT_REV3_MIN_WINDOW successful delays, matching the same
 * "robust window" notion as orbitRev3HopWindow but derived from the live
 * game state instead of angle maths.
 */
export function findHopTapDelay(
  state: OrbitRev3State,
  worldW: number,
  lapTicks: number,
): number | null {
  const startCur = state.cur;
  const ok: boolean[] = [];
  const moving = state.planets.some((p) => p.hazard >= 0);
  const maxK = Math.max(lapTicks * 2, ORBIT_REV3_MIN_WINDOW * 2, moving ? ORBIT_BELT_PERIOD_TICKS : 0);
  let walk = state;
  for (let k = 0; k <= maxK; k++) {
    let branch = stepRev3(walk, worldW, { t: walk.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
    let success = false;
    if (branch.ended === 0 || branch.finished === 1) {
      let guard = 0;
      while (branch.flying > 0 && branch.ended === 0 && guard < FLIGHT_MAX + 5) {
        branch = stepRev3(branch, worldW, null);
        guard++;
      }
      // Finishing (planet 40, ended = 1) also counts as a successful hop.
      success = (branch.ended === 0 || branch.finished === 1) && branch.cur > startCur;
    }
    ok.push(success);
    if (k < maxK) walk = stepRev3(walk, worldW, null);
  }
  let bestStart = -1;
  let bestLen = 0;
  let i = 0;
  while (i < ok.length) {
    if (!ok[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < ok.length && ok[j]) j++;
    if (j - i >= ORBIT_REV3_MIN_WINDOW) {
      bestStart = i;
      bestLen = j - i;
      break;
    }
    i = j;
  }
  if (bestStart < 0) return null;
  return bestStart + Math.trunc(bestLen / 2);
}

/**
 * Live-sim bot: taps mid of the first robust window from its real arrival
 * state. Also records every tap tick, so a bank build can store the tap log
 * alongside the proof and later re-verify by replaying it (no re-search)
 * through orbitRev3Game.
 */
export function runRev3BotWithTaps(planets: Planet[], worldW: number): { proof: OrbitRev3Proof; taps: number[] } {
  let state = initRev3From(planets, worldW);
  const taps: number[] = [];
  let safety = 0;
  while (state.cur < ORBIT_TOTAL && state.ended === 0 && safety < ORBIT_REV3_RUN_TICKS) {
    if (state.flying === 0) {
      const here = state.planets[state.cur]!;
      const lapTicks = lapPhases(here).length;
      const delay = findHopTapDelay(state, worldW, lapTicks);
      if (delay === null) return { proof: { ok: false, ticks: state.tick, reason: `no window at hop ${state.cur}` }, taps };
      for (let k = 0; k < delay; k++) {
        state = stepRev3(state, worldW, null);
        safety++;
      }
      const tapTick = state.tick + 1;
      taps.push(tapTick);
      state = stepRev3(state, worldW, { t: tapTick, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
    } else {
      state = stepRev3(state, worldW, null);
    }
    safety++;
  }
  const ok = state.cur >= ORBIT_TOTAL || state.finished === 1;
  const proof = ok ? { ok, ticks: state.tick } : { ok, ticks: state.tick, reason: "did not reach planet 40 in time" };
  return { proof, taps };
}

function runRev3Bot(planets: Planet[], worldW: number): OrbitRev3Proof {
  return runRev3BotWithTaps(planets, worldW).proof;
}

/** Salted attempts per seed before giving up; each attempt is fully seeded. */
export const ORBIT_REV3_SALTS = 32;
const proofCache = new Map<string, { planets: Planet[]; rng: number; proof: OrbitRev3Proof; salt: number }>();

/**
 * Seeded course whose completion is proved by the live-sim bot. Salt s rebuilds
 * the raw course from a deterministic seed mix until the bot finishes.
 */
export function buildCourse3(seed: number, worldW = ORBIT_REV3_WORLD_W): { planets: Planet[]; rng: number; proof: OrbitRev3Proof; salt: number } {
  const key = `${seed}:${worldW}`;
  const hit = proofCache.get(key);
  if (hit) return hit;
  let last = "";
  for (let salt = 0; salt < ORBIT_REV3_SALTS; salt++) {
    const s = salt === 0 ? seed | 0 : (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) | 0;
    let raw: { planets: Planet[]; rng: number };
    try {
      raw = buildCourse3Raw(s, worldW);
    } catch (e) {
      last = (e as Error).message;
      continue;
    }
    const proof = runRev3Bot(raw.planets, worldW);
    if (proof.ok) {
      const out = { ...raw, proof, salt };
      if (proofCache.size > 64) proofCache.clear();
      proofCache.set(key, out);
      return out;
    }
    last = proof.reason ?? "unproved";
  }
  throw new Error(`Orbit rev3 seed ${seed} unproved after ${ORBIT_REV3_SALTS} salts: ${last}`);
}

export function proveOrbitRev3Layout(seed: number, worldW = ORBIT_REV3_WORLD_W): OrbitRev3Proof & { salt?: number } {
  try {
    const c = buildCourse3(seed, worldW);
    return { ...c.proof, salt: c.salt };
  } catch (e) {
    return { ok: false, ticks: 0, reason: (e as Error).message };
  }
}

/* ================================ State ================================ */

/* ============================ Rev 4: black holes ============================ */

/**
 * A black hole near planet `from`, at (x, y) in 1/256 px. A flight released
 * from `from` that passes within ORBIT_HOLE_R of its centre is swallowed and
 * comes out in orbit round planet `to` (5 or 6 planets on); the planets in
 * between count as reached. Holes are found and proved offline and shipped
 * in the puzzle (scripts/orbit-hole-bank.ts).
 */
export interface OrbitHole {
  from: number;
  to: number;
  x: number;
  y: number;
}
/** Capture radius of a black hole (and its drawn disc), 1/256 px. */
export const ORBIT_HOLE_R = 13 * FP;
/** Compact hole row as shipped in the puzzle: [from, to, x, y]. */
export type OrbitHoleRow = [number, number, number, number];
export function encodeOrbitHoles(holes: readonly OrbitHole[]): OrbitHoleRow[] {
  return holes.map((h) => [h.from, h.to, h.x, h.y]);
}
export function decodeOrbitHoles(rows: readonly OrbitHoleRow[]): OrbitHole[] {
  return rows.map(([from, to, x, y]) => ({ from, to, x, y }));
}

/** Does the swept flight segment pass within the hole's capture radius? Integer only. */
export function orbitFlightHitsHole(hole: OrbitHole, x0: number, y0: number, x1: number, y1: number): boolean {
  const steps = Math.max(1, Math.trunc((Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + FP - 1) / FP));
  for (let k = 0; k <= steps; k++) {
    const dx = x0 + Math.trunc(((x1 - x0) * k) / steps) - hole.x;
    const dy = y0 + Math.trunc(((y1 - y0) * k) / steps) - hole.y;
    if (dx * dx + dy * dy <= ORBIT_HOLE_R * ORBIT_HOLE_R) return true;
  }
  return false;
}

export interface OrbitRev3State extends BandFields {
  /** Marks this as a rev3 layout for orbitCamera.ts and shared drawing helpers. */
  rev: 3;
  /** Rev 4 only: the black holes, jumps taken, planets skipped by them, and the last jump tick (render). */
  holes?: OrbitHole[];
  jumps?: number;
  skipped?: number;
  holeTick?: number;
  /** orbitRev 6 only: set on the revision, and the fly-in ticks left after a black hole. */
  tuned?: number;
  warp?: number;
  /** orbitRev 7 only (Tuning F): 1 = swept black holes (orbitSweptHit). Absent on every earlier round. */
  swept?: number;
  /** orbitRev 8 only (taller worlds): the view height in px (ORBIT_TALL_VIEW_H). Absent = 620. Display only: no step reads it. */
  worldH?: number;
  /**
   * orbitRev 12 only (world expansion; absent on every earlier round): the marker, the view width, the course's
   * features (stardust motes, slingshot moons, asteroid fields) and what the run has taken of them. See "World
   * expansion" below.
   */
  xp?: number;
  viewW?: number;
  dust?: readonly OrbitDust[];
  moons?: readonly OrbitMoon[];
  fields?: readonly OrbitField[];
  /** Bit i: mote i collected / moon i slung round / field i threaded. */
  dustGot?: number;
  slung?: number;
  threaded?: number;
  /** Hops let go during the first lap round their planet. */
  perfect?: number;
  /** Ticks left of the first lap round the current planet; `arm` = this flight was let go inside it. */
  lapLeft?: number;
  arm?: number;
  /** 1 while this flight is boosted by a slingshot; `moonIn` bit i = the rocket is inside moon i's ring. */
  boost?: number;
  moonIn?: number;
  /** orbitRev 12: the furthest a flight from planet `best` got toward planet best + 1, in sixteenths (0–15). */
  reach?: number;
  tick: number;
  rng: number;
  cur: number;
  angle: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  flying: number;
  captured: number;
  camY: number;
  worldW: number;
  releaseTick: number;
  releaseX: number;
  releaseY: number;
  finished: number;
  best: number;
  checkpoint: number;
  respawns: number;
  respawnTick: number;
  ended: number;
  endedTick: number;
  planets: Planet[];
}

const VIEW_ANCHOR = 440 * FP;
const courseCache = new Map<number, { planets: Planet[]; rng: number }>();

export function initRev3From(planets: Planet[], worldW: number, rng = 0): OrbitRev3State {
  const p = planets[0]!;
  const angle = 3 * ANG_QUARTER;
  const pos = orbitPos(p, angle);
  return {
    rev: 3,
    tick: 0,
    rng,
    cur: 0,
    angle,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    flying: 0,
    captured: 0,
    camY: p.y - VIEW_ANCHOR,
    worldW,
    releaseTick: -100,
    releaseX: 0,
    releaseY: 0,
    finished: 0,
    best: 0,
    checkpoint: -1,
    respawns: 1,
    respawnTick: -100,
    ended: 0,
    endedTick: 0,
    planets,
  };
}

/** Rev 4 start state: the rev-3 start on these planets, plus the holes. */
export function initRev4From(planets: Planet[], worldW: number, holes: OrbitHole[], rng = 0): OrbitRev3State {
  return { ...initRev3From(planets, worldW, rng), holes, jumps: 0, skipped: 0, holeTick: -100 };
}

function init(seed: number): OrbitRev3State {
  let course = courseCache.get(seed | 0);
  if (!course) {
    course = buildCourse3(seed);
    if (courseCache.size > 16) courseCache.clear();
    courseCache.set(seed | 0, course);
  }
  return initRev3From(course.planets, ORBIT_REV3_WORLD_W, course.rng);
}

function isOver(state: OrbitRev3State): boolean {
  return state.ended !== 0;
}

export function orbitRev3CanSetCheckpoint(state: OrbitRev3State): boolean {
  return state.ended === 0 && state.flying === 0 && !(state.warp ?? 0) && state.checkpoint < 0 && state.respawns > 0;
}

function stepRev3(state: OrbitRev3State, worldW: number, input: ArcadeInputEvent | null): OrbitRev3State {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: OrbitRev3State = { ...state, tick };
  const here = s.planets[s.cur]!;
  if (input?.k === ORBIT_INPUT_CHECKPOINT && orbitRev3CanSetCheckpoint(s)) s.checkpoint = s.cur;
  let respawned = false;
  const die = () => {
    if (s.xp) {
      s.arm = 0;
      s.boost = 0;
      s.moonIn = 0;
    }
    if (s.checkpoint >= 0 && s.respawns > 0) {
      s.respawns -= 1;
      s.respawnTick = tick;
      s.cur = s.checkpoint;
      const p = s.planets[s.cur]!;
      s.angle = 3 * ANG_QUARTER;
      const pos = orbitPos(p, s.angle);
      s.x = pos.x;
      s.y = pos.y;
      s.vx = 0;
      s.vy = 0;
      s.flying = 0;
      if (s.xp) s.lapLeft = lapPhases(p).length;
      respawned = true;
      return;
    }
    s.ended = 2;
    s.endedTick = tick;
  };
  if ((s.warp ?? 0) > 0) {
    // orbitRev 6: flying in from outside the orbit after a black hole; taps do nothing until it is in orbit.
    s.warp = s.warp! - 1;
    s.angle = (s.angle + here.dir * phaseRate(here, s.angle)) & 65535;
    const pos = orbitWarpPos(here, s.angle, s.warp);
    s.x = pos.x;
    s.y = pos.y;
  } else if (s.flying === 0) {
    if (!respawned && input !== null && input.k === ORBIT_INPUT_TAP && innerLobe(here, s.angle)) {
      die();
      if (s.ended) return s;
    }
    if (respawned) {
      // Respawned this tick: hold orbit.
    } else if (input !== null && input.k === ORBIT_INPUT_TAP) {
      const v = releaseVel(here, s.angle);
      s.vx = v.vx;
      s.vy = v.vy;
      s.flying = 1;
      s.releaseTick = tick;
      s.releaseX = s.x;
      s.releaseY = s.y;
      // orbitRev 12: a release during the first lap round this planet is armed for a perfect orbit.
      if (s.xp) {
        s.arm = (s.lapLeft ?? 0) > 0 ? 1 : 0;
        s.boost = 0;
        s.moonIn = 0;
      }
    } else {
      if (s.xp && (s.lapLeft ?? 0) > 0) s.lapLeft = s.lapLeft! - 1;
      s.angle = (s.angle + here.dir * phaseRate(here, s.angle)) & 65535;
      const pos = orbitPos(here, s.angle);
      s.x = pos.x;
      s.y = pos.y;
    }
  }
  if (s.flying > 0) {
    const previousX = s.x, previousY = s.y;
    s.x += s.vx;
    s.y += s.vy;
    // orbitRev 12: partial credit, how far a flight from the furthest planet reached got toward the next one.
    if (s.xp) orbitXpReach(s);
    // orbitRev 7: one sweep orders belts and black holes along the segment; earlier revisions test belts, then holes.
    const sweep = s.swept ? orbitSweptHit(s, previousX, previousY, s.x, s.y, tick) : null;
    if (sweep ? sweep.belt : flightHitsBelts(s.planets, previousX, previousY, s.x, s.y, tick)) {
      die();
      if (respawned) {
        const checkpointPlanet = s.planets[s.cur];
        if (checkpointPlanet) s.camY = checkpointPlanet.y - VIEW_ANCHOR;
      }
      if (s.ended || respawned) return s;
    }
    // Rev 4: a black hole beside the planet just left swallows the rocket and puts it in
    // orbit round planet `to`; the planets in between count as reached.
    const hole = sweep ? sweep.hole : s.holes ? s.holes.find((h) => h.from === s.cur && orbitFlightHitsHole(h, previousX, previousY, s.x, s.y)) : undefined;
    // orbitRev 12: rocks and moon bodies crash free flight (a black hole only wins when it comes first along the
    // tick's segment); otherwise the segment collects stardust, threads asteroid fields and may slingshot.
    if (s.xp) {
      const hit = orbitXpSweep(s, previousX, previousY, s.x, s.y);
      if (hit.crashK >= 0 && (!hole || hit.crashK < orbitHoleK(hole, previousX, previousY, s.x, s.y, orbitSweepSteps(previousX, previousY, s.x, s.y)))) {
        die();
        if (respawned) {
          const checkpointPlanet = s.planets[s.cur];
          if (checkpointPlanet) s.camY = checkpointPlanet.y - VIEW_ANCHOR;
        }
        if (s.ended || respawned) return s;
      }
      if (hit.dust) s.dustGot = (s.dustGot ?? 0) | hit.dust;
      if (hit.fields) s.threaded = (s.threaded ?? 0) | hit.fields;
      // A slingshot is taken on leaving a moon's ring without having touched the moon.
      const left = (s.moonIn ?? 0) & ~hit.ring;
      s.moonIn = hit.ring;
      if (left && !s.boost) {
        let moon = 0;
        while (!(left & (1 << moon))) moon++;
        s.boost = 1;
        s.slung = (s.slung ?? 0) | (1 << moon);
        s.vx = Math.trunc((s.vx * ORBIT_SLING_NUM) / ORBIT_SLING_DEN);
        s.vy = Math.trunc((s.vy * ORBIT_SLING_NUM) / ORBIT_SLING_DEN);
      }
    }
    const j = hole ? -1 : captureAt(s.planets, s.cur, s.x, s.y);
    if (s.xp && (hole || j >= 0)) {
      if (s.arm) s.perfect = (s.perfect ?? 0) + 1;
      s.arm = 0;
      s.boost = 0;
      s.moonIn = 0;
      s.lapLeft = lapPhases(s.planets[hole ? hole.to : j]!).length;
    }
    if (hole) {
      const to = s.planets[hole.to]!;
      // The planets between the one left and the hole's target count as reached (on rev 4–6 the one left is always hole.from).
      s.skipped = (s.skipped ?? 0) + (hole.to - (s.swept ? s.cur : hole.from) - 1);
      s.jumps = (s.jumps ?? 0) + 1;
      s.holeTick = tick;
      s.cur = hole.to;
      s.angle = 3 * ANG_QUARTER;
      // orbitRev 6: the rocket comes out beside the target and flies into its orbit over ORBIT_WARP_TICKS.
      if (s.tuned) s.warp = ORBIT_WARP_TICKS;
      const pos = s.tuned ? orbitWarpPos(to, s.angle, ORBIT_WARP_TICKS) : orbitPos(to, s.angle);
      s.x = pos.x;
      s.y = pos.y;
      s.vx = 0;
      s.vy = 0;
      s.flying = 0;
      s.captured += 1;
      if (hole.to > s.best) {
        s.best = hole.to;
        if (s.xp) s.reach = 0;
      }
    } else if (j >= 0) {
      const to = s.planets[j]!;
      s.cur = j;
      s.angle = phaseAt(to, s.x, s.y);
      const pos = orbitPos(to, s.angle);
      s.x = pos.x;
      s.y = pos.y;
      s.flying = 0;
      s.captured += 1;
      if (j > s.best) {
        s.best = j;
        if (s.xp) s.reach = 0;
      }
      if (j >= ORBIT_TOTAL) {
        s.ended = 1;
        s.endedTick = tick;
        s.finished = 1;
      }
    } else if (outsideWorld(worldW, here, s.x, s.y) || s.flying >= FLIGHT_MAX || (s.tuned && orbitPastReach(s))) die();
    else s.flying += 1;
    if (respawned) s.camY = s.planets[s.cur]!.y - VIEW_ANCHOR;
  }
  if (s.ended) return s;
  const target = s.planets[s.cur]!.y - VIEW_ANCHOR;
  s.camY += Math.trunc((target - s.camY) / 10);
  if (!s.ended && tick >= ORBIT_REV3_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

function step(state: OrbitRev3State, input: ArcadeInputEvent | null): OrbitRev3State {
  return stepRev3(state, state.worldW, input);
}

function score(state: OrbitRev3State): number {
  if (state.finished) return finishScore(ORBIT_REV3_RUN_TICKS, state.endedTick);
  return clampInt(3 * state.best, 0, 130);
}

export function orbitRev3Extra(s: OrbitRev3State) {
  return {
    jumps: s.jumps ?? 0,
    skipped: s.skipped ?? 0,
    holes: s.holes?.length ?? 0,
    passed: s.best,
    respawned: s.respawns === 0,
    checkpoint: s.checkpoint,
    captured: s.captured,
    total: ORBIT_TOTAL,
    survived: s.ended !== 2,
    survivedSeconds: s.tick / 60,
    finished: s.finished === 1,
    secondsLeft: s.finished ? Math.max(0, ORBIT_REV3_RUN_TICKS - s.tick) / 60 : 0,
  };
}

/* =============================== Drawing =============================== */
/** World px drawn: the camera view (orbitCamera.ts), independent of the generator's world width. */
const VIEW_W = 390;
const VIEW_H = 620;

export const ORBIT_REV3_BG = "#06060F";
export const ORBIT_REV3_GOLD = "#F5B82E";
export const ORBIT_REV3_RED = "#FF4D5E";
export const ORBIT_REV3_COLOURS = ["#2EC4B6", "#8B5CF6", "#3B82F6", "#22C55E"];

function draw(ctx: CanvasRenderingContext2D, state: OrbitRev3State, size: CanvasSize): void {
  // Camera: the point 35% toward the next planet, rocket boxed, eased per sim tick (render-only).
  const camX = state.x / FP - VIEW_W / 2;
  const cam = state.camY / FP;
  const scale = Math.min(size.width / VIEW_W, size.height / VIEW_H);
  const ox = (size.width - VIEW_W * scale) / 2;
  const oy = (size.height - VIEW_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = ORBIT_REV3_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, VIEW_W, VIEW_H);
  ctx.clip();

  ctx.fillStyle = "#FFFFFF";
  const par = cam * 0.4;
  const band = Math.floor(par / 40);
  for (let row = band - 1; row < band + 18; row++) {
    for (let k = 0; k < 2; k++) {
      const h = Math.imul(row * 2 + k + 7, 2654435761) >>> 0;
      const sx = (h % VIEW_W + camX * 0.3 + VIEW_W) % VIEW_W;
      const sy = row * 40 + ((h >>> 12) % 40) - par;
      ctx.globalAlpha = 0.25 + ((h >>> 20) % 50) / 100;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
  }
  ctx.globalAlpha = 1;

  for (let i = Math.max(0, state.cur - 2); i < state.planets.length; i++) {
    const p = state.planets[i]!;
    const px = p.x / FP - camX;
    const py = p.y / FP - cam;
    if (py < -200 || py > VIEW_H + 200 || px < -200 || px > VIEW_W + 200) continue;
    const sun = i === ORBIT_TOTAL;
    const colour = sun ? ORBIT_REV3_GOLD : ORBIT_REV3_COLOURS[p.colour]!;
    if (sun) {
      const glow = ctx.createRadialGradient(px, py, (p.r / FP) * 0.4, px, py, (p.r / FP) * 1.8);
      glow.addColorStop(0, "rgba(255,214,102,0.9)");
      glow.addColorStop(1, "rgba(255,170,40,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, (p.r / FP) * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFD666";
      ctx.beginPath();
      ctx.arc(px, py, p.r / FP, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = colour;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k <= 64; k++) {
      const o = pathOffset(p, (k * 1024) & 65535);
      if (k === 0) ctx.moveTo(px + o.u / FP, py + o.v / FP);
      else ctx.lineTo(px + o.u / FP, py + o.v / FP);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 5;
    const bodies = p.kind === ORBIT_EIGHT ? [-orbitLobes(p) / FP, orbitLobes(p) / FP] : [0];
    for (const bx of bodies) {
      ctx.beginPath();
      ctx.arc(px + bx, py, (p.kind === ORBIT_EIGHT ? p.r * 0.8 : p.r) / FP - 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (i === state.checkpoint && state.respawns > 0) {
      ctx.fillStyle = ORBIT_REV3_GOLD;
      ctx.beginPath();
      ctx.arc(px, py - p.r / FP - 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (p.hazard >= 0) {
      ctx.strokeStyle = ORBIT_REV3_RED;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) {
        const o = orbitBeltOffset(p, (orbitBeltStart(p, state.tick) + Math.trunc((16384 * k) / 16)) & 65535);
        if (k === 0) ctx.moveTo(px + o.u / FP, py + o.v / FP);
        else ctx.lineTo(px + o.u / FP, py + o.v / FP);
      }
      ctx.stroke();
    }
  }

  const since = state.tick - state.releaseTick;
  if (since >= 0 && since < ORBIT_TRAIL_TICKS && state.flying > 0) {
    ctx.strokeStyle = ORBIT_REV3_GOLD;
    ctx.globalAlpha = 0.25 * (1 - since / ORBIT_TRAIL_TICKS);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(state.releaseX / FP - camX, state.releaseY / FP - cam);
    ctx.lineTo(state.releaseX / FP - camX + (state.vx / FP) * 90, state.releaseY / FP - cam + (state.vy / FP) * 90);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  const here = state.planets[state.cur]!;
  let hx: number;
  let hy: number;
  if (state.flying > 0) {
    hx = state.vx;
    hy = state.vy;
  } else {
    const v = releaseVel(here, state.angle);
    hx = v.vx;
    hy = v.vy;
  }
  const len = Math.hypot(hx, hy) || 1;
  const ux = hx / len;
  const uy = hy / len;
  const sx = state.x / FP - camX;
  const sy = state.y / FP - cam;
  ctx.strokeStyle = ORBIT_REV3_GOLD;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx - ux * 18, sy - uy * 18);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = state.ended === 2 ? ORBIT_REV3_RED : ORBIT_REV3_GOLD;
  ctx.beginPath();
  ctx.moveTo(sx + ux * 10, sy + uy * 10);
  ctx.lineTo(sx - ux * 6 - uy * 6, sy - uy * 6 + ux * 6);
  ctx.lineTo(sx - ux * 6 + uy * 6, sy - uy * 6 - ux * 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 16px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Planets ${state.best} / ${ORBIT_TOTAL}`, 14, 26);
  if (state.checkpoint >= 0) {
    ctx.fillStyle = state.respawns > 0 ? ORBIT_REV3_GOLD : "rgba(255,255,255,0.4)";
    ctx.font = "600 12px ui-monospace, monospace";
    ctx.fillText(state.respawns > 0 ? `Checkpoint ${state.checkpoint} · 1 respawn` : `Checkpoint used`, 14, 44);
  }
  if (state.tick - state.respawnTick < 45) {
    ctx.globalAlpha = 1 - (state.tick - state.respawnTick) / 45;
    ctx.fillStyle = ORBIT_REV3_GOLD;
    ctx.font = "700 22px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("RESPAWN", VIEW_W / 2, VIEW_H / 2);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export const orbitRev3Game: ArcadeGame<OrbitRev3State, ArcadeInputEvent | null> = {
  key: "orbit",
  runTicks: ORBIT_REV3_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: ORBIT_REV3_INPUT_RANGES,
};

export { ORBIT_LOOKAHEAD as ORBIT_REV3_LOOKAHEAD, ORBIT_ROCKET_DIAMETER as ORBIT_REV3_ROCKET_DIAMETER };

/* ========================= Compact planet rows ========================= */

/**
 * Per-planet compact row: only the fields planetShape(i) cannot derive from
 * the index — [x, y, dir, hazard, colour, kind, rot].
 */
export type OrbitRev3CompactPlanet = [number, number, number, number, number, number, number];

export function encodeRev3Planets(planets: readonly Planet[]): OrbitRev3CompactPlanet[] {
  return planets.map((p) => [p.x, p.y, p.dir, p.hazard, p.colour, p.kind, p.rot]);
}

export function decodeRev3Planets(rows: readonly OrbitRev3CompactPlanet[]): Planet[] {
  return rows.map(([x, y, dir, hazard, colour, kind, rot], i) => ({
    ...planetShape(i),
    x,
    y,
    dir,
    hazard,
    colour,
    kind,
    rot,
  }));
}

/* ================= Oct 2026 score bands (orbitRev 5) ================= */

/** Furthest planet reached; 140 at all 40 (the 117 partial cap is gone); reaching the sun adds up to 10 for speed. */
export const ORBIT_BAND_CURVE = bandCurve([0, 12, 20, 30, 36, 39, 40], [0, 70, 100, 125, 135, 138, 140]);

/** orbitRev 5 start: the rev-4 course (planets and any holes from the puzzle), band-stamped. */
export function initBandFrom(planets: Planet[], worldW: number, holes: OrbitHole[]): OrbitRev3State {
  return bandInit(initRev4From(planets, worldW, holes));
}

export function orbitBandParts(state: OrbitRev3State): BandParts {
  if (state.xp) return orbitXpParts(state);
  const finished = Boolean(state.finished);
  const units = finished ? ORBIT_TOTAL : clampInt(state.best, 0, ORBIT_TOTAL);
  return {
    units,
    points: bandPoints(bandCurveOf(state, ORBIT_BAND_CURVE), units),
    bonus: finished ? speedBonusCurve(BAND_FINISH_BONUS, ORBIT_REV3_RUN_TICKS - clampInt(state.endedTick, 0, ORBIT_REV3_RUN_TICKS), ORBIT_REV3_RUN_TICKS) : 0,
    penalty: 0,
    finished,
    text: finished ? "Sun reached" : `${units} / ${ORBIT_TOTAL} planets`,
    bonusText: "Sun reached",
  };
}

function scoreBand(state: OrbitRev3State): number {
  if (state.xp) return bandTotal(orbitBandParts(state), Boolean(state.acted), ORBIT_XP_MAX);
  return bandTotal(orbitBandParts(state), Boolean(state.acted));
}

/* ================= Tuning A (orbitRev 6, Oct 2026) ================= */
/*
 * Rev-5 play and band curve with two changes, both only on states that carry
 * `tuned` (older rounds never do):
 *  - after a black hole the rocket comes out ORBIT_WARP_OUT outside the
 *    target's orbit and eases into it over ORBIT_WARP_TICKS (1 s), turning
 *    with the orbit; taps and the checkpoint wait until it is in orbit;
 *  - a missed hop ends as soon as the rocket is further from where it let go
 *    than any point that could still catch it (the next two planets' capture
 *    areas and the black holes beside the planet it left), instead of flying
 *    on toward planets further up the course for up to 190 ticks.
 */
export const ORBIT_WARP_TICKS = 60;
/** How far outside its orbit the rocket comes out of a black hole, 1/256 px (inside a belt's 50 px clearance). */
export const ORBIT_WARP_OUT = 40 * FP;

/** Where the fly-in puts the rocket with `left` ticks to go: its orbit point pushed out by an eased share of ORBIT_WARP_OUT. */
export function orbitWarpPos(p: Planet, angle: number, left: number): { x: number; y: number } {
  const pos = orbitPos(p, angle);
  const dx = pos.x - p.x;
  const dy = pos.y - p.y;
  const len = isqrt(dx * dx + dy * dy);
  if (len === 0 || left <= 0) return pos;
  // Quadratic ease: fast at first, settling gently into the orbit.
  const out = Math.trunc((ORBIT_WARP_OUT * left * left) / (ORBIT_WARP_TICKS * ORBIT_WARP_TICKS));
  return { x: pos.x + Math.trunc((dx * out) / len), y: pos.y + Math.trunc((dy * out) / len) };
}

/** The furthest any point that can capture the rocket reaches from planet p's centre, 1/256 px. */
function captureReach(p: Planet): number {
  if (p.kind === ORBIT_EIGHT) return orbitLobes(p) + Math.trunc(orbitExtent(p) / 2) + FP;
  return p.ring + FP;
}

/**
 * True once the free-flying rocket is further from its release point than
 * every planet or hole that could still catch it: a straight flight only gets
 * further from all of them after that, so nothing can catch it any more.
 */
export function orbitPastReach(s: OrbitRev3State): boolean {
  const dist = (x: number, y: number) => isqrt((x - s.releaseX) * (x - s.releaseX) + (y - s.releaseY) * (y - s.releaseY));
  let reach = 0;
  for (let j = s.cur + 1; j <= s.cur + ORBIT_LOOKAHEAD && j < s.planets.length; j++) {
    const p = s.planets[j]!;
    reach = Math.max(reach, dist(p.x, p.y) + captureReach(p));
  }
  for (const h of s.holes ?? []) {
    if (s.swept ? orbitHoleLive(s, h) : h.from === s.cur) reach = Math.max(reach, dist(h.x, h.y) + (s.swept ? ORBIT_HOLE_SWEPT_R : ORBIT_HOLE_R) + FP);
  }
  return dist(s.x, s.y) > reach;
}

/** orbitRev 6 start: the band start plus the tuning marker. */
export function initTunedFrom(planets: Planet[], worldW: number, holes: OrbitHole[]): OrbitRev3State {
  return { ...initBandFrom(planets, worldW, holes), tuned: 1, warp: 0 };
}

/* ================= Tuning F (orbitRev 7, Oct 2026) ================= */
/*
 * The black-hole bug: on orbitRev 4–6 a hole only swallows a flight released
 * from the planet it sits beside (`from`), and only when the rocket's centre
 * point comes within the disc's radius. Every hole on the course is drawn,
 * though, so a flight from the planet before (which often passes straight over
 * the next planet's hole) or one whose drawn rocket overlaps the rim flew
 * through it with nothing happening. And a belt anywhere on the same tick's
 * segment won even when the hole came first along it.
 *
 * orbitRev 7 keeps rev-6 play (courses, holes, fly-in, band curve) and makes
 * holes swept: every hole whose target is ahead of the current planet is live,
 * the rocket is swallowed the moment its drawn body (ORBIT_ROCKET_DIAMETER, the
 * size belts already use) touches the drawn disc anywhere along the tick's
 * swept segment, and a belt only wins when the rocket reaches it first along
 * that segment. The planets between the one left and the target count as
 * reached. States keep `tuned` and add `swept: 1`.
 */
/** Capture reach of a black hole on orbitRev 7: the disc plus the rocket's enclosing radius, 1/256 px. */
export const ORBIT_HOLE_SWEPT_R = ORBIT_HOLE_R + ORBIT_ROCKET_DIAMETER / 2;

/** orbitRev 7: a hole is live while its target is ahead of the planet the rocket left. */
export function orbitHoleLive(s: Pick<OrbitRev3State, "cur">, h: OrbitHole): boolean {
  return h.to > s.cur;
}

/** The first sample (0..steps) at which the swept segment comes within `reach` of the hole's centre, or -1. */
export function orbitHoleK(hole: OrbitHole, x0: number, y0: number, x1: number, y1: number, steps: number, reach = ORBIT_HOLE_SWEPT_R): number {
  for (let k = 0; k <= steps; k++) {
    const dx = x0 + Math.trunc(((x1 - x0) * k) / steps) - hole.x;
    const dy = y0 + Math.trunc(((y1 - y0) * k) / steps) - hole.y;
    if (dx * dx + dy * dy <= reach * reach) return k;
  }
  return -1;
}

/**
 * orbitRev 7's swept test for one flight tick: the earliest belt contact and
 * the earliest live black hole along the segment, sampled every px. A hole
 * wins ties (the rocket touches both at the same point); with several holes
 * the first along the segment wins, then the first in the list.
 */
export function orbitSweptHit(s: OrbitRev3State, x0: number, y0: number, x1: number, y1: number, tick: number): { belt: boolean; hole: OrbitHole | undefined } {
  const steps = orbitSweepSteps(x0, y0, x1, y1);
  let beltK = -1;
  for (const p of s.planets) {
    const k = orbitFlightBeltK(p, x0, y0, x1, y1, tick);
    if (k >= 0 && (beltK < 0 || k < beltK)) beltK = k;
  }
  let holeK = -1;
  let hole: OrbitHole | undefined;
  for (const h of s.holes ?? []) {
    if (!orbitHoleLive(s, h)) continue;
    const k = orbitHoleK(h, x0, y0, x1, y1, steps);
    if (k >= 0 && (holeK < 0 || k < holeK)) {
      holeK = k;
      hole = h;
    }
  }
  if (beltK >= 0 && (holeK < 0 || beltK < holeK)) return { belt: true, hole: undefined };
  return { belt: false, hole };
}

/** orbitRev 7 start: the rev-6 start plus the swept marker. */
export function initSweptFrom(planets: Planet[], worldW: number, holes: OrbitHole[]): OrbitRev3State {
  return { ...initTunedFrom(planets, worldW, holes), swept: 1 };
}

/**
 * orbitRev 8 start (taller worlds, batch 3): the rev-7 start plus the view
 * height. Play is rev 7's tick for tick (no step reads `worldH`; the flight's
 * world bounds are ABOVE_MARGIN / BELOW_MARGIN round the planet, not the view);
 * only the capture-only camera (orbitCamera.ts) frames the course in the
 * taller view, with every extra pixel above the framing line, so more of the
 * course shows ahead. The height is folded into the checkpoint checksum last.
 */
export const ORBIT_TALL_H = 650;
export function initTallFrom(planets: Planet[], worldW: number, holes: OrbitHole[]): OrbitRev3State {
  return { ...initSweptFrom(planets, worldW, holes), worldH: ORBIT_TALL_H };
}
/** orbitRev 9 (scoring targets): orbitRev 8 play, scored on the lifted curve (band 2). */
export function initTargetFrom(planets: Planet[], worldW: number, holes: OrbitHole[]): OrbitRev3State {
  return { ...initTallFrom(planets, worldW, holes), band: BAND_TARGET_MARK };
}

/** orbitRev 10 (score bands): orbitRev 9 play, scored on its strict curve (band 3). */
export function initStrictFrom(planets: Planet[], worldW: number, holes: OrbitHole[]): OrbitRev3State {
  return { ...initTallFrom(planets, worldW, holes), band: BAND_STRICT_MARK };
}

/** The view height (px) a stored round's orbitRev is framed in (620 for every earlier revision). */
export function orbitWorldHFor(rev?: number | null): number {
  if (rev === ORBIT_REV_XP) return ORBIT_XP_VIEW_H;
  return rev === ORBIT_REV_TALL || rev === ORBIT_REV_TARGET || rev === ORBIT_REV_STRICT ? ORBIT_TALL_H : 620;
}

/** The view width (px) a stored round's orbitRev is framed in: orbitRev 12's wider view, 390 on every earlier one. */
export function orbitWorldWFor(rev?: number | null): number {
  return rev === ORBIT_REV_XP ? ORBIT_XP_VIEW_W : 390;
}

/** The start for a stored bank-course orbitRev (4–8), or null for an earlier one. */
export function orbitRev3StartFor(rev: number | null | undefined, extras?: OrbitExtras | null): ((planets: Planet[], worldW: number, holes: OrbitHole[]) => OrbitRev3State) | null {
  if (rev === ORBIT_REV_XP) return (planets, worldW, holes) => initXpFrom(planets, worldW, holes, extras ?? ORBIT_NO_EXTRAS);
  if (rev === ORBIT_REV_STRICT) return initStrictFrom;
  if (rev === ORBIT_REV_TARGET) return initTargetFrom;
  if (rev === ORBIT_REV_TALL) return initTallFrom;
  if (rev === ORBIT_REV_SWEPT) return initSweptFrom;
  if (rev === ORBIT_REV_TUNED) return initTunedFrom;
  if (rev === ORBIT_REV_BAND) return initBandFrom;
  if (rev === ORBIT_REV4) return initRev4From;
  return null;
}
/** The curve new rounds score on: ORBIT_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const ORBIT_V9_BAND_CURVE = bandRetarget(ORBIT_BAND_CURVE);
/** orbitRev 10 (score bands, 19 Oct 2026): the curve new rounds score on, ORBIT_BAND_CURVE's strict curve (band 3). */
export const ORBIT_V10_BAND_CURVE = bandStrict(ORBIT_BAND_CURVE);


/* ================= World expansion (orbitRev 12, 25 Oct 2026) ================= */
/*
 * orbitRev 12 keeps orbitRev 10's proved bank course, its black holes and its base score (the strict curve on
 * planets reached plus up to 10 for reaching the sun quickly, 150 at most), frames it in a bigger 450 × 782 view
 * (orbitCamera.ts), and adds four skill features, placed and proved offline on a witness run
 * (scripts/orbit-xp-lib.ts, src/lib/duel/orbitXpBank.server.ts) and shipped in the puzzle (`extras`):
 *  - stardust trails: motes along a hop's best line; the rocket's body collects one it touches in flight;
 *  - slingshot moons: a small moon beside a hop; a flight that passes through the ring ORBIT_MOON_ASSIST round
 *    its centre and leaves it without touching its body (which crashes like a rock) is boosted to 1.5× speed
 *    for the rest of that flight;
 *  - asteroid fields: a line of rocks across a hop with a gap; rocks crash free flight (as belts do), and a
 *    flight that crosses the gap's line threads the field;
 *  - perfect orbits: a release during the first lap round a planet that lands in the next orbit (or a hole).
 * Only these earn the 50 points above 150 (ORBIT_XP_MAX, the game's round maximum). Integer maths only.
 */
export interface OrbitDust {
  x: number;
  y: number;
}
export interface OrbitMoon {
  x: number;
  y: number;
}
export interface OrbitRock {
  x: number;
  y: number;
  /** Rock radius, 1/256 px (its drawn outline sits inside it). */
  r: number;
}
export interface OrbitField {
  /** The gap's line, end to end (between the two innermost rocks). */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  rocks: OrbitRock[];
}
export interface OrbitExtras {
  dust: OrbitDust[];
  moons: OrbitMoon[];
  fields: OrbitField[];
}
export const ORBIT_NO_EXTRAS: OrbitExtras = { dust: [], moons: [], fields: [] };
/** Compact extras as shipped in the puzzle: motes [x, y], moons [x, y], fields [ax, ay, bx, by, x, y, r, x, y, r…]. */
export interface OrbitExtrasRow {
  d: [number, number][];
  m: [number, number][];
  f: number[][];
}
export function encodeOrbitExtras(e: OrbitExtras): OrbitExtrasRow {
  return {
    d: e.dust.map((m) => [m.x, m.y]),
    m: e.moons.map((m) => [m.x, m.y]),
    f: e.fields.map((f) => [f.ax, f.ay, f.bx, f.by, ...f.rocks.flatMap((r) => [r.x, r.y, r.r])]),
  };
}
export function decodeOrbitExtras(row: OrbitExtrasRow | null | undefined): OrbitExtras {
  if (!row) return ORBIT_NO_EXTRAS;
  return {
    dust: row.d.map(([x, y]) => ({ x, y })),
    moons: row.m.map(([x, y]) => ({ x, y })),
    fields: row.f.map((f) => {
      const rocks: OrbitRock[] = [];
      for (let k = 4; k + 2 < f.length; k += 3) rocks.push({ x: f[k]!, y: f[k + 1]!, r: f[k + 2]! });
      return { ax: f[0]!, ay: f[1]!, bx: f[2]!, by: f[3]!, rocks };
    }),
  };
}

/** The round maximum on orbitRev 12 (src/lib/duel/roundMax.ts says the same; the sim keeps its own copy). */
export const ORBIT_XP_MAX = 200;
export const ORBIT_XP_VIEW_W = 450;
export const ORBIT_XP_VIEW_H = 782;
/** Stardust mote radius; the rocket's body collects it within its own radius plus this. */
export const ORBIT_DUST_R = 4 * FP;
export const ORBIT_DUST_REACH = ORBIT_ROCKET_DIAMETER / 2 + ORBIT_DUST_R;
/** Moon body radius (crashes like a rock) and the slingshot reach from its centre. */
export const ORBIT_MOON_R = 8 * FP;
export const ORBIT_MOON_CRASH = ORBIT_ROCKET_DIAMETER / 2 + ORBIT_MOON_R;
export const ORBIT_MOON_ASSIST = 44 * FP;
/** Slingshot boost: the flight's speed × 3 / 2. */
export const ORBIT_SLING_NUM = 3;
export const ORBIT_SLING_DEN = 2;
/** Feature points (orbitRev 12): 1 per 2 motes (15), 4 per slingshot (16), 4 per field threaded (12), 1 per 3 perfect orbits (7). */
export const ORBIT_XP_DUST_CAP = 15;
export const ORBIT_XP_SLING_PTS = 4;
export const ORBIT_XP_SLING_CAP = 16;
export const ORBIT_XP_THREAD_PTS = 4;
export const ORBIT_XP_THREAD_CAP = 12;
export const ORBIT_XP_PERFECT_PER = 3;
export const ORBIT_XP_PERFECT_CAP = 7;
/**
 * The features every orbitRev 12 course carries (the feature bank, scripts/orbit-xp-lib.ts, places exactly these
 * many on every course and proves each one on a witness run): the seed decides where, never how many.
 */
export const ORBIT_XP_TRAILS = 5;
export const ORBIT_XP_MOTES = 6;
export const ORBIT_XP_MOONS = 4;
export const ORBIT_XP_FIELDS = 3;
/**
 * orbitRev 12's base curve: orbitRev 10's strict curve (ORBIT_V10_BAND_CURVE) from 12 planets up, with a knot at 4
 * planets (32) so the first hops, now among rocks and moons, count a little more (fitted on the skill-band bots:
 * docs/expansions/x200-orbit.md). 140 for the sun.
 */
export const ORBIT_V12_BAND_CURVE = bandCurve([0, 4, 12, 20, 30, 36, 40], [0, 32, 74, 100, 117, 139, 140]);
/** The most the features' raw points (orbitXpFeaturePoints, each part capped) can pay: the round maximum's extra 50. */
export const ORBIT_V12_SKILL_MAX = 50;
/**
 * orbitRev 12's skill pay: the features' raw points (0–50) paid on a rising scale, so the odd mote and moon pay
 * little and the full 50 needs every feature taken: 20 pay 14, 30 pay 28, 40 pay 36, 45 pay 46, 50 pay 50.
 */
export const ORBIT_V12_SKILL_PAY = bandCurve([0, 20, 30, 40, 45, 50], [0, 14, 28, 36, 46, ORBIT_V12_SKILL_MAX]);
/**
 * Elite pace: skill pays at most ORBIT_V12_SKILL_PACED_FROM (40) unless the sun is reached quickly; the last 10 come
 * in a share from 10 s left (ORBIT_V12_PACE_FROM ticks) to the full 10 with 40 s left (ORBIT_V12_PACE_FULL ticks),
 * which every course's witness run beats.
 */
export const ORBIT_V12_SKILL_PACED_FROM = 40;
export const ORBIT_V12_PACE_FROM = 10 * 60;
export const ORBIT_V12_PACE_FULL = 40 * 60;

/** First sample (0..steps) at which the segment comes within `reach` of (cx, cy), or -1. */
function xpCircleK(cx: number, cy: number, reach: number, x0: number, y0: number, x1: number, y1: number, steps: number): number {
  if (cx < Math.min(x0, x1) - reach || cx > Math.max(x0, x1) + reach || cy < Math.min(y0, y1) - reach || cy > Math.max(y0, y1) + reach) return -1;
  for (let k = 0; k <= steps; k++) {
    const dx = x0 + Math.trunc(((x1 - x0) * k) / steps) - cx;
    const dy = y0 + Math.trunc(((y1 - y0) * k) / steps) - cy;
    if (dx * dx + dy * dy <= reach * reach) return k;
  }
  return -1;
}

const xpSign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
/** Side of (rx, ry) from the line p → q (sign only), in 1/16 px units. */
function xpOrient(px: number, py: number, qx: number, qy: number, rx: number, ry: number): number {
  const a = Math.trunc((qx - px) / 16), b = Math.trunc((ry - py) / 16), c = Math.trunc((qy - py) / 16), d = Math.trunc((rx - px) / 16);
  return xpSign(a * b - c * d);
}
/** Does the flight segment cross the field's gap line? */
export function orbitCrossesGap(f: OrbitField, x0: number, y0: number, x1: number, y1: number): boolean {
  const s0 = xpOrient(f.ax, f.ay, f.bx, f.by, x0, y0);
  const s1 = xpOrient(f.ax, f.ay, f.bx, f.by, x1, y1);
  if (s0 * s1 > 0 || (s0 === 0 && s1 === 0)) return false;
  return xpOrient(x0, y0, x1, y1, f.ax, f.ay) * xpOrient(x0, y0, x1, y1, f.bx, f.by) <= 0;
}

export interface OrbitXpHit {
  /** First sample that touches a rock or a moon's body, or -1. */
  crashK: number;
  /** Bits: motes touched, fields threaded. */
  dust: number;
  fields: number;
  /** Bits: moons whose slingshot ring holds the segment's end. */
  ring: number;
}

/** orbitRev 12's features against one flight tick's swept segment (sampled every px, as belts and holes are). */
export function orbitXpSweep(s: Pick<OrbitRev3State, "dust" | "moons" | "fields" | "dustGot" | "threaded">, x0: number, y0: number, x1: number, y1: number): OrbitXpHit {
  const steps = orbitSweepSteps(x0, y0, x1, y1);
  let crashK = -1;
  const crash = (k: number) => {
    if (k >= 0 && (crashK < 0 || k < crashK)) crashK = k;
  };
  let ring = 0;
  (s.moons ?? []).forEach((m, i) => {
    crash(xpCircleK(m.x, m.y, ORBIT_MOON_CRASH, x0, y0, x1, y1, steps));
    if ((x1 - m.x) ** 2 + (y1 - m.y) ** 2 <= ORBIT_MOON_ASSIST * ORBIT_MOON_ASSIST) ring |= 1 << i;
  });
  let fields = 0;
  (s.fields ?? []).forEach((f, i) => {
    for (const r of f.rocks) crash(xpCircleK(r.x, r.y, r.r + ORBIT_ROCKET_DIAMETER / 2, x0, y0, x1, y1, steps));
    if (!((s.threaded ?? 0) & (1 << i)) && orbitCrossesGap(f, x0, y0, x1, y1)) fields |= 1 << i;
  });
  let dust = 0;
  (s.dust ?? []).forEach((m, i) => {
    if (!((s.dustGot ?? 0) & (1 << i)) && xpCircleK(m.x, m.y, ORBIT_DUST_REACH, x0, y0, x1, y1, steps) >= 0) dust |= 1 << i;
  });
  return { crashK, dust, fields, ring };
}

const bitCount = (bits: number) => {
  let n = 0;
  for (let b = bits; b; b &= b - 1) n++;
  return n;
};

/**
 * orbitRev 12's partial credit: a flight from the furthest planet reached (`best`) counts how far along the line
 * from that planet's centre to the next one's it has got (the rocket's position projected on it), in sixteenths,
 * at most 15: an early crash still scores for the distance it flew. Integer maths; reset when `best` moves on.
 */
export function orbitXpReach(s: OrbitRev3State): void {
  if (s.cur !== s.best || s.cur >= ORBIT_TOTAL) return;
  const a = s.planets[s.cur]!, b = s.planets[s.cur + 1]!;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) return;
  const along = (s.x - a.x) * dx + (s.y - a.y) * dy;
  const sixteenths = Math.max(0, Math.min(15, Math.trunc((along * 16) / len2)));
  if (sixteenths > (s.reach ?? 0)) s.reach = sixteenths;
}

/** What a run has taken of orbitRev 12's features (zeros on every earlier round). */
export function orbitXpCounts(s: OrbitRev3State) {
  return {
    dust: bitCount(s.dustGot ?? 0),
    dustTotal: s.dust?.length ?? 0,
    slings: bitCount(s.slung ?? 0),
    slingsTotal: s.moons?.length ?? 0,
    threads: bitCount(s.threaded ?? 0),
    threadsTotal: s.fields?.length ?? 0,
    perfect: s.perfect ?? 0,
  };
}

/** orbitRev 12's feature points, each part capped; 50 at most. */
export function orbitXpFeaturePoints(s: OrbitRev3State): { dust: number; slings: number; threads: number; perfect: number; total: number } {
  const c = orbitXpCounts(s);
  const dust = Math.min(ORBIT_XP_DUST_CAP, Math.trunc(c.dust / 2));
  const slings = Math.min(ORBIT_XP_SLING_CAP, ORBIT_XP_SLING_PTS * c.slings);
  const threads = Math.min(ORBIT_XP_THREAD_CAP, ORBIT_XP_THREAD_PTS * c.threads);
  const perfect = Math.min(ORBIT_XP_PERFECT_CAP, Math.trunc(c.perfect / ORBIT_XP_PERFECT_PER));
  return { dust, slings, threads, perfect, total: dust + slings + threads + perfect };
}

/** orbitRev 12's breakdown: orbitRev 10's base (curve points and the sun's speed bonus) plus the feature points. */
/** orbitRev 12's skill cap: 40, plus up to 10 for reaching the sun at elite pace (ORBIT_V12_PACE_FROM → _FULL ticks left). */
export function orbitXpSkillCap(state: OrbitRev3State): number {
  if (!state.finished) return ORBIT_V12_SKILL_PACED_FROM;
  const left = ORBIT_REV3_RUN_TICKS - clampInt(state.endedTick, 0, ORBIT_REV3_RUN_TICKS);
  const span = ORBIT_V12_PACE_FULL - ORBIT_V12_PACE_FROM;
  const share = clampInt(left - ORBIT_V12_PACE_FROM, 0, span);
  return ORBIT_V12_SKILL_PACED_FROM + Math.trunc(((ORBIT_V12_SKILL_MAX - ORBIT_V12_SKILL_PACED_FROM) * share) / span);
}

/** orbitRev 12's skill pay: the features' raw points (0–50) on ORBIT_V12_SKILL_PAY, capped by the pace (orbitXpSkillCap). */
export function orbitXpSkillPaid(state: OrbitRev3State): number {
  return Math.min(bandPoints(ORBIT_V12_SKILL_PAY, orbitXpFeaturePoints(state).total), orbitXpSkillCap(state));
}

/**
 * orbitRev 12's base points: ORBIT_V12_BAND_CURVE on the planets reached, plus the share of the next planet's step
 * the furthest flight from the last one covered (`reach`, sixteenths): an early crash still scores. The sun: 140.
 */
export function orbitXpBasePoints(state: OrbitRev3State): number {
  if (state.finished) return bandPoints(ORBIT_V12_BAND_CURVE, ORBIT_TOTAL);
  const best = clampInt(state.best, 0, ORBIT_TOTAL);
  const here = bandPoints(ORBIT_V12_BAND_CURVE, best);
  if (best >= ORBIT_TOTAL) return here;
  const next = bandPoints(ORBIT_V12_BAND_CURVE, best + 1);
  return here + Math.trunc(((next - here) * clampInt(state.reach ?? 0, 0, 15)) / 16);
}

function orbitXpParts(state: OrbitRev3State): BandParts {
  const finished = Boolean(state.finished);
  const units = finished ? ORBIT_TOTAL : clampInt(state.best, 0, ORBIT_TOTAL);
  const speed = finished ? speedBonusCurve(BAND_FINISH_BONUS, ORBIT_REV3_RUN_TICKS - clampInt(state.endedTick, 0, ORBIT_REV3_RUN_TICKS), ORBIT_REV3_RUN_TICKS) : 0;
  const f = orbitXpFeaturePoints(state);
  const paid = orbitXpSkillPaid(state);
  const c = orbitXpCounts(state);
  const reach = finished || units >= ORBIT_TOTAL ? 0 : clampInt(state.reach ?? 0, 0, 15);
  return {
    units,
    points: orbitXpBasePoints(state),
    bonus: speed + paid,
    penalty: 0,
    finished,
    text: `${finished ? "Sun reached" : `${units} / ${ORBIT_TOTAL} planets${reach ? ` and ${reach}/16 of the next` : ""}`} · ${c.dust} dust · ${c.slings} slingshot${c.slings === 1 ? "" : "s"} · ${c.threads} threaded · ${c.perfect} perfect`,
    bonusText: `${finished ? `Sun reached (${speed}), ` : ""}skill ${paid} (stardust ${f.dust}, slingshots ${f.slings}, fields ${f.threads}, perfect orbits ${f.perfect}: ${f.total} of ${ORBIT_V12_SKILL_MAX}${paid < bandPoints(ORBIT_V12_SKILL_PAY, f.total) ? `, at most ${orbitXpSkillCap(state)} at this pace` : ""})`,
  };
}

/** orbitRev 12 start: the orbitRev 10 start (strict band) in the bigger view, with the course's features. */
export function initXpFrom(planets: Planet[], worldW: number, holes: OrbitHole[], extras: OrbitExtras): OrbitRev3State {
  return {
    ...initTallFrom(planets, worldW, holes),
    band: BAND_STRICT_MARK,
    worldH: ORBIT_XP_VIEW_H,
    xp: 1,
    viewW: ORBIT_XP_VIEW_W,
    dust: extras.dust,
    moons: extras.moons,
    fields: extras.fields,
    dustGot: 0,
    slung: 0,
    threaded: 0,
    perfect: 0,
    lapLeft: lapPhases(planets[0]!).length,
    arm: 0,
    boost: 0,
    moonIn: 0,
    reach: 0,
  };
}

/** A stored round's start from its puzzle fields (every bank-course revision, 4–12), or null for rev 3 and earlier. */
export function orbitStartForPuzzle(p: { orbitRev?: number | undefined; planets?: OrbitRev3CompactPlanet[] | undefined; holes?: OrbitHoleRow[] | undefined; extras?: OrbitExtrasRow | undefined }): (() => OrbitRev3State) | null {
  const start = orbitRev3StartFor(p.orbitRev, p.orbitRev === ORBIT_REV_XP ? decodeOrbitExtras(p.extras) : null);
  if (!start || !p.planets || p.planets.length === 0) return null;
  const planets = decodeRev3Planets(p.planets);
  const holes = decodeOrbitHoles(p.holes ?? []);
  return () => start(planets, ORBIT_REV3_WORLD_W, holes);
}
