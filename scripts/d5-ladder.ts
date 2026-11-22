/**
 * D5's ladder table (a tool, not a check): the average player and the realistic elite under the human limits
 * (scripts/d5-ladder-lib.ts) on every level of the named games, one JSON line a row plus a readable line.
 *
 *   bun scripts/d5-ladder.ts <game…> [--levels=easy,normal,hard,expert] [--deals=24] [--from=0] [--bots=average,elite] [--json=<file>]
 */
import { appendFileSync } from "node:fs";
import type { PuzzleType } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { ALL_LEVELS, ladderLine, measure, type D5Bot } from "./d5-ladder-lib";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const games = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
const levels = (opt("levels")?.split(",") ?? ALL_LEVELS) as Level[];
const bots = (opt("bots")?.split(",") ?? ["average", "elite"]) as D5Bot[];
const deals = Number(opt("deals") ?? 24);
const from = Number(opt("from") ?? 0);
const json = opt("json");
for (const game of games) {
  for (const level of levels) {
    for (const bot of bots) {
      const t0 = Date.now();
      const { row, runs } = await measure(game, level, bot, deals, from);
      console.log(`${ladderLine(row)}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      if (json) appendFileSync(json, JSON.stringify({ ...row, scores: runs.map((r) => r.score), parts: runs.map((r) => r.parts ?? null) }) + "\n");
    }
  }
}
