/**
 * Course building and proof for Orbit orbitRev 14 (the fuel meter, 1 Nov 2026; offline, used by
 * scripts/orbit-fuel-bank.ts and orbit-fuel-check). Every test runs the real sim (orbitRev3Game.step) on forked states.
 *
 * One course from a seed:
 *  1. planets laid out with a harder zigzag than orbitRev 3's (buildCourse3Raw): the sideways direction turns after
 *     every one or two planets (rev 3: two or three) and every step goes at least ZIG.latMin px sideways (rev 3:
 *     0–260), so the planets two and more ahead stand off to the side of a straight miss rather than in its line;
 *     each hop is placed only when a window of four release ticks, on two laps running, lands on the new planet on
 *     orbitRev 14's rules (any planet catches) within ORBIT_FUEL_HOP_MAX ticks of flight;
 *  2. the black holes (scripts/orbit-hole-lib.ts, orbitRev 4's proof, as the hole bank did) on the old-rule bot's run;
 *  3. the features and the witness (scripts/orbit-xp-lib.ts buildXp) on orbitRev 14's own rules: every mote,
 *     slingshot and field taken, at least 21 perfect orbits, the sun with half the run left: 200;
 *  4. the fuel proof: every witness flight lands with at least ORBIT_FUEL_MAX − ORBIT_FUEL_HOP_MAX fuel left.
 * Salted retries (as buildCourse3) until a course passes every step. Deterministic: a seed always gives the same course.
 */
