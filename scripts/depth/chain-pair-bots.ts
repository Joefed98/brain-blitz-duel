/**
 * Depth to 200 (25 Oct 2026): bot runs for the D3 depth checks (Don't Break the Chain, Matchmaker). The repo's
 * simulated players (scripts/puzzle-fairness kits: average, good, great, near-perfect) plus an elite level, each
 * graded through the server's gradeAnswer on room seeds, on the new stamp and on the same puzzle with the new stamp
 * taken off (the previous version's scoring). Script-only: floats are fine.
 */
import { gradeAnswer } from "../../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../../src/lib/duel/types";
import { SKILLS, hashText, makeRng, type Play, type Skill } from "../puzzle-fairness/kit";
import { KITS } from "../puzzle-fairness/kits";
import { roomPuzzle } from "../puzzle-fairness/run";

/** Faster and cleaner than the kits' near-perfect player (pace 0.5, 1.5 % mistakes). */
export const ELITE: Skill = { level: "near", pace: 0.36, err: 0.004, reactionMs: 140, reactionSd: 15 };
export const BOT_LEVELS: [string, Skill][] = [["average", SKILLS.average], ["good", SKILLS.good], ["great", SKILLS.great], ["near-perfect", SKILLS.near], ["elite", ELITE]];

export interface BotScore {
  old: number;
  now: number;
  extra: Record<string, unknown> | null;
}

/** The last answer reached by the buzzer, graded as the runner does (a finish at its own time). */
export function gradePlay(puzzle: PuzzleData, play: Play): { score: number; extra: Record<string, unknown> | null; isCorrect: boolean } {
  const limit = puzzleTimeLimitMs(puzzle);
  const steps = play.steps.filter((s) => s.atMs <= limit);
  if (!steps.length) {
    const g = gradeAnswer(puzzle, KITS[puzzle.type]!.nothing(puzzle), 0);
    return { score: g.score, extra: g.extra, isCorrect: g.isCorrect };
  }
  if (play.timed) {
    const last = steps.at(-1)!;
    let g = gradeAnswer(puzzle, last.answer, Math.max(0, limit - last.atMs));
    if (!g.isCorrect) g = gradeAnswer(puzzle, last.answer, 0);
    return { score: g.score, extra: g.extra, isCorrect: g.isCorrect };
  }
  for (const step of steps) {
    const g = gradeAnswer(puzzle, step.answer, Math.max(0, limit - step.atMs));
    if (g.isCorrect) return { score: g.score, extra: g.extra, isCorrect: true };
  }
  const g = gradeAnswer(puzzle, steps.at(-1)!.answer, 0);
  return { score: g.score, extra: g.extra, isCorrect: g.isCorrect };
}

/** One level's runs: every seed's play graded on the new stamp and with `strip` applied (the old stamp). */
export function botRuns(
  type: PuzzleType,
  skill: Skill,
  level: string,
  seeds: number,
  strip: (p: PuzzleData) => PuzzleData,
  play?: (p: PuzzleData, seed: number) => Play,
): BotScore[] {
  const out: BotScore[] = [];
  for (let s = 0; s < seeds; s++) {
    const seed = 11_000 + s;
    const puzzle = roomPuzzle(type, seed);
    const p = play ? play(puzzle, seed) : KITS[type]!.play(puzzle, makeRng(hashText(`depth:${type}:${seed}:${level}`)), skill, puzzleTimeLimitMs(puzzle));
    const now = gradePlay(puzzle, p);
    const old = gradePlay(strip(puzzle), p);
    out.push({ old: old.score, now: now.score, extra: now.extra });
  }
  return out;
}

export function quantile(xs: readonly number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
}

export interface LevelRow {
  level: string;
  old: { median: number; top10: number; best: number };
  now: { median: number; top10: number; best: number };
}

export function levelRow(level: string, runs: readonly BotScore[]): LevelRow {
  const o = runs.map((r) => r.old);
  const n = runs.map((r) => r.now);
  return {
    level,
    old: { median: quantile(o, 0.5), top10: quantile(o, 0.9), best: Math.max(...o) },
    now: { median: quantile(n, 0.5), top10: quantile(n, 0.9), best: Math.max(...n) },
  };
}

export function printTable(title: string, rows: readonly LevelRow[]): void {
  console.log(`\n${title}`);
  console.log("| Bot | Old median | Old top 10 % | Old best | New median | New top 10 % | New best |");
  console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const r of rows) console.log(`| ${r.level} | ${r.old.median} | ${r.old.top10} | ${r.old.best} | ${r.now.median} | ${r.now.top10} | ${r.now.best} |`);
}
