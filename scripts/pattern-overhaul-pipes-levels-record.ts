/**
 * Records the Normal fixture for pattern-overhaul-pipes-levels-check (difficulty levels, 15 Nov 2026): Pipeline's
 * Normal deal on the tree BEFORE its levels landed, so the check proves Normal is byte for byte today's deal. Run on
 * the tree before the change (it only uses APIs that existed then):
 *
 *   bun scripts/pattern-overhaul-pipes-levels-record.ts [--out=<path>]
 *
 * Each entry is a room deal (seeded Math.random, the room seed as bankSeed) stored whole: today's stamps and the
 * older stamps a check pins (pre-pattern-overhaul).
 */
import { writeFileSync } from "node:fs";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData } from "../src/lib/duel/types";

export const PIPES_LEVELS_NORMAL_FIXTURE = "scripts/fixtures/pattern-overhaul-pipes-levels-normal.json";
export const PIPES_LEVELS_NORMAL_SEEDS = Array.from({ length: 40 }, (_, i) => 152_000 + 37 * i);

export interface PipesLevelsNormalFixture {
  /** The live deal on each seed. */
  live: { seed: number; puzzle: PuzzleData }[];
  /** The deal with the Pattern overhaul pinned off (pinPrePatternNov15), the first 10 seeds. */
  prePattern: { seed: number; puzzle: PuzzleData }[];
}

export async function dealNormal(seed: number): Promise<PuzzleData> {
  return withSeededRandom(seed, () => generatePuzzle("pipes", { bankSeed: seed }));
}

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? PIPES_LEVELS_NORMAL_FIXTURE;
  const { pinPrePatternNov15 } = await import("../src/lib/duel/patternNov15");
  const live = [];
  for (const seed of PIPES_LEVELS_NORMAL_SEEDS) live.push({ seed, puzzle: await dealNormal(seed) });
  const prePattern = [];
  const was = pinPrePatternNov15(true);
  try {
    for (const seed of PIPES_LEVELS_NORMAL_SEEDS.slice(0, 10)) prePattern.push({ seed, puzzle: await dealNormal(seed) });
  } finally {
    pinPrePatternNov15(was);
  }
  writeFileSync(out, `${JSON.stringify({ live, prePattern } satisfies PipesLevelsNormalFixture)}\n`);
  console.log(`wrote ${live.length} + ${prePattern.length} Normal deals to ${out}`);
}
