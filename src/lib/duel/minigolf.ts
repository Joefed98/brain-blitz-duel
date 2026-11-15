/**
 * Minigolf round plumbing: the phone sends the seed it played, its putts (one event each, on the sim tick it applied),
 * the tick it reached and its checkpoints; the server replays them on the STORED seed and pars and keeps its own
 * score (sportsKit.ts).
 */
import { minigolfCheckpoint, minigolfGameFor, minigolfStrokes, mgLevelOf, MINIGOLF_HOLES, MINIGOLF_RUN_TICKS, type MgLevel, type MinigolfState } from "@/lib/arcade/minigolf";
import type { MinigolfPuzzleData } from "./types";
import { decodeSportsRun, encodeSportsRun, replaySportsRun, type SportsResult, type SportsRun } from "@/lib/arcade/sportsKit";

export const encodeMinigolfRun = (run: SportsRun): string => encodeSportsRun(run);
export const decodeMinigolfRun = (raw: string): SportsRun => decodeSportsRun(raw, MINIGOLF_RUN_TICKS);

export interface MinigolfResult extends SportsResult<MinigolfState> {
  holed: number;
  holes: number;
  strokes: number;
  /** Holes at par or better, and under par. */
  pars: number;
  birdies: number;
  waters: number;
  perfect: boolean;
}

/** The single place a Minigolf score is worked out (the stored pars and golfRev ride in the puzzle; unstamped is golfRev 1). */
export function replayMinigolfRun(
  seed: number,
  raw: string,
  pars?: readonly number[] | null,
  rev?: number | null,
  course: { holes?: readonly number[] | null; level?: MgLevel | null } = {},
): MinigolfResult {
  const game = minigolfGameFor(pars ?? undefined, rev ?? 1, course);
  const run = replaySportsRun("minigolf", game, minigolfCheckpoint, seed, raw);
  const s = run.state;
  let parsN = 0;
  let birdies = 0;
  for (let i = 0; i < MINIGOLF_HOLES; i++) {
    if (!s.holed[i]) continue;
    if (s.taken[i]! <= s.pars[i]!) parsN++;
    if (s.taken[i]! < s.pars[i]!) birdies++;
  }
  const holed = s.holed.filter((v) => v === 1).length;
  return {
    ...run,
    holed,
    holes: MINIGOLF_HOLES,
    strokes: minigolfStrokes(s),
    pars: parsN,
    birdies,
    waters: s.waters,
    perfect: run.score >= 200,
  };
}

/** A stored puzzle's course for the sim: golfRev 3's hole ids and level (both absent on golfRev 1 and 2). */
export function minigolfCourseOf(p: Pick<MinigolfPuzzleData, "holes" | "level"> | null | undefined): { holes: readonly number[] | null; level: MgLevel } {
  return { holes: p?.holes ?? null, level: mgLevelOf(p?.level) };
}

/** The game a stored puzzle plays (its pars, stamp, holes and level). */
export function minigolfGameForPuzzle(p: Pick<MinigolfPuzzleData, "pars" | "golfRev" | "holes" | "level">) {
  return minigolfGameFor(p.pars, p.golfRev ?? 1, minigolfCourseOf(p));
}

/** Replays an answer on a stored puzzle (the one call the grader, reveals and replays make). */
export function replayMinigolfPuzzle(p: Pick<MinigolfPuzzleData, "seed" | "pars" | "golfRev" | "holes" | "level">, raw: string): MinigolfResult {
  return replayMinigolfRun(p.seed, raw, p.pars, p.golfRev, minigolfCourseOf(p));
}
