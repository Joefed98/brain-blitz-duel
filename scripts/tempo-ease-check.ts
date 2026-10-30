/**
 * tempo-ease-check (27 Oct 2026, docs/phone-notes-oct-2026/beat.md): Tempo beatRev 10, Joe's phone notes ("about
 * 20 % easier, especially once the 5th lane arrives; scores should rise accordingly").
 *
 *  1. Wiring: rooms deal beatRev 10, the help reads its curve (beatRev 9's), ROUND_MAX stays 200, the intro demo
 *     is stopped until one is recorded on beatRev 10. beatRev 1–9 replay exactly as before: expansion-e2-check's
 *     legacy and beatRev 9 fixtures (both recorded before this change) and the older games' own checks.
 *  2. The rules: windows 4 / 8 / 13 ticks on beatRev 10 (a tap 4 ticks off is Perfect, 13 off is OK) and still
 *     3 / 7 / 12 on beatRev 9 (the same taps Good and missed); a hold's release on the same windows.
 *  3. The chart: the same seed builds the same chart twice; four lanes then five; no note in the break; quarter
 *     notes alone (and double taps) for the first 4 s of five lanes; double taps 9 ticks apart in one lane; fewer
 *     notes than beatRev 9 on the same seed, overall and from the fifth lane; the last note judged before the end;
 *     no input scores 0.
 *  4. Paired bots (the skill-band tool's, 30 seeds): every level's median rises from beatRev 9 to beatRev 10 and
 *     the medians still climb weak < average < good < great < near-perfect; no played run scores 0.
 *  5. Stored runs (scripts/fixtures/tempo-ease-runs.json.gz, --record): replay through the server to their stored
 *     score and state, unflagged, at most 200 with every feature within its cap, and a flawless run scores 200.
 *
 *   bun scripts/tempo-ease-check.ts [--record]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gunzipSync, gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot as beatBot } from "./arcade-skill-bands/bots/beat";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { ROUND_MAX } from "../src/lib/duel/roundMax";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import {
  beatGameFor,
  beatV9Bonus,
  beatWindows,
  BEAT_DOUBLE_GAP,
  BEAT_INPUT_RELEASE,
  BEAT_INPUT_TAP,
  BEAT_JUDGE_GOOD,
  BEAT_JUDGE_MISS,
  BEAT_JUDGE_NONE,
  BEAT_JUDGE_OK,
  BEAT_JUDGE_PENDING,
  BEAT_JUDGE_PERFECT,
  BEAT_REV_200,
  BEAT_REV_EASE,
  BEAT_REV_STD,
  BEAT_STD_SPEC,
  BEAT_V10_BAND_CURVE,
  BEAT_V10_WINDOWS,
  BEAT_V9_BAND_CURVE,
  BEAT_V9_BREAK,
  BEAT_V9_CAPS,
  BEAT_V9_FIVE_FROM,
  BEAT_V9_RUN_TICKS,
  BEAT_WINDOWS,
  type BeatState,
} from "../src/lib/arcade/beat";

const RECORD = process.argv.includes("--record");
const FIXTURE = "scripts/fixtures/tempo-ease-runs.json.gz";
const LEVELS = ["weak", "average", "good", "great", "near", "elite", "perfect"] as const;
let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};
const digest = (state: unknown) => createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 24);
const spec = GAME_BY_TYPE.get("beat" as never)!;

/* 1. Wiring. */
// The arcade scoring standard (29 Oct 2026) moved rooms on to beatRev 11, beatRev 10's play on the standard
// (beat-standard-check); beatRev 10 stays proved here.
ok((generatePuzzle("beat") as any).beatRev === BEAT_REV_STD && BEAT_REV_STD === BEAT_REV_EASE + 1 && BEAT_REV_EASE === BEAT_REV_200 + 1, "rooms deal beatRev 11 (beatRev 10, one above beatRev 9, before the scoring standard)");
ok(LIVE_BANDS.beat.rev === BEAT_REV_STD && LIVE_BANDS.beat.std === BEAT_STD_SPEC && BEAT_V10_BAND_CURVE === BEAT_V9_BAND_CURVE, "beatRev 10 scored on beatRev 9's curve; the help reads beatRev 11's standard");
ok(ROUND_MAX.beat === 200, "Tempo's round maximum stays 200");
ok(/data\.type === "beat" && demo\?\.puzzle\.type === "beat" && demo\.puzzle\.beatRev !== BEAT_REV_STD\) return null/.test(readFileSync("src/lib/duel/introDemo.functions.ts", "utf8")), "Tempo's intro demo is stopped until recorded on beatRev 11 (beatRev 10 before the scoring standard)");
ok(beatGameFor(BEAT_REV_EASE).runTicks === BEAT_V9_RUN_TICKS, "beatRev 10 keeps the 75 s song");

