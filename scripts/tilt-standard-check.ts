/**
 * tilt-standard-check (29 Oct 2026): Tilt tiltRev 10 on the arcade scoring standard
 * (docs/arcade-standard/tilt.md).
 *
 *  1. Older stamps are unchanged: 48 runs recorded on main before the change (unstamped, tiltRev 2–6, 8 and 9;
 *     random drags and weak and elite bots; scripts/fixtures/tilt-standard-legacy.json.gz) replay unflagged to their
 *     stored score and final state, with no tiltRev 10 field.
 *  2. The new stamp's stored runs (scripts/fixtures/tilt-standard-runs.json.gz: oracle, bots, random) replay to their
 *     score and state; every oracle run is a perfect 200 (core 140, finish 10, speed 20, stars 30).
 *  3. The game: four mazes; mazes 1–3 are tiltRev 9's exactly but for the quick stars; the fourth is a smaller disc
 *     with smaller cells, the blue marble only, no holes, stars, keys or ice, its cup reachable on every bank seed,
 *     drawn whole by the fixed camera and smaller on screen than maze 3; the ball's art is its collision radius.
 *  4. The parts, each a straight line: 35 a finished maze, up to 5 for progress toward the exit in the maze being
 *     played; 10 for all four; speed 20 by 75 s falling evenly to 0 at the buzzer, only when all four are done;
 *     gold stars 30 split evenly over mazes 1–3's stars; holes cost no points; any input scores at least 1, none 0;
 *     the total is the parts' sum, never above 200; stars never cost core.
 *  5. Rooms identical: the same seed deals the same four mazes whatever is played (idle, random, bots), and rooms deal
 *     from the bank (tiltRev 11 since 3 Nov 2026: tilt-rev11-check).
 *  6. The words: tiltRev 10's reveal names its parts. Since 3 Nov 2026 LIVE_BANDS, the help, the intro and the intro
 *     demo name the dealt tiltRev 11 (tilt-rev11-check proves their words); here only that they moved on.
 *
 *   bun scripts/tilt-standard-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  tiltGameFor,
  tiltMazesS,
  tiltMazesX,
  tiltSeedReachableS,
  tiltStdParts,
  tiltWorldHFor,
  TILT_REV_LIFT,
  TILT_REV_PAR,
  TILT_REV_BIG,
  TILT_REV_STD,
  TILT_RUN_TICKS,
  TILT_S4_CELL,
  TILT_S4_SIZE,
  TILT_S_CORE_MAX,
  TILT_S_FINISH_POINTS,
  TILT_S_MAZES,
  TILT_S_SPEED_FULL,
  TILT_S_SPEED_POINTS,
  TILT_S_STAR_POINTS,
  TILT_V10_BAND_CURVE,
  TILT_V11_BAND_CURVE,
  TILT_X_CELL,
  TILT_X_H,
  TILT_X_W,
  type TiltState,
} from "../src/lib/arcade/tilt";
import { replayTiltRun } from "../src/lib/duel/tilt";
import { TILT_BANK } from "../src/lib/duel/tiltBank.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { tiltStateDigest } from "./tilt-expand-record";
import { botLog, randomLog, scheduleOf } from "./room-identity/tilt";
import { entry } from "./arcade-standard/tilt";

/**
 * tiltRev 10's arcade-standard entry, as scripts/arcade-standard/tilt.ts held it until 3 Nov 2026 (it names the dealt
 * tiltRev 11 since): its parts, and its perfect run (the stored oracle run on the first bank seed, server replay).
 */
const STANDARD = {
  id: "tilt",
  stampKey: "tiltRev",
  stamp: TILT_REV_STD,
  parts: [
    { key: "core", max: TILT_S_CORE_MAX },
    { key: "finish", max: TILT_S_FINISH_POINTS },
    { key: "speed", max: TILT_S_SPEED_POINTS },
    { key: "stars", max: TILT_S_STAR_POINTS },
  ],
  perfect: () => {
    const run = load("scripts/fixtures/tilt-standard-runs.json.gz").find((r) => r.kind === "oracle")!;
    const r = replayTiltRun(run.seed, run.raw, TILT_REV_STD);
    const p = tiltStdParts(r.state);
    return { score: r.flagged ? -1 : r.score, parts: { core: p.core, finish: p.finish, speed: p.speed, stars: p.stars } as Record<string, number> };
  },
};

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 60) failures.push(label);
};
const section = (name: string) => console.log(`— ${name}`);
type Run = { rev: number | null; seed: number; kind: string; raw: string; score: number; digest: string };
const load = (path: string) => (JSON.parse(gunzipSync(readFileSync(path)).toString()) as { runs: Run[] }).runs;

