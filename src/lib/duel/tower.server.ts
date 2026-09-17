/**
 * Server-only Tower setup: eight discs spread legally across four pegs, with the
 * exact minimum move count and one shortest solution. Distances to the solved
 * position are found once by breadth-first search over all 4^8 states, and the
 * spread is then drawn from the states that need at least twenty-five moves.
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

/** A state is which peg each disc sits on, packed as a base-four number. */
function decodeState(code: number, discs: number): TowerState {
  const state: TowerState = [];
  let rest = code;
  for (let disc = 0; disc < discs; disc++) {
    state.push(rest % TOWER_PEGS);
    rest = Math.floor(rest / TOWER_PEGS);
  }
  return state;
}

function encodeState(state: TowerState): number {
  let code = 0;
  for (let disc = state.length - 1; disc >= 0; disc--) code = code * TOWER_PEGS + state[disc]!;
  return code;
}

/** The smallest disc on a peg — the only one that can be lifted. */
function topDisc(state: TowerState, peg: number): number | null {
  for (let disc = 1; disc <= state.length; disc++) if (state[disc - 1] === peg) return disc;
  return null;
}

/**
 * How many moves every state is from the solved tower. Moves are reversible, so
 * one breadth-first search out of the goal answers it for all 4^8 states.
 */
function distancesToGoal(targetPeg: number, discs: number): Int16Array {
  const total = TOWER_PEGS ** discs;
  const dist = new Int16Array(total).fill(-1);
  const goal = encodeState(new Array<number>(discs).fill(targetPeg));
  dist[goal] = 0;
  let frontier = [goal];
  let depth = 0;
  while (frontier.length) {
    depth += 1;
    const next: number[] = [];
    for (const code of frontier) {
      const state = decodeState(code, discs);
      for (let from = 0; from < TOWER_PEGS; from++) {
        const disc = topDisc(state, from);
        if (disc === null) continue;
        for (let to = 0; to < TOWER_PEGS; to++) {
          if (to === from) continue;
          const onTop = topDisc(state, to);
          if (onTop !== null && onTop < disc) continue;
          const moved = [...state];
          moved[disc - 1] = to;
          const id = encodeState(moved);
          if (dist[id] !== -1) continue;
          dist[id] = depth;
          next.push(id);
        }
      }
    }
    frontier = next;
  }
  return dist;
}

export function generateTower(): TowerPuzzleData {
  for (let attempt = 1; attempt <= 40; attempt++) {
    const targetPeg = randomInt(TOWER_PEGS);
    const dist = distancesToGoal(targetPeg, TOWER_DISCS);
    const hard: number[] = [];
    for (let code = 0; code < dist.length; code++) {
      if (dist[code]! >= TOWER_MIN_MINIMUM) hard.push(code);
    }
    if (!hard.length) continue;

    const code = hard[randomInt(hard.length)]!;
    const state = decodeState(code, TOWER_DISCS);
    const pegs = towerPegsFromState(state, TOWER_DISCS);
    if (!towerStacksLegal(pegs)) continue;

    const shortest = towerShortest(pegs, targetPeg, TOWER_DISCS);
    if (!shortest) continue;
    if (shortest.minMoves < TOWER_MIN_MINIMUM) continue;

    console.log(
      `[tower] spread accepted after ${attempt} attempt(s): minimum ${shortest.minMoves} moves`,
    );
    return {
      type: "tower",
      discs: TOWER_DISCS,
      start: pegs,
      targetPeg,
      minMoves: shortest.minMoves,
      timeLimitMs: TOWER_TIME_MS,
      stats: {
        discs: TOWER_DISCS,
        pegs: TOWER_PEGS,
        minMoves: shortest.minMoves,
        attempts: attempt,
      },
      solution: encodeTowerMoves(shortest.solution),
    };
  }
  throw new Error("Tower generator could not build a hard enough spread");
}
