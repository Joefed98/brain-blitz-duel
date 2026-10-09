/** Swing round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  swingCheckpoint,
  swingGame,
  swingGameFor,
  SWING_REV,
  SWING_CHECKPOINT_INTERVAL,
  SWING_CHECKPOINT_KEYS,
  swingExtra,
  type SwingCheckpoint,
  type SwingState,
} from "@/lib/arcade/swing";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<SwingState, SwingCheckpoint>({
  tag: "swing",
  game: swingGame,
  checkpoint: swingCheckpoint,
  keys: SWING_CHECKPOINT_KEYS,
  interval: SWING_CHECKPOINT_INTERVAL,
});

const dragonRun = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });

export type SwingResult = FlatReplay<SwingState, SwingCheckpoint> & ReturnType<typeof swingExtra>;

export const encodeSwingRun = run.encode;
export const decodeSwingRun = run.decode;

/** The single place a Swing score is worked out. */
export function replaySwingRun(seed: number, raw: string, rev?: number): SwingResult {
  const result = (rev === SWING_REV ? dragonRun : run).replay(seed, raw);
  return { ...result, ...swingExtra(result.state) };
}
