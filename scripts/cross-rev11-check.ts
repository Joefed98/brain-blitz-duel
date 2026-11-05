/**
 * cross-rev11-check (3 Nov 2026, docs/arcade-standard/cross.md "crossRev 11"): Jaywalk crossRev 11. crossRev 10's
 * courses and walker exactly, with the coins taken out, the clean streak replaced by the no-stop streak and a hit
 * costing 15: core 150 (rows + 2 a crossing, straight line, full at 76) + no-stop streak 40 + close calls 10 = 200.
 *
 *  1. Wiring: rooms deal crossRev 11 (one above crossRev 10); LIVE_BANDS, the "?" help (no coins; the no-stop streak, its
 *     half second, the hit cost, the parts total 200), the intro line (under 90 characters), the intro demo plays only
 *     when recorded on crossRev 11, playRevOf maps 11 to crossRev 10's play, the world is crossRev 9's.
 *  2. Older stamps unchanged: 44 runs on unstamped and crossRev 2–7, 9 and 10 rounds (12 on crossRev 10), recorded on
 *     unmodified main 63261010 (scripts/fixtures/cross-rev11-legacy.json.gz, scripts/cross-rev11-legacy.ts), replay to
 *     the same score, flag, final state and checkpoints, with no `flow`.
 *  3. The same courses and the same walker: on 40 room seeds crossRev 11's lanes are crossRev 10's and hold no coin;
 *     bot logs at every level played on both stamps move the walker identically tick for tick (lane, column, hop,
 *     crossings, lives, close calls), crossRev 11 collects no coin.
 *  4. The rules, scripted: the stand count (the kerb pause doesn't count, side-steps do, a hop resets it, the 31st tick
 *     stops the crossing); the no-stop streak against a reference count from the walker's own moves (oracle runs with
 *     waits inserted, and bot runs); close calls exactly crossRev 10's; the score is core + streak + close − 15 a hit,
 *     held to 1–200; a perfect (oracle) run 200 on 12 seeds; one step 1, no input 0; the reveal's lines; grading's extra.
 *  5. Stored crossRev 11 runs (scripts/fixtures/cross-rev11-runs.json.gz, `--record` to re-record) replay through the
 *     server path to their stored score and state, unflagged, 1–200.
 *
 *   bun scripts/cross-rev11-check.ts [--record]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { hasScorePart } from "../src/lib/duel/scoreList";
import { gunzipSync, gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { GAME_BY_TYPE, roomSeed } from "./arcade-skill-bands/games";
import { Human, ALL_LEVELS } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/cross";
import { playRevOf } from "./scoring-targets-revs";
import { crossCeilingRun, crossingPath } from "./cross-ceiling";
import { digest, stateDigest, type CrossLegacyRecord } from "./cross-rev11-legacy";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { ROUND_MAX } from "../src/lib/duel/roundMax";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { encodeCrossRun, replayCrossRun } from "../src/lib/duel/cross";
import {
  crossBandParts,
  crossCheckpoint,
  crossFlowNext,
  crossFlowScore,
  crossGameFor,
  crossPlayerHalfFp,
  crossTotalLanes,
  crossWorldHFor,
  CROSS_COURSES,
  CROSS_FLOW_STD,
  CROSS_INPUT_MOVE,
  CROSS_LIVES,
  CROSS_PAUSE_TICKS,
  CROSS_REV_EXPAND,
  CROSS_REV_FLOW,
  CROSS_REV_STD,
  CROSS_RUN_TICKS,
  CROSS_V11_BAND_CURVE,
  CROSS_V11_CORE_FULL,
  CROSS_V11_CORE_MAX,
  CROSS_V11_FLOW_EACH,
  CROSS_V11_FLOW_MAX,
  CROSS_V11_HIT_COST,
  CROSS_V11_STOP_TICKS,
  CROSS_X_ISLAND,
  type CrossState,
} from "../src/lib/arcade/cross";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

const RECORD = process.argv.includes("--record");
const LEGACY = "scripts/fixtures/cross-rev11-legacy.json.gz";
const FIXTURE = "scripts/fixtures/cross-rev11-runs.json.gz";
let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};
const spec = GAME_BY_TYPE.get("cross" as never)!;
const v10 = crossGameFor(CROSS_REV_STD);
const v11 = crossGameFor(CROSS_REV_FLOW);
const quiet = <T>(fn: () => T): T => {
  const error = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
  }
};
const play = (game: typeof v11, seed: number, events: ArcadeInputEvent[], each?: (s: CrossState, before: CrossState) => void): CrossState => {
  const by = new Map(events.map((e) => [e.t, e]));
  let state = game.init(seed) as CrossState;
  while (!game.isOver(state)) {
    const before = state;
    state = game.step(state, by.get(state.tick + 1) ?? null);
    each?.(state, before);
  }
  return state;
};
const move = (t: number, a: number): ArcadeInputEvent => ({ t, k: CROSS_INPUT_MOVE, a, b: 0, c: 0, d: 0 });
/** The walker as both stamps move it (no coin, streak or flow fields). */
const walker = (s: CrossState) => [s.tick, s.lane, s.col, s.hop, s.hopDir, s.reached, s.crossings, s.crossStart, s.pauseUntil, s.lives, s.clean, s.hitThisCrossing ? 1 : 0, s.ghost ? 1 : 0, s.dead ? 1 : 0, s.closeCalls ?? 0, s.banked ?? 0].join(",");

