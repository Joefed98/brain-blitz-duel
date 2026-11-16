/**
 * The Logic overhaul's intro demos (session 1, 15 Nov 2026; logic-demos-lib.ts). No browser, no database, ~2 s. Fails
 * unless scripts/fixtures/logic-demos.json holds, for Minefield:
 *  1. one row on the stamp rooms deal at Normal (minesRev 3, no `level`) whose puzzle is exactly the game's intro
 *     example deal (the deal logic-demos-save.ts asks the server for, so the Save demo function accepts the run), its
 *     seed the puzzle's and the run's, with intro_demos' columns as the save writes them;
 *  2. a run the server's replay accepts (not flagged) and scores exactly the row's `score`, the run's own claim too;
 *  3. something to see in the demo's eight seconds (squares opened beyond the opening, no mine hit);
 *  4. the demo rule (logicDemoRules.ts, which getIntroDemoFn asks) plays it, and stops a demo of minesRev 2 (the old
 *     Normal, today's Hard), one dealt on another level, and for the six puzzle games one off Normal;
 *  5. the six puzzle games' coordinate demos are held to the new presentation (an older log is refused);
 *  6. the six bundled demos (src/lib/duel/bundledDemos/logic1.ts, recorded by real play on Normal): each is exactly
 *     today's intro example (public half, nothing private), on today's presentation and layout, at most 30 KB, real
 *     touches from the start, and getIntroDemoFn's choice: bundled with no live row or an older one, a live row
 *     recorded on today's presentation wins.
 *
 *   bun scripts/logic-demos-check.ts
 */
import { readFileSync } from "node:fs";
import { MINES_REV_LOGIC, MINES_REV_NORMAL } from "../src/lib/arcade/minesweeper";
import { DEMO_LENGTH_TICKS, DEMO_START_TICK, runSeed } from "../src/lib/arcade/introDemo";
import { logicDemoPlays } from "../src/lib/duel/logicDemoRules";
import { LOGIC_OVERHAUL1_PRESENTATION, puzzleInputDemoCompatible, puzzlePresentation } from "../src/components/puzzles/wordInput";
import type { PuzzleData } from "../src/lib/duel/types";
import { DEMO_GAMES, DEMOS_FIXTURE, demoMoments, exampleDeal, serverReplay, type DemoRow } from "./logic-demos-lib";

const failures: string[] = [];
let passes = 0;
const ok = (cond: boolean, message: string) => (cond ? passes++ : failures.push(message));

