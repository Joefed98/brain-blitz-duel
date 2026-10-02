/**
 * Ten Drop round plumbing. The phone sends the seed, its tile taps with the
 * sim tick each applied on, the tick it reached and the score it believes it
 * earned; the server replays with the STORED seed and keeps its own score.
 */

import {
  tenDropCheckpoint,
  tenDropGame,
  TD_CHECKPOINT_FIELDS,
  TD_CHECKPOINT_INTERVAL,
  TD_INPUT_RANGES,
  TD_RUN_TICKS,
  TD_TARGETS,
  type TenDropCheckpoint,
  type TenDropState,
} from "@/lib/arcade/tenDrop";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type InputDiag,
} from "@/lib/arcade/engine";

export interface TenDropRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: TenDropCheckpoint[];
}

export function encodeTenDropRun(run: TenDropRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) => [...TD_CHECKPOINT_FIELDS.map((f) => item[f]), item.checksum].join(":"))
    .join(",");
  return [run.seed, run.claimedScore, encodeInputEvents(run.events), run.endTick ?? 0, checkpoints].join("|");
}

export function decodeTenDropRun(raw: string): TenDropRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const width = TD_CHECKPOINT_FIELDS.length + 1;
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(TD_RUN_TICKS / TD_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === width && values.every(Number.isInteger))
    .map((values) => {
      const out = {} as Record<string, number>;
      TD_CHECKPOINT_FIELDS.forEach((f, i) => (out[f] = values[i] ?? 0));
      out["checksum"] = (values[width - 1] ?? 0) >>> 0;
      return out as unknown as TenDropCheckpoint;
    });
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    events: decodeInputEvents(eventPart),
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface TenDropResult {
  cleared: number;
  resets: number;
  refused: number;
  taps: number;
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
  checkpoints: TenDropCheckpoint[];
  reason?: string;
  state: TenDropState;
}

/** The single place a Ten Drop score is worked out. */
export function replayTenDropRun(seed: number, raw: string): TenDropResult {
  const run = decodeTenDropRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, TD_RUN_TICKS) : 0;
  const check = checkInputEvents(run.events, TD_RUN_TICKS, TD_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = tenDropGame.init(seed);
  // The run can end early (all ten cleared), so a short endTick is only lag
  // when the replay itself is not over by then.
  const lastTick = endTick > 0 ? endTick : TD_RUN_TICKS;
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: TenDropCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = tenDropGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % TD_CHECKPOINT_INTERVAL === 0) {
      const serverState = tenDropCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[tendrop] client/server desync", { tick: state.tick, client: clientState, server: serverState });
      }
    }
    if (tenDropGame.isOver(state)) break;
  }
  const clientLag = !tenDropGame.isOver(state) && endTick > 0 && endTick < TD_RUN_TICKS;

  const replayScore = tenDropGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: TenDropResult = {
    cleared: state.cleared,
    resets: state.resets,
    refused: state.refused,
    taps: state.taps,
    perfect: state.cleared >= TD_TARGETS,
    finished: tenDropGame.isOver(state),
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
