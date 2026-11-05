/**
 * Rainbow Bridge inkRev 13 (Nov 2026; docs/arcade-standard/inkbridge.md "inkRev 13"): the ink stars and silver coins
 * gone, two clovers a run off the easy route, more birds on every level but the warm-up, an ink par on every level
 * (paid for potting within it), failed drops that never end the run, scored on the arcade standard (INK_V13_STD:
 * levels 120 + ink par 30 + trick shots 20 + clovers 10 + speed 20). Proves:
 *
 *  1. rooms deal inkRev 13, one above inkRev 12 (pinInkPreClover pins the deal before it for older checks); LIVE_BANDS
 *     lists it with its spec; the help, the intro line (at most 90 characters) and the room identity follow it;
 *  2. legacy: inkRev 12 runs and inkRev 10–12 level digests recorded on main before the change
 *     (scripts/fixtures/ink-v13-legacy.json.gz, `bun scripts/ink-v13-legacy-record.ts`) replay and build unchanged;
 *  3. the deal on sample seeds (tuning and fresh): no ink star, silver coin or wind; exactly two clovers and four cloud
 *     levels; more birds than inkRev 12 (on levels 2–8 at least one more than the base count); every level
 *     drawable as a phone draws it (the easy line holds for a hand and the coin never pots unaided; a cloud or clover
 *     level's bonus line pots, bounces and takes the clover; a live level's hand-drawn stroke pots, also 5 ticks late);
 *     every clover at least INK_STAR_OFF_ROUTE from the easy route; every ink par at least its proved line's ink;
 *  4. the rules: a failed drop costs a try but never ends the run; the ink-par credit (1000 within par, a straight line
 *     to 0 at twice par); stars and silver never count;
 *  5. the perfect run is 200 through the server replay on every sample seed, each part at its maximum; recorded inkRev 13
 *     runs replay unchanged (scripts/fixtures/ink-v13-runs.json.gz, `--record` to re-record);
 *  6. scoring: no input 0, a played run at least 1, random input low;
 *  7. room identity: different logs see the same dealt run.
 *
 *   bun scripts/ink-v13-check.ts            (~1–2 min)
 *   bun scripts/ink-v13-check.ts --record   (re-records ink-v13-runs.json.gz and the pending replay-runs entry)
 */
import { hasScorePart } from "../src/lib/duel/scoreList";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  inkBridgeGameFor,
  inkCheckpoint,
  inkBudgetFor,
  inkParCredit,
  inkParText,
  inkPickupSpread,
  inkV13Proof,
  inkV13Score,
  INK_CLOUD_LEVELS,
  INK_INPUT_DROP_AGAIN,
  INK_INPUT_RELEASE,
  INK_INPUT_STROKE,
  INK_LEVELS,
  INK_REV_CLOVER,
  INK_REV_BIG,
  INK_REV_STD,
  INK_REV_STRICT,
  INK_STAR_OFF_ROUTE,
  INK_V13_CLOVERS,
  INK_V13_BAND_CURVE,
  INK_V13_EXTRA_BIRDS,
  INK_V13_STD,
  type InkState,
} from "../src/lib/arcade/inkBridge";
import { stdSpecMax } from "../src/lib/arcade/arcadeStandard";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { generateInkBridge, pinInkPreBig, pinInkPreClover } from "../src/lib/duel/arcade.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/inkbridge";
import { inkOracleRun } from "./ink-x200-oracle";
import { randomInkLog } from "./ink-x200-bands";
import { roomIdentity } from "./room-identity/inkbridge";

const t0 = performance.now();
const failures: string[] = [];
let checks = 0;
const ok = (cond: unknown, msg: string) => {
  checks++;
  if (!cond) failures.push(msg);
};
const section = (name: string) => console.log(`— ${name}`);

const game = inkBridgeGameFor(INK_REV_CLOVER);
// inkRev 14 (3 Nov 2026, ink-v14-check) moved rooms on from inkRev 13: this check pins the deal before it.
pinInkPreBig(true);
/** Sample seeds: skill-band seed indices (tuning 0–59, fresh 10000 on). */
const SAMPLE = [0, 7, 41, 10000, 10013].map(roomSeed);
const RUNS_FIXTURE = "scripts/fixtures/ink-v13-runs.json.gz";

