/**
 * Records scripts/fixtures/codeword-rev2-legacy.json.gz: 40 codewordRev 2 boards (five givens) dealt
 * by room seed and a spread of answers graded under puzzleScoreRev 1 and unstamped, so
 * codeword-check can prove rev-2 rounds rebuild and grade exactly as before codewordRev 3.
 * Recorded once, before codewordRev 3 (19 Oct 2026); never re-run to "fix" a failing check.
 *
 *   bun scripts/codeword-rev2-record.ts
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { encodeCodeword } from "../src/lib/duel/codeword";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { pinDealtPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";
import type { CodewordPuzzleData, PuzzleData } from "../src/lib/duel/types";

pinDealtPuzzleScoreRev(1);
const cases = [];
for (let k = 0; k < 40; k++) {
  const seed = 1009 + k * 7919;
  const puzzle = generatePuzzle("codeword", { bankSeed: seed }) as CodewordPuzzleData;
  if (puzzle.codewordRev !== 2 || puzzle.givens.length !== 5) throw new Error("not a rev-2 board");
  const sol = puzzle.solution!;
  const hidden = Array.from({ length: puzzle.numbers }, (_, i) => i + 1).filter((n) => !puzzle.givens.some((g) => g.n === n));
  const right = hidden.map((n) => ({ n, letter: sol[n - 1]! }));
  const swapped = [...right];
  swapped[0] = { n: right[0]!.n, letter: right[1]!.letter };
  swapped[1] = { n: right[1]!.n, letter: right[0]!.letter };
  const answers = [encodeCodeword(right), encodeCodeword(right.slice(1)), encodeCodeword(swapped), encodeCodeword(right.slice(0, 4)), ""];
  const { puzzleScoreRev: _drop, ...rest } = puzzle as CodewordPuzzleData & { puzzleScoreRev?: number };
  const entries = [];
  for (const scoreRev of [1, 0])
    for (const answer of answers)
      for (const ms of [120_000, 70_000, 0]) {
        const g = gradeAnswer(scoreRev ? puzzle : (rest as PuzzleData), answer, ms);
        entries.push({ scoreRev, answer, ms, score: g.score, isCorrect: g.isCorrect, correctCount: g.correctCount, errors: g.errors, extra: JSON.stringify(g.extra) });
      }
  cases.push({ seed, puzzle, entries });
}
writeFileSync(
  new URL("./fixtures/codeword-rev2-legacy.json.gz", import.meta.url),
  gzipSync(JSON.stringify({ recordedOn: "main 8d1651b (19 Oct 2026, before codewordRev 3)", cases })),
);
console.log(`recorded ${cases.length} rev-2 boards, ${cases.reduce((n, c) => n + c.entries.length, 0)} answers`);
