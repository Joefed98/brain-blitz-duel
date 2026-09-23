/**
 * Swerve round plumbing. The phone sends the seed it played, its lane taps with
 * the sim tick each applied on, the tick it reached and the score it believes it
 * earned; the server replays with the STORED seed and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import {
  swerveCheckpoint,
  swerveGame,
  swerveSurvived,
  SWERVE_CHECKPOINT_INTERVAL,
  SWERVE_RUN_TICKS,
  type SwerveCheckpoint,
  type SwerveInput,
  type SwerveState,
} from "@/lib/arcade/swerve";
import { checkInputLog, MAX_INPUT_TAPS, TICKS_PER_SECOND } from "@/lib/arcade/engine";

/** One lane change: the sim tick it applied on and which way it went. */
export interface SwerveTap {
  tick: number;
  /** -1 for a lane left, 1 for a lane right. */
  dir: -1 | 1;
}

export interface SwerveRun {
  seed: number;
  claimedScore: number;
  taps: SwerveTap[];
  /** The sim tick the phone actually reached; 0 or the run length means a full run. */
  endTick?: number;
  checkpoints?: SwerveCheckpoint[];
}

export function encodeSwerveRun(run: SwerveRun): string {
  const taps = run.taps.map((tap) => `${tap.tick}:${tap.dir === -1 ? 0 : 1}`).join(",");
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.x,
        item.lane,
        item.distance,
        item.coins,
        item.cursor,
        item.nextRowY,
        item.nextRowMask,
        item.nextCoinLane,
        item.nextCoinCollected,
        item.checksum,
      ].join(":"),
    )
    .join(",");
  return `${run.seed}|${run.claimedScore}|${taps}|${run.endTick ?? 0}|${checkpoints}`;
}

export function decodeSwerveRun(raw: string): SwerveRun {
  const [seedPart = "", scorePart = "", tapPart = "", tickPart = "", checkpointPart = ""] = (String(raw ?? "").split("~")[0] ?? "").split("|");
  const taps = tapPart
    .split(",")
    .filter(Boolean)
    .slice(0, MAX_INPUT_TAPS + 1)
    .map((part) => part.split(":").map((value) => Number.parseInt(value, 10)))
    .filter((values) => values.length === 2 && values.every(Number.isInteger))
    .map(([tick, dir]) => ({ tick: tick ?? 0, dir: dir === 0 ? (-1 as const) : (1 as const) }));
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(SWERVE_RUN_TICKS / SWERVE_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter(
      (values) => (values.length === 11 || values.length === 10) && values.every(Number.isInteger),
    )
    .map((values) => ({
      tick: values[0] ?? 0,
      x: values[1] ?? 0,
      lane: values[2] ?? 0,
      distance: values[3] ?? 0,
      coins: values[4] ?? 0,
      cursor: values[5] ?? 0,
      nextRowY: values[6] ?? 0,
      nextRowMask: values[7] ?? 0,
      nextCoinLane: values[8] ?? -1,
      nextCoinCollected: values.length === 11 ? (values[9] ?? 0) : 0,
      checksum: (values[values.length - 1] ?? 0) >>> 0,
    }));
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    taps,
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface SwerveResult {
  coins: number;
  totalCoins: number;
  survived: boolean;
  /** Seconds into the run when the chevron crashed, or the full run length. */
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: SwerveCheckpoint[];
  reason?: string;
  state: SwerveState;
}

/** The single place a Swerve score is worked out. */
export function replaySwerveRun(seed: number, raw: string): SwerveResult {
  const run = decodeSwerveRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, SWERVE_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < SWERVE_RUN_TICKS;
  const ticks = run.taps.map((tap) => tap.tick);
  const check = checkInputLog(ticks, SWERVE_RUN_TICKS);
  const moves = new Map<number, SwerveInput>();
  if (check.ok) for (const tap of run.taps) moves.set(tap.tick, tap.dir);
  const lastTick = clientLag ? endTick : SWERVE_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = swerveGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: SwerveCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = swerveGame.step(state, moves.get(tick) ?? 0);
    reached = tick;
    if (state.tick % SWERVE_CHECKPOINT_INTERVAL === 0) {
      const serverState = swerveCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[swerve] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (swerveGame.isOver(state)) break;
  }

  const replayScore = swerveGame.score(state);
  const survived = swerveSurvived(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: SwerveResult = {
    coins: state.coins,
    totalCoins: state.totalCoins,
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

export { SWERVE_RUN_TICKS };
