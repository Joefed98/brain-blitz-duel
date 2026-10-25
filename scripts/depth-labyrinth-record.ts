/**
 * Records the Labyrinth legacy fixture for depth-labyrinth-check (25 Oct 2026, run on unmodified main before
 * mazeRev 1): room mazes on the stamps rooms dealt then (puzzleScoreRev 3, and the same boards re-stamped 2, 1 and
 * unstamped), each graded for nothing, spam, the kit players and a few partial answers. The check regrades every
 * entry and fails on any difference.
 *
 *   bun scripts/depth-labyrinth-record.ts [--out=scripts/fixtures/depth-labyrinth-legacy.json.gz]
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/depth-labyrinth-legacy.json.gz";
const kit = KITS["maze"]!;
const entries: { puzzle: PuzzleData; answer: string; ms: number; score: number; isCorrect: boolean; extra: unknown }[] = [];
for (let seed = 1; seed <= 12; seed++) {
  const dealt = roomPuzzle("maze", 7_000 + seed);
  const limit = puzzleTimeLimitMs(dealt);
  for (const rev of [3, 2, 1, 0]) {
    const puzzle = { ...(dealt as object), puzzleScoreRev: rev } as PuzzleData;
    if (rev === 0) delete (puzzle as { puzzleScoreRev?: number }).puzzleScoreRev;
    const answers: [string, number][] = [[kit.nothing(puzzle), 0]];
    for (const s of kit.spam(puzzle, makeRng(hashText(`spam:${seed}`)), limit)) answers.push([s.answer, 0]);
    for (const level of LEVELS) {
      const play = kit.play(puzzle, makeRng(hashText(`play:${seed}:${level}`)), SKILLS[level], limit);
      const steps = play.steps.filter((s) => s.atMs <= limit);
      const last = steps[steps.length - 1];
      if (last) answers.push([last.answer, Math.max(0, limit - last.atMs)]);
      const mid = steps[Math.floor(steps.length / 2)];
      if (mid) answers.push([mid.answer, 0]);
    }
    for (const [answer, ms] of answers) {
      const g = gradeAnswer(puzzle, answer, ms);
      entries.push({ puzzle, answer, ms, score: g.score, isCorrect: g.isCorrect, extra: g.extra });
    }
  }
}
writeFileSync(out, gzipSync(JSON.stringify(entries)));
console.log(`${entries.length} Labyrinth legacy grades → ${out}`);
