/**
 * Steady round plumbing. The phone sends the seed, the drag positions with the sim
 * tick each applied on, the tick it reached and the score it believes it earned;
 * the server replays with the STORED seed and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import {
  stdCheckpoint,
  stdClean,
  stdDistancePx,
  stdMetres,
  steadyGame,
  stdTrackWidth,
  STD_CHECKPOINT_INTERVAL,
  STD_INPUT_RANGES,
  STD_PX_PER_POINT,
  STD_RUN_TICKS,
  type StdCheckpoint,
  type StdState,
} from "@/lib/arcade/steady";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";

export interface SteadyRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: StdCheckpoint[];
}

export function encodeSteadyRun(run: SteadyRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.dx,
        item.travelled,
        item.touches,
        item.width,
        item.centre,
        item.onEdge,
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

export function decodeSteadyRun(raw: string): SteadyRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(STD_RUN_TICKS / STD_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 8 && values.every(Number.isInteger))
    .map(([tick, dx, travelled, touches, width, centre, onEdge, sum]) => ({
      tick: tick ?? 0,
      dx: dx ?? 0,
      travelled: travelled ?? 0,
      touches: touches ?? 0,
      width: width ?? 0,
      centre: centre ?? 0,
      onEdge: onEdge ?? 0,
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

export interface SteadyResult {
  distance: number;
  metres: number;
  points: number;
  touches: number;
  width: number;
  clean: boolean;
  finished: boolean;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: StdCheckpoint[];
  reason?: string;
  state: StdState;
}

/** The single place a Steady score is worked out. */
export function replaySteadyRun(seed: number, raw: string): SteadyResult {
  const run = decodeSteadyRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, STD_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < STD_RUN_TICKS;
  const check = checkInputEvents(run.events, STD_RUN_TICKS, STD_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : STD_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = steadyGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: StdCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = steadyGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % STD_CHECKPOINT_INTERVAL === 0) {
      const serverState = stdCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[steady] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (steadyGame.isOver(state)) break;
  }

  const replayScore = steadyGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: SteadyResult = {
    distance: stdDistancePx(state),
    metres: stdMetres(state),
    points: Math.trunc(stdDistancePx(state) / STD_PX_PER_POINT),
    touches: state.touches,
    width: stdTrackWidth(state.tick),
    clean: stdClean(state),
    finished: state.tick >= STD_RUN_TICKS,
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

export { STD_RUN_TICKS };
