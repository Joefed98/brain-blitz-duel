/**
 * speed-pipes-nov7-check (7 Nov 2026, docs/speed-pipes-scoring-nov-2026.md; audit issues 9, 18 and 23h): Flash and
 * Bang On on tapRev 7 (each flash / watch scored on its own, a miss 0, the points averaged) and Pipeline on pipesRev 4
 * (unfinished credit by the tiles turned to fit).
 *
 *   1. Legacy: every case recorded on unmodified main (scripts/speed-pipes-nov7-record.ts: Flash and Bang On tapRev 4–6,
 *      Ascend tapRev 5–6, Pipeline pipesRev 1–3) grades exactly as stored: score, verdict, stored ms, average, extra.
 *   2. Deals: rooms deal tapRev 7 and pipesRev 4; Ascend's stamp is unchanged; pinPreNov7(true) deals tapRev 6 and
 *      pipesRev 3; the boards and schedules are identical (only the stamp differs).
 *   3. Flash and Bang On: k of n good items is k/n of the curve part, every extra hit scores more, a perfect run scores
 *      what it scores on tapRev 6 (200 on a flawless run), the stored breakdown adds up to the score.
 *   4. Pipeline: the fewest taps in index order score in proportion (no zero at half way), every tile turned home
 *      scores more, a flawless fast solve scores 200, random turning scores well under real play, and the band kit
 *      sends its tap log (23h: a kit solve is graded as solved).
 *   5. Texts: the help states the stamps dealt (and the older wording with the pin).
 *
 *   bun scripts/speed-pipes-nov7-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { PIPES_REV_PLACED, TAP_REV_PER_ITEM, pinPreNov7 } from "../src/lib/duel/speedPipesNov7";
import { FLASH_REV6_CURVE, scoreFlashDepth } from "../src/lib/duel/depth/flash";
import { scoreBangOnDepth } from "../src/lib/duel/depth/bangOn";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { asPhoneSends, gradeSteps, median } from "./standard-lib";
import { SPEED_PIPES_NOV7_FIXTURE, type Nov7Fixture } from "./speed-pipes-nov7-record";
import { bangOnRun, flashRun, pipesIndexOrder } from "./speed-pipes-nov7-bands";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
type Of<T extends PuzzleType> = Extract<PuzzleData, { type: T }>;
const deal = <T extends PuzzleType>(type: T, seed: number): Of<T> => withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed })) as Of<T>;
const stampOf = (p: PuzzleData, key: string) => (p as unknown as Record<string, unknown>)[key];
const depthOf = (extra: unknown) => ((extra as Record<string, unknown> | null)?.["depth"] ?? {}) as Record<string, unknown>;

/* ============================== 1. Legacy ============================== */
{
  const f = JSON.parse(gunzipSync(readFileSync(SPEED_PIPES_NOV7_FIXTURE)).toString()) as Nov7Fixture;
  ok(f.cases.length >= 3000, `the legacy fixture has its cases (${f.cases.length})`);
  const revs = new Set(f.puzzles.map((p) => `${p.type}:${String(stampOf(p, p.type === "pipes" ? "pipesRev" : "tapRev"))}`));
  for (const k of ["reaction:4", "reaction:5", "reaction:6", "stopwatch:4", "stopwatch:5", "stopwatch:6", "numhunt:5", "numhunt:6", "pipes:1", "pipes:2", "pipes:3"]) ok(revs.has(k), `the legacy fixture covers ${k}`);
  let bad = 0;
  for (const c of f.cases) {
    const g = gradeAnswer(f.puzzles[c.p]!, c.answer, c.msLeft);
    const same = g.score === c.score && g.isCorrect === c.correct && (g.storedMs ?? null) === c.storedMs && (g.reactionAvgMs ?? null) === c.avg && JSON.stringify(g.extra ?? null) === JSON.stringify(c.extra);
    if (!same && bad++ < 20) failures.push(`legacy ${f.puzzles[c.p]!.type} case: stored ${c.score}${c.correct ? "✓" : ""}, now ${g.score}${g.isCorrect ? "✓" : ""}`);
    checks++;
  }
  ok(bad === 0, `every legacy case grades exactly as stored (${bad} differ)`);
}

