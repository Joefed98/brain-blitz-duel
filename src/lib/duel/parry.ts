/** Parry round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  parryCheckpoint,
  parryGame,
  PARRY_CHECKPOINT_INTERVAL,
  PARRY_CHECKPOINT_KEYS,
  type ParryCheckpoint,
  type ParryState,
} from "@/lib/arcade/parry";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<ParryState, ParryCheckpoint>({
  tag: "parry",
  game: parryGame,
  checkpoint: parryCheckpoint,
  keys: PARRY_CHECKPOINT_KEYS,
  interval: PARRY_CHECKPOINT_INTERVAL,
});

export interface ParryResult extends FlatReplay<ParryState, ParryCheckpoint> {
  deflected: number;
  hits: number;
  total: number;
  survived: boolean;
  survivedSeconds: number;
}

export const encodeParryRun = run.encode;
export const decodeParryRun = run.decode;

/** The single place a Parry score is worked out. */
export function replayParryRun(seed: number, raw: string): ParryResult {
  const result = run.replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    deflected: s.deflected,
    hits: s.hits,
    total: s.arrows.length,
    survived: s.ended !== 2,
    survivedSeconds: s.tick / 60,
  };
}
