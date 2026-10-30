/**
 * bintoss-standard-check (29 Oct 2026, docs/arcade-standard/bintoss.md): Swish binRev 9, the arcade scoring standard.
 *
 *  1. Older stamps replay as before: 42 skill-band runs (weak → flawless, seeds 0–5) recorded on binRev 8 before the
 *     change, each replayed on binRev 8 and binRev 7 on 99115b0's sim (scripts/fixtures/bintoss-standard-legacy.json.gz),
 *     replay through the server path to the same score and the same final state.
 *  2. Rooms deal binRev 9; it starts from binRev 8's exact draws (winds, slides, far buckets, spinners and every hoop
 *     binRev 8 placed), adds only the hoops binRev 8 dropped, and every run has exactly three hoops. On all 20,000
 *     seeds a best run (the far bucket on throws 1–6, every hoop, all ten in: 200) is open: every hoop on throws 1–6
 *     hangs over the far bucket, and a hoop over the main bucket only ever stands on throws 7–10 (no far bucket);
 *     sampled hoops (re-placed and binRev 8's) are proved by a launch through the hoop into the bucket it hangs over.
 *  3. Play is binRev 8's: the same input log gives the same buckets, far buckets, close misses and hoop swishes on both
 *     stamps wherever the hoops are the same; only the score differs, and binRev 9's is the parts' sum (no curve).
 *  4. Stored binRev 9 runs (scripts/fixtures/bintoss-standard-runs.json.gz) replay through the server path to their
 *     stored score and state, unflagged; the reveal's lines are the standard's parts and add up to the score.
 *
 *   bun scripts/bintoss-standard-check.ts
 *   bun scripts/bintoss-standard-check.ts --record=<dir>   (a scripts/arcade-skill-bands.ts --save=<dir> of binRev 9 runs)
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  binTossAdvance,
  binTossBinCentre,
  binTossGameFor,
  binTossStdParts,
  binTossWindAcc,
  binTossV9HoopOver,
  binTossWindSub,
  BINTOSS_AIM,
  BINTOSS_BALL_X,
  BINTOSS_BALL_Y,
  BINTOSS_FAR_THROWS,
  BINTOSS_FLY,
  BINTOSS_HOOP_COUNT,
  BINTOSS_INPUT_FLICK,
  BINTOSS_REV_SMALL_FAR,
  BINTOSS_REV_STD,
  BINTOSS_RIM_Y,
  BINTOSS_STD,
  BINTOSS_V7_MAX_SPEED,
  BINTOSS_V9_MAIN_HOOP_FROM,
  BINTOSS_VX_MAX,
  BINTOSS_VY_MAX,
  type BinTossFlight,
  type BinTossState,
} from "../src/lib/arcade/binToss";
import { stdSum } from "../src/lib/arcade/arcadeStandard";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { replayBinTossRun } from "../src/lib/duel/binToss";
import { generatePuzzle } from "../src/lib/duel/generate.server";

const LEGACY = "scripts/fixtures/bintoss-standard-legacy.json.gz";
const RUNS = "scripts/fixtures/bintoss-standard-runs.json.gz";
const digest = (state: unknown) => createHash("sha256").update(JSON.stringify(state)).digest("hex");

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const section = (name: string) => console.log(`— ${name}`);

interface StoredRun {
  rev: number;
  level: string;
  n: number;
  seed: number;
  raw: string;
  score: number;
  digest: string;
}

const RECORD = process.argv.find((a) => a.startsWith("--record="))?.slice("--record=".length);
if (RECORD) {
  const runs: StoredRun[] = [];
  for (const level of ["weak", "average", "good", "great", "near", "elite", "perfect"]) {
    for (let n = 0; n < 6; n++) {
      const raw = readFileSync(`${RECORD}/bintoss/live-${level}-${n}.txt`, "utf8").trim();
      const seed = Number.parseInt(raw.split("|")[0]!, 10);
      const replay = replayBinTossRun(seed, raw, BINTOSS_REV_STD);
      runs.push({ rev: BINTOSS_REV_STD, level, n, seed, raw, score: replay.score, digest: digest(replay.state) });
    }
  }
  writeFileSync(RUNS, gzipSync(JSON.stringify(runs)));
  console.log(`recorded ${runs.length} binRev ${BINTOSS_REV_STD} runs to ${RUNS}`);
  process.exit(0);
}

const load = (path: string) => JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as StoredRun[];

/* 1. Older stamps. */
section("Older stamps replay as before (binRev 8 and 7, recorded on 99115b0)");
{
  const runs = load(LEGACY);
  ok(runs.length === 84, `84 legacy runs (got ${runs.length})`);
  // The logs carry binRev 8 checkpoints, so their binRev 7 replays log a desync (expected; scores and states are compared).
  const logError = console.error;
  console.error = () => {};
  for (const run of runs) {
    const replay = replayBinTossRun(run.seed, run.raw, run.rev);
    const tag = `binRev ${run.rev} ${run.level} #${run.n}`;
    ok(replay.score === run.score, `${tag}: replays to its stored ${run.score} (got ${replay.score})`);
    ok(digest(replay.state) === run.digest, `${tag}: final state identical`);
    ok(replay.far === undefined && replay.close === undefined && binTossStdParts(replay.state) === null, `${tag}: no standard parts or extras`);
    if (run.rev === BINTOSS_REV_SMALL_FAR) ok(!replay.flagged, `${tag}: its own stamp's replay is not flagged`);
  }
  console.error = logError;
  ok(new Set(runs.map((r) => r.rev)).size === 2, "both older stamps covered");
}

