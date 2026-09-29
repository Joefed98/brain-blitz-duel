/** Rooftop Run round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  roofCheckpoint,
  rooftopGame,
  ROOF_CHECKPOINT_INTERVAL,
  ROOF_CHECKPOINT_KEYS,
  type RoofCheckpoint,
  type RoofState,
} from "@/lib/arcade/rooftop";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<RoofState, RoofCheckpoint>({
  tag: "rooftop",
  game: rooftopGame,
  checkpoint: roofCheckpoint,
  keys: ROOF_CHECKPOINT_KEYS,
  interval: ROOF_CHECKPOINT_INTERVAL,
});

export interface RooftopResult extends FlatReplay<RoofState, RoofCheckpoint> {
  survived: boolean;
  survivedSeconds: number;
}

export const encodeRooftopRun = run.encode;
export const decodeRooftopRun = run.decode;

/** The single place a Rooftop Run score is worked out. */
export function replayRooftopRun(seed: number, raw: string): RooftopResult {
  const result = run.replay(seed, raw);
  const s = result.state;
  return { ...result, survived: s.ended !== 2, survivedSeconds: s.tick / 60 };
}
