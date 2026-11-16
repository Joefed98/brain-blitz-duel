/**
 * Records the Normal fixture for pattern-overhaul-iceslide-levels-check (difficulty levels, 16 Nov 2026): Skid's Normal
 * deal and grades on the tree BEFORE its levels landed, so the check proves Normal is byte for byte today's deal and
 * that every stored board grades as before. Run on the tree before the change (it only uses APIs that existed then):
 *
 *   bun scripts/pattern-overhaul-iceslide-levels-record.ts [--out=<path>]
 *
 * Each deal is a room deal (seeded Math.random, the room seed as bankSeed) stored whole: today's stamps (slideRev 5)
 * and, for the first 10 seeds, the stamps before the Pattern overhaul (slideRev 4). Each deal is graded on three
 * answers: the stored shortest route at 50 s left, the route with a wasted slide and an Undo at 20 s left, and the first
 * half of the route at the buzzer (unfinished credit).
 */
import { writeFileSync } from "node:fs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData } from "../src/lib/duel/types";

export const ICESLIDE_LEVELS_NORMAL_FIXTURE = "scripts/fixtures/pattern-overhaul-iceslide-levels-normal.json";
export const ICESLIDE_LEVELS_NORMAL_SEEDS = Array.from({ length: 40 }, (_, i) => 161_000 + 53 * i);

export interface IceSlideLevelsGrade {
  answer: string;
  msRemaining: number;
  score: number;
  isCorrect: boolean;
  extra: unknown;
}
export interface IceSlideLevelsNormalFixture {
  live: { seed: number; puzzle: PuzzleData; grades: IceSlideLevelsGrade[] }[];
  prePattern: { seed: number; puzzle: PuzzleData; grades: IceSlideLevelsGrade[] }[];
}

export function iceSlideFixtureAnswers(puzzle: PuzzleData): { answer: string; msRemaining: number }[] {
  const route = (puzzle as { solution?: string }).solution ?? "";
  const wasted = route[0] === "U" ? "D" : "U";
  return [
    { answer: route, msRemaining: 50_000 },
    { answer: `${wasted}X${route}`, msRemaining: 20_000 },
    { answer: route.slice(0, Math.floor(route.length / 2)), msRemaining: 0 },
  ];
}

export function gradeAll(puzzle: PuzzleData): IceSlideLevelsGrade[] {
  return iceSlideFixtureAnswers(puzzle).map(({ answer, msRemaining }) => {
    const g = gradeAnswer(puzzle, answer, msRemaining);
    return { answer, msRemaining, score: g.score, isCorrect: g.isCorrect, extra: JSON.parse(JSON.stringify(g.extra ?? null)) };
  });
}

export function dealNormal(seed: number): PuzzleData {
  return withSeededRandom(seed, () => generatePuzzle("iceslide", { bankSeed: seed }));
}

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? ICESLIDE_LEVELS_NORMAL_FIXTURE;
  const { pinPrePatternNov15 } = await import("../src/lib/duel/patternNov15");
  const live = ICESLIDE_LEVELS_NORMAL_SEEDS.map((seed) => {
    const puzzle = dealNormal(seed);
    return { seed, puzzle, grades: gradeAll(puzzle) };
  });
  const was = pinPrePatternNov15(true);
  let prePattern: IceSlideLevelsNormalFixture["prePattern"];
  try {
    prePattern = ICESLIDE_LEVELS_NORMAL_SEEDS.slice(0, 10).map((seed) => {
      const puzzle = dealNormal(seed);
      return { seed, puzzle, grades: gradeAll(puzzle) };
    });
  } finally {
    pinPrePatternNov15(was);
  }
  writeFileSync(out, `${JSON.stringify({ live, prePattern } satisfies IceSlideLevelsNormalFixture)}\n`);
  console.log(`wrote ${live.length} + ${prePattern.length} Normal deals (3 grades each) to ${out}`);
}
