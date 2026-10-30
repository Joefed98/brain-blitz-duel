/**
 * beat-standard-check (29 Oct 2026, docs/arcade-standard/beat.md): Tempo beatRev 11 on the arcade scoring standard.
 *
 *  1. Older stamps replay as before: 28 beatRev 10 runs recorded on the untouched tree (99115b0, the skill-band tool's
 *     bots, scripts/fixtures/beat-standard-legacy.json.gz) replay through the server to their stored score and counters,
 *     unflagged (their checkpoint checksums, which fold in every feature counter, match). tempo-ease-check and
 *     expansion-e2-check prove beatRev 9 and 10 states byte for byte, and the older games' own checks the rest.
 *  2. Wiring: rooms deal beatRev 11; it is beatRev 10's game (75 s, the same chart and input ranges) with `std: 1`.
 *  3. Play unchanged: the same inputs on beatRev 10 and 11 give the same judgements, counters and feature counts.
 *  4. Scoring: a beatRev 11 run's score is stdScore of its parts; the parts read the run's own counts; no input 0.
 *  5. Earning a feature never costs accuracy: the same run without its fever taps keeps every judgement and its
 *     accuracy points, and earns no more fever.
 *  6. New-stamp runs from the bots (7 levels × 4 seeds) replay through the server path (replayBeatRun) to their
 *     score, unflagged, between 1 and 200.
 *
 *   bun scripts/beat-standard-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot as beatBot } from "./arcade-skill-bands/bots/beat";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { replayBeatRun } from "../src/lib/duel/beat";
import { beatWorldH, beatWorldHFor, BEAT_REV_STD as STD_REV, BEAT_TALL_H, beatGameFor as gameForRev } from "../src/lib/arcade/beat";
import { arcadeCounters } from "../src/lib/arcade/diagnostics";
import { stdScore } from "../src/lib/arcade/arcadeStandard";
import {
  beatAccuracy,
  beatGameFor,
  beatStdParts,
  BEAT_INPUT_FEVER,
  BEAT_REV_EASE,
  BEAT_REV_STD,
  BEAT_V9_RUN_TICKS,
  type BeatState,
} from "../src/lib/arcade/beat";

const LEVELS = ["weak", "average", "good", "great", "near", "elite", "perfect"] as const;
let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};
const spec = GAME_BY_TYPE.get("beat" as never)!;

/* 1. Older stamps. */
const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/beat-standard-legacy.json.gz")).toString()) as { runs: any[] };
// The play screen, reveal and replays size the world from the stamp: beatRev 11 draws beatRev 10's tall world.
ok(beatWorldHFor(STD_REV) === BEAT_TALL_H && beatWorldH(gameForRev(STD_REV).init(1)) === BEAT_TALL_H, "beatRev 11's world is the tall one, by stamp and by state");
ok(legacy.runs.length === 28 && legacy.runs.every((r) => r.rev === BEAT_REV_EASE), `28 stored beatRev 10 runs (got ${legacy.runs.length})`);
for (const run of legacy.runs) {
  const now = replayBeatRun(run.seed, run.raw, run.rev);
  const tag = `beatRev ${run.rev} ${run.level} seed ${run.seed}`;
  ok(!now.flagged && now.desyncTick === null, `${tag}: replays unflagged, every checkpoint checksum as recorded`);
  ok(now.score === run.score, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
  ok(JSON.stringify(arcadeCounters("beat", now.state, now.score)) === JSON.stringify(run.counters), `${tag}: the same counters`);
  ok(beatStdParts(now.state) === null, `${tag}: no standard parts on beatRev 10`);
}

/* 2. Wiring. */
ok((generatePuzzle("beat") as any).beatRev === BEAT_REV_STD && BEAT_REV_STD === BEAT_REV_EASE + 1, "rooms deal beatRev 11 (one above beatRev 10)");
const v10 = beatGameFor(BEAT_REV_EASE);
const v11 = beatGameFor(BEAT_REV_STD);
ok(v11.runTicks === BEAT_V9_RUN_TICKS && v11.inputRanges === v10.inputRanges, "beatRev 11 keeps beatRev 10's 75 s song and inputs");
for (const seed of [1, 77, 4242, 99991]) {
  const a = v10.init(seed) as BeatState;
  const b = v11.init(seed) as BeatState;
  const { std, ...rest } = b;
  ok(std === 1 && a.std === undefined && JSON.stringify(rest) === JSON.stringify(a), `seed ${seed}: beatRev 11's init is beatRev 10's plus std: 1`);
}

/* 3–6. Bot runs. */
const play = (rev: number, level: string, seed: number, drop?: (e: any) => boolean) => {
  const game = spec.gameFor(rev, seed);
  const out = beatBot({ game, seed, rev, human: new Human("beat", seed, level as never), fixes: true });
  const events = (out.events ?? []).filter((e: any) => !drop || !drop(e));
  const by = new Map(events.map((e: any) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints: unknown[] = [];
  while (!game.isOver(s)) {
    s = game.step(s, by.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(spec.checkpoint(s));
  }
  return { events, state: s as BeatState, score: game.score(s), checkpoints };
};
/** Replays events on a revision (no bot), to compare play across stamps. */
const replayOn = (rev: number, seed: number, events: any[]) => {
  const game = beatGameFor(rev);
  const by = new Map(events.map((e: any) => [e.t, e]));
  let s = game.init(seed) as BeatState;
  while (!game.isOver(s)) s = game.step(s, by.get(s.tick + 1) ?? null) as BeatState;
  return s;
};
const same = (a: BeatState, b: BeatState) =>
  JSON.stringify([a.judged, a.perfect, a.good, a.ok, a.misses, a.strays, a.fevers, a.goldsHit, a.doublesDone, a.maxStreak, a.feverQ]) ===
  JSON.stringify([b.judged, b.perfect, b.good, b.ok, b.misses, b.strays, b.fevers, b.goldsHit, b.doublesDone, b.maxStreak, b.feverQ]);

let top = 0;
let feverRuns = 0;
for (const level of LEVELS)
  for (let n = 0; n < 4; n++) {
    const seed = spec.seedFor(n);
    const tag = `${level} seed ${seed}`;
    const r = play(BEAT_REV_STD, level, seed);
    // 3. Play unchanged.
    ok(same(r.state, replayOn(BEAT_REV_EASE, seed, r.events)), `${tag}: beatRev 10 judges the same inputs the same`);
    // 4. Scoring.
    const parts = beatStdParts(r.state)!;
    ok(parts !== null && r.score === stdScore(parts, true), `${tag}: the score is the standard's sum of parts`);
    ok(parts[0]!.detail === `${beatAccuracy(r.state)} of 1,000`, `${tag}: accuracy reads the run's judgements`);
    // 5. Fever taps never cost accuracy.
    if ((r.state.fevers ?? 0) > 0) {
      feverRuns++;
      const without = replayOn(BEAT_REV_STD, seed, r.events.filter((e: any) => e.k !== BEAT_INPUT_FEVER));
      const p0 = beatStdParts(without)!;
      ok(JSON.stringify(without.judged) === JSON.stringify(r.state.judged) && p0[0]!.points === parts[0]!.points, `${tag}: without its fever taps the same judgements and accuracy points`);
      ok((without.fevers ?? 0) === 0 && p0[1]!.points === 0 && parts[1]!.points > 0, `${tag}: fever pays only for fevers started`);
    }
    // 6. Through the server path.
    const raw = spec.encode({ seed, claimedScore: r.score, events: r.events, endTick: r.state.tick, checkpoints: r.checkpoints }, BEAT_REV_STD, seed);
    const res = replayBeatRun(seed, raw, BEAT_REV_STD);
    ok(!res.flagged && res.score === r.score, `${tag}: replays through the server to ${r.score} (got ${res.score}${res.flagged ? ", flagged" : ""})`);
    ok(res.score >= 1 && res.score <= 200, `${tag}: a played run scores 1–200 (${res.score})`);
    top = Math.max(top, res.score);
  }
ok(feverRuns >= 10, `fever taps tested on ${feverRuns} runs`);
ok(top >= 195, `a flawless bot run reaches ${top}`);
ok(v11.score(v11.init(5)) === 0, "no input scores 0");

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL beat-standard-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS beat-standard-check: ${checks} checks (28 beatRev 10 runs as recorded; beatRev 11 plays as 10, scores on the standard)`);
