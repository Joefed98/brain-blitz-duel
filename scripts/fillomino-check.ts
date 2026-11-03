/**
 * Fillomino (1 Nov 2026, fillominoRev 1): the generator, the uniqueness proof and the standard's grading.
 *
 *  1. Deterministic: the same seed builds the identical board (JSON), every time.
 *  2. Every board is re-proved to have exactly one solution by the solver run to the end (no node budget), the
 *     stored solution keeps the rules (fillominoSolvedGrid), the givens agree with it, no two equal regions touch,
 *     the grade and the givens sit in their bands, region sizes stay within FILLOMINO_GEN_MAX.
 *  3. Generation time (median / max) stays bounded.
 *  4. Grading through gradeAnswer on room deals (generatePuzzle with a bank seed): the stamp and the standard, a finish
 *     150–200 in parts, nothing 0, guessing (one number everywhere, random numbers, all ones) near 0, half right about
 *     60, wrong numbers cost, a clean finish with a timeline 200 and each wrong number ever entered costing 2.5.
 *  5. The solver is sound and complete: on boards with 3–6 blanks it counts exactly the solutions a naive brute force
 *     (every number 1–9 in every blank, pruning only groups already past their number) counts.
 *  6. The play screen's finished-region shades (fillominoShades, display only, 3 Nov 2026): exactly the cells of finished
 *     groups are shaded, one shade a region, within the palette, deterministic, and touching finished regions never
 *     share a shade, on solved boards, partly filled boards and random grids.
 *
 *   bun scripts/fillomino-check.ts [--seeds=140]
 */
import {
  FILLOMINO_GEN_MAX,
  FILLOMINO_GIVENS_BAND,
  FILLOMINO_GRADE_BAND,
  fillominoEqualRegionsApart,
  generateFillomino,
  solveFillomino,
} from "../src/lib/duel/fillomino.server";
import { encodeFillomino, fillominoComplete, fillominoGroups, fillominoNeighbours, fillominoSolved, fillominoSolvedGrid } from "../src/lib/duel/fillomino";
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { FILLOMINO_SHADES, fillominoShades } from "../src/puzzles/fillomino";
import { usesStandard } from "../src/lib/duel/standard/stamps";
import { FILLOMINO_SIZE, FILLOMINO_TIME_MS, type FillominoPuzzleData } from "../src/lib/duel/types";
import { sentAnswer } from "./standard-lib";

const args = process.argv.slice(2);
const SEEDS = Number(args.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 140);
const failures: string[] = [];
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    failures.push(msg);
    console.log(`FAIL ${msg}`);
  }
};

