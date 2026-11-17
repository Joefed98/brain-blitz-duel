/**
 * Records the Sports overhaul's intro demos (15 Nov 2026; the merge captain's demo pattern): for Cue Ball, Curl Champ and
 * Apex, a near-perfect skill-band bot's run on each game's intro example dealt on the stamp rooms deal today, written to
 * scripts/fixtures/sports-demos.json as the very rows `upsertIntroDemo` stores (game_type, seed, the puzzle's public half,
 * input_log { run }, start_tick, length_ticks), plus the score the server's replay gives the run. Nobody saves these to
 * the live database from here: a manual "Save intro demos" workflow does that after the final merge.
 * sports-demos-check proves every row.
 *
 *   bun scripts/sports-demos-record.ts
 */
import { writeFileSync } from "node:fs";

import { DEMO_LENGTH_TICKS, DEMO_START_TICK, runSeed } from "../src/lib/arcade/introDemo";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { exampleFor } from "./shots/examples";
import { SPORTS_OVERHAUL_GAMES, sportsRunFor } from "./screens/sports-fixture";

const rows = [];
for (const type of SPORTS_OVERHAUL_GAMES) {
  const { pub } = splitPuzzle(exampleFor(type));
  const { answer, score } = sportsRunFor(type, pub as unknown as Record<string, unknown>, "near");
  rows.push({
    game_type: type,
    seed: runSeed(answer),
    puzzle: pub,
    input_log: { run: answer },
    start_tick: DEMO_START_TICK,
    length_ticks: DEMO_LENGTH_TICKS,
    score,
  });
  console.log(`  ${type}: seed ${runSeed(answer)}, sim score ${score}, ${answer.length} chars`);
}
writeFileSync("scripts/fixtures/sports-demos.json", JSON.stringify({ recorded: "15 Nov 2026, the Sports overhaul (stage 3's start)", demos: rows }, null, 1) + "\n");
