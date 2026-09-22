/**
 * Slice round plumbing. The phone sends the seed, its swipe segments with the sim
 * tick each applied on, the tick it reached and the score it believes it earned;
 * the server replays with the STORED seed and keeps its own score.
 */

import {
  sliceCheckpoint,
  sliceGame,
  sliceTotalDiscs,
  SLICE_CHECKPOINT_INTERVAL,
  SLICE_INPUT_RANGES,
  SLICE_RUN_TICKS,
  type SliceCheckpoint,
  type SliceState,
} from "@/lib/arcade/slice";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";

export interface SliceRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: SliceCheckpoint[];
}

export function encodeSliceRun(run: SliceRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.slices,
        item.bonuses,
        item.bombsHit,
        item.airborne,
        item.slicedFold,
        item.objectCount,
        item.frenzies,
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

export function decodeSliceRun(raw: string): SliceRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] =
    String(raw ?? "").split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(SLICE_RUN_TICKS / SLICE_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 9 && values.every(Number.isInteger))
    .map(([tick, slices, bonuses, bombsHit, airborne, slicedFold, objectCount, frenzies, sum]) => ({
      tick: tick ?? 0,
      slices: slices ?? 0,
      bonuses: bonuses ?? 0,
      bombsHit: bombsHit ?? 0,
      airborne: airborne ?? 0,
      slicedFold: slicedFold ?? 0,
      objectCount: objectCount ?? 0,
      frenzies: frenzies ?? 0,
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

export interface SliceResult {
  slices: number;
  totalDiscs: number;
  bonuses: number;
  bombsHit: number;
  finished: boolean;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  checkpoints: SliceCheckpoint[];
  reason?: string;
  state: SliceState;
}

/** The single place a Slice score is worked out. */
export function replaySliceRun(seed: number, raw: string): SliceResult {
  const run = decodeSliceRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, SLICE_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < SLICE_RUN_TICKS;
  const check = checkInputEvents(run.events, SLICE_RUN_TICKS, SLICE_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  if (check.ok) for (const event of run.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : SLICE_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = sliceGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: SliceCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = sliceGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % SLICE_CHECKPOINT_INTERVAL === 0) {
      const serverState = sliceCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[slice] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (sliceGame.isOver(state)) break;
  }

  const replayScore = sliceGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: SliceResult = {
    slices: state.slices,
    totalDiscs: sliceTotalDiscs(state),
    bonuses: state.bonuses,
    bombsHit: state.bombsHit,
    finished: state.tick >= SLICE_RUN_TICKS,
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

export { SLICE_RUN_TICKS };
