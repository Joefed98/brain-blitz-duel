/**
 * Records scripts/fixtures/swing-slide-legacy.json for swing-slide-check: Grappler runs on swingRev 15 (the swinging
 * course) and swingRev 16 (its dark ledge runs), the two revisions before the sliding hooks (swingRev 17), played by
 * the skill-band bots (weak, good, great) and random play through the server's own replay on unmodified main, with
 * each run's score, final-state hash and the result's hash. Run it in a checkout of main (the commit is noted):
 *
 *   bun scripts/swing-slide-legacy.ts <out.json>
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { execSync } from "node:child_process";
import { swingCheckpoint, swingGameFor } from "../src/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "../src/lib/duel/swing";
import { bot, randomBot } from "./arcade-skill-bands/bots/swing";
import { Human } from "./arcade-skill-bands/human";
import { fnv } from "./arcade-tuning-a-legacy";
import { roomSeed } from "./arcade-skill-bands/games";

const out = process.argv[2] ?? "scripts/fixtures/swing-slide-legacy.json";
const REVS = [15, 16];
const SEEDS = [roomSeed(5), roomSeed(21), roomSeed(10011)];
const runs: unknown[] = [];
for (const rev of REVS) {
  const game = swingGameFor(rev);
  for (const seed of SEEDS) {
    for (const style of ["weak", "good", "great", "random"] as const) {
      const human = new Human("swing", seed, style === "random" ? "weak" : style);
      const ctx = { game, seed, rev, human };
      const res = style === "random" ? randomBot(ctx) : bot(ctx);
      const events = res.events ?? [];
      const byTick = new Map(events.map((e) => [e.t, e]));
      // Re-drive the sim from the log alone, with the phone's checkpoints every 300 ticks.
      let state = game.init(seed);
      const checkpoints: unknown[] = [];
      while (!game.isOver(state) && state.tick < game.runTicks) {
        state = game.step(state, byTick.get(state.tick + 1) ?? null);
        if (state.tick % 300 === 0) checkpoints.push(swingCheckpoint(state));
      }
      const raw = encodeSwingRun({ seed, claimedScore: game.score(state), events, inputs: [], taps: [], endTick: state.tick, checkpoints } as never);
      const result = replaySwingRun(seed, raw, rev);
      runs.push({ rev, style, seed, score: result.score, flagged: Boolean(result.flagged), stateHash: fnv(JSON.stringify(result.state)), extra: fnv(JSON.stringify({ ...result, state: undefined, checkpoints: undefined })), raw: gzipSync(raw).toString("base64") });
      console.log(`rev ${rev} ${style} ${seed}: ${result.score}`);
    }
  }
}
const commit = execSync("git rev-parse --short HEAD").toString().trim();
writeFileSync(out, JSON.stringify({ recorded: `code on main before swingRev 17 (${commit})`, runs }));
console.log(`wrote ${runs.length} runs to ${out}`);
