/**
 * Orbit's orbitRev 17 courses and their human-limited proof (D5, 23 Nov 2026; docs/arcade-standard/orbit.md
 * "orbitRev 17: lines, belts and levels"; offline, used by scripts/orbit-ladder-bank.ts and orbit-ladder-check).
 *
 * The same three steps as the fuel bank (scripts/orbit-fuel-lib.ts, which stays as it is for orbitRev 14–16's banks),
 * each run on the real sim (orbitRev3Game.step) on forked states, with two changes:
 *  1. the course's belts follow the level's lever (LADDER_COURSES): Normal's as orbitRev 16 (from planet 31, about half
 *     of them), Easy none at all, Hard a belt round every fourth planet from the second, Expert round every third from
 *     the first (the spec's every second and every planet left too few hops open, see LADDER_COURSES); each hop placed
 *     only when a window of the level's width (two laps running, at the course's minEpochs of the belt's phases) lands
 *     on the next planet within the proved hop's fuel;
 *  2. the witness is held to the human limits (HUMAN_LIMITS: 0.25 s to react, 0.15 s to move): every release comes at
 *     least ORBIT_HUMAN_READY_TICKS after the rocket settles into its orbit (the new orbit and the planet ahead seen, then
 *     the finger moved), taken at the middle of a window of at least the level's width (a black hole's at least
 *     ORBIT_HUMAN_HOLE_WINDOW), the features laid on those releases' own flights. The course is kept only when that
 *     witness reaches the sun with every mote, slingshot and field, at least the level's LADDER_BUILD_NEED in pace and
 *     perfect orbits (Normal and Easy: ORBIT_V17_LINES, Normal's lines), every flight landing with a quarter of the tank
 *     to spare, and the server's replay on orbitRev 17 at the level agrees with the sim; the bank keeps each witness's
 *     pace and perfect orbits, and a level's lines are never above its bank's least (scripts/orbit-ladder-bank.ts
 *     --prove, orbit-ladder-check: every witness 200 on the level's lines through the server).
 * Salted retries until a course passes. Deterministic: a seed always gives the same course.
 */