/* 2. The windows. */
ok(BEAT_V10_WINDOWS.perfect === 4 && BEAT_V10_WINDOWS.good === 8 && BEAT_V10_WINDOWS.ok === 13, "beatRev 10's windows are 4 / 8 / 13 ticks");
ok(BEAT_WINDOWS.perfect === 3 && BEAT_WINDOWS.good === 7 && BEAT_WINDOWS.ok === 12, "older rounds keep 3 / 7 / 12 ticks");
/** Plays one tap `off` ticks from note `i` (negative = early) and returns the note's judgement after its window. */
function tapJudge(rev: number, seed: number, pick: (s: BeatState, i: number) => boolean, off: number, release?: number): number | null {
  const game = beatGameFor(rev);
  let s = game.init(seed);
  const i = s.chart.ticks.findIndex((_, k) => pick(s, k));
  if (i < 0) return null;
  const at = s.chart.ticks[i]! + off;
  const lane = s.chart.lanes[i]!;
  const rel = release === undefined ? -1 : s.chart.ticks[i]! + s.chart.holds[i]! + release;
  const end = Math.max(at, rel) + 20;
  while (s.tick < end) {
    const t = s.tick + 1;
    s = game.step(s, t === at ? { t, k: BEAT_INPUT_TAP, a: lane, b: 0, c: 0, d: 0 } : t === rel ? { t, k: BEAT_INPUT_RELEASE, a: lane, b: 0, c: 0, d: 0 } : null);
  }
  return s.judged[i]!;
}
/** A plain note (no hold, swipe or double) alone in its lane for a second either side. */
const plain = (s: BeatState, i: number) => {
  const { ticks, lanes, holds, swipes = [], pairs = [] } = s.chart;
  if (holds[i] || swipes[i] || (pairs[i] ?? -1) >= 0 || pairs.includes(i) || ticks[i]! < 300) return false;
  return ticks.every((t, k) => k === i || lanes[k] !== lanes[i] || Math.abs(t - ticks[i]!) > 60);
};
const hold = (s: BeatState, i: number) => s.chart.holds[i]! > 0;
for (let n = 0; n < 6; n++) {
  const seed = spec.seedFor(n);
  for (const off of [-4, 4]) {
    ok(tapJudge(BEAT_REV_EASE, seed, plain, off) === BEAT_JUDGE_PERFECT, `seed ${seed}: beatRev 10, a tap ${off} ticks off is Perfect`);
    ok(tapJudge(BEAT_REV_200, seed, plain, off) === BEAT_JUDGE_GOOD, `seed ${seed}: beatRev 9, a tap ${off} ticks off is Good`);
  }
  ok(tapJudge(BEAT_REV_EASE, seed, plain, 8) === BEAT_JUDGE_GOOD && tapJudge(BEAT_REV_200, seed, plain, 8) === BEAT_JUDGE_OK, `seed ${seed}: 8 ticks off is Good on beatRev 10, OK on 9`);
  ok(tapJudge(BEAT_REV_EASE, seed, plain, -13) === BEAT_JUDGE_OK && tapJudge(BEAT_REV_200, seed, plain, -13) !== BEAT_JUDGE_OK, `seed ${seed}: 13 ticks early is OK on beatRev 10, not on 9`);
  ok(tapJudge(BEAT_REV_EASE, seed, plain, 14) === BEAT_JUDGE_MISS, `seed ${seed}: beatRev 10, 14 ticks late misses`);
  ok(tapJudge(BEAT_REV_EASE, seed, hold, 0, 4) === BEAT_JUDGE_PERFECT && tapJudge(BEAT_REV_200, seed, hold, 0, 4) === BEAT_JUDGE_GOOD, `seed ${seed}: a hold released 4 ticks late is Perfect on beatRev 10, Good on 9`);
  ok(tapJudge(BEAT_REV_EASE, seed, hold, 0, 9) === BEAT_JUDGE_MISS, `seed ${seed}: a hold released 9 ticks late is missed on beatRev 10`);
  ok(![BEAT_JUDGE_NONE, BEAT_JUDGE_PENDING].includes(tapJudge(BEAT_REV_EASE, seed, hold, 0, 8) ?? 0), `seed ${seed}: a hold's release is judged`);
}

