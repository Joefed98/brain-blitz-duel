/**
 * Builds src/lib/duel/racingDeal.server.ts: RACING_DEAL, 300 seeds whose oracle run (scripts/racing-oracle.ts)
 * replays through the server path (replayRacingRun) to exactly 200: both laps, all 8 sectors clean, home by
 * RACING_PAR_TICKS. Candidates come from a fixed sequence (roomSeed-style hashing of 0, 1, 2 …); a seed the oracle
 * cannot take to 200 is dropped and counted.
 *
 *   bun scripts/racing-deal.ts            (writes the file)
 *   bun scripts/racing-deal.ts --check    (proves the written list without writing)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { racingCheckpoint, racingGame, RACING_CHECKPOINT_INTERVAL } from "../src/lib/arcade/racing";
import { encodeRacingRun, replayRacingRun } from "../src/lib/duel/racing";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { oracleRun } from "./racing-oracle";

export const RACING_DEAL_SIZE = 300;
const OUT = new URL("../src/lib/duel/racingDeal.server.ts", import.meta.url);

/** The candidate sequence: a hash of 0, 1, 2 … into 1 … 2^31 − 2 (as roomSeed). */
export function racingCandidate(n: number): number {
  let x = (n + 1) * 0x2c1b3c6d;
  x = Math.imul(x ^ (x >>> 16), 0x297a2d39);
  x = Math.imul(x ^ (x >>> 15), 0x9e3779b1);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

/** The phone's submission for a log: steps the sim, takes checkpoints, encodes. */
export function racingSubmission(seed: number, events: ArcadeInputEvent[]): string {
  const map = new Map(events.map((e) => [e.t, e]));
  let st = racingGame.init(seed);
  const cps = [];
  while (!racingGame.isOver(st)) {
    st = racingGame.step(st, map.get(st.tick + 1) ?? null);
    if (st.tick % RACING_CHECKPOINT_INTERVAL === 0) cps.push(racingCheckpoint(st));
  }
  return encodeRacingRun({ seed, claimedScore: racingGame.score(st), events, endTick: st.tick, checkpoints: cps });
}

/** True when the oracle takes the seed to exactly 200 through the server replay, unflagged. */
export function racingSeedProved(seed: number): boolean {
  const r = replayRacingRun(seed, racingSubmission(seed, oracleRun(seed)), 1);
  return r.score === 200 && !r.flagged;
}

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    const text = readFileSync(OUT, "utf8");
    const body = text.slice(text.indexOf("= [") + 2);
    const list = JSON.parse(body.slice(0, body.indexOf("]") + 1)) as number[];
    const bad = list.filter((s) => !racingSeedProved(s));
    console.log(bad.length ? `FAIL: ${bad.length} seeds not proved` : `ok: ${list.length} seeds proved`);
    process.exit(bad.length ? 1 : 0);
  }
  const keep: number[] = [];
  const dropped: number[] = [];
  for (let n = 0; keep.length < RACING_DEAL_SIZE; n++) {
    const seed = racingCandidate(n);
    if (racingSeedProved(seed)) keep.push(seed);
    else dropped.push(seed);
  }
  const body = `/**
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
`;
  writeFileSync(OUT, body);
  console.log(`wrote ${keep.length} seeds; dropped ${dropped.length}${dropped.length ? `: ${dropped.join(", ")}` : ""}`);
}
