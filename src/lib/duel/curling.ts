/**
 * Curling round plumbing. The phone sends the seed it played, its throws and sweep strokes with the sim tick each
 * applied on, the tick it reached and the score it believes it earned; the server replays with the STORED seed
 * (sportsKit.replaySportsRun), validates every payload against the game's declared ranges, and keeps its own score.
 */
import {
  curlingCheckpoint,
  curlingGameFor,
  curlingStdParts,
  curlShotTeam,
  curlTakeouts,
  CURLING_REV_V1,
  CURLING_RUN_TICKS,
  CURL_STONE_PTS,
  TEAM_MINE,
  type CurlingState,
} from "@/lib/arcade/curling";
import { decodeSportsRun, encodeSportsRun, replaySportsRun, type SportsResult, type SportsRun } from "@/lib/arcade/sportsKit";

export const encodeCurlingRun = (run: SportsRun): string => encodeSportsRun(run);
export const decodeCurlingRun = (raw: string): SportsRun => decodeSportsRun(raw, CURLING_RUN_TICKS);

export interface CurlingResult extends SportsResult<CurlingState> {
  thrown: number;
  /** Stones that came to rest on the button / in the 4-foot when thrown. */
  onButton: number;
  inFourFoot: number;
  /** The opponent's stones out of the house at the end, of how many. */
  takeouts: number;
  opponents: number;
  holding: boolean;
  /** Every part at its maximum (200). */
  perfect: boolean;
}

/**
 * The single place a Curling score is worked out, on the stored curlRev (1: every stone from the centre line, sweeping
 * runs further and curls less; 2: the start along the hog line and side brushing). A round with no stamp is curlRev 1.
 */
export function replayCurlingRun(seed: number, raw: string, rev?: number | null): CurlingResult {
  const run = replaySportsRun("curling", curlingGameFor(rev ?? CURLING_REV_V1), curlingCheckpoint, seed, raw);
  const s = run.state;
  const parts = curlingStdParts(s) ?? [];
  return {
    ...run,
    thrown: s.thrown,
    onButton: s.pts.filter((p) => p === CURL_STONE_PTS).length,
    inFourFoot: s.four.reduce((a, p) => a + p, 0),
    takeouts: curlTakeouts(s),
    opponents: s.theirs,
    holding: s.acted === 1 && curlShotTeam(s) === TEAM_MINE,
    perfect: parts.length > 0 && parts.every((p) => p.points === p.max),
  };
}

export { CURLING_RUN_TICKS };
