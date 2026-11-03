/**
 * orbit-fuel-check: Orbit orbitRev 14, the fuel meter (1 Nov 2026, docs/arcade-standard/orbit.md "orbitRev 14").
 *
 *  1. Legacy: 96 runs on orbitRev 10, 12 and 13 recorded on main before the change (scripts/orbit-fuel-legacy.ts,
 *     scripts/fixtures/orbit-fuel-legacy.json: witness, late, checkpoint and random logs) replay through the server's
 *     path to the same score and final state.
 *  2. The fuel bank (src/lib/duel/orbitFuelBank.server.ts): every course has 41 planets, 3 black holes, 5 × 6 motes,
 *     4 moons and 3 fields; its witness replays through the server on orbitRev 14 to the sun with every feature, 2+ of
 *     the 3 black holes (a witness may catch a planet past a hole's), 21+ perfect orbits and half the run left (200), and every witness flight lands with at least a quarter
 *     of the tank (ORBIT_FUEL_MAX − ORBIT_FUEL_HOP_MAX) to spare. Each course's planets rebuild from its stored `build`
 *     (scripts/orbit-fuel-lib.ts) for the first two entries (CHECKS_FULL=1: every one).
 *  3. The rules: fuel stays full in orbit, drains one a tick of free flight and refills on a catch; a release into
 *     empty space ends exactly ORBIT_FUEL_MAX ticks later (run over, "out of fuel", at least 1 point), or respawns at
 *     the checkpoint with a full tank; a flight leaving the world's sides flies on; any planet catches (far ahead,
 *     the planets jumped past counting for core; behind, the furthest reached kept); older starts carry no fuel.
 *  4. The zigzag: the bank's courses never step straight up (every step 40+ px sideways; orbitRev 13's do), turn more
 *     often than orbitRev 13's, and fewer misses (any release on a full tank) are caught three or more planets on.
 *  5. The flight camera (the still camera since Nov 2026): on witness runs the planet each flight lands on is in view before it arrives; the camera
 *     never jumps in flight.
 *  6. Dealing and text: generateOrbit deals orbitRev 14 on a fuel-bank course (pinOrbitPreFuel deals orbitRev 13 as
 *     before), LIVE_BANDS and ORBIT_STD carry 14, the help describes the fuel, and the intro demo waits for one recorded
 *     on orbitRev 14.
 *  7. The sputter (display only): a run that ends dry animates for 0.6 s on the same ended state and the stage holds
 *     its submit that long; nothing else holds.
 *
 *   bun scripts/orbit-fuel-check.ts
 */
