/**
 * orbit-levels-check (the Action overhaul, stage 3, 16 Nov 2026; docs/arcade-standard/orbit.md "Levels"): Orbit's
 * Easy, Hard and Expert.
 *
 *  1. Normal is today's game: a Normal deal (asked for, or with no level) has no `level` and is the Normal fuel bank's
 *     course on orbitRev 16; the Normal bank file is byte for byte main's (SHA-256); the 120 runs on orbitRev 12–15 in
 *     scripts/fixtures/orbit-big-legacy.json replay to their stored score, end tick and checksum, and a Normal start
 *     carries none of the level fields.
 *  2. Each level's settings: GAME_LEVELS' tank and checkpoints are the sim's ORBIT_LEVEL_RULES; a level deal carries
 *     `level`, orbitRev 16 and a course from that level's own bank (never Normal's); the start carries the level's
 *     tank and checkpoint fields; the clock is at most 120 s at every level.
 *  3. Each level's rules on the sim: the tank runs dry after exactly its size; Easy arms its checkpoint on planets 10,
 *     20 and 30 and a slip then respawns at once at the planet it left (no hold), SET CHECKPOINT not offered; Hard's
 *     SET CHECKPOINT is Normal's; Expert offers none and every slip is grace's hold; no slip ends the run at any level.
 *  4. Every level bank's witnesses at 200 with every feature through the server replay on the dealt puzzle; Stargazer
 *     (all the stardust on Hard) met by the Hard witnesses as the server grades them.
 *  5. Identical worlds: the same deal for the same room seed, and the same start, step for step, for every player.
 *  6. Every level bank rebuilds byte for byte (`bun scripts/orbit-fuel-bank.ts --check 1 --level=…`; CHECKS_FULL=1: 4).
 *
 *   bun scripts/orbit-levels-check.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { innerLobe, lapPhases, orbitCanSetCheckpoint, orbitCheckpoint, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP, ORBIT_REV_BIG } from "../src/lib/arcade/orbit";
import {
  orbitLevelFields,
  orbitRev3CanSetCheckpoint,
  orbitRev3Game,
  orbitStartForPuzzle,
  orbitXpCounts,
  ORBIT_AUTO_CHECKPOINT_EVERY,
  ORBIT_FUEL_MAX,
  ORBIT_GRACE_HOLD_TICKS,
  ORBIT_LEVEL_RULES,
  type OrbitLevelName,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import { encodeOrbitRun, replayOrbitRun } from "../src/lib/duel/orbit";
import { ORBIT_FUEL_BANK, type OrbitFuelBankEntry } from "../src/lib/duel/orbitFuelBank.server";
import { ORBIT_LEVEL_BANKS } from "../src/lib/duel/orbitRev3Course.server";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { PRACTICE_CHALLENGES, goalMet } from "../src/lib/duel/practiceChallenges";
import { gameLevelSettings, levelsOf } from "../src/lib/levels/gameLevels";
import { dealAt } from "./level-tune";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { levelBankFile, ORBIT_BANK_LEVELS } from "./orbit-fuel-bank";

let failed = 0;
const ok = (cond: unknown, label: string) => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}: ${label}`);
};
const json = (x: unknown) => JSON.stringify(x);
const ev = (t: number, k = ORBIT_INPUT_TAP): ArcadeInputEvent => ({ t, k, a: 0, b: 0, c: 0, d: 0 });
const step = (s: OrbitRev3State, input: ArcadeInputEvent | null) => orbitRev3Game.step(s, input) as OrbitRev3State;
const LEVELS: readonly OrbitLevelName[] = ["easy", "hard", "expert"];
/** main's Normal fuel bank (de3bec96), SHA-256 of the file. */
const NORMAL_BANK_SHA = "63137bb0701f03a659bb881594ccd454ba492f355ea037f2d6348da9f2dff07c";

type Puzzle = { type: "orbit"; seed: number; orbitRev: number; planets: OrbitFuelBankEntry["planets"]; holes: OrbitFuelBankEntry["holes"]; extras: OrbitFuelBankEntry["extras"]; level?: string };
const puzzleOf = (e: OrbitFuelBankEntry, level?: OrbitLevelName): Puzzle => ({ type: "orbit", seed: e.seed, orbitRev: ORBIT_REV_BIG, planets: e.planets, holes: e.holes, extras: e.extras, ...(level ? { level } : {}) });
const startOf = (p: Puzzle) => orbitStartForPuzzle(p)!();

