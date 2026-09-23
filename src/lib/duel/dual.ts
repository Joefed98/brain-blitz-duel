/**
 * Dual round plumbing. The phone sends the seed it played, its jump events with
 * the sim tick each applied on, the tick it reached and the score it believes it
 * earned; the server replays with the STORED seed, validates every payload
 * against the game's declared ranges, and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import {
  dualCheckpoint,
  dualGame,
  dualSurvived,
  DUAL_CHECKPOINT_INTERVAL,
  DUAL_INPUT_RANGES,
  DUAL_RUN_TICKS,
  type DualCheckpoint,
  type DualState,
} from "@/lib/arcade/dual";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";

export interface DualRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: DualCheckpoint[];
}

export function encodeDualRun(run: DualRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.passed,
        item.jumps,
        item.leftUntil,
        item.rightUntil,
        item.leftPassed,
        item.rightPassed,
        item.scroll,
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

export function decodeDualRun(raw: string): DualRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] =
    (String(raw ?? "").split("~")[0] ?? "").split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(DUAL_RUN_TICKS / DUAL_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 9 && values.every(Number.isInteger))
    .map(([tick, passed, jumps, leftUntil, rightUntil, leftPassed, rightPassed, scroll, sum]) => ({
      tick: tick ?? 0,
      passed: passed ?? 0,
      jumps: jumps ?? 0,
      leftUntil: leftUntil ?? 0,
      rightUntil: rightUntil ?? 0,
      leftPassed: leftPassed ?? 0,
      rightPassed: rightPassed ?? 0,
      scroll: scroll ?? 0,
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

export interface DualResult {
  passed: number;
  jumps: number;
  survived: boolean;
  /** 0 left, 1 right, −1 when the run was not ended by a crash. */
  crashedSide: number;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: DualCheckpoint[];
  reason?: string;
  state: DualState;
}

/** The single place a Dual score is worked out. */
export function replayDualRun(seed: number, raw: string): DualResult {
  const run = decodeDualRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, DUAL_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < DUAL_RUN_TICKS;
  const check = checkInputEvents(run.events, DUAL_RUN_TICKS, DUAL_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : DUAL_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = dualGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: DualCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = dualGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % DUAL_CHECKPOINT_INTERVAL === 0) {
      const serverState = dualCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[dual] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (dualGame.isOver(state)) break;
  }

  const replayScore = dualGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: DualResult = {
    passed: state.passed,
    jumps: state.jumps,
    survived: dualSurvived(state),
    crashedSide: state.deadSide,
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

export { DUAL_RUN_TICKS };
