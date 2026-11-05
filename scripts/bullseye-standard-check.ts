/**
 * Flightpath bullRev 9: the arcade scoring standard (docs/arcade-standard/bullseye.md).
 *
 *  1. Stored rounds: every Flightpath run in expansion E9's fixtures (skill-band runs recorded on main on every older
 *     revision, unstamped to bullRev 6, and on bullRev 8, plus bullRev 8's stored 200) replays on today's code to the
 *     same score and the same final state, unflagged (checkpoints included).
 *  2. Same play: bullRev 9 starts from bullRev 8's exact state (only `std` added), and every bullRev 8 log replayed
 *     on bullRev 9 reaches bullRev 8's final state (plus `std`); the band tool's bots throw the same darts on both.
 *     Its score is the standard's sum, worked out here from the final state with no sim helper: the dart total on a
 *     straight line to 150 at 112, bullRev 8's streak points up to 30, 20 shared between the darts that have a
 *     dead-centre ring (floor(20 × hit ÷ darts)), at least 1 for a run that threw, 0 for none.
 *  6. A perfect run scores 200 on every seed: on every tuning (0–59) and fresh (10000–10199) room seed the best
 *     possible run (scripts/bullseye-best-run.ts: every dart a bull, every dead centre, the balloons wherever a
 *     dead-centre or bull landing can also pop them) is played for real, encoded and replayed through the server
 *     (replayBullseyeRun) to exactly 200, and its dart total is at least 100 + 2 × (dead-centre darts) ≥ 112.
 *  3. New-stamp runs (bots at every level on room seeds) replay through the server path (replayBullseyeRun) to the
 *     score the phone claimed, unflagged; the reveal's lines are the standard's parts and add up to the stored score;
 *     the grade extras carry bullRev 9's dead-centre points.
 *  4. Rooms deal bullRev 9; the help states the parts; the renderer's dead-centre pop shows each dart's share (adding up
 *     to 20) on bullRev 9, +7 on 8.
 *  5. Features never cost dart total: a dead-centre dart is always a bull (the gold 10 or the inner bull), and every
 *     streak point comes from a bull.
 *
 *   bun scripts/bullseye-standard-check.ts      (~10 s)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import type { E9Record } from "./expansion-e9-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/bullseye";
import { bullseyeBestRun } from "./bullseye-best-run";
import {
  bullseyeCheckpoint,
  bullseyeDeadEach,
  bullseyeGameFor,
  bullseyeInitFor,
  bullseyeIsBull,
  bullseyeTallRev,
  bullseyeWinds,
  BULLSEYE_REV_EXPAND,
  BULLSEYE_REV_STD,
  BULLSEYE_STD,
  BULLSEYE_STD_SPEC,
  BULLSEYE_V9_FULL_AT,
  type BullseyeState,
} from "../src/lib/arcade/bullseye";
import { encodeBullseyeRun, replayBullseyeRun } from "../src/lib/duel/bullseye";
import { generateBullseye } from "../src/lib/duel/arcade.server";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { stdHelp, stdHelpLines } from "../src/lib/arcade/arcadeStandard";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const section = (name: string) => console.log(`\n== ${name}`);
const spec = GAME_BY_TYPE.get("bullseye" as never)!;

/** The standard's sum, from the final state alone (no sim helper). */
function expected(s: BullseyeState): number {
  if (!s.acted) return 0;
  const core = Math.floor((150 * Math.min(Math.max(0, s.total), BULLSEYE_V9_FULL_AT)) / BULLSEYE_V9_FULL_AT);
  const streak = Math.min(30, Math.max(0, s.streakPts ?? 0));
  const dead = deadShare(s);
  return Math.max(1, Math.min(200, core + streak + dead));
}
/** 20 shared between the darts whose centre ring is the 10 (counted here from the state's ring values). */
function deadShare(s: BullseyeState): number {
  const darts = s.ringValues.filter((v) => v[0] === 10).length;
  return darts > 0 ? Math.floor((20 * Math.min(s.dead ?? 0, darts)) / darts) : 0;
}
const withoutStd = (s: BullseyeState) => {
  const { std: _std, ...rest } = s;
  return rest;
};

