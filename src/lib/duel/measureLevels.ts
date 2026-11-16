/**
 * Brimful's levels (Number overhaul stage 3, 15 Nov 2026; docs/number-overhaul.md "Stage 3"). Shared and pure.
 *
 * Joe's decision (15 Nov 2026, too-hard games): today's Brimful is Hard, exactly as it is dealt today; Normal is a new,
 * gentler game. Normal, Easy and Expert deal new boards (`measureLevelBoards`, measureLevels.server.ts) on a new stamp,
 * `measureRev 5` (MEASURE_REV_LEVELS): the same rules and grading as measureRev 4 (a board out of moves ends only that
 * board), with the level's boards, board count and move limits stored on the puzzle. Every older stamp (and Hard, which
 * stays measureRev 4) deals, replays and grades exactly as before.
 *
 * Every board at every new level is proven twice when it is dealt: its minimum by breadth-first search (stored, as
 * today), and that a person-like solver (`personSolve`: a person's fixed strategies, no search) reaches it within the
 * board's move limit, so every board, Expert's included, can be finished by someone who plays the textbook way.
 */
import { measureApply, measureSolved, type MeasureAction } from "./measure";
import type { MeasureBoardData } from "./types";

/** The stamp for the level boards (Normal, Easy and Expert since 15 Nov 2026). Hard stays measureRev 4. */
export const MEASURE_REV_LEVELS = 5;

/** One board of a level: its goal, jugs, whether the tap and drain are there, and its BFS-minimum band. */
export interface MeasureBoardSpec {
  goal: "amount" | "split";
  jugs: 2 | 3;
  tap: boolean;
  band: readonly [number, number];
}

/**
 * A level's settings (gameLevels.ts `measure`). `today`: deal today's game exactly (Hard). Otherwise the level's boards
 * in order and its move limit: each board's limit is the minimum × `limitFactor`, rounded up to a multiple of 5.
 */
export type MeasureLevelSettings =
  | { today: true }
  | { boards: readonly MeasureBoardSpec[]; limitFactor: number };

/**
 * Normal (15 Nov 2026): four boards, tap and drain on all, two jugs then two, two and three, minimums 3–10 rising
 * (two-jug minimums are even: 4, 4–6, 6–8, then 6–10).
 * Not in the registry (Normal has no entry): measureLevels.server.ts reads it.
 */
export const MEASURE_NORMAL: MeasureLevelSettings = {
  boards: [
    { goal: "amount", jugs: 2, tap: true, band: [3, 4] },
    { goal: "amount", jugs: 2, tap: true, band: [4, 6] },
    { goal: "amount", jugs: 2, tap: true, band: [6, 8] },
    { goal: "amount", jugs: 3, tap: true, band: [6, 10] },
  ],
  limitFactor: 4.5,
};

/** A board's move limit at a new level (shown; rounded up to 5 so it never gives the minimum away). */
export function measureLevelLimit(minMoves: number, limitFactor: number): number {
  return Math.max(5, Math.ceil((limitFactor * minMoves) / 5) * 5);
}

/** Whether a dealt puzzle carries the level boards (measureRev 5). */
export function measureLevelBoards(puzzle: { measureRev?: number } | null | undefined): boolean {
  return (puzzle?.measureRev ?? 0) >= MEASURE_REV_LEVELS;
}

/* ---------------------------------------------------------------- the person-like solver */

/**
 * The way a person plays a jug puzzle, with no search: pick a direction and keep turning the handle, watching for the
 * target after every move.
 *
 * - With a tap: choose a jug to fill and one to pour into; repeatedly fill the first when it is empty, empty the second
 *   when it is full, otherwise pour the first into the second (the textbook two-jug method; the third jug, if any,
 *   stays aside). Every ordered pair is tried.
 * - Without a tap: choose the big jug, a middle one and a last one; repeatedly pour the big jug into the middle one when
 *   it is empty, the last one back into the big jug when it is full, otherwise the middle one into the last (the
 *   textbook three-jug method). Every order is tried.
 *
 * Returns the shortest of these runs that solves the board within `limit` moves, or null when none does.
 */
export function personSolve(board: MeasureBoardData, limit: number): MeasureAction[] | null {
  let best: MeasureAction[] | null = null;
  for (const run of personRuns(board, limit)) if (run && (!best || run.length < best.length)) best = run;
  return best;
}

/** Every strategy's run (null where it never reaches the target within the limit). */
export function personRuns(board: MeasureBoardData, limit: number): (MeasureAction[] | null)[] {
  const n = board.caps.length;
  const out: (MeasureAction[] | null)[] = [];
  if (board.tap) {
    for (let x = 0; x < n; x++)
      for (let y = 0; y < n; y++)
        if (x !== y)
          out.push(
            turn(board, limit, (a) =>
              a[x] === 0 ? { kind: "fill", jug: x } : a[y] === board.caps[y] ? { kind: "empty", jug: y } : { kind: "pour", from: x, to: y },
            ),
          );
    return out;
  }
  if (n !== 3) return out;
  for (const [x, y, z] of PERMUTATIONS_3)
    out.push(
      turn(board, limit, (a) =>
        a[y] === 0 ? { kind: "pour", from: x, to: y } : a[z] === board.caps[z] ? { kind: "pour", from: z, to: x } : { kind: "pour", from: y, to: z },
      ),
    );
  return out;
}

const PERMUTATIONS_3: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

function turn(board: MeasureBoardData, limit: number, next: (amounts: readonly number[]) => MeasureAction): MeasureAction[] | null {
  let amounts = [...board.start];
  const moves: MeasureAction[] = [];
  if (measureSolved(board, amounts)) return moves;
  while (moves.length < limit) {
    const action = next(amounts);
    const after = measureApply(board, amounts, action);
    if (!after) return null;
    moves.push(action);
    amounts = after;
    if (measureSolved(board, amounts)) return moves;
  }
  return null;
}