const file = JSON.parse(readFileSync(DEMOS_FIXTURE, "utf8")) as { rows: DemoRow[] };
for (const game of DEMO_GAMES) {
  const rows = file.rows.filter((r) => r.game_type === game);
  ok(rows.length === 1, `${game}: exactly one demo row (got ${rows.length})`);
  const row = rows[0];
  if (!row) continue;
  ok(row.puzzle.type === game && row.puzzle.minesRev === MINES_REV_NORMAL, `${game}: recorded on minesRev ${MINES_REV_NORMAL} (got ${row.puzzle.minesRev})`);
  ok(!("level" in row.puzzle), `${game}: recorded on Normal (no level)`);
  ok(row.puzzle.seed === row.seed && runSeed(row.input_log.run) === row.seed, `${game}: the seed is the puzzle's and the run's`);
  ok(JSON.stringify(row.puzzle) === JSON.stringify(await exampleDeal(game)), `${game}: the puzzle is the intro example deal exactly`);
  ok(row.start_tick === DEMO_START_TICK && row.length_ticks === DEMO_LENGTH_TICKS, `${game}: start and length as the save writes them`);
  const replay = serverReplay(row.seed, row.input_log.run);
  ok(!replay.flagged, `${game}: the server's replay accepts the run`);
  ok(replay.score === row.score, `${game}: the server's replay scores ${replay.score}, the row says ${row.score}`);
  ok(Number(row.input_log.run.split("|")[1]) === replay.score, `${game}: the run's own claim matches the server's`);
  const m = demoMoments(row.seed, row.input_log.run);
  ok(m.opened >= 5 && m.hits === 0, `${game}: squares opened in the demo's ${DEMO_LENGTH_TICKS / 60} s, no mine hit (${JSON.stringify(m)})`);
  const puzzle = row.puzzle as unknown as PuzzleData;
  ok(logicDemoPlays(game, puzzle), `${game}: the demo rule plays the recorded demo`);
  ok(!logicDemoPlays(game, { ...row.puzzle, minesRev: MINES_REV_LOGIC } as unknown as PuzzleData), `${game}: a minesRev 2 demo (the old Normal) is stopped`);
  ok(!logicDemoPlays(game, { ...row.puzzle, level: "hard" } as unknown as PuzzleData), `${game}: a demo dealt on another level is stopped`);
}
for (const type of ["sudoku", "tubes", "tower", "safe", "nonogram", "flood"]) {
  ok(puzzlePresentation(type) === LOGIC_OVERHAUL1_PRESENTATION, `${type}: coordinate demos are held to the new presentation`);
  ok(!puzzleInputDemoCompatible(type, { presentation: "oct13-logic-polish" }), `${type}: an older coordinate demo is refused`);
  ok(puzzleInputDemoCompatible(type, { presentation: LOGIC_OVERHAUL1_PRESENTATION }), `${type}: a demo on the new presentation plays`);
  ok(!logicDemoPlays(type, { type, level: "expert" } as unknown as PuzzleData) && logicDemoPlays(type, { type } as unknown as PuzzleData), `${type}: only a Normal demo plays`);
}
// The six puzzle demos bundled with the app (Joe, 16 Nov 2026: recorded by real play on Normal, a live row still wins).
{
  const { LOGIC_1_BUNDLED_DEMOS, pickLogicDemo } = await import("../src/lib/duel/bundledDemos/logic1");
  const { bundledIntroDemo } = await import("../src/lib/duel/bundledDemos");
  const { pickIntroDemo } = await import("../src/lib/duel/introDemo.functions");
  const { exampleFor } = await import("./shots/examples");
  const { splitPuzzle } = await import("../src/lib/duel/secrets");
  const { GAME_COLUMN_LAYOUT, INTRO_EXAMPLE_ID, isPuzzleDemoLog } = await import("../src/lib/duel/puzzleDemo");
  for (const type of ["sudoku", "tubes", "tower", "safe", "nonogram", "flood"] as const) {
    const row = LOGIC_1_BUNDLED_DEMOS[type];
    ok(Boolean(row), `${type}: a demo is bundled`);
    if (!row) continue;
    const text = JSON.stringify(row);
    ok(text.length <= 30 * 1024, `${type}: the bundled demo is at most 30 KB (${Math.round(text.length / 1024)} KB)`);
    ok(row.game_type === type && row.example_id === INTRO_EXAMPLE_ID && isPuzzleDemoLog(row.input_log), `${type}: an intro_demos row on the fixed intro example`);
    const today = splitPuzzle(exampleFor(type)).pub;
    ok(JSON.stringify(row.puzzle) === JSON.stringify(today), `${type}: the puzzle is exactly today's intro example deal (public half)`);
    ok(!("solution" in (row.puzzle as object)) && !("pattern" in (row.puzzle as object)) && !("combination" in (row.puzzle as object)), `${type}: no private field in the bundled puzzle`);
    ok(puzzleInputDemoCompatible(type, row.input_log) && row.input_log.layout === GAME_COLUMN_LAYOUT, `${type}: on today's presentation and layout`);
    const actions = row.input_log.actions ?? [];
    ok(actions.length >= 5 && (actions[0]?.t ?? 0) <= 1000 && row.length_ticks === Math.max(...actions.map((a) => a.t)), `${type}: real touches from the start (${actions.length}, first at ${actions[0]?.t} ms)`);
    ok(logicDemoPlays(type, row.puzzle), `${type}: the bundled demo is on Normal`);
    ok(pickLogicDemo(type, null) === row, `${type}: with no live row the bundled demo plays`);
    ok(bundledIntroDemo(type) === row && pickIntroDemo(type, null, bundledIntroDemo(type)) === row, `${type}: the one bundled registry serves it`);
    const old = { ...row, input_log: { ...row.input_log, presentation: "oct13-logic-polish" } };
    ok(pickLogicDemo(type, old as never) === row, `${type}: a live row on an older presentation gives way to the bundled demo`);
    const fresh = { ...row, length_ticks: row.length_ticks + 1 };
    ok(pickLogicDemo(type, fresh as never) === fresh, `${type}: a live row recorded on today's presentation wins`);
  }
}
const src = readFileSync(new URL("../src/lib/duel/introDemo.functions.ts", import.meta.url), "utf8");
ok(/!logicDemoPlays\(data\.type, demo\.puzzle\)\) return null/.test(src), "introDemo.functions.ts asks the demo rule before serving a demo");
// Changed with Joe's approval, 16 Nov 2026 (routine: puzzle train combine): the six are served through the one bundled
// registry (bundledDemos/index.ts) and pickIntroDemo, so the check reads that path.
ok(/return pickIntroDemo\(data\.type, live, bundledIntroDemo\(data\.type\)\);/.test(src), "introDemo.functions.ts serves the bundled demo when the live row would not play");

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL logic-demos-check: ${failures.length} failed, ${passes} passed`);
  process.exit(1);
}
console.log(`PASS logic-demos-check: ${passes} checks (Minefield's demo on minesRev 3, server replay exact, the demo rules)`);
