/**
 * Builds Blockzone's level deals, src/lib/duel/blockfallLevelDeals.server.ts (blockfallRev 3, D5's ladder, 23 Nov 2026;
 * docs/arcade-standard/blockfall.md "Levels (D5, 23 Nov 2026)"): for Easy, Hard and Expert a list of
 * BLOCKFALL_LEVEL_DEAL_SIZE seeds, each one the oracle held to Joe's human limits (scripts/blockfall-limited-oracle.ts:
 * 0.25 s to react to a piece, 0.15 s a gesture, every landing planned in time on the level's own gravity and lock delay)
 * takes to exactly 200 on blockfallRev 3 at that level through the server's own encode + replay path, its log keeping
 * the limits. A seed it cannot take to 200 is dropped from that level. Candidates come from the same fixed hash of 0, 1,
 * 2, … as Normal's deal (scripts/blockfall-deal.ts `hashSeed`). Normal is unchanged (blockfallRev 2's own deal).
 *
 *   bun scripts/blockfall-level-deal.ts          # rebuild the file (~25 min on a shared 4-core machine)
 *   bun scripts/blockfall-level-deal.ts --check  # prove the file is what this script builds, without writing
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BLOCKFALL_REV_LEVELS } from "../src/lib/arcade/blockfall";
import type { Level } from "../src/lib/levels/levels";
import { hashSeed } from "./blockfall-deal";
import { blockfallKeepsLimits, blockfallLimitedRun } from "./blockfall-limited-oracle";

export const BLOCKFALL_LEVEL_DEAL_SIZE = 300;
export const BLOCKFALL_DEAL_LEVELS = ["easy", "hard", "expert"] as const satisfies readonly Exclude<Level, "normal">[];
const FILE = new URL("../src/lib/duel/blockfallLevelDeals.server.ts", import.meta.url);

/** The seed's proof at a level: the limited oracle's stored score through the server replay (−1 when flagged or off the limits). */
export function blockfallLevelProof(seed: number, level: Exclude<Level, "normal">): number {
  const run = blockfallLimitedRun(seed, BLOCKFALL_REV_LEVELS, level);
  if (run.result.flagged || !blockfallKeepsLimits(seed, BLOCKFALL_REV_LEVELS, level, run.events)) return -1;
  return run.result.score;
}

if (import.meta.main) {
  const lists: Record<string, number[]> = {};
  const dropped: Record<string, number> = {};
  for (const level of BLOCKFALL_DEAL_LEVELS) {
    const seeds: number[] = [];
    let drop = 0;
    for (let n = 0; seeds.length < BLOCKFALL_LEVEL_DEAL_SIZE; n++) {
      const seed = hashSeed(n);
      if (blockfallLevelProof(seed, level) === 200) seeds.push(seed);
      else drop++;
      if (n > 5000) throw new Error(`${level}: too few seeds pass (${seeds.length})`);
    }
    lists[level] = seeds;
    dropped[level] = drop;
    console.log(`${level}: ${seeds.length} seeds (${drop} dropped)`);
  }
  const block = (level: string) => `  ${level}: [\n${lists[level]!.map((s) => `    ${s},`).join("\n")}\n  ],`;
  const text = `/**
 * Blockzone's level deals (blockfallRev 3, D5's ladder, 23 Nov 2026; docs/arcade-standard/blockfall.md "Levels (D5, 23
 * Nov 2026)"): for Easy, Hard and Expert ${BLOCKFALL_LEVEL_DEAL_SIZE} seeds, each one the oracle held to the human limits
 * (scripts/blockfall-limited-oracle.ts: 0.25 s to react to a piece, 0.15 s a gesture) takes to exactly 200 on that level
 * through the server replay. Built by \`bun scripts/blockfall-level-deal.ts\` (${BLOCKFALL_DEAL_LEVELS.map((l) => `${l}: ${dropped[l]} dropped`).join("; ")});
 * blockfall-ladder-check re-proves them. A level deals BLOCKFALL_LEVEL_DEALS[level][room seed % length]; Normal deals
 * blockfallRev 2 from its own deal (blockfallDealV2.server.ts).
 */
import type { Level } from "@/lib/levels/levels";

export const BLOCKFALL_LEVEL_DEALS: Readonly<Record<"easy" | "hard" | "expert", readonly number[]>> = {
${BLOCKFALL_DEAL_LEVELS.map(block).join("\n")}
};

/** The proved seed a room deals at a level for its own random seed (blockfallRev 3). */
export function blockfallLevelDealSeed(roomSeed: number, level: Exclude<Level, "normal">): number {
  const list = BLOCKFALL_LEVEL_DEALS[level];
  return list[(roomSeed >>> 0) % list.length]!;
}
`;
  if (process.argv.includes("--check")) {
    const same = readFileSync(FILE, "utf8") === text;
    console.log(same ? "PASS blockfall-level-deal: the file is what this script builds" : "FAIL blockfall-level-deal: the file differs from this script's build");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(FILE, text);
  console.log(`wrote ${FILE.pathname}`);
}
