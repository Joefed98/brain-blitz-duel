/**
 * The Logic overhaul's level measurement (session 1, Joe 16 Nov 2026): every level of Box Six, Polypotions, Hanoi, Safe
 * Cracker, Mosaic, Colour Flood and Minefield played by the shared tool's bots (scripts/level-tune.ts dealAt, the
 * puzzle-fairness kits, Minefield's skill-band bot) held to human limits: no input sooner than 0.25 s to react plus
 * 0.15 s to move after the one before (#444's HUMAN_LIMITS model, applied here to the bots' step times so this branch
 * doesn't carry #444's tool). Reports, per level, the "great" and "near-perfect" bots' averages and finish rates, and
 * Expert's best tenth (the mean of the top 10 % of runs). Not a check; logic-1-steps-check pins the steps it proves.
 *
 *   bun scripts/logic-1-tune.ts [games…] [--seeds=20] [--from=0] [--json=<file>]
 */
import { writeFileSync } from "node:fs";

import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { minesCheckpoint, minesweeperGameFor, MINES_CHECKPOINT_INTERVAL, minesCleared } from "../src/lib/arcade/minesweeper";
import { encodeMinesweeperRun } from "../src/lib/duel/minesweeper";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot as minesBot } from "./arcade-skill-bands/bots/minesweeper";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng, type Level as KitLevel } from "./puzzle-fairness/kit";
import { asPhoneSends, gradeSteps } from "./standard-lib";
import { dealAt } from "./level-tune";

/** #444's human limits: 0.25 s to react, 0.15 s to move. */
export const HUMAN_REACT_MS = 250;
export const HUMAN_MOVE_MS = 150;
const GAP_MS = HUMAN_REACT_MS + HUMAN_MOVE_MS;
const GAP_TICKS = Math.round((GAP_MS * 60) / 1000);

export const LOGIC_1_GAMES = ["sudoku", "tubes", "tower", "safe", "nonogram", "flood", "minesweeper"] as const;
export const TUNE_LEVELS = ["easy", "normal", "hard", "expert"] as const;
export type TuneLevel = (typeof TUNE_LEVELS)[number];
export type TuneBot = "great" | "near";

export interface Run {
  score: number;
  finished: boolean;
}

/** Every step at least the human gap after the one before (and the first at least the gap after the start). */
export function limitSteps<T extends { atMs: number }>(steps: readonly T[]): T[] {
  let last = 0;
  return steps.map((s) => {
    const at = Math.max(s.atMs, last + GAP_MS);
    last = at;
    return { ...s, atMs: at };
  });
}

/** One puzzle run under human limits, graded by the server's own code. */
export function puzzleRun(type: PuzzleType, puzzle: PuzzleData, bot: TuneBot, key: string): Run {
  const kit = KITS[type]!;
  const limit = puzzleTimeLimitMs(puzzle);
  const play = kit.play(puzzle, makeRng(hashText(`logic-1-tune:${key}:${bot}`)), SKILLS[bot as KitLevel], limit);
  const steps = limitSteps(play.steps).filter((s) => s.atMs <= limit);
  const run = gradeSteps(puzzle, asPhoneSends(puzzle, steps), play.timed);
  return { score: run.score, finished: run.isCorrect };
}

/** One Minefield run: the skill-band bot, its taps held to the human gap, graded through the server replay. */
export function minesRun(puzzle: PuzzleData, bot: TuneBot): Run {
  const p = puzzle as unknown as { seed: number; minesRev: number };
  const game = minesweeperGameFor(p.minesRev);
  const out = minesBot({ game, seed: p.seed, rev: p.minesRev, human: new Human("minesweeper", p.seed, bot as SkillLevel), fixes: true });
  let last = 0;
  const events = (out.events ?? []).map((e) => {
    const t = Math.max(e.t, last + GAP_TICKS);
    last = t;
    return { ...e, t };
  }).filter((e) => e.t <= game.runTicks);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(p.seed);
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % MINES_CHECKPOINT_INTERVAL === 0) checkpoints.push(minesCheckpoint(s));
  }
  const raw = encodeMinesweeperRun({ seed: p.seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const graded = gradeAnswer(puzzle, raw, 0);
  return { score: graded.score, finished: minesCleared(s) };
}

export function runsFor(type: PuzzleType, level: TuneLevel, bot: TuneBot, seeds: number, from = 0): Run[] {
  const out: Run[] = [];
  for (let n = from; n < from + seeds; n++) {
    const puzzle = dealAt(type, level, n);
    out.push(type === "minesweeper" ? minesRun(puzzle, bot) : puzzleRun(type, puzzle, bot, `${type}:${level}:${n}`));
  }
  return out;
}

export const average = (runs: readonly Run[]) => runs.reduce((a, r) => a + r.score, 0) / Math.max(1, runs.length);
export const finishRate = (runs: readonly Run[]) => runs.filter((r) => r.finished).length / Math.max(1, runs.length);
/** The mean of the top tenth of runs (at least one). */
export function bestTenth(runs: readonly Run[]): number {
  const top = [...runs].sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.round(runs.length / 10)));
  return average(top);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const games = (args.filter((a) => !a.startsWith("--")) as PuzzleType[]).filter(Boolean);
  const list = games.length ? games : [...LOGIC_1_GAMES];
  const seeds = Number(opt("seeds") ?? 20);
  const from = Number(opt("from") ?? 0);
  const table: Record<string, unknown>[] = [];
  console.log(`human limits: ${HUMAN_REACT_MS} ms react + ${HUMAN_MOVE_MS} ms move; ${seeds} deals a level from sample ${from}`);
  for (const type of list) {
    for (const level of TUNE_LEVELS) {
      const cells: string[] = [];
      for (const bot of ["great", "near"] as const) {
        const runs = runsFor(type, level, bot, seeds, from);
        const row = { game: type, level, bot, average: Math.round(average(runs) * 10) / 10, finished: Math.round(finishRate(runs) * 100), bestTenth: Math.round(bestTenth(runs) * 10) / 10 };
        table.push(row);
        cells.push(`${bot.padEnd(5)} avg ${row.average.toFixed(1).padStart(5)} fin ${String(row.finished).padStart(3)}% best10 ${row.bestTenth.toFixed(1).padStart(5)}`);
      }
      console.log(`${type.padEnd(12)} ${level.padEnd(7)} ${cells.join("   |   ")}`);
    }
  }
  const json = opt("json");
  if (json) writeFileSync(json, JSON.stringify(table, null, 1));
}
