/**
 * Records the Orbit runs orbit-rev11-check replays (scripts/fixtures/orbit-rev11-legacy.json.gz).
 *
 * Recorded on main BEFORE orbitRev 11 changed any sim file (25 Oct 2026): the skill-band bots
 * (scripts/arcade-skill-bands/bots/orbit.ts) play bank courses at four levels on orbitRev 10 (what
 * rooms dealt until orbitRev 11), 8 and 7, each run's log goes through the server's encode + replay,
 * and the stored score, final checkpoint and result line are what the check must reproduce exactly.
 *
 *   bun scripts/orbit-rev11-record.ts [--seeds=8]
 *
 * Re-run only to re-record a fixture from a tree where those revisions are unchanged.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { orbitCheckpoint, ORBIT_REV_STRICT, ORBIT_REV_SWEPT, ORBIT_REV_TALL } from "../src/lib/arcade/orbit";
import { GAMES } from "./arcade-skill-bands/games";
import { Human, LEVELS } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/orbit";

const SEEDS = Number(process.argv.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 8);
const spec = GAMES.find((g) => g.type === "orbit")!;
const runs: any[] = [];
for (const rev of [ORBIT_REV_STRICT, ORBIT_REV_TALL, ORBIT_REV_SWEPT]) {
  for (let n = 0; n < SEEDS; n++) {
    for (const level of LEVELS) {
      const seed = spec.seedFor(n + 200);
      const game = spec.gameFor(rev, seed);
      const out = bot({ game, seed, rev, human: new Human("orbit", seed, level) });
      let state = game.init(seed);
      const byTick = new Map((out.events ?? []).map((e) => [e.t, e]));
      const checkpoints: unknown[] = [];
      while (!game.isOver(state) && state.tick < game.runTicks) {
        state = game.step(state, byTick.get(state.tick + 1) ?? null);
        if (state.tick % 300 === 0) checkpoints.push(orbitCheckpoint(state));
      }
      const score = game.score(state);
      const body = { seed, claimedScore: score, events: out.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints };
      const raw = appendClientCounters(spec.encode(body, rev, seed), arcadeCounters("orbit", state, score));
      const result = spec.replay(seed, raw, rev);
      if (result.score !== score) throw new Error(`replay disagrees on rev ${rev} seed ${seed} ${level}`);
      runs.push({ rev, seed, level, raw, score: result.score, final: orbitCheckpoint(result.state).checksum, tick: result.state.tick, best: result.state.best });
    }
  }
  console.log(`rev ${rev}: ${runs.filter((r) => r.rev === rev).length} runs`);
}
writeFileSync("scripts/fixtures/orbit-rev11-legacy.json.gz", gzipSync(JSON.stringify({ recorded: "2026-10-25 on main 5ea3e48, before orbitRev 11", runs })));
console.log(`wrote ${runs.length} runs`);
