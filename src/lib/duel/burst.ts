/** Burst round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  burstCheckpoint,
  burstGame,
  BURST_CHECKPOINT_INTERVAL,
  BURST_CHECKPOINT_KEYS,
  type BurstCheckpoint,
  type BurstState,
} from "@/lib/arcade/burst";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGame,
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});

export interface BurstResult extends FlatReplay<BurstState, BurstCheckpoint> {
  wave: number;
  points: number;
  cleared: number;
  lives: number;
  survived: boolean;
  survivedSeconds: number;
}

export const encodeBurstRun = run.encode;
export const decodeBurstRun = run.decode;

/** The single place a Burst score is worked out. */
export function replayBurstRun(seed: number, raw: string): BurstResult {
  const result = run.replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    wave: s.wave,
    points: s.points,
    cleared: s.cleared,
    lives: s.lives,
    survived: s.ended !== 2,
    survivedSeconds: s.tick / 60,
  };
}
