/**
 * Minesweeper round plumbing (Cards & Board, 30 Oct 2026). The phone sends the seed it played, its taps with the sim
 * tick each applied on, the tick it reached, checkpoints and the score it believes it earned; the server deals the
 * board from the STORED seed, replays the taps, validates every payload against the declared ranges and keeps its own
 * score.
 */
import {
  minesCheckpoint,
  minesCleared,
  minesweeperGameFor,
  MINES_CHECKPOINT_INTERVAL,
  MINES_INPUT_RANGES,
  MINES_RUN_TICKS,
  type MinesCheckpoint,
  type MinesState,
} from "@/lib/arcade/minesweeper";
import { checkInputEvents, decodeInputEvents, encodeInputEvents, TICKS_PER_SECOND, type ArcadeInputEvent, type InputDiag } from "@/lib/arcade/engine";

export interface MinesweeperRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: MinesCheckpoint[];
}

const FIELDS = ["tick", "revealed", "hits", "flags", "checksum"] as const;

export function encodeMinesweeperRun(run: MinesweeperRun): string {
  const checkpoints = (run.checkpoints ?? []).map((c) => FIELDS.map((k) => c[k]).join(":")).join(",");
  return [run.seed, run.claimedScore, encodeInputEvents(run.events), run.endTick ?? 0, checkpoints].join("|");
}

export function decodeMinesweeperRun(raw: string): MinesweeperRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (String(raw ?? "").split("~")[0] ?? "").split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(MINES_RUN_TICKS / MINES_CHECKPOINT_INTERVAL))
    .map((e) => e.split(":").map((p) => Number.parseInt(p, 10)))
    .filter((v) => v.length === FIELDS.length && v.every(Number.isInteger))
    .map(([tick, revealed, hits, flags, sum]) => ({ tick: tick ?? 0, revealed: revealed ?? 0, hits: hits ?? 0, flags: flags ?? 0, checksum: (sum ?? 0) >>> 0 }));
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    events: decodeInputEvents(eventPart),
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface MinesweeperResult {
  /** Safe squares revealed (the opening included), the opening, the safe total. */
  revealed: number;
  opening: number;
  hits: number;
  flags: number;
  chords: number;
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
  checkpoints: MinesCheckpoint[];
  reason?: string;
  state: MinesState;
}

/** The single place a Minesweeper score is worked out. */
export function replayMinesweeperRun(seed: number, raw: string, rev?: number | null): MinesweeperResult {
  const game = minesweeperGameFor(rev);
  const run = decodeMinesweeperRun(raw);
  const runTicks = game.runTicks;
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, runTicks) : 0;
  const check = checkInputEvents(run.events, runTicks, MINES_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  let state = game.init(seed);
  // A run that ended early because the board was cleared is not a lagging phone.
  const clientLag = endTick > 0 && endTick < runTicks;
  const lastTick = clientLag ? endTick : runTicks;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((c) => [c.tick, c]));
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: MinesCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = game.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % MINES_CHECKPOINT_INTERVAL === 0) {
      const server = minesCheckpoint(state);
      serverCheckpoints.push(server);
      const client = clientCheckpoints.get(state.tick);
      if ((!client || client.checksum !== server.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[minesweeper] client/server desync", { tick: state.tick, client, server });
      }
    }
    if (game.isOver(state)) break;
  }
  const score = game.score(state);
  const mismatch = run.claimedScore !== score || run.seed !== seed;
  const result: MinesweeperResult = {
    revealed: state.revealed,
    opening: state.opening,
    hits: state.hits,
    flags: state.flags,
    chords: state.chords,
    cleared: minesCleared(state),
    clearedSeconds: Math.round((state.clearedTick / TICKS_PER_SECOND) * 10) / 10,
    endedSeconds: Math.round((reached / TICKS_PER_SECOND) * 10) / 10,
    score,
    flagged: !check.ok || mismatch || desyncTick !== null,
    clientLag: clientLag && !minesCleared(state),
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

export { MINES_RUN_TICKS };
