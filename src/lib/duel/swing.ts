/** Swing round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  swingCheckpoint,
  swingGame,
  swingGameFor,
  SWING_REV,
  SWING_REV_BAND,
  SWING_REV_TUNED,
  SWING_REV_TUNEC,
  SWING_REV_V2,
  SWING_REV_V3,
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

const tunecRunV7 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_TUNEC), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const tunedRunV6 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_TUNED), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const bandRunV5 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_BAND), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const chaseRunV4 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const dragonRunV3 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_V3), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const dragonRunV2 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_V2), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });

export type SwingResult = FlatReplay<SwingState, SwingCheckpoint> & ReturnType<typeof swingExtra>;

export const encodeSwingRun = run.encode;
export const decodeSwingRun = run.decode;

/** The single place a Swing score is worked out. */
export function replaySwingRun(seed: number, raw: string, rev?: number): SwingResult {
  const picked = rev === SWING_REV_TUNEC ? tunecRunV7 : rev === SWING_REV_TUNED ? tunedRunV6 : rev === SWING_REV_BAND ? bandRunV5 : rev === SWING_REV ? chaseRunV4 : rev === SWING_REV_V3 ? dragonRunV3 : rev === SWING_REV_V2 ? dragonRunV2 : run;
  const result = picked.replay(seed, raw);
  return { ...result, ...swingExtra(result.state) };
}
