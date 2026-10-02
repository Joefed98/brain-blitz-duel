/**
 * Snip round plumbing. The phone sends the seed, its cuts with the sim
 * tick each applied on, the tick it reached and the score it believes it
 * earned; the server replays with the STORED seed and keeps its own score.
 */

import {
  snipCheckpoint,
  snipGame,
  SNIP_CHECKPOINT_FIELDS,
  SNIP_CHECKPOINT_INTERVAL,
  SNIP_INPUT_RANGES,
  SNIP_RUN_TICKS,
  type SnipCheckpoint,
  type SnipState,
} from "@/lib/arcade/snip";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type InputDiag,
} from "@/lib/arcade/engine";

export interface SnipRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: SnipCheckpoint[];
}

export function encodeSnipRun(run: SnipRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) => [...SNIP_CHECKPOINT_FIELDS.map((f) => item[f]), item.checksum].join(":"))
    .join(",");
  return [run.seed, run.claimedScore, encodeInputEvents(run.events), run.endTick ?? 0, checkpoints].join("|");
}

export function decodeSnipRun(raw: string): SnipRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const width = SNIP_CHECKPOINT_FIELDS.length + 1;
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(SNIP_RUN_TICKS / SNIP_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === width && values.every(Number.isInteger))
    .map((values) => {
      const out = {} as Record<string, number>;
      SNIP_CHECKPOINT_FIELDS.forEach((f, i) => (out[f] = values[i] ?? 0));
      out["checksum"] = (values[width - 1] ?? 0) >>> 0;
      return out as unknown as SnipCheckpoint;
    });
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    events: decodeInputEvents(eventPart),
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface SnipResult {
  eaten: number;
  stars: number;
  levels: number;
  cuts: number;
  finished: boolean;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: SnipCheckpoint[];
  reason?: string;
  state: SnipState;
}

/** The single place a Snip score is worked out. */
export function replaySnipRun(seed: number, raw: string): SnipResult {
  const run = decodeSnipRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, SNIP_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < SNIP_RUN_TICKS;
  const check = checkInputEvents(run.events, SNIP_RUN_TICKS, SNIP_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : SNIP_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = snipGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: SnipCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = snipGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % SNIP_CHECKPOINT_INTERVAL === 0) {
      const serverState = snipCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[snip] client/server desync", { tick: state.tick, client: clientState, server: serverState });
      }
    }
    if (snipGame.isOver(state)) break;
  }

  const replayScore = snipGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: SnipResult = {
    eaten: state.eaten,
    stars: state.stars,
    levels: state.level,
    cuts: state.cuts,
    finished: state.tick >= SNIP_RUN_TICKS,
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
