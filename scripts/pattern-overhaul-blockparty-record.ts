/**
 * Records the legacy fixture for pattern-overhaul-blockparty-check (the Pattern overhaul, 15 Nov 2026): Tessellate
 * boards as dealt before blockRev 4 (blockRev 3, the live stamp before the overhaul, pinned through
 * pinPrePatternNov15; and the standard's blockRev 2 and the pre-standard board through preStandard), each played
 * several ways (a clean solve, a solve with a piece moved, a part-filled board, random legal drops, an answer with no
 * timeline), with the score and parts graded before the overhaul's grading change. The check regrades every entry on
 * today's tree and fails on any difference.
 *
 *   bun scripts/pattern-overhaul-blockparty-record.ts [--out=scripts/fixtures/pattern-overhaul-blockparty-legacy.json.gz]
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { pinPrePatternNov15 } from "../src/lib/duel/patternNov15";
import { pinPreStandard } from "../src/lib/duel/standard/stamps";
import { blockCases } from "./pattern-overhaul-blockparty-lib";
import { roomPuzzle } from "./puzzle-fairness/run";
import type { PuzzleData } from "../src/lib/duel/types";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/pattern-overhaul-blockparty-legacy.json.gz";

pinPrePatternNov15(true);
const puzzles: PuzzleData[] = [];
for (let i = 0; i < 8; i++) puzzles.push(roomPuzzle("blockparty", 9100 + i * 13));
const prev = pinPreStandard(true);
for (let i = 0; i < 2; i++) puzzles.push(roomPuzzle("blockparty", 9500 + i * 17));
pinPreStandard(prev);

const cases: { p: number; answer: string; msLeft: number; score: number; correct: boolean; parts: unknown }[] = [];
puzzles.forEach((p, pi) => {
  for (const c of blockCases(p, 4000 + pi)) {
    const g = gradeAnswer(p, c.answer, c.msLeft);
    cases.push({ p: pi, answer: c.answer, msLeft: c.msLeft, score: g.score, correct: g.isCorrect, parts: (g.extra as Record<string, unknown> | undefined)?.["parts"] ?? null });
  }
});
writeFileSync(out, gzipSync(JSON.stringify({ recorded: "before the Pattern overhaul's Tessellate grading (15 Nov 2026)", puzzles, cases })));
console.log(`wrote ${out}: ${puzzles.length} puzzles, ${cases.length} cases`);
