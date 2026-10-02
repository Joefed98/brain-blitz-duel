/**
 * Tower rules: nine discs across three or four pegs (the stored spread says which). One replay function, used by the
 * phone (to move discs live) and by the server (to replay the move list a phone
 * sends). Nothing here knows how a starting spread is chosen.
 */

import { TOWER_PEGS } from "./types";

/** Each peg holds disc sizes from bottom to top; a peg is always descending. */
export type TowerPegs = number[][];

export interface TowerMove {
  from: number;
  to: number;
}

/** How many pegs a stored spread uses: three or four. */
export function towerPegCount(start: readonly number[][] | undefined): number {
  const n = start?.length ?? TOWER_PEGS;
  return n === 3 ? 3 : TOWER_PEGS;
}

/** A fresh copy of a stored spread, one entry per peg. */
export function towerPegsFrom(start: number[][]): TowerPegs {
  return Array.from({ length: towerPegCount(start) }, (_, peg) => [...(start[peg] ?? [])]);
}

/** True when the top of `from` may sit on `to`. */
export function towerCanMove(pegs: TowerPegs, from: number, to: number): boolean {
  if (from === to) return false;
  const source = pegs[from];
  const destination = pegs[to];
  if (!source || !destination || !source.length) return false;
  const disc = source[source.length - 1]!;
  const onTop = destination[destination.length - 1];
  return onTop === undefined || disc < onTop;
}

export function towerApply(pegs: TowerPegs, from: number, to: number): TowerPegs {
  if (!towerCanMove(pegs, from, to)) return pegs;
  const next: TowerPegs = pegs.map((peg) => [...peg]);
  next[to]!.push(next[from]!.pop()!);
  return next;
}

/** "0>2,0>1" — one move per part. */
export function encodeTowerMoves(moves: TowerMove[]): string {
  return moves.map((move) => `${move.from}>${move.to}`).join(",");
}

export function decodeTowerMoves(raw: string): TowerMove[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => {
      const [from, to] = part.split(">");
      return { from: Number.parseInt(from ?? "", 10), to: Number.parseInt(to ?? "", 10) };
    })
    .filter(
      (move) =>
        Number.isInteger(move.from) &&
        Number.isInteger(move.to) &&
        move.from >= 0 &&
        move.from < TOWER_PEGS &&
        move.to >= 0 &&
        move.to < TOWER_PEGS,
    )
    .slice(0, 400);
}

export interface TowerReplay {
  pegs: TowerPegs;
  /** Moves that were actually played. */
  moves: number;
  solved: boolean;
  /** True when the move list broke the rules and was cut short. */
  illegal: boolean;
  /** Discs stacked correctly from the bottom of the target peg. */
  correctFromBottom: number;
}

/** Discs in place counting up from the bottom of the target peg. */
export function towerCorrectFromBottom(pegs: TowerPegs, targetPeg: number, discs: number): number {
  const peg = pegs[targetPeg] ?? [];
  let count = 0;
  for (let index = 0; index < peg.length; index++) {
    if (peg[index] !== discs - index) break;
    count += 1;
  }
  return count;
}

/** Every peg must read largest at the bottom to smallest at the top. */
export function towerStacksLegal(pegs: TowerPegs): boolean {
  return pegs.every((peg) => peg.every((disc, index) => index === 0 || disc < peg[index - 1]!));
}

/**
 * Replays a move list from the stored spread. A move that would put a larger
 * disc on a smaller one is illegal: the replay stops there, so a move list that
 * breaks the rules can never be counted as solved.
 */
export function replayTower(
  start: number[][],
  targetPeg: number,
  discs: number,
  moves: TowerMove[],
): TowerReplay {
  let pegs = towerPegsFrom(start);
  let count = 0;
  let illegal = false;
  for (const move of moves) {
    if (!towerCanMove(pegs, move.from, move.to)) {
      illegal = true;
      break;
    }
    pegs = towerApply(pegs, move.from, move.to);
    count += 1;
    if ((pegs[targetPeg] ?? []).length === discs) break;
  }
  const home = pegs[targetPeg] ?? [];
  const correctFromBottom = towerCorrectFromBottom(pegs, targetPeg, discs);
  return {
    pegs,
    moves: count,
    // Solved only when every disc sits on the target peg in the right order.
    solved: home.length === discs && correctFromBottom === discs && towerStacksLegal(pegs),
    illegal,
    correctFromBottom,
  };
}

/* -------------------------------------------------------------------------- */
/*  Search                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A state is just which peg each disc sits on: with strictly-decreasing stacks
 * the order on a peg is forced, so the whole game is pegs^discs states.
 */
export type TowerState = number[];

export function towerStateFromPegs(pegs: number[][], discs: number): TowerState {
  const state = new Array<number>(discs).fill(0);
  pegs.forEach((peg, index) => {
    for (const disc of peg) state[disc - 1] = index;
  });
  return state;
}

export function towerPegsFromState(
  state: TowerState,
  discs: number,
  pegCount: number = TOWER_PEGS,
): TowerPegs {
  const pegs: TowerPegs = Array.from({ length: pegCount }, () => []);
  // Largest first, so every peg comes out descending from the bottom.
  for (let disc = discs; disc >= 1; disc--) pegs[state[disc - 1]!]!.push(disc);
  return pegs;
}

/** The smallest disc on a peg, which is the only one that can be lifted. */
function topDisc(state: TowerState, peg: number): number | null {
  for (let disc = 1; disc <= state.length; disc++) if (state[disc - 1] === peg) return disc;
  return null;
}

function stateKey(state: TowerState): string {
  return state.join("");
}

/**
 * Breadth-first search over every state to the solved one: the exact minimum,
 * plus one shortest move list.
 */
export function towerShortest(
  start: number[][],
  targetPeg: number,
  discs: number,
): { minMoves: number; solution: TowerMove[] } | null {
  const pegCount = towerPegCount(start);
  const from = towerStateFromPegs(start, discs);
  const goal = stateKey(new Array<number>(discs).fill(targetPeg));
  if (stateKey(from) === goal) return { minMoves: 0, solution: [] };

  const seen = new Map<
    string,
    { state: TowerState; move: TowerMove | null; parent: string | null }
  >();
  seen.set(stateKey(from), { state: from, move: null, parent: null });
  let frontier = [stateKey(from)];

  for (let depth = 1; depth <= pegCount ** discs; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      const node = seen.get(id)!;
      for (let source = 0; source < pegCount; source++) {
        const disc = topDisc(node.state, source);
        if (disc === null) continue;
        for (let destination = 0; destination < pegCount; destination++) {
          if (destination === source) continue;
          const onTop = topDisc(node.state, destination);
          if (onTop !== null && onTop < disc) continue;
          const moved = [...node.state];
          moved[disc - 1] = destination;
          const key = stateKey(moved);
          if (seen.has(key)) continue;
          seen.set(key, { state: moved, move: { from: source, to: destination }, parent: id });
          if (key === goal) {
            // Walk the chain back to the start to read the move list off.
            const solution: TowerMove[] = [];
            let cursor: string | null = key;
            while (cursor) {
              const step: { state: TowerState; move: TowerMove | null; parent: string | null } =
                seen.get(cursor)!;

              if (!step.move) break;
              solution.unshift(step.move);
              cursor = step.parent;
            }
            return { minMoves: depth, solution };
          }
          next.push(key);
        }
      }
    }
    if (!next.length) return null;
    frontier = next;
  }
  return null;
}
