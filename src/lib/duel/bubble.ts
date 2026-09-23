/**
 * Bubble Pop round plumbing. The phone sends the seed, its aim releases with the
 * sim tick each applied on, the tick it reached and the score it believes it
 * earned; the server replays with the STORED seed and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import {
  bubCheckpoint,
  bubbleGame,
  bubOccupied,
  bubSurvived,
  BUB_CHECKPOINT_INTERVAL,
  BUB_INPUT_RANGES,
  BUB_RUN_TICKS,
  type BubCheckpoint,
  type BubState,
} from "@/lib/arcade/bubble";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";

export interface BubbleRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: BubCheckpoint[];
}

export function encodeBubbleRun(run: BubbleRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.shots,
        item.popped,
        item.dropped,
        item.descents,
        item.occupied,
        item.gridFold,
        item.x,
        item.y,
        item.flightColour,
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

export function decodeBubbleRun(raw: string): BubbleRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] =
    (String(raw ?? "").split("~")[0] ?? "").split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(BUB_RUN_TICKS / BUB_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 11 && values.every(Number.isInteger))
    .map(([tick, shots, popped, dropped, descents, occupied, gridFold, x, y, colour, sum]) => ({
      tick: tick ?? 0,
      shots: shots ?? 0,
      popped: popped ?? 0,
      dropped: dropped ?? 0,
      descents: descents ?? 0,
      occupied: occupied ?? 0,
      gridFold: gridFold ?? 0,
      x: x ?? 0,
      y: y ?? 0,
      flightColour: colour ?? 0,
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

export interface BubbleResult {
  popped: number;
  dropped: number;
  shots: number;
  bubblesLeft: number;
  cleared: boolean;
  survived: boolean;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: BubCheckpoint[];
  reason?: string;
  state: BubState;
}

/** The single place a Bubble Pop score is worked out. */
export function replayBubbleRun(seed: number, raw: string): BubbleResult {
  const run = decodeBubbleRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, BUB_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < BUB_RUN_TICKS;
  const check = checkInputEvents(run.events, BUB_RUN_TICKS, BUB_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : BUB_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = bubbleGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: BubCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = bubbleGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % BUB_CHECKPOINT_INTERVAL === 0) {
      const serverState = bubCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[bubble] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (bubbleGame.isOver(state)) break;
  }

  const replayScore = bubbleGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: BubbleResult = {
    popped: state.popped,
    dropped: state.dropped,
    shots: state.shots,
    bubblesLeft: bubOccupied(state.grid),
    cleared: state.cleared,
    survived: bubSurvived(state),
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

export { BUB_RUN_TICKS };
