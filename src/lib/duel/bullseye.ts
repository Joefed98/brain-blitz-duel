/**
 * Bullseye round plumbing. The phone sends the seed it played, its shot events
 * with the sim tick each applied on, the tick it reached and the score it
 * believes it earned; the server replays with the STORED seed, validates every
 * payload against the game's declared ranges, and keeps its own score.
 */

import {
  bullseyeCheckpoint,
  bullseyeFinished,
  bullseyeGame,
  bullseyeInner,
  BULLSEYE_ARROWS,
  BULLSEYE_CHECKPOINT_INTERVAL,
  BULLSEYE_INPUT_RANGES,
  BULLSEYE_RUN_TICKS,
  type BullseyeCheckpoint,
  type BullseyeHit,
  type BullseyeState,
} from "@/lib/arcade/bullseye";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";

export interface BullseyeRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  /** The sim tick the phone actually reached; 0 or the run length means a full run. */
  endTick?: number;
  checkpoints?: BullseyeCheckpoint[];
}

export function encodeBullseyeRun(run: BullseyeRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.arrowIndex,
        item.flightTick,
        item.total,
        item.lastX,
        item.lastY,
        item.lastRing,
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

export function decodeBullseyeRun(raw: string): BullseyeRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] =
    String(raw ?? "").split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(BULLSEYE_RUN_TICKS / BULLSEYE_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 9 && values.every(Number.isInteger))
    .map(([tick, arrowIndex, flightTick, total, lastX, lastY, lastRing, wind, sum]) => ({
      tick: tick ?? 0,
      arrowIndex: arrowIndex ?? 0,
      flightTick: flightTick ?? 0,
      total: total ?? 0,
      lastX: lastX ?? 0,
      lastY: lastY ?? 0,
      lastRing: lastRing ?? -1,
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

export interface BullseyeResult {
  arrows: number;
  total: number;
  /** Arrows in the gold or red rings. */
  inner: number;
  hits: BullseyeHit[];
  finished: boolean;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  checkpoints: BullseyeCheckpoint[];
  reason?: string;
  state: BullseyeState;
}

/** The single place a Bullseye score is worked out. */
export function replayBullseyeRun(seed: number, raw: string): BullseyeResult {
  const run = decodeBullseyeRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, BULLSEYE_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < BULLSEYE_RUN_TICKS;
  const check = checkInputEvents(run.events, BULLSEYE_RUN_TICKS, BULLSEYE_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  if (check.ok) for (const event of run.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : BULLSEYE_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = bullseyeGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: BullseyeCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = bullseyeGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % BULLSEYE_CHECKPOINT_INTERVAL === 0) {
      const serverState = bullseyeCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[bullseye] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (bullseyeGame.isOver(state)) break;
  }

  const replayScore = bullseyeGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: BullseyeResult = {
    arrows: BULLSEYE_ARROWS,
    total: state.total,
    inner: bullseyeInner(state),
    hits: state.hits,
    finished: bullseyeFinished(state),
    endedSeconds: Math.round((reached / TICKS_PER_SECOND) * 10) / 10,
    score: replayScore,
    flagged: !check.ok || mismatch || desyncTick !== null,
    clientLag,
    clientTick: endTick,
    desyncTick,
    checkpoints: serverCheckpoints,
    state,
  };
  if (check.reason) result.reason = check.reason;
  else if (mismatch) result.reason = "score did not match the replay";
  return result;
}

export { BULLSEYE_RUN_TICKS };
