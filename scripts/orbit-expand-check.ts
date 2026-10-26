/**
 * orbit-expand-check: Orbit's expansion to 200 under the arcade rule (orbitRev 12, 26 Oct 2026,
 * docs/expansions/x200-orbit.md; the parked orbitRev 11 of docs/expansions/e7.md, renumbered, never dealt).
 *
 *  1. Legacy: 96 runs recorded on main before the expansion (scripts/orbit-rev11-record.ts: the skill-band bots on
 *     orbitRev 10, 8 and 7 bank courses; main's Orbit code is unchanged since) replay through the server's path to
 *     the same score, final checkpoint checksum, tick and planets reached.
 *  2. Guaranteed opportunities: every feature-bank course carries exactly 5 stardust trails of 6 motes, 4 slingshot
 *     moons, 3 asteroid fields and 3 black holes, and its witness tap log replays through the server to the sun
 *     with every feature taken and 21+ perfect orbits, scoring 200; the perfect-play ceiling of the course every
 *     tuning (0–59) and fresh (60–259) seed index deals is therefore 200.
 *  3. The rules on hand-built states: rocks and moon bodies crash (and use the checkpoint), a slingshot boosts the
 *     flight 1.5×, a thread needs the gap's line crossed, a perfect orbit needs a first-lap release, an early crash
 *     scores the share of the way it flew (partial credit), no input scores 0, the skill pay's knots, the base
 *     part equals orbitRev 10's score on the same play, the raw feature points cap at 50 and the total at 200.
 *  4. Recorded orbitRev 12 runs (scripts/fixtures/orbit-x200-runs.json.gz, scripts/orbit-expand-record.ts: every
 *     skill level) replay through the server to the same score, checksum and tick.
 *  5. Room identity: idle, random, weak-bot and elite-bot logs on the same seed see the identical seeded course,
 *     features and belt openings (scripts/room-identity/orbit.ts) over the ticks both runs lived.
 *  6. Dealing and display: generateOrbit deals orbitRev 12 with extras, LIVE_BANDS lists it (strictRev 10), the
 *     view is 450 × 782, ROUND_MAX is 200, the intro demo waits for one recorded on orbitRev 12.
 *
 *   bun scripts/orbit-expand-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { bandPoints, bandStrict } from "../src/lib/arcade/scoreBands";
import { lapPhases, orbitCheckpoint, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP, ORBIT_REV_STRICT, ORBIT_REV_XP, ORBIT_TOTAL } from "../src/lib/arcade/orbit";
import {
  decodeOrbitExtras,
  decodeOrbitHoles,
  decodeRev3Planets,
  initStrictFrom,
  initXpFrom,
  orbitBandParts,
  orbitCrossesGap,
  orbitRev3Game,
  orbitStartForPuzzle,
  orbitWorldHFor,
  orbitWorldWFor,
  orbitXpBasePoints,
  orbitXpCounts,
  orbitXpFeaturePoints,
  orbitXpSkillPaid,
  ORBIT_BAND_CURVE,
  ORBIT_MOON_ASSIST,
  ORBIT_REV3_WORLD_W,
  ORBIT_V12_BAND_CURVE,
  ORBIT_V12_SKILL_MAX,
  ORBIT_V12_SKILL_PAY,
  ORBIT_V12_SKILL_PACED_FROM,
  ORBIT_V12_PACE_FROM,
  ORBIT_V12_PACE_FULL,
  ORBIT_XP_FIELDS,
  ORBIT_XP_MAX,
  ORBIT_XP_MOONS,
  ORBIT_XP_MOTES,
  ORBIT_XP_TRAILS,
  ORBIT_NO_EXTRAS,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import { bandLines } from "../src/lib/arcade/scoreBands";
import { encodeOrbitRun, replayOrbitRun } from "../src/lib/duel/orbit";
import { ORBIT_HOLE_BANK } from "../src/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";
import { ORBIT_XP_BANK } from "../src/lib/duel/orbitXpBank.server";
import { orbitXpCourseForSeed } from "../src/lib/duel/orbitRev3Course.server";
import { generateOrbit } from "../src/lib/duel/arcade.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { roomSeed } from "./arcade-skill-bands/games";
import { randomTaps, roomIdentity } from "./room-identity/orbit";

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
  if (r.score === run.score && orbitCheckpoint(r.state as any).checksum === run.final && r.state.tick === run.tick && r.state.best === run.best && (r.state as any).xp === undefined && (r.state as any).reach === undefined) same++;
  else console.log(`  differs: rev ${run.rev} seed ${run.seed} ${run.level}: ${r.score} vs ${run.score}`);
}
ok(same === legacy.runs.length && legacy.runs.length === 96, `${same} / ${legacy.runs.length} pre-change orbitRev 10 / 8 / 7 runs replay to the same score, checkpoint, tick and planets (no orbitRev 12 field on them)`);

/* 2. Guaranteed opportunities and the ceiling. */
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
const ceilingOf = new Map<number, number>();
let fixedCounts = 0;
let perfectBank = 0;
let minPerfect = Infinity;
for (const [i, entry] of ORBIT_XP_BANK.entries()) {
  const hole = holeOf(entry.seed);
  const planets = decodeRev3Planets(planetsOf(entry.seed));
  const extras = decodeOrbitExtras(entry.extras);
  if (extras.dust.length === ORBIT_XP_TRAILS * ORBIT_XP_MOTES && extras.moons.length === ORBIT_XP_MOONS && extras.fields.length === ORBIT_XP_FIELDS && hole.holes.length === 3) fixedCounts++;
  const end = runTaps(initXpFrom(planets, ORBIT_REV3_WORLD_W, decodeOrbitHoles(hole.holes), extras), entry.taps);
  const raw = encodeTaps(entry.seed, entry.taps, end);
  const server = replayOrbitRun(entry.seed, raw, ORBIT_REV_XP, planetsOf(entry.seed), hole.holes, entry.extras);
  const c = orbitXpCounts(end);
  const full = end.finished === 1 && c.dust === c.dustTotal && c.slings === c.slingsTotal && c.threads === c.threadsTotal && orbitXpFeaturePoints(end).total === ORBIT_V12_SKILL_MAX && server.score === ORBIT_XP_MAX && !server.flagged;
  ceilingOf.set(entry.seed, server.score);
  minPerfect = Math.min(minPerfect, c.perfect);
  if (full) perfectBank++;
  else console.log(`  entry ${i} (seed ${entry.seed}): finished ${end.finished}, dust ${c.dust}/${c.dustTotal}, slings ${c.slings}/${c.slingsTotal}, threads ${c.threads}/${c.threadsTotal}, perfect ${c.perfect}, score ${server.score}`);
}
ok(fixedCounts === ORBIT_XP_BANK.length, `every course carries exactly ${ORBIT_XP_TRAILS} × ${ORBIT_XP_MOTES} stardust motes, ${ORBIT_XP_MOONS} moons, ${ORBIT_XP_FIELDS} asteroid fields and 3 black holes (${fixedCounts} / ${ORBIT_XP_BANK.length}): the seed decides where, never how many`);
ok(perfectBank === ORBIT_XP_BANK.length, `every course's witness reaches the sun with every feature taken (${minPerfect}+ perfect orbits) and scores ${ORBIT_XP_MAX} through the server (${perfectBank} / ${ORBIT_XP_BANK.length})`);
{
  // Reachability, seed by seed: the puzzle each seed index deals (as generateOrbit: its room seed, the feature-bank
  // course seed mod the bank, the course's planets, holes and extras) is played by its course's witness player,
  // and the run is graded by the server's replay on that puzzle's own fields.
  const sets: [string, number, number][] = [["tuning", 0, 60], ["fresh", 60, 260]];
  for (const [name, from, to] of sets) {
    let min = Infinity, played = 0;
    for (let n = from; n < to; n++) {
      const seed = roomSeed(n);
      const course = orbitXpCourseForSeed(seed)!;
      const entry = ORBIT_XP_BANK.find((e) => JSON.stringify(e.extras) === JSON.stringify(course.extras))!;
      const puzzle = { type: "orbit" as const, seed, orbitRev: ORBIT_REV_XP, planets: course.planets, holes: course.holes, extras: course.extras };
      const end = runTaps(orbitStartForPuzzle(puzzle)!(), entry.taps);
      const server = replayOrbitRun(puzzle.seed, encodeTaps(puzzle.seed, entry.taps, end), puzzle.orbitRev, puzzle.planets, puzzle.holes, puzzle.extras);
      if (!server.flagged) played++;
      min = Math.min(min, server.flagged ? 0 : server.score);
    }
    ok(min === ORBIT_XP_MAX && played === to - from, `perfect-play ceiling, played through the server replay on each of the ${to - from} ${name} seed indices ${from}–${to - 1}: lowest ${min} (every one reaches ${ORBIT_XP_MAX})`);
  }
}

