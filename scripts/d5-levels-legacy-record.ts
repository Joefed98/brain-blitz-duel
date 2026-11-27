/**
 * Records D5's levels legacy fixture (22 Nov 2026), on the code before D5 changed any Retro or Action level or Normal
 * stamp: for each of the 16 Retro and Action games at every level (Easy, Normal, Hard, Expert as dealt today), deals
 * played by the average player and the realistic elite under the human limits (d5-ladder-lib.ts), each stored with the
 * dealt puzzle, the answer the phone sends and the server's whole grade (score, verdict and extra, the replay's
 * wall-clock fields aside). retro-levels-check and the Action levels checks replay every one through today's grader and
 * fail on any difference, so every round dealt before D5 (Normal and every level) grades exactly as it did.
 *
 *   bun scripts/d5-levels-legacy-record.ts [--deals=3] [games…]     (writes scripts/fixtures/d5-levels-legacy.json.gz)
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { dealAt } from "./level-tune";
import { ALL_LEVELS, D5_GAMES, playDealt } from "./d5-ladder-lib";

export const D5_LEVELS_LEGACY = "scripts/fixtures/d5-levels-legacy.json.gz";

export interface D5LegacyCase {
  game: string;
  level: string;
  who: string;
  puzzle: PuzzleData;
  answer: string;
  score: number;
  isCorrect: boolean;
  /** The grade's extra as JSON, the replay's own timing and lag fields left out (they measure the machine). */
  extra: string;
}

/** The grade's extra without the fields that measure the machine rather than the run. */
export function stableExtra(extra: unknown): string {
  return JSON.stringify(extra ?? null, (k, v) => (k === "replayMs" || k === "clientLag" ? undefined : v));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const deals = Number(args.find((a) => a.startsWith("--deals="))?.slice(8) ?? 3);
  const only = args.filter((a) => !a.startsWith("--"));
  const games = only.length ? (only as PuzzleType[]) : D5_GAMES;
  const cases: D5LegacyCase[] = [];
  for (const game of games) {
    for (const level of ALL_LEVELS) {
      for (let n = 0; n < deals; n++) {
        const puzzle = dealAt(game, level, 9_000 + n);
        for (const who of ["average", "elite"] as const) {
          const run = await playDealt(game, puzzle, who);
          const g = gradeAnswer(puzzle, run.raw, 0);
          cases.push({ game, level, who, puzzle, answer: run.raw, score: g.score, isCorrect: g.isCorrect, extra: stableExtra(g.extra) });
        }
      }
      console.log(`${game} ${level}: ${cases.filter((c) => c.game === game && c.level === level).map((c) => c.score).join(" ")}`);
    }
  }
  writeFileSync(D5_LEVELS_LEGACY, gzipSync(JSON.stringify(cases)));
  console.log(`${cases.length} cases → ${D5_LEVELS_LEGACY}`);
}
