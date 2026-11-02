/**
 * Builds Minigolf's bank (golfRev 1): seeds whose five holes the putt search (scripts/minigolf-oracle.ts) holed, each
 * hole's par its best route + 1, and a witness run per seed (the best routes played back to back, each putt as soon
 * as the ball stops) that scores exactly 200 through the server's replay.
 *
 *   bun scripts/minigolf-bank.ts [--rev=2] [--count=60] [--jobs=4] [--candidates=90] [--check]
 *
 * Writes src/lib/duel/minigolfBank.server.ts and scripts/fixtures/minigolf-witness.json (golfRev 1, the default), or
 * with --rev=2 src/lib/duel/minigolfBankV2.server.ts and scripts/fixtures/minigolf-witness-v2.json (golfRev 2, crazy
 * golf: each hole searched from the tick its first putt can be played, every putt rolled on the sim's clock, a putt
 * that meets a windmill's sails also tried after waits, and the witness waiting those ticks); `--check` rebuilds and
 * compares without writing. The candidate seeds are a fixed sequence, so a rebuild is byte for byte.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { minigolfCheckpoint, minigolfCourse, minigolfCourseV2, minigolfGameFor, MG_AIM, MG_HOLE_PAUSE, MINIGOLF_HOLES, mgStrokeLimit, type MinigolfState } from "../src/lib/arcade/minigolf";
import { recordInput, inputAt, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeMinigolfRun, replayMinigolfRun } from "../src/lib/duel/minigolf";
import { SPORTS_CHECKPOINT_INTERVAL, type SportsCheckpoint } from "../src/lib/arcade/sportsKit";
import { bestRoute, type Putt, type Route } from "./minigolf-oracle";

const args = process.argv.slice(2);
const COUNT = Number(args.find((a) => a.startsWith("--count="))?.slice(8) ?? 60);
const CHECK = args.includes("--check");
const REV = Number(args.find((a) => a.startsWith("--rev="))?.slice(6) ?? 1);
/** golfRev 2's candidates start further along the same sequence, so no seed is in both banks. */
const V2_FROM = 5000;

