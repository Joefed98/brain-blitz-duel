/**
 * Bin Toss round plumbing. The phone sends the seed it played, its flick events
 * with the sim tick each applied on, the tick it reached and the score it
 * believes it earned; the server replays with the STORED seed, validates every
 * payload against the game's declared ranges, and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import {
  binTossCheckpoint,
  binTossGameFor,
  binTossPerfect,
  BINTOSS_CHECKPOINT_INTERVAL,
  BINTOSS_INPUT_RANGES,
  BINTOSS_RUN_TICKS,
  BINTOSS_THROWS,
  type BinTossCheckpoint,
  type BinTossState,
} from "@/lib/arcade/binToss";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";

export interface BinTossRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  /** The sim tick the phone actually reached; 0 or the run length means a full run. */
  endTick?: number;
  checkpoints?: BinTossCheckpoint[];
}

export function encodeBinTossRun(run: BinTossRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.phase,
        item.throwIndex,
        item.resolved,
        item.baskets,
        item.x,
        item.y,
        item.vx,
        item.vy,
        item.wind,
        item.checksum,
      ].join(":"),
    )
    .join(",");
  return [
    run.seed,
    run.claimedScore,
    encodeInputEvents(run.events),
    run.endTick ?? 0,
    checkpoints,
  ].join("|");
}

export function decodeBinTossRun(raw: string): BinTossRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(BINTOSS_RUN_TICKS / BINTOSS_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 11 && values.every(Number.isInteger))
    .map(([tick, phase, throwIndex, resolved, baskets, x, y, vx, vy, wind, sum]) => ({
      tick: tick ?? 0,
      phase: phase ?? 0,
      throwIndex: throwIndex ?? 0,
      resolved: resolved ?? 0,
      baskets: baskets ?? 0,
      x: x ?? 0,
      y: y ?? 0,
      vx: vx ?? 0,
      vy: vy ?? 0,
      wind: wind ?? 0,
      checksum: (sum ?? 0) >>> 0,
    }));
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    events: decodeInputEvents(eventPart),
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface BinTossResult {
  baskets: number;
  throws: number;
  /** Per-throw outcome in order: true for a basket. */
  results: boolean[];
  /** Every throw taken and every one of them in. */
  perfect: boolean;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: BinTossCheckpoint[];
  reason?: string;
  state: BinTossState;
}

/** The single place a Bin Toss score is worked out. */
export function replayBinTossRun(seed: number, raw: string, rev?: number | null): BinTossResult {
  const binTossGame = binTossGameFor(rev);
  const run = decodeBinTossRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, BINTOSS_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < BINTOSS_RUN_TICKS;
  const check = checkInputEvents(run.events, BINTOSS_RUN_TICKS, BINTOSS_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : BINTOSS_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = binTossGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: BinTossCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = binTossGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % BINTOSS_CHECKPOINT_INTERVAL === 0) {
      const serverState = binTossCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[bintoss] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (binTossGame.isOver(state)) break;
  }

  const replayScore = binTossGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: BinTossResult = {
    baskets: state.baskets,
    throws: BINTOSS_THROWS,
    results: state.results.map((value) => value === 1),
    perfect: binTossPerfect(state),
    endedSeconds: Math.round((reached / TICKS_PER_SECOND) * 10) / 10,
    score: replayScore,
    flagged: !check.ok || mismatch || desyncTick !== null,
    clientLag,
    clientTick: endTick,
    desyncTick,
    inputDiag: check.diag,
    replayTick: reached,
    checkpoints: serverCheckpoints,
    state,
  };
  if (check.reason) result.reason = check.reason;
  else if (mismatch) result.reason = "score did not match the replay";
  return result;
}

export { BINTOSS_RUN_TICKS };
