/**
 * Builds Grappler's swingRev 17 deal, as Apex's (scripts/racing-deal.ts): src/lib/duel/swingSlideDeal.server.ts
 * (SWING_SLIDE_DEAL) lists SWING_SLIDE_DEAL_SIZE course seeds, each one whose oracle run replays through the server's
 * own path (encodeSwingRun → replaySwingRun on swingRev 17) to exactly 200, unflagged. Candidates come from a fixed
 * hashed sequence (swingSlideCandidate(0, 1, 2 …)); each candidate's course is built (the sim's own builder, sliding
 * hooks phased to its planned route), then the oracle plays it: the skill-band bot at the flawless level
 * (scripts/arcade-skill-bands/bots/swingRework.ts, no timing error, SWING_SLIDE_ORACLE_TRIES look-ahead stream: in
 * trials a second or third stream never rescued a course the first missed); a log that scores exactly 200 is kept as
 * the course's witness
 * (scripts/fixtures/swing-slide-deal-witness.json.gz). A candidate none of whose tries reaches 200 is dropped and
 * counted.
 *
 *   bun scripts/swing-slide-deal.ts            (writes the deal and the witnesses; 4 worker processes, ~15–25 min)
 *   bun scripts/swing-slide-deal.ts --check    (replays every stored witness through the server path: each exactly 200,
 *                                                and the deal is exactly the witnessed seeds in order; ~1 min)
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync, appendFileSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import { swingGameFor, swingCheckpoint, swingSlideParts, SWING_REV_SLIDE, SWING_CHECKPOINT_INTERVAL, type SwingState } from "../src/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "../src/lib/duel/swing";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

export const SWING_SLIDE_DEAL_SIZE = 120;
export const SWING_SLIDE_ORACLE_TRIES = 1;
const OUT = new URL("../src/lib/duel/swingSlideDeal.server.ts", import.meta.url);
export const SWING_SLIDE_WITNESS = new URL("./fixtures/swing-slide-deal-witness.json.gz", import.meta.url);
const WORKERS = 4;
const BATCH = 8;

/** The candidate sequence: a hash of 0, 1, 2 … into 1 … 2^31 − 2 (as roomSeed). */
export function swingSlideCandidate(n: number): number {
  let x = (n + 1) * 0x3a8f05c5;
  x = Math.imul(x ^ (x >>> 16), 0x297a2d39);
  x = Math.imul(x ^ (x >>> 15), 0x9e3779b1);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

type Ev = ArcadeInputEvent;
export type SwingWitness = { seed: number; tries: number; events: Ev[] };

/** The phone's submission for a log on swingRev 17: steps the sim, takes checkpoints, encodes. */
export function swingSlideSubmission(seed: number, events: readonly Ev[]): string {
  const game = swingGameFor(SWING_REV_SLIDE);
  const byT = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as SwingState;
  const checkpoints: unknown[] = [];
  while (!game.isOver(s)) {
    s = game.step(s, byT.get(s.tick + 1) ?? null) as SwingState;
    if (s.tick % SWING_CHECKPOINT_INTERVAL === 0) checkpoints.push(swingCheckpoint(s));
  }
  return encodeSwingRun({ seed, claimedScore: game.score(s), events: [...events], inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
}

/** The server's verdict on a log: its stored score, whether flagged, and the parts. */
export function swingSlideVerdict(seed: number, events: readonly Ev[]) {
  const r = replaySwingRun(seed, swingSlideSubmission(seed, events), SWING_REV_SLIDE);
  return { score: r.score, flagged: Boolean(r.flagged), parts: swingSlideParts(r.state) };
}

/** The oracle on one candidate: the first of its tries that the server scores exactly 200, or null. */
async function oracle(seed: number): Promise<SwingWitness | null> {
  const { Human } = await import("./arcade-skill-bands/human");
  const { bot } = await import("./arcade-skill-bands/bots/swing");
  const game = swingGameFor(SWING_REV_SLIDE);
  for (let v = 0; v < SWING_SLIDE_ORACLE_TRIES; v++) {
    const human = new Human("swing", (seed + v * 7919) | 0, "perfect" as never);
    const events = (bot({ game, seed, rev: SWING_REV_SLIDE, human } as never).events ?? []) as Ev[];
    const verdict = swingSlideVerdict(seed, events);
    if (verdict.score === 200 && !verdict.flagged) return { seed, tries: v + 1, events };
  }
  return null;
}

function readWitnesses(): SwingWitness[] {
  return (JSON.parse(gunzipSync(readFileSync(SWING_SLIDE_WITNESS)).toString()) as { witnesses: SwingWitness[] }).witnesses;
}

/** The written deal's seeds. */
function readDeal(): number[] {
  const text = readFileSync(OUT, "utf8");
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
      const seed = swingSlideCandidate(n);
      const w = await oracle(seed);
      appendFileSync(out, `${JSON.stringify({ n, seed, witness: w })}\n`);
    }
    process.exit(0);
  }
  if (process.argv.includes("--check")) {
    const deal = readDeal();
    const witnesses = readWitnesses();
    let bad = 0;
    if (witnesses.length !== deal.length || witnesses.some((w, i) => w.seed !== deal[i])) {
      console.log("FAIL: the deal is not exactly the witnessed seeds in order");
      bad++;
    }
    for (const w of witnesses) {
      const v = swingSlideVerdict(w.seed, w.events);
      if (v.score !== 200 || v.flagged) {
        console.log(`FAIL: seed ${w.seed}: its witness scores ${v.score}${v.flagged ? " (flagged)" : ""}`);
        bad++;
      }
    }
    console.log(bad ? `FAIL swing-slide-deal: ${bad} problem(s)` : `ok: ${witnesses.length} dealt courses, each witness exactly 200 through the server replay`);
    process.exit(bad ? 1 : 0);
  }
  // Batches of candidates over WORKERS processes until SWING_SLIDE_DEAL_SIZE are kept, in candidate order.
  const results = new Map<number, { seed: number; witness: SwingWitness | null }>();
  let next = 0;
  const kept = () => {
    const out: SwingWitness[] = [];
    let dropped = 0;
    for (let n = 0; results.has(n) && out.length < SWING_SLIDE_DEAL_SIZE; n++) {
      const r = results.get(n)!;
      if (r.witness) out.push(r.witness);
      else dropped++;
    }
    return { out, dropped };
  };
  while (kept().out.length < SWING_SLIDE_DEAL_SIZE) {
    const want = SWING_SLIDE_DEAL_SIZE - kept().out.length;
    const to = next + Math.max(BATCH, Math.ceil(want * 3.2));
    const tmp = `/tmp/swing-slide-deal-${process.pid}.jsonl`;
    if (existsSync(tmp)) unlinkSync(tmp);
    await Promise.all(
      Array.from({ length: WORKERS }, (_, k) => new Promise<void>((resolve, reject) => {
        const child = spawn("bun", [new URL(import.meta.url).pathname, `--worker=${k}`, `--from=${next}`, `--to=${to}`, `--out=${tmp}`], { stdio: "inherit" });
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker ${k} exited ${code}`))));
      })),
    );
    for (const line of readFileSync(tmp, "utf8").trim().split("\n").filter(Boolean)) {
      const r = JSON.parse(line) as { n: number; seed: number; witness: SwingWitness | null };
      results.set(r.n, { seed: r.seed, witness: r.witness });
    }
    unlinkSync(tmp);
    next = to;
    console.log(`candidates 0–${to - 1}: ${kept().out.length} kept so far`);
  }
  const { out, dropped } = kept();
  const tried = out.length + dropped;
  const byTries = [1, 2, 3].slice(0, SWING_SLIDE_ORACLE_TRIES).map((t) => out.filter((w) => w.tries === t).length);
  writeFileSync(
    OUT,
    `/**
 * Grappler's deal (swingRev 17; built by \`bun scripts/swing-slide-deal.ts\`, do not edit): ${SWING_SLIDE_DEAL_SIZE} course
 * seeds, each proved on swingRev 17: the oracle (the flawless-level skill-band bot, scripts/swing-slide-deal.ts) plays the
 * course built from the seed and its log replays through replaySwingRun to exactly 200 (witnesses in
 * scripts/fixtures/swing-slide-deal-witness.json.gz). ${dropped} candidate${dropped === 1 ? "" : "s"} of the first ${tried} dropped
 * (${out.length} kept).
 */
export const SWING_SLIDE_DEAL: readonly number[] = ${JSON.stringify(out.map((w) => w.seed))};

/** The course a room seed deals on swingRev 17. */
export function swingSlideDealSeed(roomSeed: number): number {
  const n = SWING_SLIDE_DEAL.length;
  return SWING_SLIDE_DEAL[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`,
  );
  writeFileSync(SWING_SLIDE_WITNESS, gzipSync(JSON.stringify({ note: "Grappler swingRev 17 deal witnesses (scripts/swing-slide-deal.ts): each seed's oracle log, exactly 200 through the server replay", witnesses: out })));
  console.log(`wrote ${out.length} seeds; ${dropped} of the first ${tried} candidates dropped; oracle tries per kept course ${byTries.join(" / ")}`);
}
