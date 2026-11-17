/**
 * Minigolf round plumbing: the phone sends the seed it played, its putts (one event each, on the sim tick it applied),
 * the tick it reached and its checkpoints; the server replays them on the STORED seed and pars and keeps its own
 * score (sportsKit.ts).
 */
import { minigolfCheckpoint, minigolfGameFor, minigolfStrokes, mgLevelOf, MG_AIM as MG_AIM_PHASE, MG_DONE as MG_DONE_PHASE, MG_PAUSE as MG_PAUSE_PHASE, MG_ROLL as MG_ROLL_PHASE, MINIGOLF_HOLES, MINIGOLF_RUN_TICKS, type MgLevel, type MinigolfState } from "@/lib/arcade/minigolf";
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

/** One stroke as the reveal draws it (world px): its kind, the path it rolled (and flew), where it ended. */
export interface MinigolfStroke {
  kind: "putt" | "chip";
  path: { x: number; y: number; air: boolean }[];
  end: { x: number; y: number };
  water: boolean;
  holed: boolean;
  sand: boolean;
}
export interface MinigolfHoleTrace {
  strokes: MinigolfStroke[];
}

/**
 * The reveal's trace of a run (display only, the redesigned reveal, 15 Nov 2026): the stored answer replayed on the
 * stored puzzle tick by tick, every stroke's path (a point every other tick), where it ended, whether it found water or
 * sand or dropped. Reads the same game as the grader, so it draws exactly the run that was scored.
 */
export function minigolfShotTrace(p: Pick<MinigolfPuzzleData, "seed" | "pars" | "golfRev" | "holes" | "level">, raw: string): { state: MinigolfState; holes: MinigolfHoleTrace[] } {
  const game = minigolfGameForPuzzle(p);
  const run = decodeSportsRun(raw ?? "", game.runTicks);
  const events = new Map(run.events.map((e) => [e.t, e]));
  const endTick = (run.endTick ?? 0) > 0 ? Math.min(run.endTick!, game.runTicks) : game.runTicks;
  let s = game.init(p.seed);
  const holes: MinigolfHoleTrace[] = Array.from({ length: MINIGOLF_HOLES }, () => ({ strokes: [] }));
  let cur: MinigolfStroke | null = null;
  let curHole = 0;
  const px = (v: number) => v / 256;
  for (let t = 1; t <= endTick && !game.isOver(s); t++) {
    const prev: MinigolfState = s;
    s = game.step(s, events.get(t) ?? null);
    if (prev.phase === MG_AIM_PHASE && s.phase === MG_ROLL_PHASE) {
      cur = { kind: s.shot === 2 ? "chip" : "putt", path: [{ x: px(prev.x), y: px(prev.y), air: false }], end: { x: px(prev.x), y: px(prev.y) }, water: false, holed: false, sand: false };
      curHole = s.hole;
      holes[curHole]!.strokes.push(cur);
    }
    if (!cur) continue;
    if (s.phase === MG_ROLL_PHASE) {
      if (t % 2 === 0) cur.path.push({ x: px(s.x), y: px(s.y), air: s.air > 0 });
      if (s.sandStops > prev.sandStops) cur.sand = true;
      continue;
    }
    // The stroke ended this tick.
    if (s.waters > prev.waters) {
      cur.water = true;
      cur.end = { x: px(prev.x), y: px(prev.y) };
    } else if (s.holed[curHole] && !prev.holed[curHole]) {
      cur.holed = true;
      const h = s.course[curHole]!;
      cur.end = { x: px(h.cup.x), y: px(h.cup.y) };
    } else cur.end = { x: px(s.phase === MG_PAUSE_PHASE || s.phase === MG_DONE_PHASE ? prev.x : s.x), y: px(s.phase === MG_PAUSE_PHASE || s.phase === MG_DONE_PHASE ? prev.y : s.y) };
    cur.path.push({ ...cur.end, air: false });
    cur = null;
  }
  return { state: s, holes };
}
