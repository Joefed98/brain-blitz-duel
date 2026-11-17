/**
 * Records Crazy Golf's intro demo (scripts/fixtures/crazy-golf-demos.json): the golfRev 3 skill-band bot at the elite
 * level on the game's intro example deal (Normal), scored through the server's replay. Re-run after the hole bank or the
 * example deal changes; crazy-golf-demos-check fails until it is.
 *
 *   bun scripts/crazy-golf-demos-record.ts
 */
import { writeFileSync } from "node:fs";
import { minigolfGameFor, MINIGOLF_REV_COURSE } from "../src/lib/arcade/minigolf";
import { DEMO_LENGTH_TICKS, DEMO_START_TICK } from "../src/lib/arcade/introDemo";
import { Human } from "./arcade-skill-bands/human";
import { botV3 } from "./arcade-skill-bands/bots/minigolfV3";
import { DEMOS_FIXTURE, demoMoments, encodeDemoRun, exampleDeal, serverReplay, type DemoRow } from "./crazy-golf-demos-lib";

const puzzle = await exampleDeal("minigolf");
const game = minigolfGameFor(puzzle.pars, MINIGOLF_REV_COURSE, { holes: puzzle.holes, level: "normal" });
let best: DemoRow | null = null;
// The elite bot on a few of its own human seeds: the first run with a stroke in the demo's window and the best score.
for (let k = 0; k < 8; k++) {
  const human = new Human("minigolf", puzzle.seed * 7 + k, "elite");
  const { events } = botV3({ game, seed: puzzle.seed, rev: MINIGOLF_REV_COURSE, human } as never) as { events: never[] };
  const run = encodeDemoRun(puzzle, events);
  const r = serverReplay(puzzle, run);
  if (r.flagged || demoMoments(puzzle, run).strokes < 1) continue;
  if (!best || r.score > best.score) best = { game_type: "minigolf", seed: puzzle.seed, puzzle, input_log: { run }, start_tick: DEMO_START_TICK, length_ticks: DEMO_LENGTH_TICKS, skill: "elite", score: r.score };
}
if (!best) throw new Error("no demo run with a stroke in the demo window");
writeFileSync(DEMOS_FIXTURE, `${JSON.stringify({ rows: [best] }, null, 1)}\n`);
console.log(`crazy-golf demo: seed ${best.seed}, ${best.score} points, ${JSON.stringify(demoMoments(puzzle, best.input_log.run))}`);
