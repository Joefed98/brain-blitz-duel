/**
 * Builds Tempo's beatRev 13 deal, src/lib/duel/beatDealV13.server.ts (D5's ladder, 23 Nov 2026;
 * docs/arcade-standard/beat.md "Levels (D5, 23 Nov 2026)"): for each level (Normal, Easy, Hard, Expert) a list of
 * BEAT_DEAL_V13_SIZE seeds, each proved on beatRev 13 at that level twice over:
 *
 *  1. the chart is playable by two thumbs at Joe's human limits (scripts/beat-thumbs.ts: a thumb needs 0.15 s to reach a
 *     note in another lane, never more than two notes down at once, held tails included);
 *  2. the flawless player held to the human limits (scripts/d5-ladder-lib.ts `playDealt(…, "perfect")`: every note on its
 *     tick, fever tapped a reaction and a moment's thought after the meter fills) scores exactly 200 through the
 *     server's replay (`gradeAnswer` on the dealt puzzle).
 *
 * A seed that fails either is dropped from that level. Candidates come from a fixed hash of 0, 1, 2, … (as
 * scripts/blockfall-deal.ts), the same list for every level. Rooms deal BEAT_DEAL_V13[level][room seed % length].
 *
 *   bun scripts/beat-lanes-deal.ts          # rebuild the file
 *   bun scripts/beat-lanes-deal.ts --check  # prove the file is what this script builds, without writing
 */
import { readFileSync, writeFileSync } from "node:fs";
import { beatGameFor, BEAT_REV_LANES } from "../src/lib/arcade/beat";
import type { PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { beatTwoThumbs } from "./beat-thumbs";
import { playDealt } from "./d5-ladder-lib";

export const BEAT_DEAL_V13_SIZE = 300;
export const BEAT_DEAL_LEVELS = ["normal", "easy", "hard", "expert"] as const satisfies readonly Level[];
const FILE = new URL("../src/lib/duel/beatDealV13.server.ts", import.meta.url);

export function hashSeed(n: number): number {
  let x = (n + 1) * 0x9e3779b1;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

/** A beatRev 13 puzzle on a seed at a level (Normal carries no level, as the deal stamps it). */
export function beatPuzzleV13(seed: number, level: Level): PuzzleData {
  return { type: "beat", seed, beatRev: BEAT_REV_LANES, ...(level !== "normal" ? { level } : {}) } as unknown as PuzzleData;
}

/** The seed's proof at a level: two-thumb playable, and the flawless player's server score under the human limits. */
export async function beatProof(seed: number, level: Level): Promise<{ thumbs: boolean; score: number }> {
  const thumbs = beatTwoThumbs(beatGameFor(BEAT_REV_LANES, level).init(seed).chart).ok;
  if (!thumbs) return { thumbs, score: -1 };
  const run = await playDealt("beat", beatPuzzleV13(seed, level), "perfect");
  return { thumbs, score: run.score };
}

if (import.meta.main) {
  const lists: Record<string, number[]> = {};
  const dropped: Record<string, { thumbs: number; score: number }> = {};
  for (const level of BEAT_DEAL_LEVELS) {
    const seeds: number[] = [];
    const drop = { thumbs: 0, score: 0 };
    for (let n = 0; seeds.length < BEAT_DEAL_V13_SIZE; n++) {
      const seed = hashSeed(n);
      const p = await beatProof(seed, level);
      if (!p.thumbs) drop.thumbs++;
      else if (p.score !== 200) drop.score++;
      else seeds.push(seed);
      if (n > 20_000) throw new Error(`${level}: too few seeds pass (${seeds.length})`);
    }
    lists[level] = seeds;
    dropped[level] = drop;
    console.log(`${level}: ${seeds.length} seeds (${drop.thumbs} dropped as not two-thumb playable, ${drop.score} as the proof's run not at 200)`);
  }
  const block = (level: string) => `  ${level}: [\n${lists[level]!.map((s) => `    ${s},`).join("\n")}\n  ],`;
  const text = `/**
 * Tempo's beatRev 13 deal (D5's ladder, 23 Nov 2026; docs/arcade-standard/beat.md "Levels (D5, 23 Nov 2026)"): for each
 * level ${BEAT_DEAL_V13_SIZE} seeds, each proved on beatRev 13 at that level: its chart is playable by two thumbs at the human
 * limits (scripts/beat-thumbs.ts) and the flawless player held to the limits scores exactly 200 through the server replay.
 * Built by \`bun scripts/beat-lanes-deal.ts\` (${BEAT_DEAL_LEVELS.map((l) => `${l}: ${dropped[l]!.thumbs} dropped as not two-thumb playable, ${dropped[l]!.score} as not at 200`).join("; ")});
 * beat-ladder-check re-proves them. Rooms deal BEAT_DEAL_V13[level][room seed % length].
 */
import type { Level } from "@/lib/levels/levels";

export const BEAT_DEAL_V13: Readonly<Record<"normal" | "easy" | "hard" | "expert", readonly number[]>> = {
${BEAT_DEAL_LEVELS.map(block).join("\n")}
};

/** The proved seed a room deals at a level for its own random seed (beatRev 13; a missing level is Normal). */
export function beatDealSeedV13(roomSeed: number, level?: Level | null): number {
  const list = BEAT_DEAL_V13[level && level in BEAT_DEAL_V13 ? level : "normal"];
  return list[(roomSeed >>> 0) % list.length]!;
}
`;
  if (process.argv.includes("--check")) {
    const same = readFileSync(FILE, "utf8") === text;
    console.log(same ? "PASS beat-lanes-deal: the file is what this script builds" : "FAIL beat-lanes-deal: the file differs from this script's build");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(FILE, text);
  console.log(`wrote ${FILE.pathname}`);
}
