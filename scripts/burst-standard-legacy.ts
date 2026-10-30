/**
 * Records the legacy fixture for burst-standard-check (the arcade scoring standard, burstRev 10): Fission runs on every
 * older stamp (unstamped, burstRev 2, 3, 4, 5, 6, 8 and 9), played by the skill-band bot (weak and elite) and random
 * input on three room seeds each, with the server replay's score and a SHA-256 of the replayed final state.
 * Run it on a checkout of main from before burstRev 10 (the fixture was recorded on 73f6bb7):
 *
 *   bun scripts/burst-standard-legacy.ts            # writes scripts/fixtures/burst-standard-legacy.json.gz
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { burstCheckpoint, burstGameFor, BURST_CHECKPOINT_INTERVAL, BURST_INPUT_FIRE, BURST_INPUT_MOVE, BURST_WORLD_W } from "../src/lib/arcade/burst";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeBurstRun, replayBurstRun } from "../src/lib/duel/burst";
import { bot } from "./arcade-skill-bands/bots/burst";
import { Human } from "./arcade-skill-bands/human";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";

const REVS: (number | null)[] = [null, 2, 3, 4, 5, 6, 8, 9];
const spec = GAME_BY_TYPE.get("burst")!;

export const digest = (state: unknown): string => createHash("sha256").update(JSON.stringify(state)).digest("hex");

function randomEvents(seed: number, runTicks: number): ArcadeInputEvent[] {
  let a = (seed ^ 0x5157) >>> 0;
  const r = () => (a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296;
  const events: ArcadeInputEvent[] = [];
  for (let t = 1; t < runTicks; t += 5 + Math.floor(r() * 30)) {
    const fire = r() < 0.6;
    events.push({ t, k: fire ? BURST_INPUT_FIRE : BURST_INPUT_MOVE, a: fire ? 0 : Math.floor(r() * BURST_WORLD_W), b: fire ? Math.floor(r() * 2) : 0, c: 0, d: 0 });
  }
  return events;
}

const runs: { rev: number | null; seed: number; who: string; raw: string; score: number; state: string }[] = [];
for (const rev of REVS) {
  const game = burstGameFor(rev);
  for (const n of [0, 5, 11]) {
    const seed = spec.seedFor(n);
    for (const who of ["weak", "elite", "random"] as const) {
      const events = who === "random" ? randomEvents(seed, game.runTicks) : (bot({ game, seed, rev, human: new Human("burst", seed, who), fixes: true }).events ?? []);
      const byTick = new Map(events.map((e) => [e.t, e]));
      let s = game.init(seed);
      const checkpoints: unknown[] = [];
      while (!game.isOver(s) && s.tick < game.runTicks) {
        s = game.step(s, byTick.get(s.tick + 1) ?? null);
        if (s.tick % BURST_CHECKPOINT_INTERVAL === 0) checkpoints.push(burstCheckpoint(s));
      }
      const raw = encodeBurstRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints } as never);
      const replay = replayBurstRun(seed, raw, rev);
      runs.push({ rev, seed, who, raw, score: replay.score, state: digest(replay.state) });
    }
  }
}
const out = "scripts/fixtures/burst-standard-legacy.json.gz";
writeFileSync(out, gzipSync(JSON.stringify({ recorded: "2026-10-29", commit: "73f6bb7", runs })));
console.log(`wrote ${runs.length} runs to ${out}`);