/* 1–3: boards */
const times: number[] = [];
const grades: number[] = [];
const givensN: number[] = [];
for (let i = 0; i < SEEDS; i++) {
  const seed = (i * 2_654_435_761 + 17) >>> 0;
  const t = performance.now();
  const p = generateFillomino(seed);
  times.push(performance.now() - t);
  ok(JSON.stringify(generateFillomino(seed)) === JSON.stringify(p), `seed ${seed}: not deterministic`);
  const sol = p.solution ?? [];
  ok(p.fillominoRev === 1 && p.size === FILLOMINO_SIZE && p.givens.length === 49 && sol.length === 49, `seed ${seed}: shape`);
  ok(fillominoSolvedGrid(p.size, sol), `seed ${seed}: stored solution breaks the rules`);
  ok(fillominoEqualRegionsApart(p.size, sol), `seed ${seed}: equal regions touch`);
  ok(fillominoGroups(p.size, sol).cells.every((m) => m.length <= FILLOMINO_GEN_MAX), `seed ${seed}: a region past ${FILLOMINO_GEN_MAX}`);
  ok(p.givens.every((g, c) => g === 0 || g === sol[c]), `seed ${seed}: a given disagrees with the solution`);
  const proof = solveFillomino(p.size, p.givens, 2);
  ok(!proof.exhausted && proof.count === 1, `seed ${seed}: ${proof.count} solutions (unique proof failed)`);
  ok(JSON.stringify(proof.solution) === JSON.stringify(sol), `seed ${seed}: the solver's solution is not the stored one`);
  ok(proof.branches === p.grade, `seed ${seed}: grade ${p.grade} vs ${proof.branches}`);
  const g = p.givens.filter(Boolean).length;
  ok(p.grade! >= FILLOMINO_GRADE_BAND[0] && p.grade! <= FILLOMINO_GRADE_BAND[1], `seed ${seed}: grade ${p.grade} out of band`);
  ok(g >= FILLOMINO_GIVENS_BAND[0] && g <= FILLOMINO_GIVENS_BAND[1], `seed ${seed}: ${g} givens out of band`);
  grades.push(p.grade!);
  givensN.push(g);
}
const q = (a: number[], f: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * f))]!;
console.log(`${SEEDS} boards: generation median ${q(times, 0.5).toFixed(1)} ms, p90 ${q(times, 0.9).toFixed(1)}, max ${Math.max(...times).toFixed(1)}; grade median ${q(grades, 0.5)} (${Math.min(...grades)}–${Math.max(...grades)}); givens median ${q(givensN, 0.5)}`);
ok(q(times, 0.5) < 200, `generation median ${q(times, 0.5).toFixed(1)} ms over 200 ms`);
ok(Math.max(...times) < 2000, `slowest board ${Math.max(...times).toFixed(0)} ms over 2 s`);

/* 4: grading */
const L = FILLOMINO_TIME_MS;
for (const bankSeed of [101, 202, 303, 404, 505]) {
  const p = generatePuzzle("fillomino", { bankSeed }) as FillominoPuzzleData;
  ok(p.type === "fillomino" && p.fillominoRev === 1 && usesStandard(p), `room ${bankSeed}: stamp fillominoRev 1 on the standard`);
  ok(JSON.stringify(generatePuzzle("fillomino", { bankSeed })) === JSON.stringify(p), `room ${bankSeed}: room deal differs`);
  const sol = p.solution!;
  const blanks = p.givens.flatMap((g, c) => (g ? [] : [c]));
  const enc = (map: (c: number) => number) => encodeFillomino(p.givens.map((g, c) => g || map(c)));
  ok(fillominoSolved(p, enc((c) => sol[c]!)), `room ${bankSeed}: the solution does not solve`);

  const fin = gradeAnswer(p, enc((c) => sol[c]!), L - 30_000);
  const parts = fin.extra?.["parts"] as { kind?: string } | undefined;
  ok(fin.isCorrect && fin.score >= 150 && fin.score <= 200 && parts?.kind === "finish" && fin.extra?.["standard"] === 1, `room ${bankSeed}: finish ${fin.score}`);
  ok(gradeAnswer(p, enc((c) => sol[c]!), 0).score === 150, `room ${bankSeed}: a finish at the buzzer is 150`);
  ok(gradeAnswer(p, enc(() => 0), 0).score === 0, `room ${bankSeed}: nothing scores 0`);
  ok(gradeAnswer(p, "", 0).score === 0, `room ${bankSeed}: an empty answer scores 0`);
  for (const v of [1, 2, 3, 4, 5]) {
    const s = gradeAnswer(p, enc(() => v), 0).score;
    ok(s <= 15, `room ${bankSeed}: every blank ${v} scores ${s}`);
  }
  let seedR = bankSeed;
  const rnd = () => ((seedR = (Math.imul(seedR, 1_103_515_245) + 12_345) >>> 0) >>> 16) % 7 + 1;
  for (let k = 0; k < 5; k++) {
    const s = gradeAnswer(p, enc(() => rnd()), 0).score;
    ok(s <= 15, `room ${bankSeed}: random numbers score ${s}`);
  }
  const half = new Set(blanks.slice(0, Math.floor(blanks.length / 2)));
  const halfScore = gradeAnswer(p, enc((c) => (half.has(c) ? sol[c]! : 0)), 0).score;
  ok(halfScore >= 55 && halfScore <= 65, `room ${bankSeed}: half right ${halfScore}, want about 60`);
  const wrongOne = blanks.find((c) => !half.has(c))!;
  const withWrong = gradeAnswer(p, enc((c) => (half.has(c) ? sol[c]! : c === wrongOne ? (sol[c] === 1 ? 2 : 1) : 0)), 0).score;
  ok(withWrong < halfScore, `room ${bankSeed}: a wrong number does not cost (${withWrong} vs ${halfScore})`);

  // A timeline: blanks filled one a second, with one wrong number entered then fixed.
  const drafts: { answer: string; atMs: number }[] = [];
  const state = new Map<number, number>();
  blanks.forEach((c, i) => {
    state.set(c, sol[c]!);
    drafts.push({ answer: enc((x) => state.get(x) ?? 0), atMs: 1000 * (i + 1) });
  });
  const clean = gradeAnswer(p, sentAnswer(p, drafts), L - drafts.at(-1)!.atMs);
  ok(clean.isCorrect && clean.score === 200, `room ${bankSeed}: clean fast finish ${clean.score}, want 200`);
  const messy = [{ answer: enc((c) => (c === blanks[0] ? (sol[c] === 1 ? 2 : 1) : 0)), atMs: 500 }, ...drafts];
  const dirty = gradeAnswer(p, sentAnswer(p, messy), L - drafts.at(-1)!.atMs);
  ok(dirty.isCorrect && dirty.score === 198, `room ${bankSeed}: one wrong number ever costs 2.5 (${dirty.score}, want 198)`);
}

