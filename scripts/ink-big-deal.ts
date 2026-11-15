/**
 * Builds Rainbow Bridge's inkRev 14 deal, as Grappler's (scripts/swing-slide-deal.ts): src/lib/duel/inkBigDeal.server.ts
 * (INK_BIG_DEAL) lists INK_BIG_DEAL_SIZE level seeds, each one whose ten levels build with every proof passing (each
 * level drawable as a phone draws it, its bonus line proved, exactly two clovers, every ink par at least its proved line's
 * ink: inkV13Proof on inkRev 14) and whose perfect run (the oracle, scripts/ink-x200-oracle.ts: each level's proved line
 * within its par, the live levels' hand-drawn strokes) replays through the server's own path (encodeInkBridgeRun →
 * replayInkBridgeRun on inkRev 14) to exactly 200, unflagged. Candidates come from a fixed hashed sequence
 * (inkBigCandidate(0, 1, 2 …)); the oracle's log is kept as the seed's witness
 * (scripts/fixtures/ink-big-deal-witness.json.gz). A candidate that fails a proof or scores under 200 is dropped and
 * counted.
 *
 *   bun scripts/ink-big-deal.ts            (writes the deal and the witnesses; 4 worker processes, ~2–4 min)
 *   bun scripts/ink-big-deal.ts --check    (replays every stored witness through the server path: each exactly 200,
 *                                            and the deal is exactly the witnessed seeds in order; ~4 min on one core)
 *
 * `--rev=15` (the Strategy overhaul, 15 Nov 2026) does the same for inkRev 15 (the pot and hill placed level by level):
 * src/lib/duel/inkHillsDeal.server.ts (INK_HILLS_DEAL) and scripts/fixtures/ink-hills-deal-witness.json.gz. Without it
 * the script builds and checks inkRev 14's deal exactly as before.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync, appendFileSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import { inkBridgeGameFor, inkCheckpoint, inkV13Proof, INK_CHECKPOINT_INTERVAL, INK_REV_BIG, INK_REV_HILLS, INK_V13_CLOVERS, type InkState } from "../src/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

export const INK_BIG_DEAL_SIZE = 100;
/** The revision this run builds or checks: inkRev 14 (default) or, with --rev=15, inkRev 15. */
const HILLS = process.argv.includes("--rev=15");
const REV = HILLS ? INK_REV_HILLS : INK_REV_BIG;
const OUT = HILLS ? new URL("../src/lib/duel/inkHillsDeal.server.ts", import.meta.url) : new URL("../src/lib/duel/inkBigDeal.server.ts", import.meta.url);
export const INK_BIG_WITNESS = new URL("./fixtures/ink-big-deal-witness.json.gz", import.meta.url);
export const INK_HILLS_WITNESS = new URL("./fixtures/ink-hills-deal-witness.json.gz", import.meta.url);
const WITNESS = HILLS ? INK_HILLS_WITNESS : INK_BIG_WITNESS;
const WORKERS = 4;
const BATCH = 8;

