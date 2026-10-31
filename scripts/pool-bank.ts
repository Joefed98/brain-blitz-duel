/**
 * Builds Cue Ball's banks (`pool`): layouts the shot search (scripts/pool-oracle.ts) cleared without a miss or a foul,
 * and each one's witness run (the clearance's shots fired as soon as the balls stop). Every witness must score exactly
 * 200 through the server's replay on its revision, or the seed is dropped. Seeded candidates, so a rebuild writes the
 * same files.
 *
 *  - poolRev 1 (the default): src/lib/duel/poolBank.server.ts and scripts/fixtures/pool-witness.json (kept exactly
 *    for stored rounds; rooms no longer deal it);
 *  - poolRev 2 (`--rev=2`, what rooms deal): src/lib/duel/poolBankV2.server.ts and
 *    scripts/fixtures/pool-witness-v2.json, its witnesses on poolRev 2's input (power in c, the spin dot in d).
 *
 *   bun scripts/pool-bank.ts [--rev=2] [--count=60] [--jobs=4] [--check]
 *
 * --jobs searches candidates in parallel child processes (the result is the same whatever the job count: candidates are
 * tried in fixed batches and taken in their own order).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { poolCheckpoint, poolGameFor, poolLayout, POOL_AIM } from "../src/lib/arcade/pool";
import { SPORTS_CHECKPOINT_INTERVAL } from "../src/lib/arcade/sportsKit";
import { encodePoolRun, replayPoolRun } from "../src/lib/duel/pool";
import { clearRack, type Shot } from "./pool-oracle";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const COUNT = Number(opt("count") ?? 60);
const REV = Number(opt("rev") ?? 1) === 2 ? 2 : 1;
const JOBS = Math.max(1, Number(opt("jobs") ?? (REV === 2 ? Math.min(4, cpus().length) : 1)));
const CHECK = args.includes("--check");
/** A child's work: candidate indices from..to (exclusive), printed as one JSON line. */
const WORKER = opt("worker");