/** Plays a log on inkRev 13 and encodes it as the phone does (checkpoints every 300 ticks). */
function encode(seed: number, events: ArcadeInputEvent[]): { raw: string; state: InkState } {
  let s = game.init(seed) as InkState;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(inkCheckpoint(s));
  }
  return { raw: encodeInkBridgeRun({ seed, claimedScore: game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never), state: s };
}

type Rec = { who: string; seed: number; raw: string; score: number; levels: number; fails: number; tick: number; checksum: number };

if (process.argv.includes("--record")) {
  const runs: Rec[] = [];
  for (const n of [0, 1])
    for (const level of ["weak", "average", "good", "near", "elite"] as const) {
      const seed = roomSeed(n);
      const { raw } = encode(seed, bot({ game, seed, rev: INK_REV_CLOVER, human: new Human("inkbridge", seed, level), fixes: true }).events ?? []);
      const r = replayInkBridgeRun(seed, raw, INK_REV_CLOVER);
      runs.push({ who: level, seed, raw, score: r.score, levels: r.levels, fails: r.fails, tick: r.state.tick, checksum: inkCheckpoint(r.state).checksum });
    }
  const perfect = roomSeed(0);
  const o = encode(perfect, inkOracleRun(perfect, INK_REV_CLOVER).events);
  const pr = replayInkBridgeRun(perfect, o.raw, INK_REV_CLOVER);
  runs.push({ who: "perfect", seed: perfect, raw: o.raw, score: pr.score, levels: pr.levels, fails: pr.fails, tick: pr.state.tick, checksum: inkCheckpoint(pr.state).checksum });
  writeFileSync(RUNS_FIXTURE, gzipSync(JSON.stringify({ note: "Rainbow Bridge inkRev 13 runs recorded by scripts/ink-v13-check.ts --record", rev: INK_REV_CLOVER, runs })));
  // scripts/fixtures/replay-runs.json holds one of these (the good bot on seed index 1), appended on 3 Nov 2026; never rewritten here.
  console.log(`recorded ${runs.length} runs: ${runs.map((r) => `${r.who} ${r.score}`).join(", ")}`);
  process.exit(0);
}

/* 1. The dealt stamp, LIVE_BANDS, help, intro, room identity. */
section("Rooms deal inkRev 13; LIVE_BANDS, help and intro follow it");
{
  const live = LIVE_BANDS.inkbridge as { rev: number; strictRev?: number; curve: unknown };
  ok(generateInkBridge().inkRev === INK_REV_CLOVER && INK_REV_CLOVER === INK_REV_STD + 1, "rooms deal inkRev 13, one above inkRev 12");
  const was = pinInkPreClover(true);
  ok(generateInkBridge().inkRev === INK_REV_STD, "pinInkPreClover deals inkRev 12 for the checks written for it");
  pinInkPreClover(was);
  ok(generateInkBridge().inkRev === INK_REV_CLOVER, "unpinned, rooms deal inkRev 13 again");
  ok(live.rev === INK_REV_BIG && live.strictRev === INK_REV_STRICT && JSON.stringify(live.curve) === JSON.stringify(INK_V13_BAND_CURVE), "LIVE_BANDS lists inkRev 14 (inkRev 13's parts, ink-v14-check) on inkRev 13's core's straight line (12 a level), still against inkRev 8");
  ok(roundMaxFor("inkbridge") === 200 && stdSpecMax(INK_V13_STD) === 200, "the parts total 200, the round maximum");
  const help = PUZZLE_INSTRUCTIONS.inkbridge;
  const how = help.how.map((h) => `${h.action} ${h.detail}`).join(" ");
  ok(!/star|silver|wind|three failed/i.test(how) && /clover/i.test(how) && /ink par/i.test(how) && /trick shot/i.test(how), "the help names clovers, the ink par and trick shots, and no stars, silver coins, wind or a three-miss limit");
  // Text pass (4 Nov 2026): the help is a list, one line a part, then penalties, then the total; the intro names the
  // bonuses in one plain sentence (no internal figures).
  ok(["12 for each level potted", "Ink par", "Trick shots", "Clovers", "Speed", "50 s", "Total 200."].every((w) => help.score.includes(w)) && hasScorePart(help.score, "Levels", 120) && hasScorePart(help.score, "Ink par", 30), `the help's SCORE states every part and its maximum (${help.score})`);
  const intro = INTRO_SCORE.inkbridge.replace("{max}", "200");
  ok(intro.length <= 90 && /little ink/i.test(intro) && /clover/i.test(intro) && /speed/i.test(intro) && !/star|silver/i.test(intro), `the intro line names the parts in at most 90 characters (${intro.length}: "${intro}")`);
  ok(roomIdentity.rev === INK_REV_BIG && roomIdentity.logs(SAMPLE[0]!, INK_REV_CLOVER).length === 5, "room identity is measured on the dealt stamp (inkRev 14; inkRev 13 by passing its rev, section 7)");
  ok(inkParText(84, 90) === "Ink 84 / par 90" && inkParText(1198, 594).length <= 16, "the HUD readout reads \"Ink 84 / par 90\" (closer when long)");
}