/* 3. The chart. */
for (let n = 0; n < 40; n++) {
  const seed = spec.seedFor(n);
  const game = beatGameFor(BEAT_REV_EASE);
  const a = game.init(seed);
  const old = beatGameFor(BEAT_REV_200).init(seed);
  ok(JSON.stringify(a) === JSON.stringify(game.init(seed)), `seed ${seed}: the same chart twice`);
  ok(a.ease === 1 && a.exp === 1 && old.ease === undefined && beatWindows(old) === BEAT_WINDOWS && beatWindows(a) === BEAT_V10_WINDOWS, `seed ${seed}: beatRev 10 states carry ease: 1, beatRev 9's never`);
  const { ticks, lanes, pairs = [] } = a.chart;
  ok(ticks.every((t, i) => (t < BEAT_V9_FIVE_FROM ? lanes[i]! < 4 : lanes[i]! < 5)) && lanes.includes(4), `seed ${seed}: four lanes, then five`);
  ok(ticks.every((t) => !(t > BEAT_V9_FIVE_FROM - BEAT_V9_BREAK && t < BEAT_V9_FIVE_FROM + 15)), `seed ${seed}: no note in the break`);
  ok(pairs.every((p, i) => p < 0 || (ticks[i]! - ticks[p]! === BEAT_DOUBLE_GAP && lanes[i] === lanes[p])), `seed ${seed}: double taps 9 ticks apart in one lane`);
  const ease = ticks.map((t, i) => [t, i] as const).filter(([t]) => t >= BEAT_V9_FIVE_FROM && t < 44 * 60);
  ok(ease.every(([t, i]) => ((t - 120) % 30 === 0 || pairs[i]! >= 0) && ticks.filter((u) => u === t).length === 1), `seed ${seed}: the five lanes ease in with single quarter notes (and double taps) for 4 s`);
  const late = (c: number[]) => c.filter((t) => t >= BEAT_V9_FIVE_FROM).length;
  ok(ticks.length < old.chart.ticks.length && late(ticks) < late(old.chart.ticks), `seed ${seed}: fewer notes than beatRev 9 (${ticks.length} vs ${old.chart.ticks.length}; from 40 s ${late(ticks)} vs ${late(old.chart.ticks)})`);
  ok(ticks.at(-1)! + BEAT_V10_WINDOWS.ok < BEAT_V9_RUN_TICKS, `seed ${seed}: the last note is judged before the end`);
  let s = a;
  while (!game.isOver(s)) s = game.step(s, null);
  ok(game.score(s) === 0, `seed ${seed}: no input scores 0`);
}

/* 4. Paired bots. */
const play = (rev: number, level: string, seed: number) => {
  const game = spec.gameFor(rev, seed);
  const out = beatBot({ game, seed, rev, human: new Human("beat", seed, level as never), fixes: true });
  const by = new Map((out.events ?? []).map((e: any) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints: unknown[] = [];
  while (!game.isOver(s)) {
    s = game.step(s, by.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(spec.checkpoint(s));
  }
  return { events: out.events ?? [], state: s, score: game.score(s), checkpoints };
};
const median = (v: number[]) => [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)]!;
const meds: Record<string, [number, number]> = {};
for (const level of LEVELS.slice(0, 5)) {
  const before: number[] = [];
  const after: number[] = [];
  for (let n = 0; n < 30; n++) {
    const seed = spec.seedFor(n);
    before.push(play(BEAT_REV_200, level, seed).score);
    after.push(play(BEAT_REV_EASE, level, seed).score);
  }
  meds[level] = [median(before), median(after)];
  ok(meds[level]![1] > meds[level]![0], `${level}: the median rises (${meds[level]![0]} → ${meds[level]![1]})`);
  ok(after.every((x) => x > 0), `${level}: no played run scores 0 on beatRev 10`);
}
const climb = LEVELS.slice(0, 5).map((l) => meds[l]![1]);
ok(climb.every((m, i) => i === 0 || m > climb[i - 1]!), `beatRev 10's medians climb by level (${climb.join(" < ")})`);

/* 5. Stored runs. */
if (RECORD) {
  const runs: any[] = [];
  for (const level of LEVELS)
    for (let n = 0; n < 4; n++) {
      const seed = spec.seedFor(n);
      const r = play(BEAT_REV_EASE, level, seed);
      const raw = spec.encode({ seed, claimedScore: r.score, events: r.events, endTick: r.state.tick, checkpoints: r.checkpoints }, BEAT_REV_EASE, seed);
      const result = spec.replay(seed, raw, BEAT_REV_EASE);
      runs.push({ rev: BEAT_REV_EASE, level, seed, raw, score: result.score, digest: digest(result.state) });
    }
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recorded: "Tempo beatRev 10 (phone notes), 27 Oct 2026", runs })));
  console.log(`wrote ${FIXTURE} (${runs.length} runs)`);
}
const stored = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { runs: any[] };
let top = 0;
for (const run of stored.runs) {
  const now = spec.replay(run.seed, run.raw, run.rev);
  const tag = `beatRev ${run.rev} ${run.level} seed ${run.seed}`;
  ok(!now.flagged, `${tag}: replays unflagged`);
  ok(now.score === run.score && digest(now.state) === run.digest, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
  ok(now.score <= 200, `${tag}: at most 200`);
  const b = beatV9Bonus(now.state as BeatState) as Record<string, number>;
  ok(b.total! <= 50 && Object.entries(BEAT_V9_CAPS).every(([k, cap]) => (b[k] ?? 0) <= cap), `${tag}: each feature within its cap`);
  top = Math.max(top, now.score);
}
ok(stored.runs.length === 28 && stored.runs.every((r) => r.rev === BEAT_REV_EASE), `28 stored beatRev 10 runs (got ${stored.runs.length})`);
ok(top === 200, `a stored beatRev 10 run scores 200 (best ${top})`);

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL tempo-ease-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS tempo-ease-check: ${checks} checks — medians beatRev 9 → 10: ${LEVELS.slice(0, 5).map((l) => `${l} ${meds[l]![0]} → ${meds[l]![1]}`).join(", ")}; ${stored.runs.length} stored runs (best ${top})`);
