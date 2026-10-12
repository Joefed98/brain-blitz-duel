/** Junction round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  juncCheckpoint,
  junctionGame,
  junctionRev2Game,
  JUNC_REV,
  JUNC_REV_BAND,
  junctionGameFor,
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

/** junctionRev 2 replays on its own game object (same encoding, lights 0–7). */
const runRev2 = makeArcadeRun<JuncState, JuncCheckpoint>({
  tag: "junction",
  game: junctionRev2Game,
  checkpoint: juncCheckpoint,
  keys: JUNC_CHECKPOINT_KEYS,
  interval: JUNC_CHECKPOINT_INTERVAL,
});
/** Oct 2026 score-band revision. */
const runBand = makeArcadeRun<JuncState, JuncCheckpoint>({
  tag: "junction",
  game: junctionGameFor(JUNC_REV_BAND),
  checkpoint: juncCheckpoint,
  keys: JUNC_CHECKPOINT_KEYS,
  interval: JUNC_CHECKPOINT_INTERVAL,
});

export interface JunctionResult extends FlatReplay<JuncState, JuncCheckpoint> {
  cleared: number;
  gaveUp: number;
  ambThrough: number;
  ambStopped: number;
  total: number;
  /** junctionRev 2: buses and diagonal-road cars cleared (0 on original rounds). */
  busCleared: number;
  diagCleared: number;
  survived: boolean;
  survivedSeconds: number;
}

export const encodeJunctionRun = run.encode;
export const decodeJunctionRun = run.decode;

/** The single place a Junction score is worked out. */
export function replayJunctionRun(seed: number, raw: string, rev?: number | null): JunctionResult {
  const result = (rev === JUNC_REV_BAND ? runBand : rev === JUNC_REV ? runRev2 : run).replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    cleared: s.cleared,
    gaveUp: s.gaveUp,
    ambThrough: s.ambThrough,
    ambStopped: s.ambStopped,
    total: s.arrivals.filter((a) => !a.amb).length,
    busCleared: s.busCleared ?? 0,
    diagCleared: s.diagCleared ?? 0,
    survived: s.ended !== 2,
    survivedSeconds: s.tick / 60,
  };
}