/* 2. Legacy: inkRev 12 runs and inkRev 10-12 levels recorded on main before inkRev 13. */
section("Legacy: inkRev 12 runs and inkRev 10–12 level digests unchanged");
{
  const fx = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/ink-v13-legacy.json.gz")).toString()) as { runs: (Rec & { rev: number })[]; levelDigests: { rev: number; seed: number; sha: string }[] };
  let same = 0;
  for (const run of fx.runs) {
    const r = replayInkBridgeRun(run.seed, run.raw, run.rev);
    if (r.score === run.score && r.levels === run.levels && r.fails === run.fails && r.state.tick === run.tick && inkCheckpoint(r.state).checksum === run.checksum && !r.flagged) same++;
    else failures.push(`legacy ${run.who} seed ${run.seed} inkRev ${run.rev}: ${r.score} (${r.levels} levels, tick ${r.state.tick}), recorded ${run.score} (${run.levels}, tick ${run.tick})`);
  }
  ok(fx.runs.length >= 9 && same === fx.runs.length, `${same} / ${fx.runs.length} inkRev 12 runs replay to the same score, levels, fails, end tick and checkpoint`);
  let digests = 0;
  for (const d of fx.levelDigests) {
    const sha = createHash("sha256").update(JSON.stringify((inkBridgeGameFor(d.rev).init(d.seed) as InkState).list)).digest("hex");
    if (sha === d.sha) digests++;
    else failures.push(`inkRev ${d.rev} seed ${d.seed}: the levels built differ from main's`);
  }
  ok(fx.levelDigests.length === 9 && digests === 9, `inkRev 10, 11 and 12 build the same levels as on main (${digests} / ${fx.levelDigests.length} digests)`);
  const old = inkBridgeGameFor(INK_REV_STD).init(SAMPLE[0]!) as InkState;
  ok(old.inkPar === undefined && old.list.every((l) => l.inkPar === undefined) && old.list.filter((l) => l.star).length === 8, "an inkRev 12 state has no ink par and keeps its eight ink stars");
}

/* 3. The deal: features, birds, proofs. */
section("The deal: two clovers, four clouds, more birds, no stars or silver, every level proved");
{
  for (const seed of SAMPLE) {
    const s = game.init(seed) as InkState;
    const proof = inkV13Proof(seed);
    const old = inkBridgeGameFor(INK_REV_STD).init(seed) as InkState;
    ok(s.rev === INK_REV_CLOVER && s.inkPar === 0 && s.parLevels === 0 && s.stars === 0 && s.silver === 0 && s.shamrocks === 0, `seed ${seed}: the state carries inkRev 13's counters`);
    ok(s.list.every((l) => !l.star && !(l.silver?.length) && !l.wind), `seed ${seed}: no ink star, silver coin or wind on any level`);
    ok(s.list.filter((l) => l.shamrock).length === INK_V13_CLOVERS && s.list.filter((l) => l.clouds?.length).length === INK_CLOUD_LEVELS, `seed ${seed}: exactly ${INK_V13_CLOVERS} clovers and ${INK_CLOUD_LEVELS} cloud levels`);
    const birds = s.list.map((l) => l.blocks.length);
    const oldBirds = old.list.map((l) => l.blocks.length);
    const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
    ok(sum(birds) >= sum(oldBirds) + 8, `seed ${seed}: more birds than inkRev 12 (${sum(birds)}, was ${sum(oldBirds)}: ${birds.join(",")} vs ${oldBirds.join(",")})`);
    // The base counts (inkRev 3's BIRD_COUNTS for levels 1–8's sources). Live levels (9–10) add their shield row, which
    // clears any bird it would overlap, so only their total is compared (above).
    const base = [3, 3, 4, 4, 4, 5, 5, 6];
    ok(base.every((n, i) => birds[i]! >= n + Math.min(1, INK_V13_EXTRA_BIRDS[i]!)), `seed ${seed}: each of levels 2–8 has at least one bird more than its base count (${birds.join(",")})`);
    ok(s.list.every((l, i) => (l.inkPar ?? 0) < inkBudgetFor(i, INK_REV_CLOVER) && Math.abs(inkBudgetFor(i, INK_REV_CLOVER) - Math.trunc((inkBudgetFor(i, INK_REV_STD) * 5) / 4)) <= 1), `seed ${seed}: a quarter more ink than inkRev 12 on every level, every ink par inside it`);
    const bad = proof.filter((l) => !l.ref || l.unaided || l.bonus === false || !(l.par >= l.witness) || l.par <= 0);
    ok(bad.length === 0, `seed ${seed}: every level drawable, its bonus line proved, its ink par at least its proved line's ink (${bad.map((l) => `L${l.level + 1} ${JSON.stringify(l)}`).join("; ")})`);
    ok(proof.filter((l) => l.kind === "live").length === 2 && proof.filter((l) => l.kind.includes("clover")).every((l) => l.bonus === true), `seed ${seed}: two live levels; both clovers on proved bonus lines`);
  }
  // Every clover off the easy route (the route the easy line's coin takes on a still pot), as generation measures it.
  for (const seed of SAMPLE) {
    const s = game.init(seed) as InkState;
    s.list.forEach((l, i) => {
      if (!l.shamrock) return;
      const { star: _star, ...noStar } = l;
      const d = inkPickupSpread(noStar, i).route;
      ok(d >= INK_STAR_OFF_ROUTE - 1, `seed ${seed} level ${i + 1}: the clover sits ${d.toFixed(1)} px off the easy route (at least ${INK_STAR_OFF_ROUTE})`);
    });
  }
}

