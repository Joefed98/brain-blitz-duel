/**
 * Builds Minigolf's bank (golfRev 1): seeds whose five holes the putt search (scripts/minigolf-oracle.ts) holed, each
 * hole's par its best route + 1, and a witness run per seed (the best routes played back to back, each putt as soon
 * as the ball stops) that scores exactly 200 through the server's replay.
 *
 *   bun scripts/minigolf-bank.ts [--count=60] [--jobs=4] [--candidates=90] [--check]
 *
 * Writes src/lib/duel/minigolfBank.server.ts and scripts/fixtures/minigolf-witness.json; `--check` rebuilds and
 * compares without writing. The candidate seeds are a fixed sequence, so a rebuild is byte for byte.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { minigolfCheckpoint, minigolfCourse, minigolfGameFor, MG_AIM, MINIGOLF_HOLES, MINIGOLF_STROKE_LIMIT, type MinigolfState } from "../src/lib/arcade/minigolf";
import { recordInput, inputAt, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeMinigolfRun, replayMinigolfRun } from "../src/lib/duel/minigolf";
import { SPORTS_CHECKPOINT_INTERVAL, type SportsCheckpoint } from "../src/lib/arcade/sportsKit";
import { bestRoute, type Putt } from "./minigolf-oracle";

const args = process.argv.slice(2);
const COUNT = Number(args.find((a) => a.startsWith("--count="))?.slice(8) ?? 60);
const CHECK = args.includes("--check");

/** The fixed candidate sequence (a 32-bit spread, as roomSeed in the skill-band tool). */
export function candidateSeed(n: number): number {
  let x = (n + 1) * 0x9e3779b1;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

/** Plays per-hole putt lists back to back, each as soon as the ball rests (the witness's timing). */
export function playRoutes(seed: number, pars: number[], routes: Putt[][]): { events: ArcadeInputEvent[]; state: MinigolfState; checkpoints: SportsCheckpoint[] } {
  const game = minigolfGameFor(pars);
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: SportsCheckpoint[] = [];
  let next = 0;
  let hole = -1;
  while (!game.isOver(s)) {
    if (s.hole !== hole) {
      hole = s.hole;
      next = 0;
    }
    const t = s.tick + 1;
    if (s.phase === MG_AIM && next < (routes[s.hole]?.length ?? 0)) {
      const p = routes[s.hole]![next++]!;
      recordInput(events, { t, k: 1, a: p.a, b: p.b, c: p.c, d: 0 }, game.inputRanges);
    }
    s = game.step(s, inputAt(events, t));
    if (s.tick % SPORTS_CHECKPOINT_INTERVAL === 0) checkpoints.push(minigolfCheckpoint(s));
  }
  return { events, state: s, checkpoints };
}

/** Proves candidate n: its course's best routes (each par = best + 1, under the stroke limit) and a 200 witness. */
function proveCandidate(n: number): { n: number; seed: number; pars: number[]; raw: string; finish: number } | { n: number; seed: number; dropped: string } {
  const seed = candidateSeed(n);
  const course = minigolfCourse(seed);
  const routes = course.map((h) => bestRoute(h));
  if (routes.some((r) => !r || r.strokes + 1 >= MINIGOLF_STROKE_LIMIT)) return { n, seed, dropped: "a hole without a proven route under the stroke limit" };
  const pars = routes.map((r) => r!.strokes + 1);
  const { events, state, checkpoints } = playRoutes(seed, pars, routes.map((r) => r!.putts));
  const raw = encodeMinigolfRun({ seed, claimedScore: minigolfGameFor(pars).score(state), events, endTick: state.tick, checkpoints });
  const replay = replayMinigolfRun(seed, raw, pars);
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
      const proc = Bun.spawn(["bun", new URL(import.meta.url).pathname, "--child", `--part=${part}`, `--jobs=${JOBS}`, `--candidates=${CANDIDATES}`], { stdout: "pipe", stderr: "ignore" });
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
  const body = `/**
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
  const bankPath = new URL("../src/lib/duel/minigolfBank.server.ts", import.meta.url);
  const witnessPath = new URL("./fixtures/minigolf-witness.json", import.meta.url);
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
