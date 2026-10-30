/**
 * Records scripts/fixtures/swing-rework-legacy.json for swing-rework-check: Grappler runs on every revision before
 * the swinging course (no stamp and swingRev 2–14), played by the skill-band bots (good, and weak on swingRev 14) and
 * random play through the server's own replay on unmodified main, with each run's score, final-state hash and the
 * result's hash. Run it in a checkout of main (the commit is noted in the file):
 *
 *   bun scripts/swing-rework-legacy.ts <out.json>
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { execSync } from "node:child_process";
import { swingCheckpoint, swingGameFor } from "../src/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "../src/lib/duel/swing";
import { SWING_V4_BANK } from "../src/lib/duel/swingBankV4.server";
import { SWING_V9_BANK } from "../src/lib/duel/swingBankV9.server";
import { SWING_V13_BANK } from "../src/lib/duel/swingBankV13.server";
import { bot, randomBot } from "./arcade-skill-bands/bots/swing";
import { Human } from "./arcade-skill-bands/human";
import { fnv } from "./arcade-tuning-a-legacy";
import { roomSeed } from "./arcade-skill-bands/games";

const out = process.argv[2] ?? "scripts/fixtures/swing-rework-legacy.json";
const REVS: (number | null)[] = [null, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14];
const seedsFor = (rev: number | null): number[] =>
  rev === 14 ? [roomSeed(3), roomSeed(40), roomSeed(10007)] : rev === 13 ? [SWING_V13_BANK[3]!.seed, SWING_V13_BANK[77]!.seed] : rev !== null && rev >= 9 ? [SWING_V9_BANK[5]!.seed, SWING_V9_BANK[150]!.seed] : rev !== null && rev >= 4 ? [SWING_V4_BANK[7]!.seed, SWING_V4_BANK[201]!.seed] : [12345, 987654321];
const runs: unknown[] = [];
for (const rev of REVS) {
  const game = swingGameFor(rev ?? undefined);
  for (const seed of seedsFor(rev)) {
    for (const style of rev === 14 ? (["weak", "good", "great", "random"] as const) : (["good", "random"] as const)) {
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
      const result = replaySwingRun(seed, raw, rev ?? undefined);
      runs.push({ rev, style, seed, score: result.score, flagged: Boolean(result.flagged), stateHash: fnv(JSON.stringify(result.state)), extra: fnv(JSON.stringify({ ...result, state: undefined, checkpoints: undefined })), raw: gzipSync(raw).toString("base64") });
      console.log(`rev ${rev ?? "-"} ${style} ${seed}: ${result.score}`);
    }
  }
}
const commit = execSync("git rev-parse --short HEAD").toString().trim();
writeFileSync(out, JSON.stringify({ recorded: `code on main before swingRev 15 (${commit})`, runs }));
console.log(`wrote ${runs.length} runs to ${out}`);
