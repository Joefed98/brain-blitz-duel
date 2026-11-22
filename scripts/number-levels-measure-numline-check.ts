/**
 * number-levels-measure-numline-check (15 Nov 2026, the Number overhaul's stage 3 for Brimful and Ballpark; ~1 min,
 * no browser).
 *
 *   1. The registry: Brimful and Ballpark offer Easy, Normal, Hard and Expert; every non-Normal level names its open
 *      answer; every level's clock is at most 120 s.
 *   2. Brimful, Joe's decision of 15 Nov 2026: Hard is today's game byte for byte (the deal before levels, pinned, plus
 *      the level field) on 60 seeds; Normal, Easy and Expert deal measureRev 5 boards matching their settings (count,
 *      jugs, tap, goal); every board's stored minimum is the BFS minimum and inside its band; every limit is the
 *      level's; the stored solution solves it within the limit; and the person-like solver (measureLevels.ts
 *      `personSolve`, no search) finishes every board within its limit on 100 seeds a level, Expert's included.
 *   3. Brimful's eras: the preMeasureLevels pin (and any older pin) deals today's game at Normal; rated play and the
 *      Daily (always Normal) deal the new Normal; Hard and the pinned deal grade the same answers identically; a
 *      level deal's full solve finishes and an empty one doesn't, Easy's three boards included.
 *   4. Ballpark: Normal is untouched (no level field, no hidden end, today's three lines); each level deals its three
 *      lines of five, every number strictly inside its line, one per fifth, clear of the labelled ticks; Easy's numbers
 *      are whole numbers, halves or simple fractions; Expert ends on 0 to 10,000 and hides every line's top label until
 *      three of its numbers are placed (numlineHiddenEnd); a perfect answer finishes at every level.
 *   5. The stage and help: Brimful's stage counts the dealt boards; Ballpark passes the hidden end to the ruler; both
 *      helps say what changes by level.
 *   6. The near-perfect kit finishes at least 80 % of Expert Brimful runs (Joe's rule), on 40 seeds.
 *
 *   bun scripts/number-levels-measure-numline-check.ts
 */
import { readFileSync } from "node:fs";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { measureShortest, decodeMeasureActions, replayMeasure } from "../src/lib/duel/measure";
import { measureMoveLimits } from "../src/lib/duel/moveLimits";
import { MEASURE_NORMAL, MEASURE_REV_LEVELS, measureLevelLimit, personSolve, type MeasureLevelSettings } from "../src/lib/duel/measureLevels";
import { NUMLINE_HIDE_UNTIL, NUMLINE_ITEMS, NUMLINE_TICK_GAP, numlineHiddenEnd, numlineShare, numlineTicks, numlineValue, encodeNumline, NUMLINE_SCALE } from "../src/lib/duel/numline";
import { gameLevelSettings, levelProof, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, type Level } from "../src/lib/levels/levels";
import { modeLevel } from "../src/lib/levels/modes";
import type { MeasurePuzzleData, NumlinePuzzleData, PuzzleData } from "../src/lib/duel/types";
import { tune } from "./level-tune";

const failures: string[] = [];
let passes = 0;
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};
const json = (v: unknown) => JSON.stringify(v);
const LEVELS: Level[] = ["easy", "normal", "hard", "expert"];
const deal = <T extends PuzzleData>(type: "measure" | "numline", seed: number, level: Level, options?: Parameters<typeof generatePuzzle>[2]) =>
  withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: (seed * 7919 + 13) >>> 0, ...(level !== "normal" ? { level } : {}) }, options)) as T;
const strip = (p: object) => {
  const { level: _level, ...rest } = p as Record<string, unknown>;
  return rest;
};

/* ------------------------------------------------------------------ 1. The registry */
for (const type of ["measure", "numline"] as const) {
  ok(json(levelsOf(type)) === json(LEVELS), `${type}: offers Easy, Normal, Hard and Expert (${levelsOf(type).join(", ")})`);
  for (const level of ["easy", "hard", "expert"] as const) {
    const proof = levelProof(type, level);
    ok(proof && "open" in proof && proof.open.length > 10, `${type} ${level}: names its open answer`);
  }
  for (const level of LEVELS) {
    const clock = puzzleTimeLimitMs(deal(type, 3, level));
    ok(clock > 0 && clock <= MAX_ROUND_CLOCK_MS, `${type} ${level}: clock ${clock} ms within 120 s`);
  }
}
ok(levelProof("measure", "easy") && json(levelProof("measure", "easy")) === json({ open: "any sequence reaching the target counts; the minimum is proven by BFS" }), "Brimful: the open answer is the brief's");
ok(json(levelProof("numline", "hard")) === json({ open: "estimation: every placement scores by distance" }), "Ballpark: the open answer is the brief's");

