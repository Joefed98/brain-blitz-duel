/**
 * Records the Logic overhaul's intro demos (scripts/fixtures/logic-demos.json; logic-demos-lib.ts): Minefield's
 * skill-band bot plays the game's intro example deal (minesRev 3, Normal) at the great, near and good levels, and the
 * run whose first eight seconds open the most squares without a mine hit is kept (then the higher score). Re-run after
 * a stamp change; logic-demos-check proves the file.
 *
 *   bun scripts/logic-demos-record.ts
 */
import { writeFileSync } from "node:fs";
import { minesweeperGameFor, MINES_REV_NORMAL } from "../src/lib/arcade/minesweeper";
import { DEMO_LENGTH_TICKS, DEMO_START_TICK } from "../src/lib/arcade/introDemo";
import { Human } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/minesweeper";
import { DEMOS_FIXTURE, demoMoments, encodeDemoRun, exampleDeal, serverReplay, type DemoRow } from "./logic-demos-lib";

const SKILLS = ["great", "near", "good"] as const;
const puzzle = await exampleDeal("minesweeper");
const seed = puzzle.seed;
let best: { row: DemoRow; worth: number } | null = null;
for (const skill of SKILLS) {
  const out = bot({ game: minesweeperGameFor(MINES_REV_NORMAL), seed, rev: MINES_REV_NORMAL, human: new Human("minesweeper", seed, skill), fixes: true });
  const run = encodeDemoRun(seed, out.events ?? []);
  const { score, flagged } = serverReplay(seed, run);
  if (flagged) continue;
  const m = demoMoments(seed, run);
  const worth = (m.hits ? 0 : 1000) + m.opened * 10 + m.flags + score / 1000;
  console.log(`minesweeper seed ${seed} ${skill}: ${score} points, first ${DEMO_LENGTH_TICKS / 60} s ${JSON.stringify(m)}`);
  const row: DemoRow = { game_type: "minesweeper", seed, puzzle, input_log: { run }, start_tick: DEMO_START_TICK, length_ticks: DEMO_LENGTH_TICKS, skill, score };
  if (!best || worth > best.worth) best = { row, worth };
}
if (!best) throw new Error("minesweeper: no unflagged run");
writeFileSync(DEMOS_FIXTURE, JSON.stringify({ recordedOn: "minesRev 3, Normal, the intro example deal", rows: [best.row] }, null, 1) + "\n");
console.log("wrote 1 demo");
