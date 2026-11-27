/**
 * Crazy Golf's intro demo (the Crazy Golf overhaul, 15 Nov 2026; the merge captain's demo plan, #444's pattern). No
 * browser, no database, a few seconds. Fails unless scripts/fixtures/crazy-golf-demos.json holds:
 *  1. one row on the stamp rooms deal (golfRev 3), on Normal (no `level`), whose puzzle is exactly the game's intro
 *     example deal (the deal crazy-golf-demos-save.ts asks the server for, so the Save demo function accepts the run),
 *     with intro_demos' columns as the save writes them;
 *  2. a run the server's replay accepts (not flagged) and scores exactly the row's `score`, the same as the run's claim;
 *  3. something to see in the demo's eight seconds (a stroke played);
 *  4. the demo rule (minigolfDemoPlays, which introDemo.functions.ts asks) lets it play, and stops a demo of golfRev 2
 *     and one dealt on another level.
 *
 *   bun scripts/crazy-golf-demos-check.ts
 */
import { readFileSync } from "node:fs";
import { MINIGOLF_REV_COURSE, MINIGOLF_REV_D6 } from "../src/lib/arcade/minigolf";
import { DEMO_LENGTH_TICKS, DEMO_START_TICK, runSeed } from "../src/lib/arcade/introDemo";
import { minigolfDemoPlays } from "../src/lib/duel/minigolfDemoRule";
import type { PuzzleData } from "../src/lib/duel/types";
import { DEMOS_FIXTURE, demoMoments, exampleDeal, serverReplay, type DemoRow } from "./crazy-golf-demos-lib";

const failures: string[] = [];
let passes = 0;
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else failures.push(message);
}

const file = JSON.parse(readFileSync(DEMOS_FIXTURE, "utf8")) as { rows: DemoRow[] };
const rows = file.rows.filter((r) => r.game_type === "minigolf");
ok(rows.length === 1, `minigolf: exactly one demo row (got ${rows.length})`);
const row = rows[0];
if (row) {
  ok(row.puzzle.type === "minigolf" && row.puzzle.golfRev === MINIGOLF_REV_D6, `recorded on the dealt stamp golfRev ${MINIGOLF_REV_D6} (got ${row.puzzle.golfRev})`); // Changed with Joe's approval, 27 Nov 2026 (D6)
  ok(!("level" in row.puzzle), "recorded on Normal (no level)");
  ok(row.puzzle.seed === row.seed && runSeed(row.input_log.run) === row.seed, `the seed ${row.seed} is the puzzle's and the run's`);
  ok(JSON.stringify(row.puzzle) === JSON.stringify(await exampleDeal("minigolf")), "the puzzle is the intro example deal exactly (re-run crazy-golf-demos-record.ts after the bank changes)");
  ok(row.start_tick === DEMO_START_TICK && row.length_ticks === DEMO_LENGTH_TICKS, `start ${row.start_tick} and length ${row.length_ticks} as the save writes them`);
  const replay = serverReplay(row.puzzle, row.input_log.run);
  ok(!replay.flagged, "the server's replay accepts the run");
  ok(replay.score === row.score, `the server's replay scores ${replay.score}, the row says ${row.score}`);
  const claim = Number(row.input_log.run.split("|")[1]);
  ok(claim === replay.score, `the run's own claim ${claim} matches the server's ${replay.score}`);
  const m = demoMoments(row.puzzle, row.input_log.run);
  ok(m.strokes >= 1, `a stroke in the demo's ${DEMO_LENGTH_TICKS / 60} s (${JSON.stringify(m)})`);
  const puzzle = row.puzzle as unknown as PuzzleData;
  ok(minigolfDemoPlays("minigolf", puzzle), "the demo rule plays the recorded demo");
  ok(!minigolfDemoPlays("minigolf", { ...row.puzzle, golfRev: 2 } as unknown as PuzzleData), "the demo rule stops a demo recorded on golfRev 2");
  ok(!minigolfDemoPlays("minigolf", { ...row.puzzle, level: "hard" } as unknown as PuzzleData), "the demo rule stops a demo dealt on another level");
  ok(minigolfDemoPlays("pool", { type: "pool" } as unknown as PuzzleData), "the demo rule leaves other games alone");
}
const src = readFileSync(new URL("../src/lib/duel/introDemo.functions.ts", import.meta.url), "utf8");
ok(/!minigolfDemoPlays\(data\.type, demo\.puzzle\)\) return null/.test(src), "introDemo.functions.ts asks the demo rule before serving a demo");

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL crazy-golf-demos-check: ${failures.length} failed, ${passes} passed`);
  process.exit(1);
}
console.log(`PASS crazy-golf-demos-check: ${passes} checks (the demo on golfRev 3's example deal, server replay exact, the demo rule)`);
