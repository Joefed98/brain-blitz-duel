/**
 * Shared by the Word levels checks (the Word overhaul, stage 3, 15 Nov 2026): deals at a level as rooms deal them and the
 * near-perfect kit's play graded through the server's own grade. Script-only.
 */
import assert from "node:assert/strict";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { MAX_ROUND_CLOCK_MS, type Level } from "../src/lib/levels/levels";
import { SCORE_JARGON } from "../src/lib/duel/scoreList";
import { SKILLS, hashText, makeRng, type Level as KitLevel } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { asPhoneSends, gradeSteps } from "./standard-lib";

export const ASKED: readonly Level[] = ["easy", "normal", "hard", "expert"];

/** The room deal for (type, level, seed): what a room started with that seed would store. */
export function dealLevel(type: PuzzleType, level: Level | null, seed: number): PuzzleData {
  return withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed, ...(level ? { level } : {}) }));
}

/** Seeds spread like rooms' (a fixed list, so the check is the same every run). */
export function seedsFrom(from: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => (from + i * 7919) >>> 0);
}

/** One kit play graded as the phone sends it. */
export function kitScore(type: PuzzleType, puzzle: PuzzleData, seed: number, level: KitLevel = "near"): { score: number; isCorrect: boolean } {
  const kit = KITS[type];
  if (!kit) throw new Error(`no kit for ${type}`);
  const play = kit.play(puzzle, makeRng(hashText(`word-levels:${type}:${seed}:${level}`)), SKILLS[level], puzzleTimeLimitMs(puzzle));
  const run = gradeSteps(puzzle, asPhoneSends(puzzle, play.steps), play.timed);
  return { score: run.score, isCorrect: run.isCorrect };
}

export const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export class Tally {
  checks = 0;
  ok(cond: unknown, message: string): void {
    assert.ok(cond, message);
    this.checks++;
  }
}

/** A level's ABOUT line: one plain short sentence, no scoring jargon, naming the level's own clock when it changes it. */
export function aboutLineOk(line: string | undefined, clockMs: number): string | null {
  if (!line) return "missing";
  if (line.length > 90) return "longer than 90 characters";
  if (!/^[A-Z].*\.$/.test(line)) return "not one sentence";
  for (const re of SCORE_JARGON) if (re.test(line)) return `jargon (${re})`;
  if (clockMs !== 100_000 && !line.includes(`${clockMs / 1000} seconds`)) return `does not say ${clockMs / 1000} seconds`;
  return null;
}

export { MAX_ROUND_CLOCK_MS };
