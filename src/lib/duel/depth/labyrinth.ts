/**
 * Labyrinth depth to 200 (25 Oct 2026, `mazeRev: 1`; docs/depth/d3-speed-attention.md). Shared by the phone and the
 * server.
 *
 *   - A bigger maze: 19 columns (the same corridor width as before) by 23 rows, drawn in the same board box (the
 *     cells are a little shorter), so there are about a fifth more corridors. The route from start to exit keeps
 *     today's length (the generator turns down longer ones), so the extra corridors are side branches.
 *   - Detour stars: LAB_STARS stars on side branches off the route, LAB_STAR_DEPTH_MIN–MAX cells in. Taking one costs
 *     the walk in and back out; a star counts once the ball has rolled over it and the maze is finished.
 *   - The answer is the whole trail (every step the ball took, backtracks included, one letter a step after
 *     LAB_TRAIL_PREFIX: U, D, L, R), so the server sees every star the ball reached; the drawn route is the trail
 *     with its backtracks folded away (`mazeTrailRoute`).
 *
 * Score: unfinished exactly as puzzleScoreRev 3 (up to 110 for progress; stars count only with a finish). A finish
 * is puzzleScoreRev 3's 120 + up to 30 for speed (150 with 48 % of the clock left), plus each star taken
 * LAB_STAR_POINTS × the time left share's place between LAB_STAR_ZERO_SHARE and LAB_STAR_FAST_SHARE: all three with an
 * elite-pace finish is the 200 top.
 * Without stars the most is 150, as before. Older mazes (no `mazeRev`) keep their 19 × 19 board, path answer and
 * grading.
 */
import { mazeOpen } from "../maze";
import type { MazePuzzleData } from "../types";

export const MAZE_REV_DEPTH = 1;
/**
 * mazeRev 2 (27 Oct 2026, Joe's phone notes; phoneNotes.ts): mazeRev 1's board, trail answer and scoring, with the
 * three stars anywhere the ball can reach (on the route or off it), one in each third of the route as before.
 */
export const MAZE_REV_NOTES = 2;
export const LAB_COLS = 19;
export const LAB_ROWS = 23;
export const LAB_CELLS = LAB_COLS * LAB_ROWS;
export const LAB_STARS = 3;
/** A star sits this many cells into a side branch (a detour of twice that). */
export const LAB_STAR_DEPTH_MIN = 3;
export const LAB_STAR_DEPTH_MAX = 6;
/** The route is never longer than this (today's 90th percentile), so a run takes the time it did. */
export const LAB_ROUTE_MAX = 147;
/** Each star's full worth: three of them make the 50 above 150. */
export const LAB_STAR_POINTS = [17, 17, 16] as const;
/**
 * A star keeps its full worth with at least this share of the clock left at the finish (about 23 s used, stars
 * included: elite pace), falling evenly to nothing at LAB_STAR_ZERO_SHARE (about 33 s used), so stars pay at elite
 * pace and little at near-perfect pace (tuned 26 Oct 2026, before mazeRev 1 went live; it was (left ÷ 0.68)²).
 */
export const LAB_STAR_FAST_SHARE = 0.63;
export const LAB_STAR_ZERO_SHARE = 0.45;
/** Speed share of the clock for today's 150 (puzzleScoreRev 3's Labyrinth fastShare). */
export const LAB_FAST_SHARE = 0.48;

/**
 * True for mazeRev 1 and later: the 19 × 23 board, stars and trail answer. The scoring standard's mazeRev 3 (27 Oct 2026,
 * standard/attention.ts) keeps mazeRev 2's board and play; only its score differs (the standard grader runs first).
 */
export function usesMazeDepth(puzzle: unknown): puzzle is MazePuzzleData & { mazeRev: number } {
  const p = puzzle as { type?: string; mazeRev?: number } | null;
  return p?.type === "maze" && typeof p.mazeRev === "number" && p.mazeRev >= MAZE_REV_DEPTH;
}

/** A trail answer starts with this; each following letter is one step. */
export const LAB_TRAIL_PREFIX = "t";
/** The most steps the server reads (and the phone records): far more than 60 s of play can make. */
export const LAB_TRAIL_MAX = 3_900;

/** A trail of cells (each next to the one before) as the answer string. */
export function encodeMazeTrail(trail: readonly number[], cols = LAB_COLS): string {
  let out = LAB_TRAIL_PREFIX;
  for (let i = 1; i < trail.length && out.length <= LAB_TRAIL_MAX; i++) {
    const d = trail[i]! - trail[i - 1]!;
    out += d === -cols ? "U" : d === cols ? "D" : d === -1 ? "L" : d === 1 ? "R" : "";
  }
  return out;
}

