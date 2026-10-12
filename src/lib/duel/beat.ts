/**
 * Beat round plumbing. The phone sends the seed, its lane taps with the sim tick
 * each applied on, the tick it reached and the score it believes it earned; the
 * server replays with the STORED seed and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import {
  beatCheckpoint,
  beatGameFor,
  beatNoteCount,
  beatSwipeCount,
  BEAT_CHECKPOINT_INTERVAL,
  BEAT_RUN_TICKS,
  type BeatCheckpoint,
  type BeatState,
} from "@/lib/arcade/beat";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";

export interface BeatRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: BeatCheckpoint[];
}

export function encodeBeatRun(run: BeatRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.cursor,
        item.perfect,
        item.good,
        item.ok,
        item.misses,
        item.strays,
        item.tenths,
        item.combo,
        item.holdFold,
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

export function decodeBeatRun(raw: string): BeatRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(BEAT_RUN_TICKS / BEAT_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 11 && values.every(Number.isInteger))
    .map(([tick, cursor, perfect, good, ok, misses, strays, tenths, combo, holdFold, sum]) => ({
      tick: tick ?? 0,
      cursor: cursor ?? 0,
      perfect: perfect ?? 0,
      good: good ?? 0,
      ok: ok ?? 0,
      misses: misses ?? 0,
      strays: strays ?? 0,
      tenths: tenths ?? 0,
      combo: combo ?? 0,
      holdFold: holdFold ?? 0,
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

export interface BeatResult {
  hits: number;
  noteCount: number;
  perfect: number;
  good: number;
  ok: number;
  misses: number;
  strays: number;
  maxCombo: number;
  holds: number;
  holdsDone: number;
  /** Rev 2: swipe notes in the chart and swipes hit (0 on older rounds). */
  swipes: number;
  swipesHit: number;
  clean: boolean;
  finished: boolean;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: BeatCheckpoint[];
  reason?: string;
  state: BeatState;
}

/** The single place a Beat score is worked out. */
export function replayBeatRun(seed: number, raw: string, rev?: number | null): BeatResult {
  const beatGame = beatGameFor(rev);
  const run = decodeBeatRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, BEAT_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < BEAT_RUN_TICKS;
  const check = checkInputEvents(run.events, BEAT_RUN_TICKS, beatGame.inputRanges ?? []);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : BEAT_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = beatGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: BeatCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = beatGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % BEAT_CHECKPOINT_INTERVAL === 0) {
      const serverState = beatCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[beat] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (beatGame.isOver(state)) break;
  }

  const replayScore = beatGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: BeatResult = {
    hits: state.perfect + state.good + state.ok,
    noteCount: beatNoteCount(state),
    perfect: state.perfect,
    good: state.good,
    ok: state.ok,
    misses: state.misses,
    strays: state.strays,
    maxCombo: state.maxCombo,
    holds: state.chart.holds.filter((h) => h > 0).length,
    holdsDone: state.holdsDone,
    swipes: beatSwipeCount(state),
    swipesHit: state.swipesHit ?? 0,
    clean: state.misses === 0 && state.tick >= BEAT_RUN_TICKS,
    finished: state.tick >= BEAT_RUN_TICKS,
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

export { BEAT_RUN_TICKS };
