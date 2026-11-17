/**
 * Records pattern-overhaul-push-check's legacy fixture (scripts/fixtures/pattern-overhaul-push-legacy.json.gz): Heave
 * puzzles as rooms deal them before the Pattern overhaul's look and help (the live stamps, and the same deals with
 * `pinPrePatternNov15(true)`, which Heave has no entry in, so they are the same puzzles), each with the fairness kit's
 * answers at every level (the last answer and one from the middle, each at its own time and at the buzzer, timelines
 * attached as the phone sends them), the empty answer and the kit's spam, graded before the overhaul's changes. Heave's
 * overhaul changes no rule or score, so the check regrades every case on the branch and fails on any difference.
 *
 *   bun scripts/pattern-overhaul-push-record.ts [--out=<path>]
 *
 * Recorded before the overhaul (15 Nov 2026); never re-record over it.
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPrePatternNov15 } from "../src/lib/duel/patternNov15";
import type { PushPuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { sentAnswer } from "./standard-lib";

export const PUSH_LEGACY_SEEDS = [8100, 8117, 8134, 8151, 8168, 8185];
export const PUSH_LEGACY_ERAS = ["live", "pinned"] as const;
export type PushEra = (typeof PUSH_LEGACY_ERAS)[number];

export interface PushLegacyCase {
  era: PushEra;
  seed: number;
  label: string;
  answer: string;
  msLeft: number;
  score: number;
  isCorrect: boolean;
  extra: unknown;
}

export function dealPushEra(era: PushEra, seed: number): PushPuzzleData {
  const before = pinPrePatternNov15(era === "pinned");
  try {
    return withSeededRandom(seed, () => generatePuzzle("push", { bankSeed: seed })) as PushPuzzleData;
  } finally {
    pinPrePatternNov15(before);
  }
}

/** The answers recorded for one puzzle (labels and times), before grading. */
export function pushAnswers(seed: number, puzzle: PushPuzzleData): { label: string; answer: string; msLeft: number }[] {
  const kit = KITS.push!;
  const limit = puzzleTimeLimitMs(puzzle);
  const out: { label: string; answer: string; msLeft: number }[] = [{ label: "nothing", answer: kit.nothing(puzzle), msLeft: 0 }];
  for (const spam of kit.spam(puzzle, makeRng(hashText(`push:overhaul:${seed}`)), limit).slice(0, 2)) {
    out.push({ label: `spam ${spam.label}`, answer: spam.answer, msLeft: 0 });
  }
  for (const level of LEVELS) {
    const play = kit.play(puzzle, makeRng(hashText(`push:overhaul:${seed}:${level}`)), SKILLS[level], limit);
    const inTime = play.steps.filter((x) => x.atMs <= limit);
    for (const [name, at] of [["middle", Math.floor(inTime.length / 2)], ["last", inTime.length - 1]] as const) {
      const step = inTime[at];
      if (!step) continue;
      const answer = sentAnswer(puzzle, inTime.slice(0, at + 1));
      out.push({ label: `${level} ${name}`, answer, msLeft: Math.max(0, limit - step.atMs) }, { label: `${level} ${name} buzzer`, answer, msLeft: 0 });
    }
  }
  return out;
}

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/pattern-overhaul-push-legacy.json.gz";
  const puzzles: { era: PushEra; seed: number; puzzle: PushPuzzleData }[] = [];
  const cases: PushLegacyCase[] = [];
  for (const era of PUSH_LEGACY_ERAS) {
    for (const seed of PUSH_LEGACY_SEEDS) {
      const puzzle = dealPushEra(era, seed);
      puzzles.push({ era, seed, puzzle });
      for (const a of pushAnswers(seed, puzzle)) {
        const g = gradeAnswer(puzzle, a.answer, a.msLeft);
        cases.push({ era, seed, ...a, score: g.score, isCorrect: g.isCorrect, extra: g.extra ?? null });
      }
    }
  }
  writeFileSync(out, gzipSync(JSON.stringify({ recordedOn: "claude/elegant-planck-2iq51e c2f49213 (15 Nov 2026), before Heave's overhaul", puzzles, cases })));
  console.log(`${cases.length} cases on ${puzzles.length} puzzles recorded to ${out}`);
}
