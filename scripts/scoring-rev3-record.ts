/**
 * Records scripts/fixtures/scoring-rev3-runs.json.gz for scoring-rev3-check (20 Oct 2026, puzzleScoreRev 3).
 *
 * For every helper game (puzzleScoreRev3.ts) on three room seeds, the puzzle-fairness kits' answers at fixed
 * levels, each graded through the real server grader on the stamps rooms deal today:
 *   - a clean solve's ladder: nothing, every action up to one short (unfinished, the clock run out);
 *   - the clean finish with 0 / 50 / 90 % of the clock left (tap and action logs: the replayed solve whose
 *     pace finishes nearest each level, with the time it left);
 *   - a finish with mistakes (kit slip rate 15 %) at half the clock;
 *   - every kit spam strategy at the buzzer.
 * Each entry keeps the answer, the time left and the grade (score, isCorrect, breakdown, progress share), so the
 * check can prove later code grades them identically, and states the pass marks on real answers.
 *
 *   bun scripts/scoring-rev3-record.ts      # rewrites the fixture (only when the helper changes on purpose)
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { REV3_GAMES } from "../src/lib/duel/puzzleScoreRev3";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";

export const REV3_FIXTURE = "scripts/fixtures/scoring-rev3-runs.json.gz";
export const REV3_SEEDS = [9001, 9008, 9015];

export interface Rev3Entry {
  /** "ladder:k" (k actions of the clean solve, unfinished), "one-short", "t0" / "t50" / "t90", "mistakes", "spam:<label>". */
  level: string;
  answer: string;
  ms: number;
  graded: { score: number; isCorrect: boolean; parts: unknown; progress: number | null };
}
export interface Rev3Game {
  type: PuzzleType;
  seed: number;
  puzzle: PuzzleData;
  /** Actions in the clean solve (the ladder's length + 1). */
  actions: number;
  entries: Rev3Entry[];
}

const clean = (pace: number, err = 0): Skill => ({ level: "near", pace, err, reactionMs: 160, reactionSd: 20 });

export function gradeEntry(puzzle: PuzzleData, answer: string, ms: number): Rev3Entry["graded"] {
  const g = gradeAnswer(puzzle, answer, ms);
  const extra = (g.extra ?? {}) as Record<string, unknown>;
  return { score: g.score, isCorrect: g.isCorrect, parts: extra.parts ?? null, progress: typeof extra.progressShare === "number" ? extra.progressShare : null };
}

export function recordGame(type: PuzzleType, seed: number): Rev3Game | null {
  const kit = KITS[type];
  if (!kit) return null;
  const puzzle = roomPuzzle(type, seed);
  const limit = puzzleTimeLimitMs(puzzle);
  const entries: Rev3Entry[] = [];
  const add = (level: string, answer: string, ms: number) => entries.push({ level, answer, ms, graded: gradeEntry(puzzle, answer, ms) });
  const play = kit.play(puzzle, makeRng(hashText(`${type}:clean:${seed}`)), clean(0.4), limit * 4);
  const solved = play.steps.findIndex((s) => gradeAnswer(puzzle, s.answer, play.timed ? Math.max(0, limit - s.atMs) : limit / 2).isCorrect);
  if (solved < 0) return null;
  add("ladder:0", kit.nothing(puzzle), 0);
  for (let k = 1; k <= solved; k++) add(k === solved ? "one-short" : `ladder:${k}`, play.steps[k - 1]!.answer, 0);
  if (!play.timed) {
    const final = play.steps[solved]!.answer;
    for (const [level, left] of [["t0", 0], ["t50", 0.5], ["t90", 0.9]] as const) add(level, final, Math.round(left * limit));
  } else {
    // Tap and action logs carry their own times: replay the clean solve at the pace that finishes nearest each level.
    for (const [level, left] of [["t0", 0], ["t50", 0.5], ["t90", 0.9]] as const) {
      const target = Math.max(300, limit * (1 - left) - (left === 0 ? 250 : 0));
      let pace = 0.4;
      let best: { answer: string; at: number } | null = null;
      for (let it = 0; it < 6; it++) {
        const pl = kit.play(puzzle, makeRng(hashText(`${type}:clean:${seed}`)), clean(pace), limit * 4);
        const si = pl.steps.findIndex((s) => gradeAnswer(puzzle, s.answer, Math.max(0, limit - s.atMs)).isCorrect);
        if (si < 0) break;
        const at = pl.steps[si]!.atMs;
        if (!best || Math.abs(at - target) < Math.abs(best.at - target)) best = { answer: pl.steps[si]!.answer, at };
        pace = Math.max(0.05, pace * (target / Math.max(1, at)));
      }
      // A finish the pace could not bring near this time (Chain's momentum window breaks a slow chain) is left out.
      if (best && best.at <= limit && Math.abs(best.at - target) <= limit * 0.08) add(level, best.answer, Math.max(0, Math.round(limit - best.at)));
    }
  }
  const slips = kit.play(puzzle, makeRng(hashText(`${type}:mistakes:${seed}`)), clean(0.4, 0.15), limit * 4);
  const si = slips.steps.findIndex((s) => gradeAnswer(puzzle, s.answer, slips.timed ? Math.max(0, limit - s.atMs) : limit / 2).isCorrect);
  if (si >= 0) add("mistakes", slips.steps[si]!.answer, slips.timed ? Math.max(0, Math.round(limit - slips.steps[si]!.atMs)) : Math.round(limit / 2));
  for (const spam of kit.spam(puzzle, makeRng(hashText(`${type}:spam:${seed}`)), limit)) add(`spam:${spam.label}`, spam.answer, 0);
  return { type, seed, puzzle, actions: solved + 1, entries };
}

if (import.meta.main) {
  const games: Rev3Game[] = [];
  for (const type of Object.keys(REV3_GAMES) as PuzzleType[]) {
    for (const seed of REV3_SEEDS) {
      const g = recordGame(type, seed);
      if (g) games.push(g);
      else console.error(`${type} seed ${seed}: no clean solve (skipped)`);
    }
    console.error(`${type}: recorded`);
  }
  writeFileSync(REV3_FIXTURE, gzipSync(JSON.stringify({ recordedOn: "puzzleScoreRev 3 (20 Oct 2026)", games })));
  console.log(`${games.length} game seeds, ${games.reduce((n, g) => n + g.entries.length, 0)} entries → ${REV3_FIXTURE}`);
}