import { readFileSync } from "node:fs";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { FP, orbitCheckpoint, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP, ORBIT_REV_FUEL, ORBIT_REV_STD, ORBIT_REV_XP, ORBIT_TOTAL, orbitXpRev } from "../src/lib/arcade/orbit";
import {
  decodeOrbitExtras,
  decodeOrbitHoles,
  decodeRev3Planets,
  encodeRev3Planets,
  initFuelFrom,
  initStdFrom,
  orbitRev3Extra,
  orbitRev3Game,
  orbitRev3StartFor,
  orbitStdScore,
  orbitXpCounts,
  ORBIT_FUEL_HOP_MAX,
  ORBIT_FUEL_MAX,
  ORBIT_REV3_WORLD_W,
  ORBIT_STD,
  ORBIT_V13_BAND_CURVE,
  ORBIT_V14_BAND_CURVE,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import { orbitCamera, orbitCameraResetCache, orbitViewH, orbitViewW } from "../src/lib/arcade/orbitCamera";
import { createCanvas } from "@napi-rs/canvas";
import { orbitEndHoldMs, orbitRev3ArtGame, ORBIT_SPUTTER_MS, setOrbitSputterClock } from "../src/lib/arcade/orbit.renderer";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { encodeOrbitRun, replayOrbitRun } from "../src/lib/duel/orbit";
import { ORBIT_FUEL_BANK, type OrbitFuelBankEntry } from "../src/lib/duel/orbitFuelBank.server";
import { ORBIT_XP_BANK } from "../src/lib/duel/orbitXpBank.server";
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";
import { generateOrbit, pinOrbitPreFuel } from "../src/lib/duel/arcade.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { grade, pick, type OrbitLegacyRun } from "./orbit-fuel-legacy";
import { buildFuelCourseRaw, farRate, fuelWitnessRun } from "./orbit-fuel-lib";

let failed = 0;
let passed = 0;
function ok(cond: boolean, label: string): void {
  if (cond) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}`);
  }
}
const FULL = process.env.CHECKS_FULL === "1";
const ev = (t: number, k: number): ArcadeInputEvent => ({ t, k, a: 0, b: 0, c: 0, d: 0 });
const startOf = (e: OrbitFuelBankEntry) => initFuelFrom(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras));
const step = (s: OrbitRev3State, input: ArcadeInputEvent | null = null) => orbitRev3Game.step(s, input) as OrbitRev3State;

/* 1. Legacy. */
{
  const runs = JSON.parse(readFileSync("scripts/fixtures/orbit-fuel-legacy.json", "utf8")) as OrbitLegacyRun[];
  let same = 0;
  for (const r of runs) {
    const g = grade(r.rev, r.seed, r.raw);
    const st = pick(g.state as OrbitRev3State);
    if (!g.flagged && g.score === r.score && JSON.stringify(st) === JSON.stringify(r.state)) same++;
    else console.log(`  legacy differs: rev ${r.rev} course ${r.seed} ${r.label}: score ${g.score} (was ${r.score})`);
  }
  ok(runs.length === 96 && same === runs.length, `legacy: ${same} / ${runs.length} orbitRev 10, 12 and 13 runs recorded on main replay to the same score and state`);
  ok(new Set(runs.map((r) => r.rev)).size === 3, "legacy: the fixture covers orbitRev 10, 12 and 13");
}

/* 2. The fuel bank. */
{
  ok(ORBIT_FUEL_BANK.length >= 40, `the fuel bank holds ${ORBIT_FUEL_BANK.length} courses (at least 40)`);
  let shaped = 0, perfect = 0, spare = 0, minFuel = ORBIT_FUEL_MAX, minPerfect = 99, slowest = 0;
  for (const e of ORBIT_FUEL_BANK) {
    const x = decodeOrbitExtras(e.extras);
    if (e.planets.length === ORBIT_TOTAL + 1 && e.holes.length === 3 && x.dust.length === 30 && x.moons.length === 4 && x.fields.length === 3) shaped++;
    // The server's replay of the witness log, as the phone sends it.
    let s = startOf(e);
    const taps = new Set(e.taps);
    const events: ArcadeInputEvent[] = [];
    const checkpoints: unknown[] = [];
    while (!s.ended && s.tick < orbitRev3Game.runTicks) {
      const input = taps.has(s.tick + 1) ? ev(s.tick + 1, ORBIT_INPUT_TAP) : null;
      if (input) events.push(input);
      s = step(s, input);
      if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
    }
    const raw = encodeOrbitRun({ seed: e.seed, claimedScore: orbitRev3Game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
    const r = replayOrbitRun(e.seed, raw, ORBIT_REV_FUEL, e.planets, e.holes, e.extras);
    const st = r.state as OrbitRev3State;
    const c = orbitXpCounts(st);
    if (!r.flagged && r.score === 200 && st.finished === 1 && (st.jumps ?? 0) >= 2 && c.dust === 30 && c.slings === 4 && c.threads === 3 && c.perfect >= 21) perfect++;
    else console.log(`  course ${e.seed}: witness scored ${r.score} (finished ${st.finished}, jumps ${st.jumps}, dust ${c.dust}, slings ${c.slings}, threads ${c.threads}, perfect ${c.perfect})`);
    minPerfect = Math.min(minPerfect, c.perfect);
    slowest = Math.max(slowest, st.endedTick);
    const w = fuelWitnessRun(decodeRev3Planets(e.planets), decodeOrbitHoles(e.holes), x, e.taps);
    minFuel = Math.min(minFuel, w.minFuel);
    if (w.minFuel >= ORBIT_FUEL_MAX - ORBIT_FUEL_HOP_MAX) spare++;
  }
  ok(shaped === ORBIT_FUEL_BANK.length, `every course carries 40 planets and the sun, 3 black holes, 30 motes, 4 moons and 3 fields (${shaped} / ${ORBIT_FUEL_BANK.length})`);
  ok(perfect === ORBIT_FUEL_BANK.length, `every course's witness replays through the server to 200 on orbitRev 14 with every feature and 2+ black holes (${perfect} / ${ORBIT_FUEL_BANK.length}; perfect orbits ≥ ${minPerfect}, slowest sun at tick ${slowest})`);
  ok(slowest <= orbitRev3Game.runTicks / 2, "every witness reaches the sun with half the run left (full speed)");
  ok(spare === ORBIT_FUEL_BANK.length, `every witness flight lands with at least ${ORBIT_FUEL_MAX - ORBIT_FUEL_HOP_MAX} fuel to spare (least ${minFuel} of ${ORBIT_FUEL_MAX})`);
  const rebuild = FULL ? ORBIT_FUEL_BANK : ORBIT_FUEL_BANK.slice(0, 2);
  let rebuilt = 0;
  for (const e of rebuild) {
    const planets = buildFuelCourseRaw(e.build);
    if (JSON.stringify(e.planets) === JSON.stringify(encodeRev3Planets(planets))) rebuilt++;
  }
  ok(rebuilt === rebuild.length, `each course's planets rebuild from its stored build seed (${rebuilt} / ${rebuild.length}${FULL ? "" : ", CHECKS_FULL=1 for all"})`);
}