/* ============================== 1. Stored rounds ============================== */
section("Stored rounds replay and score exactly as before");
const fixture = (path: string) => JSON.parse(gunzipSync(readFileSync(path)).toString()) as { runs: E9Record[]; top?: E9Record[] };
const v8Logs: { seed: number; raw: string; state: BullseyeState }[] = [];
const perRev = new Map<string, number>();
for (const file of ["scripts/fixtures/expansion-e9-legacy.json.gz", "scripts/fixtures/expansion-e9-runs.json.gz"]) {
  const fix = fixture(file);
  for (const run of [...fix.runs, ...(fix.top ?? [])].filter((r) => r.type === "bullseye")) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replayBullseyeRun(run.seed, raw, bullseyeWinds(run.seed), run.rev);
    ok(result.score === run.score && !result.flagged, `bullRev ${run.rev} ${run.level}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `bullRev ${run.rev} ${run.level}: the replayed final state differs`);
    ok(result.state.std === undefined, `bullRev ${run.rev}: an older state carries the standard's marker`);
    if (run.rev === BULLSEYE_REV_EXPAND) v8Logs.push({ seed: run.seed, raw, state: result.state });
    perRev.set(String(run.rev ?? "-"), (perRev.get(String(run.rev ?? "-")) ?? 0) + 1);
  }
}
ok(v8Logs.length >= 12, `bullRev 8 runs in the fixtures: ${v8Logs.length}`);
console.log(`  ${[...perRev].map(([k, v]) => `bullRev ${k}×${v}`).join(", ")}`);

/* ============================== 2. Same play ============================== */
section("bullRev 9 plays bullRev 8 exactly; its score is the standard's sum");
for (let n = 0; n < 40; n++) {
  const seed = spec.seedFor(n);
  const v8 = bullseyeInitFor(seed, bullseyeWinds(seed), BULLSEYE_REV_EXPAND);
  const v9 = bullseyeInitFor(seed, bullseyeWinds(seed), BULLSEYE_REV_STD);
  ok(v9.std === BULLSEYE_STD && JSON.stringify(withoutStd(v9)) === JSON.stringify(v8), `seed ${n}: bullRev 9's start is bullRev 8's plus std`);
  ok(JSON.stringify(bullseyeGameFor(BULLSEYE_REV_STD).init(seed)) === JSON.stringify(bullseyeInitFor(seed, undefined, BULLSEYE_REV_STD)), `seed ${n}: gameFor(9).init is initFor(9)`);
}
let replayed = 0;
for (const log of v8Logs) {
  // The replay reports the expected checksum desync (the marker) on the console; keep the output quiet.
  const quiet = console.error;
  console.error = () => {};
  const r9 = replayBullseyeRun(log.seed, log.raw, bullseyeWinds(log.seed), BULLSEYE_REV_STD);
  console.error = quiet;
  ok(JSON.stringify(withoutStd(r9.state)) === JSON.stringify(log.state), `seed ${log.seed}: a bullRev 8 log on bullRev 9 reaches another state`);
  ok(r9.score === expected(r9.state), `seed ${log.seed}: bullRev 9 scores ${r9.score}, the standard's sum is ${expected(r9.state)}`);
  // The rev-8 checkpoints differ only by the standard's marker (the log's claimed score and sums are rev 8's).
  ok(r9.desyncTick !== null || r9.checkpoints.length === 0, `seed ${log.seed}: bullRev 9's checksum folds in its marker`);
  replayed++;
}
console.log(`  ${replayed} bullRev 8 logs replayed on bullRev 9`);
for (const level of ["weak", "good", "elite"] as SkillLevel[]) {
  for (let n = 0; n < 4; n++) {
    const seed = spec.seedFor(n);
    const a = bot({ game: spec.gameFor(BULLSEYE_REV_EXPAND, seed), seed, rev: BULLSEYE_REV_EXPAND, human: new Human("bullseye" as never, seed, level), fixes: true } as any);
    const b = bot({ game: spec.gameFor(BULLSEYE_REV_STD, seed), seed, rev: BULLSEYE_REV_STD, human: new Human("bullseye" as never, seed, level), fixes: true } as any);
    ok(JSON.stringify(a.events) === JSON.stringify(b.events), `${level} ${n}: the bot throws other darts on bullRev 9`);
  }
}

