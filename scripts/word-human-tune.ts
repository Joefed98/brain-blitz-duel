/**
 * Measures the open word finds (Nucleus, Forage, Roundabout) with the length-aware people under the human limits
 * (word-human.ts, word-human-games.ts) and the repo's kits, on real deals at each level, graded by the server. A tool,
 * not a check (D1, 21 Nov 2026).
 *
 *   bun scripts/word-human-tune.ts <wordsmith|wordhunt|letterwheel> [--level=all] [--seeds=24] [--runs=3] [--from=0] [--kits]
 *
 * Prints, per level, each person's mean and median score, finish rate, best, how often 200 was reached, and (with
 * --kits) the puzzle-fairness kits' average / good / near-perfect medians.
 */
import { LEVELS, type Level } from "../src/lib/levels/levels";
import type { PuzzleType } from "../src/lib/duel/types";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { dealAt } from "./level-tune";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { asPhoneSends, gradeSteps } from "./standard-lib";
import { KIT_ELITE, limitSteps, PERSON_LEVELS, personRng, type PersonLevel } from "./word-human";
import { lwDecodeLog } from "../src/lib/duel/letterWheel";
import { gradeOpenRun, playOpen } from "./word-human-games";
import { personLine } from "./word-human-solvers";

export interface PersonRow {
  level: Level;
  person: PersonLevel | "kit-average" | "kit-good" | "kit-near" | "kit-elite" | "line";
  mean: number;
  median: number;
  finish: number;
  best: number;
  at200: number;
  runs: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : 0;
};

function summarise(level: Level, person: PersonRow["person"], runs: { score: number; ok: boolean }[]): PersonRow {
  const scores = runs.map((r) => r.score);
  return {
    level,
    person,
    mean: Math.round(avg(scores) * 10) / 10,
    median: med(scores),
    finish: runs.length ? runs.filter((r) => r.ok).length / runs.length : 0,
    best: Math.max(0, ...scores),
    at200: scores.filter((s) => s >= 200).length,
    runs: runs.length,
  };
}

/** Roundabout: the letters of every trace a step added to the log. */
export function wheelTapsAdded(prev: string, next: string): number {
  return lwDecodeLog(next).slice(lwDecodeLog(prev).length).reduce((sum, w) => sum + w.length, 0);
}

export const OPEN_TYPES: readonly PuzzleType[] = ["wordsmith", "wordhunt", "letterwheel"];
export const WORD_TYPES: readonly PuzzleType[] = ["wordsmith", "tilegrid", "wordslide", "wordhunt", "wordsearch", "letterwheel", "strikeout", "codeword", "swapword"];

export function measureOpen(type: PuzzleType, level: Level, ns: readonly number[], runs = 3, kits = false, people: readonly PersonLevel[] = PERSON_LEVELS): PersonRow[] {
  const out: PersonRow[] = [];
  const by: Record<string, { score: number; ok: boolean }[]> = {};
  const open = OPEN_TYPES.includes(type);
  for (const n of ns) {
    const puzzle = dealAt(type, level, n);
    if (!open) {
      const line = personLine(puzzle);
      if (line) (by["line"] ??= []).push({ score: line.score, ok: line.finished });
    }
    if (open) for (const person of people)
      for (let r = 0; r < runs; r++) {
        const run = gradeOpenRun(puzzle, playOpen(puzzle, person, personRng(type, level, n, person, r)));
        (by[person] ??= []).push({ score: run.score, ok: run.isCorrect });
      }
    if (kits) {
      const kit = KITS[type]!;
      const limit = puzzleTimeLimitMs(puzzle);
      for (const k of ["average", "good", "near", "elite"] as const) {
        const skill = k === "elite" ? KIT_ELITE : SKILLS[k];
        const play = kit.play(puzzle, makeRng(hashText(`level-tune:${type}:${level}:${n}:${k}`)), skill, limit);
        const steps = type === "letterwheel" ? limitSteps(play.steps, wheelTapsAdded) : k === "elite" ? limitSteps(play.steps, () => 1) : play.steps;
        const run = gradeSteps(puzzle, asPhoneSends(puzzle, steps), play.timed);
        (by[`kit-${k}`] ??= []).push({ score: run.score, ok: run.isCorrect });
      }
    }
  }
  for (const [person, rs] of Object.entries(by)) out.push(summarise(level, person as PersonRow["person"], rs));
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const type = args.find((a) => !a.startsWith("--")) as PuzzleType | undefined;
  if (!type || !WORD_TYPES.includes(type)) {
    console.error("usage: bun scripts/word-human-tune.ts <word game> [--level=all] [--seeds=24] [--runs=3] [--from=0] [--kits]");
    process.exit(2);
  }
  const opt = (name: string, d: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? d;
  const levelArg = opt("level", "all");
  const levels = (levelArg === "all" ? LEVELS : [levelArg]) as Level[];
  const seeds = Number(opt("seeds", "24"));
  const from = Number(opt("from", "0"));
  const runs = Number(opt("runs", "3"));
  const ns = Array.from({ length: seeds }, (_, i) => from + i);
  console.log(`${type}: ${seeds} deals a level from ${from}, ${runs} runs a person, human limits (0.25 s react, 0.15 s a move)`);
  console.log("level   person        mean  median  finish  best  200s");
  for (const level of levels)
    for (const r of measureOpen(type, level, ns, runs, args.includes("--kits") || !OPEN_TYPES.includes(type)))
      console.log(
        `${r.level.padEnd(7)} ${r.person.padEnd(12)} ${r.mean.toFixed(1).padStart(6)} ${String(r.median).padStart(6)} ${(r.finish * 100).toFixed(0).padStart(5)}% ${String(r.best).padStart(5)} ${String(r.at200).padStart(3)}/${r.runs}`,
      );
}
