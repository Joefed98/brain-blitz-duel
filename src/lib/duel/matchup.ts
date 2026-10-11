/**
 * Matchup round plumbing. The phone sends the seed it played, its swap events
 * with the sim tick each applied on, the tick it reached and the score it
 * believes it earned; the server replays with the STORED seed, validates every
 * payload against the game's declared ranges, and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import {
  matchupCheckpoint,
  matchupGameFor,
  matchupParRaw,
  MATCHUP_CHECKPOINT_INTERVAL,
  MATCHUP_INPUT_RANGES,
  MATCHUP_RUN_TICKS,
  type MatchupCheckpoint,
  type MatchupState,
} from "@/lib/arcade/matchup";
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";

export interface MatchupRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  /** The sim tick the phone actually reached; 0 or the run length means a full run. */
  endTick?: number;
  checkpoints?: MatchupCheckpoint[];
}

export function encodeMatchupRun(run: MatchupRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.swaps,
        item.raw,
        item.bestLine,
        item.cascades,
        item.reshuffles,
        item.board,
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

export function decodeMatchupRun(raw: string): MatchupRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(MATCHUP_RUN_TICKS / MATCHUP_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 8 && values.every(Number.isInteger))
    .map(([tick, swaps, raw2, bestLine, cascades, reshuffles, board, sum]) => ({
      tick: tick ?? 0,
      swaps: swaps ?? 0,
      raw: raw2 ?? 0,
      bestLine: bestLine ?? 0,
      cascades: cascades ?? 0,
      reshuffles: reshuffles ?? 0,
      board: (board ?? 0) >>> 0,
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

export interface MatchupResult {
  raw: number;
  /** The par this round scores against (matchupRev 2 has its own). */
  parRaw: number;
  /** matchupRev 2: Jackpot gems made and set off (0 on original rounds). */
  jackpots: number;
  jackpotsFired: number;
  swaps: number;
  bestLine: number;
  cascades: number;
  reshuffles: number;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: MatchupCheckpoint[];
  reason?: string;
  state: MatchupState;
}

/** The single place a Matchup score is worked out. */
export function replayMatchupRun(seed: number, raw: string, rev?: number | null): MatchupResult {
  const matchupGame = matchupGameFor(rev);
  const run = decodeMatchupRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, MATCHUP_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < MATCHUP_RUN_TICKS;
  const check = checkInputEvents(run.events, MATCHUP_RUN_TICKS, MATCHUP_INPUT_RANGES);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = clientLag ? endTick : MATCHUP_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = matchupGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: MatchupCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = matchupGame.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % MATCHUP_CHECKPOINT_INTERVAL === 0) {
      const serverState = matchupCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[matchup] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (matchupGame.isOver(state)) break;
  }

  const replayScore = matchupGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: MatchupResult = {
    raw: state.raw,
    parRaw: matchupParRaw(state),
    jackpots: state.jackpots ?? 0,
    jackpotsFired: state.jackpotsFired ?? 0,
    swaps: state.swaps,
    bestLine: state.bestLine,
    cascades: state.cascades,
    reshuffles: state.reshuffles,
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

export { MATCHUP_RUN_TICKS };
