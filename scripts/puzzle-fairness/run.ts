/**
 * Shared runner for the puzzle fairness audit: builds seeded room puzzles and
 * grades a kit's answers through the server's own gradeAnswer.
 *
 *   bun scripts/puzzle-fairness/run.ts <type> [seeds]   # quick look at one kit
 */
import { generatePuzzle, gradeAnswer } from "../../src/lib/duel/generate.server";
import { withSeededRandom } from "../../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../../src/lib/duel/types";
import { LEVELS, SKILLS, hashText, makeRng, type Level, type PuzzleKit } from "./kit";

/** The room puzzle for (type, seed), as a room started with that seed would store it. */
export function roomPuzzle(type: PuzzleType, seed: number): PuzzleData {
  return withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed }));
}

export interface GradedRun {
  score: number;
  isCorrect: boolean;
  msRemaining: number;
  answer: string;
  extra: Record<string, unknown> | null;
}

export function grade(puzzle: PuzzleData, answer: string, msRemaining: number): GradedRun {
  const g = gradeAnswer(puzzle, answer, msRemaining);
  return { score: g.score, isCorrect: g.isCorrect, msRemaining, answer, extra: g.extra };
}

/** Nothing: the empty draft submitted at the buzzer (0 ms left) and, for safety, on an instant Done (full time left). */
export function runNothing(kit: PuzzleKit, puzzle: PuzzleData): GradedRun[] {
  const limit = puzzleTimeLimitMs(puzzle);
  const answer = kit.nothing(puzzle);
  return [grade(puzzle, answer, 0), grade(puzzle, answer, limit)];
}

export function runSpam(kit: PuzzleKit, puzzle: PuzzleData, seed: number): (GradedRun & { label: string })[] {
  const limit = puzzleTimeLimitMs(puzzle);
  const rng = makeRng(hashText(`${kit.type}:spam:${seed}`));
  return kit.spam(puzzle, rng, limit).map((s) => ({ ...grade(puzzle, s.answer, 0), label: s.label }));
}

/** One simulated solver: the last answer reached by the buzzer is graded. */
export function runPlay(kit: PuzzleKit, puzzle: PuzzleData, seed: number, level: Level): GradedRun & { actions: number; unfinished: GradedRun[] } {
  const limit = puzzleTimeLimitMs(puzzle);
  const rng = makeRng(hashText(`${kit.type}:play:${seed}:${level}`));
  const play = kit.play(puzzle, rng, SKILLS[level], limit);
  const inTime = play.steps.filter((s) => s.atMs <= limit);
  if (inTime.length === 0) return { ...grade(puzzle, kit.nothing(puzzle), 0), actions: 0, unfinished: [] };
  // Timed plays (tap logs, chains, engine runs) carry their own times: the last answer reached counts,
  // submitted at its own time when it finished the round, else at the buzzer.
  if (play.timed) {
    const last = inTime[inTime.length - 1]!;
    const done = grade(puzzle, last.answer, Math.max(0, limit - last.atMs));
    const final = done.isCorrect ? done : grade(puzzle, last.answer, 0);
    const unfinished = inTime.slice(0, -1).filter((_, i, all) => all.length <= 60 || i % Math.ceil(all.length / 60) === 0)
      .map((s) => grade(puzzle, s.answer, 0)).filter((g) => !g.isCorrect);
    return { ...final, actions: inTime.length, unfinished };
  }
  // The answer is submitted the moment it solves the puzzle; otherwise the draft goes in at the buzzer.
  let final: GradedRun | null = null;
  const unfinished: GradedRun[] = [];
  for (const [i, step] of inTime.entries()) {
    const ms = Math.max(0, limit - step.atMs);
    const g = grade(puzzle, step.answer, ms);
    if (g.isCorrect) { final = { ...g }; break; }
    // Sample intermediate unfinished states (every one for short plays) for the finish-beats-unfinished rule.
    if (inTime.length <= 60 || i % Math.ceil(inTime.length / 60) === 0) unfinished.push(grade(puzzle, step.answer, 0));
  }
  if (!final) final = grade(puzzle, inTime[inTime.length - 1]!.answer, 0);
  return { ...final, actions: inTime.length, unfinished };
}

if (import.meta.main) {
  const type = process.argv[2] as PuzzleType;
  const seeds = Number(process.argv[3] ?? 5);
  const { KITS } = await import("./kits");
  const kit = KITS[type];
  if (!kit) throw new Error(`no kit for ${type}`);
  for (let s = 1; s <= seeds; s++) {
    const seed = 1000 + s;
    const puzzle = roomPuzzle(type, seed);
    const nothing = runNothing(kit, puzzle).map((g) => g.score).join("/");
    const spam = runSpam(kit, puzzle, seed).map((g) => `${g.label}=${g.score}`).join(" ");
    const plays = LEVELS.map((level) => {
      const r = runPlay(kit, puzzle, seed, level);
      return `${level}=${r.score}${r.isCorrect ? "✓" : ""}(${r.actions},${Math.round(r.msRemaining / 1000)}s)`;
    }).join(" ");
    console.log(`seed ${seed}: nothing ${nothing} | spam ${spam} | ${plays}`);
  }
}