/* ============================== 2. Deals ============================== */
for (const seed of [11, 4242, 987_001]) {
  for (const [type, key, now, before] of [["reaction", "tapRev", TAP_REV_PER_ITEM, 6], ["stopwatch", "tapRev", TAP_REV_PER_ITEM, 6], ["pipes", "pipesRev", PIPES_REV_PLACED, 3], ["numhunt", "tapRev", 6, 6]] as const) {
    const a = deal(type, seed);
    pinPreNov7(true);
    const b = deal(type, seed);
    pinPreNov7(false);
    ok(stampOf(a, key) === now, `${type} seed ${seed}: rooms deal ${key} ${now} (${String(stampOf(a, key))})`);
    ok(stampOf(b, key) === before, `${type} seed ${seed}: pinPreNov7 deals ${key} ${before} (${String(stampOf(b, key))})`);
    ok(JSON.stringify({ ...a, [key]: 0 }) === JSON.stringify({ ...b, [key]: 0 }), `${type} seed ${seed}: the board is the one dealt before (only ${key} differs)`);
  }
}

/* ============================== 3. Flash and Bang On ============================== */
{
  const curveAt = (ms: number) => {
    for (let i = 1; i < FLASH_REV6_CURVE.length; i++) {
      const [x0, y0] = FLASH_REV6_CURVE[i - 1]!;
      const [x1, y1] = FLASH_REV6_CURVE[i]!;
      if (ms <= x1) return Math.round(y0 + ((y1 - y0) * (Math.max(ms, x0) - x0)) / (x1 - x0));
    }
    return 0;
  };
  for (const seed of [7001, 7002, 7003, 7004, 7005]) {
    const p = deal("reaction", seed);
    const old = { ...p, tapRev: 6 };
    const n = p.flashes.length;
    let prev = -1;
    for (let k = 0; k <= n; k++) {
      const hit = p.flashes.map((_, i) => i < k);
      const g = gradeAnswer(p, flashRun(p, hit, 160), 0);
      const d = depthOf(g.extra);
      ok(g.score > prev, `Flash ${seed}: ${k} of ${n} hit scores more than ${k - 1} (${prev} → ${g.score})`);
      prev = g.score;
      ok(d["curve"] === Math.round((k * curveAt(160)) / n), `Flash ${seed}: ${k} of ${n} hit at 160 ms: the curve part is k/n of ${curveAt(160)} (${String(d["curve"])})`);
      ok(g.score === Math.max(Number(d["floor"]), Number(d["curve"]) + Number(d["steady"]) - Number(d["falseStartCost"])), `Flash ${seed}: ${k} hit: the breakdown adds up (${g.score})`);
      const each = d["each"] as number[] | undefined;
      ok(Array.isArray(each) && each.length === n && Math.round(each.reduce((a, b) => a + b, 0) / n) === d["curve"], `Flash ${seed}: ${k} hit: each flash's points stored, averaging to the curve part`);
    }
    for (const ms of [110, 120, 160, 250]) {
      const all = p.flashes.map(() => true);
      ok(gradeAnswer(p, flashRun(p, all, ms), 0).score === gradeAnswer(old, flashRun(p, all, ms), 0).score, `Flash ${seed}: every flash at ${ms} ms scores as on tapRev 6`);
    }
    ok(gradeAnswer(p, flashRun(p, p.flashes.map(() => true), 115), 0).score === 200, `Flash ${seed}: a flawless run scores 200`);
    const half = gradeAnswer(p, flashRun(p, p.flashes.map((_, i) => i < Math.ceil(n / 2)), 160), 0).score;
    ok(half >= 70, `Flash ${seed}: half the flashes hit at 160 ms scores ${half} (at least 70; tapRev 6 gave ${gradeAnswer(old, flashRun(p, p.flashes.map((_, i) => i < Math.ceil(n / 2)), 160), 0).score})`);
  }
  for (const seed of [7001, 7002, 7003, 7004, 7005]) {
    const p = deal("stopwatch", seed);
    const old = { ...p, tapRev: 6 };
    const n = p.watches.length;
    const all = bangOnRun(p, p.watches.map(() => true));
    ok(gradeAnswer(p, all, 0).score === 200 && gradeAnswer(old, all, 0).score === 200, `Bang On ${seed}: every watch dead on scores 200 on tapRev 7 and 6`);
    let prev = -1;
    for (let k = 0; k <= n; k++) {
      const g = gradeAnswer(p, bangOnRun(p, p.watches.map((_, i) => i < k)), 0);
      const d = depthOf(g.extra);
      const each = d["each"] as number[] | undefined;
      ok(g.score > prev || (k === 0 && g.score === 0), `Bang On ${seed}: ${k} of ${n} stopped scores more than ${k - 1} (${prev} → ${g.score})`);
      prev = g.score;
      ok(Array.isArray(each) && Math.round(each.reduce((a, b) => a + b, 0) / n) === d["curve"] && each.filter((v) => v > 0).length === k, `Bang On ${seed}: ${k} stopped: each watch's points stored, the misses 0, averaging to the curve part`);
      ok(Math.abs(Number(d["curve"]) - Math.round((k * 150) / n)) <= 1, `Bang On ${seed}: ${k} of ${n} dead on: the curve part is about k/n of 150 (${String(d["curve"])})`);
      ok(g.score === Math.max(Number(d["floor"]), Math.min(200, Number(d["curve"]) + Math.min(50, Number(d["centre"]) + Number(d["streak"])))), `Bang On ${seed}: ${k} stopped: the breakdown adds up (${g.score})`);
    }
    const half = gradeAnswer(p, bangOnRun(p, p.watches.map((_, i) => i < 5)), 0).score;
    ok(half >= 90, `Bang On ${seed}: 5 of 10 dead on scores ${half} (at least 90; tapRev 6 gave ${gradeAnswer(old, bangOnRun(p, p.watches.map((_, i) => i < 5)), 0).score})`);
  }
  // The shared scorers: older stamps untouched by tapRev 7's branch (the phone's live score uses them).
  ok(scoreFlashDepth([160, null], 0, 2, 6).each === undefined && scoreFlashDepth([160, null], 0, 2, 7).curve === Math.round(curveAt(160) / 2), "scoreFlashDepth: tapRev 6 averages the times, tapRev 7 the points");
  const bp = deal("stopwatch", 7001);
  ok(scoreBangOnDepth(bp.watches, [], 10, 6).each === undefined && scoreBangOnDepth(bp.watches, [], 10, 7).curve === 0, "scoreBangOnDepth: tapRev 7 scores no stop at all 0");
  // Kit play: better play scores more, the near-perfect top stays where it was.
  const levels = ["average", "good", "great", "near"] as const;
  for (const type of ["reaction", "stopwatch"] as const) {
    const now: Record<string, number[]> = {};
    const was: Record<string, number[]> = {};
    for (let i = 0; i < 30; i++) {
      const p = deal(type, 6100 + i * 7);
      const old = { ...p, tapRev: 6 } as PuzzleData;
      for (const level of levels) {
        const steps = KITS[type]!.play(p, makeRng(hashText(`std:${type}:${6100 + i * 7}:${level}`)), SKILLS[level], puzzleTimeLimitMs(p)).steps;
        (now[level] ??= []).push(gradeSteps(p, steps, true).score);
        (was[level] ??= []).push(gradeSteps(old, steps, true).score);
      }
    }
    const m = (r: Record<string, number[]>, l: string) => median(r[l]!);
    ok(levels.every((l, i) => i === 0 || m(now, l) > m(now, levels[i - 1]!)), `${type}: kit medians rise with skill (${levels.map((l) => m(now, l)).join(" / ")})`);
    ok(Math.abs(m(now, "near") - m(was, "near")) <= 8, `${type}: the near-perfect median stays within 8 of tapRev 6's (${m(was, "near")} → ${m(now, "near")})`);
    ok(m(now, "average") >= m(was, "average") - 3, `${type}: the average median not below tapRev 6's (${m(was, "average")} → ${m(now, "average")})`);
  }
}