/* 5: the solver against a naive brute force */
function bruteCount(size: number, givens: readonly number[], cap: number): number {
  const vals = [...givens];
  const blanks = vals.flatMap((v, c) => (v ? [] : [c]));
  let count = 0;
  // The group holding the square just set, counted up to its number + 1: past its number it can never shrink.
  const over = (start: number) => {
    const v = vals[start]!;
    const seen = new Set<number>([start]);
    const stack = [start];
    while (stack.length) {
      const c = stack.pop()!;
      for (const nb of fillominoNeighbours(size, c)) if (!seen.has(nb) && vals[nb] === v) (seen.add(nb), stack.push(nb));
      if (seen.size > v) return true;
    }
    return false;
  };
  const rec = (i: number) => {
    if (count >= cap) return;
    if (i === blanks.length) {
      if (fillominoSolvedGrid(size, vals)) count++;
      return;
    }
    for (let v = 1; v <= 9; v++) {
      vals[blanks[i]!] = v;
      if (!over(blanks[i]!)) rec(i + 1);
    }
    vals[blanks[i]!] = 0;
  };
  rec(0);
  return count;
}
let compared = 0;
let several = 0;
for (let i = 0; i < 40; i++) {
  const p = generateFillomino(9_000 + i);
  const sol = p.solution!;
  let r = (i * 48_271 + 11) >>> 0;
  const next = () => (r = (Math.imul(r, 1_103_515_245) + 12_345) >>> 0) >>> 8;
  const cells = Array.from({ length: 49 }, (_, c) => c);
  for (let k = cells.length - 1; k > 0; k--) {
    const j = next() % (k + 1);
    [cells[k], cells[j]] = [cells[j]!, cells[k]!];
  }
  const blanks = 3 + (i % 4);
  let givens = sol.map((v, c) => (cells.indexOf(c) < blanks ? 0 : v));
  if (i % 2) {
    // Whole small regions blanked: unclued regions, where other fillings often exist.
    const groups = fillominoGroups(p.size, sol);
    const blank = new Set<number>();
    for (const c of cells) {
      const members = groups.cells[groups.group[c]!]!;
      if (blank.size + members.length > 6 || blank.has(c)) continue;
      for (const m of members) blank.add(m);
    }
    givens = sol.map((v, c) => (blank.has(c) ? 0 : v));
  }
  const brute = bruteCount(p.size, givens, 50);
  const solver = solveFillomino(p.size, givens, 50).count;
  ok(brute === solver, `soundness ${i}: brute force ${brute} solutions, solver ${solver}`);
  ok(brute >= 1, `soundness ${i}: the known solution was lost`);
  compared++;
  if (brute > 1) several++;
}
console.log(`solver = brute force on ${compared} boards with 3–6 blanks (${several} with several solutions)`);
ok(several >= 3, `only ${several} soundness boards had several solutions`);