/* ============================== 3. New-stamp runs ============================== */
section("New-stamp runs through the server path");
const levels: SkillLevel[] = ["weak", "average", "good", "great", "near", "elite", "perfect"];
let runs = 0;
let deadSeen = 0;
let streakSeen = 0;
for (const level of levels) {
  for (let n = 0; n < 6; n++) {
    const seed = spec.seedFor(n);
    const game = spec.gameFor(BULLSEYE_REV_STD, seed);
    const res = bot({ game, seed, rev: BULLSEYE_REV_STD, human: new Human("bullseye" as never, seed, level), fixes: true } as any);
    let state: BullseyeState = game.init(seed);
    const checkpoints: ReturnType<typeof bullseyeCheckpoint>[] = [];
    const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
    while (!game.isOver(state) && state.tick < game.runTicks) {
      state = game.step(state, (byTick.get(state.tick + 1) as any) ?? null);
      if (state.tick % 300 === 0) checkpoints.push(bullseyeCheckpoint(state));
    }
    const claimed = game.score(state);
    const raw = encodeBullseyeRun({ seed, claimedScore: claimed, events: res.events ?? [], endTick: state.tick, checkpoints } as any);
    const result = replayBullseyeRun(seed, raw, bullseyeWinds(seed), BULLSEYE_REV_STD);
    ok(!result.flagged && result.score === claimed, `${level} ${n}: claimed ${claimed}, the server replays ${result.score}${result.flagged ? ` (flagged: ${result.reason})` : ""}`);
    ok(result.score === expected(result.state), `${level} ${n}: ${result.score} is not the standard's sum ${expected(result.state)}`);
    ok(result.score >= 1 && result.score <= 200, `${level} ${n}: a played run scores ${result.score}`);
    // 5. Features never cost dart total.
    for (const hit of result.state.hits) {
      if (hit.dc === 1) ok(bullseyeIsBull(hit), `${level} ${n}: a dead-centre dart that is not a bull`);
      if ((hit.skp ?? 0) > 0) ok(bullseyeIsBull(hit), `${level} ${n}: streak points from a dart that is not a bull`);
    }
    deadSeen += result.state.dead ?? 0;
    streakSeen += result.state.streakPts ?? 0;
    // The reveal: one line per part, then the total, adding up to the stored score.
    const puzzle = { type: "bullseye", seed, winds: bullseyeWinds(seed), bullRev: BULLSEYE_REV_STD } as const;
    const graded = gradeAnswer(puzzle as any, raw, 0) as any;
    ok(graded.score === result.score, `${level} ${n}: graded ${graded.score}, replayed ${result.score}`);
    const extra = graded.extra ?? {};
    ok(extra.deadPts === deadShare(result.state), `${level} ${n}: the grade extras' dead-centre points are ${extra.deadPts}`);
    const reveal = buildArcadeReveal("bullseye", { ...extra, state: result.state }, result.score);
    const lines = reveal?.lines ?? [];
    ok(lines.length === 4 && lines[0]!.startsWith("Dart total:") && lines[1]!.startsWith("Bull streaks:") && lines[2]!.startsWith("Dead-centre darts:"), `${level} ${n}: reveal lines ${JSON.stringify(lines)}`);
    const sum = lines.slice(0, 3).reduce((t, l) => t + Number(/→ (\d+) of/.exec(l)?.[1] ?? NaN), 0);
    ok(sum === result.score || (sum < 1 && result.score === 1), `${level} ${n}: the reveal's parts add to ${sum}, the score is ${result.score}`);
    runs++;
  }
}
ok(deadSeen > 0 && streakSeen > 0, `the runs earned both features (dead-centre ${deadSeen}, streak ${streakSeen})`);
{
  const s = bullseyeGameFor(BULLSEYE_REV_STD).init(spec.seedFor(0));
  ok(bullseyeGameFor(BULLSEYE_REV_STD).score(s) === 0, "no input scores 0");
}
console.log(`  ${runs} runs on bullRev 9 (dead-centre darts ${deadSeen}, streak points ${streakSeen})`);

