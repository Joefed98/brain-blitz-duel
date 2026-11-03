/**
 * Builds src/lib/duel/freekickDeal.server.ts (freekickRev 1) and src/lib/duel/freekickDealV2.server.ts (freekickRev 2,
 * Top Bins): the 300 seeds rooms deal on each revision, each proved by the oracle (scripts/freekick-oracle.ts) to score
 * exactly 200 through the server's own encode + replay path on that revision. Seeds come from a fixed hash of 0, 1,
 * 2, … (the skill-band tool's roomSeed); any seed the oracle cannot take to 200 is dropped.
 *
 *   bun scripts/freekick-deal.ts [--rev=2|3]          # rebuild the file (rev 1 when unnamed)
 *   bun scripts/freekick-deal.ts [--rev=2|3] --check  # prove the file is what this script builds, without writing
 *
 * freekickRev 3 (1 Nov 2026) writes src/lib/duel/freekickDealV3.server.ts the same way (the oracle's prepared shots);
 * freekickRev 4 (3 Nov 2026, `--rev=4`) src/lib/duel/freekickDealV4.server.ts (the drawn shots).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { freekickCheckpoint, freekickGameFor, FREEKICK_REV_2, FREEKICK_REV_3, FREEKICK_REV_4, type FreekickCheckpoint } from "../src/lib/arcade/freekick";
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
export function provedScore(seed: number, rev = 1): number {
  const freekickGame = freekickGameFor(rev);
  const events = oracleRun(seed, rev);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = freekickGame.init(seed);
  const checkpoints: FreekickCheckpoint[] = [];
  while (!freekickGame.isOver(s)) {
    s = freekickGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) checkpoints.push(freekickCheckpoint(s));
  }
  const raw = encodeFreekickRun({ seed, claimedScore: freekickGame.score(s), events, endTick: s.tick, checkpoints });
  const res = replayFreekickRun(seed, raw, rev);
  return res.flagged ? -1 : res.score;
}

function bodyV2(seeds: number[], dropped: number): string {
  return `/**
 * Top Bins' deal (freekickRev 2): ${FREEKICK_DEAL_SIZE} seeds, each proved by the oracle (scripts/freekick-oracle.ts) to
 * score exactly 200 through the server replay on freekickRev 2. Built by \`bun scripts/freekick-deal.ts --rev=2\`
 * (${dropped} seeds dropped); freekick-check re-proves them. Rooms deal FREEKICK_DEAL_V2[room seed % length].
 */
export const FREEKICK_DEAL_V2: readonly number[] = [
${seeds.map((s) => `  ${s},`).join("\n")}
];

/** The proved freekickRev 2 seed a room deals for its own random seed. */
export function freekickDealSeedV2(roomSeed: number): number {
  return FREEKICK_DEAL_V2[(roomSeed >>> 0) % FREEKICK_DEAL_V2.length]!;
}
`;
}

function bodyV3(seeds: number[], dropped: number, scanned: number): string {
  return `/**
 * Top Bins' deal (freekickRev 3, the prepared shot): ${seeds.length} seeds, each proved by the oracle
 * (scripts/freekick-oracle.ts, oracleShotsV3: a target, a curl and a clean strike per kick) to score exactly 200 through
 * the server replay on freekickRev 3. Built by \`bun scripts/freekick-deal.ts --rev=3\` (${dropped} of the first ${scanned}
 * seeds dropped); freekick-check re-proves them. Rooms deal FREEKICK_DEAL_V3[room seed % length].
 */
export const FREEKICK_DEAL_V3: readonly number[] = [
${seeds.map((s) => `  ${s},`).join("\n")}
];

/** The proved freekickRev 3 seed a room deals for its own random seed. */
export function freekickDealSeedV3(roomSeed: number): number {
  return FREEKICK_DEAL_V3[(roomSeed >>> 0) % FREEKICK_DEAL_V3.length]!;
}
`;
}

function bodyV4(seeds: number[], dropped: number, scanned: number): string {
  return `/**
 * Top Bins' deal (freekickRev 4, the drawn shot): ${seeds.length} seeds, each proved by the oracle
 * (scripts/freekick-oracle.ts, oracleShotsV4: a drawn target and a strong curl, at least FK_V4_BENT, and a clean strike
 * per kick, through every shrinking hoop) to score exactly 200 through the server replay on freekickRev 4. Built by
 * \`bun scripts/freekick-deal.ts --rev=4\` (${dropped} of the first ${scanned} seeds dropped); freekick-check re-proves them.
 * Rooms deal FREEKICK_DEAL_V4[room seed % length].
 */