/* 3. The rules. */
{
  const e = ORBIT_FUEL_BANK[0]!;
  const s0 = startOf(e);
  ok(s0.fuel === ORBIT_FUEL_MAX && s0.std === 1 && s0.xp === 1, "orbitRev 14 starts with a full tank on orbitRev 13's features and parts");
  // In orbit: no drain.
  let s = s0;
  for (let k = 0; k < 200; k++) s = step(s);
  ok(s.fuel === ORBIT_FUEL_MAX && s.flying === 0, "fuel stays full while the rocket orbits");
  // The witness's first hop: one a tick in flight, full again on the catch.
  s = s0;
  const firstTap = e.taps[0]!;
  while (s.tick + 1 < firstTap) s = step(s);
  s = step(s, ev(s.tick + 1, ORBIT_INPUT_TAP));
  let drainOk = true;
  let ticks = 0;
  while (s.flying > 0) {
    const before = s.fuel!;
    s = step(s);
    ticks++;
    if (s.flying > 0 && s.fuel !== before - 1) drainOk = false;
  }
  ok(drainOk && ticks > 5, `free flight burns one unit a tick (${ticks} ticks)`);
  ok(s.cur === 1 && s.fuel === ORBIT_FUEL_MAX, "the catch fills the tank again");
  // A release into empty space: the delay whose flight is caught by nothing.
  let dry: OrbitRev3State | null = null;
  let dryTap = -1;
  for (let d = 0; d < 400 && !dry; d++) {
    let f = s0;
    for (let k = 0; k < d; k++) f = step(f);
    const at = f.tick + 1;
    f = step(f, ev(at, ORBIT_INPUT_TAP));
    while (!f.ended && f.flying > 0) f = step(f);
    if (f.ended === 2 && f.dry === f.endedTick) {
      dry = f;
      dryTap = at;
    }
  }
  ok(dry !== null, "a release into empty space runs the tank dry");
  if (dry) {
    // The release tick is the flight's first (it moves and burns a unit), so the tank's last unit goes on tick release + MAX − 1.
    ok(dry.endedTick - dryTap + 1 === ORBIT_FUEL_MAX, `the run ends after exactly ${ORBIT_FUEL_MAX} ticks of flight, the release tick included (${dry.endedTick - dryTap + 1})`);
    ok(dry.fuel === 0 && orbitRev3Extra(dry).outOfFuel === true && orbitRev3Extra(s0).outOfFuel === false, "the extra records the run as out of fuel");
    const score = orbitRev3Game.score(dry);
    ok(score >= 1, `a run that ran dry still scores at least 1 (${score})`);
    // With the checkpoint set first: a respawn with a full tank.
    let c = step(s0, ev(1, ORBIT_INPUT_CHECKPOINT));
    while (c.tick + 1 < dryTap) c = step(c);
    c = step(c, ev(c.tick + 1, ORBIT_INPUT_TAP));
    while (!c.ended && c.flying > 0) c = step(c);
    ok(c.ended === 0 && c.respawns === 0 && c.fuel === ORBIT_FUEL_MAX && c.cur === 0, "with the checkpoint set, running dry respawns there with a full tank");
  }
  // Off the world's side: flies on while there is fuel (no off-world end on orbitRev 14).
  {
    const f = { ...s0, flying: 1, x: -40 * FP, y: s0.y, vx: -4 * FP, vy: 0, fuel: 30 };
    let g = f as OrbitRev3State;
    for (let k = 0; k < 20; k++) g = step(g);
    ok(g.ended === 0 && g.flying > 0 && g.fuel === 10, "a flight beyond the world's side flies on while fuel lasts");
  }
  // Any planet catches: a flight placed just outside planet 7's orbit, moving in, from planet 1.
  {
    const p = s0.planets[7]!;
    const from = { x: p.x + p.ring + 3 * FP, y: p.y };
    const f = { ...s0, cur: 1, best: 1, flying: 5, x: from.x, y: from.y, vx: -4 * FP, vy: 0, fuel: 100, perfect: 0 } as OrbitRev3State;
    let g = f;
    for (let k = 0; k < 4 && g.flying > 0; k++) g = step(g);
    ok(g.cur === 7 && g.best === 7 && g.fuel === ORBIT_FUEL_MAX, "a planet six on catches the rocket (orbitRev 13 catches only the next two)");
    const core = orbitStdScore(g).core;
    ok(core === Math.floor((130 * 7 * 16) / 640), `the planets jumped past count for core (${core} for 7)`);
    const old = { ...f, fuel: undefined, dry: undefined } as OrbitRev3State;
    let h = old;
    for (let k = 0; k < 4 && h.flying > 0 && !h.ended; k++) h = step(h);
    ok(h.cur === 1, "orbitRev 13's rules (no fuel) do not catch it");
    // Behind: planet 0 from planet 3, the furthest reached kept.
    const q = s0.planets[0]!;
    const back = { ...s0, cur: 3, best: 3, flying: 5, x: q.x + q.ring + 3 * FP, y: q.y, vx: -4 * FP, vy: 0, fuel: 100 } as OrbitRev3State;
    let b = back;
    for (let k = 0; k < 4 && b.flying > 0; k++) b = step(b);
    ok(b.cur === 0 && b.best === 3, "a planet behind catches too, and the furthest planet reached is kept");
  }
  // Older starts carry no fuel; the start for 14 does.
  const planets = decodeRev3Planets(e.planets), holes = decodeOrbitHoles(e.holes), extras = decodeOrbitExtras(e.extras);
  ok(initStdFrom(planets, ORBIT_REV3_WORLD_W, holes, extras).fuel === undefined && orbitRev3StartFor(ORBIT_REV_STD, extras)!(planets, ORBIT_REV3_WORLD_W, holes).fuel === undefined, "orbitRev 13 starts carry no fuel");
  ok(orbitRev3StartFor(ORBIT_REV_FUEL, extras)!(planets, ORBIT_REV3_WORLD_W, holes).fuel === ORBIT_FUEL_MAX, "the orbitRev 14 start carries a full tank");
  ok(orbitXpRev(ORBIT_REV_FUEL) && orbitXpRev(ORBIT_REV_STD) && orbitXpRev(ORBIT_REV_XP) && !orbitXpRev(11), "orbitRev 14 keeps the expansion's view, features and corner");
}