/* ============================== 4. Rooms, help, art ============================== */
section("Rooms deal bullRev 9; help and art");
ok(generateBullseye().bullRev === BULLSEYE_REV_STD, "rooms deal bullRev 9");
ok(LIVE_BANDS.bullseye.rev === BULLSEYE_REV_STD && (LIVE_BANDS.bullseye as any).std === BULLSEYE_STD_SPEC, "LIVE_BANDS lists bullRev 9 and its spec");
ok(PUZZLE_INSTRUCTIONS.bullseye.score.includes(stdHelpLines(BULLSEYE_STD_SPEC)), "the help states the standard's parts");
ok(PUZZLE_INSTRUCTIONS.bullseye.how.some((h) => h.detail.includes("about +2 or +3 more")) && PUZZLE_INSTRUCTIONS.bullseye.how.some((h) => h.detail.includes("shared between the darts that have one")) && !PUZZLE_INSTRUCTIONS.bullseye.how.some((h) => /\+7|42/.test(h.detail)), "the help's dead-centre lines describe the shared 20");
{
  // The dead-centre pop shows what that dart added: its share on bullRev 9 (the pops add up to 20), 7 on bullRev 8.
  let pops = 0;
  for (let n = 0; n < 40; n++) {
    const s = bullseyeInitFor(spec.seedFor(n), undefined, BULLSEYE_REV_STD);
    const darts = s.ringValues.filter((v) => v[0] === 10).length;
    let sum = 0;
    for (let d = 1; d <= darts; d++) sum += bullseyeDeadEach({ ...s, dead: d });
    ok(sum === 20, `seed ${n}: the dead-centre pops add up to ${sum}, not 20`);
    pops++;
  }
  ok(pops === 40 && bullseyeDeadEach({ ...bullseyeInitFor(1, undefined, BULLSEYE_REV_EXPAND), dead: 1 }) === 7, "the dead-centre pop: a share of 20 on bullRev 9, +7 on bullRev 8");
}
ok(bullseyeTallRev(BULLSEYE_REV_STD) && bullseyeTallRev(BULLSEYE_REV_EXPAND) && !bullseyeTallRev(6) && !bullseyeTallRev(undefined), "bullRev 9 draws bullRev 8's taller range");

/* ============================== 6. A perfect run scores 200 on every seed ============================== */
section("A perfect run scores 200 on every tuning and fresh seed");
{
  const game = bullseyeGameFor(BULLSEYE_REV_STD);
  const seedsN = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 200 }, (_, i) => 10000 + i)];
  let full = 0;
  let minTotal = 999;
  for (const n of seedsN) {
    const seed = spec.seedFor(n);
    const best = bullseyeBestRun(game, seed);
    const s = best.state;
    const darts = s.ringValues.filter((v) => v[0] === 10).length;
    const checkpoints: ReturnType<typeof bullseyeCheckpoint>[] = [];
    {
      // The checkpoints as the phone records them.
      let r = game.init(seed);
      const byTick = new Map(best.events.map((e) => [e.t, e]));
      while (!game.isOver(r) && r.tick < game.runTicks) {
        r = game.step(r, byTick.get(r.tick + 1) ?? null);
        if (r.tick % 300 === 0) checkpoints.push(bullseyeCheckpoint(r));
      }
    }
    const raw = encodeBullseyeRun({ seed, claimedScore: game.score(s), events: best.events, endTick: s.tick, checkpoints } as any);
    const result = replayBullseyeRun(seed, raw, bullseyeWinds(seed), BULLSEYE_REV_STD);
    ok(!result.flagged && result.score === 200, `seed ${n}: the best run replays to ${result.score}${result.flagged ? ` (flagged: ${result.reason})` : ""}, not 200`);
    ok(result.state.hits.length === 10 && result.state.hits.every(bullseyeIsBull) && (result.state.dead ?? 0) === darts, `seed ${n}: the best run is ten bulls with every dead centre (${result.state.dead} of ${darts})`);
    ok(result.state.total >= 100 + 2 * darts && result.state.total >= BULLSEYE_V9_FULL_AT, `seed ${n}: dart total ${result.state.total} under 100 + 2 × ${darts}`);
    minTotal = Math.min(minTotal, result.state.total);
    if (result.score === 200) full++;
  }
  console.log(`  ${full} of ${seedsN.length} seeds: the best run scores 200 (lowest dart total ${minTotal}, core full at ${BULLSEYE_V9_FULL_AT})`);
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} Flightpath standard checks`);
  process.exit(1);
}
console.log(`\nPASS: ${checks} Flightpath standard checks`);
