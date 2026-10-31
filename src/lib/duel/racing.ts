/** Apex (racing) round plumbing: the server replays with the STORED seed and stamp and keeps its own score (racingRev 1 and 2). */

import {
  racingCheckpoint,
  racingGameFor,
  racingGoTick,
  racingStdParts,
  RACING_CHECKPOINT_INTERVAL,
  RACING_REV_2,
  RACING_CHECKPOINT_KEYS,
  RACING_SECTORS,
  RACING_TOTAL,
  type RacingCheckpoint,
  type RacingState,
} from "@/lib/arcade/racing";
import type { StdPart } from "@/lib/arcade/arcadeStandard";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const runFor = (rev: number) =>
  makeArcadeRun<RacingState, RacingCheckpoint>({
    tag: "racing",
    game: racingGameFor(rev),
    checkpoint: racingCheckpoint,
    keys: RACING_CHECKPOINT_KEYS,
    interval: RACING_CHECKPOINT_INTERVAL,
  });
const run = runFor(1);
/** racingRev 2: the same wire format, the lights longer (its own run length and checkpoint count). */
const runV2 = runFor(RACING_REV_2);

export interface RacingResult extends FlatReplay<RacingState, RacingCheckpoint> {
  /** Both laps completed, and on which tick (0 when not). */
  finished: boolean;
  finishTick: number;
  /** The race time of a finish in ticks (from lights out on racingRev 2; 0 when not finished). */
  raceTicks: number;
  /** Race distance in per mille (1000 = both laps). */
  distancePermille: number;
  /** Clean sectors (of RACING_SECTORS), ticks with a wheel on the grass, tyre-wall impacts. */
  clean: number;
  sectors: number;
  offTicks: number;
  wallHits: number;
  std: true;
  parts: StdPart[];
}

/** The wire format is the same on every revision. */
export const encodeRacingRun = run.encode;
export const decodeRacingRun = run.decode;

/** The single place an Apex score is worked out (unstamped = racingRev 1). */
export function replayRacingRun(seed: number, raw: string, rev?: number | null): RacingResult {
  const result = ((rev ?? 1) >= RACING_REV_2 ? runV2 : run).replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    finished: s.finishTick > 0,
    finishTick: s.finishTick,
    raceTicks: s.finishTick > 0 ? s.finishTick - racingGoTick(s.rev) : 0,
    distancePermille: Math.floor((Math.min(s.s, RACING_TOTAL) * 1000) / RACING_TOTAL),
    clean: s.clean,
    sectors: RACING_SECTORS,
    offTicks: s.offTicks,
    wallHits: s.wallHits,
    std: true,
    parts: racingStdParts(s) ?? [],
  };
}
