/**
 * D3 (the polish plan's difficulty session for Speed and Attention, 22 Nov 2026; docs/polish-plan-final/difficulty-spec.md
 * "Speed and Attention"), the Attention half's stamps. Shared by phone and server, pure.
 *
 *  - Labyrinth's Normal scoring stamp, `mazeRev 6` (Joe's approval, 22 Nov 2026): mazeRev 5's maze, play, par and
 *    unfinished credit, with speed full by MAZE_D3_FULL_BY_S (34 s) instead of the stricter par stamp's 32 s: a
 *    realistic elite under the human limits traces a Normal maze cleanly in 30–38 s (about 0.25 s a square), so on 32 s
 *    it reaches 200 on about one maze in five and on 34 s about one in two, which leaves the levels room above and below.
 *  - The Attention levels' second table, `levelRev 2` on level deals: each level's row is read from the table it was
 *    dealt on (attentionLevels.data.ts: the `*_REV1` tables for a level deal without the stamp, so every level round
 *    dealt before D3 grades exactly as it did).
 *
 * Every older stamp deals, grades and reads exactly as before. Checks written for mazeRev 5 pin new deals to it with
 * `pinPreD3Maze(true)`.
 */
import { dealPinned, setDealPin } from "./dealEra";
import type { PuzzleData } from "./types";

/** Labyrinth's Normal scoring stamp (speed full by 34 s). */
export const MAZE_REV_D3 = 6;
/** The stricter par stamp it is dealt over (parMoves.ts MAZE_REV_STRICT). */
const MAZE_REV_BEFORE_D3 = 5;
/** mazeRev 6's speed full-by on Normal, in seconds. */
export const MAZE_D3_FULL_BY_S = 34;

/** Checks written for mazeRev 5 deal it (returns the previous setting). */
export function pinPreD3Maze(on: boolean): boolean {
  // The help text follows it: setDealPin rebuilds the live texts (dealEra.ts, `texts: true`).
  return setDealPin("preD3Maze", on);
}

/** True while new Labyrinth rounds are dealt mazeRev 6 (the help text describes it). */
export function d3MazeDealt(): boolean {
  return !dealPinned("preD3Maze");
}

/** True for a stored Labyrinth puzzle on mazeRev 6 or later. */
export function usesMazeD3(puzzle: unknown): boolean {
  const p = puzzle as { type?: string; mazeRev?: number } | null;
  return p?.type === "maze" && typeof p.mazeRev === "number" && p.mazeRev >= MAZE_REV_D3;
}

/** The deal layer: a Labyrinth dealt mazeRev 5 moves up to mazeRev 6 (any other puzzle, or with the pin, unchanged). */
export function dealD3Maze<T extends PuzzleData>(puzzle: T): T {
  if (dealPinned("preD3Maze") || puzzle.type !== "maze") return puzzle;
  if ((puzzle as { mazeRev?: number }).mazeRev !== MAZE_REV_BEFORE_D3) return puzzle;
  return { ...puzzle, mazeRev: MAZE_REV_D3 };
}

/** The Attention levels' second table: stamped `levelRev: 2` on every level deal from D3 on. */
export const ATTENTION_LEVEL_REV = 2;

/** The level table revision a stored puzzle was dealt on (1 for every puzzle without the stamp). */
export function attentionLevelRevOf(puzzle: unknown): number {
  const v = (puzzle as { levelRev?: unknown } | null)?.levelRev;
  return typeof v === "number" && Number.isFinite(v) ? v : 1;
}
