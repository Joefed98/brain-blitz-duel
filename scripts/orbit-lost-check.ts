/**
 * orbit-lost-check (~60 s; CHECKS_FULL=1 sweeps more releases): Orbit orbitRev 17, the lost flight (D5 item H4;
 * docs/arcade-standard/orbit.md "orbitRev 17"): orbitRev 16's play at every level, except that a flight that can no
 * longer reach anything ends at once (orbitFlightLost) and takes the slip's usual path (SET CHECKPOINT's respawn, else
 * grace's 3 s hold), instead of burning the rest of the tank in empty space.
 *
 *  1. orbitRev 16 is untouched: the 144 runs recorded on it at every level before orbitRev 17
 *     (scripts/fixtures/orbit-lost-legacy.json.gz, scripts/orbit-lost-legacy-record.ts) regrade through gradeAnswer to
 *     the same score, verdict, count, stored extra and final checkpoint; the 120 orbitRev 12–15 runs
 *     (scripts/fixtures/orbit-big-legacy.json) replay to the same score, end tick and checksum.
 *  2. The deal: Normal and every level deal orbitRev 17 on the course (and level) orbitRev 16 dealt; the era pin
 *     orbitPreLost deals the recorded orbitRev 16 deals byte for byte; orbitPreBig still deals orbitRev 15.
 *  3. The rule never ends a flight that could still be caught, or still earn anything: over every free-flight tick of
 *     the recorded flights and of synthetic releases (a release every few ticks from the recorded runs' orbits), played
 *     on orbitRev 16's rules, wherever orbitFlightLost holds the rest of that flight catches no planet or black hole and
 *     takes no stardust, slingshot or field and no more partial credit (it ends in an empty tank or a crash). The rule
 *     also fires on most flights that end in an empty tank, and saves most of their time.
 *  4. The rule on the sim: a release into empty space ends lost, at least 120 px past the planet's orbit, long before the
 *     tank; then grace's hold (3 s) at the planet left, or with SET CHECKPOINT armed its respawn; orbitRev 16's same
 *     release burns the whole tank. `lost` stays outside the checksum.
 *  5. Every bank witness (Normal and every level's bank) plays on orbitRev 17 tick for tick as on orbitRev 16 (never
 *     lost) and scores exactly 200 through the server replay.
 *  6. A recorded run whose flights are never lost replays on orbitRev 17 exactly as on orbitRev 16.
 *  7. The live stamp: LIVE_BANDS, ORBIT_STD, the view, the extra's `lostFlights` (orbitRev 17 only), PRACTICE_STAMPS.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { orbitCheckpoint, orbitXpRev, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP, ORBIT_REV_BIG, ORBIT_REV_GRACE, ORBIT_REV_LOST, ORBIT_TOTAL } from "../src/lib/arcade/orbit";
import {
  orbitFlightLost,
  orbitRev3Game,
  orbitStartForPuzzle,
  orbitWorldHFor,
  orbitWorldWFor,
  ORBIT_GRACE_HOLD_TICKS,
  ORBIT_LOST_MARGIN,
  ORBIT_STD,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { decodeOrbitRun, encodeOrbitRun, replayOrbitRun } from "../src/lib/duel/orbit";
import { ORBIT_FUEL_BANK, type OrbitFuelBankEntry } from "../src/lib/duel/orbitFuelBank.server";
import { ORBIT_LEVEL_BANKS } from "../src/lib/duel/orbitRev3Course.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { pinOrbitPreBig, pinOrbitPreLost } from "../src/lib/duel/arcade.server";
import { DEAL_PINS } from "../src/lib/duel/dealEra";
import { PRACTICE_STAMPS } from "../src/lib/duel/practiceStamps.data";
import type { PuzzleData } from "../src/lib/duel/types";
import { type Level } from "../src/lib/levels/levels";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { dealAt } from "./level-tune";
import { ORBIT_LOST_LEGACY, orbitFinalCheckpoint, stableExtra, type OrbitEv, type OrbitLegacyFixture } from "./orbit-lost-legacy-record";

let failures = 0;
let passes = 0;
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures++;
    console.log(`FAIL ${label}`);
  }
};
const full = process.env["CHECKS_FULL"] === "1";
const json = (x: unknown) => JSON.stringify(x);
const ev = (t: number, k = ORBIT_INPUT_TAP): ArcadeInputEvent => ({ t, k, a: 0, b: 0, c: 0, d: 0 });
const step = (s: OrbitRev3State, input: ArcadeInputEvent | null) => orbitRev3Game.step(s, input) as OrbitRev3State;
const LEVELS: Level[] = ["normal", "easy", "hard", "expert"];

type Puzzle = { type: "orbit"; seed: number; orbitRev: number; planets: OrbitFuelBankEntry["planets"]; holes: OrbitFuelBankEntry["holes"]; extras: OrbitFuelBankEntry["extras"]; level?: string };
const asRev = (p: Puzzle, rev: number): Puzzle => ({ ...p, orbitRev: rev });
const startOf = (p: Puzzle) => orbitStartForPuzzle(p)!();
const puzzleOfEntry = (e: OrbitFuelBankEntry, rev: number, level?: string): Puzzle => ({ type: "orbit", seed: e.seed, orbitRev: rev, planets: e.planets, holes: e.holes, extras: e.extras, ...(level ? { level } : {}) });

/** A run of `events` on the puzzle, played as the phone does, then replayed by the server (and its checkpoints). */
function serverRun(p: Puzzle, events: readonly ArcadeInputEvent[]) {
  const at = new Map(events.map((x) => [x.t, x]));
  let s = startOf(p);
  const checkpoints: { checksum: number }[] = [];
  while (!s.ended && s.tick < orbitRev3Game.runTicks) {
    s = step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
  }
  const raw = encodeOrbitRun({ seed: p.seed, claimedScore: orbitRev3Game.score(s), events: [...events], inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  const r = replayOrbitRun(p.seed, raw, p.orbitRev, p.planets, p.holes, p.extras, undefined, p.level);
  return { ...r, raw, phone: s, checkpoints };
}

/** The events a recorded raw answer carries, as the server decodes them. */
function eventsOf(raw: string): OrbitEv[] {
  return ((decodeOrbitRun(raw) as { events?: OrbitEv[] }).events ?? []).map((e) => ({ t: e.t, k: e.k, a: e.a, b: e.b, c: e.c, d: e.d }));
}

const fixture = JSON.parse(gunzipSync(readFileSync(ORBIT_LOST_LEGACY)).toString()) as OrbitLegacyFixture;
const puzzleAt = (i: number) => JSON.parse(fixture.puzzles[i]!) as Puzzle;

/* 1. orbitRev 16 is untouched, and every older stamp with it. */
{
  ok(fixture.runs.length === 144 && LEVELS.every((l) => fixture.runs.filter((r) => r.level === l).length === 36), "the legacy fixture holds 36 orbitRev 16 runs at each of the four levels");
  ok(fixture.puzzles.every((p) => (JSON.parse(p) as Puzzle).orbitRev === ORBIT_REV_BIG), "every legacy deal is orbitRev 16");
  let same = 0;
  const bad: string[] = [];
  for (const r of fixture.runs) {
    const puzzle = puzzleAt(r.p) as unknown as PuzzleData;
    const g = gradeAnswer(puzzle, r.raw, 0);
    const cp = orbitFinalCheckpoint(puzzle, r.raw);
    if (g.score === r.score && g.isCorrect === r.isCorrect && (g.correctCount ?? null) === r.correctCount && stableExtra(g.extra) === r.extra && json(cp) === json(r.checkpoint)) same++;
    else bad.push(`${r.level} #${r.n} ${r.kind}: ${r.score} → ${g.score}`);
  }
  ok(same === fixture.runs.length, `${same} of ${fixture.runs.length} orbitRev 16 runs regrade to the same score, verdict, extra and checkpoint${bad.length ? ` (${bad.slice(0, 4).join("; ")})` : ""}`);
  ok(fixture.runs.every((r) => eventsOf(r.raw).length > 0 || r.score === 0), "the recorded logs decode");

  type Run = { rev: number; seed: number; events: ArcadeInputEvent[]; score: number; checkpoint: { checksum: number }; endTick: number };
  const big = JSON.parse(readFileSync("scripts/fixtures/orbit-big-legacy.json", "utf8")) as { runs: Run[] };
  const spec = GAME_BY_TYPE.get("orbit")!;
  let replayed = 0;
  for (const run of big.runs) {
    const game = spec.gameFor(run.rev, run.seed);
    const at = new Map(run.events.map((x) => [x.t, x]));
    let st = game.init(run.seed) as OrbitRev3State;
    const cps: unknown[] = [];
    while (!st.ended && st.tick < orbitRev3Game.runTicks) {
      st = step(st, at.get(st.tick + 1) ?? null);
      if (st.tick % 300 === 0) cps.push(orbitCheckpoint(st as never));
    }
    const raw = encodeOrbitRun({ seed: run.seed, claimedScore: orbitRev3Game.score(st), events: run.events, inputs: [], taps: [], endTick: st.tick, checkpoints: cps } as never);
    const r = spec.replay(run.seed, raw, run.rev);
    if (r.score === run.score && r.state.tick === run.endTick && orbitCheckpoint(r.state as never).checksum === run.checkpoint.checksum && (r.state as OrbitRev3State).lost === undefined) replayed++;
  }
  ok(big.runs.length === 120 && replayed === big.runs.length, `${replayed} of ${big.runs.length} orbitRev 12–15 runs replay to their score, end tick and checksum, without the new flag`);
}

/* 2. The deal. */
{
  for (const level of LEVELS) {
    let same = 0;
    let pinned = 0;
    for (let n = 0; n < 6; n++) {
      const recorded = fixture.puzzles[fixture.runs.find((r) => r.level === level && r.n === n)!.p]!;
      const now = dealAt("orbit", level, n) as unknown as Puzzle;
      if (json(now) === json(asRev(JSON.parse(recorded) as Puzzle, ORBIT_REV_LOST))) same++;
      const prev = pinOrbitPreLost(true);
      try {
        if (json(dealAt("orbit", level, n)) === recorded) pinned++;
      } finally {
        pinOrbitPreLost(prev);
      }
    }
    ok(same === 6, `${level}: ${same} of 6 deals are orbitRev 17 on the course${level === "normal" ? "" : " and level"} orbitRev 16 dealt`);
    ok(pinned === 6, `${level}: with orbitPreLost pinned, ${pinned} of 6 deals are the recorded orbitRev 16 deals byte for byte`);
  }
  const prev = pinOrbitPreBig(true);
  try {
    ok((dealAt("orbit", "normal", 0) as unknown as Puzzle).orbitRev === ORBIT_REV_GRACE, "orbitPreBig still deals orbitRev 15");
  } finally {
    pinOrbitPreBig(prev);
  }
  ok((dealAt("orbit", "normal", 0) as unknown as Puzzle).orbitRev === ORBIT_REV_LOST, "the pins restore: the live deal is orbitRev 17");
  const keys = Object.keys(DEAL_PINS);
  ok(keys.indexOf("orbitPreLost") > keys.indexOf("racingPreCircuits") && keys.indexOf("racingPreCircuits") >= 0 && DEAL_PINS.orbitPreLost.texts === false, "orbitPreLost is a DEAL_PINS entry added at the end (after racingPreCircuits; no text rebuild)");
}

/* 3. The rule never ends a flight that could still be caught or still earn anything. */
interface SweepTotals {
  flights: number;
  lostTicks: number;
  caughtFlights: number;
  dryFlights: number;
  dryFlightsLost: number;
  dryTicks: number;
  savedTicks: number;
  bad: string[];
}
const sweep: SweepTotals = { flights: 0, lostTicks: 0, caughtFlights: 0, dryFlights: 0, dryFlightsLost: 0, dryTicks: 0, savedTicks: 0, bad: [] };
const counters = (s: OrbitRev3State) => json([s.dustGot ?? 0, s.slung ?? 0, s.threaded ?? 0, s.reach ?? 0, s.best, s.captured, s.jumps ?? 0, s.perfect ?? 0]);

/**
 * One free flight from `start` (the tick after the release, flying), played on orbitRev 16's rules to its end: every
 * tick where orbitFlightLost holds, the rest of the flight must catch nothing and earn nothing.
 */
function judgeFlight(start: OrbitRev3State, label: string): OrbitRev3State {
  let s = start;

  const states: OrbitRev3State[] = [];
  while (s.flying > 0 && !s.ended) {
    states.push(s);
    s = step(s, null);
  }
  // `s` is the state the flight ended in: caught (a planet or a black hole: `captured` counts both), the sun, a respawn
  // (the checkpoint's, which may move `cur` back, or grace's) or the run's end.
  const caught = s.captured !== start.captured || s.finished === 1;

  sweep.flights++;
  if (caught) sweep.caughtFlights++;
  const dry = !caught && s.dry === s.tick;
  if (dry) {
    sweep.dryFlights++;
    sweep.dryTicks += states.length;
  }
  const end = counters(s);
  let firstLost = -1;
  for (let i = 0; i < states.length; i++) {
    const st = states[i]!;
    if (!orbitFlightLost(st)) continue;
    sweep.lostTicks++;
    if (firstLost < 0) firstLost = i;
    if (caught || counters(st) !== end) {
      if (sweep.bad.length < 6) sweep.bad.push(`${label} tick ${st.tick}: lost, but the flight ${caught ? "was caught" : "still earned"} (${counters(st)} → ${end})`);
    }
  }
  if (dry && firstLost >= 0) {
    sweep.dryFlightsLost++;
    sweep.savedTicks += states.length - firstLost;
  }
  return s;
}

{
  // (a) Every free flight in the recorded runs, on orbitRev 16 (the recorded play).
  for (const r of fixture.runs) {
    const p = puzzleAt(r.p);
    const at = new Map(eventsOf(r.raw).map((x) => [x.t, x]));
    let s = startOf(p);
    while (!s.ended && s.tick < orbitRev3Game.runTicks) {
      const next = step(s, at.get(s.tick + 1) ?? null);
      if (s.flying === 0 && next.flying > 0 && !next.ended) {
        // A release: judge the flight from here (taps in flight change nothing), then carry on the recorded run.
        judgeFlight(next, `${r.level} #${r.n} ${r.kind}`);
      }
      s = next;
    }
  }
  const recorded = { ...sweep };
  ok(recorded.flights > 3000, `the recorded runs fly ${recorded.flights} flights (${recorded.caughtFlights} caught, ${recorded.dryFlights} ran dry)`);

  // (b) Synthetic releases: from the recorded runs' orbits, a release every `every` ticks, each flown out on orbitRev 16.
  const every = full ? 3 : 17;
  for (const r of fixture.runs.filter((x) => full || x.kind === "elite" || x.kind === "average")) {
    const p = puzzleAt(r.p);
    const at = new Map(eventsOf(r.raw).map((x) => [x.t, x]));
    let s = startOf(p);
    while (!s.ended && s.tick < orbitRev3Game.runTicks) {
      if (s.flying === 0 && !(s.warp ?? 0) && !(s.hold ?? 0) && s.tick % every === 0) {
        const released = step(s, ev(s.tick + 1));
        if (released.flying > 0 && !released.ended) judgeFlight(released, `${r.level} #${r.n} ${r.kind} release@${s.tick + 1}`);
      }
      s = step(s, at.get(s.tick + 1) ?? null);
    }
  }
  ok(sweep.bad.length === 0, `wherever the rule holds (${sweep.lostTicks} ticks of ${sweep.flights} flights, recorded and synthetic), the rest of the flight catches and earns nothing${sweep.bad.length ? `: ${sweep.bad.join("; ")}` : ""}`);
  ok(sweep.flights - recorded.flights > 2000, `${sweep.flights - recorded.flights} synthetic releases flown out`);
  const share = sweep.dryFlights ? sweep.dryFlightsLost / sweep.dryFlights : 0;
  const saved = sweep.dryTicks ? sweep.savedTicks / sweep.dryTicks : 0;
  console.log(`  flights ${sweep.flights}: caught ${sweep.caughtFlights}, ran dry ${sweep.dryFlights}, of those lost early ${sweep.dryFlightsLost} (${(share * 100).toFixed(0)} %), saving ${sweep.savedTicks} of their ${sweep.dryTicks} flight ticks (${(saved * 100).toFixed(0)} %)`);
  ok(share >= 0.6 && saved >= 0.4, `the rule ends most flights that would run dry (${(share * 100).toFixed(0)} %) and saves most of their flight time (${(saved * 100).toFixed(0)} %)`);
}

/* 4. The rule on the sim. */
{
  const e = ORBIT_FUEL_BANK[0]!;
  const p17 = puzzleOfEntry(e, ORBIT_REV_LOST);
  const p16 = puzzleOfEntry(e, ORBIT_REV_BIG);
  ok(startOf(p17).lost === 1 && startOf(p16).lost === undefined, "orbitRev 17 starts carry `lost: 1`, orbitRev 16's don't");
  ok(orbitCheckpoint(startOf(p17) as never).checksum === orbitCheckpoint(startOf(p16) as never).checksum, "the same start checksum (`lost` stays outside it)");
  for (const level of ["easy", "hard", "expert"] as const) {
    const b = ORBIT_LEVEL_BANKS[level][0]!;
    ok(orbitCheckpoint(startOf(puzzleOfEntry(b, ORBIT_REV_LOST, level)) as never).checksum === orbitCheckpoint(startOf(puzzleOfEntry(b, ORBIT_REV_BIG, level)) as never).checksum && startOf(puzzleOfEntry(b, ORBIT_REV_LOST, level)).tank === startOf(puzzleOfEntry(b, ORBIT_REV_BIG, level)).tank, `${level}: the same start (tank, checkpoint rule, checksum) on orbitRev 17`);
  }
  // The first release from the start that misses (flies into empty space, no catch), on both revisions (from tick 2, so
  // SET CHECKPOINT can go first at tick 1).
  let found = false;
  for (let d = 2; d < 400 && !found; d++) {
    const s16 = serverRun(p16, [ev(d)]).state as OrbitRev3State;
    if (s16.best !== 0 || (s16.autoRespawns ?? 0) !== 1 || s16.dry !== s16.respawnTick) continue;
    found = true;
    // The rev-16 flight: released at d, ran dry at s16.dry, the hold after it.
    const dry16 = s16.dry! - d;
    let s = startOf(p17);
    for (let t = 1; t <= d; t++) s = step(s, t === d ? ev(t) : null);
    let lostAt = -1;
    let before = s;
    while (s.flying > 0 && !s.ended) {
      before = s;
      s = step(s, null);
      if (s.lostTick === s.tick) lostAt = s.tick;
    }
    const flew = lostAt - d;
    const here = s.planets[s.cur]!;
    const dx = before.x + before.vx - here.x, dy = before.y + before.vy - here.y;
    ok(lostAt > 0 && s.lostFlights === 1 && s.cur === 0 && s.flying === 0 && s.hold === ORBIT_GRACE_HOLD_TICKS && s.fuel === 160, `a missed release at tick ${d} ends lost at tick ${lostAt} (after ${flew} ticks of flight), back in orbit at planet 0 with a full tank and grace's ${ORBIT_GRACE_HOLD_TICKS}-tick hold`);
    ok(dry16 >= 150 && flew > 0 && flew * 3 < dry16 * 2, `orbitRev 16's same flight burns the tank for ${dry16} ticks; orbitRev 17's ends in ${flew} (under two thirds)`);
    ok(Math.sqrt(dx * dx + dy * dy) >= 120 * 256, `it ended at least 120 px from the planet it left (${Math.round(Math.sqrt(dx * dx + dy * dy) / 256)} px from its centre; margin ${ORBIT_LOST_MARGIN / 256} px past its reach)`);
    // With SET CHECKPOINT armed first, the lost flight uses the checkpoint's respawn (no hold).
    const cp = serverRun(p17, [ev(1, ORBIT_INPUT_CHECKPOINT), ev(d)]).state as OrbitRev3State;
    ok(cp.respawns === 0 && (cp.autoRespawns ?? 0) === 0 && cp.lostFlights === 1, "with SET CHECKPOINT armed, the lost flight spends the checkpoint's respawn instead of the hold");
  }
  ok(found, "a missed release from the first planet was found");
}

/* 5. Every bank witness: tick for tick as on orbitRev 16, never lost, 200 through the server replay. */
{
  const banks: [string, readonly OrbitFuelBankEntry[], string | undefined][] = [
    ["normal", ORBIT_FUEL_BANK, undefined],
    ["easy", ORBIT_LEVEL_BANKS.easy, "easy"],
    ["hard", ORBIT_LEVEL_BANKS.hard, "hard"],
    ["expert", ORBIT_LEVEL_BANKS.expert, "expert"],
  ];
  for (const [name, bank, level] of banks) {
    let fine = 0;
    for (const e of bank) {
      const events = e.taps.map((t) => ev(t));
      const a = serverRun(puzzleOfEntry(e, ORBIT_REV_BIG, level), events);
      const b = serverRun(puzzleOfEntry(e, ORBIT_REV_LOST, level), events);
      const g = gradeAnswer(puzzleOfEntry(e, ORBIT_REV_LOST, level) as unknown as PuzzleData, b.raw, 0);
      if (!b.flagged && b.score === 200 && g.score === 200 && (b.state as OrbitRev3State).lostFlights === 0 && json(a.checkpoints) === json(b.checkpoints) && json(orbitCheckpoint(a.state as never)) === json(orbitCheckpoint(b.state as never))) fine++;
    }
    ok(fine === bank.length && bank.length >= 24, `${name}: ${fine} of ${bank.length} bank witnesses play on orbitRev 17 as on 16 (never lost) and score 200 through the server replay`);
  }
}

/* 6. A recorded run whose flights are never lost replays on orbitRev 17 exactly. */
{
  let untouched = 0, same = 0, changed = 0;
  for (const r of fixture.runs) {
    const p = asRev(puzzleAt(r.p), ORBIT_REV_LOST);
    const out = serverRun(p, eventsOf(r.raw));
    const st = out.state as OrbitRev3State;
    if ((st.lostFlights ?? 0) === 0) {
      untouched++;
      if (out.score === r.score && json(orbitCheckpoint(st as never)) === json(r.checkpoint)) same++;
    } else changed++;
  }
  ok(untouched === same && untouched > 20, `${same} of ${untouched} recorded runs with no lost flight replay on orbitRev 17 exactly as recorded (${changed} others lost at least one flight)`);
}

/* 7. The live stamp. */
{
  ok(ORBIT_REV_LOST === 17 && orbitXpRev(ORBIT_REV_LOST), "orbitRev 17 is on the expansion's features and view");
  ok(orbitWorldHFor(ORBIT_REV_LOST) === orbitWorldHFor(ORBIT_REV_BIG) && orbitWorldWFor(ORBIT_REV_LOST) === orbitWorldWFor(ORBIT_REV_BIG), "the same view as orbitRev 16");
  ok((LIVE_BANDS as Record<string, { rev: number }>).orbit!.rev === ORBIT_REV_LOST && ORBIT_STD.rev === ORBIT_REV_LOST && ORBIT_STD.parts.reduce((a, x) => a + x.max, 0) === 200, "LIVE_BANDS and ORBIT_STD carry orbitRev 17 (orbitRev 16's parts, 200)");
  const e = ORBIT_FUEL_BANK[3]!;
  const raw17 = serverRun(puzzleOfEntry(e, ORBIT_REV_LOST), [ev(9)]).raw;
  const g17 = gradeAnswer(puzzleOfEntry(e, ORBIT_REV_LOST) as unknown as PuzzleData, raw17, 0);
  const g16 = gradeAnswer(puzzleOfEntry(e, ORBIT_REV_BIG) as unknown as PuzzleData, serverRun(puzzleOfEntry(e, ORBIT_REV_BIG), [ev(9)]).raw, 0);
  ok(typeof (g17.extra as Record<string, unknown>)["lostFlights"] === "number" && !("lostFlights" in (g16.extra as Record<string, unknown>)), "the stored extra reports `lostFlights` on orbitRev 17 only");
  ok(/orbitRev=17\b/.test(PRACTICE_STAMPS["orbit"] ?? ""), `PRACTICE_STAMPS reads orbitRev=17 (${PRACTICE_STAMPS["orbit"]})`);
  ok(ORBIT_TOTAL === 40, "40 planets and the sun");
}

console.log(`orbit-lost-check: ${passes} passed, ${failures} failed`);
if (failures > 0) {
  console.log("FAIL orbit-lost-check");
  process.exit(1);
}
