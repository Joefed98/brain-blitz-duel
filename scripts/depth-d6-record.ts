/**
 * Records the Logic depth check's legacy fixture (scripts/fixtures/depth-d6-legacy.json.gz, 25 Oct 2026): rounds of the
 * eleven Logic games as rooms dealt them before the depth revision, graded by the tree it runs in. Run it on unmodified
 * main (a git worktree with this file copied in); depth-d6-check regrades every round on the branch and fails on any
 * difference in score, correctness or stored detail, so a stored round always grades as it did.
 *
 *   bun scripts/depth-d6-record.ts [--seeds=8] [--out=scripts/fixtures/depth-d6-legacy.json.gz]
 *
 * Per game and seed: the room puzzle, nothing at the buzzer, every kit spam, the four kit levels' plays (the
 * finishing answer at its time and a few unfinished steps at the buzzer). Script-only.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleType } from "../src/lib/duel/types";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 8);
const OUT = opt("out") ?? "scripts/fixtures/depth-d6-legacy.json.gz";
const GAMES: PuzzleType[] = ["lightsout", "sudoku", "tower", "tubes", "safe", "bomb", "nonogram", "flood", "tents", "shikaku", "lightup"];

const rounds: unknown[] = [];
for (const type of GAMES) {
  const kit = KITS[type]!;
  for (let s = 1; s <= SEEDS; s++) {
    const seed = 70_000 + s * 13;
    const puzzle = roomPuzzle(type, seed);
    const limit = puzzleTimeLimitMs(puzzle);
    const answers: [string, number][] = [[kit.nothing(puzzle), 0]];
    for (const spam of kit.spam(puzzle, makeRng(hashText(`${type}:spam:${seed}`)), limit)) answers.push([spam.answer, 0]);
    for (const level of LEVELS) {
      const play = kit.play(puzzle, makeRng(hashText(`${type}:play:${seed}:${level}`)), SKILLS[level], limit);
      const steps = play.steps.filter((x) => x.atMs <= limit);
      steps.forEach((step, i) => {
        if (i % Math.max(1, Math.ceil(steps.length / 4)) === 0) answers.push([step.answer, 0]);
      });
      const last = steps[steps.length - 1];
      if (last) answers.push([last.answer, Math.max(0, limit - last.atMs)]);
    }
    for (const [answer, ms] of answers) {
      const g = gradeAnswer(puzzle, answer, ms);
      rounds.push({ type, seed, puzzle, answer, ms, score: g.score, isCorrect: g.isCorrect, extra: g.extra ?? null });
    }
  }
}
writeFileSync(OUT, gzipSync(JSON.stringify({ recordedOn: "main (before the Logic depth revision)", rounds })));
console.log(`wrote ${OUT}: ${rounds.length} rounds over ${GAMES.length} games`);
