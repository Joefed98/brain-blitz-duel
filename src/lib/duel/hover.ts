/**
 * Hover round plumbing: how a run travels from the phone to the server and back
 * out as a score. The phone sends the seed it played, the tap ticks, the sim tick
 * it reached and the score it believes it earned; the server replays with the
 * STORED seed and keeps its own score, flagging any disagreement.
 */

import {
  hoverCheckpoint,
  hoverGame,
  hoverSurvived,
  HOVER_CHECKPOINT_INTERVAL,
  HOVER_RUN_TICKS,
  type HoverCheckpoint,
  type HoverState,
} from "@/lib/arcade/hover";
import { checkInputLog, MAX_INPUT_TAPS, TICKS_PER_SECOND } from "@/lib/arcade/engine";

export interface HoverRun {
  seed: number;
  claimedScore: number;
  inputs: number[];
  /** The sim tick the phone actually reached; 0 or the run length means a full run. */
  endTick?: number;
  checkpoints?: HoverCheckpoint[];
}

export function encodeHoverRun(run: HoverRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.y,
        item.vy,
        item.speed,
        item.gates,
        item.nextPillarX,
        item.nextGapTop,
        item.nextGapH,
        item.checksum,
      ].join(":"),
    )
    .join(",");
  return `${run.seed}|${run.claimedScore}|${run.inputs.join(",")}|${run.endTick ?? 0}|${checkpoints}`;
}

export function decodeHoverRun(raw: string): HoverRun {
  const [seedPart = "", scorePart = "", tapPart = "", tickPart = "", checkpointPart = ""] = String(
    raw ?? "",
  ).split("|");
  const inputs = tapPart
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((tick) => Number.isInteger(tick))
    .slice(0, MAX_INPUT_TAPS + 1);
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(HOVER_RUN_TICKS / HOVER_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 9 && values.every(Number.isInteger))
    .map(([tick, y, vy, speed, gates, nextPillarX, nextGapTop, nextGapH, checksum]) => ({
      tick: tick ?? 0,
      y: y ?? 0,
      vy: vy ?? 0,
      speed: speed ?? 0,
      gates: gates ?? 0,
      nextPillarX: nextPillarX ?? 0,
      nextGapTop: nextGapTop ?? 0,
      nextGapH: nextGapH ?? 0,
      checksum: (checksum ?? 0) >>> 0,
    }));
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    inputs,
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface HoverResult {
  gates: number;
  /** Gates a clean run would have reached on this course. */
  totalGates: number;
  survived: boolean;
  /** Seconds into the run when the disc crashed, or the full run length. */
  endedSeconds: number;
  score: number;
  /** True when the log was malformed or the phone's score did not match. */
  flagged: boolean;
  /** True when the phone's sim fell behind and the run was cut at its tick. */
  clientLag: boolean;
  /** The tick the phone reached when it lagged. */
  clientTick: number;
  desyncTick: number | null;
  /** Server-side replay checkpoints, exposed for deterministic proof checks. */
  checkpoints: HoverCheckpoint[];
  reason?: string;
  state: HoverState;
}

/** The single place a Hover score is worked out. */
export function replayHoverRun(seed: number, raw: string): HoverResult {
  const run = decodeHoverRun(raw);
  // A phone that never reached tick 3600 has its run ended where it stopped: no
  // crash is invented after its last tap, and no survival bonus is given.
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, HOVER_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < HOVER_RUN_TICKS;
  const check = checkInputLog(run.inputs, HOVER_RUN_TICKS);
  const taps = check.ok ? new Set(run.inputs) : new Set<number>();
  const lastTick = clientLag ? endTick : HOVER_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));
  let state = hoverGame.init(seed);
  let ticks = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: HoverCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = hoverGame.step(state, taps.has(tick));
    ticks = tick;
    if (state.tick % HOVER_CHECKPOINT_INTERVAL === 0) {
      const serverState = hoverCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if (clientState && clientState.checksum !== serverState.checksum && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[hover] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (hoverGame.isOver(state)) break;
  }
  const replayScore = hoverGame.score(state);
  const survived = hoverSurvived(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: HoverResult = {
    gates: state.gates,
    totalGates: state.totalGates,
    survived,
    endedSeconds: Math.round((ticks / TICKS_PER_SECOND) * 10) / 10,
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

export { HOVER_RUN_TICKS };
