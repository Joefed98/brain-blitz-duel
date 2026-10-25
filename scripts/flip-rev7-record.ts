/**
 * Records Roofbound runs on the revisions before flipRev 7 (unstamped, 2, 4, 6) for flip-rev7-check:
 * each run's encoded log, its replayed score and final checkpoint, played by the skill-band bot
 * through the server's own encode + replay. Recorded once on the tree before flipRev 7 (25 Oct 2026).
 *
 *   bun scripts/flip-rev7-record.ts            # writes scripts/fixtures/flip-legacy-runs.json.gz
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { flipCheckpoint, flipGameFor, type FlipState } from "../src/lib/arcade/flip";
import { encodeFlipRun, replayFlipRun } from "../src/lib/duel/flip";
import { bot } from "./arcade-skill-bands/bots/flip";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, LEVELS } from "./arcade-skill-bands/human";

export const FLIP_LEGACY_FIXTURE = new URL("./fixtures/flip-legacy-runs.json.gz", import.meta.url);

export interface FlipLegacyRun {
  rev: number | null;
  level: string;
  seed: number;
  raw: string;
  score: number;
  checkpoint: unknown;
}

function record(): FlipLegacyRun[] {
  const out: FlipLegacyRun[] = [];
  const plan: [number | null, number][] = [[6, 6], [4, 2], [2, 2], [null, 2]];
  for (const [rev, perLevel] of plan) {
    const game = flipGameFor(rev);
    for (const level of LEVELS) {
      for (let n = 0; n < perLevel; n++) {
        const seed = roomSeed(700 + n + (rev ?? 0) * 31);
        const human = new Human("flip", seed, level);
        const { events = [] } = bot({ game, seed, rev, human });
        let state = game.init(seed) as FlipState;
        const byTick = new Map(events.map((e) => [e.t, e]));
        const checkpoints: unknown[] = [];
        while (!game.isOver(state) && state.tick < game.runTicks) {
          state = game.step(state, byTick.get(state.tick + 1) ?? null) as FlipState;
          if (state.tick % 300 === 0) checkpoints.push(flipCheckpoint(state));
        }
        const raw = encodeFlipRun({ seed, claimedScore: game.score(state), events, inputs: [], taps: [], endTick: state.tick, checkpoints } as never);
        const result = replayFlipRun(seed, raw, rev);
        out.push({ rev, level, seed, raw, score: result.score, checkpoint: flipCheckpoint(result.state) });
      }
    }
  }
  return out;
}

if (import.meta.main) {
  const runs = record();
  writeFileSync(FLIP_LEGACY_FIXTURE, gzipSync(JSON.stringify(runs)));
  console.log(`${runs.length} runs: ${runs.map((r) => `${r.rev ?? 1}/${r.level}=${r.score}`).join(" ")}`);
}