/* ------------------------------------------------------------------ 2. Brimful's levels */
{
  let sameHard = 0;
  for (let seed = 0; seed < 60; seed++) {
    const hard = deal<MeasurePuzzleData>("measure", seed, "hard");
    const today = deal<MeasurePuzzleData>("measure", seed, "normal", { pins: ["preMeasureLevels"] });
    // D2 (Joe's decision 10, a Hard you can see): Hard deals its own measureRev 5 boards; today's game is its pin's. // Changed with Joe's approval, 22 Nov 2026
    if ((hard as { level?: string }).level === "hard" && hard.measureRev === MEASURE_REV_LEVELS && today.measureRev === 4 && !("level" in today)) sameHard++; // Changed with Joe's approval, 22 Nov 2026
  }
  ok(sameHard === 60, `Brimful Hard deals its own measureRev 5 boards, and today's game (measureRev 4) is still its pin's at Normal (${sameHard} of 60)`); // Changed with Joe's approval, 22 Nov 2026

  const settingsOf = (level: Level): MeasureLevelSettings =>
    level === "normal" ? MEASURE_NORMAL : (gameLevelSettings<MeasureLevelSettings>("measure", level) as MeasureLevelSettings);
  ok(!("today" in settingsOf("hard")), "Brimful Hard has its own boards, not today's game"); // Changed with Joe's approval, 22 Nov 2026
  for (const level of ["easy", "normal", "hard", "expert"] as const) { // Changed with Joe's approval, 22 Nov 2026
    const settings = settingsOf(level);
    if ("today" in settings) {
      ok(false, `Brimful ${level}: has board settings`);
      continue;
    }
    let shape = 0, minima = 0, limits = 0, solutions = 0, person = 0, boardsSeen = 0, personBoards = 0;
    const ratios: number[] = [];
    for (let seed = 0; seed < 100; seed++) {
      const p = deal<MeasurePuzzleData>("measure", seed, level);
      const lim = measureMoveLimits(p) ?? [];
      const specOk =
        p.measureRev === MEASURE_REV_LEVELS &&
        p.boards.length === settings.boards.length &&
        p.boards.every((b, i) => {
          const spec = settings.boards[i]!;
          return b.caps.length === spec.jugs && b.tap === spec.tap && b.goal === spec.goal;
        });
      if (specOk) shape++;
      let allMin = true, allLim = true, allSol = true, allPerson = true;
      p.boards.forEach((b, i) => {
        boardsSeen++;
        const bfs = measureShortest(b)?.minMoves ?? -1;
        const band = settings.boards[i]!.band;
        if (!(bfs === p.minMoves?.[i] && bfs >= band[0] && bfs <= band[1])) allMin = false;
        if (lim[i] !== measureLevelLimit(bfs, settings.limitFactor)) allLim = false;
        const r = replayMeasure(b, decodeMeasureActions(p.solutions?.[i] ?? "", b.caps.length), lim[i] ?? null);
        if (!r.solved || r.moves !== bfs) allSol = false;
        const run = personSolve(b, lim[i] ?? 0);
        if (run && replayMeasure(b, run, lim[i] ?? null).solved) {
          personBoards++;
          ratios.push(run.length / bfs);
        } else allPerson = false;
      });
      if (allMin) minima++;
      if (allLim) limits++;
      if (allSol) solutions++;
      if (allPerson) person++;
    }
    ok(shape === 100, `Brimful ${level}: measureRev 5 boards as its settings (${shape} of 100)`);
    ok(minima === 100, `Brimful ${level}: every stored minimum is the BFS minimum, in its band (${minima} of 100)`);
    ok(limits === 100, `Brimful ${level}: every move limit is the level's (${limits} of 100)`);
    ok(solutions === 100, `Brimful ${level}: every stored solution solves its board in the minimum (${solutions} of 100)`);
    ok(person === 100, `Brimful ${level}: the person-like solver finishes every board within its limit (${personBoards} of ${boardsSeen} boards)`);
    const avg = ratios.reduce((a, b) => a + b, 0) / Math.max(1, ratios.length);
    console.log(`  Brimful ${level}: person-like solver ${personBoards}/${boardsSeen} boards, on average ${avg.toFixed(2)}× the minimum`);
  }
}