/* 1. Older stamps. */
section("older stamps replay exactly as on main");
{
  const legacy = load("scripts/fixtures/tilt-standard-legacy.json.gz");
  const revs = new Set(legacy.map((r) => r.rev));
  ok(legacy.length === 48 && [null, 2, 3, 4, 5, 6, 8, 9].every((r) => revs.has(r)), `48 legacy runs over every older stamp (got ${legacy.length})`);
  for (const run of legacy) {
    const tag = `tiltRev ${run.rev ?? "(none)"} seed ${run.seed} ${run.kind}`;
    const r = replayTiltRun(run.seed, run.raw, run.rev);
    ok(!r.flagged && r.desyncTick === null, `${tag}: replays unflagged (${r.reason ?? ""})`);
    ok(r.score === run.score, `${tag}: stored ${run.score}, replays ${r.score}`);
    ok(tiltStateDigest(r.state) === run.digest, `${tag}: final state changed`);
    ok(r.state.std === undefined && r.state.list.length === (run.rev === 8 || run.rev === 9 ? 3 : 4), `${tag}: no tiltRev 10 field, its own maze count`);
  }
  console.log(`  ${legacy.length} runs`);
}

/* 2. New-stamp runs and the perfect run. */
section("tiltRev 10 runs; the oracle's are 200");
{
  const runs = load("scripts/fixtures/tilt-standard-runs.json.gz");
  const oracle = runs.filter((r) => r.kind === "oracle");
  ok(oracle.length >= 4 && runs.length >= 16, `4 oracle runs and 12 more (got ${oracle.length}, ${runs.length})`);
  for (const run of runs) {
    const tag = `tiltRev 10 seed ${run.seed} ${run.kind}`;
    const r = replayTiltRun(run.seed, run.raw, TILT_REV_STD);
    ok(run.rev === TILT_REV_STD && !r.flagged && r.desyncTick === null, `${tag}: replays unflagged (${r.reason ?? ""})`);
    ok(r.score === run.score && tiltStateDigest(r.state) === run.digest, `${tag}: stored ${run.score}, replays ${r.score}`);
    const p = tiltStdParts(r.state);
    ok(r.score === Math.min(200, Math.max(1, p.core + p.finish + p.speed + p.stars)), `${tag}: the score is the parts' sum (${r.score})`);
    if (run.kind === "oracle") {
      ok(r.score === 200 && p.core === TILT_S_CORE_MAX && p.finish === TILT_S_FINISH_POINTS && p.speed === TILT_S_SPEED_POINTS && p.stars === TILT_S_STAR_POINTS, `${tag}: a perfect 200 (${JSON.stringify(p)})`);
      ok(r.state.mazes === TILT_S_MAZES && r.state.endedTick <= TILT_S_SPEED_FULL, `${tag}: all four mazes by 75 s (${(r.state.endedTick / 60).toFixed(1)} s)`);
    }
  }
  const byLevel = (k: string) => runs.filter((r) => r.kind === k).map((r) => r.score);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  // Three seeds a level only (the skill-band tool measures the order on 30): elite above both weaker levels.
  ok(mean(byLevel("elite")) > Math.max(mean(byLevel("weak")), mean(byLevel("average"))) && mean(byLevel("elite")) <= 200, "stored bots: elite above weak and average");
  ok(byLevel("random 0").concat(byLevel("random 1"), byLevel("random 2")).every((s) => s >= 1), "random drags score at least 1");
  const t0 = Date.now();
  const perfect = STANDARD.perfect();
  ok(perfect.score === 200 && STANDARD.parts.every((p) => perfect.parts[p.key] === p.max), `STANDARD.perfect(): 200 with every part at its maximum (${JSON.stringify(perfect)})`);
  ok(STANDARD.parts.reduce((t, p) => t + p.max, 0) === 200 && STANDARD.stamp === TILT_REV_STD && STANDARD.stampKey === "tiltRev", "STANDARD: parts sum to 200 on tiltRev 10");
  ok(entry.rev === TILT_REV_BIG && entry.field === "tiltRev", "the arcade-standard entry names the dealt tiltRev 12 since 3 Nov 2026 (tilt-rev12-check; tiltRev 11 before it)");
  console.log(`  ${runs.length} runs; perfect() in ${Date.now() - t0} ms`);
}

