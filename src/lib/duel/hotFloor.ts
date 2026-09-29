/** HotFloor round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  hotfloorCheckpoint,
  hotFloorGame,
  HOTFLOOR_CHECKPOINT_INTERVAL,
  HOTFLOOR_CHECKPOINT_KEYS,
  hotfloorExtra,
  type HotFloorCheckpoint,
  type HotFloorState,
} from "@/lib/arcade/hotFloor";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<HotFloorState, HotFloorCheckpoint>({
  tag: "hotfloor",
  game: hotFloorGame,
  checkpoint: hotfloorCheckpoint,
  keys: HOTFLOOR_CHECKPOINT_KEYS,
  interval: HOTFLOOR_CHECKPOINT_INTERVAL,
});

export type HotFloorResult = FlatReplay<HotFloorState, HotFloorCheckpoint> & ReturnType<typeof hotfloorExtra>;

export const encodeHotFloorRun = run.encode;
export const decodeHotFloorRun = run.decode;

/** The single place a HotFloor score is worked out. */
export function replayHotFloorRun(seed: number, raw: string): HotFloorResult {
  const result = run.replay(seed, raw);
  return { ...result, ...hotfloorExtra(result.state) };
}
