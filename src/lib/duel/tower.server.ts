/**
 * Server-only Tower setup: nine discs spread legally across three or four pegs
 * (chosen per puzzle). Distances to the solved tower are found by one
 * breadth-first search over all pegs^9 placements; the spread is drawn from
 * states whose exact minimum is 20–40 moves, and a shortest solution is read
 * off by walking those distances downhill.
 */

import { encodeTowerMoves, towerPegsFromState, towerStacksLegal, type TowerMove, type TowerState } from "./tower";
import {
  TOWER_REV_LEVELS,
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

/**
 * A level's tower (the Logic overhaul's levels, 15 Nov 2026; gameLevels.ts): a fixed post count, the ring count, the
 * band the exact minimum is drawn from and the clock. Left out, the deal is today's (3 or 4 posts at random, nine
 * rings, 20–40 moves, 90 s).
 */
export type TowerLevelSettings = import("./logicLevels").TowerLevel;

/** The distance tables the level deals draw from (one per pegs, target and rings; at most 4^9 entries). */
const DIST_CACHE = new Map<string, Int16Array>();
function cachedDistances(targetPeg: number, discs: number, pegs: number): Int16Array {
  const id = `${pegs}:${targetPeg}:${discs}`;
  let found = DIST_CACHE.get(id);
  if (!found) {
    if (DIST_CACHE.size >= 16) DIST_CACHE.clear();
    found = towerDistances(targetPeg, discs, pegs);
    DIST_CACHE.set(id, found);
  }
  return found;
}

export function generateTower(level?: TowerLevelSettings): TowerPuzzleData {
  const pegs = level ? level.pegs : Math.random() < 0.5 ? 3 : 4;
  const discs = level?.discs ?? TOWER_DISCS;
  const lo = level?.minMoves[0] ?? TOWER_MIN_MINIMUM;
  const hi = level?.minMoves[1] ?? TOWER_MAX_MINIMUM;
  const timeLimitMs = level?.timeMs ?? TOWER_TIME_MS;
  for (let attempt = 1; attempt <= 40; attempt++) {
    const targetPeg = randomInt(pegs);
    const dist = level ? cachedDistances(targetPeg, discs, pegs) : towerDistances(targetPeg, discs, pegs);
    const band: number[] = [];
    for (let code = 0; code < dist.length; code++) {
      const d = dist[code]!;
      if (d >= lo && d <= hi) band.push(code);
    }
    if (!band.length) continue;
    const code = band[randomInt(band.length)]!;
    let state = decodeState(code, discs, pegs);
    const start = towerPegsFromState(state, discs, pegs);
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
      discs,
      start,
      targetPeg,
      minMoves,
      timeLimitMs,
      stats: { discs, pegs, minMoves, attempts: attempt },
      // The Logic overhaul's levels (logicLevels.ts): a fixed post count per level; the reveal's "moves from done".
      ...(level ? { towerRev: TOWER_REV_LEVELS } : {}),
      solution: encodeTowerMoves(solution),
    };
  }
  throw new Error(`Tower generator could not build a spread in the ${lo}–${hi} move band`);
}
