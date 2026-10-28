/**
 * Shared by the scoring standard's checks and report (docs/scoring-standard.md): kit play (scripts/puzzle-fairness)
 * graded the way a phone sends it on a standard stamp, with the draft timeline built from the kit's own steps.
 * Script-only.
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { standardTimesParts } from "../src/lib/duel/standard/stamps";
import { TimelineRecorder } from "../src/lib/duel/standard/timeline";
import type { Graded } from "../src/lib/duel/grade";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { LEVELS, SKILLS, hashText, makeRng, type Level, type Step } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";

/** The answer a phone sends after these drafts (each at its round-clock ms): the last draft plus its timeline. */
export function sentAnswer(puzzle: PuzzleData, drafts: readonly { answer: string; atMs: number }[]): string {
  const last = drafts[drafts.length - 1];
  if (!last) return "";
  if (!standardTimesParts(puzzle)) return last.answer;
  const rec = new TimelineRecorder();
  for (const d of drafts) rec.note(d.answer, d.atMs);
  return rec.attach(last.answer);
}

export interface StandardRun {
  score: number;
  isCorrect: boolean;
  /** Seconds used (finish) or the whole clock. */
  seconds: number;
  graded: Graded;
}

/** Grades a kit play as a phone sends it: submitted the moment it solves, else its draft at the buzzer. */
export function gradeSteps(puzzle: PuzzleData, steps: readonly Step[], timed = false): StandardRun {
  const limit = puzzleTimeLimitMs(puzzle);
  const inTime = steps.filter((s) => s.atMs <= limit);
  if (inTime.length === 0) {
    const g = gradeAnswer(puzzle, "", 0);
    return { score: g.score, isCorrect: g.isCorrect, seconds: limit / 1000, graded: g };
  }
  if (timed) {
    const last = inTime[inTime.length - 1]!;
    let g = gradeAnswer(puzzle, last.answer, Math.max(0, limit - last.atMs));
    if (!g.isCorrect) g = gradeAnswer(puzzle, last.answer, 0);
    return { score: g.score, isCorrect: g.isCorrect, seconds: g.isCorrect ? last.atMs / 1000 : limit / 1000, graded: g };
  }
  for (let i = 0; i < inTime.length; i++) {
    const step = inTime[i]!;
    const g = gradeAnswer(puzzle, sentAnswer(puzzle, inTime.slice(0, i + 1)), Math.max(0, limit - step.atMs));
    if (g.isCorrect) return { score: g.score, isCorrect: true, seconds: step.atMs / 1000, graded: g };
  }
  const g = gradeAnswer(puzzle, sentAnswer(puzzle, inTime), 0);
  return { score: g.score, isCorrect: g.isCorrect, seconds: limit / 1000, graded: g };
}

export interface LevelReport {
  level: Level | "nothing" | "spam";
  scores: number[];
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
}

export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
}

/** Plays the kit on `seeds` room puzzles at every level, plus nothing and spam. */
export function kitBands(type: PuzzleType, seeds: readonly number[], deal: (seed: number) => PuzzleData = (seed) => roomPuzzle(type, seed)): LevelReport[] {
  const kit = KITS[type];
  if (!kit) throw new Error(`no kit for ${type}`);
  const out: LevelReport[] = [{ level: "nothing", scores: [] }, { level: "spam", scores: [] }, ...LEVELS.map((level) => ({ level, scores: [] as number[] }))];
  for (const seed of seeds) {
    const puzzle = deal(seed);
    const limit = puzzleTimeLimitMs(puzzle);
    out[0]!.scores.push(gradeAnswer(puzzle, kit.nothing(puzzle), 0).score);
    for (const sp of kit.spam(puzzle, makeRng(hashText(`std:${type}:spam:${seed}`)), limit)) out[1]!.scores.push(gradeAnswer(puzzle, sp.answer, 0).score);
    LEVELS.forEach((level, i) => {
      const play = kit.play(puzzle, makeRng(hashText(`std:${type}:${seed}:${level}`)), SKILLS[level], limit);
      out[2 + i]!.scores.push(gradeSteps(puzzle, play.steps, play.timed).score);
    });
  }
  return out;
}

export function bandLine(r: LevelReport): string {
  return `${r.level.padEnd(8)} median ${String(median(r.scores)).padStart(3)}  p10 ${String(quantile(r.scores, 0.1)).padStart(3)}  p90 ${String(quantile(r.scores, 0.9)).padStart(3)}`;
}
