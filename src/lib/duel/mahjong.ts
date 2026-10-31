/**
 * Mahjong Solitaire round plumbing (Cards & Board, 30 Oct 2026). The phone sends the seed it played, its taps and
 * Shuffles with the sim tick each applied on, the tick it reached, checkpoints and the score it believes it earned;
 * the server deals the board from the STORED seed, replays the log, validates every payload against the declared
 * ranges and keeps its own score. mahjongRev 2 adds Undo and Reset presses to the log (button `a` 1 and 2).
 */
import {
  mahjongCheckpoint,
  mahjongCleared,
  mahjongGameFor,
  MAHJONG_CHECKPOINT_INTERVAL,
  mahjongInputRanges,
  MAHJONG_RUN_TICKS,
  type MahjongCheckpoint,
  type MahjongState,
} from "@/lib/arcade/mahjong";
import { checkInputEvents, decodeInputEvents, encodeInputEvents, TICKS_PER_SECOND, type ArcadeInputEvent, type InputDiag } from "@/lib/arcade/engine";

export interface MahjongRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: MahjongCheckpoint[];
}

const FIELDS = ["tick", "pairs", "shuffles", "checksum"] as const;

export function encodeMahjongRun(run: MahjongRun): string {
  const checkpoints = (run.checkpoints ?? []).map((c) => FIELDS.map((k) => c[k]).join(":")).join(",");
  return [run.seed, run.claimedScore, encodeInputEvents(run.events), run.endTick ?? 0, checkpoints].join("|");
}

export function decodeMahjongRun(raw: string): MahjongRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (String(raw ?? "").split("~")[0] ?? "").split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(MAHJONG_RUN_TICKS / MAHJONG_CHECKPOINT_INTERVAL))
    .map((e) => e.split(":").map((p) => Number.parseInt(p, 10)))
    .filter((v) => v.length === FIELDS.length && v.every(Number.isInteger))
    .map(([tick, pairs, shuffles, sum]) => ({ tick: tick ?? 0, pairs: pairs ?? 0, shuffles: shuffles ?? 0, checksum: (sum ?? 0) >>> 0 }));
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    events: decodeInputEvents(eventPart),
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface MahjongResult {
  pairs: number;
  shuffles: number;
  misses: number;
  cleared: boolean;
  clearedSeconds: number;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: MahjongCheckpoint[];
  reason?: string;
  state: MahjongState;
}

/** The single place a Mahjong Solitaire score is worked out. */
export function replayMahjongRun(seed: number, raw: string, rev?: number | null): MahjongResult {
  const game = mahjongGameFor(rev);
  const run = decodeMahjongRun(raw);
  const runTicks = game.runTicks;
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, runTicks) : 0;
  const check = checkInputEvents(run.events, runTicks, mahjongInputRanges(rev));
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  let state = game.init(seed);
  const clientLag = endTick > 0 && endTick < runTicks;
  const lastTick = clientLag ? endTick : runTicks;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((c) => [c.tick, c]));
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: MahjongCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = game.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % MAHJONG_CHECKPOINT_INTERVAL === 0) {
      const server = mahjongCheckpoint(state);
      serverCheckpoints.push(server);
      const client = clientCheckpoints.get(state.tick);
      if ((!client || client.checksum !== server.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[mahjong] client/server desync", { tick: state.tick, client, server });
      }
    }
    if (game.isOver(state)) break;
  }
  const score = game.score(state);
  const mismatch = run.claimedScore !== score || run.seed !== seed;
  const result: MahjongResult = {
    pairs: state.pairs,
    shuffles: state.shuffles,
    misses: state.misses,
    cleared: mahjongCleared(state),
    clearedSeconds: Math.round((state.clearedTick / TICKS_PER_SECOND) * 10) / 10,
    endedSeconds: Math.round((reached / TICKS_PER_SECOND) * 10) / 10,
    score,
    flagged: !check.ok || mismatch || desyncTick !== null,
    clientLag: clientLag && !mahjongCleared(state),
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

export { MAHJONG_RUN_TICKS };
