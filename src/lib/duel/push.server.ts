/**
 * Server-only Push layout drawing. Layouts are never generated on the fly —
 * a room draws one entry from the curated, solver-verified bank.
 */

import { pick } from "./random";
import { PUSH_BANK } from "./pushBank.server";
import { cratesOnTargets } from "./push";
import type { PushPuzzleData } from "./types";

export function generatePush(): PushPuzzleData {
  const entry = pick(PUSH_BANK);
  return {
    type: "push",
    walls: entry.walls,
    crates: entry.crates,
    targets: entry.targets,
    pusher: entry.pusher,
    minPushes: entry.minPushes,
    stats: {
      crates: entry.crates.length,
      minPushes: entry.minPushes,
      minMoves: entry.minMoves,
      detour: entry.detour,
    },
    solution: entry.solution,
  };
}

export { cratesOnTargets };
