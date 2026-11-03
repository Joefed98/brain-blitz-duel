/**
 * Builds Blockfall's deal, src/lib/duel/blockfallDeal.server.ts (blockfallRev 1): 300 seeds, every one proved by the
 * oracle (scripts/blockfall-oracle.ts) to score exactly 200 through the server's own encode + replay path. Seeds come
 * from a fixed hash of 0, 1, 2, … (the skill-band tool's roomSeed); a seed the oracle cannot take to 200 is dropped.
 *
 *   bun scripts/blockfall-deal.ts          # rebuild the file
 *   bun scripts/blockfall-deal.ts --check  # prove the file is what this script builds, without writing
 *
 * `--rev=2` builds Blockzone's deal (blockfallRev 2, 3 Nov 2026: 90 s, no hold), src/lib/duel/blockfallDealV2.server.ts,
 * the same way from the same seed list.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { blockfallOracleRun } from "./blockfall-oracle";

export const BLOCKFALL_DEAL_SIZE = 300;
const REV = Number(process.argv.find((a) => a.startsWith("--rev="))?.slice(6) ?? 1);
const FILE = new URL(REV >= 2 ? "../src/lib/duel/blockfallDealV2.server.ts" : "../src/lib/duel/blockfallDeal.server.ts", import.meta.url);

export function hashSeed(n: number): number {
  let x = (n + 1) * 0x9e3779b1;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

/** The oracle's stored score on `seed` through the server replay (−1 when the replay flags it). */
export function provedScore(seed: number, rev = 1): number {
  const r = blockfallOracleRun(seed, rev).result;
  return r.flagged ? -1 : r.score;
}

if (import.meta.main) {
  const seeds: number[] = [];
  let dropped = 0;
  for (let n = 0; seeds.length < BLOCKFALL_DEAL_SIZE; n++) {
    const seed = hashSeed(n);
    if (provedScore(seed, REV) === 200) seeds.push(seed);
    else dropped++;
  }
  const text = REV >= 2 ? `/**
 * Blockzone's deal (blockfallRev 2, 3 Nov 2026): ${BLOCKFALL_DEAL_SIZE} seeds, each proved by the oracle
 * (scripts/blockfall-oracle.ts, \`rev\` 2: no hold, 90 s) to score exactly 200 through the server replay. Built by
 * \`bun scripts/blockfall-deal.ts --rev=2\` (${dropped} seeds dropped); blockfall-check re-proves them. Rooms deal
 * BLOCKFALL_DEAL_V2[room seed % length].
 */
export const BLOCKFALL_DEAL_V2: readonly number[] = [
${seeds.map((s) => `  ${s},`).join("\n")}
];

/** The proved seed a room deals for its own random seed (blockfallRev 2). */
export function blockfallDealSeedV2(roomSeed: number): number {
  return BLOCKFALL_DEAL_V2[(roomSeed >>> 0) % BLOCKFALL_DEAL_V2.length]!;
}
` : `/**
 * Blockfall's deal (blockfallRev 1, 1 Nov 2026): ${BLOCKFALL_DEAL_SIZE} seeds, each proved by the oracle
 * (scripts/blockfall-oracle.ts) to score exactly 200 through the server replay. Built by \`bun scripts/blockfall-deal.ts\`
 * (${dropped} seeds dropped); blockfall-check re-proves them. Rooms deal BLOCKFALL_DEAL[room seed % length].
 */
export const BLOCKFALL_DEAL: readonly number[] = [
${seeds.map((s) => `  ${s},`).join("\n")}
];

/** The proved seed a room deals for its own random seed. */
export function blockfallDealSeed(roomSeed: number): number {
  return BLOCKFALL_DEAL[(roomSeed >>> 0) % BLOCKFALL_DEAL.length]!;
}
`;
  if (process.argv.includes("--check")) {
    const same = readFileSync(FILE, "utf8") === text;
    console.log(same ? "PASS blockfall-deal: the file is what this script builds" : "FAIL blockfall-deal: the file differs from this script's build");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(FILE, text);
  console.log(`wrote ${BLOCKFALL_DEAL_SIZE} seeds (${dropped} dropped)`);
}
