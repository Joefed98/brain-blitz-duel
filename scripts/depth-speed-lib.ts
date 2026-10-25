/**
 * Shared pieces of the Depth to 200 checks for Flash, Bang On and Ascend (depth-flash-check, depth-bangon-check,
 * depth-ascend-check; docs/depth/d3-speed-attention.md): the legacy fixture (recorded on main by
 * scripts/depth-speed-record.ts), the simulated players (the puzzle-fairness kits at every level plus an elite
 * level), and the old-vs-new distribution table. Script-only.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { hashText, makeRng, SKILLS, type Skill } from "./puzzle-fairness/kit";

export interface LegacyRun {
  type: PuzzleType;
  seed: number;
  label: string;
  puzzle: PuzzleData;
  answer: string;
  ms: number;
  score: number;
  isCorrect: boolean;
  storedMs: number;
  reactionAvgMs: number | null;
  errors: number | null;
  correctCount: number | null;
  extra: Record<string, unknown> | null;
}

export function legacyRuns(type: PuzzleType): LegacyRun[] {
  const f = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/depth-speed-legacy.json.gz")).toString()) as { runs: LegacyRun[] };
  return f.runs.filter((r) => r.type === type);
}

/** Every stored legacy run grades to exactly what main stored (score, verdict, time, figures, extra). */
export function legacyMismatches(type: PuzzleType): { runs: number; bad: string[] } {
  const bad: string[] = [];
  const runs = legacyRuns(type);
  for (const r of runs) {
    const g = gradeAnswer(r.puzzle, r.answer, r.ms);
    const same =
      g.score === r.score &&
      g.isCorrect === r.isCorrect &&
      g.storedMs === r.storedMs &&
      g.reactionAvgMs === r.reactionAvgMs &&
      g.errors === r.errors &&
      g.correctCount === r.correctCount &&
      JSON.stringify(g.extra) === JSON.stringify(r.extra);
    if (!same) bad.push(`${type} ${r.label} ${r.seed}: stored ${r.score}, now ${g.score}`);
  }
  return { runs: runs.length, bad };
}

/** The kits' four levels plus "elite": clearly faster than today's 150 pace and close to error-free. */
export const DEPTH_LEVELS: Record<string, Skill> = {
  ...SKILLS,
  elite: { level: "near" as Skill["level"], pace: 0.36, err: 0.004, reactionMs: 128, reactionSd: 10 },
};

/** One kit play's answer at the buzzer for a level. */
export function playAnswer(type: PuzzleType, puzzle: PuzzleData, level: string, seed: number): string {
  const kit = (KITS as Record<string, (typeof KITS)[keyof typeof KITS]>)[type]!;
  const limit = puzzleTimeLimitMs(puzzle);
  const steps = kit.play(puzzle, makeRng(hashText(`${type}:depth-dist:${seed}:${level}`)), DEPTH_LEVELS[level]!, limit).steps.filter((s) => s.atMs <= limit);
  return steps.at(-1)?.answer ?? kit.nothing(puzzle);
}

export function spamAnswers(type: PuzzleType, puzzle: PuzzleData, seed: number): { label: string; answer: string }[] {
  const kit = (KITS as Record<string, (typeof KITS)[keyof typeof KITS]>)[type]!;
  return kit.spam(puzzle, makeRng(hashText(`${type}:depth-spam:${seed}`)), puzzleTimeLimitMs(puzzle));
}

export { roomPuzzle };

export const quantile = (xs: number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))] ?? 0;
};
export const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)] ?? 0;
};

export interface Dist {
  level: string;
  old: number[];
  now: number[];
}

/** "level: old median / top 10 % / best → new …" rows (Markdown), for the check output and the docs. */
export function distTable(rows: Dist[]): string[] {
  const out = ["| Level | Old median | Old top 10 % | Old best | New median | New top 10 % | New best |", "| --- | --- | --- | --- | --- | --- | --- |"];
  for (const r of rows) out.push(`| ${r.level} | ${median(r.old)} | ${quantile(r.old, 0.9)} | ${Math.max(...r.old)} | ${median(r.now)} | ${quantile(r.now, 0.9)} | ${Math.max(...r.now)} |`);
  return out;
}

export function makeOk() {
  const failures: string[] = [];
  let checks = 0;
  const ok = (cond: boolean, label: string) => {
    checks++;
    if (!cond) failures.push(label);
  };
  const finish = (name: string, summary: string, lines: string[]) => {
    for (const l of lines) console.log(l);
    if (failures.length) {
      console.log(`FAIL ${name}: ${failures.length} of ${checks} checks failed`);
      for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
      process.exit(1);
    }
    console.log(`PASS ${name}: ${checks} checks — ${summary}`);
  };
  return { ok, finish };
}

export const SEEDS = Array.from({ length: 80 }, (_, n) => 7301 + n * 13);
