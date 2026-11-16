/**
 * Records the legacy fixture for pattern-overhaul-flow-check (the Pattern overhaul, 15 Nov 2026): Chroma Lines as the
 * tree before the overhaul's grading work dealt and graded it, on flowRev 2 (pinned with pinPrePatternNov15) and on
 * the new flowRev 3 deal (graded, at the time of recording, exactly as flowRev 2). Each board is played by the kit at
 * every level (with its draft timeline, so the clean-lines bonus is exercised), at nothing and at random, with the
 * score the tree graded. The check regrades every entry and fails on any difference.
 *
 *   bun scripts/pattern-overhaul-flow-record.ts [--out=scripts/fixtures/pattern-overhaul-flow-legacy.json.gz]
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPrePatternNov15 } from "../src/lib/duel/patternNov15";
import type { PuzzleData } from "../src/lib/duel/types";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { sentAnswer } from "./standard-lib";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/pattern-overhaul-flow-legacy.json.gz";
const SEEDS = [9101, 9113, 9127, 9133, 9151];
const kit = KITS.flow!;
const puzzles: PuzzleData[] = [];
const cases: { p: number; answer: string; msLeft: number; score: number; correct: boolean; extra: unknown }[] = [];

function record(p: PuzzleData, seed: number, era: string): void {
  const pi = puzzles.push(p) - 1;
  const limit = puzzleTimeLimitMs(p);
  const add = (answer: string, msLeft: number) => {
    const g = gradeAnswer(p, answer, msLeft);
    cases.push({ p: pi, answer, msLeft, score: g.score, correct: g.isCorrect, extra: g.extra ?? null });
  };
  add(kit.nothing(p), 0);
  for (const s of kit.spam(p, makeRng(hashText(`pof:${era}:spam:${seed}`)), limit)) add(s.answer, 0);
  for (const level of LEVELS) {
    const play = kit.play(p, makeRng(hashText(`pof:${era}:${seed}:${level}`)), SKILLS[level], limit);
    const inTime = play.steps.filter((s) => s.atMs <= limit);
    if (!inTime.length) continue;
    // The full run as sent at its last draft, and a cut-short run at the buzzer.
    const last = inTime[inTime.length - 1]!;
    add(sentAnswer(p, inTime), Math.max(0, limit - last.atMs));
    const half = inTime.slice(0, Math.max(1, Math.floor(inTime.length / 2)));
    add(sentAnswer(p, half), 0);
  }
}

for (const seed of SEEDS) {
  const before = pinPrePatternNov15(true);
  try {
    record(roomPuzzle("flow", seed), seed, "rev2");
  } finally {
    pinPrePatternNov15(before);
  }
  record(roomPuzzle("flow", seed), seed, "rev3");
}
writeFileSync(out, gzipSync(JSON.stringify({ recorded: "the Pattern overhaul branch before Chroma Lines' grading changed (15 Nov 2026)", puzzles, cases })));
console.log(`wrote ${out}: ${puzzles.length} puzzles, ${cases.length} cases`);
console.log("stamps", puzzles.map((p) => (p as { flowRev?: number }).flowRev).join(","));
