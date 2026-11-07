/**
 * Records the legacy fixture for word-nov7-check (7 Nov 2026, docs/word-scoring-nov-2026.md): Interlock on
 * tileGridRev 3, Slider on wordSlideRev 3 and 4 and Lookout on wordSearchRev 4 (the stamps rooms dealt before the
 * fix), dealt and graded by unmodified main. Run it in a checkout of main (it only uses APIs main has):
 *
 *   bun scripts/word-nov7-record.ts --out=<path>/scripts/fixtures/word-nov7-legacy.json.gz
 *
 * Each case is a real answer as a phone sends it (every prefix of kit play at three levels, with its draft timeline,
 * and the kit's spam) graded at three times left.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPrePuzzleNotes } from "../src/lib/duel/puzzleNotes";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import { sentAnswer } from "./standard-lib";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/word-nov7-legacy.json.gz";
const puzzles: PuzzleData[] = [];
const cases: { p: number; answer: string; msLeft: number; score: number; correct: boolean; parts: unknown }[] = [];

function add(p: PuzzleData, answers: string[]): void {
  const index = puzzles.length;
  puzzles.push(p);
  const limit = puzzleTimeLimitMs(p);
  for (const answer of new Set(answers)) {
    for (const msLeft of [0, Math.round(limit * 0.4), limit - 8_000]) {
      const g = gradeAnswer(p, answer, msLeft);
      cases.push({ p: index, answer, msLeft, score: g.score, correct: g.isCorrect, parts: (g.extra as Record<string, unknown> | undefined)?.["parts"] ?? null });
    }
  }
}

function record(type: PuzzleType, seeds: readonly number[]): void {
  const kit = KITS[type]!;
  for (const seed of seeds) {
    const p = roomPuzzle(type, seed);
    const limit = puzzleTimeLimitMs(p);
    const answers: string[] = [];
    for (const level of ["average", "good", "near"] as const) {
      const steps = kit.play(p, makeRng(hashText(`rec7:${type}:${seed}:${level}`)), SKILLS[level], limit).steps.map((s) => ({ answer: s.answer, atMs: s.atMs }));
      for (let i = 1; i <= steps.length; i++) answers.push(sentAnswer(p, steps.slice(0, i)));
      for (let i = 1; i <= steps.length; i++) answers.push(steps[i - 1]!.answer);
    }
    answers.push(...kit.spam(p, makeRng(hashText(`rec7:${type}:${seed}:spam`)), limit).map((s) => s.answer));
    add(p, answers);
  }
}

const SEEDS = [7_001, 7_019, 7_043, 7_081, 7_127, 7_217];
record("tilegrid", SEEDS);
record("wordsearch", SEEDS);
record("wordslide", SEEDS);
// Slider's standard stamp before Joe's puzzle notes (wordSlideRev 3).
const prev = pinPrePuzzleNotes(true);
try {
  record("wordslide", SEEDS.slice(0, 3));
} finally {
  pinPrePuzzleNotes(prev);
}
const stamps = puzzles.map((p) => `${p.type}:${(p as unknown as Record<string, unknown>)["tileGridRev"] ?? (p as unknown as Record<string, unknown>)["wordSlideRev"] ?? (p as unknown as Record<string, unknown>)["wordSearchRev"]}`);
writeFileSync(out, gzipSync(JSON.stringify({ puzzles, cases })));
console.log(`${puzzles.length} puzzles (${[...new Set(stamps)].join(", ")}), ${cases.length} cases → ${out}`);
