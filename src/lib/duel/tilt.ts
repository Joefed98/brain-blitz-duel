/** Tilt round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  tiltCheckpoint,
  tiltGame,
  tiltRev2Game,
  tiltBandGame,
  tiltTunecGame,
  tiltTargetGame,
  TILT_REV_TUNEC,
  TILT_REV_TARGET,
  TILT_REV_BAND,
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
/** tiltRev 3: rev-2 play on the Oct 2026 score bands. */
/** tiltRev 4 (Tuning C): amber start away from its cup, stars at the holes' mouths. */
const runTunec = makeArcadeRun<TiltState, TiltCheckpoint>({
  tag: "tilt",
  game: tiltTunecGame,
  checkpoint: tiltCheckpoint,
  keys: TILT_CHECKPOINT_KEYS,
  interval: TILT_CHECKPOINT_INTERVAL,
});
/** tiltRev 5 (scoring targets): tiltRev 4 play on the lifted curve. */
const runTarget = makeArcadeRun<TiltState, TiltCheckpoint>({
  tag: "tilt",
  game: tiltTargetGame,
  checkpoint: tiltCheckpoint,
  keys: TILT_CHECKPOINT_KEYS,
  interval: TILT_CHECKPOINT_INTERVAL,
});
const runBand = makeArcadeRun<TiltState, TiltCheckpoint>({
  tag: "tilt",
  game: tiltBandGame,
  checkpoint: tiltCheckpoint,
  keys: TILT_CHECKPOINT_KEYS,
  interval: TILT_CHECKPOINT_INTERVAL,
});

export type TiltResult = FlatReplay<TiltState, TiltCheckpoint> & ReturnType<typeof tiltExtra>;

export const encodeTiltRun = run.encode;
export const decodeTiltRun = run.decode;

/** The single place a Tilt score is worked out. */
export function replayTiltRun(seed: number, raw: string, rev?: number | null): TiltResult {
  const result = (rev === TILT_REV_TARGET ? runTarget : rev === TILT_REV_TUNEC ? runTunec : rev === TILT_REV_BAND ? runBand : rev === TILT_REV ? runRev2 : run).replay(seed, raw);
  return { ...result, ...tiltExtra(result.state) };
}
