/**
 * Records the legacy fixture for puzzle-polish-nov-check (3 Nov 2026): Operator on the scoring standard's stamp
 * (signs only, depthRev 2) and Labyrinth, Topsy-Turvy and Skid on the puzzle batch's stamps (mazeRev 4, gravityRev 6,
 * slideRev 3), dealt and graded by unmodified main. Run it in a checkout of main (it only uses APIs main has):
 *
 *   bun scripts/puzzle-polish-nov-record.ts --out=<path>/scripts/fixtures/puzzle-polish-nov-legacy.json.gz
 *
 * Each case is a real answer (kit and bot play cut at a quarter, half and the end, and spam) graded at three times left.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { BATCH_LEVELS, BATCH_TYPES, dealBatch, playBatch, spamBatch } from "./puzzle-batch-nov/players";
import type { PuzzleData } from "../src/lib/duel/types";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/puzzle-polish-nov-legacy.json.gz";
const puzzles: PuzzleData[] = [];
const cases: { p: number; answer: string; msLeft: number; score: number; correct: boolean; parts: unknown }[] = [];

function add(p: PuzzleData, answers: string[]): void {
  const index = puzzles.length;
  puzzles.push(p);
  const limit = puzzleTimeLimitMs(p);
  for (const answer of new Set(answers)) {
    for (const msLeft of [0, Math.round(limit * 0.4), limit - 8_000]) {
      const g = gradeAnswer(p, answer, msLeft);
      cases.push({ p: index, answer, msLeft, score: g.score, correct: g.isCorrect, parts: (g.extra as Record<string, unknown> | undefined)?.["parts"] ?? null });
    }
  }
}

const cuts = (answers: string[]) => [0.25, 0.5, 1].map((c) => answers[Math.max(0, Math.ceil(answers.length * c) - 1)]).filter((a): a is string => a !== undefined);

for (const type of BATCH_TYPES) {
  for (const seed of [31_001, 31_017, 31_043, 31_079]) {
    const p = dealBatch(type, seed);
    const answers: string[] = [];
    for (const level of ["weak", "good", "flawless"] as const) answers.push(...cuts(playBatch(type, p, level, seed).steps.map((s) => s.answer)));
    answers.push(...spamBatch(type, p, seed).map((s) => s.answer));
    add(p, answers);
  }
  void BATCH_LEVELS;
}
for (const seed of [41_003, 41_029, 41_057, 41_087, 41_113, 41_149]) {
  const p = withSeededRandom(seed, () => generatePuzzle("equation", { bankSeed: seed }));
  const limit = puzzleTimeLimitMs(p);
  const answers: string[] = [];
  for (const level of ["average", "good", "near"] as const) answers.push(...cuts(KITS.equation!.play(p, makeRng(hashText(`rec:${seed}:${level}`)), SKILLS[level], limit).steps.map((s) => s.answer)));
  answers.push(...KITS.equation!.spam(p, makeRng(hashText(`rec:${seed}:spam`)), limit).map((s) => s.answer));
  add(p, answers);
}
writeFileSync(out, gzipSync(JSON.stringify({ puzzles, cases })));
console.log(`${puzzles.length} puzzles, ${cases.length} cases → ${out}`);
