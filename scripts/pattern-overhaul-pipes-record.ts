/**
 * Records the legacy fixture for pattern-overhaul-pipes-check (15 Nov 2026, the Pattern overhaul; patternNov15.ts):
 * Pipeline on pipesRev 3 and 4 (the stamps before pipesRev 5's two-way turns), graded by the tree before the change.
 * Run it before changing Pipeline's grading (it only uses APIs that existed then):
 *
 *   bun scripts/pattern-overhaul-pipes-record.ts [--out=<path>]
 *
 * Each puzzle is a room deal (seeded) dealt with `pinPrePatternNov15(true)` and restamped to each older stamp; each case
 * is a real tap log (kit play at four levels cut at a quarter, half, three quarters and the end, the kit's spam and
 * nothing) plus logs carrying pipesRev 5's anticlockwise taps ("-12"), which the older stamps must keep ignoring,
 * graded at three times left. The whole grade is stored (score, verdict, stored ms, extra).
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { pinPrePatternNov15 } from "../src/lib/duel/patternNov15";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { pipesTapAnswers } from "./speed-pipes-nov7-record";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

export const PIPES_OVERHAUL_FIXTURE = "scripts/fixtures/pattern-overhaul-pipes-legacy.json.gz";

export interface PipesOverhaulCase {
  p: number;
  answer: string;
  msLeft: number;
  score: number;
  correct: boolean;
  storedMs: number | null;
  extra: unknown;
}
export interface PipesOverhaulFixture {
  puzzles: PuzzleData[];
  cases: PipesOverhaulCase[];
}

type Of<T extends PuzzleType> = Extract<PuzzleData, { type: T }>;

export const PIPES_OVERHAUL_SEEDS = [151_101, 151_133, 151_177, 151_209];
const LEVELS = ["average", "good", "great", "near"] as const;

/** A log with every third tap written as pipesRev 5's anticlockwise form ("-cell"). */
export function withAnticlockwise(answer: string): string {
  const at = answer.indexOf("~");
  if (at < 0) return answer;
  const taps = answer.slice(at + 1).split(",").filter(Boolean);
  return `${answer.slice(0, at)}~${taps.map((t, i) => (i % 3 === 2 ? `-${t}` : t)).join(",")}`;
}

/** The kit's play for one seed as tap logs (shared with the check, which plays the same logs on pipesRev 5). */
export function pipesOverhaulAnswers(dealt: Of<"pipes">, seed: number): string[] {
  const limit = puzzleTimeLimitMs(dealt);
  const kit = KITS.pipes!;
  const answers: string[] = [];
  for (const level of LEVELS) {
    const steps = kit.play(dealt, makeRng(hashText(`pipes15:${seed}:${level}`)), SKILLS[level], limit).steps.map((s) => s.answer);
    const taps = pipesTapAnswers(dealt, steps);
    answers.push(...[0.25, 0.5, 0.75, 1].map((c) => taps[Math.max(0, Math.ceil(taps.length * c) - 1)]!));
  }
  const spam = kit.spam(dealt, makeRng(hashText(`pipes15:${seed}:spam`)), limit).map((s) => s.answer);
  answers.push(...spam.map((a) => pipesTapAnswers(dealt, [a])[0]!));
  answers.push(...answers.slice(0, 8).map(withAnticlockwise));
  answers.push(kit.nothing(dealt), "");
  return [...new Set(answers)];
}

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? PIPES_OVERHAUL_FIXTURE;
  const puzzles: PuzzleData[] = [];
  const cases: PipesOverhaulCase[] = [];
  const was = pinPrePatternNov15(true);
  try {
    for (const seed of PIPES_OVERHAUL_SEEDS) {
      const dealt = withSeededRandom(seed, () => generatePuzzle("pipes", { bankSeed: seed })) as Of<"pipes">;
      const limit = puzzleTimeLimitMs(dealt);
      const answers = pipesOverhaulAnswers(dealt, seed);
      for (const rev of [3, 4]) {
        const p = { ...dealt, pipesRev: rev } as PuzzleData;
        const index = puzzles.length;
        puzzles.push(p);
        for (const answer of answers) {
          for (const msLeft of [0, Math.round(limit * 0.4), limit - 5_000]) {
            const g = gradeAnswer(p, answer, msLeft);
            cases.push({ p: index, answer, msLeft, score: g.score, correct: g.isCorrect, storedMs: g.storedMs ?? null, extra: g.extra ?? null });
          }
        }
      }
    }
  } finally {
    pinPrePatternNov15(was);
  }
  writeFileSync(out, gzipSync(JSON.stringify({ puzzles, cases } satisfies PipesOverhaulFixture)));
  console.log(`${puzzles.length} puzzles, ${cases.length} cases → ${out}`);
}
