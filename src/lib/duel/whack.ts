/**
 * Whack-a-Target round plumbing. The phone sends the seed, its hole taps with
 * the sim tick each applied on, the tick it reached and the score it believes
 * it earned; the server replays with the STORED seed and keeps its own score.
 */

import {
  whackCheckpoint,
  whackGame,
  WHACK_CHECKPOINT_INTERVAL,
  WHACK_INPUT_RANGES,
  WHACK_RUN_TICKS,
  WHACK_TARGETS,
  type WhackCheckpoint,
  type WhackState,
} from "@/lib/arcade/whack";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type InputDiag,
} from "@/lib/arcade/engine";

export interface WhackRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: WhackCheckpoint[];
}

export function encodeWhackRun(run: WhackRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [item.tick, item.hits, item.wrong, item.taps, item.next, item.statusHash, item.checksum].join(":"),
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

export function decodeWhackRun(raw: string): WhackRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(WHACK_RUN_TICKS / WHACK_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 7 && values.every(Number.isInteger))
    .map(([tick, hits, wrong, taps, next, statusHash, sum]) => ({
      tick: tick ?? 0,
      hits: hits ?? 0,
      wrong: wrong ?? 0,
      taps: taps ?? 0,
      next: next ?? 0,
      statusHash: statusHash ?? 0,
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

export interface WhackResult {
  hits: number;
  totalTargets: number;
  wrong: number;
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
  checkpoints: WhackCheckpoint[];
  reason?: string;
  state: WhackState;
}

/** The single place a Whack-a-Target score is worked out. */
export function replayWhackRun(seed: number, raw: string): WhackResult {
  const run = decodeWhackRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, WHACK_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < WHACK_RUN_TICKS;
  const check = checkInputEvents(run.events, WHACK_RUN_TICKS, WHACK_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : WHACK_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = whackGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: WhackCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = whackGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % WHACK_CHECKPOINT_INTERVAL === 0) {
      const serverState = whackCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[whack] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (whackGame.isOver(state)) break;
  }

  const replayScore = whackGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const total = WHACK_TARGETS;
  const result: WhackResult = {
    hits: state.hits,
    totalTargets: total,
    wrong: state.wrong,
    taps: state.taps,
    perfect: replayScore >= 150,
    finished: state.tick >= WHACK_RUN_TICKS,
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

export { WHACK_RUN_TICKS };
