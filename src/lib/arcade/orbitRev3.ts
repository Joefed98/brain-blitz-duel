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
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";
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
  return state.ended === 0 && state.flying === 0 && state.checkpoint < 0 && state.respawns > 0;
}

function stepRev3(state: OrbitRev3State, worldW: number, input: ArcadeInputEvent | null): OrbitRev3State {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: OrbitRev3State = { ...state, tick };
  const here = s.planets[s.cur]!;
  if (input?.k === ORBIT_INPUT_CHECKPOINT && orbitRev3CanSetCheckpoint(s)) s.checkpoint = s.cur;
  let respawned = false;
  const die = () => {
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
      respawned = true;
      return;
    }
    s.ended = 2;
    s.endedTick = tick;
  };
  if (s.flying === 0) {
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
    } else {
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
    if (flightHitsBelts(s.planets, previousX, previousY, s.x, s.y, tick)) {
      die();
      if (respawned) {
        const checkpointPlanet = s.planets[s.cur];
        if (checkpointPlanet) s.camY = checkpointPlanet.y - VIEW_ANCHOR;
      }
      if (s.ended || respawned) return s;
    }
    // Rev 4: a black hole beside the planet just left swallows the rocket and puts it in
    // orbit round planet `to`; the planets in between count as reached.
    const hole = s.holes ? s.holes.find((h) => h.from === s.cur && orbitFlightHitsHole(h, previousX, previousY, s.x, s.y)) : undefined;
    const j = hole ? -1 : captureAt(s.planets, s.cur, s.x, s.y);
    if (hole) {
      const to = s.planets[hole.to]!;
      s.skipped = (s.skipped ?? 0) + (hole.to - hole.from - 1);
      s.jumps = (s.jumps ?? 0) + 1;
      s.holeTick = tick;
      s.cur = hole.to;
      s.angle = 3 * ANG_QUARTER;
      const pos = orbitPos(to, s.angle);
      s.x = pos.x;
      s.y = pos.y;
      s.vx = 0;
      s.vy = 0;
      s.flying = 0;
      s.captured += 1;
      if (hole.to > s.best) s.best = hole.to;
    } else if (j >= 0) {
      const to = s.planets[j]!;
      s.cur = j;
      s.angle = phaseAt(to, s.x, s.y);
      const pos = orbitPos(to, s.angle);
      s.x = pos.x;
      s.y = pos.y;
      s.flying = 0;
      s.captured += 1;
      if (j > s.best) s.best = j;
      if (j >= ORBIT_TOTAL) {
        s.ended = 1;
        s.endedTick = tick;
        s.finished = 1;
      }
    } else if (outsideWorld(worldW, here, s.x, s.y) || s.flying >= FLIGHT_MAX) die();
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
  const finished = Boolean(state.finished);
  const units = finished ? ORBIT_TOTAL : clampInt(state.best, 0, ORBIT_TOTAL);
  return {
    units,
    points: bandPoints(ORBIT_BAND_CURVE, units),
    bonus: finished ? speedBonusCurve(BAND_FINISH_BONUS, ORBIT_REV3_RUN_TICKS - clampInt(state.endedTick, 0, ORBIT_REV3_RUN_TICKS), ORBIT_REV3_RUN_TICKS) : 0,
    penalty: 0,
    finished,
    text: finished ? "Sun reached" : `${units} / ${ORBIT_TOTAL} planets`,
    bonusText: "Sun reached",
  };
}

function scoreBand(state: OrbitRev3State): number {
  return bandTotal(orbitBandParts(state), Boolean(state.acted));
}
