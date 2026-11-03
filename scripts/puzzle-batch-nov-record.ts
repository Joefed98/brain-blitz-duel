/**
 * Records the legacy fixture for puzzle-batch-nov-check (the puzzle batch of 3 Nov 2026, parMoves.ts): Labyrinth,
 * Topsy-Turvy and Skid as main dealt them before the batch (the scoring standard's mazeRev 3, gravityRev 5, slideRev 2),
 * each played weak to flawless and at random, with the score main graded. Run on a main checkout from before the
 * batch (the check regrades every entry on today's tree and fails on any difference):
 *
 *   bun scripts/puzzle-batch-nov-record.ts [--out=scripts/fixtures/puzzle-batch-nov-legacy.json.gz]
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { BATCH_LEVELS, BATCH_TYPES, dealBatch, flawlessSolve, playBatch, spamBatch } from "./puzzle-batch-nov/players";
import { gradeSteps, sentAnswer } from "./standard-lib";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/puzzle-batch-nov-legacy.json.gz";
// On today's tree, pin the batch off so the recorder deals the standard's stamps (main has no parMoves.ts).
const batch = await import("../src/lib/duel/parMoves").catch(() => null);
batch?.pinPreParMoves(true);

const SEEDS = Array.from({ length: 6 }, (_, i) => 7300 + i * 11);
const puzzles: unknown[] = [];
const cases: { p: number; answer: string; msLeft: number; score: number; correct: boolean; parts: unknown }[] = [];
for (const type of BATCH_TYPES) {
  for (const seed of SEEDS) {
    const p = dealBatch(type, seed);
    const pi = puzzles.push(p) - 1;
    const add = (answer: string, msLeft: number) => {
      const g = gradeAnswer(p, answer, msLeft);
      cases.push({ p: pi, answer, msLeft, score: g.score, correct: g.isCorrect, parts: (g.extra as Record<string, unknown> | undefined)?.["parts"] ?? null });
    };
    const limit = puzzleTimeLimitMs(p);
    for (const level of BATCH_LEVELS) {
      const play = playBatch(type, p, level, seed);
      const run = gradeSteps(p, play.steps, play.timed);
      const inTime = play.steps.filter((s) => s.atMs <= limit);
      const end = run.isCorrect ? inTime.findIndex((s) => Math.abs(s.atMs / 1000 - run.seconds) < 1e-9) : inTime.length - 1;
      const upTo = inTime.slice(0, end + 1);
      if (upTo.length) add(sentAnswer(p, upTo), run.isCorrect ? Math.max(0, limit - upTo[upTo.length - 1]!.atMs) : 0);
    }
    for (const s of spamBatch(type, p, seed)) add(s.answer, s.msLeft);
    const flawless = flawlessSolve(type, p);
    if (flawless) add(flawless.answer, flawless.msLeft);
  }
}
writeFileSync(out, gzipSync(JSON.stringify({ recorded: "main before the puzzle batch of 3 Nov 2026", puzzles, cases })));
console.log(`wrote ${out}: ${puzzles.length} puzzles, ${cases.length} cases`);
