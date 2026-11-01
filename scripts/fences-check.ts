/**
 * Fences (1 Nov 2026): the generator, the uniqueness solver and the scoring standard's grade.
 *
 *  1. 240 seeds deal deterministically (same seed → identical board), every board re-proved to have exactly one loop by
 *     the solver, its stored solution keeping the rules (one loop, every number met), its numbers and grade in band,
 *     and generation time measured (median and max).
 *  2. Room deals (generatePuzzle with a room seed) carry fencesRev 1 and the scoring standard; the same room seed deals
 *     the same board; the solution never reaches the phone (secrets.ts).
 *  3. Grading through gradeAnswer: a finish scores 150–200 in the standard's parts, nothing scores 0, every edge drawn
 *     and random edges score 0 (guessing never pays), half the loop about 60, and wrong lines cut it.
 *
 *   bun scripts/fences-check.ts
 */
import { countFencesSolutions, FENCES_GRADE_BAND, FENCES_MIN_CLUES, generateFences, solveFences } from "../src/lib/duel/fences.server";
import { FENCES_EMPTY, FENCES_LINE, encodeFences, fencesEdgeCount, fencesSolved, isSingleLoop } from "../src/lib/duel/fences";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { usesStandard } from "../src/lib/duel/standard/stamps";
import { FENCES_TIME_MS, type FencesPuzzleData } from "../src/lib/duel/types";

const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  if (!cond) {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};

/* 1. Generator and solver. */
const SEEDS = Array.from({ length: 240 }, (_, i) => 1 + i * 104729);
const times: number[] = [];
const grades: number[] = [];
const clueCounts: number[] = [];
for (const seed of SEEDS) {
  const t0 = performance.now();
  const p = generateFences(seed);
  times.push(performance.now() - t0);
  const again = generateFences(seed);
  ok(JSON.stringify(p) === JSON.stringify(again), `seed ${seed}: deals the same board twice`);
  ok(p.fencesRev === 1 && p.size === 6 && p.clues.length === 36, `seed ${seed}: a 6 × 6 board on fencesRev 1`);
  ok(countFencesSolutions(p.size, p.clues, 3) === 1, `seed ${seed}: exactly one loop`);
  const sol = p.solution ?? [];
  ok(isSingleLoop(p.size, sol), `seed ${seed}: the solution is one closed loop`);
  const st = new Array<number>(fencesEdgeCount(p.size)).fill(FENCES_EMPTY);
  for (const e of sol) st[e] = FENCES_LINE;
  ok(fencesSolved(p, encodeFences(st)), `seed ${seed}: the solution keeps every number`);
  ok(JSON.stringify(solveFences(p.size, p.clues)) === JSON.stringify(sol), `seed ${seed}: the solver finds the stored loop`);
  const clues = p.clues.filter((v) => v >= 0).length;
  clueCounts.push(clues);
  grades.push(p.grade ?? -1);
  ok(clues >= FENCES_MIN_CLUES, `seed ${seed}: ${clues} numbers, at least ${FENCES_MIN_CLUES}`);
  ok((p.grade ?? -1) >= FENCES_GRADE_BAND[0] && (p.grade ?? -1) <= FENCES_GRADE_BAND[1], `seed ${seed}: grade ${p.grade} in band ${FENCES_GRADE_BAND.join("–")}`);
}
const sorted = [...times].sort((a, b) => a - b);
const med = sorted[sorted.length >> 1]!;
const max = sorted[sorted.length - 1]!;
console.log(`generation: median ${med.toFixed(1)} ms, max ${max.toFixed(1)} ms over ${SEEDS.length} seeds`);
const hist = (xs: number[]) => Object.entries(xs.reduce<Record<number, number>>((h, x) => ((h[x] = (h[x] ?? 0) + 1), h), {})).map(([k, v]) => `${k}:${v}`).join(" ");
console.log(`grades ${hist(grades)}; numbers ${hist(clueCounts)}`);
ok(med < 150, `median generation ${med.toFixed(1)} ms under 150 ms`);
ok(max < 2000, `slowest generation ${max.toFixed(1)} ms under 2 s`);

/* 2. Room deals. */
const room = (seed: number) => generatePuzzle("fences", { bankSeed: seed }) as FencesPuzzleData;
const r1 = room(4242);
ok(JSON.stringify(r1) === JSON.stringify(room(4242)), "one room seed deals one board");
ok(JSON.stringify(r1.clues) !== JSON.stringify(room(4243).clues), "another room seed deals another board");
ok(r1.fencesRev === 1 && usesStandard(r1), "room deals carry fencesRev 1 on the scoring standard");
const { pub } = splitPuzzle(r1);
ok(!("solution" in (pub as object)), "the solution stays server-side");

/* 3. Grading. */
const encodeLines = (p: FencesPuzzleData, lines: Iterable<number>) => {
  const st = new Array<number>(fencesEdgeCount(p.size)).fill(FENCES_EMPTY);
  for (const e of lines) st[e] = FENCES_LINE;
  return encodeFences(st);
};
for (const seed of [11, 22, 33, 44, 55, 66]) {
  const p = room(seed);
  const sol = p.solution ?? [];
  const finish = gradeAnswer(p, encodeLines(p, sol), FENCES_TIME_MS - 30_000);
  const parts = finish.extra?.["parts"] as { kind?: string; base?: number } | undefined;
  ok(finish.isCorrect && finish.score >= 190 && finish.score <= 200, `seed ${seed}: a 30 s finish scores ${finish.score} (190–200, no clean bonus without a timeline)`);
  ok(parts?.kind === "finish" && parts.base === 150 && finish.extra?.["standard"] === 1, `seed ${seed}: the finish is in the standard's parts`);
  const late = gradeAnswer(p, encodeLines(p, sol), 1_000);
  ok(late.isCorrect && late.score >= 150 && late.score < 160, `seed ${seed}: a finish at the buzzer scores ${late.score} (150+)`);
  ok(gradeAnswer(p, "", 0).score === 0, `seed ${seed}: nothing scores 0`);
  const every = encodeFences(new Array<number>(fencesEdgeCount(p.size)).fill(FENCES_LINE));
  ok(gradeAnswer(p, every, 0).score === 0, `seed ${seed}: every edge drawn scores 0`);
  let rnd = 0;
  for (let k = 0; k < 20; k++) {
    let s = (seed * 7919 + k * 31) >>> 0;
    const lines: number[] = [];
    for (let e = 0; e < fencesEdgeCount(p.size); e++) {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      if (s % 3 === 0) lines.push(e);
    }
    rnd = Math.max(rnd, gradeAnswer(p, encodeLines(p, lines), 0).score);
  }
  ok(rnd <= 10, `seed ${seed}: random lines score at most 10 (best ${rnd})`);
  const half = sol.slice(0, Math.floor(sol.length / 2));
  const halfScore = gradeAnswer(p, encodeLines(p, half), 0).score;
  ok(halfScore >= 55 && halfScore <= 65, `seed ${seed}: half the loop scores ${halfScore} (about 60)`);
  const wrong = Array.from({ length: fencesEdgeCount(p.size) }, (_, e) => e).filter((e) => !sol.includes(e)).slice(0, 3);
  const withWrong = gradeAnswer(p, encodeLines(p, [...half, ...wrong]), 0).score;
  ok(withWrong < halfScore, `seed ${seed}: three wrong lines cut half the loop's ${halfScore} to ${withWrong}`);
}

if (failures.length) {
  console.log(`\nFAIL fences-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log("fences-check: all passed");