/* 4. The zigzag. */
{
  const n = 8;
  const stats = (rows: OrbitRev3State["planets"][]) => {
    let lat = 0, steps = 0, turns = 0, releases = 0, far = 0, straight = 0;
    for (const p of rows) {
      for (let i = 1; i <= ORBIT_TOTAL; i++) {
        const side = Math.abs(p[i]!.x - p[i - 1]!.x) / FP;
        lat += side;
        if (side < 40) straight++;
        steps++;
        if (i >= 2 && Math.sign(p[i]!.x - p[i - 1]!.x) !== Math.sign(p[i - 1]!.x - p[i - 2]!.x)) turns++;
      }
      const f = farRate(p);
      releases += f.releases;
      far += f.far;
    }
    return { lat: lat / steps, turns: turns / steps, far: far / releases, straight: straight / steps };
  };
  const planetsOf = new Map(ORBIT_REV3_BANK.map((x) => [x.seed, x.planets]));
  const old = stats(ORBIT_XP_BANK.slice(0, n).map((x) => decodeRev3Planets(planetsOf.get(x.seed)!)));
  const now = stats(ORBIT_FUEL_BANK.slice(0, n).map((x) => decodeRev3Planets(x.planets)));
  // Softened on 2 Nov 2026 (the middle levels back): the steps are about as long sideways as orbitRev 13's on average,
  // but never straight up, and they turn far more often.
  const straightAll = ORBIT_FUEL_BANK.reduce((sum, x) => {
    const p = decodeRev3Planets(x.planets);
    let k = 0;
    for (let i = 1; i <= ORBIT_TOTAL; i++) if (Math.abs(p[i]!.x - p[i - 1]!.x) / FP < 40) k++;
    return sum + k;
  }, 0);
  ok(straightAll === 0 && old.straight > 0, `no step on any fuel-bank course goes straight up (every step 40+ px sideways, ${now.lat.toFixed(0)} px a planet on average; orbitRev 13's courses ${(old.straight * 100).toFixed(1)} % under 40 px, ${old.lat.toFixed(0)} px a planet)`);
  ok(now.turns > old.turns, `and turns more often (${(now.turns * 100).toFixed(0)} % of steps, orbitRev 13's ${(old.turns * 100).toFixed(0)} %)`);
  ok(now.far < old.far, `fewer misses are caught three or more planets on (${(now.far * 100).toFixed(2)} % of releases, orbitRev 13's courses ${(old.far * 100).toFixed(2)} %)`);
}