/* 4. The rules: no end on misses, the ink-par credit, no stars or silver. */
section("Rules: a miss never ends the run; the ink-par credit");
{
  const seed = SAMPLE[1]!;
  // Ten DROP AGAIN presses (each a failed drop: level 1's are free, so a release on a fresh level 2 needs a pot first).
  // Here: release with no line on every level reached, ten times: the coin falls past the pot (or stalls) each time.
  const events: ArcadeInputEvent[] = [];
  let s = game.init(seed) as InkState;
  let presses = 0;
  while (!game.isOver(s) && s.tick < 60 * 60) {
    const t = s.tick + 1;
    const ev = !s.dropping && t % 30 === 0 ? { t, k: INK_INPUT_RELEASE, a: ++presses % 256, b: 0, c: 0, d: 0 } : s.dropping && s.dropTicks > 5 ? { t, k: INK_INPUT_DROP_AGAIN, a: ++presses % 256, b: 0, c: 0, d: 0 } : null;
    if (ev) events.push(ev);
    s = game.step(s, ev);
  }
  ok(!game.isOver(s) && s.levels === 0 && presses > 20, `failed drops never end the run (${presses} presses in 60 s, still playing)`);
  ok(inkParCredit(90 * 256, 90 * 256) === 1000 && inkParCredit(10, 90 * 256) === 1000 && inkParCredit(135 * 256, 90 * 256) === 500 && inkParCredit(180 * 256, 90 * 256) === 0 && inkParCredit(400 * 256, 90 * 256) === 0, "ink par: 1000 within par, 500 at 1.5 × par, 0 at twice par and beyond");
  const b = inkV13Score({ ...s, acted: 1, levels: 3, inkPar: 2500, tricks: 1, shamrocks: 1, stars: 8, silver: 16 });
  ok(b.core === 36 && b.features["par"] === 7 && b.features["tricks"] === 5 && b.features["clovers"] === 5 && b.features["speed"] === 0, `parts: 3 levels 36, credit 2500 → 7, a trick shot 5, a clover 5, no speed short of ten levels (${JSON.stringify(b)})`);
  // A potted level's ink against its par, through the real step: the oracle's level 1 is within par.
  const o = inkOracleRun(seed, INK_REV_CLOVER);
  ok(o.state.parLevels === INK_LEVELS && o.state.inkPar === 1000 * INK_LEVELS && (o.state.lastInk ?? -1) > 0, `the perfect run pots every level within its par (${o.state.parLevels} / ${INK_LEVELS})`);
}

