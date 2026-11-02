/**
 * Ricochet round plumbing. The phone sends the seed it played, the sim ticks its
 * leaps applied on, the tick it reached and the score it believes it earned; the
 * server replays with the STORED seed and keeps its own score.
 */

import type { InputDiag } from "@/lib/arcade/engine";

import {
  ricoCheckpoint,
  ricoGame,
  ricoHeightPx,
  ricoSurvived,
  RICO_CHECKPOINT_INTERVAL,
  RICO_RUN_TICKS,
  type RicoCheckpoint,
  type RicoState,
} from "@/lib/arcade/ricochet";
import { checkInputLog, MAX_INPUT_TAPS, TICKS_PER_SECOND } from "@/lib/arcade/engine";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";
import {
  ninjaCheckpoint,
  ninjaGame,
  ninjaMetres,
  NINJA_CHECKPOINT_INTERVAL,
  NINJA_CHECKPOINT_KEYS,
  NINJA_REV,
  type NinjaCheckpoint,
  type NinjaState,
} from "@/lib/arcade/ricochetNinja";

export interface RicoRun {
  seed: number;
  claimedScore: number;
  inputs: number[];
  endTick?: number;
  checkpoints?: RicoCheckpoint[];
}

export function encodeRicoRun(run: RicoRun): string {
  const checkpoints = (run.checkpoints ?? [])
    .map((item) =>
      [
        item.tick,
        item.wall,
        item.y,
        item.best,
        item.flight,
        item.fromY,
        item.toY,
        item.leaps,
        item.slide,
        item.checksum,
      ].join(":"),
    )
    .join(",");
  return `${run.seed}|${run.claimedScore}|${run.inputs.join(",")}|${run.endTick ?? 0}|${checkpoints}`;
}

export function decodeRicoRun(raw: string): RicoRun {
  const [seedPart = "", scorePart = "", tapPart = "", tickPart = "", checkpointPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  const inputs = tapPart
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((tick) => Number.isInteger(tick))
    .slice(0, MAX_INPUT_TAPS + 1);
  const checkpoints = checkpointPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(RICO_RUN_TICKS / RICO_CHECKPOINT_INTERVAL))
    .map((encoded) => encoded.split(":").map((part) => Number.parseInt(part, 10)))
    .filter((values) => values.length === 10 && values.every(Number.isInteger))
    .map(([tick, wall, y, best, flight, fromY, toY, leaps, slide, sum]) => ({
      tick: tick ?? 0,
      wall: wall ?? 0,
      y: y ?? 0,
      best: best ?? 0,
      flight: flight ?? 0,
      fromY: fromY ?? 0,
      toY: toY ?? 0,
      leaps: leaps ?? 0,
      slide: slide ?? 0,
      checksum: (sum ?? 0) >>> 0,
    }));
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    inputs,
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface RicoResult {
  heightPx: number;
  leaps: number;
  survived: boolean;
  /** True when a spike ended the run rather than sliding to the floor. */
  spiked: boolean;
  endedSeconds: number;
  score: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  checkpoints: RicoCheckpoint[];
  reason?: string;
  state: RicoState;
}

/** The single place a Ricochet score is worked out. */
export function replayRicoRun(seed: number, raw: string): RicoResult {
  const run = decodeRicoRun(raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, RICO_RUN_TICKS) : 0;
  const clientLag = endTick > 0 && endTick < RICO_RUN_TICKS;
  const check = checkInputLog(run.inputs, RICO_RUN_TICKS);
  const taps = new Set(check.ticks);
  const lastTick = clientLag ? endTick : RICO_RUN_TICKS;
  const clientCheckpoints = new Map((run.checkpoints ?? []).map((item) => [item.tick, item]));

  let state = ricoGame.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const serverCheckpoints: RicoCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = ricoGame.step(state, taps.has(tick));
    reached = tick;
    if (state.tick % RICO_CHECKPOINT_INTERVAL === 0) {
      const serverState = ricoCheckpoint(state);
      serverCheckpoints.push(serverState);
      const clientState = clientCheckpoints.get(state.tick);
      if ((!clientState || clientState.checksum !== serverState.checksum) && desyncTick === null) {
        desyncTick = state.tick;
        console.error("[ricochet] client/server desync", {
          tick: state.tick,
          client: clientState,
          server: serverState,
        });
      }
    }
    if (ricoGame.isOver(state)) break;
  }

  const replayScore = ricoGame.score(state);
  const mismatch = run.claimedScore !== replayScore || run.seed !== seed;
  const result: RicoResult = {
    heightPx: ricoHeightPx(state),
    leaps: state.leaps,
    survived: ricoSurvived(state),
    spiked: state.spiked,
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

export { RICO_RUN_TICKS };

/* ===================== ricoRev 2: the ninja wall-climb ===================== */

const ninjaRun = makeArcadeRun<NinjaState, NinjaCheckpoint>({
  tag: "ricochet",
  game: ninjaGame,
  checkpoint: ninjaCheckpoint,
  keys: NINJA_CHECKPOINT_KEYS,
  interval: NINJA_CHECKPOINT_INTERVAL,
});

export const encodeNinjaRun = ninjaRun.encode;
export const decodeNinjaRun = ninjaRun.decode;

export interface NinjaResult extends FlatReplay<NinjaState, NinjaCheckpoint> {
  metres: number;
  coins: number;
  lanterns: number;
  scrolls: number;
  hits: number;
  leaps: number;
  djs: number;
}

/** The single place a ricoRev 2 score is worked out (the stored seed; the phone's claim is only compared). */
export function replayNinjaRun(seed: number, raw: string): NinjaResult {
  const r = ninjaRun.replay(seed, raw);
  const s = r.state;
  return { ...r, metres: ninjaMetres(s), coins: s.coins, lanterns: s.lanterns, scrolls: s.scrolls, hits: s.hits, leaps: s.leaps, djs: s.djs };
}

/** True for a Ricochet puzzle dealt on the ninja climb. */
export function isNinjaRev(rev: number | null | undefined): boolean {
  return (rev ?? 1) >= NINJA_REV;
}
