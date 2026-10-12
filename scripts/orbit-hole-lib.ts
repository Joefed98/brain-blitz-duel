/**
 * Black-hole placement and proof for Orbit rev 4 (offline; used by
 * scripts/orbit-hole-bank.ts and the batch-5 check). Every test here runs the
 * real sim (orbitRev3Game.step) on forked states — no geometry shortcuts.
 *
 * For one proved rev-3 bank course this:
 *  1. walks a witness run (the live-sim bot) from the start;
 *  2. on reaching each hole planet (about every 10 planets) tries seeded
 *     candidate spots on flights that miss the next planet, keeping the first
 *     whose entry window is narrow (2–6 consecutive release ticks), whose
 *     every normal hop still lands exactly as without it, and that sits clear
 *     of every orbit and belt;
 *  3. takes the hole (earliest entry tick) and carries on with the bot;
 *  4. requires the witness to reach the sun, and the course's own bank taps
 *     (which never take a hole) to still reach it with the holes in place.
 */
import { rngBelow, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { lapPhases, orbitBeltRadius, orbitExtent, ORBIT_INPUT_TAP, ORBIT_TOTAL, type Planet } from "../src/lib/arcade/orbit";
import {
  findHopTapDelay,
  initRev4From,
  orbitRev3Game,
  ORBIT_HOLE_R,
  ORBIT_REV3_FLIGHT_MAX,
  ORBIT_REV3_RUN_TICKS,
  ORBIT_REV3_WORLD_W,
  type OrbitHole,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";

const FP = 256;
/** Hole planets, about every ten (0-based planet index the hole sits beside). */
export const HOLE_FROM = [9, 19, 28] as const;
/** Entry window bounds, consecutive release ticks per lap. */
export const HOLE_WINDOW_MIN = 2;
export const HOLE_WINDOW_MAX = 6;

const step = (s: OrbitRev3State, input: ArcadeInputEvent | null) => orbitRev3Game.step(s, input);
const tapAt = (t: number): ArcadeInputEvent => ({ t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });

type Outcome = { kind: "hole" | "hop" | "die"; path: [number, number][] };

/** Wait d ticks in orbit, tap, and follow the flight to its end. */
export function holeFork(from: OrbitRev3State, d: number): Outcome {
  let s = from;
  for (let k = 0; k < d; k++) s = step(s, null);
  s = step(s, tapAt(s.tick + 1));
  const path: [number, number][] = [];
  let guard = 0;
  while (s.flying > 0 && s.ended === 0 && guard++ < ORBIT_REV3_FLIGHT_MAX + 5) {
    path.push([s.x, s.y]);
    s = step(s, null);
  }
  if ((s.jumps ?? 0) > (from.jumps ?? 0)) return { kind: "hole", path };
  if (s.ended === 2 || s.respawns < from.respawns) return { kind: "die", path };
  if (s.cur > from.cur || s.finished === 1) return { kind: "hop", path };
  return { kind: "die", path };
}

/** Release delays to test from an orbiting state: two laps, or a belt period where belts are near. */
export function holeDelays(state: OrbitRev3State): number {
  const here = state.planets[state.cur]!;
  const near = state.planets.slice(state.cur, state.cur + 4).some((p) => p.hazard >= 0);
  return Math.max(lapPhases(here).length * 2, 8, near ? 720 : 0);
}

/** Longest run of consecutive true values. */
function longestRun(flags: boolean[]): number {
  let best = 0, run = 0;
  for (const f of flags) {
    run = f ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Is a hole centre clear of every orbit path, planet and belt by a margin? */
export function clearSpot(planets: readonly Planet[], x: number, y: number): boolean {
  if (x < ORBIT_HOLE_R + 12 * FP || x > ORBIT_REV3_WORLD_W * FP - ORBIT_HOLE_R - 12 * FP) return false;
  for (const p of planets) {
    const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
    const out = orbitExtent(p) + ORBIT_HOLE_R + 18 * FP;
    if (d2 < out * out) return false;
    if (p.hazard >= 0) {
      const belt = orbitBeltRadius(p);
      const d = Math.sqrt(d2);
      if (Math.abs(d - belt) < ORBIT_HOLE_R + 14 * FP) return false;
    }
  }
  return true;
}

/**
 * A hole for the orbiting state (at planet `from`) to planet `to`, or null.
 * Returns the hole and its entry delays from this state.
 */
export function placeHole(state: OrbitRev3State, to: number, salt: number): { hole: OrbitHole; entries: number[] } | null {
  const from = state.cur;
  const maxK = holeDelays(state);
  const base: Outcome[] = [];
  for (let d = 0; d <= maxK; d++) base.push(holeFork(state, d));
  const hops = base.map((o) => o.kind === "hop");
  // Candidate spots: points along flights that miss the next planet, 70–330 px out.
  const spots: [number, number][] = [];
  base.forEach((o) => {
    if (o.kind !== "die") return;
    for (let k = 18; k < Math.min(o.path.length, 80); k += 6) {
      const [x, y] = o.path[k]!;
      if (clearSpot(state.planets, x, y)) spots.push([x, y]);
    }
  });
  // A seeded order, so the bank build is reproducible.
  let rng = (Math.imul(state.planets[from]!.x ^ 0x6a09e667, 31) ^ salt) | 0;
  for (let i = spots.length - 1; i > 0; i--) {
    const pick = rngBelow(rng, i + 1);
    rng = pick.state;
    [spots[i], spots[pick.value]] = [spots[pick.value]!, spots[i]!];
  }
  for (const [x, y] of spots.slice(0, 40)) {
    const hole: OrbitHole = { from, to, x: Math.trunc(x / FP) * FP, y: Math.trunc(y / FP) * FP };
    const trial = { ...state, holes: [...(state.holes ?? []), hole] };
    const kinds: Outcome["kind"][] = [];
    let ok = true;
    for (let d = 0; d <= maxK && ok; d++) {
      const kind = holeFork(trial, d).kind;
      kinds.push(kind);
      // No normal hop may be stolen or changed.
      if (hops[d] !== (kind === "hop")) ok = false;
    }
    if (!ok) continue;
    const entries = kinds.map((k, d) => (k === "hole" ? d : -1)).filter((d) => d >= 0);
    const run = longestRun(kinds.map((k) => k === "hole"));
    const laps = Math.max(1, Math.round(maxK / Math.max(1, lapPhases(state.planets[from]!).length)));
    if (run < HOLE_WINDOW_MIN || run > HOLE_WINDOW_MAX || entries.length > HOLE_WINDOW_MAX * laps) continue;
    return { hole, entries };
  }
  return null;
}

export interface HoleWitness {
  holes: OrbitHole[];
  /** Tap ticks of a full run that takes every hole and reaches the sun. */
  taps: number[];
  ticks: number;
}

/** Builds and proves the holes for one bank course; null when it cannot (the course then stays rev 3). */
export let holeFailure = "";
export function buildHoles(planets: Planet[], bankTaps: readonly number[], seed: number): HoleWitness | null {
  holeFailure = "";
  let state = initRev4From(planets, ORBIT_REV3_WORLD_W, []);
  const holes: OrbitHole[] = [];
  const taps: number[] = [];
  let next = 0;
  let safety = 0;
  while (state.cur < ORBIT_TOTAL && state.ended === 0 && safety++ < ORBIT_REV3_RUN_TICKS) {
    if (state.flying !== 0) {
      state = step(state, null);
      continue;
    }
    let delay: number | null = null;
    // The hole goes beside the first planet the run stops at from each slot on
    // (a hop can pass two planets at once).
    if (next < HOLE_FROM.length && state.cur >= HOLE_FROM[next]!) {
      const to = state.cur + 5 + ((seed >>> next) & 1);
      const placed = placeHole(state, to, seed) ?? placeHole(state, state.cur + 11 - (to - state.cur), seed);
      if (!placed) {
        holeFailure = `no hole spot at planet ${state.cur}`;
        return null;
      }
      holes.push(placed.hole);
      state = { ...state, holes: [...holes] };
      delay = placed.entries[0]!;
      next++;
    } else {
      delay = findHopTapDelay(state, ORBIT_REV3_WORLD_W, lapPhases(state.planets[state.cur]!).length);
      if (delay === null) {
        holeFailure = `no hop window at planet ${state.cur}`;
        return null;
      }
    }
    for (let k = 0; k < delay; k++) state = step(state, null);
    taps.push(state.tick + 1);
    state = step(state, tapAt(state.tick + 1));
  }
  if (!(state.finished === 1 && (state.jumps ?? 0) === HOLE_FROM.length)) {
    holeFailure = `witness ended at planet ${state.cur} (jumps ${state.jumps ?? 0}, tick ${state.tick})`;
    return null;
  }
  // The course's own proof taps (which go planet by planet) must still reach the sun.
  let plain = initRev4From(planets, ORBIT_REV3_WORLD_W, holes);
  const tapSet = new Set(bankTaps);
  while (plain.ended === 0 && plain.tick < ORBIT_REV3_RUN_TICKS) plain = step(plain, tapSet.has(plain.tick + 1) ? tapAt(plain.tick + 1) : null);
  if (plain.finished !== 1 || (plain.jumps ?? 0) !== 0) {
    holeFailure = `bank taps no longer finish (planet ${plain.cur}, jumps ${plain.jumps ?? 0})`;
    return null;
  }
  return { holes, taps, ticks: state.tick };
}
