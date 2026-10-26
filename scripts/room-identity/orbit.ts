/**
 * Room identity for Orbit's expansion to 200 (orbitRev 12, docs/expansions/x200-orbit.md): every seeded thing a
 * player meets, from the stored puzzle alone, never from how the run is played.
 *
 * `scheduleOf(seed, rev, events)` deals the room's course for a room seed (as generateOrbit does: the feature-bank
 * course, seed mod its length), replays the input log on orbitRev 12 and lists:
 *  - at t = 0 every planet (place, orbit kind, belt), black hole, stardust mote, slingshot moon and asteroid rock;
 *  - every 60 ticks the run lived, each asteroid belt's opening (a pure function of the tick) and a digest of the
 *    course the sim is carrying (planets, holes, motes, moons, fields), which must never change mid-run.
 * Two logs on the same seed must give the same schedule over the ticks both runs lived.
 */
import { decodeOrbitExtras, decodeOrbitHoles, decodeRev3Planets, initXpFrom, orbitRev3Game, ORBIT_REV3_WORLD_W, type OrbitRev3State } from "../../src/lib/arcade/orbitRev3";
import { orbitBeltStart, ORBIT_INPUT_TAP, ORBIT_REV_XP } from "../../src/lib/arcade/orbit";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { orbitXpCourseForSeed } from "../../src/lib/duel/orbitRev3Course.server";
import { Human } from "../arcade-skill-bands/human";
import { bot } from "../arcade-skill-bands/bots/orbit";

const FP = 256;
const px = (v: number) => Math.round(v / FP);

function startFor(seed: number): () => OrbitRev3State {
  const course = orbitXpCourseForSeed(seed);
  if (!course) throw new Error("orbit room identity: the feature bank is empty");
  const planets = decodeRev3Planets(course.planets);
  const holes = decodeOrbitHoles(course.holes);
  const extras = decodeOrbitExtras(course.extras);
  return () => initXpFrom(planets, ORBIT_REV3_WORLD_W, holes, extras);
}

function digest(s: OrbitRev3State): string {
  const text = JSON.stringify([s.planets, s.holes ?? [], s.dust ?? [], s.moons ?? [], s.fields ?? []]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
}

export function scheduleOf(seed: number, rev: number, events: unknown): { t: number; what: string }[] {
  if (rev !== ORBIT_REV_XP) throw new Error(`orbit room identity: orbitRev ${rev} is not the expansion (${ORBIT_REV_XP})`);
  const log = (events as ArcadeInputEvent[]) ?? [];
  const byTick = new Map(log.map((e) => [e.t, e]));
  let s = startFor(seed)();
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
function randomTaps(seed: number): ArcadeInputEvent[] {
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

function botLog(seed: number, level: "weak" | "elite"): ArcadeInputEvent[] {
  const start = startFor(seed);
  const game = { ...orbitRev3Game, init: start };
  return bot({ game, seed, rev: ORBIT_REV_XP, human: new Human("orbit", seed, level) }).events ?? [];
}

export const roomIdentity = {
  type: "orbit",
  rev: ORBIT_REV_XP,
  scheduleOf,
  logs: (seed: number): ArcadeInputEvent[][] => [[], randomTaps(seed), botLog(seed, "weak"), botLog(seed, "elite")],
};


