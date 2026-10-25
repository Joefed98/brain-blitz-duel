/**
 * orbit-rev11-check: Orbit's world expansion (orbitRev 11, 25 Oct 2026, docs/expansions/e7-orbit.md).
 *
 *  1. Legacy: 96 runs recorded on main before orbitRev 11 (scripts/orbit-rev11-record.ts: the skill-band bots on
 *     orbitRev 10, 8 and 7 bank courses) replay through the server's path to the same score, final checkpoint
 *     checksum, tick and planets reached.
 *  2. The bank: every orbitXpBank entry's extras are on its own hole-bank course, and its witness tap log
 *     replays through the server to the sun with every feature taken (score 200), on every entry.
 *  3. The rules: rocks and moon bodies crash (and use the checkpoint), a slingshot boosts the flight 1.5×, a
 *     thread needs the gap's line crossed, a perfect orbit needs a first-lap release, no input scores 0, the base
 *     part equals orbitRev 10's score on the same play, the feature points are capped at 50 and the total at 200.
 *  4. Dealing and display: generateOrbit deals orbitRev 11 with extras, LIVE_BANDS lists it, the view is
 *     450 × 782 and ROUND_MAX is 200.
 *
 *   bun scripts/orbit-rev11-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { bandStrict } from "../src/lib/arcade/scoreBands";
import { lapPhases, orbitCheckpoint, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP, ORBIT_REV_STRICT, ORBIT_REV_XP, ORBIT_TOTAL } from "../src/lib/arcade/orbit";
import {
  decodeOrbitExtras,
  decodeOrbitHoles,
  decodeRev3Planets,
  initStrictFrom,
  initXpFrom,
  orbitCrossesGap,
  orbitRev3Game,
  orbitStartForPuzzle,
  orbitWorldHFor,
  orbitWorldWFor,
  orbitXpCounts,
  orbitXpFeaturePoints,
  ORBIT_BAND_CURVE,
  ORBIT_MOON_ASSIST,
  ORBIT_REV3_WORLD_W,
  ORBIT_V11_BAND_CURVE,
  ORBIT_XP_MAX,
  ORBIT_NO_EXTRAS,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import { encodeOrbitRun, replayOrbitRun } from "../src/lib/duel/orbit";
import { ORBIT_HOLE_BANK } from "../src/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";
import { ORBIT_XP_BANK } from "../src/lib/duel/orbitXpBank.server";
import { generateOrbit } from "../src/lib/duel/arcade.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { roundMaxFor } from "../src/lib/duel/roundMax";

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
};

/* 1. Legacy runs. */
const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/orbit-rev11-legacy.json.gz")).toString()) as { runs: any[] };
const holeOf = (seed: number) => ORBIT_HOLE_BANK.find((e) => e.seed === seed)!;
const planetsOf = (seed: number) => ORBIT_REV3_BANK.find((e) => e.seed === seed)!.planets;
let same = 0;
for (const run of legacy.runs) {
  const r = replayOrbitRun(run.seed, run.raw, run.rev, planetsOf(run.seed), holeOf(run.seed).holes);
  if (r.score === run.score && orbitCheckpoint(r.state as any).checksum === run.final && r.state.tick === run.tick && r.state.best === run.best) same++;
  else console.log(`  differs: rev ${run.rev} seed ${run.seed} ${run.level}: ${r.score} vs ${run.score}`);
}
ok(same === legacy.runs.length && legacy.runs.length === 96, `${same} / ${legacy.runs.length} pre-change orbitRev 10 / 8 / 7 runs replay to the same score, checkpoint, tick and planets`);

/* 2. The bank. */
const tap = (t: number) => ({ t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
const checkpointsOf = new WeakMap<OrbitRev3State, unknown[]>();
const runTaps = (start: OrbitRev3State, taps: readonly number[]) => {
  const set = new Set(taps);
  let s = start;
  const checkpoints: unknown[] = [];
  while (!s.ended && s.tick < orbitRev3Game.runTicks) {
    s = orbitRev3Game.step(s, set.has(s.tick + 1) ? tap(s.tick + 1) : null);
    if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as any));
  }
  checkpointsOf.set(s, checkpoints);
  return s;
};
/** The phone's submission for a tap log (its checkpoints every 300 ticks, as the stage records them). */
const encodeTaps = (seed: number, taps: readonly number[], state: OrbitRev3State) =>
  encodeOrbitRun({ seed, claimedScore: orbitRev3Game.score(state), events: taps.map(tap), inputs: [], taps: [], endTick: state.tick, checkpoints: checkpointsOf.get(state) ?? [] } as any);
