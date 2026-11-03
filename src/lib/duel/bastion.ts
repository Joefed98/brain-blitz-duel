/**
 * Bastion round plumbing: the server replays with the STORED seed (and revision) and keeps its own score.
 *
 * Unstamped puzzles are the original Bastion (the shapes turret, src/lib/arcade/bastion.ts) and replay exactly as
 * before through `replayBastionRun`; `bastionRev 2` (1 Nov 2026) is the tank-defence shooter
 * (src/lib/arcade/bastionTank.ts) through `replayBastionTankRun`; `bastionRev 3` (3 Nov 2026, Iron Wall: eased waves 4–5,
 * a wider green zone, the drones) through the same call with the stored stamp.
 */

import {
  basCheckpoint,
  basDestroyed,
  bastionGame,
  BAS_CHECKPOINT_INTERVAL,
  BAS_CHECKPOINT_KEYS,
  type BasCheckpoint,
  type BasState,
} from "@/lib/arcade/bastion";
import {
  bastionPlan,
  bastionStdParts,
  bastionTankCheckpoint,
  bastionIronGame,
  bastionTankGame,
  BASTION_REV_TANK,
  BT2_CHECKPOINT_INTERVAL,
  BT2_CHECKPOINT_KEYS,
  type BastionTankState,
  type Bt2Checkpoint,
} from "@/lib/arcade/bastionTank";
import type { StdPart } from "@/lib/arcade/arcadeStandard";
import { makeArcadeRun, type FlatRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<BasState, BasCheckpoint>({
  tag: "bastion",
  game: bastionGame,
  checkpoint: basCheckpoint,
  keys: BAS_CHECKPOINT_KEYS,
  interval: BAS_CHECKPOINT_INTERVAL,
});

const tankRun = makeArcadeRun<BastionTankState, Bt2Checkpoint>({
  tag: "bastion",
  game: bastionTankGame,
  checkpoint: bastionTankCheckpoint,
  keys: BT2_CHECKPOINT_KEYS,
  interval: BT2_CHECKPOINT_INTERVAL,
});

const ironRun = makeArcadeRun<BastionTankState, Bt2Checkpoint>({
  tag: "bastion",
  game: bastionIronGame,
  checkpoint: bastionTankCheckpoint,
  keys: BT2_CHECKPOINT_KEYS,
  interval: BT2_CHECKPOINT_INTERVAL,
});

export type BastionRun = FlatRun<BasCheckpoint>;

export interface BastionResult extends FlatReplay<BasState, BasCheckpoint> {
  destroyed: number;
  health: number;
  survived: boolean;
}

export const encodeBastionRun = run.encode;
export const decodeBastionRun = run.decode;

/** The single place an original (unstamped) Bastion score is worked out. */
export function replayBastionRun(seed: number, raw: string): BastionResult {
  const result = run.replay(seed, raw);
  const s = result.state;
  return { ...result, destroyed: basDestroyed(s), health: s.health, survived: s.ended !== 2 };
}

/* ------------------------------------------------------------ bastionRev 2 */

export interface BastionTankResult extends FlatReplay<BastionTankState, Bt2Checkpoint> {
  /** Hit points destroyed, tanks destroyed, weak-spot hits, fast reloads, jams, shots, hits and the base left. */
  destroyedHp: number;
  kills: number;
  weak: number;
  fast: number;
  jams: number;
  shots: number;
  hits: number;
  base: number;
  /** Drones shot down (bastionRev 3; 0 on rev 2). */
  drones: number;
  /** The wave reached (1–5) and whether the base fell. */
  wave: number;
  fell: boolean;
  std: true;
  parts: StdPart[];
}

export const encodeBastionTankRun = tankRun.encode;
export const decodeBastionTankRun = tankRun.decode;

/** Is this puzzle the tank game (bastionRev 2)? */
export function isBastionTank(rev?: number | null): boolean {
  return (rev ?? 1) >= BASTION_REV_TANK;
}

/** The single place a bastionRev 2 or 3 score is worked out (`rev` the stored stamp; rev 2 when absent). */
export function replayBastionTankRun(seed: number, raw: string, rev?: number | null): BastionTankResult {
  const result = ((rev ?? BASTION_REV_TANK) >= BASTION_REV_TANK + 1 ? ironRun : tankRun).replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    destroyedHp: s.destroyedHp,
    kills: s.kills,
    weak: s.weak,
    fast: s.fast,
    jams: s.jams,
    shots: s.shots,
    hits: s.hits,
    base: s.base,
    drones: s.drones ?? 0,
    wave: waveOf(s),
    fell: s.ended === 2,
    std: true,
    parts: bastionStdParts(s) ?? [],
  };
}

/** The wave reached (1-based): the wave of the last tank that rolled on. */
function waveOf(s: BastionTankState): number {
  return s.nextSpawn === 0 ? 1 : (bastionPlan(s.seed)[s.nextSpawn - 1]?.wave ?? 0) + 1;
}
