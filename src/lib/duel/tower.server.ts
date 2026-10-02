/**
 * Server-only Tower setup: nine discs spread legally across three or four pegs
 * (chosen per puzzle). Distances to the solved tower are found by one
 * breadth-first search over all pegs^9 placements; the spread is drawn from
 * states whose exact minimum is 20–40 moves, and a shortest solution is read
 * off by walking those distances downhill.
 */

import { encodeTowerMoves, towerPegsFromState, towerStacksLegal, type TowerMove, type TowerState } from "./tower";
import {
  TOWER_DISCS,
  TOWER_MAX_MINIMUM,
  TOWER_MIN_MINIMUM,
  TOWER_TIME_MS,
  type TowerPuzzleData,
} from "./types";

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function decodeState(code: number, discs: number, pegs: number): TowerState {
  const state: TowerState = [];
  let rest = code;
  for (let disc = 0; disc < discs; disc++) {
    state.push(rest % pegs);
    rest = Math.floor(rest / pegs);
  }
  return state;
}

function encodeState(state: TowerState, pegs: number): number {
  let code = 0;
  for (let disc = state.length - 1; disc >= 0; disc--) code = code * pegs + state[disc]!;
  return code;
}

function topDisc(state: TowerState, peg: number): number | null {
  for (let disc = 1; disc <= state.length; disc++) if (state[disc - 1] === peg) return disc;
  return null;
}

function* neighbours(state: TowerState, pegs: number): Generator<{ move: TowerMove; next: TowerState }> {
  for (let from = 0; from < pegs; from++) {
    const disc = topDisc(state, from);
    if (disc === null) continue;
    for (let to = 0; to < pegs; to++) {
      if (to === from) continue;
      const onTop = topDisc(state, to);
      if (onTop !== null && onTop < disc) continue;
      const next = [...state];
      next[disc - 1] = to;
      yield { move: { from, to }, next };
    }
  }
}

/** Moves are reversible, so one search out of the goal answers every state. */
export function towerDistances(targetPeg: number, discs: number, pegs: number): Int16Array {
  const dist = new Int16Array(pegs ** discs).fill(-1);
  const goal = encodeState(new Array<number>(discs).fill(targetPeg), pegs);
  dist[goal] = 0;
  let frontier = [goal];
  let depth = 0;
  while (frontier.length) {
    depth += 1;
    const nextFrontier: number[] = [];
    for (const code of frontier) {
      for (const { next } of neighbours(decodeState(code, discs, pegs), pegs)) {
        const id = encodeState(next, pegs);
        if (dist[id] !== -1) continue;
        dist[id] = depth;
        nextFrontier.push(id);
      }
    }
    frontier = nextFrontier;
  }
  return dist;
}

export function generateTower(): TowerPuzzleData {
  const pegs = Math.random() < 0.5 ? 3 : 4;
  for (let attempt = 1; attempt <= 40; attempt++) {
    const targetPeg = randomInt(pegs);
    const dist = towerDistances(targetPeg, TOWER_DISCS, pegs);
    const band: number[] = [];
    for (let code = 0; code < dist.length; code++) {
      const d = dist[code]!;
      if (d >= TOWER_MIN_MINIMUM && d <= TOWER_MAX_MINIMUM) band.push(code);
    }
    if (!band.length) continue;
    const code = band[randomInt(band.length)]!;
    let state = decodeState(code, TOWER_DISCS, pegs);
    const start = towerPegsFromState(state, TOWER_DISCS, pegs);
    if (!towerStacksLegal(start)) continue;

    const minMoves = dist[code]!;
    const solution: TowerMove[] = [];
    for (let left = minMoves; left > 0; left--) {
      let stepped = false;
      for (const { move, next } of neighbours(state, pegs)) {
        if (dist[encodeState(next, pegs)] === left - 1) {
          solution.push(move);
          state = next;
          stepped = true;
          break;
        }
      }
      if (!stepped) break;
    }
    if (solution.length !== minMoves) continue;

    return {
      type: "tower",
      discs: TOWER_DISCS,
      start,
      targetPeg,
      minMoves,
      timeLimitMs: TOWER_TIME_MS,
      stats: { discs: TOWER_DISCS, pegs, minMoves, attempts: attempt },
      solution: encodeTowerMoves(solution),
    };
  }
  throw new Error("Tower generator could not build a spread in the 20–40 move band");
}
