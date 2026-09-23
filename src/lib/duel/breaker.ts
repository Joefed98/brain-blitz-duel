/**
 * Breaker round plumbing. The phone sends the seed it played, the drag positions
 * and button presses with the sim tick each applied on, the tick it reached and
 * the score it believes it earned; the server replays with the STORED seed,
 * validates every payload, and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import {
  brkBricksLeft,
  brkDestroyed,
  brkCheckpoint,
  breakerGame,
  BRK_CHECKPOINT_INTERVAL,
  BRK_INPUT_RANGES,
  BRK_RUN_TICKS,
  BRK_TOTAL_HITS,
  type BrkCheckpoint,
  type BrkState,
} from "@/lib/arcade/breaker";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";

export interface BreakerRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: BrkCheckpoint[];
}

export function encodeBreakerRun(run: BreakerRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.x,
        item.y,
        item.vx,
        item.vy,
        item.speed,
        item.paddleX,
        item.hits,
        item.left,
        item.losses,
        item.pause,
        item.balls,
        item.capsules,
        item.held,
        item.charges,
        item.powerUps,
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

export function decodeBreakerRun(raw: string): BreakerRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(BRK_RUN_TICKS / BRK_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 17 && values.every(Number.isInteger))
    .map(
      ([
        tick,
        x,
        y,
        vx,
        vy,
        speed,
        paddleX,
        hits,
        left,
        losses,
        pause,
        balls,
        capsules,
        held,
        charges,
        powerUps,
        sum,
      ]) => ({
        tick: tick ?? 0,
        x: x ?? 0,
        y: y ?? 0,
        vx: vx ?? 0,
        vy: vy ?? 0,
        speed: speed ?? 0,
        paddleX: paddleX ?? 0,
        hits: hits ?? 0,
        left: left ?? 0,
        losses: losses ?? 0,
        pause: pause ?? 0,
        balls: balls ?? 0,
        capsules: capsules ?? 0,
        held: held ?? 0,
        charges: charges ?? 0,
        powerUps: powerUps ?? 0,
        checksum: (sum ?? 0) >>> 0,
      }),
    );
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    events: decodeInputEvents(eventPart),
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface BreakerResult {
  hits: number;
  bricksLeft: number;
  destroyed: number;
  totalHits: number;
  losses: number;
  powerUps: number;
  cleared: boolean;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: BrkCheckpoint[];
  reason?: string;
  state: BrkState;
}

/** The single place a Breaker score is worked out. */
export function replayBreakerRun(seed: number, raw: string): BreakerResult {
  const run = decodeBreakerRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, BRK_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < BRK_RUN_TICKS;
  const check = checkInputEvents(run.events, BRK_RUN_TICKS, BRK_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : BRK_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = breakerGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: BrkCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = breakerGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % BRK_CHECKPOINT_INTERVAL === 0) {
      const serverState = brkCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[breaker] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (breakerGame.isOver(state)) break;
  }

  const replayScore = breakerGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: BreakerResult = {
    hits: state.hits,
    bricksLeft: brkBricksLeft(state),
    destroyed: brkDestroyed(state),
    totalHits: BRK_TOTAL_HITS,
    losses: state.losses,
    powerUps: state.powerUps,
    cleared: state.cleared,
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

export { BRK_RUN_TICKS };
