/**
 * Hover round plumbing: how a run travels from the phone to the server and back
 * out as a score. The phone sends the seed it played, the tap ticks, and the
 * score it believes it earned; the server replays with the STORED seed and keeps
 * its own score, flagging any disagreement.
 */

import { hoverGame, hoverSurvived, HOVER_RUN_TICKS, type HoverState } from "@/lib/arcade/hover";
import { MAX_INPUT_TAPS, replayArcadeRun, TICKS_PER_SECOND } from "@/lib/arcade/engine";

export interface HoverRun {
  seed: number;
  claimedScore: number;
  inputs: number[];
}

export function encodeHoverRun(run: HoverRun): string {
  return `${run.seed}|${run.claimedScore}|${run.inputs.join(",")}`;
}

export function decodeHoverRun(raw: string): HoverRun {
  const [seedPart = "", scorePart = "", tapPart = ""] = String(raw ?? "").split("|");
  const inputs = tapPart
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((tick) => Number.isInteger(tick))
    .slice(0, MAX_INPUT_TAPS + 1);
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    inputs,
  };
}

export interface HoverResult {
  gates: number;
  survived: boolean;
  /** Seconds into the run when the disc crashed, or the full run length. */
  endedSeconds: number;
  score: number;
  /** True when the log was malformed or the phone's score did not match. */
  flagged: boolean;
  reason?: string;
  state: HoverState;
}

/** The single place a Hover score is worked out. */
export function replayHoverRun(seed: number, raw: string): HoverResult {
  const run = decodeHoverRun(raw);
  const outcome = replayArcadeRun(hoverGame, seed, run.inputs);
  const survived = hoverSurvived(outcome.state);
  const mismatch = run.claimedScore !== outcome.score || run.seed !== seed;
  const result: HoverResult = {
    gates: outcome.state.gates,
    survived,
    endedSeconds: Math.round((outcome.ticks / TICKS_PER_SECOND) * 10) / 10,
    score: outcome.score,
    flagged: !outcome.valid || mismatch,
    state: outcome.state,
  };
  if (outcome.reason) result.reason = outcome.reason;
  else if (mismatch) result.reason = "score did not match the replay";
  return result;
}

export { HOVER_RUN_TICKS };
