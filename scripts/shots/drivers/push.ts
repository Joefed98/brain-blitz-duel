import { decodePushSolution, movePusher, pushStep, PUSH_DIRS, type PushState } from "../../../src/lib/duel/push";
import type { SlideDir } from "../../../src/lib/duel/types";
import { arrow, type Driver } from "../driver";

interface Full {
  walls: number[];
  crates: number[];
  pusher: number;
  solution: string;
}

/** Shortest walk (no pushes) from the pusher to `goal`. */
function walk(state: PushState, goal: number, walls: Set<number>): SlideDir[] {
  const prev = new Map<number, [number, SlideDir]>();
  const seen = new Set([state.pusher]);
  const queue = [state.pusher];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    if (cell === goal) break;
    for (const dir of PUSH_DIRS) {
      const next = pushStep(cell, dir);
      if (next === null || walls.has(next) || state.crates.includes(next) || seen.has(next)) continue;
      seen.add(next);
      prev.set(next, [cell, dir]);
      queue.push(next);
    }
  }
  if (!seen.has(goal)) throw new Error(`push driver: no walk to ${goal}`);
  const path: SlideDir[] = [];
  for (let at = goal; at !== state.pusher; ) {
    const [from, dir] = prev.get(at)!;
    path.unshift(dir);
    at = from;
  }
  return path;
}

const OPPOSITE: Record<SlideDir, SlideDir> = { U: "D", D: "U", L: "R", R: "L" };

/** The full step list: walk behind each stored push, then push. */
function moves(full: Full): SlideDir[] {
  const walls = new Set(full.walls);
  let state: PushState = { pusher: full.pusher, crates: [...full.crates] };
  const out: SlideDir[] = [];
  for (const push of decodePushSolution(full.solution)) {
    const behind = pushStep(push.cell, OPPOSITE[push.dir]);
    if (behind === null) throw new Error("push driver: no cell behind");
    for (const dir of [...walk(state, behind, walls), push.dir]) {
      const result = movePusher(state, dir, walls);
      if (!result.moved) throw new Error("push driver: blocked step");
      state = result.state;
      out.push(dir);
    }
  }
  return out;
}

export const driver: Driver = {
  board: '[data-game-arena="board"] > div',
  seedMid: (full) => ({ pushMoves: moves(full).slice(0, Math.floor(moves(full).length / 2)) }),
  seedNearSolved: (full) => ({ pushMoves: moves(full).slice(0, -1) }),
  solve: async ({ page, puzzle: full }) => {
    await arrow(page, moves(full).at(-1)!);
  },
};