/* 2. Dealing and the hoops. */
section("Rooms deal binRev 9: binRev 8's draws, exactly three hoops, 200 reachable on every seed");
{
  const dealt = (generatePuzzle("bintoss") as unknown as { binRev?: number }).binRev;
  ok(dealt === BINTOSS_REV_STD, `rooms deal binRev ${BINTOSS_REV_STD} (got ${String(dealt)})`);
  const g8 = binTossGameFor(BINTOSS_REV_SMALL_FAR);
  const g9 = binTossGameFor(BINTOSS_REV_STD);

  /** Whether some launch (and, on a sliding bucket, some release moment) goes down through the hoop and into the bucket it hangs over. */
  const swishInto = (start: BinTossState, index: number, into: "far" | "main"): boolean => {
    const at: BinTossState = { ...start, throwIndex: index, resolved: index, baskets: index, results: Array.from({ length: index }, () => 1), farResults: [], farIn: 0, phase: BINTOSS_AIM, acted: 1 };
    const wind = start.winds[index] ?? 0;
    const acc = binTossWindAcc(index, start.rev);
    const sub = binTossWindSub(start.rev);
    const target = into === "far" ? start.fars![index]! : binTossBinCentre(index);
    const slide = start.slides[index]!;
    const delays = slide.amp > 0 ? Array.from({ length: Math.ceil(slide.period / 2) }, (_, d) => 2 * d) : [0];
    for (let vy = -850; vy >= -BINTOSS_VY_MAX; vy -= slide.amp > 0 ? 40 : 20) {
      // vx whose rim crossing is the bucket's centre, then a few either side.
      let lo = -BINTOSS_VX_MAX;
      let hi = BINTOSS_VX_MAX;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        let f: BinTossFlight = { x: BINTOSS_BALL_X, y: BINTOSS_BALL_Y, vx: mid, vy, windV: 0, windPos: 0 };
        for (let t = 0; t < 600 && !(f.vy > 0 && f.y >= BINTOSS_RIM_Y); t++) f = binTossAdvance(f, wind, acc, sub);
        if (f.x < target) lo = mid;
        else hi = mid;
      }
      for (const o of [0, -8, 8, -16, 16, -32, 32]) {
        const vx = hi + o;
        if (vx * vx + vy * vy > BINTOSS_V7_MAX_SPEED * BINTOSS_V7_MAX_SPEED) continue;
        for (const d of delays) {
          let s: BinTossState = { ...at, tick: at.tick + d };
          s = g9.step(s, { t: s.tick + 1, k: BINTOSS_INPUT_FLICK, a: vx, b: vy, c: 0, d: 0 });
          for (let g = 0; g < 600 && s.phase === BINTOSS_FLY; g++) s = g9.step(s, null);
          const swished = (s.swishes ?? 0) > (at.swishes ?? 0) && s.baskets > at.baskets;
          if (swished && (into === "far") === ((s.farIn ?? 0) > 0)) return true;
        }
      }
    }
    return false;
  };

  const SEEDS = 20_000;
  let added = 0;
  let mainHoops = 0;
  const proofs: { seed: number; index: number; into: "far" | "main" }[] = [];
  for (let k = 0; k < SEEDS; k++) {
    const seed = (k * 2_654_435_761 + 17) | 0;
    const a = g8.init(seed);
    const b = g9.init(seed);
    const over = binTossV9HoopOver(seed);
    const { hoops: h9, rng: _r9, std, ...rest9 } = b;
    const { hoops: h8, rng: _r8, ...rest8 } = a;
    ok(std === BINTOSS_STD && a.std === undefined, `seed ${seed}: only binRev 9 carries std`);
    ok(JSON.stringify(rest8) === JSON.stringify(rest9), `seed ${seed}: binRev 9 starts from binRev 8's draws`);
    ok((h9 ?? []).filter(Boolean).length === BINTOSS_HOOP_COUNT, `seed ${seed}: exactly three hoops`);
    for (let i = 0; i < 10; i++) {
      ok(Boolean(h9?.[i]) === (over[i] !== null), `seed ${seed}: throw ${i + 1}'s hoop plan matches the deal`);
      // 200 needs the far bucket on throws 1–6 and every hoop: a hoop on those throws must hang over the far bucket.
      if (i < BINTOSS_FAR_THROWS && h9?.[i]) ok(over[i] === "far", `seed ${seed}: the hoop on throw ${i + 1} hangs over the far bucket`);
      if (over[i] === "main") {
        mainHoops++;
        ok(i >= BINTOSS_V9_MAIN_HOOP_FROM && !b.fars?.[i], `seed ${seed}: a main-bucket hoop only on a throw with no far bucket (${i + 1})`);
        if (proofs.filter((p) => p.into === "main").length < 12) proofs.push({ seed, index: i, into: "main" });
      }
      if (h8?.[i]) ok(JSON.stringify(h8[i]) === JSON.stringify(h9?.[i]), `seed ${seed}: binRev 8's hoop on throw ${i + 1} kept`);
      else if (h9?.[i]) {
        added++;
        if (over[i] === "far" && proofs.filter((p) => p.into === "far").length < 24 && k % 7 === 0) proofs.push({ seed, index: i, into: "far" });
      }
    }
    // A sample of binRev 8's own hoops too.
    if (k % 1000 === 0) for (let i = 0; i < 10; i++) if (h8?.[i]) proofs.push({ seed, index: i, into: "far" });
    if (k < 3000) ok(JSON.stringify(g9.init(seed)) === JSON.stringify(b), `seed ${seed}: the deal is the seed's alone`);
  }
  ok(added > 0, `some binRev 8 runs had fewer than three hoops (${added} hoops added over ${SEEDS} seeds)`);
  // Each sampled hoop has a makeable throw down through it and into the bucket it hangs over (a far one: the far
  // basket and the hoop on the same throw).
  for (const { seed, index, into } of proofs) {
    const start = g9.init(seed);
    const hoop = start.hoops![index]!;
    ok(swishInto(start, index, into), `seed ${seed}: the hoop on throw ${index + 1} (${(hoop.x / 256) | 0}, ${(hoop.y / 256) | 0}) has a makeable swish into the ${into} bucket`);
  }
  console.log(`  ${added} hoops re-placed over ${SEEDS} seeds (${mainHoops} over a main bucket on throws 7-10); ${proofs.length} hoops proved makeable`);
}

