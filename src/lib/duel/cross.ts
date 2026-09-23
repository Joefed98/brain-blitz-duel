/**
 * Cross round plumbing. The phone sends the seed it played, its hop and shift
 * events with the sim tick each applied on, the tick it reached and the score it
 * believes it earned; the server replays with the STORED seed, validates every
 * payload against the game's declared ranges, and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import {
  crossCheckpoint,
  crossGame,
  crossSurvived,
  CROSS_CHECKPOINT_INTERVAL,
  CROSS_INPUT_RANGES,
  CROSS_RUN_TICKS,
  type CrossCheckpoint,
  type CrossState,
} from "@/lib/arcade/cross";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";

export interface CrossRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: CrossCheckpoint[];
}

export function encodeCrossRun(run: CrossRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.crossings,
        item.lane,
        item.col,
        item.hop,
        item.hopDir,
        item.reached,
        item.crossStart,
        item.pauseUntil,
        item.laneSpeed,
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

export function decodeCrossRun(raw: string): CrossRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(CROSS_RUN_TICKS / CROSS_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 11 && values.every(Number.isInteger))
    .map(
      ([
        tick,
        crossings,
        lane,
        col,
        hop,
        hopDir,
        reached,
        crossStart,
        pauseUntil,
        laneSpeed,
        sum,
      ]) => ({
        tick: tick ?? 0,
        crossings: crossings ?? 0,
        lane: lane ?? 0,
        col: col ?? 0,
        hop: hop ?? 0,
        hopDir: hopDir ?? 1,
        reached: reached ?? 0,
        crossStart: crossStart ?? 0,
        pauseUntil: pauseUntil ?? 0,
        laneSpeed: laneSpeed ?? 0,
        checksum: (sum ?? 0) >>> 0,
      }),
    );
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    events: decodeInputEvents(eventPart),
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface CrossResult {
  crossings: number;
  lanes: number;
  survived: boolean;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: CrossCheckpoint[];
  reason?: string;
  state: CrossState;
}

/** The single place a Cross score is worked out. */
export function replayCrossRun(seed: number, raw: string): CrossResult {
  const run = decodeCrossRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, CROSS_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < CROSS_RUN_TICKS;
  const check = checkInputEvents(run.events, CROSS_RUN_TICKS, CROSS_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : CROSS_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = crossGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: CrossCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = crossGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % CROSS_CHECKPOINT_INTERVAL === 0) {
      const serverState = crossCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[cross] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (crossGame.isOver(state)) break;
  }

  const replayScore = crossGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: CrossResult = {
    crossings: state.crossings,
    lanes: state.reached,
    survived: crossSurvived(state),
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

export { CROSS_RUN_TICKS };
