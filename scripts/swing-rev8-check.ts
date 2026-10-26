/**
 * Grappler swingRev 8 (Tuning F, Oct 2026): the ten touch stars spread evenly
 * along the run; the cavern, hazards, physics and curve are rev 7's.
 *
 *  1. Stored rev-8 runs (skill-band runs replayed through the server path,
 *     scripts/fixtures/swing-rev8-runs.json) replay to the same score and the
 *     same final state; the pre-change rev-7 runs in
 *     scripts/fixtures/arcade-tuning-f2-legacy.json still replay as recorded.
 *  2. New rounds are stamped swingRev 8 and score on rev 7's curve; the
 *     `spread` flag is folded into the checkpoint checksum last.
 *  3. Same course: on bank courses rev 8 has rev 7's cavern, anchors, spikes,
 *     jets, stalactites and stored rng; every saved rev-7 input log plays tick
 *     for tick the same on rev 8 apart from which stars it touches (so the
 *     bank's and proveSwingSeed's proofs hold: stars never steer or end a run).
 *  4. Every rev-8 star on sampled bank courses sits on a line provedLines
 *     finds from a standard swing (the rev-6 proof), near its aim, clear of
 *     anchor rings, lava jets and stalactites; ten on every course.
 *  5. Spacing: gaps between consecutive stars, rev 7 against rev 8.
 *  6. A scripted best run takes all ten stars and scores 150 through the
 *     server replay on rev 8.
 *  7. Display: the "DRAGON N m" label's size by distance; the help text.
 *
 *   bun scripts/swing-rev8-check.ts                 (CHECKS_FULL=1: every bank course)
 *   bun scripts/swing-rev8-check.ts --record=<logs> (rewrites the fixture from
 *     `bun scripts/arcade-skill-bands.ts swing --rev=f --seeds=2 --save=<logs>`)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import type { TuningF2Record } from "./arcade-tuning-f2-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { puzzleUsesBands } from "../src/lib/arcade/bandParts";
import { recordInput } from "../src/lib/arcade/engine";
import {
  swingCheckpoint,
  swingGameFor,
  swingMetres,
  swingProvedPoints,
  swingSpreadAim,
  swingSpreadGame,
  swingStarTotal,
  SWING_JET_HALF_W,
  SWING_REV_SPREAD,
  SWING_REV_TUNEC,
  SWING_ROCK_HALF_W,
  SWING_SPREAD_WINDOW,
  SWING_STAR_TOUCH,
  SWING_STARS,
  type SwingState,
} from "../src/lib/arcade/swing";
import { swingDragonLabelScale, SWING_DRAGON_LABEL_PX } from "../src/lib/arcade/swing.renderer";
import { generateSwing } from "../src/lib/duel/arcade.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { decodeSwingRun, encodeSwingRun, replaySwingRun } from "../src/lib/duel/swing";
import { proveSwingSeedV4 } from "../src/lib/duel/swingProof.server";
import { SWING_V4_BANK } from "../src/lib/duel/swingBankV4.server";
import { playRevOf } from "./scoring-targets-revs";

const FP = 256;
const FIXTURE = "scripts/fixtures/swing-rev8-runs.json";
const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const RECORD = process.argv.find((a) => a.startsWith("--record="))?.slice("--record=".length);
const LEVELS = ["average", "good", "great", "near"] as const;

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (name: string) => console.log(`\n== ${name}`);

const spec = GAME_BY_TYPE.get("swing" as never)!;
const v7 = swingGameFor(SWING_REV_TUNEC);
const v8 = swingGameFor(SWING_REV_SPREAD);

/* ============================== 1. Stored runs ============================== */
if (RECORD) {
  const runs: TuningF2Record[] = [];
  for (const level of LEVELS)
    for (let n = 0; n < 2; n++) {
      const raw = readFileSync(`${RECORD}/swing/next-${level}-${n}.txt`, "utf8");
      const seed = spec.seedFor(n);
      const result = spec.replay(seed, raw, SWING_REV_SPREAD);
      if (result.flagged) throw new Error(`swing ${level} ${n}: the saved run is flagged`);
      runs.push({ type: "swing", rev: SWING_REV_SPREAD, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
    }
  writeFileSync(FIXTURE, `${JSON.stringify({ recorded: "skill-band runs on swingRev 8 (Tuning F), replayed through the server path", runs })}\n`);
  console.log(`recorded ${runs.length} runs to ${FIXTURE}`);
}

section("Stored rev-8 runs and pre-change rev-7 runs replay exactly");
const unpack = (r: TuningF2Record) => gunzipSync(Buffer.from(r.raw, "base64")).toString();
{
  const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as { runs: TuningF2Record[] };
  ok(fixture.runs.length >= 8 && fixture.runs.every((r) => r.rev === SWING_REV_SPREAD), `${fixture.runs.length} stored swingRev 8 runs`);
  for (const run of fixture.runs) {
    const result = replaySwingRun(run.seed, unpack(run), run.rev);
    ok(!result.flagged && result.score === run.score, `rev 8 ${run.level} ${run.seed}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `rev 8 ${run.level} ${run.seed}: the replayed final state changed`);
  }
  console.log(`  ${fixture.runs.length} rev-8 runs: ${fixture.runs.map((r) => r.score).join(", ")}`);
}
const legacy = (JSON.parse(readFileSync("scripts/fixtures/arcade-tuning-f2-legacy.json", "utf8")) as { runs: TuningF2Record[] }).runs.filter((r) => r.type === "swing");
{
  ok(legacy.length >= 8 && legacy.every((r) => r.rev === SWING_REV_TUNEC), `${legacy.length} pre-change swingRev 7 runs`);
  for (const run of legacy) {
    const result = replaySwingRun(run.seed, unpack(run), run.rev);
    ok(!result.flagged && result.score === run.score, `rev 7 ${run.level} ${run.seed}: stored ${run.score}, replays ${result.score}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `rev 7 ${run.level} ${run.seed}: the replayed final state changed`);
  }
}

/* ============================ 2. Stamps and score ============================ */
section("New rounds are swingRev 8 on rev 7's curve");
{
  // Taller worlds batch 3 (16 Oct 2026) moved rooms on to swingRev 9 (rev 8 in a taller cavern); arcade-tuning-g3-check covers it.
  // Grappler's 200 expansion (26 Oct 2026) moved rooms on to swingRev 13 (swing-x200-check).
  ok(playRevOf("swing", generateSwing().swingRev) === SWING_REV_SPREAD + 5 && SWING_REV_SPREAD === 8, "new Grappler rounds are stamped swingRev 13 (the 200 expansion, after rev 8 in the taller cavern)");
  ok(puzzleUsesBands({ type: "swing", swingRev: SWING_REV_SPREAD }), "swingRev 8 scores on the bands");
  ok(v8 === swingSpreadGame && swingGameFor(SWING_REV_TUNEC) !== v8, "swingGameFor(8) is the spread game; rev 7 keeps its own");
  const seed = SWING_V4_BANK[0]!.seed;
  const a = v7.init(seed);
  const b = v8.init(seed);
  ok(b.spread === 1 && b.tunec === 1 && b.tuned === 1 && a.spread === undefined, "rev-8 states carry spread: 1 (and rev 7's tunec/tuned); rev 7 has no spread");
  for (const [metres, stars] of [[0, 0], [120, 3], [260, 6], [499, 10], [500, 10], [500, 4]] as const) {
    const at = (s: SwingState) => ({ ...s, maxX: 3000 * FP + metres * 40 * FP, stars, acted: 1 }) as SwingState;
    ok(v7.score(at(a)) === v8.score(at(b)), `${metres} m and ${stars} stars score the same on rev 7 and 8 (${v8.score(at(b))})`);
  }
  const c7 = swingCheckpoint(a);
  const c8 = swingCheckpoint(b);
  const c8bare = swingCheckpoint({ ...b, spread: undefined });
  ok(c8.checksum !== c8bare.checksum && c8bare.checksum === c7.checksum, "spread is folded into the checksum (last); rev 7's checksum is unchanged");
}

/* ============================== 3. Same course ============================== */
section("Same cavern; rev-7 logs play the same on rev 8");
const SAMPLE = SWING_V4_BANK.slice(0, FULL ? SWING_V4_BANK.length : 60).map((e) => e.seed);
{
  const same = (a: SwingState, b: SwingState) =>
    JSON.stringify([a.ceil, a.floor, a.anchors, a.spikes, a.jets, a.rocks, a.rng, a.x, a.y, a.rope, a.th, a.len, a.chaseX, a.chaseY]) ===
    JSON.stringify([b.ceil, b.floor, b.anchors, b.spikes, b.jets, b.rocks, b.rng, b.x, b.y, b.rope, b.th, b.len, b.chaseX, b.chaseY]);
  let bad = 0;
  for (const seed of SAMPLE) if (!same(v7.init(seed), v8.init(seed))) bad++;
  ok(bad === 0, `${SAMPLE.length} bank courses: the same cavern, anchors, spikes, jets, stalactites and rng on rev 7 and 8 (${bad} differ)`);
  // Every saved rev-7 log (both fixtures' logs) plays tick for tick the same body, hazards and end on rev 8.
  const physics = (s: SwingState) => JSON.stringify([s.tick, s.x, s.y, s.vx, s.vy, s.rope, s.th, s.om, s.len, s.maxX, s.camX, s.ended, s.endedTick, s.cause, s.chaseX, s.chaseY, s.rocks]);
  const fixtureRuns = (JSON.parse(readFileSync(FIXTURE, "utf8")) as { runs: TuningF2Record[] }).runs;
  let logs = 0;
  let diverged = 0;
  for (const run of [...legacy, ...fixtureRuns]) {
    const flat = replaySwingRun(run.seed, unpack(run), run.rev);
    const byTick = new Map<number, any>();
    for (const e of decodeSwingRun(unpack(run)).events) byTick.set(e.t, e);
    let s7 = v7.init(run.seed);
    let s8 = v8.init(run.seed);
    let diff = false;
    while (!v7.isOver(s7) && !v8.isOver(s8)) {
      const ev = byTick.get(s7.tick + 1) ?? null;
      s7 = v7.step(s7, ev);
      s8 = v8.step(s8, ev);
      if (physics(s7) !== physics(s8)) {
        diff = true;
        break;
      }
    }
    if (!diff && physics(s7) !== physics(s8)) diff = true;
    if (diff) diverged++;
    logs++;
    if (run.rev === SWING_REV_TUNEC) ok(s7.ended === flat.state.ended && swingMetres(s7) === swingMetres(flat.state), `rev 7 ${run.level} ${run.seed}: the stepped run matches the server replay`);
  }
  ok(logs >= 16 && diverged === 0, `${logs} saved logs play the same body, hazards and end on rev 7 and rev 8 (${diverged} diverge)`);
}

/* ============================== 4. Proved stars ============================== */
section("Every rev-8 star is on a proved line, near its aim, clear of hazards");
{
  const proveSeeds = SWING_V4_BANK.slice(0, FULL ? 60 : 8).map((e) => e.seed);
  let stars = 0;
  let nearAim = 0;
  for (const seed of proveSeeds) {
    const s = v8.init(seed);
    const spots = s.starSpots ?? [];
    ok(spots.length === SWING_STARS && swingStarTotal(s) === SWING_STARS && (s.starAnchors ?? []).length === 0, `course ${seed}: ${spots.length} touch stars`);
    spots.forEach(([x, y], k) => {
      stars++;
      const aim = swingSpreadAim(k);
      if (Math.abs(x - aim) <= SWING_SPREAD_WINDOW) nearAim++;
      const ahead = s.anchors.findIndex((a) => a.x > aim);
      let proved = false;
      for (const d of [0, 1, -1, 2, -2, 3, -3]) {
        const j = ahead + d;
        if (j <= 0 || j + 1 >= s.anchors.length) continue;
        if (swingProvedPoints(s, j).some(([px, py]) => px === x && py === y)) {
          proved = true;
          break;
        }
      }
      ok(proved, `course ${seed} star ${k}: on a proved line from a standard swing`);
      ok(s.anchors.every((a) => Math.abs(a.x - x) > 30 * FP || Math.abs(a.y - y) > 30 * FP), `course ${seed} star ${k}: clear of the anchor rings`);
      ok((s.jets ?? []).every((j) => Math.abs(j.x - x) > SWING_JET_HALF_W + SWING_STAR_TOUCH), `course ${seed} star ${k}: not over a lava jet`);
      ok((s.rocks ?? []).every((r) => Math.abs(r.x - x) > SWING_ROCK_HALF_W + SWING_STAR_TOUCH), `course ${seed} star ${k}: not under a loose stalactite`);
      ok(y > 0 && y < 620 * FP, `course ${seed} star ${k}: inside the cave`);
    });
    const ys = spots.map(([, y]) => y);
    // Rev 7 itself goes down to 39 px on one bank course (57 of 300 under 80 px); section 5 compares the spread overall.
    ok(Math.max(...ys) - Math.min(...ys) >= 40 * FP, `course ${seed}: stars at varied heights (${Math.round((Math.max(...ys) - Math.min(...ys)) / FP)} px apart)`);
  }
  console.log(`  ${stars} stars on ${proveSeeds.length} courses proved; ${nearAim} within ${SWING_SPREAD_WINDOW / FP} px of their aim`);
  ok(nearAim >= stars * 0.9, `at least 90 % of stars within ${SWING_SPREAD_WINDOW / FP} px of their aim (${nearAim}/${stars})`);
}

/* ================================ 5. Spacing ================================ */
section("Spacing between consecutive stars: rev 7 against rev 8");
{
  const metric = (game: typeof v7) => {
    const ratios: number[] = [];
    const gaps: number[] = [];
    const heightSd: number[] = [];
    let maxGap = 0;
    let minGap = Infinity;
    for (const seed of SAMPLE) {
      const xs = (game.init(seed).starSpots ?? []).map(([x]) => x / (40 * FP)).sort((p, q) => p - q);
      const ys = (game.init(seed).starSpots ?? []).map(([, y]) => y / FP);
      const my = ys.reduce((p, q) => p + q, 0) / ys.length;
      heightSd.push(Math.sqrt(ys.reduce((p, q) => p + (q - my) ** 2, 0) / ys.length));
      const g = xs.slice(1).map((x, i) => x - xs[i]!);
      const mean = g.reduce((p, q) => p + q, 0) / g.length;
      ratios.push(Math.max(...g) / mean);
      gaps.push(...g);
      maxGap = Math.max(maxGap, ...g);
      minGap = Math.min(minGap, ...g);
    }
    const mean = gaps.reduce((p, q) => p + q, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((p, q) => p + (q - mean) ** 2, 0) / gaps.length);
    return { ratio: ratios.reduce((p, q) => p + q, 0) / ratios.length, worst: Math.max(...ratios), mean, sd, maxGap, minGap, heights: heightSd.reduce((p, q) => p + q, 0) / heightSd.length };
  };
  const a = metric(v7);
  const b = metric(v8);
  const line = (n: string, m: ReturnType<typeof metric>) =>
    `  ${n}: max gap ÷ mean gap ${m.ratio.toFixed(2)} (worst ${m.worst.toFixed(2)}), gaps ${m.mean.toFixed(1)} ± ${m.sd.toFixed(1)} m (sd), ${m.minGap.toFixed(1)}–${m.maxGap.toFixed(1)} m; star heights sd ${m.heights.toFixed(1)} px a course`;
  console.log(`  ${SAMPLE.length} bank courses`);
  console.log(line("rev 7", a));
  console.log(line("rev 8", b));
  ok(b.worst <= 1.25, `rev 8: no course's largest gap is over 1.25× its mean gap (worst ${b.worst.toFixed(2)})`);
  ok(b.sd < a.sd / 4 && b.ratio < a.ratio, `rev 8's gaps are far more even than rev 7's (sd ${b.sd.toFixed(1)} against ${a.sd.toFixed(1)} m)`);
  ok(b.heights >= a.heights * 0.9, `rev 8 keeps the stars' height variety (sd ${b.heights.toFixed(1)} against ${a.heights.toFixed(1)} px)`);
  ok(b.minGap >= 30, `rev 8: stars at least 30 m apart (${b.minGap.toFixed(1)} m)`);
}

/* ============================ 6. 150 on rev 8 ============================ */
section("A scripted best run scores 150 through the server replay on rev 8");
for (const seed of SWING_V4_BANK.slice(0, FULL ? 6 : 2).map((e) => e.seed)) {
  const w = proveSwingSeedV4(seed, { rev: SWING_REV_SPREAD });
  ok(Boolean(w) && w!.stars === SWING_STARS, `course ${seed}: a run takes all ten spread stars and reaches 500 m (${w?.stars ?? 0} stars)`);
  if (!w) continue;
  let s = v8.init(seed) as SwingState;
  const events: any[] = [];
  const checkpoints: unknown[] = [];
  const byTick = new Map(w.log.map((e) => [e.t, e]));
  while (!v8.isOver(s)) {
    const ev = byTick.get(s.tick + 1) ?? null;
    if (ev) recordInput(events, ev, v8.inputRanges ?? []);
    s = v8.step(s, ev) as SwingState;
    if (s.tick % 300 === 0) checkpoints.push(swingCheckpoint(s));
  }
  const r = replaySwingRun(seed, encodeSwingRun({ seed, claimedScore: v8.score(s), events, endTick: s.tick, checkpoints: checkpoints as never }), SWING_REV_SPREAD);
  ok(!r.flagged && r.score === 150 && swingMetres(r.state) >= 500 && r.stars === SWING_STARS, `course ${seed}: 150 through the server replay (${r.score}, ${r.stars} stars)`);
  console.log(`  course ${seed}: ${r.score} (${r.stars} stars, 500 m at ${(s.tick / 60).toFixed(1)} s)`);
}

/* =============================== 7. Display =============================== */
section("Dragon label size; help text");
{
  ok(swingDragonLabelScale(51) === 0 && swingDragonLabelScale(80) === 0, "the dragon label is hidden beyond 50 m");
  ok(swingDragonLabelScale(50) === 0.55 && swingDragonLabelScale(45) === 0.55 && swingDragonLabelScale(40) === 0.55, "small (55 %) from 40 to 50 m");
  ok(swingDragonLabelScale(10) === 1 && swingDragonLabelScale(1) === 1 && swingDragonLabelScale(0) === 1, "full size at 10 m or closer");
  let mono = true;
  for (let m = 0; m < 50; m += 0.25) if (swingDragonLabelScale(m + 0.25) > swingDragonLabelScale(m)) mono = false;
  ok(mono, "the label never grows as the dragon falls back");
  ok(SWING_DRAGON_LABEL_PX * 0.55 >= 8, `its smallest size stays legible (${(SWING_DRAGON_LABEL_PX * 0.55).toFixed(1)} px)`);
  const art = readFileSync("src/lib/arcade/swing.renderer.ts", "utf8");
  ok(/swingDragonLabelScale\(behind\)[\s\S]{0,700}strokeText\(`DRAGON \$\{behind\} m`/.test(art), "the label is sized by distance and outlined for contrast");
  const help = PUZZLE_INSTRUCTIONS.swing!;
  ok(help.how.some((h) => /spread evenly/.test(`${h.action} ${h.detail}`)), "the help says the stars are spread evenly");
}

if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${checks} checks failed:`);
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`\nPASS: ${checks} swingRev 8 checks`);
