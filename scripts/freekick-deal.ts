/**
 * Builds src/lib/duel/freekickDeal.server.ts: the 300 Free Kick seeds rooms deal, each proved by the oracle
 * (scripts/freekick-oracle.ts) to score exactly 200 through the server's own encode + replay path. Seeds come from a
 * fixed hash of 0, 1, 2, … (the skill-band tool's roomSeed); any seed the oracle cannot take to 200 is dropped.
 *
 *   bun scripts/freekick-deal.ts          # rebuild the file
 *   bun scripts/freekick-deal.ts --check  # prove the file is what this script builds, without writing
 */
import { readFileSync, writeFileSync } from "node:fs";
import { freekickCheckpoint, freekickGame, type FreekickCheckpoint } from "../src/lib/arcade/freekick";
import { encodeFreekickRun, replayFreekickRun } from "../src/lib/duel/freekick";
import { oracleRun } from "./freekick-oracle";

export const FREEKICK_DEAL_SIZE = 300;

/** The skill-band tool's roomSeed (scripts/arcade-skill-bands/games.ts), copied so this script stands alone. */
export function hashSeed(n: number): number {
  let x = (n + 1) * 0x9e3779b1;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

/** The oracle's run on `seed` through the server's replay: its stored score (−1 if flagged). */
export function provedScore(seed: number): number {
  const events = oracleRun(seed);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = freekickGame.init(seed);
  const checkpoints: FreekickCheckpoint[] = [];
  while (!freekickGame.isOver(s)) {
    s = freekickGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) checkpoints.push(freekickCheckpoint(s));
  }
  const raw = encodeFreekickRun({ seed, claimedScore: freekickGame.score(s), events, endTick: s.tick, checkpoints });
  const res = replayFreekickRun(seed, raw, 1);
  return res.flagged ? -1 : res.score;
}

if (import.meta.main) {
  const seeds: number[] = [];
  let dropped = 0;
  const t0 = performance.now();
  for (let n = 0; seeds.length < FREEKICK_DEAL_SIZE; n++) {
    const seed = hashSeed(n);
    if (provedScore(seed) === 200) seeds.push(seed);
    else dropped++;
    if (n % 25 === 0) console.error(`n=${n} kept ${seeds.length} dropped ${dropped} ${Math.round((performance.now() - t0) / 1000)} s`);
  }
  const body = `/**
 * Free Kick's deal (freekickRev 1): ${FREEKICK_DEAL_SIZE} seeds, each proved by the oracle (scripts/freekick-oracle.ts) to
 * score exactly 200 through the server replay. Built by scripts/freekick-deal.ts (${dropped} seeds dropped); freekick-check
 * re-proves them. Rooms deal FREEKICK_DEAL[room seed % length].
 */
export const FREEKICK_DEAL: readonly number[] = [
${seeds.map((s) => `  ${s},`).join("\n")}
];

/** The proved seed a room deals for its own random seed. */
export function freekickDealSeed(roomSeed: number): number {
  return FREEKICK_DEAL[(roomSeed >>> 0) % FREEKICK_DEAL.length]!;
}
`;
  const path = new URL("../src/lib/duel/freekickDeal.server.ts", import.meta.url);
  if (process.argv.includes("--check")) {
    const same = readFileSync(path, "utf8") === body;
    console.log(same ? "freekick deal: the file is what this script builds" : "freekick deal: the file differs");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(path, body);
  console.log(`freekick deal: ${seeds.length} seeds, ${dropped} dropped`);
}