/** The candidate seeds, a fixed spread. */
function candidate(n: number): number {
  let x = (n + 7) * 0x9e3779b1;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

/** The witness: each shot fired on the first tick the table is still, through the game; its encoded run. */
export function witnessRun(seed: number, shots: readonly Shot[], rev = 1): string {
  const game = poolGameFor(rev === 2 ? 2 : undefined);
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints = [];
  let next = 0;
  while (!game.isOver(s)) {
    const t = s.tick + 1;
    if (s.phase === POOL_AIM && next < shots.length) {
      const sh = shots[next++]!;
      recordInput(events, { t, k: 1, a: sh.a, b: sh.b, c: sh.c, d: rev === 2 ? sh.d : 0 }, game.inputRanges);
    }
    s = game.step(s, inputAt(events, t));
    if (s.tick % SPORTS_CHECKPOINT_INTERVAL === 0) checkpoints.push(poolCheckpoint(s));
  }
  return encodePoolRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
}

interface Tried {
  n: number;
  seed: number;
  /** The witness, or why the seed was dropped. */
  raw?: string;
  note: string;
}

/** One candidate: the search, the witness and its proof through the server's replay. */
function tryCandidate(n: number): Tried {
  const seed = candidate(n);
  const shots = clearRack(poolLayout(seed).balls, { sims: 0, max: 400 }, 0, REV);
  if (!shots) return { n, seed, note: `seed ${seed}: no clearance found, dropped` };
  const raw = witnessRun(seed, shots, REV);
  const r = REV === 2 ? replayPoolRun(seed, raw, 2) : replayPoolRun(seed, raw);
  if (r.score !== 200 || r.flagged) return { n, seed, note: `seed ${seed}: witness scores ${r.score}${r.flagged ? " (flagged)" : ""}, dropped` };
  return { n, seed, raw, note: `seed ${seed}: cleared in ${shots.length} shots, ${r.endedSeconds} s → 200` };
}

async function runBatch(from: number, to: number): Promise<Tried[]> {
  if (JOBS <= 1) {
    const out: Tried[] = [];
    for (let n = from; n < to; n++) out.push(tryCandidate(n));
    return out;
  }
  const per = Math.ceil((to - from) / JOBS);
  const parts: Promise<Tried[]>[] = [];
  for (let k = 0; k < JOBS; k++) {
    const a = from + k * per;
    const b = Math.min(to, a + per);
    if (a >= b) continue;
    const proc = Bun.spawn(["bun", new URL(import.meta.url).pathname, `--rev=${REV}`, `--worker=${a}:${b}`], { stdout: "pipe", stderr: "inherit" });
    parts.push(
      new Response(proc.stdout).text().then((text) => {
        const line = text.trim().split("\n").filter(Boolean).pop() ?? "[]";
        return JSON.parse(line) as Tried[];
      }),
    );
  }
  return (await Promise.all(parts)).flat().sort((x, y) => x.n - y.n);
}

if (import.meta.main && WORKER) {
  const [a, b] = WORKER.split(":").map(Number);
  const out: Tried[] = [];
  for (let n = a!; n < b!; n++) out.push(tryCandidate(n));
  console.log(JSON.stringify(out));
} else if (import.meta.main) {
  const bank: number[] = [];
  const witness: Record<string, string> = {};
  let tried = 0;
  // Candidates in fixed batches of COUNT, taken in order until the bank is full (at most four batches).
  for (let batch = 0; bank.length < COUNT && batch < 4; batch++) {
    const results = await runBatch(batch * COUNT, (batch + 1) * COUNT);
    for (const r of results) {
      if (bank.length >= COUNT) break;
      tried++;
      console.log(r.note);
      if (!r.raw) continue;
      bank.push(r.seed);
      witness[String(r.seed)] = r.raw;
    }
  }
  const body =
    REV === 2
      ? `/**
 * Cue Ball poolRev 2's bank (what rooms deal): ${bank.length} layouts (of ${tried} candidates) the shot search
 * (scripts/pool-oracle.ts, on poolRev 2's continuous spin) cleared without a miss or a foul (seven spots, then the
 * black). Every layout's witness run (scripts/fixtures/pool-witness-v2.json, poolRev 2's input: power in c, the spin
 * dot in d) scores exactly 200 through the server's replay on poolRev 2 (pool-check). Built by
 * \`bun scripts/pool-bank.ts --rev=2\`. Server-only.
 */
export const POOL_BANK_V2: readonly number[] = [${bank.join(",")}];

/** The skill-band tool's seed index n → a poolRev 2 bank seed (fresh seeds from 10000 start past the first 30). */
export function poolBankV2SeedFor(n: number): number {
  const len = POOL_BANK_V2.length;
  return n < 10000 ? POOL_BANK_V2[n % len]! : POOL_BANK_V2[30 + ((n - 10000) % (len - 30))]!;
}
`
      : `/**
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
  const out = new URL(REV === 2 ? "../src/lib/duel/poolBankV2.server.ts" : "../src/lib/duel/poolBank.server.ts", import.meta.url);
  const wOut = new URL(REV === 2 ? "./fixtures/pool-witness-v2.json" : "./fixtures/pool-witness.json", import.meta.url);
  const wBody = JSON.stringify(witness) + "\n";
  if (CHECK) {
    let same = false;
    try {
      same = readFileSync(out, "utf8") === body && readFileSync(wOut, "utf8") === wBody;
    } catch {
      same = false;
    }
    console.log(same ? `pool bank (poolRev ${REV}): rebuilt byte for byte` : `FAIL: pool bank (poolRev ${REV}) differs from a rebuild`);
    process.exit(same ? 0 : 1);
  }
  writeFileSync(out, body);
  writeFileSync(wOut, wBody);
  console.log(`pool bank (poolRev ${REV}): ${bank.length} layouts of ${tried}`);
}