/** The trail's cells from the start; an unreadable letter or a step off the board ends it. */
export function decodeMazeTrail(raw: string, start: number, cols = LAB_COLS, size = LAB_CELLS): number[] {
  const text = String(raw ?? "");
  const trail = [start];
  if (!text.startsWith(LAB_TRAIL_PREFIX)) return trail;
  let cell = start;
  for (const ch of text.slice(LAB_TRAIL_PREFIX.length, LAB_TRAIL_PREFIX.length + LAB_TRAIL_MAX)) {
    const col = cell % cols;
    const next = ch === "U" ? cell - cols : ch === "D" ? cell + cols : ch === "L" && col > 0 ? cell - 1 : ch === "R" && col < cols - 1 ? cell + 1 : -1;
    if (next < 0 || next >= size) break;
    trail.push(next);
    cell = next;
  }
  return trail;
}

/**
 * The legal part of a trail: from the start, each step a corridor step (a step through a wall or a jump ends it, as
 * verifyMazePath does), repeated cells skipped, ending at the exit if it gets there.
 */
export function mazeTrailWalk(cells: number[], start: number, exit: number, trail: number[], cols = LAB_COLS): number[] {
  const walk: number[] = [];
  if (trail[0] !== start) return walk;
  walk.push(start);
  for (let i = 1; i < trail.length; i++) {
    const cell = trail[i]!;
    const previous = walk[walk.length - 1]!;
    if (cell === previous) continue;
    if (!mazeOpen(cells, previous, cell, cols)) break;
    walk.push(cell);
    if (cell === exit) break;
  }
  return walk;
}

/** The drawn route: the walk with every step back onto the cell before folded away (the old path answer). */
export function mazeTrailRoute(walk: readonly number[]): number[] {
  const route: number[] = [];
  for (const cell of walk) {
    if (route.length > 1 && route[route.length - 2] === cell) route.pop();
    else route.push(cell);
  }
  return route;
}

/** The stars (indices into `stars`) the walk rolled over. */
export function mazeStarsTaken(walk: readonly number[], stars: readonly number[]): number[] {
  const seen = new Set(walk);
  return stars.map((cell, i) => (seen.has(cell) ? i : -1)).filter((i) => i >= 0);
}

/** One star's points for a finish with `left` (0–1) of the clock. */
export function labStarPoints(index: number, left: number): number {
  const full = LAB_STAR_POINTS[index] ?? 0;
  const share = Math.max(0, Math.min(1, (left - LAB_STAR_ZERO_SHARE) / (LAB_STAR_FAST_SHARE - LAB_STAR_ZERO_SHARE)));
  return Math.round(full * share);
}

/** Cells walked that were steps back (backtracks), for the stage's "wasted" counter. */
export function mazeTrailBacktracks(walk: readonly number[]): number {
  return Math.max(0, walk.length - mazeTrailRoute(walk).length);
}

/* ------------------------------------------------------------------ texts (intro SCORE line and "?" help) */

/** Seconds of play that still score 150 without stars (puzzleScoreRev 3's Labyrinth pace on the 60 s clock). */
export function labFastSeconds(limitMs = 60_000): number {
  return Math.round((limitMs * (1 - LAB_FAST_SHARE)) / 1000);
}

/** Seconds of play (stars included) by which every star keeps its full worth. */
export function labStarFullSeconds(limitMs = 60_000): number {
  return Math.round((limitMs * (1 - LAB_STAR_FAST_SHARE)) / 1000);
}

/** Seconds of play (stars included) after which a star is worth nothing. */
export function labStarZeroSeconds(limitMs = 60_000): number {
  return Math.round((limitMs * (1 - LAB_STAR_ZERO_SHARE)) / 1000);
}

/** The round intro SCORE line (two phone lines at most; `{max}` is the game's maximum). */
export function labyrinthDepthIntro(): string {
  return `Finish: 120+, 150 in about ${labFastSeconds()} s. Side-path stars add up to 50 more, {max} in all.`;
}

/** The "?" help SCORE text. */
export function labyrinthDepthHelp(halfDone: number): string {
  return (
    `Progress counts: how far along the route you got (wandering costs). Unfinished scores up to 110: about ${halfDone} half done, 110 one step short; stars count only with a finish. ` +
    `Any finish scores 120 to 150: 150 if you finish in about ${labFastSeconds()} s. ` +
    `Each star you roll over adds up to ${LAB_STAR_POINTS[0]} more when you finish quickly (all of it with about ${labStarFullSeconds()} s used, stars included, falling to nothing by ${labStarZeroSeconds()} s); {max} takes all ${LAB_STARS} stars on a fast run.`
  );
}
