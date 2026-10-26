/**
 * Records depth batch 4's legacy fixture (scripts/fixtures/depth4-legacy.json.gz): the eight games' rounds as
 * main dealt them before the depth stamps (puzzleScoreRev 3, scored to 150), played by the fairness kits at
 * every level plus an empty and a spam answer, with the grade main gave each. depth4-check regrades every
 * one on today's code and fails on any difference, so stored rounds keep scoring exactly as before.
 *
 * Run it on unmodified main (a worktree): `bun scripts/depth4-record.ts --out=<path>`.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleType } from "../src/lib/duel/types";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";

const GAMES: PuzzleType[] = ["unblock", "blockparty", "pipes", "flow", "iceslide", "push", "laser", "rings"];
const SEEDS = 10;
const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/depth4-legacy.json.gz";

const rounds: unknown[] = [];
for (const type of GAMES) {
  const kit = KITS[type]!;
  for (let s = 1; s <= SEEDS; s++) {
    const seed = 4400 + s * 7;
    const puzzle = roomPuzzle(type, seed);
    const limit = puzzleTimeLimitMs(puzzle);
    const answers: { answer: string; ms: number }[] = [{ answer: kit.nothing(puzzle), ms: 0 }];
    for (const spam of kit.spam(puzzle, makeRng(hashText(`${type}:d4rec:${seed}`)), limit).slice(0, 1)) answers.push({ answer: spam.answer, ms: 0 });
    for (const level of LEVELS) {
      const play = kit.play(puzzle, makeRng(hashText(`${type}:d4rec:${seed}:${level}`)), SKILLS[level], limit);
      const inTime = play.steps.filter((x) => x.atMs <= limit);
      // The last answer and one from the middle, each at its own time and at the buzzer.
      for (const step of [inTime[Math.floor(inTime.length / 2)], inTime[inTime.length - 1]]) {
        if (!step) continue;
        answers.push({ answer: step.answer, ms: Math.max(0, limit - step.atMs) }, { answer: step.answer, ms: 0 });
      }
    }
    for (const { answer, ms } of answers) {
      const g = gradeAnswer(puzzle, answer, ms);
      rounds.push({ puzzle, answer, ms, score: g.score, isCorrect: g.isCorrect, storedMs: g.storedMs, extra: g.extra });
    }
  }
}
writeFileSync(out, gzipSync(JSON.stringify({ recordedOn: "main 37aab99 (25 Oct 2026), before depth batch 4", rounds })));
console.log(`${rounds.length} rounds recorded to ${out}`);
