/**
 * Skid's ice gems (slideRev 1, depth batch 4; docs/depth/d4-pattern.md). Gems sit on the ice off the
 * shortest route. The ball collects a gem by sliding over it or stopping on it (a slide that ends in a hole
 * still collects what it crossed before the hole). Undo and Reset take back what the undone slides
 * collected, exactly as they take back the ball. The same replay runs on the phone (to light the gems) and
 * on the server (to count them). Shared, pure.
 */
import { slideOutcome, type SlideBoard } from "../slide";
import type { SlideDir } from "../types";

export interface GemReplay {
  /** Gems collected by the slides that stand at the end (or at the exit). */
  collected: number;
  /** Bit i set when gem i is collected. */
  mask: number;
  /** Bit masks after every standing slide, the start (0) first. */
  history: number[];
}

/** Bits of the gems a slide's path crosses. */
export function gemBits(gems: readonly number[], path: readonly number[]): number {
  let bits = 0;
  gems.forEach((cell, i) => {
    if (path.includes(cell)) bits |= 1 << i;
  });
  return bits;
}

export function popCount(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n += 1;
  return n;
}

/** Replays the move list (as replaySlide does: X undo, Y reset, no-op slides dropped) for the gems. */
export function replayGems(board: SlideBoard, gems: readonly number[], moves: readonly SlideDir[]): GemReplay {
  type S = { cell: number; mask: number; gems: number };
  const start: S = { cell: board.start, mask: 0, gems: 0 };
  const history: S[] = [start];
  let state = start;
  for (const dir of moves) {
    if (dir === "X") {
      if (history.length > 1) history.pop();
      state = history[history.length - 1]!;
      continue;
    }
    if (dir === "Y") {
      history.length = 1;
      state = history[0]!;
      continue;
    }
    if (state.cell === board.exit) break;
    const out = slideOutcome(board, state.cell, state.mask, dir);
    if (!out.path.length) continue;
    state = { cell: out.cell, mask: out.mask, gems: state.gems | gemBits(gems, out.path) };
    history.push(state);
    if (state.cell === board.exit) break;
  }
  return { collected: popCount(state.gems), mask: state.gems, history: history.map((s) => s.gems) };
}
