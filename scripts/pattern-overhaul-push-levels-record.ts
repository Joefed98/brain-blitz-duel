/**
 * Records the Normal fixture for pattern-overhaul-push-levels-check (difficulty levels, 16 Nov 2026): Heave's Normal
 * deal on the tree before its levels (recorded on a `git archive` of f09e31446, the branch before Heave's levels), so
 * the check proves Normal stays byte for byte that deal.
 *
 *   bun scripts/pattern-overhaul-push-levels-record.ts [--out=<path>]
 *
 * Each entry is a room deal (seeded Math.random, the room seed as bankSeed) stored whole.
 */
import { writeFileSync } from "node:fs";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData } from "../src/lib/duel/types";

export const PUSH_LEVELS_NORMAL_FIXTURE = "scripts/fixtures/pattern-overhaul-push-levels-normal.json";
export const PUSH_LEVELS_NORMAL_SEEDS = Array.from({ length: 40 }, (_, i) => 161_000 + 43 * i);

export interface PushLevelsNormalFixture {
  live: { seed: number; puzzle: PuzzleData }[];
}

export function dealPushNormal(seed: number): PuzzleData {
  return withSeededRandom(seed, () => generatePuzzle("push", { bankSeed: seed }));
}

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? PUSH_LEVELS_NORMAL_FIXTURE;
  const live = PUSH_LEVELS_NORMAL_SEEDS.map((seed) => ({ seed, puzzle: dealPushNormal(seed) }));
  writeFileSync(out, `${JSON.stringify({ live } satisfies PushLevelsNormalFixture)}\n`);
  console.log(`wrote ${live.length} Normal deals to ${out}`);
}
