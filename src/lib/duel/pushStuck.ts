/**
 * Heave's stuck hint (the Pattern overhaul, stage 3, 16 Nov 2026; display only, no stamp). A square is *dead* when a
 * crate on it can never reach any mark, even with every other crate gone: a corner without a mark, a run along a wall
 * with no mark that the crate can't be pushed off, and any other square no mark can be pulled back to. Worked out by
 * pulling a crate backwards from every mark (a crate at `c` could have come from `c − d` if the pusher had room at
 * `c − 2d`), so it ignores other crates and never calls a live square dead. A dead square is absorbing: a crate on
 * one can't be pushed back onto a live one.
 *
 * The stage (src/puzzles/push.tsx) tints a crate on a dead square and plays push.stuck on the push that put it there,
 * on the levels whose `stuckHint` is on (Easy and Normal). Nothing here reads or changes moves, pushes or the grade.
 */
import { PUSH_CELLS, type SlideDir } from "./types";
import { PUSH_DIRS, pushStep } from "./push";

const OPPOSITE = { U: "D", D: "U", L: "R", R: "L" } as Record<SlideDir, SlideDir>;

/** Every floor square a crate could still be pushed from onto some mark (other crates ignored). */
export function pushLiveSquares(walls: readonly number[], targets: readonly number[]): Set<number> {
  const wall = new Set(walls);
  const live = new Set<number>(targets.filter((cell) => !wall.has(cell)));
  const stack = [...live];
  while (stack.length) {
    const cell = stack.pop()!;
    for (const dir of PUSH_DIRS) {
      // A push in `dir` ended on `cell`: the crate was at `from`, the pusher behind it at `stand`.
      const from = pushStep(cell, OPPOSITE[dir]);
      const stand = from === null ? null : pushStep(from, OPPOSITE[dir]);
      if (from === null || stand === null || wall.has(from) || wall.has(stand) || live.has(from)) continue;
      live.add(from);
      stack.push(from);
    }
  }
  return live;
}

/** The floor squares a crate can never leave for a mark: every floor square not live. */
export function pushDeadSquares(walls: readonly number[], targets: readonly number[]): Set<number> {
  const live = pushLiveSquares(walls, targets);
  const wall = new Set(walls);
  const dead = new Set<number>();
  for (let cell = 0; cell < PUSH_CELLS; cell++) if (!wall.has(cell) && !live.has(cell)) dead.add(cell);
  return dead;
}

/** The crates (indices into `crates`) standing on dead squares. */
export function stuckCrates(crates: readonly number[], dead: ReadonlySet<number>): number[] {
  return crates.flatMap((cell, index) => (dead.has(cell) ? [index] : []));
}

