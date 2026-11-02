/**
 * Kakuro (1 Nov 2026, kakuroRev 1, docs/scoring-standard.md "New grid puzzles"): the generator, the uniqueness proof and
 * the grade on the scoring standard.
 *
 *  1. Deterministic: the same seed builds the same board (JSON identical), on 240 seeds.
 *  2. Layout: 6 × 6, row 0 and column 0 black, KAKURO_WHITE_MIN–MAX white squares, every white square in an across and
 *     a down run of 2+, the white squares joined, at most KAKURO_MAX_BLOCKS white 2 × 2 blocks, clues = the runs.
 *  3. Unique: every board re-proved by the solver (exactly one solution, equal to the stored one), the stored solution
 *     keeps the rules (kakuroSolvedGrid: sums, no repeats), and the grade is the search's and inside the band.
 *  4. Generation time (median / max) within budget.
 *  5. Grading through gradeAnswer on room deals: kakuroRev 1 on the standard; a finish 150–200 in the standard's parts;
 *     nothing, random digits, all nines and across-sum fills score near 0 (guessing never pays); half right ≈ 60 plus
 *     early; wrong digits cut it; the clean bonus counts wrong digits ever entered; the solution is private.
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import {
  generateKakuro,
  kakuroBlocks,
  kakuroLayoutWhite,
  KAKURO_GRADE_MAX,
  KAKURO_MAX_BLOCKS,
  KAKURO_WHITE_MAX,
  KAKURO_WHITE_MIN,
  searchKakuro,
} from "../src/lib/duel/kakuro.server";
import { encodeKakuro, kakuroRuns, kakuroSolvedGrid } from "../src/lib/duel/kakuro";
import { usesStandard } from "../src/lib/duel/standard/stamps";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { encodeTimeline } from "../src/lib/duel/standard/timeline";
import type { KakuroPuzzleData } from "../src/lib/duel/types";

const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  if (!cond) {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};

const SEEDS = Array.from({ length: 240 }, (_, i) => 0x51ed + i * 7919);
const times: number[] = [];
const grades: Record<number, number> = {};
const whites: Record<number, number> = {};

for (const seed of SEEDS) {
  const t = performance.now();
  const p = generateKakuro(seed);
  times.push(performance.now() - t);
  ok(JSON.stringify(generateKakuro(seed)) === JSON.stringify(p), `seed ${seed}: deterministic`);
  ok(p.type === "kakuro" && p.kakuroRev === 1 && p.size === 6, `seed ${seed}: 6 × 6, kakuroRev 1`);
  const size = p.size;
  const white = new Set(p.white);
  for (let i = 0; i < size; i++) ok(!white.has(i) && !white.has(i * size), `seed ${seed}: row 0 and column 0 black`);
  ok(p.white.length >= KAKURO_WHITE_MIN && p.white.length <= KAKURO_WHITE_MAX, `seed ${seed}: ${p.white.length} white squares`);
  const black = new Set<number>();
  for (let c = 0; c < size * size; c++) if (!white.has(c) && c >= size && c % size) black.add(c);
  ok(JSON.stringify(kakuroLayoutWhite(size, black)) === JSON.stringify(p.white), `seed ${seed}: layout rules (runs 2+, joined)`);
  ok(kakuroBlocks(size, p.white) <= KAKURO_MAX_BLOCKS, `seed ${seed}: at most ${KAKURO_MAX_BLOCKS} white 2 × 2 blocks`);
  const runs = kakuroRuns(p);
  const covered = new Map<number, number>();
  for (const run of runs) {
    ok(run.cells.length >= 2, `seed ${seed}: run of ${run.cells.length}`);
    for (const c of run.cells) covered.set(c, (covered.get(c) ?? 0) + 1);
  }
  ok(p.white.every((c) => covered.get(c) === 2), `seed ${seed}: every white square in one across and one down run`);
  const sol = p.solution ?? [];
  ok(kakuroSolvedGrid(p, sol), `seed ${seed}: the stored solution keeps the rules`);
  const proof = searchKakuro({ size, white: p.white, clues: p.clues }, 3);
  ok(proof.count === 1, `seed ${seed}: ${proof.count} solutions (want exactly 1)`);
  ok(JSON.stringify(proof.first) === JSON.stringify(sol), `seed ${seed}: the solver's solution is the stored one`);
  ok(p.grade === searchKakuro(p, 2).branches && (p.grade ?? -1) >= 0 && (p.grade ?? 99) <= KAKURO_GRADE_MAX, `seed ${seed}: grade ${p.grade} in 0–${KAKURO_GRADE_MAX}`);
  grades[p.grade ?? -1] = (grades[p.grade ?? -1] ?? 0) + 1;
  whites[p.white.length] = (whites[p.white.length] ?? 0) + 1;
}
times.sort((a, b) => a - b);
const med = times[times.length >> 1]!;
const max = times.at(-1)!;
ok(med < 60, `median generation ${med.toFixed(1)} ms (budget 60)`);
ok(max < 400, `slowest generation ${max.toFixed(1)} ms (budget 400)`);
console.log(`generation: median ${med.toFixed(1)} ms, max ${max.toFixed(1)} ms; grades ${JSON.stringify(grades)}; whites ${JSON.stringify(whites)}`);

/* ------------------------------------------------------------------ grading */

