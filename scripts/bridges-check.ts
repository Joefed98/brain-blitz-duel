/**
 * Bridges (1 Nov 2026, bridgesRev 1, docs/scoring-standard.md "New grid puzzles"): the generator, the solver and the
 * standard's grading.
 *
 *  1. Determinism: 240 seeds, each built twice, identical JSON.
 *  2. Every board: 7 × 7, 10–14 islands in cell order, no two islands side by side, numbers 1–8; re-proved unique by
 *     the solver (exactly one solution) and the stored solution keeps every rule (bridgesSolvedCounts) and is the
 *     solver's; grade within the band; generation time (median / max).
 *  3. The fallback board is unique too.
 *  4. Grading through gradeAnswer on room-dealt puzzles (bridgesRev 1, on the standard): a finish 150–200 with the
 *     standard's parts, nothing 0, every pair doubled at most 12, random drags 0 at the median and at most 10 on average, about half the solution's bridges (whole pairs) about 60,
 *     extra bridges lowering it.
 *
 *   bun scripts/bridges-check.ts
 */
import { bridgePairs, bridgesSolvedCounts, crossingTable, decodeBridges, encodeBridges } from "../src/lib/duel/bridges";
import {
  BRIDGES_FALLBACK,
  BRIDGES_GRADE_MAX,
  BRIDGES_GRADE_MIN,
  BRIDGES_MAX_ISLANDS,
  BRIDGES_MIN_ISLANDS,
  generateBridges,
  solveBridges,
} from "../src/lib/duel/bridges.server";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { usesStandard } from "../src/lib/duel/standard/stamps";
import { BRIDGES_SIZE, type BridgesPuzzleData } from "../src/lib/duel/types";
import { seededRng } from "../src/lib/duel/seededRng";

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++;
    console.log(`FAIL ${msg}`);
  }
};

// 1–2. Boards.
const times: number[] = [];
const grades = new Map<number, number>();
const counts = new Map<number, number>();
const SEEDS = 240;
for (let s = 0; s < SEEDS; s++) {
  const seed = (s * 2654435761 + 17) >>> 0;
  const t0 = performance.now();
  const p = generateBridges(seed);
  times.push(performance.now() - t0);
  ok(JSON.stringify(p) === JSON.stringify(generateBridges(seed)), `seed ${seed}: not deterministic`);
  ok(p.type === "bridges" && p.bridgesRev === 1 && p.size === BRIDGES_SIZE, `seed ${seed}: type / stamp / size`);
  ok(p.islands.length >= BRIDGES_MIN_ISLANDS && p.islands.length <= BRIDGES_MAX_ISLANDS, `seed ${seed}: ${p.islands.length} islands`);
  ok(p.islands.every((isl, i) => i === 0 || isl.cell > p.islands[i - 1]!.cell), `seed ${seed}: islands not in cell order`);
  ok(p.islands.every((isl) => isl.n >= 1 && isl.n <= 8), `seed ${seed}: an island number out of 1–8`);
  const cells = new Set(p.islands.map((i) => i.cell));
  ok(
    p.islands.every((isl) => {
      const c = isl.cell % BRIDGES_SIZE;
      return !cells.has(isl.cell + BRIDGES_SIZE) && !(c < BRIDGES_SIZE - 1 && cells.has(isl.cell + 1));
    }),
    `seed ${seed}: two islands side by side`,
  );
  const pairs = bridgePairs(p.islands, p.size);
  const sol = p.solution ?? [];
  ok(sol.length === pairs.length, `seed ${seed}: solution length ${sol.length} vs ${pairs.length} pairs`);
  ok(bridgesSolvedCounts(p.islands, pairs, sol), `seed ${seed}: the stored solution breaks a rule`);
  const proof = solveBridges(p.size, p.islands, 3);
  ok(proof.count === 1, `seed ${seed}: ${proof.count} solutions`);
  ok(JSON.stringify(proof.first) === JSON.stringify(sol), `seed ${seed}: the solver's solution differs from the stored one`);
  ok(p.grade === proof.branches && proof.branches >= BRIDGES_GRADE_MIN && proof.branches <= BRIDGES_GRADE_MAX, `seed ${seed}: grade ${p.grade} / ${proof.branches}`);
  grades.set(p.grade ?? -1, (grades.get(p.grade ?? -1) ?? 0) + 1);
  counts.set(p.islands.length, (counts.get(p.islands.length) ?? 0) + 1);
}
times.sort((a, b) => a - b);
console.log(`${SEEDS} boards: generation median ${times[SEEDS >> 1]!.toFixed(1)} ms, max ${times[SEEDS - 1]!.toFixed(1)} ms`);
console.log(`  islands ${[...counts].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}:${c}`).join(" ")}; grades ${[...grades].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}:${c}`).join(" ")}`);
ok(times[SEEDS - 1]! < 500, `slowest generation ${times[SEEDS - 1]!.toFixed(0)} ms (want under 500)`);

