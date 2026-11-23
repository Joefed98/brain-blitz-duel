/**
 * Records a game's D5 ladder (a fixture, 23 Nov 2026): the average player and the realistic elite under the human limits
 * (scripts/d5-ladder-lib.ts) on `deals` deals at every level (Joe: at least 96 a level), each run's deal index and the
 * server's score. A game's ladder check reads it through `ladderFixtureVerdicts` (the ladder test on the recorded table)
 * and re-plays a sample live (`replaySample`), so the fixture is proved to be today's code, not a stale table.
 *
 *   bun scripts/d5-ladder-record.ts <game…> [--deals=96] [--from=0]     (writes scripts/fixtures/d5-ladder-<game>.json.gz)
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import type { PuzzleType } from "../src/lib/duel/types";
import { ALL_LEVELS, d5LadderFixture, ladderLine, measure, type D5Bot, type LadderFixture } from "./d5-ladder-lib";

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const deals = Number(opt("deals") ?? 96);
  const from = Number(opt("from") ?? 0);
  for (const game of args.filter((a) => !a.startsWith("--")) as PuzzleType[]) {
    const fixture: LadderFixture = { game, deals, from, rows: [] };
    for (const bot of ["average", "elite"] as D5Bot[]) {
      for (const level of ALL_LEVELS) {
        const { row, runs } = await measure(game, level, bot, deals, from);
        console.log(ladderLine(row));
        fixture.rows.push({ level, bot, scores: runs.map((r) => r.score) });
      }
    }
    writeFileSync(d5LadderFixture(game), gzipSync(JSON.stringify(fixture)));
    console.log(`→ ${d5LadderFixture(game)}`);
  }
}
