/**
 * Builds src/lib/duel/freekickDeal.server.ts (freekickRev 1) and src/lib/duel/freekickDealV2.server.ts (freekickRev 2,
 * Top Bins): the 300 seeds rooms deal on each revision, each proved by the oracle (scripts/freekick-oracle.ts) to score
 * exactly 200 through the server's own encode + replay path on that revision. Seeds come from a fixed hash of 0, 1,
 * 2, … (the skill-band tool's roomSeed); any seed the oracle cannot take to 200 is dropped.
 *
 *   bun scripts/freekick-deal.ts [--rev=2|3]          # rebuild the file (rev 1 when unnamed)
 *   bun scripts/freekick-deal.ts [--rev=2|3] --check  # prove the file is what this script builds, without writing
 *   bun scripts/freekick-deal.ts [--rev=2|3|4] --check --part=k/n  # every n-th scanned seed re-proved (freekick-check's parts)
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

function bodyV1(seeds: number[], dropped: number): string {
  return `/**
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
}

/** Each revision's file, its text, the stored deal and the label its messages use. */
const TARGETS: Record<number, { file: string; label: string; body: (seeds: number[], dropped: number, scanned: number) => string; stored: () => Promise<readonly number[]> }> = {
  1: { file: "freekickDeal.server.ts", label: "freekick deal", body: (s, d) => bodyV1(s, d), stored: async () => (await import("../src/lib/duel/freekickDeal.server")).FREEKICK_DEAL },
  [FREEKICK_REV_2]: { file: "freekickDealV2.server.ts", label: "freekick deal v2", body: (s, d) => bodyV2(s, d), stored: async () => (await import("../src/lib/duel/freekickDealV2.server")).FREEKICK_DEAL_V2 },
  [FREEKICK_REV_3]: { file: "freekickDealV3.server.ts", label: "freekick deal v3", body: bodyV3, stored: async () => (await import("../src/lib/duel/freekickDealV3.server")).FREEKICK_DEAL_V3 },
  [FREEKICK_REV_4]: { file: "freekickDealV4.server.ts", label: "freekick deal v4", body: bodyV4, stored: async () => (await import("../src/lib/duel/freekickDealV4.server")).FREEKICK_DEAL_V4 },
};

/**
 * `--check --part=k/n` (10 Nov 2026, so freekick-check's full depth fits CI's 300 s per check): instead of building the
 * deal again from n = 0, re-proves only every n-th scanned seed from the k-th (hashSeed(0 … the stored deal's last seed's
 * n)) and fails unless each is kept or dropped exactly as the stored deal has it; every part also checks the stored seeds
 * run in scan order and renders the file from them, compared byte for byte. Each seed's proof is independent, so the n
 * parts together prove exactly what one whole `--check` does.
 */
async function checkPart(rev: number, k: number, n: number): Promise<boolean> {
  const t = TARGETS[rev]!;
  const stored = [...(await t.stored())];
  const kept = new Set(stored);
  let last = -1;
  if (stored.length) for (let m = 0; m < 1_000_000; m++) if (hashSeed(m) === stored[stored.length - 1]) { last = m; break; }
  let ok = stored.length === FREEKICK_DEAL_SIZE && kept.size === stored.length && last >= 0;
  // The stored seeds are exactly the kept ones among hashSeed(0 … last), in that order.
  if (ok) {
    let j = 0;
    for (let m = 0; m <= last; m++) if (kept.has(hashSeed(m))) ok = ok && stored[j++] === hashSeed(m);
    ok = ok && j === stored.length;
  }
  let proved = 0;
  for (let m = k - 1; ok && m <= last; m += n) {
    const seed = hashSeed(m);
    const keep = provedScore(seed, rev) === 200;
    if (keep !== kept.has(seed)) {
      console.log(`${t.label}: seed ${seed} (n=${m}) is ${keep ? "proved" : "not proved"} but the file ${kept.has(seed) ? "keeps" : "drops"} it`);
      ok = false;
    }
    proved++;
  }
  const scanned = last + 1;
  const same = ok && readFileSync(new URL(`../src/lib/duel/${t.file}`, import.meta.url), "utf8") === t.body(stored, scanned - stored.length, scanned);
  console.log(same ? `${t.label}: the file is what this script builds (part ${k}/${n}, ${proved} of ${scanned} scanned seeds re-proved)` : `${t.label}: the file differs (part ${k}/${n})`);
  return same;
}

if (import.meta.main) {
  const revArg = process.argv.find((a) => a.startsWith("--rev="));
  const rev = revArg ? Number(revArg.slice(6)) : 1;
  const t = TARGETS[rev];
  if (!t) throw new Error(`unknown ${revArg}`);
  const check = process.argv.includes("--check");
  const part = process.argv.find((a) => a.startsWith("--part="))?.slice(7);
  if (part) {
    const [k, n] = part.split("/").map(Number) as [number, number];
    if (!check || !(Number.isInteger(k) && Number.isInteger(n) && n >= 1 && k >= 1 && k <= n)) throw new Error(`bad --part=${part} (needs --check and 1 <= k <= n)`);
    process.exit((await checkPart(rev, k, n)) ? 0 : 1);
  }
  const seeds: number[] = [];
  let dropped = 0;
  let n = 0;
  const t0 = performance.now();
  for (; seeds.length < FREEKICK_DEAL_SIZE; n++) {
    const seed = hashSeed(n);
    if (provedScore(seed, rev) === 200) seeds.push(seed);
    else dropped++;
    if (n % 25 === 0) console.error(`n=${n} kept ${seeds.length} dropped ${dropped} ${Math.round((performance.now() - t0) / 1000)} s`);
  }
  const body = t.body(seeds, dropped, n);
  const path = new URL(`../src/lib/duel/${t.file}`, import.meta.url);
  if (check) {
    const same = readFileSync(path, "utf8") === body;
    console.log(same ? `${t.label}: the file is what this script builds` : `${t.label}: the file differs`);
    process.exit(same ? 0 : 1);
  }
  writeFileSync(path, body);
  console.log(`${t.label}: ${seeds.length} seeds, ${dropped} dropped`);
}
