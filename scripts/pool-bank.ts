/**
 * Builds Speed Pool's bank (poolRev 1): layouts the shot search (scripts/pool-oracle.ts) cleared without a miss or a
 * foul, written to src/lib/duel/poolBank.server.ts, and each one's witness run (the clearance's shots fired as soon as
 * the balls stop) to scripts/fixtures/pool-witness.json. Every witness must score exactly 200 through the server's
 * replay, or the seed is dropped. Seeded candidates, so a rebuild writes the same files.
 *
 *   bun scripts/pool-bank.ts [--count=60] [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { poolCheckpoint, poolGameFor, poolLayout, POOL_AIM } from "../src/lib/arcade/pool";
import { SPORTS_CHECKPOINT_INTERVAL } from "../src/lib/arcade/sportsKit";
import { encodePoolRun, replayPoolRun } from "../src/lib/duel/pool";
import { clearRack, type Shot } from "./pool-oracle";

const args = process.argv.slice(2);
const COUNT = Number(args.find((a) => a.startsWith("--count="))?.slice(8) ?? 60);
const CHECK = args.includes("--check");

/** The candidate seeds, a fixed spread. */
function candidate(n: number): number {
  let x = (n + 7) * 0x9e3779b1;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

/** The witness: each shot fired on the first tick the table is still, through the game; its encoded run. */
export function witnessRun(seed: number, shots: readonly Shot[]): string {
  const game = poolGameFor();
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints = [];
  let next = 0;
  while (!game.isOver(s)) {
    const t = s.tick + 1;
    if (s.phase === POOL_AIM && next < shots.length) {
      const sh = shots[next++]!;
      recordInput(events, { t, k: 1, a: sh.a, b: sh.b, c: sh.c, d: 0 }, game.inputRanges);
    }
    s = game.step(s, inputAt(events, t));
    if (s.tick % SPORTS_CHECKPOINT_INTERVAL === 0) checkpoints.push(poolCheckpoint(s));
  }
  return encodePoolRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
}

if (import.meta.main) {
  const bank: number[] = [];
  const witness: Record<string, string> = {};
  let tried = 0;
  for (let n = 0; bank.length < COUNT && n < COUNT * 4; n++) {
    tried++;
    const seed = candidate(n);
    const shots = clearRack(poolLayout(seed).balls, { sims: 0, max: 400 });
    if (!shots) {
      console.log(`seed ${seed}: no clearance found, dropped`);
      continue;
    }
    const raw = witnessRun(seed, shots);
    const r = replayPoolRun(seed, raw);
    if (r.score !== 200 || r.flagged) {
      console.log(`seed ${seed}: witness scores ${r.score}${r.flagged ? " (flagged)" : ""}, dropped`);
      continue;
    }
    bank.push(seed);
    witness[String(seed)] = raw;
    console.log(`seed ${seed}: cleared in ${shots.length} shots, ${r.endedSeconds} s → 200`);
  }
  const body = `/**
 * Speed Pool poolRev 1's bank: ${bank.length} layouts (of ${tried} candidates) the shot search (scripts/pool-oracle.ts)
 * cleared without a miss or a foul (seven spots, then the black). Every layout's witness run
 * (scripts/fixtures/pool-witness.json) scores exactly 200 through the server's replay (pool-check). Built by
 * \`bun scripts/pool-bank.ts\`. Server-only.
 */
export const POOL_BANK: readonly number[] = [${bank.join(",")}];

/** The skill-band tool's seed index n → a bank seed (fresh seeds from 10000 start past the first 30). */
export function poolBankSeedFor(n: number): number {
  const len = POOL_BANK.length;
  return n < 10000 ? POOL_BANK[n % len]! : POOL_BANK[30 + ((n - 10000) % (len - 30))]!;
}
`;
  const out = new URL("../src/lib/duel/poolBank.server.ts", import.meta.url);
  const wOut = new URL("./fixtures/pool-witness.json", import.meta.url);
  const wBody = JSON.stringify(witness) + "\n";
  if (CHECK) {
    const same = readFileSync(out, "utf8") === body && readFileSync(wOut, "utf8") === wBody;
    console.log(same ? "pool bank: rebuilt byte for byte" : "FAIL: pool bank differs from a rebuild");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(out, body);
  writeFileSync(wOut, wBody);
  console.log(`pool bank: ${bank.length} layouts of ${tried}`);
}
