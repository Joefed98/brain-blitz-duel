/**
 * logic-demos-check (15 Nov 2026, Logic overhaul 2): the intro demos recorded for Tents and Trees, Shikaku, Lamplighter,
 * Trail, Loopline, Regions and Island Link (scripts/fixtures/logic-demos.json, `bun scripts/logic-demos-record.ts`).
 *
 *   1. One demo for each of the seven games, and only them.
 *   2. Each demo plays today's fixed intro example on the stamps rooms deal (the example's public half exactly, its
 *      stamps the live deal's), so the "Save intro demos" workflow saves what the intro will show.
 *   3. Each run scores exactly what the server's grading says: the answer the stage sent, graded by gradeAnswer on the
 *      full example with the clock it sent, is a correct finish at the score the practice screen showed.
 *   4. The log is a real recording the intro player accepts (positions inside the play area, in time order, the overhaul's
 *      presentation), and the version rules stop older demos: an older presentation, and Trail and Regions demos from
 *      before their new stamps.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { LOGIC2_DEMOS, LOGIC2_PRESENTATION, LOGIC_POLISH_PRESENTATION, NUMBER_POLISH_PRESENTATION, puzzleInputDemoCompatible, puzzlePresentation } from "../src/components/puzzles/wordInput";
import { dealtSignature, stampSignature } from "../src/lib/duel/dealSignature";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { fillominoStrokes, trailUndoEach } from "../src/lib/duel/logicOverhaul2";
import { INTRO_EXAMPLE_ID, PUZZLE_DEMO_MAX_CHARS, isPuzzleDemoLog, type PuzzleDemoLog } from "../src/lib/duel/puzzleDemo";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { LOGIC_DEMO_GAMES, LOGIC_DEMOS_FILE } from "./logic-demos-lib";
import { exampleFor } from "./shots/examples";

interface DemoEntry {
  game_type: string;
  seed: number;
  example_id: string;
  start_tick: number;
  length_ticks: number;
  puzzle: PuzzleData;
  input_log: PuzzleDemoLog & { presentation?: string };
  answer: string;
  msRemaining: number;
  score: number;
}

let failed = 0;
let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}: ${(error as Error).message}`);
  }
}

const demos = JSON.parse(readFileSync(LOGIC_DEMOS_FILE, "utf8")) as Record<string, DemoEntry>;

check("one demo for each of the seven games, and only them", () => {
  assert.deepEqual([...Object.keys(demos)].sort(), [...LOGIC_DEMO_GAMES].sort());
  assert.deepEqual([...LOGIC2_DEMOS].sort(), [...LOGIC_DEMO_GAMES].sort());
});

for (const type of LOGIC_DEMO_GAMES) {
  const demo = demos[type];
  if (!demo) continue;
  const full = exampleFor(type as PuzzleType);

  check(`${type}: today's intro example on the stamps rooms deal`, () => {
    assert.equal(demo.game_type, type);
    assert.equal(demo.example_id, INTRO_EXAMPLE_ID);
    assert.equal(demo.seed, 0);
    assert.equal(demo.start_tick, 0);
    assert.deepEqual(demo.puzzle, JSON.parse(JSON.stringify(splitPuzzle(full).pub)), "the example's public half, exactly");
    assert.equal(stampSignature(demo.puzzle), dealtSignature(type), "the stamps a room deals today");
    if (type === "trail") assert.ok(trailUndoEach(demo.puzzle), "Trail on depthRev 3");
    if (type === "fillomino") assert.ok(fillominoStrokes(demo.puzzle), "Regions on fillominoRev 2");
  });

  check(`${type}: the run scores exactly what the server's grading says`, () => {
    const graded = gradeAnswer(full, demo.answer, demo.msRemaining);
    assert.equal(graded.isCorrect, true, "a correct finish");
    assert.equal(graded.score, demo.score, "the score the practice screen showed");
    assert.ok(demo.score >= 150 && demo.score <= 200, `a finish's score (${demo.score})`);
  });

  check(`${type}: a recording the intro player accepts`, () => {
    const log = demo.input_log;
    assert.ok(isPuzzleDemoLog(log));
    assert.ok(JSON.stringify(log).length <= PUZZLE_DEMO_MAX_CHARS);
    assert.equal(log.presentation, LOGIC2_PRESENTATION);
    assert.equal(log.presentation, puzzlePresentation(type));
    assert.ok(puzzleInputDemoCompatible(type, log));
    assert.ok(log.w > 300 && log.h > 300, "recorded on a phone-sized play area");
    assert.ok(log.actions.length > 0);
    let last = -1;
    for (const action of log.actions) {
      assert.ok(action.t >= last, "in time order");
      last = action.t;
      const points = action.action === "drag" ? [action.args.from, action.args.to] : "at" in action.args ? [action.args.at] : [];
      for (const p of points) assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1, "inside the play area");
    }
    assert.equal(demo.length_ticks, Math.round(last), "its length is its last touch");
    assert.ok(last <= 20_000, `short enough to loop (${last} ms)`);
  });

  check(`${type}: older demos stop`, () => {
    for (const presentation of [undefined, LOGIC_POLISH_PRESENTATION, NUMBER_POLISH_PRESENTATION, "oct6-ring-controls"])
      assert.equal(puzzleInputDemoCompatible(type, presentation === undefined ? {} : { presentation }), false, `${presentation ?? "none"}`);
  });
}

check("Trail and Regions demos from before their new stamps stop", () => {
  const trail = demos["trail"]!.puzzle as unknown as Record<string, unknown>;
  const fillomino = demos["fillomino"]!.puzzle as unknown as Record<string, unknown>;
  assert.equal(trailUndoEach({ ...trail, depthRev: 2 }), false);
  assert.equal(fillominoStrokes({ ...fillomino, fillominoRev: 1 }), false);
  const rules = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  assert.match(rules, /data\.type === "trail" && demo && !trailUndoEach\(demo\.puzzle\)\) return null/);
  assert.match(rules, /data\.type === "fillomino" && demo && !fillominoStrokes\(demo\.puzzle\)\) return null/);
});

console.log(`logic-demos-check: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log("FAIL");
  process.exit(1);
}