/* 3. Same play, new score. */
section("binRev 9 plays as binRev 8; the score is the parts' sum");
{
  const runs = load(LEGACY).filter((r) => r.rev === BINTOSS_REV_SMALL_FAR);
  const g8 = binTossGameFor(BINTOSS_REV_SMALL_FAR);
  let same = 0;
  // A binRev 8 log's checkpoints do not match binRev 9's checksum (it folds `std` in): the replay logs a desync, expected here.
  const logError = console.error;
  console.error = () => {};
  for (const run of runs) {
    const r8 = replayBinTossRun(run.seed, run.raw, BINTOSS_REV_SMALL_FAR);
    const r9 = replayBinTossRun(run.seed, run.raw, BINTOSS_REV_STD);
    const parts = binTossStdParts(r9.state);
    ok(parts !== null && r9.score === Math.max(1, Math.min(200, stdSum(parts))), `${run.level} #${run.n}: binRev 9 scores its parts' sum`);
    if (JSON.stringify(g8.init(run.seed).hoops) !== JSON.stringify(binTossGameFor(BINTOSS_REV_STD).init(run.seed).hoops)) continue;
    same++;
    const pick = (s: BinTossState) => JSON.stringify([s.baskets, s.results, s.farIn, s.farResults, s.close, s.swishes, s.tick, s.x, s.y]);
    ok(pick(r8.state) === pick(r9.state), `${run.level} #${run.n}: the same log plays the same on binRev 8 and 9`);
    ok(r9.far === r8.state.farIn && r9.close === r8.state.close, `${run.level} #${run.n}: binRev 9's extras carry far and close`);
  }
  console.error = logError;
  ok(same >= 30, `most legacy seeds keep binRev 8's hoops (${same} of ${runs.length})`);
}