/* ------------------------------------------------------------------ 3. Brimful's eras and grading */
{
  const anyPin = deal<MeasurePuzzleData>("measure", 7, "normal", { pins: ["preNumberOverhaul"] });
  const own = deal<MeasurePuzzleData>("measure", 7, "normal", { pins: ["preMeasureLevels"] });
  ok(own.measureRev === 4 && !("level" in own), "Brimful: the preMeasureLevels pin deals today's game at Normal (measureRev 4)");
  ok(anyPin.measureRev === 4, "Brimful: any older pinned era deals today's game at Normal");
  ok(modeLevel("rated", "hard") === "normal" && modeLevel("daily", "expert") === "normal", "rated play and the Daily deal Normal");
  ok(deal<MeasurePuzzleData>("measure", 7, modeLevel("rated", null)).measureRev === MEASURE_REV_LEVELS, "rated play and the Daily get the new Normal (measureRev 5)");

  // D2: the level never changes a grade: a Hard deal grades every answer exactly as the same puzzle with no level field. // Changed with Joe's approval, 22 Nov 2026
  let sameGrade = 0, total = 0;
  for (let seed = 20; seed < 30; seed++) {
    const hard = deal<MeasurePuzzleData>("measure", seed, "hard");
    const today = strip(hard) as unknown as MeasurePuzzleData; // Changed with Joe's approval, 22 Nov 2026
    const sol = today.solutions ?? [];
    const limit = puzzleTimeLimitMs(today);
    for (const answer of [sol.join("|"), [sol[0], sol[1], "", ""].join("|"), "", [sol[0], "P0-1,P1-0", sol[2], sol[3]].join("|")]) {
      for (const ms of [limit - 20_000, limit - 90_000]) {
        total++;
        const a = gradeAnswer(hard, answer, ms), b = gradeAnswer(today, answer, ms);
        if (a.score === b.score && a.isCorrect === b.isCorrect && json(a.extra) === json(b.extra)) sameGrade++;
      }
    }
  }
  ok(sameGrade === total, `Brimful: Hard grades every answer exactly as the same puzzle without its level (${sameGrade} of ${total})`); // Changed with Joe's approval, 22 Nov 2026

  for (const level of ["easy", "normal", "hard", "expert"] as const) { // Changed with Joe's approval, 22 Nov 2026
    let finished = 0, empty = 0;
    for (let seed = 40; seed < 50; seed++) {
      const p = deal<MeasurePuzzleData>("measure", seed, level);
      const limit = puzzleTimeLimitMs(p);
      const full = gradeAnswer(p, (p.solutions ?? []).join("|"), limit - 30_000);
      if (full.isCorrect && full.score >= 150) finished++;
      const none = gradeAnswer(p, "", limit - 30_000);
      if (!none.isCorrect && none.score < 50) empty++;
    }
    ok(finished === 10, `Brimful ${level}: a full solve finishes at 150 or more (${finished} of 10)`);
    ok(empty === 10, `Brimful ${level}: an empty answer doesn't finish (${empty} of 10)`);
  }
}

