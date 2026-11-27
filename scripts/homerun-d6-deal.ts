/**
 * Builds Home Run's D6 level deal, src/lib/duel/homerunDealV6.server.ts (homerunRev 6, 23 Nov 2026): HR6_DEAL_SIZE seeds
 * for each of Easy, Hard and Expert, every one proved by the flawless batter (scripts/homerun-oracle.ts oracleRunV5 on
 * homerunRev 6) to score exactly 200 at that level through the server's own encode + replay path. Seeds come from
 * homerun-deal.ts's fixed hash, salted by level (a salt of its own, so no rev-5 level seed repeats); a seed the oracle
 * cannot take to 200 is dropped.
 *
 *   bun scripts/homerun-d6-deal.ts           # rebuild the file
 *   bun scripts/homerun-d6-deal.ts --check   # prove the file is what this script builds, without writing
 */
import { readFileSync, writeFileSync } from "node:fs";
import { homerunCheckpoint, homerunGameFor } from "../src/lib/arcade/homerun";
import { HOMERUN_REV_6 } from "../src/lib/arcade/homerunInnings";
import { encodeHomerunRun, replayHomerunRun } from "../src/lib/duel/homerun";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { oracleRunV5 } from "./homerun-oracle";
import { hashSeed } from "./homerun-deal";

export const HR6_DEAL_SIZE = 120;
type L6 = "easy" | "hard" | "expert";
const LEVELS: L6[] = ["easy", "hard", "expert"];
const SALT: Record<L6, number> = { easy: 250_000, hard: 300_000, expert: 350_000 };

/** A log's stored score at a D6 level through the server's replay (the phone's checkpoints claimed); -1 if flagged. */
export function storedScoreV6(seed: number, events: ArcadeInputEvent[], level: L6): number {
  const game = homerunGameFor(HOMERUN_REV_6, level);
  const at = new Map(events.map((e) => [e.t, e]));
  const checkpoints = [];
  let s = game.init(seed);
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) checkpoints.push(homerunCheckpoint(s));
  }
  const raw = encodeHomerunRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const res = replayHomerunRun(seed, raw, HOMERUN_REV_6, level);
  return res.flagged ? -1 : res.score;
}

export function buildDealV6(level: L6): { seeds: number[]; dropped: number } {
  const seeds: number[] = [];
  let dropped = 0;
  for (let n = 0; seeds.length < HR6_DEAL_SIZE; n++) {
    const seed = hashSeed(SALT[level] + n);
    if (storedScoreV6(seed, oracleRunV5(seed, level, HOMERUN_REV_6), level) === 200) seeds.push(seed);
    else dropped++;
  }
  return { seeds, dropped };
}

if (import.meta.main) {
  console.error = () => {};
  const built = LEVELS.map((l) => ({ l, ...buildDealV6(l) }));
  const file = `/**
 * Home Run's D6 level deal (homerunRev 6, 23 Nov 2026): ${HR6_DEAL_SIZE} seeds a level, each proved by the flawless batter
 * (scripts/homerun-oracle.ts oracleRunV5 on homerunRev 6) to score exactly 200 at that level through the server replay.
 * Built by \`bun scripts/homerun-d6-deal.ts\` (dropped: ${built.map((b) => `${b.l} ${b.dropped}`).join(", ")}). Rooms deal
 * HOMERUN_DEAL_V6[level][room seed % length].
 */
export const HOMERUN_DEAL_V6: Readonly<Record<"easy" | "hard" | "expert", readonly number[]>> = {
${built.map((b) => `  ${b.l}: [${b.seeds.join(", ")}],`).join("\n")}
};

/** The deal for room seed \`n\` at a D6 level. */
export function homerunDealSeedV6(n: number, level: "easy" | "hard" | "expert"): number {
  const list = HOMERUN_DEAL_V6[level];
  return list[((n % list.length) + list.length) % list.length]!;
}
`;
  const path = "src/lib/duel/homerunDealV6.server.ts";
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8") !== file) {
      console.log(`FAIL ${path} is not what homerun-d6-deal.ts builds`);
      process.exit(1);
    }
    console.log(`PASS ${path} rebuilt byte for byte`);
  } else {
    writeFileSync(path, file);
    console.log(`wrote ${path}: ${built.map((b) => `${b.l} ${b.seeds.length} (${b.dropped} dropped)`).join(", ")}`);
  }
}
