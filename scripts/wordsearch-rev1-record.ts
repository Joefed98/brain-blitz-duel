/**
 * Records scripts/fixtures/wordsearch-rev1-legacy.json.gz: 60 Lookout puzzles dealt on main under
 * wordSearchRev 1 and a spread of answers graded under
 * puzzleScoreRev 1 and unstamped, so wordsearch-check can prove rev-1 rounds grade exactly as before
 * wordSearchRev 2. Recorded once, before wordSearchRev 2 (19 Oct 2026); never re-run to "fix" a failing check.
 *
 *   bun scripts/wordsearch-rev1-record.ts
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { pinDealtPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";
import type { PuzzleData, WordSearchPuzzleData } from "../src/lib/duel/types";
import { wsEncode } from "../src/lib/duel/wordSearch";

pinDealtPuzzleScoreRev(1);
const cases = [];
for (let k = 0; k < 60; k++) {
  const puzzle = generatePuzzle("wordsearch") as WordSearchPuzzleData;
  if (puzzle.wordSearchRev !== 1) throw new Error("not a rev-1 puzzle");
  const pl = puzzle.placements!;
  const answers = [
    wsEncode(pl.map((p) => p.cells)),
    wsEncode(pl.slice(1).map((p) => [...p.cells].reverse())),
    wsEncode([...pl.slice(0, 3).map((p) => p.cells), [0, 1], [0, 11], [5, 6], [20, 21], [30, 31], [40, 41], [50, 51]]),
    "",
  ];
  const { puzzleScoreRev: _drop, ...rest } = puzzle as WordSearchPuzzleData & { puzzleScoreRev?: number };
  const entries = [];
  for (const scoreRev of [1, 0])
    for (const answer of answers)
      for (const ms of [120_000, 60_000, 0]) {
        const g = gradeAnswer(scoreRev ? puzzle : (rest as PuzzleData), answer, ms);
        entries.push({ scoreRev, answer, ms, score: g.score, isCorrect: g.isCorrect, correctCount: g.correctCount, errors: g.errors, extra: JSON.stringify(g.extra) });
      }
  cases.push({ puzzle, entries });
}
writeFileSync(
  new URL("./fixtures/wordsearch-rev1-legacy.json.gz", import.meta.url),
  gzipSync(JSON.stringify({ recordedOn: "main 8d1651b (19 Oct 2026, before wordSearchRev 2)", cases })),
);
console.log(`recorded ${cases.length} rev-1 puzzles, ${cases.reduce((n, c) => n + c.entries.length, 0)} answers`);
