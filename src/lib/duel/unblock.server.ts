/**
 * Server-only Unblock round building. Layouts come from the verified bank; the
 * minimum move count and its solution stay server-side until the reveal.
 */

import { pick } from "./random";
import { parseLayout } from "./unblock";
import { UNBLOCK_BANK } from "./unblockBank.server";
import type { UnblockPuzzleData, UnblockVehicle } from "./types";

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