import { clampInt, rngBelow, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  FP,
  inside,
  innerLobe,
  lapPhases,
  orbitBeltRadius,
  orbitCheckpoint,
  orbitExtent,
  orbitPos,
  planetShape,
  releaseVel,
  flightHitsBelts,
  ORBIT_BELT_PERIOD_TICKS,
  ORBIT_CIRCLE,
  ORBIT_EIGHT,
  ORBIT_EIGHT_FROM,
  ORBIT_ELLIPSE,
  ORBIT_ELLIPSE_FROM,
  ORBIT_HAZARD_FROM,
  ORBIT_INPUT_TAP,
  ORBIT_REV_LOST,
  ORBIT_TOTAL,
  type Planet,
} from "../src/lib/arcade/orbit";
import {
  encodeOrbitExtras,
  encodeOrbitHoles,
  encodeRev3Planets,
  initFuelFrom,
  initLostFrom,
  orbitCaptureAny,
  orbitRev3Game,
  orbitXpCounts,
  ORBIT_FUEL_HOP_MAX,
  ORBIT_FUEL_MAX,
  ORBIT_HOLE_R,
  ORBIT_LEVEL_RULES,
  ORBIT_REV3_FLIGHT_MAX,
  ORBIT_REV3_RUN_TICKS,
  ORBIT_REV3_WORLD_W,
  ORBIT_V17_LINES,
  ORBIT_XP_FIELDS,
  ORBIT_XP_MOONS,
  ORBIT_XP_MOTES,
  ORBIT_XP_TRAILS,
  type OrbitExtras,
  type OrbitField,
  type OrbitHole,
  type OrbitLevelName,
  type OrbitLines,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import { encodeOrbitRun } from "../src/lib/duel/orbit";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { buildHoles, holeDelays, holeFailure, holeFork, HOLE_FROM, type HoleWalk } from "./orbit-hole-lib";
import { HUMAN_LIMITS } from "./arcade-skill-bands/human";

const TICK_MS = 1000 / 60;
/** A release no sooner than this after the rocket settles in its orbit: 0.25 s to see it and 0.15 s to move (24 ticks). */
export const ORBIT_HUMAN_READY_TICKS = Math.round(HUMAN_LIMITS.reactMs / TICK_MS) + Math.round(HUMAN_LIMITS.moveMs / TICK_MS);
/** The narrowest black-hole window the human witness goes for (release ticks in a row); a narrower one it flies past. */
export const ORBIT_HUMAN_HOLE_WINDOW = 3;

/** A level's course: the zigzag (as orbitRev 16's), the belt rule (the lever), the black holes, the tank and the window. */
export interface LadderCourse {
  latMin: number;
  latMax: number;
  liftMin: number;
  liftSpan: number;
  holeFrom: readonly number[];
  /** "normal": orbitRev 16's (from ORBIT_HAZARD_FROM, about half); "none"; or a belt round every `every`-th planet from `from` (0-based; 0 is the start). */
  belts: "normal" | "none" | { from: number; every: number };
  tank: number;
  hopMax: number;
  /** Release ticks in a row (two laps running) a hop is built with and the witness flies (the level's narrowest). */
  window: number;
  /**
   * Of the belt's 24 phases a hop is tried at (every 30 ticks of its 12 s turn), how many must have such a window, where
   * the hop's flights cross a belt: 1 (any) as orbitRev 16's banks; more makes the hop open at most moments, so a player
   * arriving at any time (the witness included) finds it within a lap or two.
   */
  minEpochs: number;
}
/** The black holes' planets for "holes from planet N" (1-based), as orbit-fuel-bank.ts holePlanets. */
const holePlanets = (n: number) => [n - 1, n + 9, n + 18].filter((p) => p <= 33);
/**
 * orbitRev 17's courses (the spec's lever, docs/polish-plan-final/difficulty-spec.md "### Orbit"): the zigzag, holes and
 * tanks are orbitRev 16's at each level; the belts move (Easy none, Hard a belt round every fourth planet from the
 * second, Expert round every third from the first: the spec's every second and every planet left too few hops open for
 * a person to reach the sun, see orbit.md) and Expert's narrowest window is 3 ticks (orbitRev 16: 2); a belted hop on
 * Hard and Expert is open at half the belt's phases or more.
 */
export const LADDER_COURSES: Readonly<Record<"normal" | OrbitLevelName, LadderCourse>> = {
  normal: { latMin: 60, latMax: 220, liftMin: 150, liftSpan: 80, holeFrom: HOLE_FROM, belts: "normal", tank: ORBIT_FUEL_MAX, hopMax: ORBIT_FUEL_HOP_MAX, window: 4, minEpochs: 1 },
  easy: { latMin: 30, latMax: 150, liftMin: 130, liftSpan: 70, holeFrom: holePlanets(25), belts: "none", tank: ORBIT_LEVEL_RULES.easy.tank, hopMax: 120, window: 4, minEpochs: 1 },
  hard: { latMin: 110, latMax: 270, liftMin: 170, liftSpan: 80, holeFrom: holePlanets(15), belts: { from: 1, every: 4 }, tank: ORBIT_LEVEL_RULES.hard.tank, hopMax: 105, window: 3, minEpochs: 12 },
  expert: { latMin: 140, latMax: 300, liftMin: 190, liftSpan: 80, holeFrom: holePlanets(11), belts: { from: 0, every: 3 }, tank: ORBIT_LEVEL_RULES.expert.tank, hopMax: 90, window: 3, minEpochs: 12 },
};
/**
 * What a kept course's witness must reach (pace: ticks left at the sun; perfect orbits): Normal's lines on Normal and
 * Easy; Hard and Expert only the sun with every feature (their lines are set from the bank, never above its least).
 */
export const LADDER_BUILD_NEED: Readonly<Record<"normal" | OrbitLevelName, { left: number; perfect: number }>> = {
  normal: { left: ORBIT_V17_LINES.speedFullLeft, perfect: ORBIT_V17_LINES.perfectFull },
  easy: { left: ORBIT_V17_LINES.speedFullLeft, perfect: ORBIT_V17_LINES.perfectFull },
  hard: { left: 1, perfect: 0 },
  expert: { left: 1, perfect: 0 },
};

/** Does planet i (0-based) carry a belt on this course rule? (`draw` only when the rule leaves it to chance.) */
function belted(rule: LadderCourse["belts"], i: number, draw: (n: number) => number): boolean {
  if (i >= ORBIT_TOTAL) return false;
  if (rule === "none") return false;
  if (rule === "normal") return i >= ORBIT_HAZARD_FROM && draw(2) === 1;
  return i >= rule.from && (i - rule.from) % rule.every === 0;
}

const step = (s: OrbitRev3State, input: ArcadeInputEvent | null) => orbitRev3Game.step(s, input);
const tapAt = (t: number): ArcadeInputEvent => ({ t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });

/* ------------------------------------------- The course ------------------------------------------- */

/** Within this of a belted planet's belt ring a flight can be met by the belt (at some phase of its turn). */
const BELT_NEAR = 24 * FP;
/** Hop results: lands on planet i + 1, and whether the flight passed near any belt (so its outcome can depend on the belt's phase). */
let hopNearBelt = false;
/** One release from planet i (no holes or features yet): does it land on planet i + 1 within the hop's fuel? (Sets hopNearBelt.) */
function hopOk(c: LadderCourse, planets: readonly Planet[], i: number, angle: number, releaseTick: number): boolean {
  hopNearBelt = false;
  const from = planets[i]!;
  if (innerLobe(from, angle)) return false;
  let { x, y } = orbitPos(from, angle);
  const { vx, vy } = releaseVel(from, angle);
  for (let t = 1; t <= c.hopMax; t++) {
    const px = x, py = y;
    x += vx;
    y += vy;
    if (!hopNearBelt) {
      for (const p of planets) {
        if (p.hazard < 0) continue;
        const d = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
        if (Math.abs(d - orbitBeltRadius(p)) < BELT_NEAR) {
          hopNearBelt = true;
          break;
        }
      }
    }
    if (flightHitsBelts(planets, px, py, x, y, releaseTick + t)) {
      hopNearBelt = true;
      return false;
    }
    const j = orbitCaptureAny(planets, i, x, y);
    if (j < 0) continue;
    return j === i + 1;
  }
  return false;
}

/**
 * A window of the course's width landing on planet i + 1, on two laps running, at `c.minEpochs` of the belt's phases
 * (tried every 30 ticks of its turn) where belts move; a window none of whose flights pass near a belt is open at every
 * phase. `onlyEpoch0`: the first phase alone (a measure).
 */
export function ladderHopWindow(c: LadderCourse, planets: readonly Planet[], i: number, onlyEpoch0 = false): boolean {
  const from = planets[i]!;
  const phases = lapPhases(from);
  const lap = phases.length;
  const moving = planets.some((p) => p.hazard >= 0);
  const epochs = moving && !onlyEpoch0 ? Array.from({ length: Math.ceil(ORBIT_BELT_PERIOD_TICKS / 30) }, (_, k) => k * 30) : [0];
  const need = onlyEpoch0 ? 1 : Math.min(c.minEpochs, epochs.length);
  let open = 0;
  for (const epoch of epochs) {
    const ok: boolean[] = [];
    const near: boolean[] = [];
    for (let k = 0; k < lap; k++) {
      ok.push(hopOk(c, planets, i, phases[k]!, epoch + k));
      near.push(hopNearBelt);
    }
    for (let start = 0; start < lap; start++) {
      let len = 0;
      while (len < lap && ok[(start + len) % lap]) len++;
      if (len < c.window) continue;
      let again = true;
      let anyNear = false;
      for (let off = 0; off < c.window && again; off++) {
        const k = (start + off) % lap;
        anyNear ||= near[k]!;
        again = hopOk(c, planets, i, phases[k]!, epoch + lap + k);
        anyNear ||= hopNearBelt;
      }
      if (!again) continue;
      // Clear of every belt: open whatever the belts' phase.
      if (!anyNear) return true;
      open++;
      break;
    }
    if (open >= need) return true;
  }
  return false;
}

/** No release from planet k, at any phase, flies on a full tank into planet i when i is three or more on (orbit-fuel-lib's noFarCatch). */
function noFarCatch(c: LadderCourse, planets: readonly Planet[], i: number): boolean {
  for (let k = Math.max(0, i - 6); k <= i - 3; k++) {
    const from = planets[k]!;
    for (const phase of lapPhases(from)) {
      if (innerLobe(from, phase)) continue;
      let { x, y } = orbitPos(from, phase);
      const { vx, vy } = releaseVel(from, phase);
      for (let t = 1; t < c.tank; t++) {
        x += vx;
        y += vy;
        const j = orbitCaptureAny(planets, k, x, y);
        if (j < 0) continue;
        if (j === i) return false;
        break;
      }
    }
  }
  return true;
}

const MAX_RETRIES = 20;
const FALLBACK_LATERAL = [180, 140, 110, 80];
const ZIG = { turnMin: 1, turnSpan: 2, retries: 10 };

/** The zigzag planets for one (salted) seed on a course rule; throws when a hop has no window. */
export function buildLadderRaw(c: LadderCourse, seed: number, worldW = ORBIT_REV3_WORLD_W): Planet[] {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const first = planetShape(0);
  const startDir = draw(2) ? 1 : -1;
  const planets: Planet[] = [{ x: Math.trunc(worldW / 2) * FP, y: 0, ...first, dir: startDir, hazard: belted(c.belts, 0, draw) ? draw(64) * 1024 : -1, colour: 0, kind: ORBIT_CIRCLE, rot: 0 }];
  let zig = { dir: draw(2) ? 1 : -1, streak: 0, turnLen: ZIG.turnMin + draw(ZIG.turnSpan) };
  for (let i = 1; i <= ORBIT_TOTAL; i++) {
    const prev = planets[i - 1]!;
    const shape = planetShape(i);
    let placed = false;
    for (let attempt = 0; attempt < MAX_RETRIES && !placed; attempt++) {
      const roll = draw(12);
      const kind = i === ORBIT_TOTAL ? ORBIT_CIRCLE : i >= ORBIT_EIGHT_FROM && roll < 3 ? ORBIT_EIGHT : i >= ORBIT_ELLIPSE_FROM && roll < 7 && roll >= 3 ? ORBIT_ELLIPSE : ORBIT_CIRCLE;
      const rot = kind === ORBIT_ELLIPSE ? draw(16) * 4096 : 0;
      const extent = orbitExtent({ kind, ring: shape.ring });
      const lo = extent + 8 * FP;
      const hi = worldW * FP - extent - 8 * FP;
      if (zig.streak >= zig.turnLen) zig = { dir: -zig.dir, streak: 0, turnLen: ZIG.turnMin + draw(ZIG.turnSpan) };
      const lateral = (c.latMin + draw(c.latMax - c.latMin + 1)) * FP;
      let x = prev.x + zig.dir * lateral;
      if (x < lo || x > hi) {
        zig = { dir: -zig.dir, streak: 0, turnLen: ZIG.turnMin + draw(ZIG.turnSpan) };
        x = clampInt(prev.x + zig.dir * lateral, lo, hi);
      }
      zig.streak += 1;
      const y = prev.y - Math.trunc(((c.liftMin + draw(c.liftSpan + 1)) * 115) / 100) * FP;
      const dx = x - prev.x;
      const dy = y - prev.y;
      const min = orbitExtent(prev) + extent + 24 * FP;
      if (dx * dx + dy * dy < min * min) continue;
      const hazard = belted(c.belts, i, draw) ? draw(64) * 1024 : -1;
      const spin = draw(2) ? 1 : -1;
      planets.push({ x, y, ...shape, dir: kind === ORBIT_EIGHT ? -1 : spin, hazard, colour: i % 4, kind, rot });
      if (ladderHopWindow(c, planets, i - 1) && (attempt >= ZIG.retries || noFarCatch(c, planets, i))) placed = true;
      else planets.pop();
    }
    if (!placed) {
      // Fallback (as the fuel bank's): a circle on the zigzag's side, the sideways step and the lift shortened until a
      // window proves; the belt rule kept (a belted planet keeps its belt).
      const lo = shape.ring + 8 * FP;
      const hi = worldW * FP - shape.ring - 8 * FP;
      const dir = draw(2) ? 1 : -1;
      const hazard = belted(c.belts, i, draw) ? draw(64) * 1024 : -1;
      search: for (const lateral of FALLBACK_LATERAL) {
        for (const lift of [200, 230, 264, 300]) {
          let x = prev.x + zig.dir * lateral * FP;
          if (x < lo || x > hi) x = clampInt(prev.x - zig.dir * lateral * FP, lo, hi);
          planets.push({ x, y: prev.y - lift * FP, ...shape, dir, hazard, colour: i % 4, kind: ORBIT_CIRCLE, rot: 0 });
          if (ladderHopWindow(c, planets, i - 1)) {
            placed = true;
            break search;
          }
          planets.pop();
        }
      }
      if (placed) zig.streak += 1;
    }
    if (!placed) throw new Error(`hop ${i} has no window`);
  }
  return planets;
}

/* ------------------------------------------- The human witness ------------------------------------------- */

type Kind = "hop" | "skip" | "hole" | "die";
interface Fork {
  kind: Kind;
  path: [number, number][];
  end: OrbitRev3State;
}
/**
 * Wait d ticks in orbit, tap, follow the flight to its end (orbit-xp-lib's xpFork). A flight to the next planet longer
 * than `hopMax` ticks reads as a "skip" (taken only when no proper hop comes round: it lands short of fuel).
 */
function fork(from: OrbitRev3State, d: number, hopMax = Infinity): Fork {
  let s = from;
  for (let k = 0; k < d; k++) s = step(s, null);
  s = step(s, tapAt(s.tick + 1));
  const path: [number, number][] = [[s.x, s.y]];
  let guard = 0;
  while (s.flying > 0 && s.ended === 0 && guard++ < ORBIT_REV3_FLIGHT_MAX + 5) {
    s = step(s, null);
    path.push([s.x, s.y]);
  }
  const kind: Kind = (s.jumps ?? 0) > (from.jumps ?? 0) ? "hole"
    : s.ended === 2 || s.respawns < from.respawns || (s.autoRespawns ?? 0) > (from.autoRespawns ?? 0) ? "die"
    : s.cur === from.cur + 1 && path.length - 1 <= hopMax ? "hop"
    : s.cur > from.cur || s.finished === 1 ? "skip" : "die";
  return { kind, path, end: s };
}

function windows(kinds: Kind[], want: (k: Kind) => boolean, from: number): [number, number][] {
  const out: [number, number][] = [];
  let i = from;
  while (i < kinds.length) {
    if (!want(kinds[i]!)) {
      i++;
      continue;
    }
    let j = i;
    while (j < kinds.length && want(kinds[j]!)) j++;
    out.push([i, j - i]);
    i = j;
  }
  return out;
}

/**
 * The human witness's release from an orbiting state `s` (settled in this orbit at tick `settled`): a delay no sooner
 * than ORBIT_HUMAN_READY_TICKS after settling, at the middle of a window (cut at that moment) of at least the course's
 * width (a black hole's at least ORBIT_HUMAN_HOLE_WINDOW: else the plain hop); a window in the first lap (a perfect
 * orbit) first, the longest or the earliest. Null when none comes round.
 */
export function humanDelay(c: LadderCourse, s: OrbitRev3State, settled: number, earliest = false): { d: number; kind: Kind } | null {
  const lap = lapPhases(s.planets[s.cur]!).length;
  const ready = Math.max(0, settled + ORBIT_HUMAN_READY_TICKS - (s.tick + 1));
  const hole = (s.holes ?? []).some((h) => h.from === s.cur && h.to > s.cur);
  // kinds[d]: what a release after waiting d ticks does (fork(s, d)), filled in order from a state stepped on as it goes.
  const kinds: Kind[] = [];
  let base = s;
  for (const long of [false, true]) {
    const limit = (long ? Math.max(lap * 2, 720) : lap * 2) + ready;
    while (kinds.length <= limit) {
      kinds.push(fork(base, 0, c.hopMax).kind);
      base = step(base, null);
    }
    // A black hole (when one is beside this planet), then a plain hop to the next planet, then (only failing that) a
    // window that lands on any planet ahead (a hop or a skip).
    for (const pass of (hole ? ["hole", "hop", "ahead"] : ["hop", "ahead"]) as ("hole" | "hop" | "ahead")[]) {
      const want = pass === "hole" ? (k: Kind) => k === "hole" : pass === "hop" ? (k: Kind) => k === "hop" : (k: Kind) => k === "hop" || k === "skip";
      const min = pass === "hole" ? ORBIT_HUMAN_HOLE_WINDOW : c.window;
      const ws = windows(kinds, want, ready).filter(([, len]) => len >= min);
      if (!ws.length) continue;
      const inLap = ws.filter(([a, len]) => s.tick + 1 + a + Math.trunc(len / 2) - settled < lap);
      const pick = earliest ? inLap[0] : [...inLap].sort((x, y) => y[1] - x[1])[0];
      const [a, len] = pick ?? ws[0]!;
      return { d: a + Math.trunc(len / 2), kind: pass === "hole" ? "hole" : "hop" };
    }
  }
  return null;
}

/* Features on the witness's own flights (orbit-xp-lib's candidates and clearOf, unchanged rules). */
const SLOTS: Record<"dust" | "moon" | "field", number[]> = { dust: [1, 6, 12, 18, 24], moon: [4, 11, 17, 23], field: [6, 15, 24] };
function clearOf(s: OrbitRev3State, extras: OrbitExtras, x: number, y: number, margin: number): boolean {
  if (x < 20 * FP || x > (ORBIT_REV3_WORLD_W - 20) * FP) return false;
  for (const p of s.planets) {
    const d = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
    if (d < orbitExtent(p) + margin * FP) return false;
    if (p.hazard >= 0 && Math.abs(d - orbitBeltRadius(p)) < (margin + 6) * FP) return false;
    if (inside(p, x, y)) return false;
  }
  for (const h of s.holes ?? []) if (Math.hypot(x - h.x, y - h.y) < ORBIT_HOLE_R + (margin + 12) * FP) return false;
  const near = (px: number, py: number, r: number) => Math.hypot(x - px, y - py) < r * FP;
  for (const m of extras.dust) if (near(m.x, m.y, 16)) return false;
  for (const m of extras.moons) if (near(m.x, m.y, 56)) return false;
  for (const f of extras.fields) for (const r of f.rocks) if (near(r.x, r.y, 30)) return false;
  return true;
}
const px = (v: number) => Math.trunc(v / FP) * FP;
function candidates(type: "dust" | "moon" | "field", s: OrbitRev3State, extras: OrbitExtras, path: [number, number][], salt: number): OrbitExtras[] {
  const n = path.length - 1;
  if (n < 12) return [];
  const at = (f: number) => path[Math.max(1, Math.min(n - 1, Math.round(f * n)))]!;
  const dir = (f: number) => {
    const i = Math.max(1, Math.min(n - 1, Math.round(f * n)));
    const [x0, y0] = path[i - 1]!;
    const [x1, y1] = path[i]!;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    return { ux: (x1 - x0) / len, uy: (y1 - y0) / len };
  };
  const out: OrbitExtras[] = [];
  if (type === "dust") {
    for (const startF of [0.28, 0.22, 0.34, 0.16, 0.4]) {
      const trial = { ...extras, dust: [...extras.dust] };
      let f = startF;
      let tries = 0;
      while (trial.dust.length - extras.dust.length < ORBIT_XP_MOTES && f <= 0.9 && tries++ < 12) {
        const [x, y] = at(f);
        const m = { x: px(x), y: px(y) };
        if (clearOf(s, trial, m.x, m.y, 6)) {
          trial.dust.push(m);
          f += 0.1;
        } else f += 0.04;
      }
      if (trial.dust.length - extras.dust.length === ORBIT_XP_MOTES) out.push(trial);
    }
  } else if (type === "moon") {
    for (const f of [0.5, 0.42, 0.58, 0.36, 0.64]) {
      const [x, y] = at(f);
      const { ux, uy } = dir(f);
      for (const side of salt & 1 ? [1, -1] : [-1, 1]) {
        for (const off of [28, 32, 25]) {
          const mx = px(x + side * -uy * off * FP), my = px(y + side * ux * off * FP);
          if (clearOf(s, extras, mx, my, 22)) out.push({ ...extras, moons: [...extras.moons, { x: mx, y: my }] });
        }
      }
    }
  } else {
    for (const f of [0.55, 0.47, 0.63, 0.4]) {
      const [x, y] = at(f);
      const { ux, uy } = dir(f);
      const nx = -uy, ny = ux;
      const rocks = [46, 60, 74].flatMap((off, k) => [1, -1].map((side) => {
        const jitter = (((salt >>> (k * 2 + (side > 0 ? 1 : 0))) & 3) - 1.5) * 2;
        const r = (k === 1 ? 6 : 7) * FP;
        return { x: px(x + side * nx * off * FP + ux * jitter * FP), y: px(y + side * ny * off * FP + uy * jitter * FP), r };
      }));
      const gap = 46 - 7;
      const field: OrbitField = { ax: px(x + nx * gap * FP), ay: px(y + ny * gap * FP), bx: px(x - nx * gap * FP), by: px(y - ny * gap * FP), rocks };
      if (rocks.every((r) => clearOf(s, extras, r.x, r.y, 14))) out.push({ ...extras, fields: [...extras.fields, field] });
    }
  }
  return out;
}
const withExtras = (s: OrbitRev3State, e: OrbitExtras): OrbitRev3State => ({ ...s, dust: e.dust, moons: e.moons, fields: e.fields });

export let ladderFailure = "";

/** The start a level's witness plays from: orbitRev 17 at the level (Normal: no level). */
export function ladderStart(level: OrbitLevelName | null) {
  return (planets: Planet[], worldW: number, holes: OrbitHole[], extras: OrbitExtras): OrbitRev3State => initLostFrom(planets, worldW, holes, extras, level ?? undefined);
}

/** The human witness on a course with its holes: features placed on its flights; null when it cannot carry them all. */
function buildHumanXp(c: LadderCourse, level: OrbitLevelName | null, planets: Planet[], holes: OrbitHole[], seed: number, earliest: boolean): { extras: OrbitExtras; taps: number[] } | null {
  const init = ladderStart(level);
  let extras: OrbitExtras = { dust: [], moons: [], fields: [] };
  let s = init(planets, ORBIT_REV3_WORLD_W, holes, extras);
  const taps: number[] = [];
  const next = { dust: 0, moon: 0, field: 0 };
  let settled = 0;
  let wasOrbiting = true;
  let safety = 0;
  while (s.ended === 0 && s.cur < ORBIT_TOTAL && safety++ < ORBIT_REV3_RUN_TICKS) {
    if (s.flying !== 0 || (s.warp ?? 0) > 0 || (s.hold ?? 0) > 0) {
      wasOrbiting = false;
      s = step(s, null);
      continue;
    }
    if (!wasOrbiting) settled = s.tick;
    wasOrbiting = true;
    const w = humanDelay(c, s, settled, earliest);
    if (!w) {
      ladderFailure = `no human window at planet ${s.cur}`;
      return null;
    }
    const d = w.d;
    const plain = fork(s, d, c.hopMax);
    if (plain.kind === "hop") {
      const due = (["dust", "moon", "field"] as const)
        .filter((t) => next[t] < SLOTS[t].length && s.cur >= SLOTS[t][next[t]]!)
        .sort((a, b) => SLOTS[a][next[a]]! - SLOTS[b][next[b]]!);
      const before = orbitXpCounts(s);
      const want = { dust: 0, slings: 0, threads: 0 };
      let onHop = 0;
      for (const type of due) {
        if (onHop >= 2) break;
        const line = onHop ? fork(s, d).path : plain.path;
        for (const trial of candidates(type, s, extras, line, (seed ^ Math.imul(s.cur + 1, 0x9e3779b1)) >>> 0)) {
          const t = withExtras(s, trial);
          const f = fork(t, d, c.hopMax);
          if (f.kind !== "hop") continue;
          const cnt = orbitXpCounts(f.end);
          const need = { ...want, ...(type === "dust" ? { dust: want.dust + ORBIT_XP_MOTES } : type === "moon" ? { slings: want.slings + 1 } : { threads: want.threads + 1 }) };
          if (cnt.dust - before.dust !== need.dust || cnt.slings - before.slings !== need.slings || cnt.threads - before.threads !== need.threads) continue;
          // The release must still be the witness's own with the feature in place (the same delay, the window of the course's width).
          const again = humanDelay(c, t, settled, earliest);
          if (!again || again.d !== d) continue;
          extras = trial;
          s = t;
          next[type]++;
          Object.assign(want, need);
          onHop++;
          break;
        }
      }
    }
    for (let k = 0; k < d; k++) s = step(s, null);
    taps.push(s.tick + 1);
    s = step(s, tapAt(s.tick + 1));
    wasOrbiting = false;
  }
  if (next.dust < ORBIT_XP_TRAILS || next.moon < ORBIT_XP_MOONS || next.field < ORBIT_XP_FIELDS) {
    ladderFailure = `placed ${next.dust} trails, ${next.moon} moons, ${next.field} fields`;
    return null;
  }
  return { extras, taps };
}

/** A witness's run on orbitRev 17 at the level: the end state, the least fuel a flight landed with, and whether every release kept the human limits. */
export function ladderWitnessRun(level: OrbitLevelName | null, planets: Planet[], holes: OrbitHole[], extras: OrbitExtras, taps: readonly number[]): { state: OrbitRev3State; minFuel: number; human: boolean; why: string } {
  const c = LADDER_COURSES[level ?? "normal"];
  let s = ladderStart(level)(planets, ORBIT_REV3_WORLD_W, holes, extras);
  const set = new Set(taps);
  let minFuel = c.tank;
  let lastFuel = c.tank;
  let settled = 0;
  let orbiting = true;
  let last = -1000;
  let human = true;
  let why = "";
  while (s.ended === 0 && s.tick < ORBIT_REV3_RUN_TICKS) {
    const t = s.tick + 1;
    const flying = s.flying > 0;
    const still = s.flying === 0 && !(s.warp ?? 0) && !(s.hold ?? 0);
    if (still && !orbiting) settled = s.tick;
    orbiting = still;
    if (set.has(t)) {
      if (!still) [human, why] = [false, `a tap at ${t} while not settled in orbit`];
      else if (t - settled < ORBIT_HUMAN_READY_TICKS) [human, why] = [false, `a release at ${t}, ${t - settled} ticks after settling`];
      else if (t - last < Math.round(HUMAN_LIMITS.moveMs / TICK_MS)) [human, why] = [false, `taps at ${last} and ${t}`];
      last = t;
    }
    s = step(s, set.has(t) ? tapAt(t) : null);
    if (flying && s.flying === 0) minFuel = Math.min(minFuel, lastFuel - 1);
    lastFuel = s.fuel ?? 0;
    if (s.flying !== 0) orbiting = false;
  }
  return { state: s, minFuel, human, why };
}

/** A course as rooms deal it on orbitRev 17 (the puzzle the server grades). */
export function ladderPuzzle(level: OrbitLevelName | null, seed: number, planets: Planet[], holes: OrbitHole[], extras: OrbitExtras) {
  return { type: "orbit", seed, orbitRev: ORBIT_REV_LOST, planets: encodeRev3Planets(planets), holes: encodeOrbitHoles(holes), extras: encodeOrbitExtras(extras), ...(level ? { level } : {}) };
}

/** A witness's score through the server's grade on the dealt puzzle (as the phone records it: checkpoints every 300 ticks). */
export function ladderServerScore(puzzle: ReturnType<typeof ladderPuzzle>, start: () => OrbitRev3State, taps: readonly number[]): { score: number; flagged: boolean; extra: Record<string, unknown> } {
  const set = new Set(taps);
  let s = start();
  const checkpoints: unknown[] = [];
  while (!s.ended && s.tick < orbitRev3Game.runTicks) {
    s = step(s, set.has(s.tick + 1) ? tapAt(s.tick + 1) : null);
    if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
  }
  const events = taps.map((t) => tapAt(t));
  const raw = encodeOrbitRun({ seed: puzzle.seed, claimedScore: orbitRev3Game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  const g = gradeAnswer(puzzle as never, raw, 0);
  const extra = (g.extra ?? {}) as Record<string, unknown>;
  return { score: g.score, flagged: Boolean(extra["flagged"]), extra };
}

/**
 * orbit-hole-lib's windowHopDelay (the hole walk's plain-hop release: the middle of the first run of at least `window`
 * release delays whose flight lands on a later planet), worked out from one state stepped on as it goes rather than a
 * fresh wait for every delay: the same answer.
 */
function windowHopDelayFast(state: OrbitRev3State, window: number): number | null {
  const maxK = holeDelays(state);
  let run = 0;
  let base = state;
  for (let d = 0; d <= maxK; d++) {
    if (holeFork(base, 0).kind === "hop") run++;
    else {
      if (run >= window) return d - run + Math.trunc(run / 2);
      run = 0;
    }
    base = step(base, null);
  }
  return run >= window ? maxK + 1 - run + Math.trunc(run / 2) : null;
}

export interface LadderBuilt {
  build: number;
  planets: Planet[];
  holes: OrbitHole[];
  extras: OrbitExtras;
  taps: number[];
  ticks: number;
  perfect: number;
  /** Ticks left on the clock at the sun. */
  left: number;
  minFuel: number;
}

/** Builds one orbitRev 17 course for a bank seed at a level (salted retries) and proves it; null when no salt passes. */
export function buildLadderCourse(level: OrbitLevelName | null, seed: number, salts = 16): LadderBuilt | null {
  const c = LADDER_COURSES[level ?? "normal"];
  const fails: string[] = [];
  const walk: HoleWalk = {
    init: (planets, holes) => ({ ...initFuelFrom(planets, ORBIT_REV3_WORLD_W, holes, { dust: [], moons: [], fields: [] }), fuel: c.tank, tank: c.tank }),
    hopDelay: (state) => windowHopDelayFast(state, c.window),
  };
  for (let salt = 0; salt < salts; salt++) {
    const build = salt === 0 ? seed | 0 : (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) | 0;
    let planets: Planet[];
    try {
      planets = buildLadderRaw(c, build);
    } catch (e) {
      fails.push(`salt ${salt}: ${(e as Error).message}`);
      continue;
    }
    // (A hole the walk would place past the sun, after a skip, throws in the hole library: a failed salt.)
    let holes: ReturnType<typeof buildHoles> = null;
    try {
      holes = buildHoles(planets, null, build, c.holeFrom, walk);
    } catch (e) {
      fails.push(`salt ${salt}: holes threw ${(e as Error).message}`);
      continue;
    }
    if (!holes) {
      fails.push(`salt ${salt}: holes ${holeFailure}`);
      continue;
    }
    let xp: { extras: OrbitExtras; taps: number[] } | null = null;
    for (const earliest of [false, true]) {
      xp = buildHumanXp(c, level, planets, holes.holes, build, earliest);
      if (xp) {
        const w = ladderWitnessRun(level, planets, holes.holes, xp.extras, xp.taps);
        const cnt = orbitXpCounts(w.state);
        const p = ladderPuzzle(level, seed, planets, holes.holes, xp.extras);
        const start = () => ladderStart(level)(planets, ORBIT_REV3_WORLD_W, holes.holes, xp!.extras);
        const g = ladderServerScore(p, start, xp.taps);
        // The sun with every feature, the level's pace and perfect orbits, the limits, the fuel, and the server agreeing.
        const left = ORBIT_REV3_RUN_TICKS - w.state.endedTick;
        const all = cnt.dust === cnt.dustTotal && cnt.slings === cnt.slingsTotal && cnt.threads === cnt.threadsTotal;
        const need = LADDER_BUILD_NEED[level ?? "normal"];
        if (w.state.finished === 1 && all && cnt.perfect >= need.perfect && left >= need.left && w.human && w.minFuel >= c.tank - c.hopMax && g.score === orbitRev3Game.score(w.state) && !g.flagged) {
          return { build, planets, holes: holes.holes, extras: xp.extras, taps: xp.taps, ticks: w.state.tick, perfect: cnt.perfect, left, minFuel: w.minFuel };
        }
        ladderFailure = `witness: finished ${w.state.finished} at ${w.state.endedTick}, perfect ${cnt.perfect}, dust ${cnt.dust}/${cnt.dustTotal}, human ${w.human ? "yes" : w.why}, fuel ${w.minFuel}, server ${g.score}${g.flagged ? " flagged" : ""}`;
      }
      fails.push(`salt ${salt}${earliest ? " (earliest)" : ""}: ${ladderFailure}`);
      // A planet with no human window fails the same way whichever window the witness prefers: the next salt.
      if (ladderFailure.startsWith("no human window")) break;
    }
  }
  ladderFailure = fails.join("; ");
  return null;
}