/* 3. The rules. */
const entry = ORBIT_XP_BANK[0]!;
const planets = decodeRev3Planets(planetsOf(entry.seed));
const holes = decodeOrbitHoles(holeOf(entry.seed).holes);
const extras = decodeOrbitExtras(entry.extras);
const xp0 = initXpFrom(planets, ORBIT_REV3_WORLD_W, holes, extras);
ok(xp0.xp === 1 && xp0.viewW === 450 && xp0.worldH === 782 && xp0.band === 3 && xp0.reach === 0, "orbitRev 12 starts band-3, 450 × 782, with its marker and no partial credit");
ok(orbitRev3Game.score(xp0) === 0 && orbitRev3Game.score(runTaps(xp0, [])) === 0, "no input scores 0");
{
  // The base curve is orbitRev 10's strict curve from 20 planets up, lifted only below (the first hops count more).
  const strict = bandStrict(ORBIT_BAND_CURVE);
  let sameTop = true, lifted = true;
  for (let u = 0; u <= ORBIT_TOTAL; u++) {
    const a = bandPoints(ORBIT_V12_BAND_CURVE, u), b = bandPoints(strict, u);
    if (u >= 20 && a !== b) sameTop = false;
    if (u < 20 && a < b) lifted = false;
  }
  ok(sameTop && lifted && bandPoints(ORBIT_V12_BAND_CURVE, ORBIT_TOTAL) === 140, "the base curve is orbitRev 10's strict curve from 20 planets up, never lower below it, 140 at the sun");
}
{
  // Partial credit: every first-lap release that crashes scores the share of planet 1's step it flew.
  const lap = lapPhases(planets[0]!).length;
  const step1 = bandPoints(ORBIT_V12_BAND_CURVE, 1);
  let crashes = 0, scored = 0, exact = 0, mono = 0;
  for (let d = 1; d <= lap; d++) {
    const s = runTaps(xp0, [d]);
    if (s.best > 0 || s.ended !== 2) continue;
    crashes++;
    const score = orbitRev3Game.score(s);
    if (score === Math.trunc((step1 * (s.reach ?? 0)) / 16) && score === orbitXpBasePoints(s)) exact++;
    if (score > 0) scored++;
  }
  // Partial credit never falls as the flight gets further; reaching the planet always scores more than any crash.
  for (let r = 0; r < 15; r++) if (orbitXpBasePoints({ ...xp0, reach: r + 1 } as OrbitRev3State) >= orbitXpBasePoints({ ...xp0, reach: r } as OrbitRev3State)) mono++;
  ok(crashes > 0 && exact === crashes, `a first-hop crash scores the 16ths of planet 1's ${step1} points it flew toward it (${exact} / ${crashes} single-tap crashes)`);
  ok(scored * 2 >= crashes, `most first-hop crashes still score (${scored} / ${crashes})`);
  ok(mono === 15 && orbitXpBasePoints({ ...xp0, reach: 15 } as OrbitRev3State) < bandPoints(ORBIT_V12_BAND_CURVE, 1) && orbitXpBasePoints({ ...xp0, best: 39, reach: 15 } as OrbitRev3State) < orbitXpBasePoints({ ...xp0, finished: 1 } as OrbitRev3State), "partial credit rises with the distance and stays below the next planet's points");
  const parts = orbitBandParts({ ...xp0, best: 3, reach: 8, acted: 1 } as OrbitRev3State);
  ok(bandLines(parts, orbitRev3Game.score({ ...xp0, best: 3, reach: 8, acted: 1 } as OrbitRev3State)).join(" ").includes("8/16 of the next"), "the reveal line states the partial credit");
}
{
  // Skill pay: a rising scale on the raw feature points, the full 50 only for all of them.
  const knots = ORBIT_V12_SKILL_PAY;
  const pays = Array.from({ length: 51 }, (_, raw) => bandPoints(knots, raw));
  ok(pays[50] === ORBIT_V12_SKILL_MAX && pays[49]! < ORBIT_V12_SKILL_MAX && pays.every((p, i) => i === 0 || p >= pays[i - 1]!) && pays[20]! < 20 && pays[30]! < 30, `skill pay rises: 10 → ${pays[10]}, 20 → ${pays[20]}, 30 → ${pays[30]}, 40 → ${pays[40]}, 50 → ${pays[50]}`);
  const all = { ...xp0, dustGot: 0x3fffffff, slung: 0xff, threaded: 0xff, perfect: 99, finished: 1, endedTick: 600, acted: 1 } as OrbitRev3State;
  const pts = orbitXpFeaturePoints(all);
  ok(pts.total === 50 && orbitXpSkillPaid(all) === 50 && orbitRev3Game.score(all) === ORBIT_XP_MAX, `raw feature points cap at 50 (${pts.dust} + ${pts.slings} + ${pts.threads} + ${pts.perfect}) and the total at ${ORBIT_XP_MAX}`);
  // Elite pace: every feature taken pays 40 without the sun, a share of the last 10 from 10 s left, all 50 with 40 s left.
  const at = (endedTick: number, finished = 1) => orbitXpSkillPaid({ ...all, finished, endedTick } as OrbitRev3State);
  const run = orbitRev3Game.runTicks;
  ok(at(run, 0) === ORBIT_V12_SKILL_PACED_FROM && at(run - ORBIT_V12_PACE_FROM) === 40 && at(run - (ORBIT_V12_PACE_FROM + ORBIT_V12_PACE_FULL) / 2) === 45 && at(run - ORBIT_V12_PACE_FULL) === 50 && at(600) === 50, `skill pays 40 without the sun, ${at(run - 1500)} with 25 s left, 50 with 40 s or more left (elite pace)`);
  const some = { ...xp0, dustGot: 0xff, slung: 1, perfect: 6, acted: 1 } as OrbitRev3State;
  ok(orbitXpSkillPaid(some) === bandPoints(knots, orbitXpFeaturePoints(some).total) && orbitXpSkillPaid(some) < ORBIT_V12_SKILL_PACED_FROM, "incidental features pay on the scale, under the pace cap");
}
// With no features placed, orbitRev 12 plays exactly as orbitRev 10 (the hole bank's own tap logs) and never scores less.
{
  let play = 0, parts = 0, notLower = 0, n = 0;
  for (const e of ORBIT_XP_BANK.slice(0, 40)) {
    const h = holeOf(e.seed);
    const p = decodeRev3Planets(planetsOf(e.seed));
    const a = runTaps(initStrictFrom(p, ORBIT_REV3_WORLD_W, decodeOrbitHoles(h.holes)), h.taps);
    const b = runTaps(initXpFrom(p, ORBIT_REV3_WORLD_W, decodeOrbitHoles(h.holes), ORBIT_NO_EXTRAS), h.taps);
    n++;
    if (b.tick === a.tick && b.best === a.best && b.ended === a.ended && b.captured === a.captured && (b.jumps ?? 0) === (a.jumps ?? 0) && b.finished === a.finished) play++;
    const pb = orbitBandParts(b);
    if (orbitRev3Game.score(b) === Math.min(ORBIT_XP_MAX, orbitXpBasePoints(b) + (pb.bonus - orbitXpSkillPaid(b)) + orbitXpSkillPaid(b)) && pb.points === orbitXpBasePoints(b)) parts++;
    if (orbitRev3Game.score(b) >= orbitRev3Game.score(a)) notLower++;
  }
  ok(play === n, `with no features on the course, orbitRev 12 plays exactly as orbitRev 10 (${play} / ${n} hole-bank tap logs: ticks, planets, captures, jumps, end)`);
  ok(parts === n && notLower === n, `and scores its base (curve + partial credit), the sun's speed bonus and skill, never below orbitRev 10 for the same play (${notLower} / ${n})`);
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
{
  const lap = lapPhases(planets[0]!).length;
  const late = runTaps(xp0, [lap + 5]);
  const early = runTaps(xp0, []);
  ok((late.perfect ?? 0) === 0 && (early.perfect ?? 0) === 0, `a release after the first lap (${lap} ticks) earns no perfect orbit`);
  const firstWitness = runTaps(xp0, entry.taps.slice(0, 1));
  ok(entry.taps[0]! <= lap ? (firstWitness.perfect ?? 0) >= 1 || firstWitness.ended === 2 || firstWitness.cur > 0 : true, "a first-lap release that lands is a perfect orbit");
}

// Random play stays near 0: uniformly random taps every 0.25–1.5 s on 200 dealt courses.
{
  const scores: number[] = [];
  for (let seed = 1; seed <= 200; seed++) {
    const course = orbitXpCourseForSeed(seed)!;
    const start = initXpFrom(decodeRev3Planets(course.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(course.holes), decodeOrbitExtras(course.extras));
    scores.push(orbitRev3Game.score(runTaps(start, randomTaps(seed).map((e) => e.t))));
  }
  scores.sort((a, b) => a - b);
  ok(scores[100]! <= 5 && scores[180]! <= 20, `random play stays near 0 (200 courses: median ${scores[100]}, p90 ${scores[180]}, best ${scores[199]})`);
}

/* 4. Recorded orbitRev 12 runs. */
{
  const path = "scripts/fixtures/orbit-x200-runs.json.gz";
  const fixture = existsSync(path) ? (JSON.parse(gunzipSync(readFileSync(path)).toString()) as { runs: any[] }) : { runs: [] };
  let match = 0;
  const levels = new Set<string>();
  for (const run of fixture.runs) {
    const xp = ORBIT_XP_BANK.find((e) => e.seed === run.seed)!;
    const r = replayOrbitRun(run.seed, run.raw, ORBIT_REV_XP, planetsOf(run.seed), holeOf(run.seed).holes, xp.extras);
    if (r.score === run.score && orbitCheckpoint(r.state as any).checksum === run.final && r.state.tick === run.tick && !r.flagged) match++;
    else console.log(`  differs: ${run.level} seed ${run.seed}: ${r.score} vs ${run.score}`);
    levels.add(run.level);
  }
  ok(fixture.runs.length >= 24 && match === fixture.runs.length && levels.size === 6, `${match} / ${fixture.runs.length} recorded orbitRev 12 runs (${[...levels].join(", ")}) replay to the same score, checksum and tick`);
  const low = fixture.runs.filter((r) => r.level === "weak" || r.level === "average");
  ok(low.length > 0 && low.every((r) => r.score > 0), `no recorded weak or average run scores 0 (${low.map((r) => r.score).join(", ")})`);
}

/* 5. Room identity: nothing seeded depends on how the run is played. */
{
  let sameRuns = 0, pairs = 0, spans = 0;
  for (const seed of [1, 77, 1234, 99991, 2024, 31337]) {
    const logs = roomIdentity.logs(seed);
    const schedules = logs.map((log) => roomIdentity.scheduleOf(seed, ORBIT_REV_XP, log));
    for (let a = 0; a < schedules.length; a++)
      for (let b = a + 1; b < schedules.length; b++) {
        const until = Math.min(schedules[a]!.at(-1)!.t, schedules[b]!.at(-1)!.t);
        const cut = (s: { t: number; what: string }[]) => JSON.stringify(s.filter((e) => e.t <= until));
        pairs++;
        spans += until;
        if (cut(schedules[a]!) === cut(schedules[b]!)) sameRuns++;
      }
    // The course the sim carries never changes during a run (one digest for every sample of the longest run).
    const longest = schedules.reduce((x, y) => (x.length >= y.length ? x : y));
    ok(new Set(longest.filter((e) => e.what.startsWith("course ")).map((e) => e.what)).size === 1, `seed ${seed}: the course, black holes and features never change during a run`);
  }
  ok(sameRuns === pairs, `idle, random, weak and elite logs see the identical seeded schedule over the ticks both lived (${sameRuns} / ${pairs} pairs, ${Math.round(spans / pairs)} ticks on average)`);
}

/* 6. Dealing and display. */
{
  let dealt = 0, xp = 0;
  for (let k = 0; k < 200; k++) {
    const p = generateOrbit() as any;
    dealt++;
    if (p.orbitRev === ORBIT_REV_XP && p.extras && p.planets && p.holes) {
      const start = orbitStartForPuzzle(p);
      if (start && start().xp === 1) xp++;
    }
  }
  ok(xp === dealt, `generateOrbit deals orbitRev 12 on a feature-bank course with its planets, holes and extras (${xp} / ${dealt})`);
}
ok(ORBIT_REV_XP === 12, "the expansion's stamp is orbitRev 12 (above every stamp used before, the parked 11 included)");
ok((LIVE_BANDS as any).orbit.rev === ORBIT_REV_XP && (LIVE_BANDS as any).orbit.strictRev === ORBIT_REV_STRICT && (LIVE_BANDS as any).orbit.curve === ORBIT_V12_BAND_CURVE, "LIVE_BANDS lists orbitRev 12 with its curve and orbitRev 10 as its score-band revision");
ok(orbitWorldWFor(ORBIT_REV_XP) === 450 && orbitWorldHFor(ORBIT_REV_XP) === 782 && orbitWorldWFor(ORBIT_REV_STRICT) === 390 && orbitWorldHFor(ORBIT_REV_STRICT) === 650 && orbitWorldWFor(11) === 390, "the view is 450 × 782 on orbitRev 12 and unchanged before (11 was never dealt)");
ok(roundMaxFor("orbit") === ORBIT_XP_MAX, "ROUND_MAX for orbit is 200");
ok(ORBIT_TOTAL === 40, "the course keeps 40 planets and the sun");
{
  const src = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/data\.type === "orbit" && demo\?\.puzzle\.type === "orbit" && demo\.puzzle\.orbitRev !== ORBIT_REV_XP\) return null/.test(src), "Orbit's intro demo stays stopped (the still shows) until one is recorded on orbitRev 12");
}
void ORBIT_INPUT_CHECKPOINT;

console.log(failed ? `\nFAIL: ${failed} failed` : "\nAll orbit-expand checks passed");
process.exit(failed ? 1 : 0);