import { clampInt, rngBelow, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  FP,
  innerLobe,
  lapPhases,
  ORBIT_CIRCLE,
  ORBIT_EIGHT,
  ORBIT_EIGHT_FROM,
  ORBIT_ELLIPSE,
  ORBIT_ELLIPSE_FROM,
  ORBIT_HAZARD_FROM,
  ORBIT_INPUT_TAP,
  ORBIT_TOTAL,
  ORBIT_BELT_PERIOD_TICKS,
  flightHitsBelts,
  orbitExtent,
  orbitPos,
  planetShape,
  releaseVel,
  type Planet,
} from "../src/lib/arcade/orbit";
import {
  initFuelFrom,
  orbitCaptureAny,
  orbitRev3Game,
  orbitXpCounts,
  runRev3BotWithTaps,
  ORBIT_FUEL_HOP_MAX,
  ORBIT_FUEL_MAX,
  ORBIT_REV3_RUN_TICKS,
  ORBIT_REV3_WORLD_W,
  type OrbitExtras,
  type OrbitHole,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import { buildHoles, holeFailure } from "./orbit-hole-lib";
import { buildXp, xpFailure } from "./orbit-xp-lib";

/**
 * The layout's knobs: the sideways step between planets (px, at least `latMin`, at most `latMax`), the sideways
 * direction turning after `turnMin + draw(turnSpan)` planets, and the far-catch rule (noFarCatch) tried first on
 * `retries` placements before `retries` more without it.
 */
export const ZIG = { latMin: 120, latMax: 300, turnMin: 1, turnSpan: 2, retries: 10, farBack: 6 };
const MAX_RETRIES = 20;
/** Fallback sideways steps, px, tried in turn (a hop that proves none of them rejects the build). */
const ZIG_FALLBACK_LATERAL = [180, 140, 110, 80];
/** Fallbacks taken by the last buildFuelCourseRaw (a statistic). */
export let fallbacks = 0;
export const FUEL_SALTS = 24;

const step = (s: OrbitRev3State, input: ArcadeInputEvent | null) => orbitRev3Game.step(s, input);
const tapAt = (t: number): ArcadeInputEvent => ({ t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });

/** One release from planet i on orbitRev 14's rules (no holes or features yet): does it land on planet i + 1 within the hop's fuel? */
function hopOkFuel(planets: readonly Planet[], i: number, angle: number, releaseTick: number): boolean {
  const from = planets[i]!;
  if (innerLobe(from, angle)) return false;
  let { x, y } = orbitPos(from, angle);
  const { vx, vy } = releaseVel(from, angle);
  for (let t = 1; t <= ORBIT_FUEL_HOP_MAX; t++) {
    const px = x, py = y;
    x += vx;
    y += vy;
    if (flightHitsBelts(planets, px, py, x, y, releaseTick + t)) return false;
    const j = orbitCaptureAny(planets, i, x, y);
    if (j < 0) continue;
    return j === i + 1;
  }
  return false;
}

/** A window of four release ticks landing on planet i + 1, on two laps running (and every belt epoch where belts move). */
export function fuelHopWindow(planets: readonly Planet[], i: number): boolean {
  const from = planets[i]!;
  const phases = lapPhases(from);
  const lap = phases.length;
  const moving = planets.some((p) => p.hazard >= 0);
  const epochs = moving ? Array.from({ length: Math.ceil(ORBIT_BELT_PERIOD_TICKS / 30) }, (_, k) => k * 30) : [0];
  for (const epoch of epochs) {
    const ok = phases.map((phase, k) => hopOkFuel(planets, i, phase, epoch + k));
    for (let start = 0; start < lap; start++) {
      let len = 0;
      while (len < lap && ok[(start + len) % lap]) len++;
      if (len < 4) continue;
      let again = true;
      for (let off = 0; off < 4 && again; off++) {
        const k = (start + off) % lap;
        again = hopOkFuel(planets, i, phases[k]!, epoch + lap + k);
      }
      if (again) return true;
    }
  }
  return false;
}

/** How far back a newly placed planet is tested against misses: a full tank's flight (160 ticks at 5.5 px) spans about six planets. */
const FAR_BACK = () => ZIG.farBack;
export { ORBIT_FUEL_MAX };
/**
 * The zigzag's purpose: no release from planet k, at any phase of its orbit, flies on a full tank (belts aside, which
 * only end flights sooner) into planet i when i is three or more planets on, unless another planet catches it first.
 * So a miss can only be caught by the next planet or the one after, both in view, never one well up the course.
 */
export function noFarCatch(planets: readonly Planet[], i: number): boolean {
  for (let k = Math.max(0, i - FAR_BACK()); k <= i - 3; k++) {
    const from = planets[k]!;
    for (const phase of lapPhases(from)) {
      if (innerLobe(from, phase)) continue;
      let { x, y } = orbitPos(from, phase);
      const { vx, vy } = releaseVel(from, phase);
      for (let t = 1; t < ORBIT_FUEL_MAX; t++) {
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

/** The harder-zigzag planets for one (salted) seed, every hop placed with a fuel window; throws when a hop has none. */
export function buildFuelCourseRaw(seed: number, worldW = ORBIT_REV3_WORLD_W): Planet[] {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const first = planetShape(0);
  const planets: Planet[] = [{ x: Math.trunc(worldW / 2) * FP, y: 0, ...first, dir: draw(2) ? 1 : -1, hazard: -1, colour: 0, kind: ORBIT_CIRCLE, rot: 0 }];
  let zig = { dir: draw(2) ? 1 : -1, streak: 0, turnLen: ZIG.turnMin + draw(ZIG.turnSpan) };
  fallbacks = 0;
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
      const lateral = (ZIG.latMin + draw(ZIG.latMax - ZIG.latMin + 1)) * FP;
      let x = prev.x + zig.dir * lateral;
      // Short of room on this side: turn now (the step keeps its full sideways length).
      if (x < lo || x > hi) {
        zig = { dir: -zig.dir, streak: 0, turnLen: ZIG.turnMin + draw(ZIG.turnSpan) };
        x = clampInt(prev.x + zig.dir * lateral, lo, hi);
      }
      zig.streak += 1;
      const y = prev.y - Math.trunc(((150 + draw(81)) * 115) / 100) * FP;
      const dx = x - prev.x;
      const dy = y - prev.y;
      const min = orbitExtent(prev) + extent + 24 * FP;
      if (dx * dx + dy * dy < min * min) continue;
      const hazard = i >= ORBIT_HAZARD_FROM && i < ORBIT_TOTAL && draw(2) === 1 ? draw(64) * 1024 : -1;
      const spin = draw(2) ? 1 : -1;
      planets.push({ x, y, ...shape, dir: kind === ORBIT_EIGHT ? -1 : spin, hazard, colour: i % 4, kind, rot });
      if (fuelHopWindow(planets, i - 1) && (attempt >= ZIG.retries || noFarCatch(planets, i))) placed = true;
      else planets.pop();
    }
    if (!placed) {
      // Fallback (small late orbits leave narrow windows on long diagonal hops): a circle on the zigzag's side, the
      // sideways step and the lift shortened until a window proves.
      const lo = shape.ring + 8 * FP;
      const hi = worldW * FP - shape.ring - 8 * FP;
      const dir = draw(2) ? 1 : -1;
      search: for (const lateral of ZIG_FALLBACK_LATERAL) {
        for (const lift of [200, 230, 264, 300]) {
          let x = prev.x + zig.dir * lateral * FP;
          if (x < lo || x > hi) x = clampInt(prev.x - zig.dir * lateral * FP, lo, hi);
          planets.push({ x, y: prev.y - lift * FP, ...shape, dir, hazard: -1, colour: i % 4, kind: ORBIT_CIRCLE, rot: 0 });
          if (fuelHopWindow(planets, i - 1)) {
            placed = true;
            break search;
          }
          planets.pop();
        }
      }
      if (placed) {
        zig.streak += 1;
        fallbacks++;
      }
    }
    if (!placed) throw new Error(`hop ${i} has no fuel window`);
  }
  return planets;
}

export interface FuelCourse {
  /** The seed the course was built from (salted). */
  build: number;
  planets: Planet[];
  holes: OrbitHole[];
  extras: OrbitExtras;
  taps: number[];
  ticks: number;
  perfect: number;
  /** The least fuel any witness flight landed with. */
  minFuel: number;
}
export let fuelFailure = "";

/** Replays a witness on orbitRev 14: the final state and the least fuel any flight landed with. */
export function fuelWitnessRun(planets: Planet[], holes: OrbitHole[], extras: OrbitExtras, taps: readonly number[]): { state: OrbitRev3State; minFuel: number } {
  let s = initFuelFrom(planets, ORBIT_REV3_WORLD_W, holes, extras);
  const set = new Set(taps);
  let minFuel = ORBIT_FUEL_MAX;
  let lastFuel = ORBIT_FUEL_MAX;
  while (s.ended === 0 && s.tick < ORBIT_REV3_RUN_TICKS) {
    const flying = s.flying > 0;
    s = step(s, set.has(s.tick + 1) ? tapAt(s.tick + 1) : null);
    if (flying && s.flying === 0) minFuel = Math.min(minFuel, lastFuel - 1);
    lastFuel = s.fuel ?? 0;
  }
  return { state: s, minFuel };
}

/** Builds and proves one orbitRev 14 course for a bank seed (salted retries); null when no salt passes. */
export function buildFuelCourse(seed: number): FuelCourse | null {
  const fails: string[] = [];
  for (let salt = 0; salt < FUEL_SALTS; salt++) {
    const build = salt === 0 ? seed | 0 : (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) | 0;
    let planets: Planet[];
    try {
      planets = buildFuelCourseRaw(build);
    } catch (e) {
      fails.push(`salt ${salt}: ${(e as Error).message}`);
      continue;
    }
    const bot = runRev3BotWithTaps(planets, ORBIT_REV3_WORLD_W);
    if (!bot.proof.ok) {
      fails.push(`salt ${salt}: old-rule bot ${bot.proof.reason}`);
      continue;
    }
    const holes = buildHoles(planets, bot.taps, build);
    if (!holes) {
      fails.push(`salt ${salt}: holes ${holeFailure}`);
      continue;
    }
    const xp = buildXp(planets, holes.holes, build, initFuelFrom);
    if (!xp) {
      fails.push(`salt ${salt}: features ${xpFailure}`);
      continue;
    }
    const w = fuelWitnessRun(planets, holes.holes, xp.extras, xp.taps);
    if (w.minFuel < ORBIT_FUEL_MAX - ORBIT_FUEL_HOP_MAX) {
      fails.push(`salt ${salt}: a witness flight landed with ${w.minFuel} fuel`);
      continue;
    }
    return { build, planets, holes: holes.holes, extras: xp.extras, taps: xp.taps, ticks: xp.ticks, perfect: xp.perfect, minFuel: w.minFuel };
  }
  fuelFailure = fails.join("; ");
  return null;
}

/**
 * Misses caught far ahead: from the witness's orbit at each planet, every release tick over one lap flown on
 * orbitRev 14's rules; counts flights caught by a planet three or more ahead (not through a black hole). A measure
 * of how often a straight miss lines up with a planet well up the course.
 */
export function farCatches(planets: Planet[], holes: OrbitHole[], extras: OrbitExtras, taps: readonly number[]): { releases: number; far: number } {
  let s = initFuelFrom(planets, ORBIT_REV3_WORLD_W, holes, extras);
  const set = new Set(taps);
  let releases = 0;
  let far = 0;
  let lastCur = -1;
  while (s.ended === 0 && s.tick < ORBIT_REV3_RUN_TICKS) {
    if (s.flying === 0 && !(s.warp ?? 0) && s.cur !== lastCur) {
      lastCur = s.cur;
      const lap = lapPhases(s.planets[s.cur]!).length;
      let w = s;
      for (let d = 0; d < lap; d++) {
        let f = step(w, tapAt(w.tick + 1));
        while (f.flying > 0 && f.ended === 0) f = step(f, null);
        releases++;
        if ((f.jumps ?? 0) === (w.jumps ?? 0) && f.cur >= w.cur + 3 && f.respawns === w.respawns) far++;
        w = step(w, null);
      }
    }
    s = step(s, set.has(s.tick + 1) ? tapAt(s.tick + 1) : null);
  }
  return { releases, far };
}

export { orbitXpCounts };

/** Misses caught three or more planets on, over the whole raw course (every planet, every phase, a full tank, belts aside). */
export function farRate(planets: readonly Planet[]): { releases: number; far: number } {
  let releases = 0, far = 0;
  for (let k = 0; k < ORBIT_TOTAL; k++) {
    const from = planets[k]!;
    for (const phase of lapPhases(from)) {
      if (innerLobe(from, phase)) continue;
      releases++;
      let { x, y } = orbitPos(from, phase);
      const { vx, vy } = releaseVel(from, phase);
      for (let t = 1; t < ORBIT_FUEL_MAX; t++) {
        x += vx;
        y += vy;
        const j = orbitCaptureAny(planets, k, x, y);
        if (j < 0) continue;
        if (j >= k + 3) far++;
        break;
      }
    }
  }
  return { releases, far };
}
