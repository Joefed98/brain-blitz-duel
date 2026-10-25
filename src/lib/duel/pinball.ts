/**
 * Pinball round plumbing. The phone sends the seed it played, the held-flipper
 * changes with the sim tick each applied on, the tick it reached, checkpoints
 * and the score it believes it earned; the server replays the stored table with
 * the logged flippers, validates every payload, and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import { pinballGameForAny, pinCheckpointAny, type Pin4State } from "@/lib/arcade/pinball4";
import {
  pinBallsLeft,
  PIN_CHECKPOINT_INTERVAL,
  PIN_INPUT_RANGES,
  PIN_RUN_TICKS,
  type PinCheckpoint,
  type PinState,
} from "@/lib/arcade/pinball";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";

export interface PinballRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: PinCheckpoint[];
}

const CHECKPOINT_FIELDS = ["tick", "x", "y", "vx", "vy", "points", "lost", "held", "left", "right", "lanes", "targets", "mult", "checksum"] as const;

export function encodePinballRun(run: PinballRun): string {
  const checkpoints = (run.checkpoints ?? []).map((item) => CHECKPOINT_FIELDS.map((key) => item[key]).join(":")).join(",");
  return [run.seed, run.claimedScore, encodeInputEvents(run.events), run.endTick ?? 0, checkpoints].join("|");
}

export function decodePinballRun(raw: string): PinballRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(PIN_RUN_TICKS / PIN_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === CHECKPOINT_FIELDS.length && values.every(Number.isInteger))
    .map((values) => {
      const item = Object.fromEntries(CHECKPOINT_FIELDS.map((key, i) => [key, values[i] ?? 0])) as unknown as PinCheckpoint;
      item.checksum = item.checksum >>> 0;
      return item;
    });
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    events: decodeInputEvents(eventPart),
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface PinballResult {
  points: number;
  mult: number;
  bumps: number;
  drops: number;
  banks: number;
  spins: number;
  laneSets: number;
  /** pinRev 4 (0 on older rounds): clean ramp shots, the best ramp combo, multiballs, jackpots and skill shots. */
  ramps: number;
  bestCombo: number;
  multiballs: number;
  jackpots: number;
  skills: number;
  /** Balls drained, and balls the run still had when it ended. */
  lost: number;
  ballsLeft: number;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: PinCheckpoint[];
  reason?: string;
  state: PinState;
}

/** The single place a Pinball score is worked out. */
export function replayPinballRun(seed: number, raw: string, rev?: number | null): PinballResult {
  const game = pinballGameForAny(rev);
  const run = decodePinballRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, PIN_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < PIN_RUN_TICKS;
  const check = checkInputEvents(run.events, PIN_RUN_TICKS, PIN_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : PIN_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = game.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: PinCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = game.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % PIN_CHECKPOINT_INTERVAL === 0) {
      const serverState = pinCheckpointAny(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[pinball] client/server desync", { tick: state.tick, client: clientState, server: serverState });
      }
    }
    if (game.isOver(state)) break;
  }

  const replayScore = game.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: PinballResult = {
    points: state.points,
    mult: state.mult,
    bumps: state.bumps,
    drops: state.drops,
    banks: state.banks,
    spins: state.spins,
    laneSets: state.laneSets,
    ramps: (state as Partial<Pin4State>).ramps ?? 0,
    bestCombo: (state as Partial<Pin4State>).bestCombo ?? 0,
    multiballs: (state as Partial<Pin4State>).multiballs ?? 0,
    jackpots: (state as Partial<Pin4State>).jackpots ?? 0,
    skills: (state as Partial<Pin4State>).skills ?? 0,
    lost: state.lost,
    ballsLeft: pinBallsLeft(state),
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

export { PIN_RUN_TICKS };
