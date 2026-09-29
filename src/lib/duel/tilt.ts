/** Tilt round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  tiltCheckpoint,
  tiltGame,
  TILT_CHECKPOINT_INTERVAL,
  TILT_CHECKPOINT_KEYS,
  tiltExtra,
  type TiltCheckpoint,
  type TiltState,
} from "@/lib/arcade/tilt";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<TiltState, TiltCheckpoint>({
  tag: "tilt",
  game: tiltGame,
  checkpoint: tiltCheckpoint,
  keys: TILT_CHECKPOINT_KEYS,
  interval: TILT_CHECKPOINT_INTERVAL,
});

export type TiltResult = FlatReplay<TiltState, TiltCheckpoint> & ReturnType<typeof tiltExtra>;

export const encodeTiltRun = run.encode;
export const decodeTiltRun = run.decode;

/** The single place a Tilt score is worked out. */
export function replayTiltRun(seed: number, raw: string): TiltResult {
  const result = run.replay(seed, raw);
  return { ...result, ...tiltExtra(result.state) };
}
