/**
 * The Attention intro demos (15 Nov 2026; the merge captain's demo plan, the pattern of Action #436 and Sports #444).
 * No browser, no database, a few seconds. Fails unless scripts/fixtures/attention-demos.json holds, for each of the six
 * games:
 *   1. one row whose puzzle is exactly the game's intro example deal's public half (the deal attention-demos-save.ts
 *      asks the server for, the one the Save demo function accepts), on the stamp rooms deal today and on Normal;
 *   2. touches the app saves (a PuzzleDemoLog with the overhaul's presentation tag) that the phone plays
 *      (puzzleInputDemoCompatible), and that an older tag no longer plays;
 *   3. an answer the server's grade scores exactly the row's score and verdict (the grade the practice run stored),
 *      a finish;
 *   4. the server's demo rule (attentionDemoPlays, asked by introDemo.functions.ts) plays it, and stops the same demo
 *      on the stamp before or dealt on another level.
 *
 *   bun scripts/attention-demos-check.ts
 */
import { readFileSync } from "node:fs";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { isPuzzleDemoLog } from "../src/lib/duel/puzzleDemo";
import { ATTENTION_OVERHAUL_PRESENTATION, ATTENTION_REWORK_PRESENTATION, puzzleInputDemoCompatible, puzzlePresentation } from "../src/components/puzzles/wordInput";
import { attentionDemoPlays } from "../src/lib/duel/attentionDemoRules";
import { puzzleLevel } from "../src/lib/levels/levels";
import type { PuzzleData } from "../src/lib/duel/types";
import { DEMO_GAMES, DEMOS_FIXTURE, exampleDeal, exampleDealFull, type DemoRow } from "./attention-demos-lib";

const failures: string[] = [];
let passes = 0;
const ok = (cond: boolean, message: string) => (cond ? passes++ : failures.push(message));

const file = JSON.parse(readFileSync(DEMOS_FIXTURE, "utf8")) as { rows: DemoRow[] };
const OLDER: Record<string, Record<string, unknown>> = {
  symscan: { scanRev: 4 },
  spotdiff: { spotRev: 3 },
  countup: { countRev: 6 },
  pairmatch: { pairRev: 3 },
  bomb: { bombVersion: 2 },
};
for (const game of DEMO_GAMES) {
  const rows = file.rows.filter((r) => r.game_type === game);
  ok(rows.length === 1, `${game}: exactly one demo row (got ${rows.length})`);
  const row = rows[0];
  if (!row) continue;
  ok(JSON.stringify(row.puzzle) === JSON.stringify(await exampleDeal(game)), `${game}: the puzzle is the intro example deal's public half exactly`);
  ok(puzzleLevel(row.puzzle) === "normal" && !("level" in row.puzzle), `${game}: recorded on Normal`);
  ok(isPuzzleDemoLog(row.input_log), `${game}: the touches are a demo log the app saves`);
  ok(row.input_log.presentation === ATTENTION_OVERHAUL_PRESENTATION && puzzlePresentation(game) === ATTENTION_OVERHAUL_PRESENTATION, `${game}: on the overhaul's presentation`);
  ok(puzzleInputDemoCompatible(game, row.input_log), `${game}: the phone plays the touches`);
  ok(!puzzleInputDemoCompatible(game, { ...row.input_log, presentation: ATTENTION_REWORK_PRESENTATION }), `${game}: an older presentation still plays`);
  ok(row.input_log.actions.length > 0, `${game}: no touches`);

  const full = await exampleDealFull(game);
  const graded = gradeAnswer(full, row.answer, row.msRemaining);
  ok(graded.score === row.score && graded.isCorrect === row.isCorrect, `${game}: the server's grade is ${graded.score} (${graded.isCorrect}), the row says ${row.score} (${row.isCorrect})`);
  ok(row.isCorrect, `${game}: the demo doesn't finish`);

  const puzzle = row.puzzle as unknown as PuzzleData;
  ok(attentionDemoPlays(game, puzzle), `${game}: the demo rule stops the recorded demo`);
  if (OLDER[game]) ok(!attentionDemoPlays(game, { ...row.puzzle, ...OLDER[game] } as unknown as PuzzleData), `${game}: the demo rule plays a demo on the stamp before`);
  ok(!attentionDemoPlays(game, { ...row.puzzle, level: "hard" } as unknown as PuzzleData), `${game}: the demo rule plays a demo dealt on another level`);
}
const src = readFileSync(new URL("../src/lib/duel/introDemo.functions.ts", import.meta.url), "utf8");
ok(/if \(demo && !attentionDemoPlays\(data\.type, demo\.puzzle\)\) return null;/.test(src), "introDemo.functions.ts asks the Attention demo rule before serving a demo");

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL attention-demos-check: ${failures.length} failed, ${passes} passed`);
  process.exit(1);
}
console.log(`PASS attention-demos-check: ${passes} checks (6 demos on the intro examples, the server's grade exact, the demo rules)`);
