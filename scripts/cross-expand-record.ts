/**
 * Jaywalk expansion fixtures (crossRev 8, 25 Oct 2026). Plays the skill-band bot
 * (scripts/arcade-skill-bands/bots/cross.ts) on room seeds and saves each run's
 * phone log with the score, final state digest and checkpoints the sim gave.
 *
 *   bun scripts/cross-expand-record.ts --legacy   # crossRev 3 and 7 runs (recorded on main before crossRev 8)
 *   bun scripts/cross-expand-record.ts --new      # crossRev 8 runs (re-record after a deliberate crossRev 8 change)
 *
 * scripts/cross-expand-check.ts replays them and fails on any difference.
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { crossCheckpoint, crossGameFor, type CrossState } from "../src/lib/arcade/cross";
import { encodeCrossRun } from "../src/lib/duel/cross";
import { type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { Human, LEVELS } from "./arcade-skill-bands/human";
import { roomSeed } from "./arcade-skill-bands/games";
import { bot } from "./arcade-skill-bands/bots/cross";

export interface CrossFixtureRun {
  rev: number | null;
  level: string;
  seed: number;
  raw: string;
  score: number;
  digest: number;
  crossings: number;
  lives: number;
}

/** FNV-1a over the whole final state (sorted keys, courses left out: they come from the seed). */
export function crossStateDigest(state: CrossState): number {
  let h = 0x811c9dc5;
  const text = JSON.stringify(
    Object.keys(state)
      .filter((k) => k !== "courses")
      .sort()
      .map((k) => [k, (state as unknown as Record<string, unknown>)[k]]),
  );
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function playCrossRun(rev: number | null, seed: number, level: (typeof LEVELS)[number]): CrossFixtureRun {
  const game = crossGameFor(rev);
  const human = new Human("cross", seed, level);
  const out = bot({ game, seed, rev, human });
  const events: ArcadeInputEvent[] = out.events ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let state = game.init(seed) as CrossState;
  const checkpoints = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(crossCheckpoint(state));
  }
  const score = game.score(state);
  const raw = encodeCrossRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
  return { rev, level, seed, raw, score, digest: crossStateDigest(state), crossings: state.crossings, lives: state.lives };
}

if (import.meta.main) {
  const legacy = process.argv.includes("--legacy");
  const revs: (number | null)[] = legacy ? [3, 7] : [8];
  const perLevel = legacy ? 5 : 6;
  const runs: CrossFixtureRun[] = [];
  for (const rev of revs)
    for (const level of LEVELS)
      for (let n = 0; n < perLevel; n++) runs.push(playCrossRun(rev, roomSeed(1000 + n * 7 + (rev ?? 0)), level));
  const path = legacy ? "scripts/fixtures/cross-expand-legacy.json.gz" : "scripts/fixtures/cross-expand-runs.json.gz";
  writeFileSync(path, gzipSync(JSON.stringify(runs)));
  console.log(`${runs.length} runs → ${path}`);
  for (const r of runs) console.log(`rev ${r.rev} ${r.level.padEnd(8)} seed ${r.seed} score ${r.score} crossings ${r.crossings} lives ${r.lives}`);
}
