/**
 * Records Don't Break the Chain and Matchmaker rounds on the stamps main deals before Depth to 200 (25 Oct 2026):
 * kit players at every level plus spam, on 20 room seeds each, graded by main's server grader. Run from a worktree of
 * main; depth-chain-check and depth-matchmaker-check regrade every round and require the same score and detail.
 *
 *   bun scripts/depth/chain-pair-legacy-record.ts <out.json.gz>
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { gradeAnswer } from "../../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../../src/lib/duel/registry";
import type { PuzzleType } from "../../src/lib/duel/types";
import { LEVELS, SKILLS, hashText, makeRng } from "../puzzle-fairness/kit";
import { KITS } from "../puzzle-fairness/kits";
import { roomPuzzle } from "../puzzle-fairness/run";

const out = process.argv[2]!;
const rounds: unknown[] = [];
for (const type of ["chain", "pairmatch"] as PuzzleType[]) {
  const kit = KITS[type]!;
  for (let s = 0; s < 20; s++) {
    const seed = 7_000 + s;
    const puzzle = roomPuzzle(type, seed);
    const limit = puzzleTimeLimitMs(puzzle);
    const answers: [string, number, string][] = [[kit.nothing(puzzle), 0, "nothing"]];
    for (const spam of kit.spam(puzzle, makeRng(hashText(`${type}:spam:${seed}`)), limit)) answers.push([spam.answer, 0, spam.label]);
    for (const level of LEVELS) {
      const play = kit.play(puzzle, makeRng(hashText(`${type}:play:${seed}:${level}`)), SKILLS[level], limit);
      const steps = play.steps.filter((x) => x.atMs <= limit);
      // The finished answer at its own time, and two unfinished drafts at the buzzer.
      const last = steps.at(-1);
      if (last) answers.push([last.answer, Math.max(0, limit - last.atMs), level]);
      for (const k of [0.3, 0.7]) {
        const mid = steps[Math.floor(steps.length * k)];
        if (mid) answers.push([mid.answer, 0, `${level}@${k}`]);
      }
    }
    for (const [answer, ms, label] of answers) {
      const g = gradeAnswer(puzzle, answer, ms);
      rounds.push({ type, seed, label, puzzle, answer, ms, score: g.score, isCorrect: g.isCorrect, extra: g.extra, storedMs: g.storedMs });
    }
  }
}
writeFileSync(out, gzipSync(JSON.stringify(rounds)));
console.log(`recorded ${rounds.length} rounds to ${out}`);
