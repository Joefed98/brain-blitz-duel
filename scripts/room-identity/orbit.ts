/**
 * Room identity for Orbit's expansion to 200 (orbitRev 12, docs/expansions/x200-orbit.md): every seeded thing a
 * player meets, from the stored puzzle alone, never from how the run is played.
 *
 * `scheduleOf(seed, rev, events)` deals the room's course for a room seed (as generateOrbit does: the feature-bank
 * course, seed mod its length), replays the input log on orbitRev 12 and lists:
 *  - at t = 0 every planet (place, orbit kind, belt), black hole, stardust mote, slingshot moon and asteroid rock;
 *  - every 60 ticks the run lived, each asteroid belt's opening (a pure function of the tick) and a digest of the
 *    course the sim is carrying (planets, holes, motes, moons, fields), which must never change mid-run.
 * Two logs on the same seed must give the same schedule over the ticks both runs lived. orbitRev 13 (the arcade
 * scoring standard, 29 Oct 2026) plays orbitRev 12 exactly and is checked the same way. orbitRev 14 (the fuel meter,
 * 1 Nov 2026; what rooms deal) deals from the fuel bank (orbitFuelCourseForSeed) on its own rules and is checked the same way.
 */
import { decodeOrbitExtras, decodeOrbitHoles, decodeRev3Planets, initXpFrom, orbitRev3Game, orbitRev3StartFor, ORBIT_REV3_WORLD_W, type OrbitRev3State } from "../../src/lib/arcade/orbitRev3";
import { orbitBeltStart, ORBIT_INPUT_TAP, ORBIT_REV_FUEL, ORBIT_REV_STD, ORBIT_REV_XP, orbitXpRev } from "../../src/lib/arcade/orbit";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { orbitFuelCourseForSeed, orbitXpCourseForSeed } from "../../src/lib/duel/orbitRev3Course.server";
import { Human } from "../arcade-skill-bands/human";
import { bot } from "../arcade-skill-bands/bots/orbit";

const FP = 256;
const px = (v: number) => Math.round(v / FP);

function startFor(seed: number, rev = ORBIT_REV_XP): () => OrbitRev3State {
  const course = rev === ORBIT_REV_FUEL ? orbitFuelCourseForSeed(seed) : orbitXpCourseForSeed(seed);
  if (!course) throw new Error(`orbit room identity: the ${rev === ORBIT_REV_FUEL ? "fuel" : "feature"} bank is empty`);
  const planets = decodeRev3Planets(course.planets);
  const holes = decodeOrbitHoles(course.holes);
  const extras = decodeOrbitExtras(course.extras);
  if (rev === ORBIT_REV_XP) return () => initXpFrom(planets, ORBIT_REV3_WORLD_W, holes, extras);
  const start = orbitRev3StartFor(rev, extras)!;
  return () => start(planets, ORBIT_REV3_WORLD_W, holes);
}

function digest(s: OrbitRev3State): string {
  const text = JSON.stringify([s.planets, s.holes ?? [], s.dust ?? [], s.moons ?? [], s.fields ?? []]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
}

export function scheduleOf(seed: number, rev: number, events: unknown): { t: number; what: string }[] {
  if (!orbitXpRev(rev)) throw new Error(`orbit room identity: orbitRev ${rev} is not the expansion (${ORBIT_REV_XP}) or the standard (${ORBIT_REV_STD})`);
  const log = (events as ArcadeInputEvent[]) ?? [];
  const byTick = new Map(log.map((e) => [e.t, e]));
  let s = startFor(seed, rev)();
  const out: { t: number; what: string }[] = [];
  s.planets.forEach((p, i) => out.push({ t: 0, what: `planet ${i} at ${px(p.x)},${px(p.y)} kind ${p.kind} belt ${p.hazard}` }));
  (s.holes ?? []).forEach((h, i) => out.push({ t: 0, what: `black hole ${i} at ${px(h.x)},${px(h.y)} from ${h.from} to ${h.to}` }));
  (s.dust ?? []).forEach((m, i) => out.push({ t: 0, what: `stardust ${i} at ${px(m.x)},${px(m.y)}` }));
  (s.moons ?? []).forEach((m, i) => out.push({ t: 0, what: `moon ${i} at ${px(m.x)},${px(m.y)}` }));
  (s.fields ?? []).forEach((f, i) => f.rocks.forEach((r, k) => out.push({ t: 0, what: `field ${i} rock ${k} at ${px(r.x)},${px(r.y)} r ${px(r.r)}` })));
  const belted = s.planets.map((p, i) => [p, i] as const).filter(([p]) => p.hazard >= 0);
  while (!orbitRev3Game.isOver(s) && s.tick < orbitRev3Game.runTicks) {
    s = orbitRev3Game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) {
      out.push({ t: s.tick, what: `course ${digest(s)}` });
      for (const [p, i] of belted) out.push({ t: s.tick, what: `belt ${i} opening ${orbitBeltStart(p, s.tick)}` });
    }
  }
  return out;
}

/** Uniformly random taps at a human-ish rate (every 0.25–1.5 s), from a seeded stream. */
export function randomTaps(seed: number): ArcadeInputEvent[] {
  let x = (seed ^ 0x5bd1e995) >>> 0;
  const next = () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: ArcadeInputEvent[] = [];
  for (let t = 15 + Math.floor(next() * 75); t < orbitRev3Game.runTicks; t += 15 + Math.floor(next() * 75)) out.push({ t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
  return out;
}

function botLog(seed: number, level: "weak" | "elite", rev = ORBIT_REV_XP): ArcadeInputEvent[] {
  const start = startFor(seed, rev);
  const game = { ...orbitRev3Game, init: start };
  return bot({ game, seed, rev, human: new Human("orbit", seed, level), fixes: true }).events ?? [];
}

export const roomIdentity = {
  type: "orbit",
  // What rooms deal: orbitRev 14 (the fuel meter, on the fuel bank); orbit-expand-check checks orbitRev 12.
  rev: ORBIT_REV_FUEL,
  scheduleOf,
  logs: (seed: number): ArcadeInputEvent[][] => [[], randomTaps(seed), botLog(seed, "weak", ORBIT_REV_FUEL), botLog(seed, "elite", ORBIT_REV_FUEL)],
};