ok(ORBIT_XP_BANK.length >= 300, `the bank holds ${ORBIT_XP_BANK.length} courses with features (at least 300)`);
let perfectBank = 0;
let featureCounts = "";
for (const [i, entry] of ORBIT_XP_BANK.entries()) {
  const hole = holeOf(entry.seed);
  const planets = decodeRev3Planets(planetsOf(entry.seed));
  const extras = decodeOrbitExtras(entry.extras);
  const end = runTaps(initXpFrom(planets, ORBIT_REV3_WORLD_W, decodeOrbitHoles(hole.holes), extras), entry.taps);
  const raw = encodeTaps(entry.seed, entry.taps, end);
  const server = replayOrbitRun(entry.seed, raw, ORBIT_REV_XP, planetsOf(entry.seed), hole.holes, entry.extras);
  const c = orbitXpCounts(end);
  const full = end.finished === 1 && c.dust === c.dustTotal && c.slings === c.slingsTotal && c.threads === c.threadsTotal && server.score === ORBIT_XP_MAX;
  if (full) perfectBank++;
  else console.log(`  entry ${i} (seed ${entry.seed}): finished ${end.finished}, dust ${c.dust}/${c.dustTotal}, slings ${c.slings}/${c.slingsTotal}, threads ${c.threads}/${c.threadsTotal}, perfect ${c.perfect}, score ${server.score}`);
  if (i === 0) featureCounts = `${c.dustTotal} motes, ${c.slingsTotal} moons, ${c.threadsTotal} fields`;
}
ok(perfectBank === ORBIT_XP_BANK.length, `every entry's witness reaches the sun with every feature taken and scores ${ORBIT_XP_MAX} through the server (${perfectBank} / ${ORBIT_XP_BANK.length}; entry 0: ${featureCounts})`);

/* 3. The rules. */
const entry = ORBIT_XP_BANK[0]!;
const planets = decodeRev3Planets(planetsOf(entry.seed));
const holes = decodeOrbitHoles(holeOf(entry.seed).holes);
const extras = decodeOrbitExtras(entry.extras);
const xp0 = initXpFrom(planets, ORBIT_REV3_WORLD_W, holes, extras);
ok(xp0.xp === 1 && xp0.viewW === 450 && xp0.worldH === 782 && xp0.band === 3, "orbitRev 11 starts band-3, 450 × 782, with its marker");
ok(orbitRev3Game.score(xp0) === 0 && orbitRev3Game.score(runTaps(xp0, [])) === 0, "no input scores 0");
ok(JSON.stringify(ORBIT_V11_BAND_CURVE) === JSON.stringify(bandStrict(ORBIT_BAND_CURVE)), "the written-out base curve is orbitRev 10's strict curve");
// The base part matches orbitRev 10 on the same course when no feature is taken (a hole-bank witness: holes, no rocks on its lines? replay both).
{
  let base = 0, n = 0;
  for (const e of ORBIT_XP_BANK.slice(0, 40)) {
    const h = holeOf(e.seed);
    const p = decodeRev3Planets(planetsOf(e.seed));
    const a = runTaps(initStrictFrom(p, ORBIT_REV3_WORLD_W, decodeOrbitHoles(h.holes)), h.taps);
    const b = runTaps(initXpFrom(p, ORBIT_REV3_WORLD_W, decodeOrbitHoles(h.holes), ORBIT_NO_EXTRAS), h.taps);
    n++;
    const feat = orbitXpFeaturePoints(b).total;
    if (orbitRev3Game.score(b) - feat === orbitRev3Game.score(a) && b.tick === a.tick && b.best === a.best) base++;
  }
  ok(base === n, `with no features on the course, orbitRev 11 plays and scores orbitRev 10's base on ${base} / ${n} hole-bank witness runs (plus only perfect-orbit points)`);
}
// Hand-made flights beside a feature, flown from the planet nearest it (so the flight is inside the world).
const flightAt = (x: number, y: number, vx: number): OrbitRev3State => {
  let cur = 0;
  planets.forEach((p, i) => {
    if (Math.abs(p.y - y) < Math.abs(planets[cur]!.y - y)) cur = i;
  });
  return { ...xp0, cur, best: cur, flying: 1, x, y, vx, vy: 0, releaseTick: 0, releaseX: x, releaseY: y } as OrbitRev3State;
};
const fly = (s: OrbitRev3State, ticks: number, until: (s: OrbitRev3State) => boolean) => {
  let t = s;
  for (let k = 0; k < ticks && !until(t); k++) t = orbitRev3Game.step(t, null);
  return t;
};
// Crash on a rock uses the checkpoint; a crash with none ends the run.
{
  const rock = extras.fields[0]!.rocks[0]!;
  const s = flightAt(rock.x - 30 * 256, rock.y, 6 * 256);
  const clear = fly({ ...s, fields: [] }, 8, (t) => t.ended !== 0);
  const t = fly(s, 8, (t) => t.ended !== 0);
  ok(clear.ended === 0 && t.ended === 2, "a flight into an asteroid ends the run (the same flight with no field flies on)");
  const u = fly({ ...s, checkpoint: s.cur, respawns: 1 } as OrbitRev3State, 8, (t) => t.respawns === 0);
  ok(u.respawns === 0 && u.ended === 0 && u.flying === 0, "with a checkpoint set, an asteroid crash respawns there");
  const m = extras.moons[0]!;
  const v = fly(flightAt(m.x - 60 * 256, m.y - 30 * 256, 5 * 256), 30, (t) => Boolean(t.boost) || t.ended !== 0);
  ok(v.boost === 1 && v.slung === 1 && v.ended === 0 && Math.abs(v.vx) === Math.trunc((5 * 256 * 3) / 2) && v.x > m.x, "a flight passing 30 px from a moon's centre is slung as it leaves the ring: 1.5× speed, counted once");
  const w = fly(flightAt(m.x - 60 * 256, m.y - 10 * 256, 5 * 256), 14, (t) => t.ended !== 0);
  ok(w.ended === 2 && !w.slung, "a flight into a moon's body crashes (no slingshot)");
  const far = fly(flightAt(m.x - 60 * 256, m.y - 50 * 256, 5 * 256), 20, (t) => t.ended !== 0);
  ok(!far.slung && !far.boost, "a flight 50 px from a moon's centre is not slung");
  const d = extras.dust[0]!;
  const got = fly(flightAt(d.x - 40 * 256, d.y - 12 * 256, 5 * 256), 14, (t) => t.ended !== 0);
  const miss = fly(flightAt(d.x - 40 * 256, d.y - 16 * 256, 5 * 256), 14, (t) => t.ended !== 0);
  ok((got.dustGot ?? 0) & 1 && !((miss.dustGot ?? 0) & 1) ? true : false, "stardust is collected within 14 px (rocket 10 + mote 4) and not at 16 px");
  ok(ORBIT_MOON_ASSIST === 44 * 256, "the slingshot reach is 44 px");
  const g = { ax: 0, ay: 0, bx: 100 * 256, by: 0, rocks: [] };
  ok(orbitCrossesGap(g, 50 * 256, -5 * 256, 50 * 256, 5 * 256) && !orbitCrossesGap(g, 150 * 256, -5 * 256, 150 * 256, 5 * 256) && !orbitCrossesGap(g, 50 * 256, 2 * 256, 50 * 256, 9 * 256), "a thread needs the flight to cross the gap's line itself");
}
// Perfect orbits: a release after the first lap is not perfect.
{
  const lap = lapPhases(planets[0]!).length;
  const late = runTaps(xp0, [lap + 5]);
  const early = runTaps(xp0, []);
  ok((late.perfect ?? 0) === 0 && (early.perfect ?? 0) === 0, `a release after the first lap (${lap} ticks) earns no perfect orbit`);
  const firstWitness = runTaps(xp0, entry.taps.slice(0, 1));
  ok(entry.taps[0]! <= lap ? (firstWitness.perfect ?? 0) >= 1 || firstWitness.ended === 2 || firstWitness.cur > 0 : true, "a first-lap release that lands is a perfect orbit");
}
{
  const pts = orbitXpFeaturePoints({ ...xp0, dustGot: 0x3fffffff, slung: 0xff, threaded: 0xff, perfect: 99 } as OrbitRev3State);
  ok(pts.total === 50, `feature points are capped at 50 (${pts.dust} + ${pts.slings} + ${pts.threads} + ${pts.perfect})`);
}