/**
 * The no-stop streak worked out from the walker's own moves, independently of the sim's counters: per finished crossing
 * the longest run of ticks stood on the start kerb or the island (outside the kerb pause, hop 0) and whether it was hit;
 * N (no-stop) when not hit and never more than CROSS_V11_STOP_TICKS. Points: CROSS_V11_FLOW_EACH for each N straight
 * after an N, at most CROSS_V11_FLOW_MAX; `run` the N's in a row at the end.
 */
function referenceStreak(seed: number, events: ArcadeInputEvent[]): { seq: string; pts: number; run: number; state: CrossState } {
  let stand = 0;
  let longest = 0;
  let seq = "";
  const state = play(v11, seed, events, (s, before) => {
    if (s.crossings > before.crossings) {
      seq += before.hitThisCrossing ? "H" : Math.max(longest, stand) <= CROSS_V11_STOP_TICKS ? "N" : "S";
      longest = 0;
      stand = 0;
      return;
    }
    if (s.lives < before.lives) {
      stand = 0;
      return;
    }
    if (s.tick >= s.pauseUntil && s.hop === 0 && (s.lane === 0 || s.lane === CROSS_X_ISLAND)) stand += 1;
    else stand = 0;
    longest = Math.max(longest, stand);
  });
  let pts = 0;
  let run = 0;
  for (const c of seq) {
    if (c === "N") {
      run += 1;
      if (run >= 2) pts = Math.min(CROSS_V11_FLOW_MAX, pts + CROSS_V11_FLOW_EACH);
    } else run = 0;
  }
  return { seq, pts, run, state };
}

/** The score from the rules as the docs state them, from a final state's counts. */
function referenceScore(s: CrossState): number {
  if (!s.acted) return 0;
  const units = crossTotalLanes(s) + 2 * s.crossings;
  const core = Math.floor((CROSS_V11_CORE_MAX * Math.min(units, CROSS_V11_CORE_FULL)) / CROSS_V11_CORE_FULL);
  const streak = Math.min(CROSS_V11_FLOW_MAX, s.streakPts ?? 0);
  const close = Math.min(10, s.closeCalls ?? 0);
  const total = core + streak + close - CROSS_V11_HIT_COST * (CROSS_LIVES - s.lives);
  return Math.max(1, Math.min(200, total));
}

/** An oracle-style run: each crossing on the quickest no-stop path, after standing `waits[k]` extra ticks on its kerb. */
function scriptedRun(seed: number, waits: readonly number[]): ArcadeInputEvent[] {
  const init = v11.init(seed) as CrossState;
  const half = crossPlayerHalfFp(init);
  const events: ArcadeInputEvent[] = [];
  let crossStart = 0;
  let first = 1;
  for (let k = 0; ; k++) {
    const course = init.courses[Math.min(k, CROSS_COURSES - 1)]!;
    const rel0 = first - crossStart + (waits[k] ?? 0);
    const deadline = CROSS_RUN_TICKS - crossStart;
    if (rel0 >= deadline) break;
    const path = crossingPath(course, half, rel0, deadline, 0, 1, CROSS_V11_STOP_TICKS, CROSS_X_ISLAND);
    for (const s of path.steps) events.push(move(crossStart + s.rel, s.a));
    if (!path.finished) break;
    crossStart = crossStart + path.endRel + CROSS_PAUSE_TICKS;
    first = crossStart;
    if (crossStart >= CROSS_RUN_TICKS) break;
  }
  return events;
}

