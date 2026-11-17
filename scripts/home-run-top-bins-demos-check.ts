/**
 * The Home Run and Top Bins intro demos (15 Nov 2026; the merge captain's demo plan, Action #436's pattern). No browser,
 * no database, ~2 s. Fails unless scripts/fixtures/home-run-top-bins-demos.json holds, for each game:
 *  1. one row on the stamp rooms deal (homerunRev 5 / freekickRev 6), on Normal (no `level`), whose puzzle is exactly
 *     the game's intro example deal (the deal home-run-top-bins-demos-save.ts asks the server for, so the Save demo
 *     function accepts the run), its seed one Normal deal seed, with intro_demos' columns as the save writes them;
 *  2. a run the server's replay accepts (not flagged) and scores exactly the row's `score`, the same through the run's
 *     own claim;
 *  3. something to see in the demo's eight seconds (Home Run: a batted ball; Top Bins: a goal);
 *  4. the demo rule (sportsDemoPlays, which introDemo.functions.ts asks) lets it play, and stops a demo of the stamp
 *     before (homerunRev 4 / freekickRev 5) and one dealt on another level.
 *
 *   bun scripts/home-run-top-bins-demos-check.ts
 */
import { readFileSync } from "node:fs";
import { HOMERUN_REV_DEALT } from "../src/lib/arcade/homerun";
import { FREEKICK_REV_DEALT } from "../src/lib/arcade/freekick";
import { DEMO_LENGTH_TICKS, DEMO_START_TICK, runSeed } from "../src/lib/arcade/introDemo";
import { HOMERUN_DEAL_V5 } from "../src/lib/duel/homerunDealV5.server";
import { FREEKICK_DEAL_V6 } from "../src/lib/duel/freekickDealV6.server";
import { sportsDemoPlays } from "../src/lib/duel/sportsDemoRules";
import type { PuzzleData } from "../src/lib/duel/types";
import { DEMO_GAMES, DEMOS_FIXTURE, demoMoments, exampleDeal, serverReplay, type DemoRow } from "./home-run-top-bins-demos-lib";

const failures: string[] = [];
let passes = 0;
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else failures.push(message);
}

const file = JSON.parse(readFileSync(DEMOS_FIXTURE, "utf8")) as { rows: DemoRow[] };
for (const game of DEMO_GAMES) {
  const rows = file.rows.filter((r) => r.game_type === game);
  ok(rows.length === 1, `${game}: exactly one demo row (got ${rows.length})`);
  const row = rows[0];
  if (!row) continue;
  const stamp = game === "homerun" ? row.puzzle.homerunRev : row.puzzle.freekickRev;
  const dealt = game === "homerun" ? HOMERUN_REV_DEALT : FREEKICK_REV_DEALT;
  ok(row.puzzle.type === game && stamp === dealt, `${game}: recorded on the dealt stamp ${dealt} (got ${stamp})`);
  ok(!("level" in row.puzzle), `${game}: recorded on Normal (no level)`);
  const deal = game === "homerun" ? HOMERUN_DEAL_V5.normal : FREEKICK_DEAL_V6.normal;
  ok(deal.includes(row.seed) && row.puzzle.seed === row.seed && runSeed(row.input_log.run) === row.seed, `${game}: the seed ${row.seed} is a Normal deal seed, the puzzle's and the run's`);
  ok(JSON.stringify(row.puzzle) === JSON.stringify(await exampleDeal(game)), `${game}: the puzzle is the intro example deal exactly`);
  ok(row.start_tick === DEMO_START_TICK && row.length_ticks === DEMO_LENGTH_TICKS, `${game}: start ${row.start_tick} and length ${row.length_ticks} as the save writes them`);

  const replay = serverReplay(game, row.seed, row.input_log.run);
  ok(!replay.flagged, `${game}: the server's replay accepts the run`);
  ok(replay.score === row.score, `${game}: the server's replay scores ${replay.score}, the row says ${row.score}`);
  const claim = Number(row.input_log.run.split("|")[1]);
  ok(claim === replay.score, `${game}: the run's own claim ${claim} matches the server's ${replay.score}`);

  const m = demoMoments(game, row.seed, row.input_log.run);
  if (game === "homerun") ok(m.swings >= 1, `${game}: a batted ball in the demo's ${DEMO_LENGTH_TICKS / 60} s (${JSON.stringify(m)})`);
  else ok(m.goals >= 1, `${game}: a goal in the demo's ${DEMO_LENGTH_TICKS / 60} s (${JSON.stringify(m)})`);

  const puzzle = row.puzzle as unknown as PuzzleData;
  ok(sportsDemoPlays(game, puzzle), `${game}: the demo rule plays the recorded demo`);
  const older = { ...row.puzzle, ...(game === "homerun" ? { homerunRev: dealt - 1 } : { freekickRev: dealt - 1 }) } as unknown as PuzzleData;
  ok(!sportsDemoPlays(game, older), `${game}: the demo rule stops a demo recorded on stamp ${dealt - 1}`);
  ok(!sportsDemoPlays(game, { ...row.puzzle, level: "hard" } as unknown as PuzzleData), `${game}: the demo rule stops a demo dealt on another level`);
}
const src = readFileSync(new URL("../src/lib/duel/introDemo.functions.ts", import.meta.url), "utf8");
ok(/!sportsDemoPlays\(data\.type, demo\.puzzle\)\) return null/.test(src), "introDemo.functions.ts asks the demo rule before serving a demo");

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL home-run-top-bins-demos-check: ${failures.length} failed, ${passes} passed`);
  process.exit(1);
}
console.log(`PASS home-run-top-bins-demos-check: ${passes} checks (2 demos on the dealt stamps, server replay exact, the demo rule)`);