/* 5. The perfect run; recorded inkRev 13 runs. */
section("Perfect runs at 200 through the server replay; recorded inkRev 13 runs unchanged");
{
  for (const seed of SAMPLE) {
    const o = inkOracleRun(seed, INK_REV_CLOVER);
    const b = inkV13Score(o.state);
    const full = b.core === 120 && b.features["par"] === 30 && b.features["tricks"] === 20 && b.features["clovers"] === 10 && b.features["speed"] === 20;
    ok(o.replayed === 200 && o.score === 200 && full, `seed ${seed}: the perfect run scores ${o.replayed} through the server replay (${o.levels} levels, ${o.endedSeconds.toFixed(1)} s), every part full`);
  }
  const fx = JSON.parse(gunzipSync(readFileSync(RUNS_FIXTURE)).toString()) as { rev: number; runs: Rec[] };
  ok(fx.rev === INK_REV_CLOVER && fx.runs.length >= 11 && fx.runs.some((r) => r.who === "perfect" && r.score === 200), "bot runs at five levels and a perfect run recorded on inkRev 13");
  let same = 0;
  for (const run of fx.runs) {
    const r = replayInkBridgeRun(run.seed, run.raw, INK_REV_CLOVER);
    if (r.score === run.score && r.levels === run.levels && r.fails === run.fails && r.state.tick === run.tick && inkCheckpoint(r.state).checksum === run.checksum && !r.flagged) same++;
    else failures.push(`recorded ${run.who} seed ${run.seed}: ${r.score}, recorded ${run.score}`);
  }
  ok(same === fx.runs.length, `${same} / ${fx.runs.length} recorded inkRev 13 runs replay unchanged`);
  const stored = (JSON.parse(readFileSync("scripts/fixtures/replay-runs.json", "utf8")) as { runs: { type: string; puzzle: { inkRev?: number; seed: number }; answer: string; score: number }[] }).runs.filter((r) => r.type === "inkbridge" && r.puzzle.inkRev === INK_REV_CLOVER);
  ok(stored.length >= 1 && stored.every((r) => replayInkBridgeRun(r.puzzle.seed, r.answer, INK_REV_CLOVER).score === r.score), `the stored replay-runs entries on inkRev 13 (${stored.length}) replay to their stored scores`);
}

/* 6. Scoring floors. */
section("Scoring: no input 0, any input at least 1, random input low");
{
  const seed = SAMPLE[0]!;
  ok(replayInkBridgeRun(seed, encode(seed, []).raw, INK_REV_CLOVER).score === 0, "no input scores 0");
  ok(replayInkBridgeRun(seed, encode(seed, [{ t: 30, k: INK_INPUT_STROKE, a: 100, b: 100, c: 1, d: 0 }]).raw, INK_REV_CLOVER).score === 1, "one stroke point scores 1");
  const randoms = SAMPLE.slice(0, 3).map((sd) => replayInkBridgeRun(sd, encode(sd, randomInkLog(INK_REV_CLOVER, sd)).raw, INK_REV_CLOVER).score);
  ok(Math.max(...randoms) <= 60 && Math.min(...randoms) >= 1, `random input stays low (${randoms.join(", ")})`);
}

/* 7. Room identity. */
section("Room identity: different logs see the same dealt run");
{
  const seed = SAMPLE[0]!;
  const logs = roomIdentity.logs(seed, INK_REV_CLOVER);
  const lists = logs.map((log) => JSON.stringify(roomIdentity.scheduleOf(seed, INK_REV_CLOVER, log)));
  ok(lists.every((l) => l === lists[0]) && lists[0]!.includes("ink par") && !lists[0]!.includes("ink star") && !lists[0]!.includes("silver"), `seed ${seed}: ${logs.length} logs (idle, random, weak, elite, perfect) see the same levels, clovers and ink pars`);
  const ends = logs.map((log) => {
    let r = game.init(seed) as InkState;
    const byTick = new Map(log.map((e) => [e.t, e]));
    while (!game.isOver(r) && r.tick < game.runTicks) r = game.step(r, byTick.get(r.tick + 1) ?? null);
    return r.levels;
  });
  ok(new Set(ends).size >= 3, `seed ${seed}: the logs really differ (levels reached ${ends.join(", ")})`);
}

const secs = ((performance.now() - t0) / 1000).toFixed(1);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL ink-v13-check: ${failures.length} of ${checks} checks failed (${secs} s)`);
  process.exit(1);
}
console.log(`PASS ink-v13-check: ${checks} checks (${secs} s)`);
