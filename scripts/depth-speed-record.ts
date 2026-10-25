/**
 * Records the Depth to 200 legacy fixture for Flash, Bang On and Ascend (25 Oct 2026, docs/depth/d3-speed-attention.md):
 * room puzzles as rooms dealt them before the depth revision (Flash and Bang On tapRev 4, Ascend tapRev 1 on
 * puzzleScoreRev 3), each played by the puzzle-fairness kits at every level plus their spam, with the stored puzzle,
 * answer and the full grade. Run on unmodified main (a worktree), never on the branch:
 *
 *   bun scripts/depth-speed-record.ts <out.json.gz>
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleType } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { hashText, makeRng, SKILLS } from "./puzzle-fairness/kit";

const out = process.argv[2] ?? "scripts/fixtures/depth-speed-legacy.json.gz";
const GAMES: PuzzleType[] = ["reaction", "stopwatch", "numhunt"];
const SEEDS = Array.from({ length: 20 }, (_, n) => 4401 + n * 11);
const runs: unknown[] = [];
for (const type of GAMES) {
  const kit = (KITS as Record<string, (typeof KITS)[keyof typeof KITS]>)[type]!;
  for (const seed of SEEDS) {
    const puzzle = roomPuzzle(type, seed);
    const limit = puzzleTimeLimitMs(puzzle);
    const answers: [string, string][] = Object.entries(SKILLS).map(([lv, skill]) => {
      const steps = kit.play(puzzle, makeRng(hashText(`${type}:depth:${seed}:${lv}`)), skill, limit).steps.filter((s) => s.atMs <= limit);
      return [lv, steps.at(-1)?.answer ?? kit.nothing(puzzle)];
    });
    for (const s of kit.spam(puzzle, makeRng(hashText(`${type}:depth-spam:${seed}`)), limit)) answers.push([`spam:${s.label}`, s.answer]);
    for (const [label, answer] of answers) {
      // Finished Ascend runs claim the time left their last tap allows (as the phone does); the others send 0.
      const ms = type === "numhunt" ? 60_000 : 0;
      const g = gradeAnswer(puzzle, answer, ms);
      runs.push({ type, seed, label, puzzle, answer, ms, score: g.score, isCorrect: g.isCorrect, storedMs: g.storedMs, reactionAvgMs: g.reactionAvgMs, errors: g.errors, correctCount: g.correctCount, extra: g.extra });
    }
  }
}
writeFileSync(out, gzipSync(JSON.stringify({ recordedOn: "main 37aab99, 25 Oct 2026 (before Depth to 200)", runs })));
console.log(`recorded ${runs.length} runs → ${out}`);
