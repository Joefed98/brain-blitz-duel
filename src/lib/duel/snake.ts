/**
 * Snake round plumbing. The phone sends the seed it played, its turn events with
 * the sim tick each applied on, the tick it reached and the score it believes it
 * earned; the server replays with the STORED seed, validates every payload
 * against the game's declared ranges, and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import {
  snakeCheckpoint,
  snakeGameFor,
  snakeSurvived,
  SNAKE_CHECKPOINT_INTERVAL,
  SNAKE_INPUT_RANGES,
  SNAKE_RUN_TICKS,
  type SnakeCheckpoint,
  type SnakeState,
} from "@/lib/arcade/snake";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";

export interface SnakeRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  /** The sim tick the phone actually reached; 0 or the run length means a full run. */
  endTick?: number;
  checkpoints?: SnakeCheckpoint[];
}

export function encodeSnakeRun(run: SnakeRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.head,
        item.tail,
        item.length,
        item.dir,
        item.nextDir,
        item.eaten,
        item.pellet,
        item.cursor,
        item.sinceMove,
        item.stepTicks,
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

export function decodeSnakeRun(raw: string): SnakeRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(SNAKE_RUN_TICKS / SNAKE_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 12 && values.every(Number.isInteger))
    .map(
      ([tick, head, tail, length, dir, nextDir, eaten, pellet, cursor, sinceMove, steps, sum]) => ({
        tick: tick ?? 0,
        head: head ?? 0,
        tail: tail ?? 0,
        length: length ?? 0,
        dir: dir ?? 0,
        nextDir: nextDir ?? 0,
        eaten: eaten ?? 0,
        pellet: pellet ?? 0,
        cursor: cursor ?? 0,
        sinceMove: sinceMove ?? 0,
        stepTicks: steps ?? 0,
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

export interface SnakeResult {
  /** Stars eaten (the stored key keeps its original name). */
  pellets: number;
  /** snakeRev 2: rocks that landed, those that landed clear of the head, and whether a rock ended the run. */
  rocks: number;
  rocksDodged: number;
  rockHit: boolean;
  length: number;
  survived: boolean;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: SnakeCheckpoint[];
  reason?: string;
  state: SnakeState;
}

/** The single place a Snake score is worked out. */
export function replaySnakeRun(seed: number, raw: string, rev?: number | null): SnakeResult {
  const snakeGame = snakeGameFor(rev);
  const run = decodeSnakeRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, SNAKE_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < SNAKE_RUN_TICKS;
  const check = checkInputEvents(run.events, SNAKE_RUN_TICKS, SNAKE_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : SNAKE_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = snakeGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: SnakeCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = snakeGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % SNAKE_CHECKPOINT_INTERVAL === 0) {
      const serverState = snakeCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[snake] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (snakeGame.isOver(state)) break;
  }

  const replayScore = snakeGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: SnakeResult = {
    pellets: state.eaten,
    rocks: state.rocks?.length ?? 0,
    rocksDodged: (state.rocks?.length ?? 0) - (state.rockHit === 2 ? 1 : 0),
    rockHit: (state.rockHit ?? 0) > 0,
    length: state.body.length,
    survived: snakeSurvived(state),
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

export { SNAKE_RUN_TICKS };
