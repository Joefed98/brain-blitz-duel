/**
 * Builds src/lib/duel/racingDeal.server.ts (racingRev 1: RACING_DEAL), with --rev=2
 * src/lib/duel/racingDealV2.server.ts (racingRev 2: RACING_DEAL_V2) or, with --rev=3,
 * src/lib/duel/racingDealV3.server.ts (racingRev 3: RACING_DEAL_V3; home at or above the full pace,
 * RACING_V3_PACE_FULL) or, with --rev=4, src/lib/duel/racingDealV4.server.ts (racingRev 4: RACING_DEAL_V4, 100 seeds on
 * each of the three named circuits, racingCircuitOf): 300 seeds whose oracle run
 * (scripts/racing-oracle.ts) replays through the server path (replayRacingRun) on that revision to exactly 200: both
 * laps, all 8 sectors clean, home by the revision's par. Candidates come from a fixed sequence (roomSeed-style hashing
 * of 0, 1, 2 …); a seed the oracle cannot take to 200 is dropped and counted.
 *
 *   bun scripts/racing-deal.ts [--rev=2|3|4]            (writes the file)
 *   bun scripts/racing-deal.ts [--rev=2|3|4] --check    (proves the written list without writing)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { racingCheckpoint, racingCircuitOf, racingGameFor, RACING_CHECKPOINT_INTERVAL, RACING_CIRCUITS } from "../src/lib/arcade/racing";
import { encodeRacingRun, replayRacingRun } from "../src/lib/duel/racing";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { oracleRun } from "./racing-oracle";

export const RACING_DEAL_SIZE = 300;
const revArg = process.argv.find((a) => a.startsWith("--rev="));
const REV = revArg ? Number(revArg.slice(6)) : 1;
const OUT = new URL(REV >= 4 ? "../src/lib/duel/racingDealV4.server.ts" : REV >= 3 ? "../src/lib/duel/racingDealV3.server.ts" : REV >= 2 ? "../src/lib/duel/racingDealV2.server.ts" : "../src/lib/duel/racingDeal.server.ts", import.meta.url);

/** The candidate sequence: a hash of 0, 1, 2 … into 1 … 2^31 − 2 (as roomSeed). */
export function racingCandidate(n: number): number {
  let x = (n + 1) * 0x2c1b3c6d;
  x = Math.imul(x ^ (x >>> 16), 0x297a2d39);
  x = Math.imul(x ^ (x >>> 15), 0x9e3779b1);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

/** The phone's submission for a log on a revision: steps the sim, takes checkpoints, encodes. */
export function racingSubmission(seed: number, events: ArcadeInputEvent[], rev = 1): string {
  const game = racingGameFor(rev);
  const map = new Map(events.map((e) => [e.t, e]));
  let st = game.init(seed);
  const cps = [];
  while (!game.isOver(st)) {
    st = game.step(st, map.get(st.tick + 1) ?? null);
    if (st.tick % RACING_CHECKPOINT_INTERVAL === 0) cps.push(racingCheckpoint(st));
  }
  return encodeRacingRun({ seed, claimedScore: game.score(st), events, endTick: st.tick, checkpoints: cps });
}

/** True when the oracle takes the seed to exactly 200 through the server replay on a revision, unflagged. */
export function racingSeedProved(seed: number, rev = 1): boolean {
  const r = replayRacingRun(seed, racingSubmission(seed, oracleRun(seed, rev), rev), rev);
  return r.score === 200 && !r.flagged;
}

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    const text = readFileSync(OUT, "utf8");
    const body = text.slice(text.indexOf("= [") + 2);
    const list = JSON.parse(body.slice(0, body.indexOf("]") + 1)) as number[];
    const bad = list.filter((s) => !racingSeedProved(s, REV));
    console.log(bad.length ? `FAIL: ${bad.length} seeds not proved` : `ok: ${list.length} seeds proved`);
    process.exit(bad.length ? 1 : 0);
  }
  const keep: number[] = [];
  const dropped: number[] = [];
  const perCircuit = RACING_DEAL_SIZE / RACING_CIRCUITS.length;
  const onCircuit = [0, 0, 0];
  for (let n = 0; keep.length < RACING_DEAL_SIZE; n++) {
    const seed = racingCandidate(n);
    // racingRev 4: an equal share of the deal on each circuit (in candidate order).
    if (REV >= 4 && onCircuit[racingCircuitOf(seed)]! >= perCircuit) continue;
    if (racingSeedProved(seed, REV)) {
      keep.push(seed);
      if (REV >= 4) onCircuit[racingCircuitOf(seed)]! += 1;
    }
    else dropped.push(seed);
  }
  const name = REV >= 4 ? "RACING_DEAL_V4" : REV >= 3 ? "RACING_DEAL_V3" : REV >= 2 ? "RACING_DEAL_V2" : "RACING_DEAL";
  const fn = REV >= 4 ? "racingDealSeedV4" : REV >= 3 ? "racingDealSeedV3" : REV >= 2 ? "racingDealSeedV2" : "racingDealSeed";
  const body = REV >= 4 ? `/**
 * Apex's deal (racingRev 4; built by \`bun scripts/racing-deal.ts --rev=4\`, do not edit): ${RACING_DEAL_SIZE} seeds, ${perCircuit} on each
 * of the three named circuits (racingCircuitOf: Sunset Park, Harbour Run, Ridge Loop), each proved on racingRev 4: the
 * oracle (scripts/racing-oracle.ts) replays through replayRacingRun to exactly 200 (both laps, all 8 sectors clean, an
 * average speed at or above the circuit's par pace, RACING_V4_PACE). ${dropped.length} candidate${dropped.length === 1 ? "" : "s"} dropped.
 */
export const ${name}: readonly number[] = ${JSON.stringify(keep)};

/** The seed a room seed deals on racingRev 4 (its circuit is racingCircuitOf of it). */
export function ${fn}(roomSeed: number): number {
  const n = ${name}.length;
  return ${name}[((Math.trunc(roomSeed) % n) + n) % n]!;
}
` : REV >= 3 ? `/**
 * Apex's deal (racingRev 3; built by \`bun scripts/racing-deal.ts --rev=3\`, do not edit): ${RACING_DEAL_SIZE} circuit seeds,
 * each proved on racingRev 3 (the softer gravel, the pace score): the oracle (scripts/racing-oracle.ts) replays through
 * replayRacingRun to exactly 200 (both laps, all 8 sectors clean, an average speed at or above RACING_V3_PACE_FULL).
 * ${dropped.length} candidate${dropped.length === 1 ? "" : "s"} of the first ${keep.length + dropped.length} dropped (their oracle's average fell short of the full pace).
 */
export const ${name}: readonly number[] = ${JSON.stringify(keep)};

/** The circuit a room seed deals on racingRev 3. */
export function ${fn}(roomSeed: number): number {
  const n = ${name}.length;
  return ${name}[((Math.trunc(roomSeed) % n) + n) % n]!;
}
` : REV < 2 ? `/**
 * Racing's deal (racingRev 1; built by \`bun scripts/racing-deal.ts\`, do not edit): ${RACING_DEAL_SIZE} circuit seeds, each
 * proved: the oracle (scripts/racing-oracle.ts) replays through replayRacingRun to exactly 200 (both laps, all 8 sectors
 * clean, home by RACING_PAR_TICKS). ${dropped.length} candidate${dropped.length === 1 ? "" : "s"} of the first ${keep.length + dropped.length} dropped.
 */
export const RACING_DEAL: readonly number[] = ${JSON.stringify(keep)};

/** The circuit a room seed deals. */
export function racingDealSeed(roomSeed: number): number {
  const n = RACING_DEAL.length;
  return RACING_DEAL[((Math.trunc(roomSeed) % n) + n) % n]!;
}
` : `/**
 * Apex's deal (racingRev 2; built by \`bun scripts/racing-deal.ts --rev=2\`, do not edit): ${RACING_DEAL_SIZE} circuit seeds,
 * each proved on racingRev 2 (the lights start, the softer joystick): the oracle (scripts/racing-oracle.ts) replays through
 * replayRacingRun to exactly 200 (both laps, all 8 sectors clean, home by RACING_V2_PAR_TICKS from lights out).
 * ${dropped.length} candidate${dropped.length === 1 ? "" : "s"} of the first ${keep.length + dropped.length} dropped.
 */
export const ${name}: readonly number[] = ${JSON.stringify(keep)};

/** The circuit a room seed deals on racingRev 2. */
export function ${fn}(roomSeed: number): number {
  const n = ${name}.length;
  return ${name}[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
  writeFileSync(OUT, body);
  console.log(`wrote ${keep.length} seeds; dropped ${dropped.length}${dropped.length && REV < 3 ? `: ${dropped.join(", ")}` : ""}`);
}
