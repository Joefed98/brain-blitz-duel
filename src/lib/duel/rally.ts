/**
 * Rally round plumbing. The phone sends the seed, its drag positions with the sim
 * tick each applied on, the tick it reached and the score it believes it earned;
 * the server replays with the STORED seed and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import {
  rallyCheckpoint,
  rallyGameFor,
  rallyPaddleW,
  rallySurvived,
  rallyTotalHits,
  RALLY_CHECKPOINT_INTERVAL,
  RALLY_INPUT_RANGES,
  RALLY_RUN_TICKS,
  type RallyCheckpoint,
  type RallyState,
} from "@/lib/arcade/rally";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";

export interface RallyRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: RallyCheckpoint[];
}

export function encodeRallyRun(run: RallyRun): string {
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
        item.goldHits,
        item.golds,
        item.width,
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

export function decodeRallyRun(raw: string): RallyRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(RALLY_RUN_TICKS / RALLY_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 12 && values.every(Number.isInteger))
    .map(([tick, x, y, vx, vy, speed, paddleX, hits, goldHits, golds, width, sum]) => ({
      tick: tick ?? 0,
      x: x ?? 0,
      y: y ?? 0,
      vx: vx ?? 0,
      vy: vy ?? 0,
      speed: speed ?? 0,
      paddleX: paddleX ?? 0,
      hits: hits ?? 0,
      goldHits: goldHits ?? 0,
      golds: golds ?? 0,
      width: width ?? 0,
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

export interface RallyResult {
  hits: number;
  goldHits: number;
  /** Rev 2: far-wall targets the gold ball struck, and bumper bounces (0 on older rounds). */
  targetHits: number;
  bounces: number;
  /** The revision the run was played on (0 = unstamped). */
  rallyRev: number;
  paddleWidth: number;
  survived: boolean;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: RallyCheckpoint[];
  reason?: string;
  state: RallyState;
}

/** The single place a Rally score is worked out. */
export function replayRallyRun(seed: number, raw: string, rev?: number | null): RallyResult {
  const run = decodeRallyRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, RALLY_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < RALLY_RUN_TICKS;
  // The revision's own game (rallyRev 9 has its own step and its wider court's input range; every earlier
  // revision shares rallyGame's step, so this is the same sim they always replayed on).
  const game = rallyGameFor(rev);
  const check = checkInputEvents(run.events, RALLY_RUN_TICKS, game.inputRanges ?? RALLY_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : RALLY_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = game.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: RallyCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = game.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % RALLY_CHECKPOINT_INTERVAL === 0) {
      const serverState = rallyCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[rally] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (game.isOver(state)) break;
  }

  const replayScore = game.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: RallyResult = {
    hits: state.hits,
    goldHits: state.goldHits,
    targetHits: state.targetHits ?? 0,
    bounces: state.bounces ?? 0,
    rallyRev: state.rev ?? 0,
    paddleWidth: rallyPaddleW(rallyTotalHits(state)),
    survived: rallySurvived(state),
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

export { RALLY_RUN_TICKS };
