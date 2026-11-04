/**
 * Rainbow Bridge on the arcade scoring standard: inkRev 14 (3 Nov 2026; docs/arcade-standard/inkbridge.md "inkRev 14":
 * inkRev 13's parts with a bigger coin, clovers and birds, dealt from a proved deal), after inkRev 13 (Nov 2026) and
 * inkRev 12 (29 Oct 2026). Perfect runs are the oracle (scripts/ink-x200-oracle.ts) replayed through the server on
 * inkRev 14 on seeds of the deal (src/lib/duel/inkBigDeal.server.ts): every level potted within its ink par, on its proved bonus line where it has a cloud (a trick shot) or a
 * clover, else its easy line, with more than 50 s left; plus one built state with every counter full. A played run that
 * earns nothing is one stroke point and no release.
 */
import { inkBridgeGameFor, inkCheckpoint, inkV13Score, INK_CHECKPOINT_INTERVAL, INK_CLOUD_LEVELS, INK_INPUT_STROKE, INK_LEVELS, INK_REV_BIG, INK_REV_CLOVER, INK_V13_CLOVERS, INK_V14_STD, type InkState } from "../../src/lib/arcade/inkBridge";
import { INK_BIG_DEAL } from "../../src/lib/duel/inkBigDeal.server";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../../src/lib/duel/inkBridge";
import { roomSeed } from "../arcade-skill-bands/games";
import { inkOracleRun } from "../ink-x200-oracle";
import type { StdEntry, StdRun } from "./entry";

const game = inkBridgeGameFor(INK_REV_BIG);

/** Plays a log on inkRev 14 and scores it through the server's encode + replay. */
function replayed(seed: number, events: { t: number; k: number; a: number; b: number; c: number; d: number }[]): number {
  let s = game.init(seed) as InkState;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % INK_CHECKPOINT_INTERVAL === 0) checkpoints.push(inkCheckpoint(s));
  }
  const raw = encodeInkBridgeRun({ seed, claimedScore: game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  return replayInkBridgeRun(seed, raw, INK_REV_BIG).score;
}

/** A run's points per part (the core keyed "core"). */
function partsOf(s: InkState): Record<string, number> {
  const b = inkV13Score(s);
  return { core: b.core, ...b.features };
}

export const entry: StdEntry = {
  type: "inkbridge",
  field: "inkRev",
  rev: INK_REV_BIG,
  before: INK_REV_CLOVER,
  parts: INK_V14_STD.parts,
  spec: INK_V14_STD,
  perfect: () => {
    const runs: StdRun[] = [0, 7, 41].map((n) => {
      const seed = INK_BIG_DEAL[n]!;
      const o = inkOracleRun(seed, INK_REV_BIG);
      return { label: `oracle seed ${seed} (${o.levels} levels, ${o.endedSeconds.toFixed(1)} s, server replay)`, score: o.replayed === o.score ? o.replayed : -1, parts: partsOf(o.state) };
    });
    const s = game.init(roomSeed(3)) as InkState;
    const full: InkState = { ...s, acted: 1, levels: INK_LEVELS, ended: 1, endedTick: 30 * 60, tick: 30 * 60, inkPar: 1000 * INK_LEVELS, parLevels: INK_LEVELS, tricks: INK_CLOUD_LEVELS, shamrocks: INK_V13_CLOVERS };
    runs.push({ label: "built state: ten levels at 30 s, every one within its ink par, 4 trick shots, both clovers", score: game.score(full), parts: partsOf(full) });
    return runs;
  },
  played: () => [0, 1].map((n) => {
    const seed = roomSeed(n);
    return { label: `seed ${seed}: one stroke point, never released`, score: replayed(seed, [{ t: 30, k: INK_INPUT_STROKE, a: 100, b: 100, c: 1, d: 0 }]) };
  }),
  idle: () => [0, 1].map((n) => ({ label: `seed ${roomSeed(n)}: no input`, score: replayed(roomSeed(n), []) })),
  help: { terms: ["50 s", "12", "ink par"] },
  extra: (ok) => {
    // The ink-par part: 3 a level within par, a straight line from par to twice it, nothing past that.
    const s = game.init(roomSeed(0)) as InkState;
    const at = (inkPar: number) => inkV13Score({ ...s, acted: 1, levels: 1, inkPar }).features["par"];
    ok(at(1000) === 3 && at(500) === 1 && at(0) === 0 && at(10_000) === 30, "ink par pays 3 a level within par (credit 1000), on a straight line below it");
    // No stars or silver coins on inkRev 13: their counters never pay.
    const b = inkV13Score({ ...s, acted: 1, levels: 0, stars: 8, silver: 16 });
    ok(b.core === 0 && Object.values(b.features).every((v) => v === 0), "ink stars and silver coins pay nothing on inkRev 14 (there are none)");
  },
};
