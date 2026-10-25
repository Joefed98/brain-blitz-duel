/**
 * Records scripts/fixtures/number-depth-rev1.json.gz for number-depth-check (25 Oct 2026, docs/depth/d2-number.md
 * "depthRev 2"): rounds of Exact, Brimful and Checkout dealt on `depthRev 1` (the feature paid in full at the fast
 * share), each graded through the real server grader on the commit before depthRev 2.
 *
 * Per game and seed: scoring-rev3-record's ladder (nothing … one short, clean finishes at 0 / 50 / 90 %, mistakes,
 * spam), every kit level's play, and the feature and plain answers (Exact's five- and six-number answers,
 * Brimful's par and kit solves, Checkout's stored and ordinary routes) at every 10 % of the clock. The graded
 * record keeps the score, verdict, breakdown, progress and the depth figures. number-depth-check regrades every
 * entry and fails on any difference, so rounds stored on depthRev 1 keep their scores exactly.
 *
 *   bun scripts/number-depth-rev1-record.ts   # run on the commit before depthRev 2 only
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { encodeCheckoutDarts, joinCheckoutRound, searchCheckout } from "../src/lib/duel/checkout";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { encodeSteps, solveWithAllSixTiles } from "../src/lib/duel/target";
import type { CheckoutPuzzleData, PuzzleData, PuzzleType, TargetNumberPuzzleData } from "../src/lib/duel/types";
import { LEVELS, hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { runPlay } from "./puzzle-fairness/run";
import { recordGame } from "./scoring-rev3-record";

export const NUMBER_DEPTH_REV1_FIXTURE = "scripts/fixtures/number-depth-rev1.json.gz";
export const NUMBER_DEPTH_REV1_GAMES: PuzzleType[] = ["target", "measure", "checkout"];
export const NUMBER_DEPTH_REV1_SEEDS = [7201, 7202, 7203, 7204, 7205, 7206];

export interface Rev1Graded {
  score: number;
  isCorrect: boolean;
  parts: unknown;
  progress: number | null;
  depth: unknown;
}
export interface Rev1Entry {
  level: string;
  answer: string;
  ms: number;
  graded: Rev1Graded;
}
export interface Rev1Game {
  type: PuzzleType;
  seed: number;
  puzzle: PuzzleData;
  entries: Rev1Entry[];
}

export function gradeRev1Entry(puzzle: PuzzleData, answer: string, ms: number): Rev1Graded {
  const g = gradeAnswer(puzzle, answer, ms);
  const extra = (g.extra ?? {}) as Record<string, unknown>;
  return {
    score: g.score,
    isCorrect: g.isCorrect,
    parts: extra["parts"] ?? null,
    progress: typeof extra["progressShare"] === "number" ? extra["progressShare"] : null,
    depth: extra["depth"] ?? null,
  };
}

/** The feature and plain answers each game is graded on at every 10 % of the clock. */
function featureAnswers(puzzle: PuzzleData, seed: number): [string, string][] {
  const out: [string, string][] = [];
  const limit = puzzleTimeLimitMs(puzzle);
  if (puzzle.type === "target") {
    const p = puzzle as TargetNumberPuzzleData;
    out.push(["five", encodeSteps(p.solution)]);
    const six = solveWithAllSixTiles(p.tiles, p.target);
    if (six) out.push(["six", encodeSteps(six)]);
  } else if (puzzle.type === "checkout") {
    const p = puzzle as CheckoutPuzzleData;
    if (p.routes?.length) out.push(["stored", joinCheckoutRound(p.routes)]);
    out.push(["ordinary", joinCheckoutRound(p.stages.map((s) => encodeCheckoutDarts(searchCheckout({ ...s, bigFinish: false }).route ?? [])))]);
  } else {
    const kit = KITS[puzzle.type]!;
    for (const [label, err] of [["par", 0], ["slips", 0.15]] as const) {
      const play = kit.play(puzzle, makeRng(hashText(`${puzzle.type}:rev1:${seed}:${label}`)), { level: "near", pace: 0.4, err, reactionMs: 160, reactionSd: 20 }, limit * 4);
      const final = play.steps.find((s) => gradeAnswer(puzzle, s.answer, limit / 2).isCorrect);
      if (final) out.push([label, final.answer]);
    }
  }
  return out;
}

if (import.meta.main) {
  const games: Rev1Game[] = [];
  for (const type of NUMBER_DEPTH_REV1_GAMES) {
    for (const seed of NUMBER_DEPTH_REV1_SEEDS) {
      const g = recordGame(type, seed);
      if (!g) {
        console.error(`${type} seed ${seed}: no clean solve (skipped)`);
        continue;
      }
      const puzzle = g.puzzle;
      if ((puzzle as { depthRev?: number }).depthRev !== 1) throw new Error(`${type} ${seed}: not dealt on depthRev 1 (run on the commit before depthRev 2)`);
      const limit = puzzleTimeLimitMs(puzzle);
      const entries: Rev1Entry[] = g.entries.map((e) => ({ level: e.level, answer: e.answer, ms: e.ms, graded: gradeRev1Entry(puzzle, e.answer, e.ms) }));
      for (const level of LEVELS) {
        const r = runPlay(KITS[type]!, puzzle, seed, level);
        entries.push({ level: `kit:${level}`, answer: r.answer, ms: r.msRemaining, graded: gradeRev1Entry(puzzle, r.answer, r.msRemaining) });
      }
      for (const [label, answer] of featureAnswers(puzzle, seed))
        for (let k = 0; k <= 10; k++) {
          const ms = Math.round((limit * k) / 10);
          entries.push({ level: `${label}:t${k * 10}`, answer, ms, graded: gradeRev1Entry(puzzle, answer, ms) });
        }
      games.push({ type, seed, puzzle, entries });
    }
    console.error(`${type}: recorded`);
  }
  writeFileSync(NUMBER_DEPTH_REV1_FIXTURE, gzipSync(JSON.stringify({ recordedOn: "main dcd0298 (depthRev 1, before depthRev 2)", games })));
  console.log(`${games.length} game seeds, ${games.reduce((n, g) => n + g.entries.length, 0)} entries → ${NUMBER_DEPTH_REV1_FIXTURE}`);
}
