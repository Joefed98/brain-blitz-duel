/**
 * Server-only Tower setup: six discs spread legally across four pegs, with the
 * exact minimum move count and one shortest solution found by breadth-first
 * search over every state. Easy spreads are thrown away.
 */

import {
  encodeTowerMoves,
  towerPegsFromState,
  towerShortest,
  towerStacksLegal,
  type TowerState,
} from "./tower";
import {
  TOWER_DISCS,
  TOWER_MIN_MINIMUM,
  TOWER_PEGS,
  TOWER_TIME_MS,
  type TowerPuzzleData,
} from "./types";

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

/**
 * A random spread: every disc gets a peg, and the stack order on each peg is
 * then forced to be strictly decreasing, so the spread is always legal.
 */
function randomSpread(): TowerState {
  return Array.from({ length: TOWER_DISCS }, () => randomInt(TOWER_PEGS));
}

export function generateTower(): TowerPuzzleData {
  for (let attempt = 0; attempt < 5_000; attempt++) {
    const state = randomSpread();
    const used = new Set(state);
    // Two pegs at least, and never the whole sorted tower sitting on one peg.
    if (used.size < 2) continue;

    const targetPeg = randomInt(TOWER_PEGS);
    const pegs = towerPegsFromState(state, TOWER_DISCS);
    if (!towerStacksLegal(pegs)) continue;
    if ((pegs[targetPeg] ?? []).length === TOWER_DISCS) continue;

    const shortest = towerShortest(pegs, targetPeg, TOWER_DISCS);
    if (!shortest) continue;
    if (shortest.minMoves < TOWER_MIN_MINIMUM) continue;

    return {
      type: "tower",
      discs: TOWER_DISCS,
      start: pegs,
      targetPeg,
      minMoves: shortest.minMoves,
      timeLimitMs: TOWER_TIME_MS,
      solution: encodeTowerMoves(shortest.solution),
    };
  }
  throw new Error("Tower generator could not build a hard enough spread");
}
