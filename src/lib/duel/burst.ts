/** Burst round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  burstCheckpoint,
  burstGame,
  burstGameFor,
  BURST_REV,
  BURST_REV_BAND,
  BURST_CHECKPOINT_INTERVAL,
  BURST_CHECKPOINT_KEYS,
  BURST_LIVES,
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

const runV2 = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});
/** Oct 2026 score-band revision. */
const runBand = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV_BAND),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});

export interface BurstResult extends FlatReplay<BurstState, BurstCheckpoint> {
  wave: number;
  hits: number;
  cleared: number;
  lives: number;
  livesLost: number;
  survived: boolean;
  survivedSeconds: number;
  /** burstRev 2: FREEZE icons caught (0 on original rounds). */
  freezes: number;
}

export const encodeBurstRun = run.encode;
export const decodeBurstRun = run.decode;

/** The single place a Burst score is worked out. */
export function replayBurstRun(seed: number, raw: string, rev?: number | null): BurstResult {
  const result = (rev === BURST_REV_BAND ? runBand : rev === BURST_REV ? runV2 : run).replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    wave: s.wave,
    hits: s.hits,
    cleared: s.cleared,
    lives: s.lives,
    livesLost: BURST_LIVES - s.lives,
    survived: s.ended !== 2,
    survivedSeconds: s.tick / 60,
    freezes: s.freezes ?? 0,
  };
}
