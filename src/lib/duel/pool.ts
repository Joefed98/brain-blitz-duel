/**
 * Speed Pool round plumbing: the phone sends the seed it played, its shots (one event each, on the sim tick it
 * applied), the tick it reached and its checkpoints; the server replays them on the STORED seed and keeps its own score
 * (sportsKit.ts).
 */
import { poolCheckpoint, poolGameFor, POOL_RUN_TICKS, type PoolState } from "@/lib/arcade/pool";
import { decodeSportsRun, encodeSportsRun, replaySportsRun, type SportsResult, type SportsRun } from "@/lib/arcade/sportsKit";

export const encodePoolRun = (run: SportsRun): string => encodeSportsRun(run);
export const decodePoolRun = (raw: string): SportsRun => decodeSportsRun(raw, POOL_RUN_TICKS);

export interface PoolResult extends SportsResult<PoolState> {
  /** Spots potted (of 7), the black potted legally, fouls, scratches, shots and the best run of pots. */
  spots: number;
  black: boolean;
  blackEarly: boolean;
  fouls: number;
  scratches: number;
  shots: number;
  streakBest: number;
  perfect: boolean;
}

/** The single place a Speed Pool score is worked out. */
export function replayPoolRun(seed: number, raw: string, rev?: number | null): PoolResult {
  const run = replaySportsRun("pool", poolGameFor(rev), poolCheckpoint, seed, raw);
  const s = run.state;
  return {
    ...run,
    spots: s.spotsDown,
    black: s.black === 1,
    blackEarly: s.black === 2,
    fouls: s.fouls,
    scratches: s.scratches,
    shots: s.shots,
    streakBest: s.streakBest,
    perfect: run.score >= 200,
  };
}