/* 4. Stored binRev 9 runs. */
section("Stored binRev 9 runs replay to their scores; the reveal adds up");
{
  const runs = load(RUNS);
  ok(runs.length === 42 && runs.every((r) => r.rev === BINTOSS_REV_STD), `42 stored binRev 9 runs (got ${runs.length})`);
  const byLevel = new Map<string, number[]>();
  for (const run of runs) {
    const replay = replayBinTossRun(run.seed, run.raw, BINTOSS_REV_STD);
    const tag = `binRev 9 ${run.level} #${run.n}`;
    ok(replay.score === run.score, `${tag}: replays to its stored ${run.score} (got ${replay.score})`);
    ok(digest(replay.state) === run.digest, `${tag}: the same final state`);
    ok(!replay.flagged, `${tag}: not flagged (${replay.reason ?? ""})`);
    ok(replay.score >= 1, `${tag}: a played run scores at least 1`);
    const reveal = buildArcadeReveal("bintoss", replay, replay.score);
    const parts = binTossStdParts(replay.state)!;
    ok(reveal !== null && reveal.lines.length === parts.length + 1 && parts.every((p, i) => reveal.lines[i]!.startsWith(`${p.label}: `)), `${tag}: the reveal lines are the standard's parts`);
    ok(stdSum(parts) === replay.score || replay.score === 1, `${tag}: the parts add up to the score`);
    byLevel.set(run.level, [...(byLevel.get(run.level) ?? []), replay.score]);
  }
  const best = byLevel.get("perfect") ?? [];
  ok(best.includes(200), `a flawless run scores 200 (${best.join(", ")})`);
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL bintoss-standard-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS bintoss-standard-check: ${checks} checks — binRev 7 and 8 replay as before; rooms deal binRev 9 (binRev 8's play, exactly three hoops) on the arcade scoring standard; stored runs replay`);