const LIMIT = 120_000;
for (const seed of [11, 4242, 90210, 31337, 777]) {
  const p = generatePuzzle("kakuro", { bankSeed: seed }) as KakuroPuzzleData;
  ok(p.kakuroRev === 1 && usesStandard(p), `room ${seed}: kakuroRev 1 on the standard`);
  ok(JSON.stringify(generatePuzzle("kakuro", { bankSeed: seed })) === JSON.stringify(p), `room ${seed}: the same room seed deals the same board`);
  ok(!("solution" in splitPuzzle(p).pub), `room ${seed}: the solution stays server-side`);
  const sol = p.solution ?? [];
  const n = p.size * p.size;
  const grade = (answer: string, msLeft = 0) => gradeAnswer(p, answer, msLeft);

  const finish = grade(encodeKakuro(sol), 90_000);
  const parts = finish.extra?.["parts"] as { kind: string; base: number; speed: number; efficiency: number } | undefined;
  ok(finish.isCorrect && finish.score >= 150 && finish.score <= 200, `room ${seed}: a finish scores ${finish.score} (150–200)`);
  ok(parts?.kind === "finish" && parts.base === 150 && parts.speed === 40 && finish.extra?.["standard"] === 1, `room ${seed}: finish parts 150 + 40 speed`);
  ok(grade(encodeKakuro(sol), 0).score === 150, `room ${seed}: a finish at the buzzer is 150`);

  ok(grade("").score === 0 && grade(encodeKakuro(new Array(n).fill(0))).score === 0, `room ${seed}: nothing scores 0`);
  const nines = new Array<number>(n).fill(0);
  for (const c of p.white) nines[c] = 9;
  ok(grade(encodeKakuro(nines)).score <= 10, `room ${seed}: all nines ${grade(encodeKakuro(nines)).score}`);
  let lcg = seed >>> 0;
  const rand = () => ((lcg = (Math.imul(lcg, 1103515245) + 12345) >>> 0) % 9) + 1;
  for (let k = 0; k < 20; k++) {
    const r = new Array<number>(n).fill(0);
    for (const c of p.white) r[c] = rand();
    ok(grade(encodeKakuro(r)).score <= 25, `room ${seed}: random digits ${grade(encodeKakuro(r)).score} (guessing never pays)`);
  }

  // Half the white squares right: 60 (no timeline, so no early extras).
  const half = new Array<number>(n).fill(0);
  const halfCells = p.white.slice(0, Math.floor(p.white.length / 2));
  for (const c of halfCells) half[c] = sol[c]!;
  const halfScore = grade(encodeKakuro(half)).score;
  const want = Math.round((120 * halfCells.length) / p.white.length);
  ok(halfScore === want, `room ${seed}: half right ${halfScore} (want ${want})`);
  const withWrong = [...half];
  const spare = p.white.filter((c) => !halfCells.includes(c));
  withWrong[spare[0]!] = (sol[spare[0]!]! % 9) + 1;
  withWrong[spare[1]!] = (sol[spare[1]!]! % 9) + 1;
  ok(grade(encodeKakuro(withWrong)).score < halfScore, `room ${seed}: wrong digits cut the credit`);

  // The draft timeline: half right placed early earns early extras; a wrong digit entered and erased costs the clean bonus.
  const early = grade(`${encodeKakuro(half)}${encodeTimeline([{ t: 5_000, draft: encodeKakuro(half) }])}`).score;
  ok(early > halfScore && early <= halfScore + 10, `room ${seed}: half right early ${early} earns early extras over ${halfScore}`);
  const solText = encodeKakuro(sol);
  const clean = grade(`${solText}${encodeTimeline([{ t: 30_000, draft: solText }])}`, 90_000);
  ok(clean.score === 200, `room ${seed}: a clean fast finish with its timeline scores ${clean.score} (want 200)`);
  const slip = [...sol];
  slip[p.white[0]!] = (sol[p.white[0]!]! % 9) + 1;
  const dirty = grade(`${solText}${encodeTimeline([{ t: 10_000, draft: encodeKakuro(slip) }, { t: 30_000, draft: solText }])}`, 90_000);
  ok(dirty.score === 197 || dirty.score === 198, `room ${seed}: one wrong digit ever entered costs 2.5 of the clean bonus (${dirty.score})`);
}

if (failures.length) {
  console.log(`\nFAIL kakuro-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`kakuro-check: ${SEEDS.length} boards unique and in band; grading on the standard ok`);
