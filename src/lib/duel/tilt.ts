/** Tilt round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  tiltCheckpoint,
  tiltGame,
  tiltRev2Game,
  TILT_REV,
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

/** tiltRev 2 replays on its own game object (same encoding). */
const runRev2 = makeArcadeRun<TiltState, TiltCheckpoint>({
  tag: "tilt",
  game: tiltRev2Game,
  checkpoint: tiltCheckpoint,
  keys: TILT_CHECKPOINT_KEYS,
  interval: TILT_CHECKPOINT_INTERVAL,
});

export type TiltResult = FlatReplay<TiltState, TiltCheckpoint> & ReturnType<typeof tiltExtra>;

export const encodeTiltRun = run.encode;
export const decodeTiltRun = run.decode;

/** The single place a Tilt score is worked out. */
export function replayTiltRun(seed: number, raw: string, rev?: number | null): TiltResult {
  const result = (rev === TILT_REV ? runRev2 : run).replay(seed, raw);
  return { ...result, ...tiltExtra(result.state) };
}