/* 3. The game. */
section("four mazes: tiltRev 9's three without quick stars, then a smaller, tighter one");
{
  const strip = (m: object) => {
    const { quick: _q, quickAt: _a, ...rest } = m as Record<string, unknown>;
    return JSON.stringify(rest);
  };
  const R = (m: { n: number; cs: number }) => (m.n * (m.cs / 256)) / 2 + 16;
  const zoom = (r: number) => Math.min(1, (TILT_X_W / 2 - 4) / (r + 10));
  let unreachable = 0;
  for (const seed of TILT_BANK) {
    const s = tiltMazesS(seed);
    const x = tiltMazesX(seed);
    if (!tiltSeedReachableS(seed)) unreachable++;
    if (seed !== TILT_BANK[0] && seed !== TILT_BANK[100] && seed !== TILT_BANK[300]) continue;
    ok(s.length === TILT_S_MAZES && x.length === 3, `seed ${seed}: four mazes`);
    for (let k = 0; k < 3; k++) {
      ok(strip(s[k]!) === strip(x[k]!), `seed ${seed} maze ${k + 1}: tiltRev 9's maze less its quick stars`);
      ok(s[k]!.quick!.length === 0 && (x[k]!.quick?.length ?? 0) > 0, `seed ${seed} maze ${k + 1}: no quick stars (tiltRev 9 had them)`);
    }
    const m4 = s[3]!;
    const m3 = s[2]!;
    ok(m4.n === TILT_S4_SIZE && m4.cs === TILT_S4_CELL * 256 && TILT_S4_CELL < TILT_X_CELL, `seed ${seed} maze 4: ${TILT_S4_SIZE} cells of ${TILT_S4_CELL} px (smaller than ${TILT_X_CELL})`);
    ok(m4.pits.length === 0 && m4.stars!.length === 0 && m4.keys!.length === 0 && m4.ice!.every((v) => v === 0) && m4.start2 === -1, `seed ${seed} maze 4: the blue marble only, no holes, stars, keys or ice`);
    ok(zoom(R(m4)) === 1 && R(m4) * zoom(R(m4)) < R(m3) * zoom(R(m3)) && R(m4) * 2 < TILT_X_W, `seed ${seed} maze 4: drawn whole at full size, a smaller disc on screen (${(2 * R(m4)).toFixed(0)} px vs ${(2 * R(m3) * zoom(R(m3))).toFixed(0)} px)`);
    ok(m4.br * 2 < m4.cs && m4.br > (m4.cs * 30) / 100, `seed ${seed} maze 4: the ball fits a passage, tight (radius ${(m4.br / 256).toFixed(2)} px in ${TILT_S4_CELL} px)`);
  }
  ok(unreachable === 0, `every bank seed's fourth maze has its cup reachable from its start (${TILT_BANK.length} seeds, ${unreachable} not)`);
  // The arcade bounds rule: the marble is drawn at its collision radius; the strips straddle the cell edge it stops at.
  const art = readFileSync("src/lib/arcade/tiltArt.renderer.ts", "utf8");
  ok(/const mr = m\.br \/ FP;/.test(art) && /ctx\.lineWidth = 3;\n\s*walls\(ctx, m, o, 0, 0\);/.test(art), "art: the marble at its collision radius, wall strips 3 px over the cell edge (1.5 px either side)");
  ok(/function tiltFixedZoom\(R: number\): number \{\n\s*return Math\.min\(1, \(TILT_X_W \/ 2 - 4\) \/ \(R \+ 10\)\);/.test(art) && /return \(m\.n \* \(m\.cs \/ FP\)\) \/ 2 \+ 16;/.test(art), "art: the fixed camera's zoom and disc radius as measured here");
  ok(/const all = state\.list\.length;/.test(art) && /`Maze \$\{Math\.min\(all, state\.mazes \+ 1\)\} \/ \$\{all\}`/.test(art), "art: the HUD counts the state's own mazes (4 on tiltRev 10)");
  ok(tiltWorldHFor(TILT_REV_STD) === TILT_X_H, "tiltRev 10 plays in the expansion's world");
}

/* 4. The parts. */
section("the parts: straight lines, 200 in all");
{
  const game = tiltGameFor(TILT_REV_STD);
  const s0 = { ...game.init(TILT_BANK[0]!), acted: 1 } as TiltState;
  const parts = (o: Partial<TiltState>) => tiltStdParts({ ...s0, ...o } as TiltState);
  const score = (o: Partial<TiltState>) => game.score({ ...s0, ...o } as TiltState);
  for (let mazes = 0; mazes < TILT_S_MAZES; mazes++)
    for (const prog of [0, 199, 200, 500, 999, 1000]) {
      const p = parts({ mazes, prog, progMaze: mazes });
      ok(p.core === 35 * mazes + Math.trunc(prog / 200) && p.finish === 0 && p.speed === 0, `${mazes} mazes, ${prog}‰ of the next: core ${35 * mazes + Math.trunc(prog / 200)} (got ${p.core}), no finish or speed`);
    }
  ok(parts({ mazes: 2, prog: 900, progMaze: 1 }).core === 70, "progress from an earlier maze never counts");
  const done = (end: number) => parts({ mazes: 4, prog: 0, progMaze: 4, ended: 1, endedTick: end });
  ok(done(5000).core === TILT_S_CORE_MAX && done(5000).finish === TILT_S_FINISH_POINTS, "all four: core 140 and the finish 10");
  for (const [end, speed] of [[2400, 20], [TILT_S_SPEED_FULL, 20], [TILT_S_SPEED_FULL + 45, 19], [4950, 10], [5355, 1], [TILT_RUN_TICKS - 1, 0], [TILT_RUN_TICKS, 0]] as const)
    ok(done(end).speed === speed, `all four at ${(end / 60).toFixed(2)} s: speed ${speed} (got ${done(end).speed})`);
  for (let k = 1; k + TILT_S_SPEED_FULL < TILT_RUN_TICKS; k += 37) ok(done(TILT_S_SPEED_FULL + k).speed >= done(TILT_S_SPEED_FULL + k + 37).speed, "speed falls evenly");
  for (const [stars, pts] of [[0, 0], [1, 10], [2, 20], [3, 30], [9, 30]] as const) ok(parts({ stars }).stars === pts, `${stars} gold stars: ${pts}`);
  ok(game.init(TILT_BANK[0]!).list.slice(0, 3).every((m) => m.stars!.length === 1), "one gold star in each of mazes 1–3 (10 each)");
  ok(score({}) === 1 && score({ acted: 0 }) === 0, "any input scores at least 1; none scores 0");
  ok(score({ mazes: 4, progMaze: 4, stars: 3, ended: 1, endedTick: 3000 }) === 200, "everything: 200");
  ok(score({ mazes: 2, prog: 600, progMaze: 2, stars: 2 }) === 70 + 3 + 20, "a sum of its parts (2 mazes, 60 % of the third, 2 stars → 93)");
  ok(score({ mazes: 2, prog: 600, progMaze: 2, falls: 7 }) === score({ mazes: 2, prog: 600, progMaze: 2 }), "a black hole costs no points (only time)");
  ok(parts({ mazes: 1, stars: 3 }).core === parts({ mazes: 1, stars: 0 }).core, "stars never change the core");
  ok(TILT_V10_BAND_CURVE.units.join() === "0,140" && TILT_V10_BAND_CURVE.points.join() === "0,140", "the core's line: points = core points, 0 to 140");
  // Idle runs score 0; a run with a single drag at least 1.
  let idle = game.init(TILT_BANK[3]!);
  while (!game.isOver(idle)) idle = game.step(idle, null);
  ok(game.score(idle) === 0, "no input scores 0");
  let one = game.init(TILT_BANK[3]!);
  one = game.step(one, { t: 1, k: 7, a: 200, b: 0, c: 1, d: 0 });
  while (!game.isOver(one)) one = game.step(one, null);
  ok(game.score(one) >= 1, `one drag scores at least 1 (${game.score(one)})`);
}

/* 5. Rooms identical. */
section("rooms identical: the same mazes whatever is played; rooms deal tiltRev 11 (since 3 Nov 2026) from the bank");
{
  for (const seed of [TILT_BANK[5]!, TILT_BANK[50]!, TILT_BANK[200]!]) {
    const logs = [[], randomLog(seed, TILT_REV_STD), botLog(seed, "weak", TILT_REV_STD), botLog(seed, "elite", TILT_REV_STD)];
    const schedules = logs.map((l) => scheduleOf(seed, TILT_REV_STD, l));
    const reached = schedules.map((s) => new Set(s.map((e) => Math.floor(e.t / 100_000))));
    for (let i = 1; i < schedules.length; i++) {
      const common = (e: { t: number }) => reached[0]!.has(Math.floor(e.t / 100_000)) && reached[i]!.has(Math.floor(e.t / 100_000));
      ok(JSON.stringify(schedules[0]!.filter(common)) === JSON.stringify(schedules[i]!.filter(common)), `seed ${seed}: log ${i} meets the same mazes`);
    }
    ok(JSON.stringify(tiltGameFor(TILT_REV_STD).init(seed).list) === JSON.stringify(tiltMazesS(seed)), `seed ${seed}: init deals the seed's four mazes`);
  }
  for (let k = 0; k < 20; k++) {
    const p = generatePuzzle("tilt") as unknown as { tiltRev: number; seed: number };
    ok(p.tiltRev === TILT_REV_BIG && TILT_BANK.includes(p.seed), `rooms deal tiltRev 12 from the bank's proved subset (got ${p.tiltRev}, ${p.seed})`);
  }
}

/* 6. The words. */
section("the help, intro, reveal and demo");
{
  // Since 3 Nov 2026 the help, intro, LIVE_BANDS and demo name the dealt tiltRev 11 (tilt-rev11-check proves their words).
  const live = LIVE_BANDS.tilt as { field: string; rev: number; curve: unknown };
  ok(live.field === "tiltRev" && live.rev === TILT_REV_BIG && live.curve === TILT_V11_BAND_CURVE, "LIVE_BANDS: the dealt tiltRev 12 on tiltRev 11's core line (tiltRev 10, then 11, before)");
  ok(roundMaxFor("tilt") === 200, "Tilt's round maximum stays 200");
  const help = PUZZLE_INSTRUCTIONS.tilt.score;
  ok(!/quick star|skill/i.test(help) && !/gold star/i.test(help), "the help names no quick stars, skill pay or (tiltRev 11) gold stars");
  ok(PUZZLE_INSTRUCTIONS.tilt.how.some((h) => /maze 4/.test(`${h.action} ${h.detail}`)) && PUZZLE_INSTRUCTIONS.tilt.how.every((h) => !/quick star/i.test(h.detail)), "the HOW lines name maze 4 and no quick stars");
  ok(INTRO_SCORE.tilt.includes("Finish the mazes") && INTRO_SCORE.tilt.endsWith("Up to 200."), `the intro: ${INTRO_SCORE.tilt}`);
  const runs = load("scripts/fixtures/tilt-standard-runs.json.gz");
  const weak = runs.find((r) => r.kind === "weak")!;
  const r = replayTiltRun(weak.seed, weak.raw, TILT_REV_STD);
  const reveal = buildArcadeReveal("tilt", { ...r, tiltRev: TILT_REV_STD }, r.score)!;
  ok(reveal.axis.max === 4 && reveal.lines[0]!.includes("/ 4 mazes × 35") && (tiltStdParts(r.state).stars === 0 || reveal.lines.some((l) => l.includes("Gold stars"))), `the reveal: four mazes and the parts (${reveal.lines.join(" | ")})`);
  const o = runs.find((x) => x.kind === "oracle")!;
  const ro = replayTiltRun(o.seed, o.raw, TILT_REV_STD);
  const rv = buildArcadeReveal("tilt", { ...ro, tiltRev: TILT_REV_STD }, ro.score)!;
  ok(rv.outcome === "finish" && rv.lines.join(" ").includes("all 4 mazes +10 · speed +20") && rv.lines.join(" ").includes("Gold stars 3 / 3 +30"), `the perfect reveal: ${rv.lines.join(" | ")}`);
  const demos = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/tiltRev !== TILT_REV_BIG\) return null/.test(demos), "the intro demo stays stopped until one is recorded on the dealt stamp (tiltRev 12 since 3 Nov 2026)");
  ok(TILT_REV_STD === TILT_REV_LIFT + 1, "tiltRev 10 is one above the live stamp it replaces");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL tilt-standard-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS tilt-standard-check: ${checks} checks — older stamps replay as on main, tiltRev 10's four mazes and straight-line parts, a perfect 200, rooms identical, the words`);
