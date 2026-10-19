/**
 * Solver-progress grading time (a tool, not a check; docs/scoring-targets.md): grades every board the
 * puzzle-fairness kits stand on in Topsy-Turvy (gravityRev 2) and Polypotions (tubesRev 2), every level, every few
 * steps, every random strategy and doing nothing, through the server's own gradeAnswer, and prints the mean and the
 * slowest grades with each strategy's median stored progress.
 *
 *   bun scripts/solver-progress-timing.ts [seeds, default 100]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { roomPuzzle } from "./puzzle-fairness/run";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng, LEVELS } from "./puzzle-fairness/kit";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { gradeAnswer } from "../src/lib/duel/generate.server";

const N = Number(process.argv[2] ?? 100);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
for (const type of ["gravity", "tubes"] as const) {
  const times: { ms: number; seed: number; label: string }[] = [];
  const progress: Record<string, number[]> = {};
  for (let seed = 5001; seed < 5001 + N; seed++) {
    const p = roomPuzzle(type, seed);
    const limit = puzzleTimeLimitMs(p);
    const answers: [string, string][] = [];
    for (const s of KITS[type]!.spam(p, makeRng(hashText(`${type}:spam:${seed}`)), limit)) answers.push([s.label, s.answer]);
    for (const level of LEVELS) {
      const steps = KITS[type]!.play(p, makeRng(hashText(`${type}:play:${seed}:${level}`)), SKILLS[level], limit).steps.filter((s) => s.atMs <= limit);
      answers.push([level, steps.at(-1)?.answer ?? ""]);
      for (let i = 0; i < steps.length; i += 3) answers.push([`${level} (a step)`, steps[i]!.answer]);
    }
    answers.push(["nothing", ""]);
    for (const [label, answer] of answers) {
      const t0 = performance.now();
      const g = gradeAnswer(p, answer, 0);
      times.push({ ms: performance.now() - t0, seed, label });
      (progress[label] ??= []).push(Number((g.extra as any)?.progress ?? (g.isCorrect ? 100 : 0)));
    }
  }
  times.sort((a, b) => b.ms - a.ms);
  const mean = times.reduce((s, x) => s + x.ms, 0) / times.length;
  console.log(`${type}: ${times.length} grades, mean ${mean.toFixed(2)} ms; slowest ${times.slice(0, 5).map((x) => `${x.ms.toFixed(1)} ms (${x.seed} ${x.label})`).join(", ")}`);
  console.log(`  median progress: ${Object.entries(progress).filter(([k]) => !k.includes("step")).map(([k, v]) => `${k} ${median(v)}%`).join(", ")}`);
}
