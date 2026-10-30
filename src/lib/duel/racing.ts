/** Racing round plumbing: the server replays with the STORED seed and keeps its own score (racingRev 1). */

import {
  racingCheckpoint,
  racingGameFor,
  racingStdParts,
  RACING_CHECKPOINT_INTERVAL,
  RACING_CHECKPOINT_KEYS,
  RACING_SECTORS,
  RACING_TOTAL,
  type RacingCheckpoint,
  type RacingState,
} from "@/lib/arcade/racing";
import type { StdPart } from "@/lib/arcade/arcadeStandard";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<RacingState, RacingCheckpoint>({
  tag: "racing",
  game: racingGameFor(1),
  checkpoint: racingCheckpoint,
  keys: RACING_CHECKPOINT_KEYS,
  interval: RACING_CHECKPOINT_INTERVAL,
});

export interface RacingResult extends FlatReplay<RacingState, RacingCheckpoint> {
  /** Both laps completed, and on which tick (0 when not). */
  finished: boolean;
  finishTick: number;
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

export const encodeRacingRun = run.encode;
export const decodeRacingRun = run.decode;

/** The single place a Racing score is worked out. */
export function replayRacingRun(seed: number, raw: string, _rev?: number | null): RacingResult {
  const result = run.replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    finished: s.finishTick > 0,
    finishTick: s.finishTick,
    distancePermille: Math.floor((Math.min(s.s, RACING_TOTAL) * 1000) / RACING_TOTAL),
    clean: s.clean,
    sectors: RACING_SECTORS,
    offTicks: s.offTicks,
    wallHits: s.wallHits,
    std: true,
    parts: racingStdParts(s) ?? [],
  };
}