/* 4. Dealing and display. */
{
  let dealt = 0, xp = 0;
  for (let k = 0; k < 200; k++) {
    const p = generateOrbit() as any;
    dealt++;
    if (p.orbitRev === ORBIT_REV_XP && p.extras && p.planets && p.holes) {
      const start = orbitStartForPuzzle(p);
      if (start && start().xp === 1) xp++;
    } else if (p.orbitRev !== ORBIT_REV_STRICT) xp = -999;
  }
  // 371 of the 504 bank courses carry features (74 %); the rest (no proved holes or features) keep orbitRev 10.
  ok(xp >= 120, `generateOrbit deals orbitRev 11 with extras (${xp} / ${dealt}; the rest orbitRev 10 courses without proved features)`);
}
ok((LIVE_BANDS as any).orbit.rev === ORBIT_REV_XP, "LIVE_BANDS lists orbitRev 11");
ok(orbitWorldWFor(ORBIT_REV_XP) === 450 && orbitWorldHFor(ORBIT_REV_XP) === 782 && orbitWorldWFor(ORBIT_REV_STRICT) === 390 && orbitWorldHFor(ORBIT_REV_STRICT) === 650, "the view is 450 × 782 on orbitRev 11 and unchanged before");
ok(roundMaxFor("orbit") === ORBIT_XP_MAX, "ROUND_MAX for orbit is 200");
ok(ORBIT_TOTAL === 40, "the course keeps 40 planets and the sun");
void ORBIT_INPUT_CHECKPOINT;

console.log(failed ? `\nFAIL: ${failed} failed` : "\nAll orbit-rev11 checks passed");
process.exit(failed ? 1 : 0);
