/**
 * D3's ladder table (a tool, not a check): the average player and the realistic elite under Joe's human limits
 * (d3-ladder-lib.ts) on every level of the Speed and Attention games, graded by the server.
 *
 *   bun scripts/d3-ladder.ts [game…] [--deals=100] [--from=0] [--levels=normal,hard] [--pre] [--json]
 *
 * --pre deals the stamps before D3's Normal scoring stamps (pinPreD3Speed), for the before → after table.
 */
import { ALL_LEVELS, D3_GAMES, measure, type D3Game, type LadderRow } from "./d3-ladder-lib";
import { pinPreD3Speed } from "../src/lib/duel/d3Normal";
import type { Level } from "../src/lib/levels/levels";

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const games = (args.filter((a) => !a.startsWith("--")) as D3Game[]).filter(Boolean);
  const deals = Number(opt("deals") ?? 100);
  const from = Number(opt("from") ?? 0);
  const rows: LadderRow[] = [];
  if (args.includes("--pre")) pinPreD3Speed(true);
  const levels = (opt("levels")?.split(",") as Level[] | undefined) ?? ALL_LEVELS;
  for (const game of games.length ? games : D3_GAMES) {
    for (const level of levels) {
      const avg = measure(game, level, "average", deals, from);
      const elite = measure(game, level, "elite", deals, from);
      rows.push(avg, elite);
      if (!args.includes("--json"))
        console.log(
          `${game.padEnd(10)} ${level.padEnd(7)} average ${avg.average.toFixed(1).padStart(6)} (fin ${(avg.finishRate * 100).toFixed(0).padStart(3)}%)   elite ${elite.average.toFixed(1).padStart(6)} median ${String(elite.median).padStart(3)} top10 ${String(elite.top10).padStart(3)} at 200 ${(elite.at200 * 100).toFixed(0).padStart(3)}% (fin ${(elite.finishRate * 100).toFixed(0).padStart(3)}%)`,
        );
    }
  }
  if (args.includes("--json")) console.log(JSON.stringify(rows));
}