/* 1. Wiring. */
{
  ok((generatePuzzle("cross") as any).crossRev === CROSS_REV_FLOW && CROSS_REV_FLOW === CROSS_REV_STD + 1, "rooms deal crossRev 11 (crossRev 10 before 3 Nov 2026)");
  ok(LIVE_BANDS.cross.rev === CROSS_REV_FLOW && LIVE_BANDS.cross.curve === CROSS_V11_BAND_CURVE, "LIVE_BANDS deals crossRev 11 on its core line");
  ok(bandPoints(CROSS_V11_BAND_CURVE, 0) === 0 && bandPoints(CROSS_V11_BAND_CURVE, CROSS_V11_CORE_FULL) === CROSS_V11_CORE_MAX && bandPoints(CROSS_V11_BAND_CURVE, 38) === 75, "the core line: 0 → 0, 38 → 75, 76 → 150");
  ok(CROSS_FLOW_STD.parts.reduce((a, p) => a + p.max, 0) === 200 && ROUND_MAX.cross === 200, "the parts add up to 200, the round maximum");
  ok(CROSS_FLOW_STD.parts.map((p) => `${p.key}:${p.max}`).join(" ") === "core:150 streak:40 close:10", "parts: core 150, no-stop streak 40, close calls 10");
  const help = PUZZLE_INSTRUCTIONS.cross;
  const text = [help.goal, ...help.how.map((l) => `${l.action} ${l.detail}`), help.score].join(" ");
  ok(!/coin/i.test(text), "the help mentions no coins");
  // Text pass (4 Nov 2026): the help is a list, one line a part, then penalties, then the total; the intro names the
  // bonuses in one plain sentence (no internal figures).
  ok(/no-stop streak/i.test(help.score) && hasScorePart(help.score, "Rows and crossings", 150) && help.score.endsWith("Total 200.") && help.score.includes(`hit costs ${CROSS_V11_HIT_COST}`), `the help's score: the core line, the streak, the hit cost, 200 (${help.score})`);
  ok(help.how.some((l) => l.action.startsWith("No-stop streak") && l.detail.includes("0.5 s") && l.detail.includes(`adds ${CROSS_V11_FLOW_EACH}, up to ${CROSS_V11_FLOW_MAX}`)), "the help states the no-stop rule: half a second, 10 each, up to 40");
  const intro = INTRO_SCORE.cross;
  ok(intro.length <= 90 && /no-stop/.test(intro) && !/coin/i.test(intro) && /close calls/.test(intro) && /hits cost/.test(intro) && intro.endsWith("Up to 200."), `the intro line (${intro.length} characters): ${intro}`);
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(demo.includes('demo.puzzle.crossRev !== CROSS_REV_FLOW) return null'), "the intro demo plays only when recorded on crossRev 11");
  ok(playRevOf("cross", CROSS_REV_FLOW) === CROSS_REV_STD, "playRevOf: crossRev 11 keeps crossRev 10's play");
  ok(crossWorldHFor(CROSS_REV_FLOW) === crossWorldHFor(CROSS_REV_STD) && crossWorldHFor(CROSS_REV_STD) === crossWorldHFor(CROSS_REV_EXPAND), "crossRev 11 plays crossRev 9's world");
}

/* 2. Older stamps unchanged. */
const legacy = JSON.parse(gunzipSync(readFileSync(LEGACY)).toString()) as { runs: CrossLegacyRecord[] };
ok(legacy.runs.length === 44, `44 legacy runs (got ${legacy.runs.length})`);
for (const run of legacy.runs) {
  const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
  const now = quiet(() => spec.replay(run.seed, raw, run.rev));
  const tag = `crossRev ${run.rev ?? "unstamped"} ${run.level} seed ${run.seed}`;
  ok(now.score === run.score && Boolean(now.flagged) === run.flagged, `${tag}: score ${now.score} (stored ${run.score})`);
  ok(stateDigest(now.state) === run.digest && digest(now.checkpoints) === run.checkpoints, `${tag}: the same final state and checkpoints`);
  ok(!(now.state as CrossState).flow, `${tag}: no flow`);
}

