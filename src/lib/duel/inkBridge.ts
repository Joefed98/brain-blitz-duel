/** Ink Bridge round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  inkBridgeGame,
  inkCheckpoint,
  INK_CHECKPOINT_INTERVAL,
  INK_CHECKPOINT_KEYS,
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

export interface InkBridgeResult extends FlatReplay<InkState, InkCheckpoint> {
  caught: number;
  total: number;
}

export const encodeInkBridgeRun = run.encode;
export const decodeInkBridgeRun = run.decode;

/** The single place an Ink Bridge score is worked out. */
export function replayInkBridgeRun(seed: number, raw: string): InkBridgeResult {
  const result = run.replay(seed, raw);
  const s = result.state;
  return { ...result, caught: s.caught, total: s.drops.length };
}
