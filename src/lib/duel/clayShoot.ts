/**
 * Clay Shoot round plumbing. The phone sends the seed, its shots with the sim
 * tick each applied on, the tick it reached and the score it believes it
 * earned; the server replays with the STORED seed and keeps its own score.
 */

import {
  clayCheckpoint,
  clayGame,
  CLAY_CHECKPOINT_FIELDS,
  CLAY_CHECKPOINT_INTERVAL,
  CLAY_COUNT,
  CLAY_INPUT_RANGES,
  CLAY_RUN_TICKS,
  type ClayCheckpoint,
  type ClayState,
} from "@/lib/arcade/clayShoot";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type InputDiag,
} from "@/lib/arcade/engine";

export interface ClayRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: ClayCheckpoint[];
}

export function encodeClayRun(run: ClayRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) => [...CLAY_CHECKPOINT_FIELDS.map((f) => item[f]), item.checksum].join(":"))
    .join(",");
  return [run.seed, run.claimedScore, encodeInputEvents(run.events), run.endTick ?? 0, checkpoints].join("|");
}

export function decodeClayRun(raw: string): ClayRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const width = CLAY_CHECKPOINT_FIELDS.length + 1;
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(CLAY_RUN_TICKS / CLAY_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === width && values.every(Number.isInteger))
    .map((values) => {
      const out = {} as Record<string, number>;
      CLAY_CHECKPOINT_FIELDS.forEach((f, i) => (out[f] = values[i] ?? 0));
      out["checksum"] = (values[width - 1] ?? 0) >>> 0;
      return out as unknown as ClayCheckpoint;
    });
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    events: decodeInputEvents(eventPart),
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface ClayResult {
  hits: number;
  missed: number;
  shots: number;
  total: number;
  perfect: boolean;
  finished: boolean;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: ClayCheckpoint[];
  reason?: string;
  state: ClayState;
}

/** The single place a Clay Shoot score is worked out. */
export function replayClayRun(seed: number, raw: string): ClayResult {
  const run = decodeClayRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, CLAY_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < CLAY_RUN_TICKS;
  const check = checkInputEvents(run.events, CLAY_RUN_TICKS, CLAY_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : CLAY_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = clayGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: ClayCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = clayGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % CLAY_CHECKPOINT_INTERVAL === 0) {
      const serverState = clayCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[clayshoot] client/server desync", { tick: state.tick, client: clientState, server: serverState });
      }
    }
    if (clayGame.isOver(state)) break;
  }

  const replayScore = clayGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: ClayResult = {
    hits: state.hits,
    missed: state.missed,
    shots: state.shots,
    total: CLAY_COUNT,
    perfect: state.hits >= CLAY_COUNT,
    finished: state.tick >= CLAY_RUN_TICKS,
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
