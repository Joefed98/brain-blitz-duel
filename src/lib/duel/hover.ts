/**
 * Hover round plumbing: how a run travels from the phone to the server and back
 * out as a score. The phone sends the seed it played, the tap ticks, the sim tick
 * it reached and the score it believes it earned; the server replays with the
 * STORED seed and keeps its own score, flagging any disagreement.
 */

import { hoverGame, hoverSurvived, HOVER_RUN_TICKS, type HoverState } from "@/lib/arcade/hover";
import { MAX_INPUT_TAPS, replayArcadeRun, TICKS_PER_SECOND } from "@/lib/arcade/engine";

export interface HoverRun {
  seed: number;
  claimedScore: number;
  inputs: number[];
  /** The sim tick the phone actually reached; 0 or the run length means a full run. */
  endTick?: number;
}

export function encodeHoverRun(run: HoverRun): string {
  return `${run.seed}|${run.claimedScore}|${run.inputs.join(",")}|${run.endTick ?? 0}`;
}

export function decodeHoverRun(raw: string): HoverRun {
  const [seedPart = "", scorePart = "", tapPart = "", tickPart = ""] = String(raw ?? "").split("|");
  const inputs = tapPart
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((tick) => Number.isInteger(tick))
    .slice(0, MAX_INPUT_TAPS + 1);
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    inputs,
    endTick: Number.parseInt(tickPart, 10) || 0,
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
  const outcome = replayArcadeRun(hoverGame, seed, run.inputs, clientLag ? endTick : undefined);
  const survived = hoverSurvived(outcome.state);
  const mismatch = run.claimedScore !== outcome.score || run.seed !== seed;
  const result: HoverResult = {
    gates: outcome.state.gates,
    totalGates: outcome.state.totalGates,
    survived,
    endedSeconds: Math.round((outcome.ticks / TICKS_PER_SECOND) * 10) / 10,
    score: outcome.score,
    flagged: !outcome.valid || mismatch,
    clientLag,
    clientTick: endTick,
    state: outcome.state,
  };
  if (outcome.reason) result.reason = outcome.reason;
  else if (mismatch) result.reason = "score did not match the replay";
  return result;
}

export { HOVER_RUN_TICKS };
