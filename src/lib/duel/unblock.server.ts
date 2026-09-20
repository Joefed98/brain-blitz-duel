/**
 * Server-only Unblock round building. Layouts come from the verified bank; the
 * minimum move count and its solution stay server-side until the reveal.
 */

import { pick } from "./random";
import { applyMove, isSolved, occupancy, parseLayout, serialiseLayout, slideRange } from "./unblock";
import { UNBLOCK_BANK } from "./unblockBank.server";
import { UNBLOCK_COLS, type UnblockPuzzleData, type UnblockVehicle } from "./types";

/** Draws one verified layout, its minimum and its stored shortest solution. */
export function generateUnblock(): UnblockPuzzleData {
  const entry = pick(UNBLOCK_BANK);
  const [layout, min, solution] = entry.split("|");
  const vehicles = parseLayout(layout ?? "");
  const minMoves = Number.parseInt(min ?? "", 10);
  return {
    type: "unblock",
    vehicles,
    minMoves: Number.isFinite(minMoves) ? minMoves : 0,
    // The bank separates moves with ";"; the shared codec uses ",".
    solution: (solution ?? "").split(";").join(","),
  };
}

/** Fewest slides from this position to the exit, or null if it is stuck. */
export function unblockDistance(vehicles: UnblockVehicle[], cap = 200_000): number | null {
  if (isSolved(vehicles)) return 0;
  const seen = new Set<string>([serialiseLayout(vehicles)]);
  let frontier: UnblockVehicle[][] = [vehicles];
  for (let depth = 1; depth <= 60; depth++) {
    const next: UnblockVehicle[][] = [];
    for (const state of frontier) {
      for (const v of state) {
        const { min, max } = slideRange(state, v.id);
        for (let to = min; to <= max; to++) {
          const moved = applyMove(state, { id: v.id, to });
          if (!moved) continue;
          const id = serialiseLayout(moved);
          if (seen.has(id)) continue;
          if (isSolved(moved)) return depth;
          seen.add(id);
          next.push(moved);
          if (seen.size > cap) return null;
        }
      }
    }
    if (!next.length) return null;
    frontier = next;
  }
  return null;
}

/** Cars standing between the gold car's nose and the exit gap. */
export function blockingCars(vehicles: UnblockVehicle[]): number {
  const gold = vehicles.find((v) => v.id === 0);
  if (!gold) return 0;
  const taken = occupancy(vehicles, 0);
  let blockers = 0;
  for (let col = gold.col + gold.len; col < UNBLOCK_COLS; col++) {
    if (taken.has(gold.row * UNBLOCK_COLS + col)) blockers += 1;
  }
  return blockers;
}