/* ------------------------------------------------------------------ 4. Ballpark's levels */
{
  const normal = deal<NumlinePuzzleData>("numline", 5, "normal");
  ok(!("level" in normal) && normal.stages.every((s) => s.hideEnd === undefined), "Ballpark Normal: no level field, no hidden end");
  ok(normal.stages[0]!.lo === 0 && normal.stages[0]!.hi === 1 && normal.stages[1]!.hi === 100 && [50, 1000].includes(normal.stages[2]!.hi), "Ballpark Normal: today's three lines");
  const want: Record<"easy" | "hard" | "expert", number[][]> = {
    easy: [[0, 10], [0, 100], [0, 1]],
    hard: [[0, 1], [-100, 100], [0, 1000]],
    expert: [[0, 100], [-50, 50], [0, 10000]],
  };
  for (const level of ["easy", "hard", "expert"] as const) {
    let lines = 0, spread = 0, perfect = 0, simple = 0, hidden = 0;
    for (let seed = 0; seed < 60; seed++) {
      const p = deal<NumlinePuzzleData>("numline", seed, level);
      const ends = p.stages.map((s) => [s.lo, s.hi]);
      const expected = want[level].map((e, i) => (level === "expert" && i === 1 && ends[1]![1] === 1000 ? [0, 1000] : e));
      if (p.stages.length === 3 && json(ends) === json(expected) && p.stages.every((s) => s.items.length === NUMLINE_ITEMS)) lines++;
      const shares = p.stages.map((s, i) => (p.values?.[i] ?? []).map((v) => numlineShare(s, numlineValue(v))));
      const spreadOk = p.stages.every((s, i) => {
        const sh = shares[i]!;
        const bins = new Set(sh.map((x) => Math.min(NUMLINE_ITEMS - 1, Math.floor(x * NUMLINE_ITEMS))));
        return sh.every((x) => x > 0 && x < 1 && numlineTicks(s).every((t) => Math.abs(t - x) >= NUMLINE_TICK_GAP)) && bins.size === NUMLINE_ITEMS;
      });
      if (spreadOk) spread++;
      const answer = encodeNumline(shares.flat().map((x) => Math.round(x * NUMLINE_SCALE)));
      const g = gradeAnswer(p, answer, puzzleTimeLimitMs(p) - 30_000);
      if (g.isCorrect && g.score >= 180) perfect++;
      if (level === "easy" && (p.values ?? []).flat().every((v) => v.rootCoef === 0 && v.den <= 10)) simple++;
      if (level === "expert") {
        const st = p.stages[0]!;
        if (
          p.stages.every((s) => s.hideEnd === "hi") &&
          numlineHiddenEnd(st, 0) === 1 &&
          numlineHiddenEnd(st, NUMLINE_HIDE_UNTIL - 1) === 1 &&
          numlineHiddenEnd(st, NUMLINE_HIDE_UNTIL) === null
        )
          hidden++;
      } else if (p.stages.every((s) => s.hideEnd === undefined)) hidden++;
    }
    ok(lines === 60, `Ballpark ${level}: its three lines of five (${lines} of 60)`);
    ok(spread === 60, `Ballpark ${level}: every number inside its line, one per fifth, clear of the ticks (${spread} of 60)`);
    ok(perfect === 60, `Ballpark ${level}: a perfect answer finishes (${perfect} of 60)`);
    ok(hidden === 60, `Ballpark ${level}: ${level === "expert" ? "every line's top label hidden until three numbers are placed" : "no hidden end"} (${hidden} of 60)`);
    if (level === "easy") ok(simple === 60, `Ballpark Easy: whole numbers, halves and simple fractions only (${simple} of 60)`);
  }
  ok(numlineHiddenEnd({}, 0) === null, "Ballpark: a line without hideEnd hides nothing");
}

/* ------------------------------------------------------------------ 5. Stage and help */
{
  const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const measure = src("src/puzzles/measure.tsx");
  ok(/const MEASURE_BOARDS = data\?\.boards\.length \|\| MEASURE_BOARDS_TODAY;/.test(measure), "Brimful: the stage counts the dealt boards (Easy's three)");
  const numline = src("src/puzzles/numline.tsx");
  ok(/hidden=\{numlineHiddenEnd\(stage, placedHere\.length\)\}/.test(numline) && /share === hidden \? "\?"/.test(numline), "Ballpark: the live ruler shows the hidden end as ?");
  const help = src("src/lib/duel/instructions.ts");
  const block = (key: string) => help.slice(help.indexOf(`    ${key}: {`), help.indexOf("score:", help.indexOf(`    ${key}: {`)));
  ok(/action: "Levels:"/.test(block("measure")) && /Expert/.test(block("measure")), "Brimful's help says what changes by level");
  ok(/action: "Levels:"/.test(block("numline")) && /10,000/.test(block("numline")), "Ballpark's help says what changes by level");
}

/* ------------------------------------------------------------------ 6. The kit on Expert */
{
  const rows = await tune("measure", "expert", 40, 0);
  const near = rows.find((r) => r.bot === "near-perfect")!;
  console.log(`  Brimful Expert near-perfect: avg ${near.average}, finished ${(near.finishRate * 100).toFixed(0)} %`);
  ok(near.finishRate >= 0.8, `Brimful Expert: the near-perfect kit finishes at least 80 % (${(near.finishRate * 100).toFixed(0)} %)`);
}

console.log(failures.length ? `FAIL number-levels-measure-numline-check: ${failures.length} of ${passes + failures.length} failed` : `number-levels-measure-numline-check: all ${passes} passed`);
process.exit(failures.length ? 1 : 0);