/* 3. The same courses and the same walker. */
for (let n = 0; n < 40; n++) {
  const seed = roomSeed(n);
  const a = v10.init(seed) as CrossState;
  const b = v11.init(seed) as CrossState;
  ok(JSON.stringify(a.courses.map((c) => c.lanes)) === JSON.stringify(b.courses.map((c) => c.lanes)), `seed ${seed}: crossRev 11's lanes are crossRev 10's`);
  ok(b.courses.every((c) => !c.coins) && b.flow === 1 && b.still === 0 && b.stopped === 0 && b.rng === a.rng, `seed ${seed}: no coins, flow set, the same rng`);
}
const walkerLevels = ["weak", "good", "elite", "perfect"] as const;
for (const level of walkerLevels)
  for (let n = 0; n < 3; n++) {
    const seed = roomSeed(500 + n);
    const events = bot({ game: v10, seed, rev: CROSS_REV_STD, human: new Human("cross", seed, level), fixes: true }).events ?? [];
    const trail10: string[] = [];
    const trail11: string[] = [];
    play(v10, seed, events, (s) => trail10.push(walker(s)));
    const end = play(v11, seed, events, (s) => trail11.push(walker(s)));
    ok(trail10.length === trail11.length && trail10.every((w, i) => w === trail11[i]), `${level} seed ${seed}: crossRev 10's log moves the walker identically on crossRev 11`);
    ok((end.coinTotal ?? 0) === 0 && (end.coins ?? 0) === 0, `${level} seed ${seed}: no coin collected on crossRev 11`);
  }

