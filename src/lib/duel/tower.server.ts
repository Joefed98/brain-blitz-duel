/**
 * Server-only Tower setup. Nothing about the discs is random beyond the target
 * peg and the occasional five-disc tower, which gets a longer clock.
 */

import { encodeTowerMoves, towerMinMoves, towerOptimal } from "./tower";
import {
  TOWER_FIVE_DISC_SHARE,
  TOWER_LONG_TIME_MS,
  TOWER_TIME_MS,
  type TowerPuzzleData,
} from "./types";

export function generateTower(): TowerPuzzleData {
  const discs = Math.random() < TOWER_FIVE_DISC_SHARE ? 5 : 4;
  const targetPeg = Math.random() < 0.5 ? 1 : 2;
  const solution = towerOptimal(discs, 0, targetPeg);
  const minMoves = towerMinMoves(discs);
  if (solution.length !== minMoves) throw new Error("Tower solution is not the minimum");

  return {
    type: "tower",
    discs,
    targetPeg,
    minMoves,
    timeLimitMs: discs === 5 ? TOWER_LONG_TIME_MS : TOWER_TIME_MS,
    solution: encodeTowerMoves(solution),
  };
}
