/**
 * Records scripts/fixtures/number-depth-legacy.json.gz for number-depth-check (25 Oct 2026, depth to 200,
 * docs/depth/d2-number.md): stored rounds of the eight Number puzzles on the stamps rooms dealt before
 * `depthRev 1` (puzzleScoreRev 3, no depth stamp), each graded through the real server grader.
 *
 * Per game and seed: scoring-rev3-record's ladder (nothing … one short), the clean finish at 0 / 50 / 90 % of
 * the clock, a finish with mistakes and every spam strategy, plus every kit level's play (average, good, great,
 * near-perfect). number-depth-check regrades every entry and fails on any difference, so rounds stored before
 * the depth stamp keep their scores exactly.
 *
 *   bun scripts/number-depth-record.ts   # run on the commit before depthRev 1 only
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { PuzzleType } from "../src/lib/duel/types";
import { LEVELS } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { runPlay } from "./puzzle-fairness/run";
import { gradeEntry, recordGame, type Rev3Game } from "./scoring-rev3-record";

export const NUMBER_DEPTH_FIXTURE = "scripts/fixtures/number-depth-legacy.json.gz";
export const NUMBER_DEPTH_GAMES: PuzzleType[] = ["balance", "target", "equation", "numpyramid", "trail", "measure", "checkout", "numline"];
export const NUMBER_DEPTH_SEEDS = [7101, 7102, 7103, 7104];

if (import.meta.main) {
  const games: Rev3Game[] = [];
  for (const type of NUMBER_DEPTH_GAMES) {
    for (const seed of NUMBER_DEPTH_SEEDS) {
      const g = recordGame(type, seed);
      if (!g) {
        console.error(`${type} seed ${seed}: no clean solve (skipped)`);
        continue;
      }
      for (const level of LEVELS) {
        const r = runPlay(KITS[type]!, g.puzzle, seed, level);
        g.entries.push({ level: `kit:${level}`, answer: r.answer, ms: r.msRemaining, graded: gradeEntry(g.puzzle, r.answer, r.msRemaining) });
      }
      games.push(g);
    }
    console.error(`${type}: recorded`);
  }
  writeFileSync(NUMBER_DEPTH_FIXTURE, gzipSync(JSON.stringify({ recordedOn: "main 37aab99 (puzzleScoreRev 3, before depthRev 1)", games })));
  console.log(`${games.length} game seeds, ${games.reduce((n, g) => n + g.entries.length, 0)} entries → ${NUMBER_DEPTH_FIXTURE}`);
}
