/** Orbit round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  orbitCheckpoint,
  orbitGame,
  ORBIT_CHECKPOINT_INTERVAL,
  ORBIT_CHECKPOINT_KEYS,
  orbitExtra,
  type OrbitCheckpoint,
  type OrbitState,
} from "@/lib/arcade/orbit";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<OrbitState, OrbitCheckpoint>({
  tag: "orbit",
  game: orbitGame,
  checkpoint: orbitCheckpoint,
  keys: ORBIT_CHECKPOINT_KEYS,
  interval: ORBIT_CHECKPOINT_INTERVAL,
});

export type OrbitResult = FlatReplay<OrbitState, OrbitCheckpoint> & ReturnType<typeof orbitExtra>;

export const encodeOrbitRun = run.encode;
export const decodeOrbitRun = run.decode;

/** The single place a Orbit score is worked out. */
export function replayOrbitRun(seed: number, raw: string): OrbitResult {
  const result = run.replay(seed, raw);
  return { ...result, ...orbitExtra(result.state) };
}