/* ============================== 4. Pipeline ============================== */
{
  for (const seed of [11, 33, 44, 6100, 6107, 6114]) {
    const p = deal("pipes", seed);
    const scores = [0, 0.25, 0.5, 0.75].map((s) => gradeAnswer(p, pipesIndexOrder(p, s), 0).score);
    ok(scores.every((s, i) => i === 0 || s > scores[i - 1]!), `Pipeline ${seed}: the fewest taps in index order score more at every quarter (${scores.join(", ")})`);
    ok(scores[2]! >= 45 && scores[2]! <= 70, `Pipeline ${seed}: half way scores ${scores[2]} (45–70: half of the 130 for an unfinished board)`);
    // Every tile turned home scores more: tile by tile along the same taps.
    const taps = pipesIndexOrder(p, 1).split("~")[1]!.split(",").map(Number);
    let prev = -1;
    let monotone = true;
    for (let k = 0; k < taps.length; k++) {
      if (k + 1 < taps.length && taps[k + 1] === taps[k]) continue;
      const g = gradeAnswer(p, pipesIndexOrder(p, (k + 1) / taps.length), 0);
      if (!g.isCorrect && g.score < prev) monotone = false;
      prev = g.score;
    }
    ok(monotone, `Pipeline ${seed}: each tile turned home never lowers the score`);
    const limit = puzzleTimeLimitMs(p);
    ok(gradeAnswer(p, pipesIndexOrder(p, 1), limit - 5_000).score === 200, `Pipeline ${seed}: a flawless solve at par with time to spare scores 200`);
    ok(gradeAnswer(p, pipesIndexOrder(p, 1), 0).score === gradeAnswer({ ...p, pipesRev: 3 }, pipesIndexOrder(p, 1), 0).score, `Pipeline ${seed}: a finish scores as on pipesRev 3`);
    ok(gradeAnswer(p, pipesIndexOrder(p, 0), 0).score === 0, `Pipeline ${seed}: the dealt board scores 0`);
  }
  // 23h: the band kit's answers carry the tap log, so its solves are graded as solved.
  const kitSpam: number[] = [];
  const kitAverage: number[] = [];
  let solved = 0;
  for (let i = 0; i < 30; i++) {
    const seed = 6100 + i * 7;
    const p = deal("pipes", seed);
    const limit = puzzleTimeLimitMs(p);
    const near = KITS.pipes!.play(p, makeRng(hashText(`std:pipes:${seed}:near`)), SKILLS.near, limit).steps;
    if (gradeSteps(p, asPhoneSends(p, near)).isCorrect) solved++;
    kitAverage.push(gradeSteps(p, asPhoneSends(p, KITS.pipes!.play(p, makeRng(hashText(`std:pipes:${seed}:average`)), SKILLS.average, limit).steps)).score);
    for (const sp of KITS.pipes!.spam(p, makeRng(hashText(`std:pipes:spam:${seed}`)), limit)) kitSpam.push(gradeAnswer(p, asPhoneSends(p, [{ answer: sp.answer, atMs: 0 }])[0]!.answer, 0).score);
  }
  ok(solved >= 27, `Pipeline: the band kit's near-perfect play is graded as solved on its tap log (${solved} of 30)`);
  ok(median(kitSpam) * 3 <= median(kitAverage), `Pipeline: random turning (median ${median(kitSpam)}) scores at most a third of average play (${median(kitAverage)})`);
}

