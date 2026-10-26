/**
 * Skyline round plumbing. The phone sends the seed it played, the sim ticks its
 * drops applied on, the tick it reached and the score it believes it earned; the
 * server replays with the STORED seed and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import {
  skylineCheckpoint,
  skylineGameFor,
  skylineSurvived,
  SKYLINE_CHECKPOINT_INTERVAL,
  SKYLINE_RUN_TICKS,
  type SkylineCheckpoint,
  type SkylineState,
} from "@/lib/arcade/skyline";
import { checkInputLog, MAX_INPUT_TAPS, TICKS_PER_SECOND } from "@/lib/arcade/engine";

export interface SkylineRun {
  seed: number;
  claimedScore: number;
  inputs: number[];
  /** The sim tick the phone actually reached; 0 or the run length means a full run. */
  endTick?: number;
  checkpoints?: SkylineCheckpoint[];
}

export function encodeSkylineRun(run: SkylineRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.x,
        item.w,
        item.dir,
        item.placed,
        item.perfects,
        item.speed,
        item.topX,
        item.topW,
        item.checksum,
      ].join(":"),
    )
    .join(",");
  return `${run.seed}|${run.claimedScore}|${run.inputs.join(",")}|${run.endTick ?? 0}|${checkpoints}`;
}

export function decodeSkylineRun(raw: string): SkylineRun {
  const [seedPart = "", scorePart = "", tapPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const inputs = tapPart
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((tick) => Number.isInteger(tick))
    .slice(0, MAX_INPUT_TAPS + 1);
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(SKYLINE_RUN_TICKS / SKYLINE_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 10 && values.every(Number.isInteger))
    .map(([tick, x, w, dir, placed, perfects, speed, topX, topW, sum]) => ({
      tick: tick ?? 0,
      x: x ?? 0,
      w: w ?? 0,
      dir: dir ?? 1,
      placed: placed ?? 0,
      perfects: perfects ?? 0,
      speed: speed ?? 0,
      topX: topX ?? 0,
      topW: topW ?? 0,
      checksum: (sum ?? 0) >>> 0,
    }));
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    inputs,
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface SkylineResult {
  blocks: number;
  perfects: number;
  /** skylineRev 2: longest run of perfect drops and the streak bonus earned (0 on original rounds). */
  bestStreak: number;
  streakPoints: number;
  /** skylineRev 7: gold blocks landed perfectly, the best streak multiplier and height milestones (0 / 1 on older rounds). */
  golds: number;
  bestMult: number;
  milestones: number;
  survived: boolean;
  /** Seconds into the run when the tower was missed, or the full run length. */
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: SkylineCheckpoint[];
  reason?: string;
  state: SkylineState;
}

/** The single place a Skyline score is worked out. */
export function replaySkylineRun(seed: number, raw: string, rev?: number | null): SkylineResult {
  const skylineGame = skylineGameFor(rev);
  const run = decodeSkylineRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, SKYLINE_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < SKYLINE_RUN_TICKS;
  const check = checkInputLog(run.inputs, SKYLINE_RUN_TICKS);
  const taps = new Set(check.ticks);
  const lastTick = clientLag ? endTick : SKYLINE_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = skylineGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: SkylineCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = skylineGame.step(state, taps.has(tick));
    reached = tick;
    if (state.tick % SKYLINE_CHECKPOINT_INTERVAL === 0) {
      const serverState = skylineCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[skyline] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (skylineGame.isOver(state)) break;
  }

  const replayScore = skylineGame.score(state);
  const survived = skylineSurvived(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: SkylineResult = {
    blocks: state.placed,
    perfects: state.perfects,
    bestStreak: state.bestStreak ?? 0,
    streakPoints: state.streakPoints ?? 0,
    golds: state.golds ?? 0,
    bestMult: state.bestMult ?? 1,
    milestones: state.milestones ?? 0,
    survived,
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

export { SKYLINE_RUN_TICKS };
