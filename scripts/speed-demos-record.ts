/**
 * The Speed games' intro demos (15 Nov 2026, the merge captain's rule for every overhaul, as Action #436): one bot run per
 * engine game (Bonk, Tenfall, Pull!) on the stamp rooms deal today, written to scripts/fixtures/speed-demos.json in the
 * intro_demos row shape (`IntroDemoRow`), with the server's own score. Nothing is saved to any database here: the manual
 * "Save intro demos" workflow saves the rows after the final merge. speed-demos-check proves every row.
 *
 * Flash, Ascend and Don't Break the Chain are puzzle demos (touches recorded on the fixed intro example, not a run the
 * server replays), so they are not in this file.
 *
 * Each run plays the server's fixed intro example deal (see demoPuzzle), which scripts/speed-demos-save.ts asks the
 * server for again before saving.
 *
 *   bun scripts/speed-demos-record.ts [--check]   (--check rebuilds in memory and fails on any difference)
 */
import { writeFileSync, readFileSync } from "node:fs";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng } from "./puzzle-fairness/kit";
import { ELITE } from "./depth-engine-bands";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { DEMO_LENGTH_TICKS, DEMO_START_TICK, runSeed } from "../src/lib/arcade/introDemo";
import { withSeededRandom } from "../src/lib/duel/random";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

export const SPEED_DEMO_GAMES = ["whack", "tendrop", "clayshoot"] as const satisfies readonly PuzzleType[];
export const SPEED_DEMO_FIXTURE = "scripts/fixtures/speed-demos.json";
/** Bot attempts per game on the intro example; the row is the attempt whose run scores highest (first on a tie). */
export const SPEED_DEMO_ATTEMPTS = 6;
export const SPEED_DEMO_LIMIT_MS = 60_000;

export interface SpeedDemoRow {
  game_type: string;
  seed: number;
  puzzle: PuzzleData;
  input_log: { run: string };
  start_tick: number;
  length_ticks: number;
}

/** The fixture: `rows` are exactly the intro_demos columns the save writes; `proof` the server's score for each run. */
export interface SpeedDemoFixture {
  note: string;
  rows: SpeedDemoRow[];
  proof: Record<string, { score: number; bot: "elite" }>;
}

/**
 * The deal the save needs: the server's fixed intro example for `type` (practiceGenerateFn with `example: true`, the live
 * deal under INTRO_EXAMPLE_SEED), because saveIntroDemoFn only keeps a run on a deal the server sealed, and the example is
 * the one deal a script can ask the server for again and get the same seed.
 */
export function demoPuzzle(type: (typeof SPEED_DEMO_GAMES)[number]): PuzzleData {
  return withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type, { unblockRow: null }));
}

export function botRun(puzzle: PuzzleData, attempt: number): string {
  const kit = KITS[puzzle.type]!;
  const play = kit.play(puzzle, makeRng(hashText(`speed-demo:${puzzle.type}:${attempt}`)), ELITE, SPEED_DEMO_LIMIT_MS);
  return play.steps.at(-1)!.answer;
}

export const SPEED_DEMO_NOTE = "Speed intro demos: elite-bot runs on the stamps rooms deal (scripts/speed-demos-record.ts), proved by speed-demos-check; saved to the database only by the Save intro demos workflow.";

export function recordSpeedDemos(): SpeedDemoFixture {
  const rows: SpeedDemoRow[] = [];
  const proof: SpeedDemoFixture["proof"] = {};
  for (const type of SPEED_DEMO_GAMES) {
    let best: { row: SpeedDemoRow; score: number } | null = null;
    const puzzle = demoPuzzle(type);
    for (let attempt = 0; attempt < SPEED_DEMO_ATTEMPTS; attempt++) {
      const run = botRun(puzzle, attempt);
      const score = gradeAnswer(puzzle, run, 0).score;
      if (!best || score > best.score)
        best = { score, row: { game_type: type, seed: runSeed(run), puzzle: splitPuzzle(puzzle).pub, input_log: { run }, start_tick: DEMO_START_TICK, length_ticks: DEMO_LENGTH_TICKS } };
    }
    rows.push(best!.row);
    proof[type] = { score: best!.score, bot: "elite" };
  }
  return { note: SPEED_DEMO_NOTE, rows, proof };
}

export const speedDemoText = (fixture: SpeedDemoFixture) => JSON.stringify(fixture, null, 1) + "\n";

if (import.meta.main) {
  const fixture = recordSpeedDemos();
  const text = speedDemoText(fixture);
  if (process.argv.includes("--check")) {
    const same = readFileSync(SPEED_DEMO_FIXTURE, "utf8") === text;
    console.log(same ? "speed-demos fixture rebuilds byte for byte" : "FAIL speed-demos fixture differs from a fresh recording");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(SPEED_DEMO_FIXTURE, text);
  for (const r of fixture.rows) console.log(`${r.game_type}: seed ${r.seed}, score ${fixture.proof[r.game_type]!.score}, ${r.input_log.run.length} chars`);
}
