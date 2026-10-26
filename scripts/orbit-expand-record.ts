/**
 * Records the orbitRev 12 runs orbit-expand-check replays (scripts/fixtures/orbit-x200-runs.json.gz): the
 * skill-band bots at every level (weak to elite) on feature-bank courses rooms deal (seed indices 300 on, outside
 * the tuning and fresh sets), each log through the server's encode + replay, with its score, final checkpoint
 * checksum and tick.
 *
 *   bun scripts/orbit-expand-record.ts [--seeds=4]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { orbitCheckpoint, ORBIT_REV_XP } from "../src/lib/arcade/orbit";
import { GAMES } from "./arcade-skill-bands/games";
import { BAND_LEVELS, Human } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/orbit";

const SEEDS = Number(process.argv.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 4);
const spec = GAMES.find((g) => g.type === "orbit")!;
const rev = ORBIT_REV_XP;
const runs: any[] = [];
for (let n = 300; n < 300 + SEEDS; n++) {
  for (const level of BAND_LEVELS) {
    const seed = spec.seedForX!(n);
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
    if (result.score !== score || result.flagged) throw new Error(`replay disagrees on seed ${seed} ${level}`);
    runs.push({ rev, seed, level, raw, score: result.score, final: orbitCheckpoint(result.state).checksum, tick: result.state.tick, best: result.state.best });
    console.log(`${level} seed ${seed}: ${result.score}`);
  }
}
writeFileSync("scripts/fixtures/orbit-x200-runs.json.gz", gzipSync(JSON.stringify({ recorded: "2026-10-26, orbitRev 12 (docs/expansions/x200-orbit.md)", runs })));
console.log(`wrote ${runs.length} runs`);