/* 5. The flight camera. */
{
  let flights = 0, seen = 0, maxStep = 0, leadMin = Infinity;
  for (const e of ORBIT_FUEL_BANK.slice(0, 4)) {
    orbitCameraResetCache();
    let s = startOf(e);
    const taps = new Set(e.taps);
    let prev = orbitCamera(s);
    let flightStart = -1;
    let inView = -1;
    while (!s.ended && s.tick < orbitRev3Game.runTicks) {
      const before = s;
      s = orbitRev3ArtGame.step(s, taps.has(s.tick + 1) ? ev(s.tick + 1, ORBIT_INPUT_TAP) : null) as OrbitRev3State;
      const cam = orbitCamera(s);
      // Flight ticks only (orbitRev 14's still camera: a catch's pan running on into a flight, the edge-follow; a black
      // hole's cut to its target is every revision's).
      if (before.flying > 0 && s.flying > 0) maxStep = Math.max(maxStep, Math.hypot(cam.x - prev.x, cam.y - prev.y));
      prev = cam;
      if (before.flying === 0 && s.flying > 0) {
        flightStart = s.tick;
        inView = -1;
      }
      if (s.flying > 0) {
        // The planet this flight will land on, from the witness (where the rocket is next caught).
        let f = s;
        while (f.flying > 0 && !f.ended) f = step(f);
        const target = f.planets[f.cur]!;
        const tx = target.x / FP - cam.x, ty = target.y / FP - cam.y;
        const W = orbitViewW(s), H = orbitViewH(s);
        if (inView < 0 && tx >= 0 && tx <= W && ty >= 0 && ty <= H) inView = s.tick;
      }
      if (before.flying > 0 && s.flying === 0 && (s.warp ?? 0) === 0 && s.tick - flightStart >= 20) {
        flights++;
        if (inView >= 0 && s.tick - inView >= 8) seen++;
        if (inView >= 0) leadMin = Math.min(leadMin, s.tick - inView);
      }
    }
  }
  ok(flights > 50 && seen === flights, `the planet each flight lands on is in view at least 8 ticks before it arrives (${seen} / ${flights} flights of 20+ ticks; least ${leadMin} ticks)`);
  ok(maxStep <= 24, `the flight camera never jumps (largest step in flight ${maxStep.toFixed(1)} px a tick)`);
}

