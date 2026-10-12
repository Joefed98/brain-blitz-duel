/** Ink Bridge round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  inkBridgeGame,
  inkBridgeBirdsGame,
  inkBridgeInkRev3Game,
  inkBridgeInkRev4Game,
  INK_REV,
  INK_REV_BAND,
  INK_REV_TUNEC,
  inkBridgeGameFor,
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

export interface InkBridgeResult extends FlatReplay<InkState, InkCheckpoint> {
  levels: number;
  total: number;
  fails: number;
  rev?: number | null;
  /** Rev 4: gold stars potted and levels with a star (0 on older rounds). */
  stars: number;
  starLevels: number;
}

export const encodeInkBridgeRun = run.encode;
export const decodeInkBridgeRun = run.decode;

/** The single place an Ink Bridge score is worked out. */
export function replayInkBridgeRun(seed: number, raw: string, rev?: number | null): InkBridgeResult {
  const picked = rev === INK_REV_TUNEC ? tunecRun : rev === INK_REV_BAND ? bandRun : rev === INK_REV4 ? rev4Run : rev === INK_REV3 ? rev3Run : rev === INK_REV ? birdsRun : run;
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
  };
}
