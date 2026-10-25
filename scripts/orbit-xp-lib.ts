/**
 * Feature placement and proof for Orbit's world expansion (orbitRev 11; offline, used by
 * scripts/orbit-xp-bank.ts). Every test runs the real sim (orbitRev3Game.step) on forked states.
 *
 * For one hole-bank course (its proved planets and black holes) this walks a witness run on orbitRev 11 rules:
 *  1. at each planet it scans release delays (each one forked: wait d, tap, follow the flight) and picks the
 *     middle of a window of at least four landing delays, preferring one inside the first lap (a perfect
 *     orbit); at a hole planet it takes the hole, as the hole bank's witness does;
 *  2. on the hops due a feature (FEATURE_SLOTS: six stardust trails, five slingshot moons, four asteroid fields,
 *     each on the first suitable hop from its slot on) it places the feature on that release's own flight line,
 *     clear of every planet's orbit, belt, hole and other feature, and keeps it only if that release still
 *     lands on the next planet and takes it (every mote, the slingshot, the thread) and the hop still has a
 *     window of four landing delays;
 *  3. finally the witness taps replay from the start with every feature in place and must reach the sun with
 *     every feature taken and at least 24 perfect orbits, scoring ORBIT_XP_MAX.
 * Deterministic: the same course always gives the same features.
 */
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { inside, lapPhases, orbitBeltRadius, orbitExtent, ORBIT_INPUT_TAP, ORBIT_TOTAL, type Planet } from "../src/lib/arcade/orbit";
import {
  initXpFrom,
  orbitRev3Game,
  orbitXpCounts,
  ORBIT_HOLE_R,
  ORBIT_REV3_FLIGHT_MAX,
  ORBIT_REV3_RUN_TICKS,
  ORBIT_REV3_WORLD_W,
  ORBIT_XP_MAX,
  type OrbitExtras,
  type OrbitField,
  type OrbitHole,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";

const FP = 256;
export const XP_TRAILS = 5;
export const XP_MOTES = 6;
export const XP_MOONS = 4;
export const XP_FIELDS = 3;
export const XP_PERFECT_MIN = 21;
/** First planet each feature may sit after (0-based planet the hop leaves). */
const SLOTS: Record<"dust" | "moon" | "field", number[]> = {
  dust: [1, 6, 12, 18, 24],
  moon: [4, 11, 17, 23],
  field: [6, 15, 24],
};

const step = (s: OrbitRev3State, input: ArcadeInputEvent | null) => orbitRev3Game.step(s, input);
const tapAt = (t: number): ArcadeInputEvent => ({ t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });

type Kind = "hop" | "skip" | "hole" | "die";
interface Fork {
  kind: Kind;
  path: [number, number][];
  end: OrbitRev3State;
}

/** Wait d ticks in orbit, tap, follow the flight to its end. */
export function xpFork(from: OrbitRev3State, d: number): Fork {
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
    : s.ended === 2 || s.respawns < from.respawns ? "die"
    : s.cur === from.cur + 1 ? "hop"
    : s.cur > from.cur || s.finished === 1 ? "skip" : "die";
  return { kind, path, end: s };
}

function scanLimit(s: OrbitRev3State, long: boolean): number {
  const lap = lapPhases(s.planets[s.cur]!).length;
  return long ? Math.max(lap * 2, 720) : lap * 2;
}

/** Windows of consecutive delays of the wanted kinds: [start, length]. */
function windows(kinds: Kind[], want: (k: Kind) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
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

/** The witness release from an orbiting state: a delay and what it does, or null. */
export function witnessDelay(s: OrbitRev3State, earliest = false): { d: number; kinds: Kind[] } | null {
  const lap = lapPhases(s.planets[s.cur]!).length;
  const wantHole = (s.holes ?? []).some((h) => h.from === s.cur && h.to > s.cur);
  for (const long of [false, true]) {
    const kinds: Kind[] = [];
    for (let d = 0; d <= scanLimit(s, long); d++) kinds.push(xpFork(s, d).kind);
    const want = wantHole ? (k: Kind) => k === "hole" : (k: Kind) => k !== "die";
    const min = wantHole ? 2 : 4;
    const ws = windows(kinds, want).filter(([, len]) => len >= min);
    if (!ws.length) continue;
    // A window whose middle comes in the first lap (a perfect orbit): the longest, or the earliest (the quickest route).
    const inLap = ws.filter(([a, len]) => a + Math.trunc(len / 2) < lap);
    const first = earliest ? inLap[0] : inLap.sort((x, y) => y[1] - x[1])[0];
    const [a, len] = first ?? ws[0]!;
    return { d: a + Math.trunc(len / 2), kinds };
  }
  return null;
}

/** Is a point clear of every planet's orbit and body, belt and hole, and of other features, by `margin` px? */
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

/** Candidate feature of a type on a flight path (positions per tick), or null when none fits. */
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
    // Six motes 10 % of the flight apart, on the first run of clear spots along it.
    for (const startF of [0.28, 0.22, 0.34, 0.16, 0.4]) {
      const trial = { ...extras, dust: [...extras.dust] };
      let f = startF;
      let tries = 0;
      while (trial.dust.length - extras.dust.length < XP_MOTES && f <= 0.9 && tries++ < 12) {
        const [x, y] = at(f);
        const m = { x: px(x), y: px(y) };
        if (clearOf(s, trial, m.x, m.y, 6)) {
          trial.dust.push(m);
          f += 0.1;
        } else f += 0.04;
      }
      if (trial.dust.length - extras.dust.length === XP_MOTES) out.push(trial);
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

export interface XpWitness {
  extras: OrbitExtras;
  taps: number[];
  ticks: number;
  perfect: number;
}
export let xpFailure = "";

/** Places and proves the features on one course; null when the course cannot carry all of them. */
export function buildXp(planets: Planet[], holes: OrbitHole[], seed: number): XpWitness | null {
  const failures: string[] = [];
  for (const earliest of [false, true]) {
    const w = buildXpWith(planets, holes, seed, earliest);
    if (w) return w;
    failures.push(xpFailure);
  }
  xpFailure = failures.join("; ");
  return null;
}

function buildXpWith(planets: Planet[], holes: OrbitHole[], seed: number, earliest: boolean): XpWitness | null {
  xpFailure = "";
  let extras: OrbitExtras = { dust: [], moons: [], fields: [] };
  let s = initXpFrom(planets, ORBIT_REV3_WORLD_W, holes, extras);
  const taps: number[] = [];
  const next = { dust: 0, moon: 0, field: 0 };
  let safety = 0;
  while (s.ended === 0 && s.cur < ORBIT_TOTAL && safety++ < ORBIT_REV3_RUN_TICKS) {
    if (s.flying !== 0 || (s.warp ?? 0) > 0) {
      s = step(s, null);
      continue;
    }
    const w = witnessDelay(s, earliest);
    if (!w) {
      xpFailure = `no window at planet ${s.cur}`;
      return null;
    }
    let d = w.d;
    const plain = xpFork(s, d);
    if (plain.kind === "hop") {
      // The earliest-due feature whose slot has come, if it fits this hop.
      const due = (["dust", "moon", "field"] as const)
        .filter((t) => next[t] < SLOTS[t].length && s.cur >= SLOTS[t][next[t]]!)
        .sort((a, b) => SLOTS[a][next[a]]! - SLOTS[b][next[b]]!);
      // Up to two features on one hop (never two of a kind); the release must take every one placed on it.
      const before = orbitXpCounts(s);
      const want = { dust: 0, slings: 0, threads: 0 };
      let onHop = 0;
      for (const type of due) {
        if (onHop >= 2) break;
        // A second feature goes on the flight line the first one left (a slingshot speeds the rest up).
        const line = onHop ? xpFork(s, d).path : plain.path;
        for (const trial of candidates(type, s, extras, line, (seed ^ Math.imul(s.cur + 1, 0x9e3779b1)) >>> 0)) {
          const t = withExtras(s, trial);
          const f = xpFork(t, d);
          if (f.kind !== "hop") continue;
          const c = orbitXpCounts(f.end);
          const need = { ...want, ...(type === "dust" ? { dust: want.dust + XP_MOTES } : type === "moon" ? { slings: want.slings + 1 } : { threads: want.threads + 1 }) };
          if (c.dust - before.dust !== need.dust || c.slings - before.slings !== need.slings || c.threads - before.threads !== need.threads) continue;
          // The hop must still have a window of four landing delays with the feature in place.
          if (!witnessDelay(t, earliest)) continue;
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
    d = 0;
  }
  if (next.dust < XP_TRAILS || next.moon < XP_MOONS || next.field < XP_FIELDS) {
    xpFailure = `placed ${next.dust} trails, ${next.moon} moons, ${next.field} fields`;
    return null;
  }
  // From the start, with every feature in place.
  let r = initXpFrom(planets, ORBIT_REV3_WORLD_W, holes, extras);
  const set = new Set(taps);
  while (r.ended === 0 && r.tick < ORBIT_REV3_RUN_TICKS) r = step(r, set.has(r.tick + 1) ? tapAt(r.tick + 1) : null);
  const c = orbitXpCounts(r);
  const score = orbitRev3Game.score(r);
  if (!(r.finished === 1 && c.dust === c.dustTotal && c.slings === c.slingsTotal && c.threads === c.threadsTotal && c.perfect >= XP_PERFECT_MIN && score === ORBIT_XP_MAX)) {
    xpFailure = `witness: finished ${r.finished} at ${r.tick}, jumps ${r.jumps}, dust ${c.dust}/${c.dustTotal}, slings ${c.slings}/${c.slingsTotal}, threads ${c.threads}/${c.threadsTotal}, perfect ${c.perfect}, score ${score}`;
    return null;
  }
  return { extras, taps, ticks: r.tick, perfect: c.perfect };
}
