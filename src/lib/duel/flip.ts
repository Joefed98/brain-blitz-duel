/** Flip round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  flipCheckpoint,
  flipGame,
  FLIP_CHECKPOINT_INTERVAL,
  FLIP_CHECKPOINT_KEYS,
  type FlipCheckpoint,
  type FlipState,
} from "@/lib/arcade/flip";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<FlipState, FlipCheckpoint>({
  tag: "flip",
  game: flipGame,
  checkpoint: flipCheckpoint,
  keys: FLIP_CHECKPOINT_KEYS,
  interval: FLIP_CHECKPOINT_INTERVAL,
});

export interface FlipResult extends FlatReplay<FlipState, FlipCheckpoint> {
  survived: boolean;
  survivedSeconds: number;
}

export const encodeFlipRun = run.encode;
export const decodeFlipRun = run.decode;

/** The single place a Flip score is worked out. */
export function replayFlipRun(seed: number, raw: string): FlipResult {
  const result = run.replay(seed, raw);
  const s = result.state;
  return { ...result, survived: s.ended !== 2, survivedSeconds: s.tick / 60 };
}