/** The fixed candidate sequence (a 32-bit spread, as roomSeed in the skill-band tool). */
export function candidateSeed(n: number): number {
  let x = (n + 1) * 0x9e3779b1;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

/**
 * Plays per-hole putt lists back to back, each as soon as the ball rests, or (golfRev 2) its wait `w` ticks after
 * that (the witness's timing).
 */
export function playRoutes(seed: number, pars: number[], routes: Putt[][], rev = 1): { events: ArcadeInputEvent[]; state: MinigolfState; checkpoints: SportsCheckpoint[] } {
  const game = minigolfGameFor(pars, rev);
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: SportsCheckpoint[] = [];
  let next = 0;
  let hole = -1;
  let aimSince = -1;
  while (!game.isOver(s)) {
    if (s.hole !== hole) {
      hole = s.hole;
      next = 0;
    }
    const t = s.tick + 1;
    if (s.phase !== MG_AIM) aimSince = -1;
    else if (aimSince < 0) aimSince = s.tick;
    if (s.phase === MG_AIM && next < (routes[s.hole]?.length ?? 0) && t >= aimSince + 1 + (routes[s.hole]![next]!.w ?? 0)) {
      const p = routes[s.hole]![next++]!;
      recordInput(events, { t, k: 1, a: p.a, b: p.b, c: p.c, d: 0 }, game.inputRanges);
      aimSince = -1;
    }
    s = game.step(s, inputAt(events, t));
    if (s.tick % SPORTS_CHECKPOINT_INTERVAL === 0) checkpoints.push(minigolfCheckpoint(s));
  }
  return { events, state: s, checkpoints };
}

/** Proves candidate n: its course's best routes (each par = best + 1, under the stroke limit) and a 200 witness. */
function proveCandidate(n: number): { n: number; seed: number; pars: number[]; raw: string; finish: number } | { n: number; seed: number; dropped: string } {
  const seed = candidateSeed(REV >= 2 ? n + V2_FROM : n);
  let routes: (Route | null)[];
  if (REV >= 2) {
    // golfRev 2 rolls on the sim's clock: each hole is searched from the tick its first putt can be played (the
    // previous hole's drop + the pause + 1), so the windmills' sails are where the witness will meet them.
    routes = [];
    let start = 1;
    for (const h of minigolfCourseV2(seed)) {
      const r = bestRoute(h, 4, 14, start);
      routes.push(r);
      if (!r) break;
      start = r.holedTick! + MG_HOLE_PAUSE + 1;
    }
  } else routes = minigolfCourse(seed).map((h) => bestRoute(h));
  if (routes.length < MINIGOLF_HOLES || routes.some((r) => !r || r.strokes + 1 >= mgStrokeLimit(REV, r.strokes + 1))) return { n, seed, dropped: "a hole without a proven route under the stroke limit" };
  const pars = routes.map((r) => r!.strokes + 1);
  const { events, state, checkpoints } = playRoutes(seed, pars, routes.map((r) => r!.putts), REV);
  const raw = encodeMinigolfRun({ seed, claimedScore: minigolfGameFor(pars, REV).score(state), events, endTick: state.tick, checkpoints });
  const replay = replayMinigolfRun(seed, raw, pars, REV);
  if (replay.score !== 200 || replay.flagged) return { n, seed, dropped: `witness scored ${replay.score}` };
  return { n, seed, pars, raw, finish: state.finishTick };
}

const JOBS = Number(args.find((a) => a.startsWith("--jobs="))?.slice(7) ?? 4);
const CANDIDATES = Number(args.find((a) => a.startsWith("--candidates="))?.slice(13) ?? Math.ceil(COUNT * 1.5));

if (import.meta.main && args.includes("--child")) {
  // One worker: every candidate n with n % jobs === part, one JSON line each.
  const part = Number(args.find((a) => a.startsWith("--part="))?.slice(7) ?? 0);
  for (let n = part; n < CANDIDATES; n += JOBS) console.log(JSON.stringify(proveCandidate(n)));
} else if (import.meta.main) {
  // The candidates are proved in JOBS worker processes; the bank keeps the first COUNT proven in candidate order, so
  // a rebuild is byte for byte whatever the job count.
  const outs = await Promise.all(
    Array.from({ length: JOBS }, async (_, part) => {
      const proc = Bun.spawn(["bun", new URL(import.meta.url).pathname, "--child", `--part=${part}`, `--jobs=${JOBS}`, `--candidates=${CANDIDATES}`, `--rev=${REV}`], { stdout: "pipe", stderr: "ignore" });
      return await new Response(proc.stdout).text();
    }),
  );
  const results = outs
    .flatMap((o) => o.split("\n").filter((l) => l.startsWith("{")))
    .map((l) => JSON.parse(l) as ReturnType<typeof proveCandidate>)
    .sort((a, b) => a.n - b.n);
  const bank: { seed: number; pars: number[] }[] = [];
  const witness: Record<string, string> = {};
  let tried = 0;
  for (const r of results) {
    if (bank.length >= COUNT) break;
    tried++;
    if ("dropped" in r) {
      console.log(`seed ${r.seed}: dropped (${r.dropped})`);
      continue;
    }
    bank.push({ seed: r.seed, pars: r.pars });
    witness[String(r.seed)] = r.raw;
    console.log(`seed ${r.seed}: pars ${r.pars.join(" ")} · witness ${(r.finish / 60).toFixed(1)} s`);
  }
  const body = REV >= 2 ? bodyV2(bank, tried) : `/**
 * Minigolf golfRev 1's bank: ${bank.length} courses (of ${tried} candidates) whose five holes the putt search
 * (scripts/minigolf-oracle.ts) holed, each with its pars (the best route found + 1, so a birdie is always possible).
 * Every course's witness run (scripts/fixtures/minigolf-witness.json) scores exactly 200 through the server's replay
 * (minigolf-check). Built by \`bun scripts/minigolf-bank.ts\`. Server-only.
 */
export interface MinigolfBankEntry {
  seed: number;
  pars: readonly number[];
}

export const MINIGOLF_BANK: readonly MinigolfBankEntry[] = [
${bank.map((e) => `  { seed: ${e.seed}, pars: [${e.pars.join(", ")}] },`).join("\n")}
];

/** The skill-band tool's seed index n → a bank course (fresh seeds from 10000 start past the tuning set). */
export function minigolfBankEntryFor(n: number): MinigolfBankEntry {
  const len = MINIGOLF_BANK.length;
  const half = Math.floor(len / 2);
  return n < 10000 ? MINIGOLF_BANK[n % half]! : MINIGOLF_BANK[half + ((n - 10000) % (len - half))]!;
}

export const MINIGOLF_HOLE_COUNT = ${MINIGOLF_HOLES};
`;
  const witnessText = `${JSON.stringify(witness)}\n`;
  const bankPath = new URL(REV >= 2 ? "../src/lib/duel/minigolfBankV2.server.ts" : "../src/lib/duel/minigolfBank.server.ts", import.meta.url);
  const witnessPath = new URL(REV >= 2 ? "./fixtures/minigolf-witness-v2.json" : "./fixtures/minigolf-witness.json", import.meta.url);
  if (CHECK) {
    const same = readFileSync(bankPath, "utf8") === body && readFileSync(witnessPath, "utf8") === witnessText;
    console.log(same ? "PASS: bank rebuilds byte for byte" : "FAIL: bank differs");
    if (!same) process.exit(1);
  } else {
    writeFileSync(bankPath, body);
    writeFileSync(witnessPath, witnessText);
    console.log(`wrote ${bank.length} courses`);
  }
}

/** golfRev 2's bank file. */
function bodyV2(bank: { seed: number; pars: number[] }[], tried: number): string {
  return `/**
 * Minigolf golfRev 2's bank (crazy golf, 31 Oct 2026): ${bank.length} courses (of ${tried} candidates) whose five holes the putt
 * search (scripts/minigolf-oracle.ts) holed on the sim's clock (windmills, tunnels, sand, hills and banked curves all
 * in the roll), each with its pars (the best route found + 1, so a birdie is always possible). Every course's witness
 * run (scripts/fixtures/minigolf-witness-v2.json; putts after waits where a windmill's sails are in the way) scores
 * exactly 200 through the server's replay (minigolf-check). Built by \`bun scripts/minigolf-bank.ts --rev=2\`. Server-only.
 */
import type { MinigolfBankEntry } from "./minigolfBank.server";

export const MINIGOLF_BANK_V2: readonly MinigolfBankEntry[] = [
${bank.map((e) => `  { seed: ${e.seed}, pars: [${e.pars.join(", ")}] },`).join("\n")}
];

/** The skill-band tool's seed index n → a golfRev 2 bank course (fresh seeds from 10000 start past the tuning set). */
export function minigolfBankV2EntryFor(n: number): MinigolfBankEntry {
  const len = MINIGOLF_BANK_V2.length;
  const half = Math.floor(len / 2);
  return n < 10000 ? MINIGOLF_BANK_V2[n % half]! : MINIGOLF_BANK_V2[half + ((n - 10000) % (len - half))]!;
}
`;
}
