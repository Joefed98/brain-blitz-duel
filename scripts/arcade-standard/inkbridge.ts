/**
 * Rainbow Bridge on the arcade scoring standard (inkRev 12, 29 Oct 2026; docs/arcade-standard/inkbridge.md).
 * Perfect runs are the x200 oracle (scripts/ink-x200-oracle.ts) replayed through the server on inkRev 12: every level
 * potted on its proved bonus line (every ink star, trick shot, silver coin and the shamrock) with more than 45 s left;
 * plus one built state with every counter full. A played run that earns nothing is one stroke point and no release.
 */
import { inkBridgeGameFor, inkCheckpoint, INK_CHECKPOINT_INTERVAL, INK_INPUT_STROKE, INK_LEVELS, INK_REV_SPREAD, INK_REV_STD, INK_STD, type InkState } from "../../src/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../../src/lib/duel/inkBridge";
import { roomSeed } from "../arcade-skill-bands/games";
import { inkOracleRun } from "../ink-x200-oracle";
import type { StdEntry, StdRun } from "./entry";

const game = inkBridgeGameFor(INK_REV_STD);

/** Plays a log on inkRev 12 and scores it through the server's encode + replay. */
function replayed(seed: number, events: { t: number; k: number; a: number; b: number; c: number; d: number }[]): number {
  let s = game.init(seed) as InkState;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % INK_CHECKPOINT_INTERVAL === 0) checkpoints.push(inkCheckpoint(s));
  }
  const raw = encodeInkBridgeRun({ seed, claimedScore: game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  return replayInkBridgeRun(seed, raw, INK_REV_STD).score;
}

export const entry: StdEntry = {
  type: "inkbridge",
  field: "inkRev",
  rev: INK_REV_STD,
  before: INK_REV_SPREAD,
  spec: INK_STD,
  perfect: () => {
    const runs: StdRun[] = [0, 7, 141].map((n) => {
      const seed = roomSeed(n);
      const o = inkOracleRun(seed, INK_REV_STD);
      return { label: `oracle seed ${seed} (${o.levels} levels, ${o.endedSeconds.toFixed(1)} s, server replay)`, score: o.replayed === o.score ? o.replayed : -1 };
    });
    const s = game.init(roomSeed(3)) as InkState;
    runs.push({ label: "built state: ten levels at 30 s, 8 stars, 4 trick shots, 16 silver, the shamrock", score: game.score({ ...s, acted: 1, levels: INK_LEVELS, ended: 1, endedTick: 30 * 60, tick: 30 * 60, stars: 8, tricks: 4, silver: 16, shamrocks: 1 }) });
    return runs;
  },
  played: () => [0, 1].map((n) => {
    const seed = roomSeed(n);
    return { label: `seed ${seed}: one stroke point, never released`, score: replayed(seed, [{ t: 30, k: INK_INPUT_STROKE, a: 100, b: 100, c: 1, d: 0 }]) };
  }),
  idle: () => [0, 1].map((n) => ({ label: `seed ${roomSeed(n)}: no input`, score: replayed(roomSeed(n), []) })),
  helpTerms: ["45 s", "14"],
};
