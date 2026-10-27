/**
 * Roofbound fixtures for flip-x200-check (docs/expansions/x200-flip.md).
 *
 *   bun scripts/flip-x200-record.ts --legacy    # scripts/fixtures/flip-legacy-runs.json.gz: runs on the revisions
 *                                               # before the expansion (unstamped, 2, 4, 6). Recorded once, on the tree
 *                                               # before it (25 Oct 2026, the parked expansion's first commit); never re-record.
 *   bun scripts/flip-x200-record.ts --witness   # scripts/fixtures/flip-x200-witness.json.gz: a planned perfect route
 *                                               # (flip-x200-plan.ts) on every tuning and fresh seed, each a tap list
 *   bun scripts/flip-x200-record.ts --runs      # scripts/fixtures/flip-x200-runs.json.gz: skill-band runs on flipRev 8
 *
 * Every run is the skill-band bot's (or the planner's) input log through the server's own encode + replay.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { flipCheckpoint, flipGameFor, FLIP_REV_EXPAND, type FlipState } from "../src/lib/arcade/flip";
import { encodeFlipRun, replayFlipRun } from "../src/lib/duel/flip";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { bot } from "./arcade-skill-bands/bots/flip";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, LEVELS, type SkillLevel } from "./arcade-skill-bands/human";
import { flipTap, planFlipRoute } from "./flip-x200-plan";

export const FLIP_LEGACY_FIXTURE = new URL("./fixtures/flip-legacy-runs.json.gz", import.meta.url);
export const FLIP_WITNESS_FIXTURE = new URL("./fixtures/flip-x200-witness.json.gz", import.meta.url);
export const FLIP_RUNS_FIXTURE = new URL("./fixtures/flip-x200-runs.json.gz", import.meta.url);
/** The seed sets the tuning reports on (docs/expansions/x200-flip.md): 60 tuning seeds and 200 fresh ones. */
export const FLIP_TUNING_SEEDS = Array.from({ length: 60 }, (_, n) => roomSeed(n));
export const FLIP_FRESH_SEEDS = Array.from({ length: 200 }, (_, n) => roomSeed(10000 + n));

export interface FlipLegacyRun {
  rev: number | null;
  level: string;
  seed: number;
  raw: string;
  score: number;
  checkpoint: unknown;
}

export interface FlipWitness {
  seed: number;
  /** Tap ticks of a route that takes everything and lasts the minute. */
  taps: number[];
}

/** Plays an input log on a revision and encodes it as the phone does (checkpoints every 300 ticks). */
export function encodeFlipLog(rev: number | null, seed: number, events: ArcadeInputEvent[]): { raw: string; local: number; state: FlipState } {
  const game = flipGameFor(rev);
  let state = game.init(seed) as FlipState;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null) as FlipState;
    if (state.tick % 300 === 0) checkpoints.push(flipCheckpoint(state));
  }
  const raw = encodeFlipRun({ seed, claimedScore: game.score(state), events, inputs: [], taps: [], endTick: state.tick, checkpoints } as never);
  return { raw, local: game.score(state), state };
}

function record(plan: [number | null, number][], levels: readonly SkillLevel[], base: (rev: number | null, n: number) => number): FlipLegacyRun[] {
  const out: FlipLegacyRun[] = [];
  for (const [rev, perLevel] of plan) {
    const game = flipGameFor(rev);
    for (const level of levels) {
      for (let n = 0; n < perLevel; n++) {
        const seed = roomSeed(base(rev, n));
        const human = new Human("flip", seed, level);
        const { events = [] } = bot({ game, seed, rev, human, fixes: rev === FLIP_REV_EXPAND });
        const { raw } = encodeFlipLog(rev, seed, events);
        const result = replayFlipRun(seed, raw, rev);
        out.push({ rev, level, seed, raw, score: result.score, checkpoint: flipCheckpoint(result.state) });
      }
    }
  }
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes("--legacy")) {
    const runs = record([[6, 6], [4, 2], [2, 2], [null, 2]], LEVELS, (rev, n) => 700 + n + (rev ?? 0) * 31);
    writeFileSync(FLIP_LEGACY_FIXTURE, gzipSync(JSON.stringify(runs)));
    console.log(`${runs.length} legacy runs`);
  }
  if (args.includes("--runs")) {
    const runs = record([[FLIP_REV_EXPAND, 2]], ["weak", ...LEVELS, "elite"], (_rev, n) => 900 + n);
    writeFileSync(FLIP_RUNS_FIXTURE, gzipSync(JSON.stringify(runs)));
    console.log(`${runs.length} flipRev ${FLIP_REV_EXPAND} runs: ${runs.map((r) => `${r.level}=${r.score}`).join(" ")}`);
  }
  if (args.includes("--witness")) {
    const game = flipGameFor(FLIP_REV_EXPAND);
    const out: FlipWitness[] = [];
    for (const seed of [...FLIP_TUNING_SEEDS, ...FLIP_FRESH_SEEDS]) {
      const route = planFlipRoute(game, game.init(seed));
      if (!route) throw new Error(`seed ${seed}: no route lasts the minute`);
      const { raw } = encodeFlipLog(FLIP_REV_EXPAND, seed, route.taps.map(flipTap));
      const score = replayFlipRun(seed, raw, FLIP_REV_EXPAND).score;
      if (score !== 200) console.log(`  seed ${seed}: the planned route scores ${score}`);
      out.push({ seed, taps: route.taps });
    }
    writeFileSync(FLIP_WITNESS_FIXTURE, gzipSync(JSON.stringify(out)));
    console.log(`${out.length} witness routes`);
  }
}
