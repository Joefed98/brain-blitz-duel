/**
 * Builds Home Run's innings deal, src/lib/duel/homerunDealV5.server.ts (homerunRev 5, 15 Nov 2026): HR5_DEAL_SIZE seeds
 * for each of the four levels, every one proved by the flawless batter (scripts/homerun-oracle.ts oracleRunV5) to score
 * exactly 200 at that level through the server's own encode + replay path. Seeds come from homerun-deal.ts's fixed
 * hash, salted by level; a seed the oracle cannot take to 200 is dropped.
 *
 *   bun scripts/homerun-innings-deal.ts           # rebuild the file
 *   bun scripts/homerun-innings-deal.ts --check   # prove the file is what this script builds, without writing
 */
import { readFileSync, writeFileSync } from "node:fs";
import { homerunCheckpoint, homerunGameFor, HOMERUN_REV_5 } from "../src/lib/arcade/homerun";
import { HR_LEVELS, type HrLevel } from "../src/lib/arcade/homerunInnings";
import { encodeHomerunRun, replayHomerunRun } from "../src/lib/duel/homerun";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { oracleRunV5 } from "./homerun-oracle";
import { hashSeed } from "./homerun-deal";

export const HR5_DEAL_SIZE = 120;
const SALT: Record<HrLevel, number> = { easy: 50_000, normal: 0, hard: 100_000, expert: 150_000 };

/** A log's stored score at a level through the server's replay (the phone's checkpoints claimed). */
export function storedScoreV5(seed: number, events: ArcadeInputEvent[], level: HrLevel): number {
  const game = homerunGameFor(HOMERUN_REV_5, level);
  const at = new Map(events.map((e) => [e.t, e]));
  const checkpoints = [];
  let s = game.init(seed);
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) checkpoints.push(homerunCheckpoint(s));
  }
  const raw = encodeHomerunRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const res = replayHomerunRun(seed, raw, HOMERUN_REV_5, level);
  return res.flagged ? -1 : res.score;
}

export function buildDeal(level: HrLevel): { seeds: number[]; dropped: number } {
  const seeds: number[] = [];
  let dropped = 0;
  for (let n = 0; seeds.length < HR5_DEAL_SIZE; n++) {
    const seed = hashSeed(SALT[level] + n);
    if (storedScoreV5(seed, oracleRunV5(seed, level), level) === 200) seeds.push(seed);
    else dropped++;
  }
  return { seeds, dropped };
}

if (import.meta.main) {
  const built = HR_LEVELS.map((l) => ({ l, ...buildDeal(l) }));
  const file = `/**
 * Home Run's innings deal (homerunRev 5, 15 Nov 2026): ${HR5_DEAL_SIZE} seeds a level, each proved by the flawless batter
 * (scripts/homerun-oracle.ts oracleRunV5) to score exactly 200 at that level through the server replay. Built by
 * \`bun scripts/homerun-innings-deal.ts\` (dropped: ${built.map((b) => `${b.l} ${b.dropped}`).join(", ")}); homerun-innings-check
 * re-proves them. Rooms deal HOMERUN_DEAL_V5[level][room seed % length].
 */
import type { HrLevel } from "@/lib/arcade/homerunInnings";

export const HOMERUN_DEAL_V5: Readonly<Record<HrLevel, readonly number[]>> = {
${built.map((b) => `  ${b.l}: [${b.seeds.join(", ")}],`).join("\n")}
};

/** The deal for room seed \`n\` at a level (Normal unless given). */
export function homerunDealSeedV5(n: number, level: HrLevel = "normal"): number {
  const list = HOMERUN_DEAL_V5[level];
  return list[((n % list.length) + list.length) % list.length]!;
}
`;
  const path = "src/lib/duel/homerunDealV5.server.ts";
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8") !== file) {
      console.log(`FAIL ${path} is not what homerun-innings-deal.ts builds`);
      process.exit(1);
    }
    console.log(`PASS ${path} rebuilt byte for byte`);
  } else {
    writeFileSync(path, file);
    console.log(`wrote ${path}: ${built.map((b) => `${b.l} ${b.seeds.length} (${b.dropped} dropped)`).join(", ")}`);
  }
}
