/** Ink Bridge round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  inkBridgeGame,
  inkBridgeBirdsGame,
  inkBridgeInkRev3Game,
  inkBridgeInkRev4Game,
  INK_REV,
  INK_REV_BAND,
  INK_REV_TUNEC,
  INK_REV_TARGET, INK_REV_STRICT, INK_REV_EXPAND, INK_REV_SPREAD, INK_REV_STD, INK_REV_CLOVER, INK_REV_BIG, INK_REV_HILLS, INK_REV_D6, inkClover,
  inkBridgeGameFor,
  isInkDiff,
  type InkDiff,
  INK_REV3,
  INK_REV4,
  inkCheckpoint,
  INK_CHECKPOINT_INTERVAL,
  INK_CHECKPOINT_KEYS,
  INK_LEVELS,
  type InkCheckpoint,
  type InkState,
} from "@/lib/arcade/inkBridge";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeGame,
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});

const birdsRun = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeBirdsGame,
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});

const rev3Run = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeInkRev3Game,
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});

const rev4Run = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeInkRev4Game,
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});
/** inkRev 5: rev-4 play on the Oct 2026 score bands. */
const bandRun = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeGameFor(INK_REV_BAND),
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});

/** inkRev 6 (Tuning C): inkRev 5 play on the lower INK_V6_BAND_CURVE. */
const tunecRun = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeGameFor(INK_REV_TUNEC),
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});
/** inkRev 7 (scoring targets): inkRev 6 play on the lifted curve. */
const targetRun = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeGameFor(INK_REV_TARGET),
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});
const strictRun = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeGameFor(INK_REV_STRICT),
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});

/** inkRev 10 (x200): the taller world with clouds, wind, ink stars, silver coins and a shamrock, scored to 200. */
const expandRun = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeGameFor(INK_REV_EXPAND),
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});

/** inkRev 11 (phone notes): no wind, two silver coins a level, the pickups spread out. */
const spreadRun = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeGameFor(INK_REV_SPREAD),
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});

/** inkRev 12 (the arcade scoring standard): inkRev 11's play on the standard's straight lines and fixed shares. */
const stdRun = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeGameFor(INK_REV_STD),
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});

/** inkRev 13 (Nov 2026): clovers, ink par and more birds, scored on the standard (INK_V13_STD). */
const cloverRun = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeGameFor(INK_REV_CLOVER),
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});

/** inkRev 14 (3 Nov 2026): inkRev 13's rules and parts with a bigger coin, clovers and birds. */
const bigRun = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeGameFor(INK_REV_BIG),
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});

/** inkRev 15 (the Strategy overhaul, 15 Nov 2026): inkRev 14 with the pot and hill placed level by level. */
const hillsRun = makeArcadeRun<InkState, InkCheckpoint>({
  tag: "inkbridge",
  game: inkBridgeGameFor(INK_REV_HILLS),
  checkpoint: inkCheckpoint,
  keys: INK_CHECKPOINT_KEYS,
  interval: INK_CHECKPOINT_INTERVAL,
});

export interface InkBridgeResult extends FlatReplay<InkState, InkCheckpoint> {
  levels: number;
  total: number;
  fails: number;
  rev?: number | null;
  /** Rev 4: gold stars potted and levels with a star (0 on older rounds). */
  stars: number;
  starLevels: number;
  /** inkRev 10: trick shots potted and levels with a bounce cloud (0 on older rounds). */
  tricks: number;
  cloudLevels: number;
  /** inkRev 10: silver coins potted and offered, and whether the shamrock was potted (0 on older rounds). */
  silver: number;
  silverTotal: number;
  shamrock: number;
  /** inkRev 13: clovers on offer (the potted ones are `shamrock`), levels potted within their ink par, and the ink-par
   * credit (per mille a level; 0 on older rounds). */
  cloverTotal: number;
  parLevels: number;
  inkPar: number;
}

export const encodeInkBridgeRun = run.encode;
export const decodeInkBridgeRun = run.decode;

/** Stage 3: inkRev 15 at a level other than Normal, one run plumbing a level (made on first use). */
const levelRuns = new Map<InkDiff, ReturnType<typeof makeArcadeRun<InkState, InkCheckpoint>>>();
function levelRun(diff: InkDiff) {
  let r = levelRuns.get(diff);
  if (!r) {
    r = makeArcadeRun<InkState, InkCheckpoint>({ tag: "inkbridge", game: inkBridgeGameFor(INK_REV_HILLS, diff), checkpoint: inkCheckpoint, keys: INK_CHECKPOINT_KEYS, interval: INK_CHECKPOINT_INTERVAL });
    levelRuns.set(diff, r);
  }
  return r;
}

/** inkRev 16 (D6): inkRev 15's world at a level (null: Normal) on its D6 figures, one run plumbing a level (made on first use). */
const d6Runs = new Map<string, ReturnType<typeof makeArcadeRun<InkState, InkCheckpoint>>>();
function d6Run(diff: InkDiff | null) {
  const key = diff ?? "normal";
  let r = d6Runs.get(key);
  if (!r) {
    r = makeArcadeRun<InkState, InkCheckpoint>({ tag: "inkbridge", game: inkBridgeGameFor(INK_REV_D6, diff), checkpoint: inkCheckpoint, keys: INK_CHECKPOINT_KEYS, interval: INK_CHECKPOINT_INTERVAL });
    d6Runs.set(key, r);
  }
  return r;
}

/**
 * The single place an Ink Bridge score is worked out. `level` is the stored puzzle's level (puzzleLevel): on inkRev 15 a
 * level other than Normal replays that level's run; anything else (every round before levels) replays as before.
 */
export function replayInkBridgeRun(seed: number, raw: string, rev?: number | null, level?: unknown): InkBridgeResult {
  const picked = rev === INK_REV_D6 ? d6Run(isInkDiff(level) ? level : null) : rev === INK_REV_HILLS && isInkDiff(level) ? levelRun(level) : rev === INK_REV_HILLS ? hillsRun : rev === INK_REV_BIG ? bigRun : rev === INK_REV_CLOVER ? cloverRun : rev === INK_REV_STD ? stdRun : rev === INK_REV_SPREAD ? spreadRun : rev === INK_REV_EXPAND ? expandRun : rev === INK_REV_STRICT ? strictRun : rev === INK_REV_TARGET ? targetRun : rev === INK_REV_TUNEC ? tunecRun : rev === INK_REV_BAND ? bandRun : rev === INK_REV4 ? rev4Run : rev === INK_REV3 ? rev3Run : rev === INK_REV ? birdsRun : run;
  const result = picked.replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    levels: s.levels,
    total: INK_LEVELS,
    fails: s.fails,
    rev: rev ?? null,
    stars: s.stars ?? 0,
    starLevels: s.list.filter((l) => l.star).length,
    tricks: s.tricks ?? 0,
    cloudLevels: s.list.filter((l) => l.clouds?.length).length,
    silver: s.silver ?? 0,
    silverTotal: s.list.reduce((sum, l) => sum + (l.silver?.length ?? 0), 0),
    shamrock: s.shamrocks ?? 0,
    cloverTotal: inkClover(rev) ? s.list.filter((l) => l.shamrock).length : 0,
    parLevels: s.parLevels ?? 0,
    inkPar: s.inkPar ?? 0,
  };
}
