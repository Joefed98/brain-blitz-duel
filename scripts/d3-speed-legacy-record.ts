/**
 * Records D3's Speed legacy fixture (22 Nov 2026), on the code before D3's Normal scoring stamps (Flash tapRev 8,
 * Bonk whackRev 5, Pull! clayRev 11, the Chain's and Tenfall's new stamps): for each of the six Speed games at every
 * level, deals played by the average player and the realistic elite (d3-ladder-lib.ts) plus doing nothing, each with
 * the answer the phone sends, the ms left it was graded with and the server's whole grade (score, verdict, extra).
 * d3-speed-ladder-check replays every one through today's grader and fails on any difference, so every round dealt on
 * the stamps before D3 grades exactly as it did.
 *
 *   bun scripts/d3-speed-legacy-record.ts [--deals=8]      (writes scripts/fixtures/d3-speed-legacy.json.gz)
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { KITS } from "./puzzle-fairness/kits";
import { dealAt } from "./level-tune";
import { ALL_LEVELS, SPEED_GAMES, playAs, type D3Bot } from "./d3-ladder-lib";
import type { PuzzleData } from "../src/lib/duel/types";

export const D3_SPEED_LEGACY = "scripts/fixtures/d3-speed-legacy.json.gz";

export interface LegacyCase {
  game: string;
  level: string;
  who: string;
  puzzle: PuzzleData;
  answer: string;
  msRemaining: number;
  score: number;
  isCorrect: boolean;
  extra: unknown;
}

/** The answer a play sends and the ms left it is graded with, as standard-lib's gradeSteps grades it. */
function sent(puzzle: PuzzleData, steps: { answer: string; atMs: number }[], timed: boolean): { answer: string; msRemaining: number } {
  const limit = puzzleTimeLimitMs(puzzle);
  const inTime = steps.filter((s) => s.atMs <= limit);
  if (!inTime.length) return { answer: "", msRemaining: 0 };
  if (timed) {
    const last = inTime[inTime.length - 1]!;
    const left = Math.max(0, limit - last.atMs);
    return { answer: last.answer, msRemaining: gradeAnswer(puzzle, last.answer, left).isCorrect ? left : 0 };
  }
  for (const s of inTime) if (gradeAnswer(puzzle, s.answer, Math.max(0, limit - s.atMs)).isCorrect) return { answer: s.answer, msRemaining: Math.max(0, limit - s.atMs) };
  return { answer: inTime[inTime.length - 1]!.answer, msRemaining: 0 };
}

if (import.meta.main) {
  const deals = Number(process.argv.find((a) => a.startsWith("--deals="))?.slice(8) ?? 8);
  const cases: LegacyCase[] = [];
  for (const game of SPEED_GAMES) {
    for (const level of ALL_LEVELS) {
      for (let n = 0; n < deals; n++) {
        const puzzle = dealAt(game, level, 9_000 + n);
        const plays: [string, string, number][] = [];
        for (const bot of ["average", "elite"] as D3Bot[]) {
          const play = playAs(bot, puzzle, `d3-legacy:${game}:${level}:${n}:${bot}`);
          const s = sent(puzzle, play.steps, !!play.timed);
          plays.push([bot, s.answer, s.msRemaining]);
        }
        plays.push(["nothing", KITS[game]!.nothing(puzzle), 0]);
        for (const [who, answer, msRemaining] of plays) {
          const g = gradeAnswer(puzzle, answer, msRemaining);
          cases.push({ game, level, who, puzzle, answer, msRemaining, score: g.score, isCorrect: g.isCorrect, extra: g.extra ?? null });
        }
      }
    }
  }
  writeFileSync(D3_SPEED_LEGACY, gzipSync(JSON.stringify(cases)));
  console.log(`${D3_SPEED_LEGACY}: ${cases.length} cases`);
}