/* 4. The rules, scripted. */
{
  const seed = roomSeed(3);
  // The stand count: the first crossing has no pause (pauseUntil 0); 30 ticks stood is still no-stop, the 31st stops it.
  let s = v11.init(seed) as CrossState;
  for (let i = 0; i < CROSS_V11_STOP_TICKS; i++) s = v11.step(s, null);
  ok(s.still === CROSS_V11_STOP_TICKS && s.stopped === 0 && crossFlowNext(s) === 1, `30 ticks on the kerb: still 30, not stopped (${s.still}, ${s.stopped})`);
  s = v11.step(s, null);
  ok(s.stopped === 1 && crossFlowNext(s) === 0, "the 31st tick stops the crossing");
  // Side-steps along the kerb still count; a hop resets the count.
  let t = v11.init(seed) as CrossState;
  for (let i = 1; i <= 25; i++) t = v11.step(t, i === 10 ? move(10, 2) : i === 20 ? move(20, 3) : null);
  ok(t.still === 25 && t.col === (v11.init(seed) as CrossState).col, `side-steps along the kerb keep counting (${t.still})`);
  t = v11.step(t, move(26, 0));
  ok(t.still === 0 && t.hop > 0 && t.stopped === 0, "a hop resets the count");
  // The kerb pause after a crossing does not count.
  const oracle = scriptedRun(seed, []);
  let paused = 0;
  play(v11, seed, oracle, (st) => {
    if (st.tick < st.pauseUntil && (st.still ?? 0) > 0) paused++;
  });
  ok(paused === 0, "nothing counts during the kerb pause");
  // Older stamps: crossFlowScore is not their scoring, and a crossRev 10 state carries no flow counters.
  const ten = play(v10, seed, oracle);
  ok(ten.still === undefined && ten.stopped === undefined && !ten.flow, "crossRev 10 states carry no flow counters");
}
// The streak against the reference count: oracle runs with waits inserted (each wait over 30 ticks stops that crossing).
const waitSets: { name: string; waits: number[] }[] = [
  { name: "no waits", waits: [] },
  { name: "the 2nd crossing waits 45", waits: [0, 45] },
  { name: "the 1st and 4th wait 40", waits: [40, 0, 0, 40] },
  { name: "every other crossing waits 35", waits: [0, 35, 0, 35, 0, 35, 0, 35, 0, 35, 0, 35] },
  { name: "the 3rd waits 20 (still no-stop if the path leaves within 10)", waits: [0, 0, 20] },
];
for (const n of [0, 7, 61, 120]) {
  const seed = roomSeed(n);
  for (const w of waitSets) {
    const events = scriptedRun(seed, w.waits);
    const ref = referenceStreak(seed, events);
    const end = ref.state;
    ok(end.streakPts === ref.pts && end.streak === ref.run, `seed ${seed}, ${w.name}: streak ${end.streakPts} (${end.streak} in a row) = the reference ${ref.pts} (${ref.run}) for ${ref.seq}`);
    ok(v11.score(end) === referenceScore(end), `seed ${seed}, ${w.name}: score ${v11.score(end)} = the rules' ${referenceScore(end)}`);
    for (let k = 0; k < w.waits.length && k < ref.seq.length; k++)
      if ((w.waits[k] ?? 0) > CROSS_V11_STOP_TICKS) ok(ref.seq[k] === "S", `seed ${seed}, ${w.name}: crossing ${k + 1} (waited ${w.waits[k]}) is a stop`);
    if (!w.waits.length) ok(/^N+$/.test(ref.seq) && end.streakPts === CROSS_V11_FLOW_MAX && end.lives === CROSS_LIVES, `seed ${seed}: the oracle's crossings are all no-stop (${ref.seq}), a full streak, no hit`);
  }
}
// The streak, close calls and score against the references on bot runs at every level (hits included).
for (const level of ALL_LEVELS)
  for (let n = 0; n < 2; n++) {
    const seed = roomSeed(600 + n);
    const events = bot({ game: v11, seed, rev: CROSS_REV_FLOW, human: new Human("cross", seed, level), fixes: true }).events ?? [];
    const ref = referenceStreak(seed, events);
    const end = ref.state;
    const ten = play(v10, seed, events);
    ok(end.streakPts === ref.pts, `${level} seed ${seed}: streak ${end.streakPts} = the reference ${ref.pts} (${ref.seq})`);
    ok((end.closeCalls ?? 0) === (ten.closeCalls ?? 0), `${level} seed ${seed}: close calls ${end.closeCalls} = crossRev 10's ${ten.closeCalls}`);
    ok(crossFlowScore(end).features["close"] === Math.min(10, end.closeCalls ?? 0), `${level} seed ${seed}: close calls pay 1 each up to 10`);
    ok(v11.score(end) === referenceScore(end), `${level} seed ${seed}: score ${v11.score(end)} = the rules' ${referenceScore(end)}`);
    ok(crossFlowScore(end).penalty === CROSS_V11_HIT_COST * (CROSS_LIVES - end.lives), `${level} seed ${seed}: ${CROSS_LIVES - end.lives} hits cost ${CROSS_V11_HIT_COST} each`);
  }
