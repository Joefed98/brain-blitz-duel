/**
 * Shared run plumbing for arcade games whose checkpoints are flat number
 * records. The phone sends "seed|claimedScore|events|endTick|checkpoints"; the
 * server replays with the STORED seed, validates the events against the game's
 * declared ranges, compares checkpoints, and keeps its own score.
 */

import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type InputDiag,
} from "@/lib/arcade/engine";
import { isEmptyRunAnswer } from "@/lib/arcade/sportsKit";

export interface FlatRun<C> {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  endTick?: number;
  checkpoints?: C[];
}

export interface FlatReplay<S, C> {
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  endedSeconds: number;
  checkpoints: C[];
  reason?: string;
  state: S;
}

export function makeArcadeRun<S, C extends { tick: number; checksum: number }>(opts: {
  tag: string;
  game: ArcadeGame<S, ArcadeInputEvent | null>;
  checkpoint: (state: S) => C;
  keys: readonly (keyof C & string)[];
  interval: number;
  /**
   * The Sports games only (Home Run, Top Bins, Apex; 15 Nov 2026): an answer with no run in it (isEmptyRunAnswer) is
   * graded as the genuine 0 its replay gives, unflagged. Every other game leaves it off and judges such an answer as
   * before.
   */
  emptyIsZero?: boolean;
}) {
  const { game, checkpoint, keys, interval, tag } = opts;
  const emptyIsZero = opts.emptyIsZero === true;
  const runTicks = game.runTicks;
  const ranges = game.inputRanges ?? [];

  const encode = (run: FlatRun<C>): string => {
    const checkpoints = (run.checkpoints ?? [])
      .map((item) => keys.map((key) => (item as Record<string, number>)[key] ?? 0).join(":"))
      .join(",");
    return [
      run.seed,
      run.claimedScore,
      encodeInputEvents(run.events),
      run.endTick ?? 0,
      checkpoints,
    ].join("|");
  };

  const decode = (raw: string): FlatRun<C> => {
    const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", checkpointPart = ""] = (
      String(raw ?? "").split("~")[0] ?? ""
    ).split("|");
    const checkpoints = checkpointPart
      .split(",")
      .filter(Boolean)
      .slice(0, Math.ceil(runTicks / interval))
      .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
      .filter((values) => values.length === keys.length && values.every(Number.isInteger))
      .map((values) => {
        const out: Record<string, number> = {};
        keys.forEach((key, index) => {
          out[key] = values[index] ?? 0;
        });
        out["checksum"] = (out["checksum"] ?? 0) >>> 0;
        return out as unknown as C;
      });
    return {
      seed: Number.parseInt(seedPart, 10) || 0,
      claimedScore: Number.parseInt(scorePart, 10) || 0,
      events: decodeInputEvents(eventPart),
      endTick: Number.parseInt(tickPart, 10) || 0,
      checkpoints,
    };
  };

  /**
   * `observe` (display only, the reveals' run summaries): called with each state the replay steps to, in order. It never
   * changes the replay: the same states, score and flags with or without it.
   */
  const replay = (seed: number, raw: string, observe?: (state: S) => void): FlatReplay<S, C> => {
    const run = decode(raw);
    const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, runTicks) : 0;
    const clientLag = endTick > 0 && endTick < runTicks;
    const check = checkInputEvents(run.events, runTicks, ranges);
    const events = new Map<number, ArcadeInputEvent>();
    for (const event of check.events) events.set(event.t, event);
    const lastTick = clientLag ? endTick : runTicks;
    const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));
    const empty = emptyIsZero && isEmptyRunAnswer(raw);

    let state = game.init(seed);
    let reached = 0;
    let desyncTick: number | null = null;
    const serverCheckpoints: C[] = [];
    for (let tick = 1; tick <= lastTick; tick++) {
      state = game.step(state, events.get(tick) ?? null);
      observe?.(state);
      reached = tick;
      if (tick % interval === 0) {
        const serverState = checkpoint(state);
        serverCheckpoints.push(serverState);
        const clientState = clientCheckpoints.get(tick);
        if (!empty && (!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
          desyncTick = tick;
          console.error(`[${tag}] client/server desync`, {
            tick,
            client: clientState,
            server: serverState,
          });
        }
      }
      if (game.isOver(state)) break;
    }

    const replayScore = game.score(state);
    const mismatch = run.claimedScore !== replayScore || (run.seed !== seed && !(empty && replayScore === 0));
    const result: FlatReplay<S, C> = {
      score: replayScore,
      flagged: !check.ok || mismatch || desyncTick !== null,
      clientLag,
      clientTick: endTick,
      desyncTick,
      inputDiag: check.diag,
      replayTick: reached,
      endedSeconds: Math.round((reached / TICKS_PER_SECOND) * 10) / 10,
      checkpoints: serverCheckpoints,
      state,
    };
    if (check.reason) result.reason = check.reason;
    else if (mismatch) result.reason = "score did not match the replay";
    return result;
  };

  return { encode, decode, replay };
}
