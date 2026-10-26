/**
 * Records the legacy fixture for the depth-to-200 Attention checks (25 Oct 2026; Eagle Eye scanRev 2, Double Take
 * spotRev 2, Tally countRev 3): on unmodified main, room puzzles of Eagle Eye, Double Take and Tally as main deals
 * them (scanRev 1, spotRev 1, countRev 2 on puzzleScoreRev 3), played by the fairness kits at every level, an elite
 * player and every spam strategy, each graded through the real gradeAnswer. depth-eagleeye-check,
 * depth-doubletake-check and depth-tally-check prove every run still grades to the same score, verdict and extra.
 *
 *   bun scripts/depth-attention-record.ts [--out=<file>]   # run on main (a worktree), writes the gzipped fixture
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS, SKILLS, hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";

export const DEPTH_ATTENTION_TYPES: PuzzleType[] = ["symscan", "spotdiff", "countup"];
export const ELITE: Skill = { level: "near", pace: 0.36, err: 0, reactionMs: 140, reactionSd: 12 };

export interface DepthRun {
  type: PuzzleType;
  seed: number;
  label: string;
  puzzle: PuzzleData;
  answer: string;
  ms: number;
  score: number;
  isCorrect: boolean;
  extra: Record<string, unknown> | null;
}

/** The last answer reached before the buzzer and the time left it was graded on (the fairness runner's rule). */
export function playToAnswer(type: PuzzleType, puzzle: PuzzleData, seed: number, label: string, skill: Skill): { answer: string; ms: number } {
  const kit = KITS[type]!;
  const limit = puzzleTimeLimitMs(puzzle);
  const rng = makeRng(hashText(`${type}:play:${seed}:${label}`));
  const steps = kit.play(puzzle, rng, skill, limit).steps.filter((s) => s.atMs <= limit);
  if (steps.length === 0) return { answer: kit.nothing(puzzle), ms: 0 };
  for (const s of steps) {
    const ms = Math.max(0, limit - s.atMs);
    if (gradeAnswer(puzzle, s.answer, ms).isCorrect) return { answer: s.answer, ms };
  }
  return { answer: steps[steps.length - 1]!.answer, ms: 0 };
}

export function recordRuns(seeds: number[]): DepthRun[] {
  const runs: DepthRun[] = [];
  for (const type of DEPTH_ATTENTION_TYPES) {
    const kit = KITS[type]!;
    for (const seed of seeds) {
      const puzzle = roomPuzzle(type, seed);
      const add = (label: string, answer: string, ms: number) => {
        const g = gradeAnswer(puzzle, answer, ms);
        runs.push({ type, seed, label, puzzle, answer, ms, score: g.score, isCorrect: g.isCorrect, extra: g.extra });
      };
      for (const level of LEVELS) {
        const { answer, ms } = playToAnswer(type, puzzle, seed, level, SKILLS[level]);
        add(level, answer, ms);
      }
      const elite = playToAnswer(type, puzzle, seed, "elite", ELITE);
      add("elite", elite.answer, elite.ms);
      const limit = puzzleTimeLimitMs(puzzle);
      kit.spam(puzzle, makeRng(hashText(`${type}:spam:${seed}`)), limit).forEach((s) => add(`spam:${s.label}`, s.answer, 0));
      add("nothing", kit.nothing(puzzle), 0);
    }
  }
  return runs;
}

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/depth-attention-legacy.json.gz";
  const seeds = Array.from({ length: 12 }, (_, i) => 52_000 + i * 7);
  const runs = recordRuns(seeds);
  writeFileSync(out, gzipSync(JSON.stringify(runs)));
  console.log(`depth-attention-record: ${runs.length} runs → ${out}`);
}