/* 6: finished-region shades on the play screen */
function checkShades(label: string, size: number, values: readonly number[]): number {
  const shade = fillominoShades(size, values);
  const complete = fillominoComplete(size, values);
  ok(JSON.stringify(fillominoShades(size, values)) === JSON.stringify(shade), `${label}: shades not deterministic`);
  ok(shade.length === size * size, `${label}: shade length ${shade.length}`);
  for (let c = 0; c < size * size; c++) {
    ok(complete.has(c) === shade[c]! >= 0, `${label}: cell ${c} shaded ${shade[c]} but finished ${complete.has(c)}`);
    ok(shade[c]! >= -1 && shade[c]! < FILLOMINO_SHADES && Number.isInteger(shade[c]), `${label}: cell ${c} shade ${shade[c]} outside the palette`);
  }
  const { group, cells } = fillominoGroups(size, values);
  let touching = 0;
  for (const members of cells) {
    if (!complete.has(members[0]!)) continue;
    ok(members.every((c) => shade[c] === shade[members[0]!]), `${label}: a finished region holds two shades`);
  }
  for (let c = 0; c < size * size; c++) {
    if (shade[c]! < 0) continue;
    for (const nb of fillominoNeighbours(size, c)) {
      if (shade[nb]! < 0 || group[nb] === group[c]) continue;
      touching++;
      ok(shade[nb] !== shade[c], `${label}: touching finished regions at ${c} and ${nb} share shade ${shade[c]}`);
    }
  }
  return touching;
}
let shadeBoards = 0;
let shadePairs = 0;
let maxShade = -1;
for (let i = 0; i < 200; i++) {
  const p = generateFillomino(20_000 + i);
  const sol = p.solution!;
  shadePairs += checkShades(`shades solved ${i}`, p.size, sol);
  // Partly filled: each solution cell kept with a seeded chance, otherwise blank or a wrong number.
  let r = (i * 69_069 + 5) >>> 0;
  const next = () => (r = (Math.imul(r, 1_103_515_245) + 12_345) >>> 0) >>> 8;
  const partial = sol.map((v) => (next() % 10 < 6 ? v : next() % 3 ? 0 : 1 + (next() % 5)));
  shadePairs += checkShades(`shades partial ${i}`, p.size, partial);
  // Random grids of small numbers (many tiny finished regions touching each other: the hardest maps to colour).
  for (const sz of [4, 7, 9]) {
    const rand = Array.from({ length: sz * sz }, () => (next() % 8 === 0 ? 0 : 1 + (next() % 3)));
    shadePairs += checkShades(`shades random ${sz}x${sz} ${i}`, sz, rand);
    for (const v of fillominoShades(sz, rand)) maxShade = Math.max(maxShade, v);
  }
  shadeBoards += 5;
}
// A hand-made map: a 2 ringed by alternating 1s and 3s, every region touching its neighbours.
shadePairs += checkShades("shades ring", 4, [1, 3, 3, 3, 3, 1, 2, 1, 1, 2, 3, 3, 3, 1, 3, 1]);
console.log(`shades: ${shadeBoards} boards, ${shadePairs} touching finished-square pairs all in different shades (highest shade used ${maxShade})`);
ok(shadePairs > 1000, `shades: only ${shadePairs} touching pairs tested`);

if (failures.length) {
  console.log(`FAIL fillomino-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log("fillomino-check: all passed");