// 3. The fallback.
{
  const proof = solveBridges(BRIDGES_SIZE, BRIDGES_FALLBACK.islands, 3);
  ok(proof.count === 1, `fallback board: ${proof.count} solutions`);
  const pairs = bridgePairs(BRIDGES_FALLBACK.islands, BRIDGES_SIZE);
  ok(bridgesSolvedCounts(BRIDGES_FALLBACK.islands, pairs, BRIDGES_FALLBACK.solution), "fallback board: its solution breaks a rule");
}

// 4. Grading on room-dealt puzzles.
const rng = seededRng(4242);
const randomScores: number[] = [];
for (let s = 0; s < 30; s++) {
  const p = generatePuzzle("bridges", { bankSeed: 9100 + s * 13 }) as BridgesPuzzleData;
  ok(p.bridgesRev === 1 && usesStandard(p), `room seed ${s}: not on the standard (bridgesRev ${p.bridgesRev})`);
  ok(JSON.stringify(p) === JSON.stringify(generatePuzzle("bridges", { bankSeed: 9100 + s * 13 })), `room seed ${s}: room deal not identical`);
  const pairs = bridgePairs(p.islands, p.size);
  const crosses = crossingTable(pairs);
  const sol = p.solution ?? [];
  const limit = 90_000;
  const fin = gradeAnswer(p, encodeBridges(sol), limit - 30_000);
  const parts = fin.extra?.["parts"] as { kind?: string; base?: number } | undefined;
  ok(fin.isCorrect && fin.score >= 150 && fin.score <= 200 && parts?.kind === "finish" && parts.base === 150, `room seed ${s}: finish scored ${fin.score}`);
  ok(fin.extra?.["standard"] === 1, `room seed ${s}: finish not graded by the standard`);
  ok(gradeAnswer(p, "", 0).score === 0, `room seed ${s}: nothing scored ${gradeAnswer(p, "", 0).score}`);
  // Every pair doubled where crossings allow, in two orders.
  for (const flip of [false, true]) {
    const all = new Array<number>(pairs.length).fill(0);
    const idx = pairs.map((_, j) => j);
    for (const i of flip ? idx.reverse() : idx) if (!crosses[i]!.some((j) => all[j])) all[i] = 2;
    const g = gradeAnswer(p, encodeBridges(all), 0);
    ok(g.isCorrect || g.score <= 12, `room seed ${s}: every pair ${flip ? "(reversed) " : ""}doubled scored ${g.score}`);
  }
  // Random drags (each pair cycled at random, crossings refused): pooled below, the mean must stay about 0.
  for (let k = 0; k < 12; k++) {
    const c = new Array<number>(pairs.length).fill(0);
    for (let n = 0; n < 30; n++) {
      const i = rng.below(pairs.length);
      if (!c[i] && crosses[i]!.some((j) => c[j])) continue;
      c[i] = (c[i]! + 1) % 3;
    }
    const g = gradeAnswer(p, encodeBridges(c), 0);
    randomScores.push(g.isCorrect ? 0 : g.score);
  }
  // About half the solution's bridges, whole pairs at a time (as a player builds them): 120 × placed ÷ total.
  const half = sol.map(() => 0);
  const total = sol.reduce((a, b) => a + b, 0);
  let placed = 0;
  for (let i = 0; i < sol.length && placed < total / 2; i++) {
    half[i] = sol[i]!;
    placed += sol[i]!;
  }
  const hs = gradeAnswer(p, encodeBridges(half), 0).score;
  const want = Math.round((120 * placed) / total);
  ok(Math.abs(hs - want) <= 1, `room seed ${s}: half the bridges scored ${hs}, want ${want}`);
  ok(hs >= 50 && hs <= 80, `room seed ${s}: about half the bridges scored ${hs}`);
  // An extra bridge on a pair the solution leaves short lowers it.
  const extraPair = half.findIndex((v, i) => v < 2 && v >= sol[i]! && !(v === 0 && crosses[i]!.some((j) => half[j])));
  if (extraPair >= 0) {
    const more = half.map((v, i) => (i === extraPair ? v + 1 : v));
    ok(gradeAnswer(p, encodeBridges(more), 0).score < hs, `room seed ${s}: an extra bridge did not lower the score`);
  }
  ok(decodeBridges(encodeBridges(sol), pairs.length).join() === sol.join(), `room seed ${s}: encoding round trip`);
}

{
  randomScores.sort((a, b) => a - b);
  const mean = randomScores.reduce((a, b) => a + b, 0) / randomScores.length;
  const median = randomScores[randomScores.length >> 1]!;
  console.log(`random drags: ${randomScores.length} runs, mean ${mean.toFixed(1)}, median ${median}, p90 ${randomScores[Math.floor(randomScores.length * 0.9)]}`);
  ok(mean <= 10 && median === 0, `random drags pay: mean ${mean.toFixed(1)}, median ${median}`);
}

if (failures) {
  console.log(`FAIL bridges-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log("bridges-check: all passed");
