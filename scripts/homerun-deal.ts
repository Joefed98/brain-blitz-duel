/**
 * Builds src/lib/duel/homerunDeal.server.ts: the 300 Home Run Derby seeds rooms deal, each proved by the oracle
 * (scripts/homerun-oracle.ts) to score exactly 200 through the server's own encode + replay path. Seeds come from a
 * fixed hash of 0, 1, 2, … (the skill-band tool's roomSeed); any seed the oracle cannot take to 200 is dropped.
 *
 *   bun scripts/homerun-deal.ts          # rebuild the file
 *   bun scripts/homerun-deal.ts --check  # prove the file is what this script builds, without writing
 */
import { readFileSync, writeFileSync } from "node:fs";
import { homerunCheckpoint, homerunGame } from "../src/lib/arcade/homerun";
import { encodeHomerunRun, replayHomerunRun } from "../src/lib/duel/homerun";
import { oracleRun, playLog } from "./homerun-oracle";

export const HOMERUN_DEAL_SIZE = 300;

export function hashSeed(n: number): number {
  let x = (n + 1) * 0x9e3779b1;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

/** The oracle's run on `seed` through the server's replay: its stored score. */
export function provedScore(seed: number): number {
  const events = oracleRun(seed);
  const s = playLog(seed, events);
  const checkpoints = [];
  {
    const at = new Map(events.map((e) => [e.t, e]));
    let r = homerunGame.init(seed);
    while (!homerunGame.isOver(r)) {
      r = homerunGame.step(r, at.get(r.tick + 1) ?? null);
      if (r.tick % 60 === 0) checkpoints.push(homerunCheckpoint(r));
    }
  }
  const raw = encodeHomerunRun({ seed, claimedScore: homerunGame.score(s), events, endTick: s.tick, checkpoints });
  const res = replayHomerunRun(seed, raw, 1);
  return res.flagged ? -1 : res.score;
}

if (import.meta.main) {
  const seeds: number[] = [];
  let dropped = 0;
  for (let n = 0; seeds.length < HOMERUN_DEAL_SIZE; n++) {
    const seed = hashSeed(n);
    if (provedScore(seed) === 200) seeds.push(seed);
    else dropped++;
  }
  const body = `/**
 * Home Run Derby's deal (homerunRev 1): ${HOMERUN_DEAL_SIZE} seeds, each proved by the oracle (scripts/homerun-oracle.ts) to
 * score exactly 200 through the server replay. Built by scripts/homerun-deal.ts (${dropped} seeds dropped); homerun-check
 * re-proves them. Rooms deal HOMERUN_DEAL[room seed % length].
 */
export const HOMERUN_DEAL: readonly number[] = [
${seeds.map((s) => `  ${s},`).join("\n")}
];

/** The proved seed a room deals for its own random seed. */
export function homerunDealSeed(roomSeed: number): number {
  return HOMERUN_DEAL[(roomSeed >>> 0) % HOMERUN_DEAL.length]!;
}
`;
  const path = new URL("../src/lib/duel/homerunDeal.server.ts", import.meta.url);
  if (process.argv.includes("--check")) {
    const same = readFileSync(path, "utf8") === body;
    console.log(same ? "homerun deal: the file is what this script builds" : "homerun deal: the file differs");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(path, body);
  console.log(`homerun deal: ${seeds.length} seeds, ${dropped} dropped`);
}