/** The candidate sequence: a hash of 0, 1, 2 … into 1 … 2^31 − 2 (as arcadeSeed). */
export function inkBigCandidate(n: number): number {
  let x = (n + 1) * 0x2c1b3c6d;
  x = Math.imul(x ^ (x >>> 16), 0x297a2d39);
  x = Math.imul(x ^ (x >>> 15), 0x9e3779b1);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

type Ev = ArcadeInputEvent;
export type InkWitness = { seed: number; events: Ev[] };

/** The phone's submission for a log on inkRev 14: steps the sim, takes checkpoints, encodes. */
export function inkBigSubmission(seed: number, events: readonly Ev[], rev: number = INK_REV_BIG): string {
  const game = inkBridgeGameFor(rev);
  const byT = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as InkState;
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byT.get(s.tick + 1) ?? null) as InkState;
    if (s.tick % INK_CHECKPOINT_INTERVAL === 0) checkpoints.push(inkCheckpoint(s));
  }
  return encodeInkBridgeRun({ seed, claimedScore: game.score(s), events: [...events], inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
}

/** The server's verdict on a log: its stored score and whether it was flagged. */
export function inkBigVerdict(seed: number, events: readonly Ev[], rev: number = INK_REV_BIG): { score: number; flagged: boolean; levels: number } {
  const r = replayInkBridgeRun(seed, inkBigSubmission(seed, events, rev), rev);
  return { score: r.score, flagged: Boolean(r.flagged), levels: r.levels };
}

/** Every level of the seed's inkRev 14 build proved (generation's own proofs, re-run), with exactly two clovers. */
export function inkBigProved(seed: number, rev: number = INK_REV_BIG): boolean {
  const proof = inkV13Proof(seed, rev);
  const bad = proof.filter((l) => !l.ref || l.unaided || l.bonus === false || !(l.par >= l.witness) || l.par <= 0);
  return bad.length === 0 && proof.filter((l) => l.kind.includes("clover")).length === INK_V13_CLOVERS && proof.filter((l) => l.kind === "live").length === 2;
}

/** The oracle on one candidate: its witness when every proof holds and its log scores exactly 200, else null. */
async function oracle(seed: number): Promise<InkWitness | null> {
  if (!inkBigProved(seed, REV)) return null;
  const { inkOracleRun } = await import("./ink-x200-oracle");
  const events = inkOracleRun(seed, REV).events;
  const v = inkBigVerdict(seed, events, REV);
  return v.score === 200 && !v.flagged ? { seed, events } : null;
}

export function readInkBigWitnesses(file: URL = INK_BIG_WITNESS): InkWitness[] {
  return (JSON.parse(gunzipSync(readFileSync(file)).toString()) as { witnesses: InkWitness[] }).witnesses;
}

/** The written deal's seeds. */
export function readInkBigDeal(file: URL = new URL("../src/lib/duel/inkBigDeal.server.ts", import.meta.url)): number[] {
  const text = readFileSync(file, "utf8");
  const body = text.slice(text.indexOf("= [") + 2);
  return JSON.parse(body.slice(0, body.indexOf("]") + 1)) as number[];
}

if (import.meta.main) {
  const workerArg = process.argv.find((a) => a.startsWith("--worker="));
  if (workerArg) {
    // A worker: candidates n with n % WORKERS === k, from `--from` to `--to`, one JSON line each to `--out`.
    const k = Number(workerArg.slice(9));
    const from = Number(process.argv.find((a) => a.startsWith("--from="))!.slice(7));
    const to = Number(process.argv.find((a) => a.startsWith("--to="))!.slice(5));
    const out = process.argv.find((a) => a.startsWith("--out="))!.slice(6);
    for (let n = from + k; n < to; n += WORKERS) {
      const seed = inkBigCandidate(n);
      const w = await oracle(seed);
      appendFileSync(out, `${JSON.stringify({ n, seed, witness: w })}\n`);
    }
    process.exit(0);
  }
  if (process.argv.includes("--check")) {
    const deal = readInkBigDeal(OUT);
    const witnesses = readInkBigWitnesses(WITNESS);
    let bad = 0;
    if (witnesses.length !== deal.length || witnesses.some((w, i) => w.seed !== deal[i])) {
      console.log("FAIL: the deal is not exactly the witnessed seeds in order");
      bad++;
    }
    for (const w of witnesses) {
      const v = inkBigVerdict(w.seed, w.events, REV);
      if (v.score !== 200 || v.flagged || !inkBigProved(w.seed, REV)) {
        console.log(`FAIL: seed ${w.seed}: its witness scores ${v.score}${v.flagged ? " (flagged)" : ""} or a level's proof fails`);
        bad++;
      }
    }
    console.log(bad ? `FAIL ink-big-deal: ${bad} problem(s)` : `ok: ${witnesses.length} dealt seeds, every level proved and each witness exactly 200 through the server replay`);
    process.exit(bad ? 1 : 0);
  }
  // Batches of candidates over WORKERS processes until INK_BIG_DEAL_SIZE are kept, in candidate order.
  const results = new Map<number, { seed: number; witness: InkWitness | null }>();
  let next = 0;
  const kept = () => {
    const out: InkWitness[] = [];
    let dropped = 0;
    for (let n = 0; results.has(n) && out.length < INK_BIG_DEAL_SIZE; n++) {
      const r = results.get(n)!;
      if (r.witness) out.push(r.witness);
      else dropped++;
    }
    return { out, dropped };
  };
  while (kept().out.length < INK_BIG_DEAL_SIZE) {
    const want = INK_BIG_DEAL_SIZE - kept().out.length;
    const to = next + Math.max(BATCH, Math.ceil(want * 1.1));
    const tmp = `/tmp/ink-big-deal-${process.pid}.jsonl`;
    if (existsSync(tmp)) unlinkSync(tmp);
    await Promise.all(
      Array.from({ length: WORKERS }, (_, k) => new Promise<void>((resolve, reject) => {
        const child = spawn("bun", [new URL(import.meta.url).pathname, `--worker=${k}`, `--from=${next}`, `--to=${to}`, `--out=${tmp}`, ...(HILLS ? ["--rev=15"] : [])], { stdio: "inherit" });
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker ${k} exited ${code}`))));
      })),
    );
    for (const line of readFileSync(tmp, "utf8").trim().split("\n").filter(Boolean)) {
      const r = JSON.parse(line) as { n: number; seed: number; witness: InkWitness | null };
      results.set(r.n, { seed: r.seed, witness: r.witness });
    }
    unlinkSync(tmp);
    next = to;
    console.log(`candidates 0–${to - 1}: ${kept().out.length} kept so far`);
  }
  const { out, dropped } = kept();
  const tried = out.length + dropped;
  if (HILLS) {
    writeFileSync(
      OUT,
      `/**
 * Rainbow Bridge's deal (inkRev 15, the Strategy overhaul; built by \`bun scripts/ink-big-deal.ts --rev=15\`, do not edit):
 * ${INK_BIG_DEAL_SIZE} level seeds, each proved on inkRev 15: every level's proof passes with its seeded pot placement
 * (drawable as a phone draws it, its bonus line proved, two clovers, every ink par at least its proved line's ink) and the
 * perfect run (the oracle, scripts/ink-x200-oracle.ts) replays through replayInkBridgeRun to exactly 200 (witnesses in
 * scripts/fixtures/ink-hills-deal-witness.json.gz). ${dropped} candidate${dropped === 1 ? "" : "s"} of the first ${tried} dropped
 * (${out.length} kept).
 */
export const INK_HILLS_DEAL: readonly number[] = ${JSON.stringify(out.map((w) => w.seed))};

/** The level seed a room seed deals on inkRev 15. */
export function inkHillsDealSeed(roomSeed: number): number {
  const n = INK_HILLS_DEAL.length;
  return INK_HILLS_DEAL[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`,
    );
    writeFileSync(INK_HILLS_WITNESS, gzipSync(JSON.stringify({ note: "Rainbow Bridge inkRev 15 deal witnesses (scripts/ink-big-deal.ts --rev=15): each seed's oracle log, exactly 200 through the server replay", witnesses: out })));
    console.log(`wrote ${out.length} seeds; ${dropped} of the first ${tried} candidates dropped`);
    process.exit(0);
  }
  writeFileSync(
    OUT,
    `/**
 * Rainbow Bridge's deal (inkRev 14; built by \`bun scripts/ink-big-deal.ts\`, do not edit): ${INK_BIG_DEAL_SIZE} level
 * seeds, each proved on inkRev 14: every level's proof passes with the bigger coin, clovers and birds (drawable as a phone
 * draws it, its bonus line proved, two clovers, every ink par at least its proved line's ink) and the perfect run (the
 * oracle, scripts/ink-x200-oracle.ts) replays through replayInkBridgeRun to exactly 200 (witnesses in
 * scripts/fixtures/ink-big-deal-witness.json.gz). ${dropped} candidate${dropped === 1 ? "" : "s"} of the first ${tried} dropped
 * (${out.length} kept).
 */
export const INK_BIG_DEAL: readonly number[] = ${JSON.stringify(out.map((w) => w.seed))};

/** The level seed a room seed deals on inkRev 14. */
export function inkBigDealSeed(roomSeed: number): number {
  const n = INK_BIG_DEAL.length;
  return INK_BIG_DEAL[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`,
  );
  writeFileSync(INK_BIG_WITNESS, gzipSync(JSON.stringify({ note: "Rainbow Bridge inkRev 14 deal witnesses (scripts/ink-big-deal.ts): each seed's oracle log, exactly 200 through the server replay", witnesses: out })));
  console.log(`wrote ${out.length} seeds; ${dropped} of the first ${tried} candidates dropped`);
}
