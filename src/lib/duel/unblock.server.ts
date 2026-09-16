/**
 * Server-only Unblock round building. Layouts come from the verified bank; the
 * minimum move count and its solution stay server-side until the reveal.
 */

import { pick } from "./random";
import {
  encodeMoves,
  isSolved,
  parseLayout,
  position,
  slideRange,
  type UnblockMove,
} from "./unblock";
import { UNBLOCK_BANK } from "./unblockBank.server";
import type { UnblockPuzzleData, UnblockVehicle } from "./types";

const key = (vehicles: UnblockVehicle[]) => vehicles.map(position).join(".");

/** A shortest solution for the layout, found by breadth-first search. */
function shortestSolution(start: UnblockVehicle[]): UnblockMove[] {
  if (isSolved(start)) return [];
  const seen = new Set<string>([key(start)]);
  let frontier: { state: UnblockVehicle[]; moves: UnblockMove[] }[] = [{ state: start, moves: [] }];

  for (let depth = 1; depth <= 40; depth++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const v of node.state) {
        const { min, max } = slideRange(node.state, v.id);
        for (let to = min; to <= max; to++) {
          if (to === position(v)) continue;
          const state = node.state.map((entry) =>
            entry.id === v.id
              ? entry.axis === "h"
                ? { ...entry, col: to }
                : { ...entry, row: to }
              : entry,
          );
          const k = key(state);
          if (seen.has(k)) continue;
          seen.add(k);
          const moves = [...node.moves, { id: v.id, to }];
          if (isSolved(state)) return moves;
          next.push({ state, moves });
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return [];
}

/** Draws one verified layout from the bank. */
export function generateUnblock(): UnblockPuzzleData {
  const entry = pick(UNBLOCK_BANK);
  const [layout, min] = entry.split("|");
  const vehicles = parseLayout(layout ?? "");
  const minMoves = Number.parseInt(min ?? "", 10);
  return {
    type: "unblock",
    vehicles,
    minMoves: Number.isFinite(minMoves) ? minMoves : 0,
    solution: encodeMoves(shortestSolution(vehicles)),
  };
}
