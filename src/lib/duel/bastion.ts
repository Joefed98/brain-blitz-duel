/** Bastion round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  basCheckpoint,
  basDestroyed,
  bastionGame,
  BAS_CHECKPOINT_INTERVAL,
  BAS_CHECKPOINT_KEYS,
  type BasCheckpoint,
  type BasState,
} from "@/lib/arcade/bastion";
import { makeArcadeRun, type FlatRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<BasState, BasCheckpoint>({
  tag: "bastion",
  game: bastionGame,
  checkpoint: basCheckpoint,
  keys: BAS_CHECKPOINT_KEYS,
  interval: BAS_CHECKPOINT_INTERVAL,
});

export type BastionRun = FlatRun<BasCheckpoint>;

export interface BastionResult extends FlatReplay<BasState, BasCheckpoint> {
  destroyed: number;
  health: number;
  survived: boolean;
}

export const encodeBastionRun = run.encode;
export const decodeBastionRun = run.decode;

/** The single place a Bastion score is worked out. */
export function replayBastionRun(seed: number, raw: string): BastionResult {
  const result = run.replay(seed, raw);
  const s = result.state;
  return { ...result, destroyed: basDestroyed(s), health: s.health, survived: s.ended !== 2 };
}