// Built states: caps, the floor of 1, idle 0, the reveal and grading's extra.
{
  const base = v11.init(roomSeed(9)) as CrossState;
  const full = { ...base, acted: 1, tick: CROSS_RUN_TICKS, crossings: 9, reached: 0, streakPts: 999, streak: 9, closeCalls: 40 } as CrossState;
  ok(v11.score(full) === 200, `everything past its cap, no hit: 200 (${v11.score(full)})`);
  ok(v11.score({ ...full, lives: 1 }) === 170, "two hits cost 30");
  ok(v11.score({ ...base, acted: 1, lives: 0, crossings: 0, reached: 3, dead: true }) === 1, "a played run that lost every life on 3 rows: held at 1");
  ok(v11.score({ ...base, acted: 0 }) === 0, "no input: 0");
  const mid = { ...base, acted: 1, crossings: 3, reached: 5, streakPts: 10, streak: 2, closeCalls: 4, lives: 2 } as CrossState;
  // units 3 × 14 + 5 + 6 = 53 → floor(150 × 53 ÷ 76) = 104; + 10 + 4 − 15 = 103.
  ok(v11.score(mid) === 103, `3 crossings and 5 rows, a streak of 10, 4 close calls, one hit: 104 + 10 + 4 − 15 = 103 (${v11.score(mid)})`);
  const reveal = buildArcadeReveal("cross", { state: mid, crossings: 3, lanes: crossTotalLanes(mid) }, 103);
  ok(Boolean(reveal && reveal.lines.join(" | ") === "47 rows · 3 crossings → 104 | no-stop streak 10 · 4 close calls 4 +14 | 1 hit −15 | Total → 103"), `the reveal's lines: ${JSON.stringify(reveal?.lines)}`);
  const parts = crossBandParts(mid);
  ok(parts.points === 104 && parts.bonus === 14 && parts.penalty === 15, "the band parts: core 104, features 14, hits 15");
  // Grading stores the streak and close calls, no coins.
  const seed = roomSeed(4);
  const events = scriptedRun(seed, [0, 45]);
  const end = play(v11, seed, events);
  const raw = encodeCrossRun({ seed, claimedScore: v11.score(end), events, endTick: end.tick, checkpoints: [] });
  const graded = readFileSync("src/lib/duel/grade.ts", "utf8");
  ok(graded.includes("run.state.flow ? { noStop:"), "grading stores the no-stop streak for crossRev 11 rounds");
  const replayed = quiet(() => replayCrossRun(seed, raw, CROSS_REV_FLOW));
  ok(replayed.score === v11.score(end) && (replayed.state.coinTotal ?? 0) === 0, "the server replay agrees (no coins)");
}
// Perfect runs: the oracle reaches 200 through the server replay on 12 seeds.
for (const n of [0, 1, 2, 3, 7, 11, 23, 42, 61, 99, 150, 250]) {
  const r = crossCeilingRun(roomSeed(n), 1, CROSS_REV_FLOW);
  ok(r.score === 200 && !r.flagged && r.streakPts === CROSS_V11_FLOW_MAX && r.coins === 0, `seed index ${n}: the oracle scores 200 through the server replay (${r.score}, ${r.crossings} crossings, streak ${r.streakPts}, close calls ${r.closeCalls})`);
}
// One step scores 1; no input 0 (through the server path).
for (const n of [3, 40]) {
  const seed = roomSeed(n);
  const step = play(v11, seed, [move(5, 2)]);
  ok(v11.score(step) === 1, `seed index ${n}: one sideways step scores 1`);
  ok(v11.score(play(v11, seed, [])) === 0, `seed index ${n}: no input scores 0`);
}

/* 5. Stored crossRev 11 runs. */
const LEVELS = ["weak", "average", "good", "great", "near", "elite", "perfect"] as const;
if (RECORD) {
  const runs: any[] = [];
  for (const level of LEVELS)
    for (let n = 0; n < 3; n++) {
      const seed = spec.seedFor(400 + n);
      const out = bot({ game: v11, seed, rev: CROSS_REV_FLOW, human: new Human("cross", seed, level), fixes: true });
      const checkpoints: unknown[] = [];
      const state = play(v11, seed, out.events ?? [], (s) => {
        if (s.tick % 300 === 0) checkpoints.push(crossCheckpoint(s));
      });
      const raw = encodeCrossRun({ seed, claimedScore: v11.score(state), events: out.events ?? [], endTick: state.tick, checkpoints: checkpoints as any });
      const result = replayCrossRun(seed, raw, CROSS_REV_FLOW);
      runs.push({ level, seed, raw, score: result.score, digest: stateDigest(result.state) });
    }
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recorded: "crossRev 11 (no coins, the no-stop streak, a hit costs 15), 3 Nov 2026", runs })));
  console.log(`wrote ${FIXTURE} (${runs.length} runs)`);
}
const recorded = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { runs: any[] };
ok(recorded.runs.length === 21, `21 stored crossRev 11 runs (got ${recorded.runs.length})`);
for (const run of recorded.runs) {
  const now = quiet(() => replayCrossRun(run.seed, run.raw, CROSS_REV_FLOW));
  const tag = `${run.level} seed ${run.seed}`;
  ok(!now.flagged, `${tag}: replays unflagged (${now.reason ?? ""})`);
  ok(now.score === run.score && stateDigest(now.state) === run.digest, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
  ok(now.score >= 1 && now.score <= 200 && now.score === referenceScore(now.state), `${tag}: played, 1–200, the rules' score`);
}

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL cross-rev11-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS cross-rev11-check: ${checks} checks — wiring, ${legacy.runs.length} legacy runs unchanged, 40 worlds, the same walker as crossRev 10, scripted rules and the perfect 200, ${recorded.runs.length} stored runs`);