/* ============================== 5. Texts ============================== */
{
  const help = (t: PuzzleType) => PUZZLE_INSTRUCTIONS[t].score;
  ok(/each flash scores/.test(help("reaction")) && !/counts as 1,200/.test(help("reaction")), `Flash help states tapRev 7: "${help("reaction")}"`);
  ok(/each watch scores/.test(help("stopwatch")) && !/counts as 500/.test(help("stopwatch")), `Bang On help states tapRev 7: "${help("stopwatch")}"`);
  ok(/tiles you turn to fit/.test(help("pipes")) && !/joined to the source/.test(help("pipes")), `Pipeline help states pipesRev 4: "${help("pipes")}"`);
  ok(["reaction", "stopwatch", "pipes"].every((t) => INTRO_SCORE[t as PuzzleType].length <= 90), "the intro SCORE lines stay within 90 characters");
  pinPreNov7(true);
  ok(/counts as 1,200/.test(help("reaction")) && /counts as 500/.test(help("stopwatch")) && /joined to the source/.test(help("pipes")), "with the pin, the help states tapRev 6 and pipesRev 3 as before");
  pinPreNov7(false);
}

if (failures.length) {
  console.log(failures.slice(0, 60).map((f) => `  ✗ ${f}`).join("\n"));
  console.log(`FAIL speed-pipes-nov7-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS speed-pipes-nov7-check: ${checks} checks — older stamps grade as recorded, tapRev 7 and pipesRev 4 dealt, partial runs score in proportion, 200 reachable`);