export const FREEKICK_DEAL_V4: readonly number[] = [
${seeds.map((s) => `  ${s},`).join("\n")}
];

/** The proved freekickRev 4 seed a room deals for its own random seed. */
export function freekickDealSeedV4(roomSeed: number): number {
  return FREEKICK_DEAL_V4[(roomSeed >>> 0) % FREEKICK_DEAL_V4.length]!;
}
`;
}

if (import.meta.main && process.argv.some((a) => a === `--rev=${FREEKICK_REV_4}`)) {
  const seeds: number[] = [];
  let dropped = 0;
  let n = 0;
  const t0 = performance.now();
  for (; seeds.length < FREEKICK_DEAL_SIZE; n++) {
    const seed = hashSeed(n);
    if (provedScore(seed, FREEKICK_REV_4) === 200) seeds.push(seed);
    else dropped++;
    if (n % 25 === 0) console.error(`n=${n} kept ${seeds.length} dropped ${dropped} ${Math.round((performance.now() - t0) / 1000)} s`);
  }
  const body = bodyV4(seeds, dropped, n);
  const path = new URL("../src/lib/duel/freekickDealV4.server.ts", import.meta.url);
  if (process.argv.includes("--check")) {
    const same = readFileSync(path, "utf8") === body;
    console.log(same ? "freekick deal v4: the file is what this script builds" : "freekick deal v4: the file differs");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(path, body);
  console.log(`freekick deal v4: ${seeds.length} seeds, ${dropped} dropped`);
} else if (import.meta.main && process.argv.some((a) => a === `--rev=${FREEKICK_REV_3}`)) {
  const seeds: number[] = [];
  let dropped = 0;
  let n = 0;
  const t0 = performance.now();
  for (; seeds.length < FREEKICK_DEAL_SIZE; n++) {
    const seed = hashSeed(n);
    if (provedScore(seed, FREEKICK_REV_3) === 200) seeds.push(seed);
    else dropped++;
    if (n % 25 === 0) console.error(`n=${n} kept ${seeds.length} dropped ${dropped} ${Math.round((performance.now() - t0) / 1000)} s`);
  }
  const body = bodyV3(seeds, dropped, n);
  const path = new URL("../src/lib/duel/freekickDealV3.server.ts", import.meta.url);
  if (process.argv.includes("--check")) {
    const same = readFileSync(path, "utf8") === body;
    console.log(same ? "freekick deal v3: the file is what this script builds" : "freekick deal v3: the file differs");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(path, body);
  console.log(`freekick deal v3: ${seeds.length} seeds, ${dropped} dropped`);
} else if (import.meta.main && process.argv.some((a) => a === `--rev=${FREEKICK_REV_2}`)) {
  const seeds: number[] = [];
  let dropped = 0;
  const t0 = performance.now();
  for (let n = 0; seeds.length < FREEKICK_DEAL_SIZE; n++) {
    const seed = hashSeed(n);
    if (provedScore(seed, FREEKICK_REV_2) === 200) seeds.push(seed);
    else dropped++;
    if (n % 25 === 0) console.error(`n=${n} kept ${seeds.length} dropped ${dropped} ${Math.round((performance.now() - t0) / 1000)} s`);
  }
  const body = bodyV2(seeds, dropped);
  const path = new URL("../src/lib/duel/freekickDealV2.server.ts", import.meta.url);
  if (process.argv.includes("--check")) {
    const same = readFileSync(path, "utf8") === body;
    console.log(same ? "freekick deal v2: the file is what this script builds" : "freekick deal v2: the file differs");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(path, body);
  console.log(`freekick deal v2: ${seeds.length} seeds, ${dropped} dropped`);
} else if (import.meta.main) {
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