/** A run of `events` on the puzzle, played as the phone does, then replayed by the server. */
function serverRun(p: Puzzle, events: ArcadeInputEvent[]) {
  const at = new Map(events.map((x) => [x.t, x]));
  let s = startOf(p);
  const checkpoints: unknown[] = [];
  while (!s.ended && s.tick < orbitRev3Game.runTicks) {
    s = step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
  }
  const raw = encodeOrbitRun({ seed: p.seed, claimedScore: orbitRev3Game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  const r = replayOrbitRun(p.seed, raw, p.orbitRev, p.planets, p.holes, p.extras, undefined, p.level);
  return { ...r, raw, phone: s };
}

/** Plays the witness taps up to the first tick the rocket sits in orbit at planet `at` or beyond; the state there. */
function witnessUntil(p: Puzzle, taps: readonly number[], at: number): OrbitRev3State {
  const set = new Set(taps);
  let s = startOf(p);
  while (!s.ended && !(s.flying === 0 && !(s.warp ?? 0) && s.cur >= at)) s = step(s, set.has(s.tick + 1) ? ev(s.tick + 1) : null);
  return s;
}

/** From an orbiting state: a release that crashes or runs dry (no planet catches it), and the state after the slip. */
function slipFrom(s: OrbitRev3State): { after: OrbitRev3State; tick: number } | null {
  const lap = lapPhases(s.planets[s.cur]!).length;
  for (let d = 0; d < lap * 3; d++) {
    let w = s;
    for (let k = 0; k < d; k++) w = step(w, null);
    if (innerLobe(w.planets[w.cur]!, w.angle)) continue;
    let f = step(w, ev(w.tick + 1));
    const from = w.cur;
    while (f.flying > 0 && !f.ended) f = step(f, null);
    if (f.cur === from && f.flying === 0 && !f.ended && f.tick > w.tick + 1) return { after: f, tick: f.tick };
  }
  return null;
}

/* 1. Normal is today's game. */
{
  ok(createHash("sha256").update(readFileSync("src/lib/duel/orbitFuelBank.server.ts")).digest("hex") === NORMAL_BANK_SHA, "the Normal fuel bank file is byte for byte main's (SHA-256)");
  let same = 0;
  const N = 24;
  for (let n = 0; n < N; n++) {
    const plain = dealAt("orbit", "normal", n) as unknown as Puzzle;
    const e = ORBIT_FUEL_BANK[((plain.seed % ORBIT_FUEL_BANK.length) + ORBIT_FUEL_BANK.length) % ORBIT_FUEL_BANK.length]!;
    if (!("level" in plain) && plain.orbitRev === ORBIT_REV_BIG && json(plain.planets) === json(e.planets) && json(plain.holes) === json(e.holes) && json(plain.extras) === json(e.extras)) same++;
  }
  ok(same === N, `a Normal deal has no level and is the Normal bank's course on orbitRev 16 (${same} / ${N})`);
  const s = startOf(puzzleOf(ORBIT_FUEL_BANK[0]!));
  ok(s.tank === undefined && s.cpAuto === undefined && s.cpNone === undefined && s.fuel === ORBIT_FUEL_MAX && json(orbitLevelFields("normal")) === "{}" && json(orbitLevelFields(undefined)) === "{}", "a Normal start carries no level field and a 160-tick tank");

  type Run = { rev: number; seed: number; kind: string; events: ArcadeInputEvent[]; score: number; checkpoint: { checksum: number }; endTick: number };
  const fx = JSON.parse(readFileSync("scripts/fixtures/orbit-big-legacy.json", "utf8")) as { recordedOn: string; runs: Run[] };
  const spec = GAME_BY_TYPE.get("orbit")!;
  let replayed = 0;
  for (const run of fx.runs) {
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
    if (r.score === run.score && r.state.tick === run.endTick && orbitCheckpoint(r.state as never).checksum === run.checkpoint.checksum) replayed++;
  }
  ok(fx.runs.length === 120 && replayed === fx.runs.length, `every orbitRev 12–15 run recorded on ${fx.recordedOn} replays to its score, end tick and checksum (${replayed} / ${fx.runs.length})`);
}

/* 2. Each level's settings, deal and clock. */
{
  ok(json(levelsOf("orbit")) === json(["easy", "normal", "hard", "expert"]), "Orbit offers Easy, Normal, Hard and Expert");
  ok(json(ORBIT_BANK_LEVELS) === json(LEVELS), "the bank script builds the three level banks");
  for (const level of LEVELS) {
    const set = gameLevelSettings<{ tank: number; checkpoints: string }>("orbit", level)!;
    const rules = ORBIT_LEVEL_RULES[level];
    ok(set && set.tank === rules.tank && set.checkpoints === rules.checkpoints, `${level}: GAME_LEVELS' tank and checkpoints are the sim's (${rules.tank} ticks, ${rules.checkpoints})`);
    const bank = ORBIT_LEVEL_BANKS[level];
    ok(bank.length >= 24, `${level}: the bank holds ${bank.length} proved courses (${levelBankFile(level)})`);
    let dealt = 0, clock = 0;
    const N = 12;
    for (let n = 0; n < N; n++) {
      const p = dealAt("orbit", level, n) as unknown as Puzzle;
      const e = bank[((p.seed % bank.length) + bank.length) % bank.length]!;
      const notNormal = !ORBIT_FUEL_BANK.some((x) => json(x.planets) === json(p.planets));
      if (p.level === level && p.orbitRev === ORBIT_REV_BIG && json(p.planets) === json(e.planets) && json(p.holes) === json(e.holes) && json(p.extras) === json(e.extras) && notNormal) dealt++;
      if (puzzleTimeLimitMs(p as never) <= 120_000 && orbitRev3Game.runTicks <= 120 * 60) clock++;
    }
    ok(dealt === N, `${level}: a ${level} deal carries level and orbitRev 16 and is the level bank's course, never Normal's (${dealt} / ${N})`);
    ok(clock === N, `${level}: the clock is at most 120 s (${orbitRev3Game.runTicks / 60} s run; ${clock} / ${N})`);
    const s = startOf(puzzleOf(bank[0]!, level));
    ok(s.tank === rules.tank && s.fuel === rules.tank && (s.cpAuto ?? 0) === (rules.checkpoints === "auto" ? 1 : 0) && (s.cpNone ?? 0) === (rules.checkpoints === "none" ? 1 : 0) && s.grace === 1 && s.big === 1, `${level}: the start carries the level's tank and checkpoint rule, with grace and orbitRev 16's planets`);
    ok(orbitRev3CanSetCheckpoint(s) === (rules.checkpoints === "one") && orbitCanSetCheckpoint(s as never) === (rules.checkpoints === "one"), `${level}: SET CHECKPOINT ${rules.checkpoints === "one" ? "is offered" : "is not offered"} (the sim and the stage's button)`);
  }
}

/* 3. The rules on the sim. */
for (const level of LEVELS) {
  const rules = ORBIT_LEVEL_RULES[level];
  const e = ORBIT_LEVEL_BANKS[level][0]!;
  const p = puzzleOf(e, level);
  // The tank: a release into empty space flies exactly `tank` ticks.
  const s0 = witnessUntil(p, e.taps, 1);
  const slip = slipFrom(s0);
  ok(slip !== null, `${level}: a release from planet ${s0.cur} that no planet catches exists`);
  if (slip) {
    // Find the release tick again to measure the flight's length.
    let w = s0;
    let flown = -1;
    for (let d = 0; d < 400 && flown < 0; d++) {
      let f = step(w, ev(w.tick + 1));
      let n = 0;
      while (f.flying > 0 && !f.ended) {
        f = step(f, null);
        n++;
      }
      if (f.cur === w.cur && f.dry === f.tick) flown = n + 1;
      w = step(w, null);
    }
    ok(flown === rules.tank, `${level}: an empty tank ends a flight after exactly ${rules.tank} ticks (${flown})`);
    const a = slip.after;
    ok(a.ended === 0 && a.flying === 0 && a.cur === s0.cur, `${level}: a slip respawns the rocket at the planet it left; the run carries on (grace)`);
    ok(a.hold === ORBIT_GRACE_HOLD_TICKS && a.autoRespawns === 1, `${level}: with no checkpoint armed the slip is grace's ${ORBIT_GRACE_HOLD_TICKS / 60} s hold`);
  }
  // SET CHECKPOINT: offered only on Hard (as Normal); the input does nothing on Easy and Expert.
  const cp = step(s0, ev(s0.tick + 1, ORBIT_INPUT_CHECKPOINT));
  ok(rules.checkpoints === "one" ? cp.checkpoint === s0.cur : cp.checkpoint === s0.checkpoint, `${level}: the checkpoint input ${rules.checkpoints === "one" ? "sets the checkpoint" : "does nothing"}`);
  if (rules.checkpoints === "one") {
    const sl = slipFrom(cp);
    ok(sl && sl.after.respawns === 0 && (sl.after.hold ?? 0) === 0 && sl.after.cur === cp.checkpoint, `${level}: a slip with SET CHECKPOINT armed uses its one respawn, at once, at the checkpoint planet`);
  }
  if (rules.checkpoints === "auto") {
    // The automatic checkpoints: armed on reaching planets 10, 20, 30, none before.
    const before = witnessUntil(p, e.taps, ORBIT_AUTO_CHECKPOINT_EVERY - 1);
    ok(before.checkpoint < 0 || before.cur >= ORBIT_AUTO_CHECKPOINT_EVERY, `easy: no checkpoint before planet ${ORBIT_AUTO_CHECKPOINT_EVERY} (${before.checkpoint} at planet ${before.cur})`);
    let armed = 0;
    for (const at of [10, 20, 30]) {
      const s = witnessUntil(p, e.taps, at);
      if (s.checkpoint >= at && s.checkpoint === s.cur && s.respawns === 1) armed++;
      const sl = slipFrom(s);
      if (sl && sl.after.cur === s.cur && (sl.after.hold ?? 0) === 0 && sl.after.respawns === 0 && sl.after.checkpoint === -1 && (sl.after.cpUsed ?? 0) === 1) armed++;
      // A second slip with it spent: grace's hold.
      if (sl) {
        const again = slipFrom(sl.after);
        if (again && again.after.cur === s.cur && (again.after.hold ?? 0) > 0 && (again.after.autoRespawns ?? 0) === 1) armed++;
      }
    }
    ok(armed === 9, `easy: planets 10, 20 and 30 arm the checkpoint; a slip then respawns at once where it left (no hold), and the next is grace's hold (${armed} / 9)`);
  }
  if (rules.checkpoints === "none") {
    const s = witnessUntil(p, e.taps, 12);
    const sl = slipFrom(s);
    ok(sl && (sl.after.hold ?? 0) > 0 && sl.after.checkpoint < 0 && (sl.after.autoRespawns ?? 0) === 1 && !orbitRev3CanSetCheckpoint(sl.after), "expert: respawn only: every slip is grace's hold, no checkpoint ever");
  }
  // No slip ends the run: a tapper releasing every 40 ticks plays to the buzzer or the sun.
  const tapper = Array.from({ length: 130 }, (_, k) => ev(60 + k * 40));
  const r = serverRun(p, tapper);
  ok(!r.flagged && (r.state.tick === orbitRev3Game.runTicks || r.state.finished === 1) && r.score >= 1, `${level}: a careless tapper's run never ends early (end tick ${r.state.tick}, ${r.score} points)`);
}

/* 4. Every level bank's witnesses at 200 through the server replay; Stargazer on Hard. */
{
  const stargazer = PRACTICE_CHALLENGES.find((c) => c.type === "orbit" && c.name === "Stargazer");
  ok(stargazer && stargazer.level === "hard", "the catalogue's Stargazer is a Hard challenge");
  for (const level of LEVELS) {
    const bank = ORBIT_LEVEL_BANKS[level];
    let full = 0, star = 0;
    for (const e of bank) {
      const p = puzzleOf(e, level);
      const r = serverRun(p, e.taps.map((t) => ev(t)));
      const c = orbitXpCounts(r.state);
      if (!r.flagged && r.score === 200 && r.state.finished === 1 && c.dust === c.dustTotal && c.dustTotal === 30 && c.slings === 4 && c.threads === 3) full++;
      if (level === "hard" && stargazer) {
        const g = gradeAnswer(p as never, r.raw, 0) as { score: number; extra?: Record<string, unknown> };
        if (g.score === 200 && goalMet(stargazer.goal, { score: g.score, extra: g.extra ?? null, level: "hard" })) star++;
      }
    }
    ok(full === bank.length, `${level}: every bank witness reaches 200 with every feature through the server replay (${full} / ${bank.length})`);
    if (level === "hard") ok(star === bank.length, `hard: Stargazer (all the stardust) is met by every Hard witness as the server grades it (${star} / ${bank.length})`);
  }
}

/* 5. Identical worlds for every player. */
{
  let same = 0;
  for (const level of LEVELS) {
    for (let n = 0; n < 4; n++) {
      const a = dealAt("orbit", level, n);
      const b = dealAt("orbit", level, n);
      const sa = orbitStartForPuzzle(a as never)!();
      const sb = orbitStartForPuzzle(JSON.parse(json(b)))!();
      let x = sa, y = sb;
      for (let t = 0; t < 600; t++) {
        x = step(x, t % 97 === 50 ? ev(x.tick + 1) : null);
        y = step(y, t % 97 === 50 ? ev(y.tick + 1) : null);
      }
      if (json(a) === json(b) && orbitCheckpoint(x as never).checksum === orbitCheckpoint(y as never).checksum) same++;
    }
  }
  ok(same === 12, `the same room seed deals the same course at each level, and every player's start steps identically (${same} / 12)`);
}

/* 6. Each level bank rebuilds byte for byte. */
{
  const n = process.env.CHECKS_FULL === "1" ? 4 : 1;
  for (const level of LEVELS) {
    const p = Bun.spawnSync(["bun", "scripts/orbit-fuel-bank.ts", "--check", String(n), `--level=${level}`], { stdout: "pipe", stderr: "pipe" });
    const out = p.stdout.toString();
    ok(p.exitCode === 0 && /PASS/.test(out), `${level}: the first ${n} bank ${n === 1 ? "entry rebuilds" : "entries rebuild"} byte for byte (${out.trim().split("\n").pop()})`);
  }
}

console.log(failed ? `\nFAIL: ${failed} check(s) failed` : "\nPASS: orbit-levels-check");
process.exit(failed ? 1 : 0);
