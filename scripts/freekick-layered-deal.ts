/**
 * Builds Top Bins' layered deal, src/lib/duel/freekickDealV5.server.ts (freekickRev 5, 15 Nov 2026): FK5_DEAL_SIZE
 * seeds for each of the four levels, every one proved by the oracle (scripts/freekick-oracle.ts oracleRunV5) to score
 * exactly 200 at that level through the server's own encode + replay path. Seeds come from freekick-deal.ts's fixed
 * hash, salted by level; a seed the oracle cannot take to 200 is dropped.
 *
 *   bun scripts/freekick-layered-deal.ts           # rebuild the file (~1 min)
 *   bun scripts/freekick-layered-deal.ts --check   # prove the file is what this script builds, without writing
 */
import { readFileSync, writeFileSync } from "node:fs";
import { freekickCheckpoint, freekickGameFor, FK_LEVELS, FREEKICK_REV_5, type FkLevel } from "../src/lib/arcade/freekick";
import { encodeFreekickRun, replayFreekickRun } from "../src/lib/duel/freekick";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { oracleRunV5 } from "./freekick-oracle";
import { hashSeed } from "./freekick-deal";

export const FK5_DEAL_SIZE = 60;
const SALT: Record<FkLevel, number> = { easy: 50_000, normal: 0, hard: 100_000, expert: 150_000 };

/** A log's stored score at a level through the server's replay (the phone's checkpoints claimed). */
export function storedScoreFkV5(seed: number, events: ArcadeInputEvent[], level: FkLevel): number {
  const game = freekickGameFor(FREEKICK_REV_5, level);
  const at = new Map(events.map((e) => [e.t, e]));
  const checkpoints = [];
  let s = game.init(seed);
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) checkpoints.push(freekickCheckpoint(s));
  }
  const raw = encodeFreekickRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const res = replayFreekickRun(seed, raw, FREEKICK_REV_5, level);
  return res.flagged ? -1 : res.score;
}

export function buildDeal(level: FkLevel): { seeds: number[]; dropped: number } {
  const seeds: number[] = [];
  let dropped = 0;
  for (let n = 0; seeds.length < FK5_DEAL_SIZE; n++) {
    const seed = hashSeed(SALT[level] + n);
    if (storedScoreFkV5(seed, oracleRunV5(seed, level), level) === 200) seeds.push(seed);
    else dropped++;
  }
  return { seeds, dropped };
}

if (import.meta.main) {
  const built = FK_LEVELS.map((l) => ({ l, ...buildDeal(l) }));
  const file = `/**
 * Top Bins' layered deal (freekickRev 5, 15 Nov 2026): ${FK5_DEAL_SIZE} seeds a level, each proved by the oracle
 * (scripts/freekick-oracle.ts oracleRunV5) to score exactly 200 at that level through the server replay. Built by
 * \`bun scripts/freekick-layered-deal.ts\` (dropped: ${built.map((b) => `${b.l} ${b.dropped}`).join(", ")}); freekick-layered-check
 * re-proves them. Rooms deal FREEKICK_DEAL_V5[level][room seed % length].
 */
import type { FkLevel } from "@/lib/arcade/freekick";

export const FREEKICK_DEAL_V5: Readonly<Record<FkLevel, readonly number[]>> = {
${built.map((b) => `  ${b.l}: [${b.seeds.join(", ")}],`).join("\n")}
};

/** The deal for room seed \`n\` at a level (Normal unless given). */
export function freekickDealSeedV5(n: number, level: FkLevel = "normal"): number {
  const list = FREEKICK_DEAL_V5[level];
  return list[((n % list.length) + list.length) % list.length]!;
}
`;
  const path = "src/lib/duel/freekickDealV5.server.ts";
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8") !== file) {
      console.log(`FAIL ${path} is not what freekick-layered-deal.ts builds`);
      process.exit(1);
    }
    console.log(`PASS ${path} rebuilt byte for byte`);
  } else {
    writeFileSync(path, file);
    console.log(`wrote ${path}: ${built.map((b) => `${b.l} ${b.seeds.length} (${b.dropped} dropped)`).join(", ")}`);
  }
}