/* 6. Dealing and text. */
{
  let fuel = 0;
  for (let k = 0; k < 60; k++) {
    const p = generateOrbit();
    if (p.orbitRev === ORBIT_REV_FUEL && p.extras && p.planets?.length === ORBIT_TOTAL + 1 && ORBIT_FUEL_BANK.some((e) => JSON.stringify(e.planets) === JSON.stringify(p.planets))) fuel++;
  }
  ok(fuel === 60, `generateOrbit deals orbitRev 14 on a fuel-bank course (${fuel} / 60)`);
  const was = pinOrbitPreFuel(true);
  const old = generateOrbit();
  pinOrbitPreFuel(was);
  ok(old.orbitRev === ORBIT_REV_STD && ORBIT_XP_BANK.length > 0, "pinned, it deals orbitRev 13 on a feature-bank course as before");
  ok((LIVE_BANDS as Record<string, { rev: number; curve: unknown }>).orbit!.rev === ORBIT_REV_FUEL && ORBIT_STD.rev === ORBIT_REV_FUEL, "LIVE_BANDS and ORBIT_STD carry orbitRev 14");
  ok(JSON.stringify(ORBIT_V14_BAND_CURVE) === JSON.stringify(ORBIT_V13_BAND_CURVE) && ORBIT_STD.parts.reduce((a, p) => a + p.max, 0) === 200, "orbitRev 14 keeps orbitRev 13's straight core line and six parts (200)");
  const help = PUZZLE_INSTRUCTIONS.orbit;
  ok(help.how.some((h) => /Fuel/.test(h.action) && /drains only while you fly/.test(h.detail)) && /jump past counts/.test(help.score), "the help explains the fuel and that a planet jumped past counts");
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/data\.type === "orbit" && demo\?\.puzzle\.type === "orbit" && demo\.puzzle\.orbitRev !== ORBIT_REV_FUEL\) return null/.test(demo), "Orbit's intro demo stays stopped until one is recorded on orbitRev 14");
}

/* 7. The sputter (display only): a run that ends dry animates for ORBIT_SPUTTER_MS on the presentation clock (the sim
 * is not stepped: the state drawn is the same ended state), the stage holds its submit for that long, and nothing
 * else holds. */
{
  const e = ORBIT_FUEL_BANK[0]!;
  const s0 = startOf(e);
  let dry: OrbitRev3State | null = null;
  for (let d = 0; d < 400 && !dry; d++) {
    let f = s0;
    for (let k = 0; k < d; k++) f = step(f);
    f = step(f, ev(f.tick + 1, ORBIT_INPUT_TAP));
    while (!f.ended && f.flying > 0) f = step(f);
    if (f.ended === 2 && f.dry === f.endedTick) dry = f;
  }
  ok(dry !== null && orbitEndHoldMs(dry) === ORBIT_SPUTTER_MS && ORBIT_SPUTTER_MS >= 500 && ORBIT_SPUTTER_MS <= 700, `a run that ended dry holds its submit ${ORBIT_SPUTTER_MS} ms for the sputter`);
  let witnessEnd = startOf(e);
  const taps = new Set(e.taps);
  while (!witnessEnd.ended) witnessEnd = step(witnessEnd, taps.has(witnessEnd.tick + 1) ? ev(witnessEnd.tick + 1, ORBIT_INPUT_TAP) : null);
  const stdEnd = { ...witnessEnd, fuel: undefined, dry: undefined } as OrbitRev3State;
  ok(orbitEndHoldMs(witnessEnd) === 0 && orbitEndHoldMs(stdEnd) === 0 && orbitEndHoldMs(s0) === 0, "a finished run, an older revision's run and a live run hold nothing");
  if (dry) {
    const frozen = JSON.stringify(dry);
    const canvas = createCanvas(450, 862);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    const frameAt = (ms: number) => {
      setOrbitSputterClock(() => ms);
      orbitRev3ArtGame.draw(ctx, dry!, { width: 450, height: 862 });
      return Buffer.from(canvas.toBuffer("image/png")).toString("base64");
    };
    // The other presentation-clock effects (catch glow, success layer) held still too, so only the sputter can move.
    const realNow = performance.now.bind(performance);
    Object.defineProperty(performance, "now", { value: () => 50_000, configurable: true, writable: true });
    const frames = [0, 150, 300, 450, ORBIT_SPUTTER_MS + 100, ORBIT_SPUTTER_MS + 900].map(frameAt);
    Object.defineProperty(performance, "now", { value: realNow, configurable: true, writable: true });
    setOrbitSputterClock(null);
    ok(new Set(frames.slice(0, 5)).size === 5, "the sputter moves through its 0.6 s on the same ended state (smoke, the rocket dropping away, the meter flashing)");
    ok(frames[4] === frames[5], "after the sputter the frame holds still (the run's last frame)");
    ok(JSON.stringify(dry) === frozen, "drawing the sputter never writes to the state");
  }
}

console.log(failed ? `\nFAIL orbit-fuel-check: ${failed} failed, ${passed} passed` : `\nPASS orbit-fuel-check: ${passed} checks`);
process.exit(failed ? 1 : 0);
