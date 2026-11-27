/**
 * Records D3's Attention legacy fixture (scripts/fixtures/d3-attention-legacy.json.gz), run once on the code before D3
 * (main 3025ef03 plus D3's ladder tool, which changes no game): for each of the six Attention games at every level
 * (Normal included), 12 deals as rooms deal them today, each graded with four answers (nothing, and the puzzle-fairness
 * kits' average, great and near-perfect runs) through the server's grader, with the score, the finish and the stored
 * extra. d3-attention-ladder-check regrades every case and fails on any difference, so every round dealt before D3 (the
 * Normal deals on mazeRev 5, and the level deals with no `levelRev`) grades exactly as it did.
 *
 *   bun scripts/d3-attention-legacy-record.ts          (refuses to overwrite an existing fixture)
 */
import { existsSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { asPhoneSends } from "./standard-lib";
import { dealAt } from "./level-tune";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData } from "../src/lib/duel/types";

export const D3_ATTENTION_LEGACY = "scripts/fixtures/d3-attention-legacy.json.gz";
const GAMES = ["symscan", "spotdiff", "countup", "maze", "bomb", "pairmatch"] as const;
const LEVELS = ["easy", "normal", "hard", "expert"] as const;
const DEALS = 12;

export interface LegacyCase {
  deal: number;
  answer: string;
  msRemaining: number;
  score: number;
  isCorrect: boolean;
  extra: string;
}
export interface LegacyDeal {
  game: string;
  level: string;
  n: number;
  puzzle: PuzzleData;
}

/** The last answer reached before the buzzer and the ms left at it (the round runner's rule). */
function lastInTime(p: PuzzleData, steps: { answer: string; atMs: number }[]): { answer: string; msRemaining: number } {
  const limit = puzzleTimeLimitMs(p);
  const inTime = steps.filter((s) => s.atMs <= limit);
  const last = inTime[inTime.length - 1];
  return last ? { answer: last.answer, msRemaining: Math.max(0, Math.round(limit - last.atMs)) } : { answer: "", msRemaining: 0 };
}

if (import.meta.main) {
  if (existsSync(D3_ATTENTION_LEGACY)) {
    console.log(`refusing: ${D3_ATTENTION_LEGACY} exists (it is recorded once, on the code before D3)`);
    process.exit(1);
  }
  const deals: LegacyDeal[] = [];
  const cases: LegacyCase[] = [];
  for (const game of GAMES) {
    for (const level of LEVELS) {
      for (let n = 0; n < DEALS; n++) {
        const puzzle = dealAt(game, level, 9_000 + n);
        const index = deals.length;
        deals.push({ game, level, n: 9_000 + n, puzzle });
        const answers: { answer: string; msRemaining: number }[] = [{ answer: KITS[game]!.nothing(puzzle), msRemaining: 0 }];
        for (const skill of [SKILLS.average, SKILLS.great, SKILLS.near]) {
          const play = KITS[game]!.play(puzzle, makeRng(hashText(`d3-legacy:${game}:${level}:${n}:${skill.level}`)), skill, puzzleTimeLimitMs(puzzle));
          answers.push(lastInTime(puzzle, asPhoneSends(puzzle, play.steps)));
        }
        for (const a of answers) {
          const g = gradeAnswer(puzzle, a.answer, a.msRemaining);
          cases.push({ deal: index, answer: a.answer, msRemaining: a.msRemaining, score: g.score, isCorrect: g.isCorrect, extra: JSON.stringify(g.extra ?? null) });
        }
      }
    }
  }
  writeFileSync(D3_ATTENTION_LEGACY, gzipSync(JSON.stringify({ deals, cases })));
  console.log(`wrote ${D3_ATTENTION_LEGACY}: ${deals.length} deals, ${cases.length} graded answers`);
}
