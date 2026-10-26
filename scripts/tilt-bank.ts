/**
 * Tilt tiltRev 8's bank (src/lib/duel/tiltBank.server.ts): rooms deal only seeds the oracle (scripts/tilt-oracle.ts)
 * has played to 200 through the server's replay, so every dealt round can be played to its maximum.
 *
 *   bun scripts/tilt-bank.ts --scan --from=0 --count=500 --out=<file.jsonl>   # oracle runs on candidate seeds
 *   bun scripts/tilt-bank.ts --write <file.jsonl>...                          # the bank and its proof fixture
 *
 * Candidates are the dealer's seeds in a fixed order (roomSeed(k) for k = 0, 1, …, those tiltDealableX passes).
 * The proof fixture (scripts/fixtures/tilt-bank-runs.json.gz) keeps every banked seed's oracle log;
 * tilt-expand-check replays each one to 200.
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tiltDealableX } from "../src/lib/arcade/tilt";
import { roomSeed } from "./arcade-skill-bands/games";
import { oracleRun } from "./tilt-oracle";

const args = process.argv.slice(2);
const SEED_FOR = `/**
 * The skill-band tool's seed index n → a bank seed: the tuning seeds (0–59) are the bank's first 60; the fresh seeds
 * (10000 on, Session A's convention) start at its 61st, so the two sets never share a seed.
 */
export function tiltBankSeedFor(n: number): number {
  const len = TILT_BANK.length;
  return n < 10000 ? TILT_BANK[n % len]! : TILT_BANK[60 + ((n - 10000) % (len - 60))]!;
}
`;
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);

if (args.includes("--scan")) {
  const from = Number(opt("from") ?? 0);
  const count = Number(opt("count") ?? 100);
  const out = opt("out")!;
  for (let k = from; k < from + count; k++) {
    const seed = roomSeed(k);
    if (!tiltDealableX(seed)) continue;
    const r = oracleRun(seed);
    appendFileSync(out, JSON.stringify({ k, seed, score: r.score, raw: r.raw }) + "\n");
  }
} else if (args.includes("--write")) {
  const files = args.filter((a) => !a.startsWith("--"));
  const rows = files.flatMap((f) => readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { k: number; seed: number; score: number; raw: string }));
  rows.sort((a, b) => a.k - b.k);
  const kept = rows.filter((r) => r.score === 200);
  const seeds = kept.map((r) => r.seed);
  writeFileSync(
    "src/lib/duel/tiltBank.server.ts",
    `/**\n * Tilt tiltRev 8's bank: ${seeds.length} seeds the oracle (scripts/tilt-oracle.ts) played to 200 through the server's\n * replay (of ${rows.length} dealable candidates). Built by \`bun scripts/tilt-bank.ts\`; tilt-expand-check replays the proofs\n * (scripts/fixtures/tilt-bank-runs.json.gz). Server-only.\n */\nexport const TILT_BANK: readonly number[] = ${JSON.stringify(seeds)};\n\n${SEED_FOR}`,
  );
  writeFileSync("scripts/fixtures/tilt-bank-runs.json.gz", gzipSync(JSON.stringify({ runs: kept.map((r) => ({ seed: r.seed, raw: r.raw })) })));
  console.log(`bank: ${seeds.length} of ${rows.length} candidates reach 200`);
}
