/** Junction round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  juncCheckpoint,
  junctionGame,
  JUNC_CHECKPOINT_INTERVAL,
  JUNC_CHECKPOINT_KEYS,
  type JuncCheckpoint,
  type JuncState,
} from "@/lib/arcade/junction";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<JuncState, JuncCheckpoint>({
  tag: "junction",
  game: junctionGame,
  checkpoint: juncCheckpoint,
  keys: JUNC_CHECKPOINT_KEYS,
  interval: JUNC_CHECKPOINT_INTERVAL,
});

export interface JunctionResult extends FlatReplay<JuncState, JuncCheckpoint> {
  cleared: number;
  gaveUp: number;
  total: number;
  survived: boolean;
  survivedSeconds: number;
}

export const encodeJunctionRun = run.encode;
export const decodeJunctionRun = run.decode;

/** The single place a Junction score is worked out. */
export function replayJunctionRun(seed: number, raw: string): JunctionResult {
  const result = run.replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    cleared: s.cleared,
    gaveUp: s.gaveUp,
    total: s.arrivals.length,
    survived: s.ended !== 2,
    survivedSeconds: s.tick / 60,
  };
}
