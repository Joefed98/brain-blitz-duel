/**
 * Chroma Lines' human-style solver (levels, 15 Nov 2026; server-only). It solves a board the way a person does, with
 * no search beyond what a person holds in mind:
 *
 *   1. a line end with only one way to go goes there (into its one free square, or onto its partner dot);
 *   2. an empty square with only two ways in or out is crossed through both, so a line end beside it runs into it;
 *   3. one step of "what if": a line end with a few ways to go tries each, follows rules 1 and 2 to the end, and drops
 *      any way that leaves a square stranded, a pair cut off from its partner or a pocket no pair can fill.
 *
 * Nothing deeper (no second "what if" inside the first, no guessing). The Hard and Expert banks keep only boards this
 * solver finishes (flowLevels.server.ts), so every board those levels deal is one a person can finish by reasoning.
 * `steps` counts the deductions and `whatIfs` the forced ways found by rule 3 (the board's difficulty).
 */
import { flowNeighbours, type FlowGrid } from "./flow";
import type { FlowPair } from "./types";

export interface FlowHumanResult {
  solved: boolean;
  /** Squares filled by rules 1 and 2. */
  steps: number;
  /** Ways forced by rule 3 (a "what if" ruled the others out). */
  whatIfs: number;
  /** Each square's pair when solved (-2 wall), for tools that draw the solution from it. */
  owners?: number[];
}

interface State {
  /** -2 wall, -1 empty, else the pair. */
  owner: Int8Array;
  /** Each pair's two line ends (cells). */
  endA: Int16Array;
  endB: Int16Array;
  done: Uint8Array;
  empty: number;
}

function clone(s: State): State {
  return { owner: s.owner.slice(), endA: s.endA.slice(), endB: s.endB.slice(), done: s.done.slice(), empty: s.empty };
}

export function solveFlowLikeAPerson(pairs: readonly FlowPair[], walls: readonly number[], grid: FlowGrid): FlowHumanResult {
  const cells = grid.cols * grid.rows;
  const nb: number[][] = Array.from({ length: cells }, (_, c) => flowNeighbours(c, grid));
  const P = pairs.length;
  const start: State = {
    owner: new Int8Array(cells).fill(-1),
    endA: new Int16Array(P),
    endB: new Int16Array(P),
    done: new Uint8Array(P),
    empty: cells - walls.length - 2 * P,
  };
  for (const w of walls) start.owner[w] = -2;
  pairs.forEach((p, i) => {
    start.owner[p.a] = i;
    start.owner[p.b] = i;
    start.endA[i] = p.a;
    start.endB[i] = p.b;
  });

  const isOpenEnd = (s: State, cell: number): boolean => {
    const o = s.owner[cell]!;
    return o >= 0 && !s.done[o] && (s.endA[o] === cell || s.endB[o] === cell);
  };

  /** The ways an end can go: an empty neighbour, or its partner end (a join, as -1 - cell). */
  const options = (s: State, i: number, end: number): number[] => {
    const other = s.endA[i] === end ? s.endB[i]! : s.endA[i]!;
    const out: number[] = [];
    for (const n of nb[end]!) {
      if (s.owner[n] === -1) out.push(n);
      else if (n === other) out.push(-1 - n);
    }
    return out;
  };

  /** Moves the end `end` of pair `i` one way (a cell, or a join). */
  const apply = (s: State, i: number, end: number, way: number): void => {
    const fromA = s.endA[i] === end;
    if (way < 0) {
      s.done[i] = 1;
      return;
    }
    s.owner[way] = i;
    s.empty--;
    if (fromA) s.endA[i] = way;
    else s.endB[i] = way;
  };

  const seen = new Int32Array(cells);
  let stamp = 0;
  const queue = new Int16Array(cells);

  /** False on a contradiction a person would see. */
  const feasible = (s: State): boolean => {
    for (let i = 0; i < P; i++) {
      if (s.done[i]) continue;
      if (options(s, i, s.endA[i]!).length === 0 || options(s, i, s.endB[i]!).length === 0) return false;
    }
    for (let c = 0; c < cells; c++) {
      if (s.owner[c] !== -1) continue;
      let ok = 0;
      for (const n of nb[c]!) if (s.owner[n] === -1 || isOpenEnd(s, n)) ok++;
      if (ok < 2) return false;
    }
    for (let i = 0; i < P; i++) {
      if (s.done[i]) continue;
      stamp++;
      let qh = 0;
      let qt = 0;
      queue[qt++] = s.endA[i]!;
      seen[s.endA[i]!] = stamp;
      let reached = false;
      while (qh < qt && !reached) {
        const c = queue[qh++]!;
        for (const n of nb[c]!) {
          if (n === s.endB[i]) {
            reached = true;
            break;
          }
          if (s.owner[n] === -1 && seen[n] !== stamp) {
            seen[n] = stamp;
            queue[qt++] = n;
          }
        }
      }
      if (!reached) return false;
    }
    stamp++;
    const region = stamp;
    for (let c = 0; c < cells; c++) {
      if (s.owner[c] !== -1 || seen[c] === region) continue;
      let qh = 0;
      let qt = 0;
      queue[qt++] = c;
      seen[c] = region;
      const touchA = new Set<number>();
      const touchB = new Set<number>();
      while (qh < qt) {
        const x = queue[qh++]!;
        for (const n of nb[x]!) {
          const o = s.owner[n]!;
          if (o === -1) {
            if (seen[n] !== region) {
              seen[n] = region;
              queue[qt++] = n;
            }
          } else if (o >= 0 && !s.done[o]) {
            if (s.endA[o] === n) touchA.add(o);
            if (s.endB[o] === n) touchB.add(o);
          }
        }
      }
      let any = false;
      for (const o of touchA) if (touchB.has(o)) any = true;
      if (!any) return false;
    }
    return true;
  };

  const solvedState = (s: State) => s.empty === 0 && s.done.every(Boolean);

  /** Rules 1 and 2 until nothing more follows; false on a contradiction. Counts the squares filled. */
  const propagate = (s: State, count: { n: number }): boolean => {
    for (let guard = 0; guard < cells * 4; guard++) {
      if (!feasible(s)) return false;
      let moved = false;
      // Rule 1: an end with one way.
      for (let i = 0; i < P && !moved; i++) {
        if (s.done[i]) continue;
        for (const end of [s.endA[i]!, s.endB[i]!]) {
          const ways = options(s, i, end);
          if (ways.length === 1) {
            apply(s, i, end, ways[0]!);
            count.n++;
            moved = true;
            break;
          }
        }
      }
      // Rule 2: an empty square with exactly two ways in or out, one of them a line end.
      for (let c = 0; c < cells && !moved; c++) {
        if (s.owner[c] !== -1) continue;
        const ways = nb[c]!.filter((n) => s.owner[n] === -1 || isOpenEnd(s, n));
        if (ways.length !== 2) continue;
        const ends = ways.filter((n) => isOpenEnd(s, n));
        if (ends.length === 0) continue;
        // Two ends of different pairs both beside it: the square joins them, a contradiction unless they're partners.
        if (ends.length === 2 && s.owner[ends[0]!] !== s.owner[ends[1]!]) return false;
        const e = ends[0]!;
        apply(s, s.owner[e]!, e, c);
        count.n++;
        moved = true;
      }
      if (!moved) return true;
    }
    return true;
  };

  const state = clone(start);
  const count = { n: 0 };
  let whatIfs = 0;
  if (!propagate(state, count)) return { solved: false, steps: count.n, whatIfs };
  for (let round = 0; round < cells * 2; round++) {
    if (solvedState(state)) return { solved: true, steps: count.n, whatIfs, owners: [...state.owner] };
    // Rule 3: one "what if" on each open end, fewest ways first.
    const tries: { i: number; end: number; ways: number[] }[] = [];
    for (let i = 0; i < P; i++) {
      if (state.done[i]) continue;
      for (const end of [state.endA[i]!, state.endB[i]!]) tries.push({ i, end, ways: options(state, i, end) });
    }
    tries.sort((x, y) => x.ways.length - y.ways.length);
    let progressed = false;
    for (const t of tries) {
      const alive = t.ways.filter((way) => {
        const s = clone(state);
        apply(s, t.i, t.end, way);
        return propagate(s, { n: 0 });
      });
      if (alive.length === 0) return { solved: false, steps: count.n, whatIfs };
      if (alive.length === 1) {
        apply(state, t.i, t.end, alive[0]!);
        whatIfs++;
        count.n++;
        if (!propagate(state, count)) return { solved: false, steps: count.n, whatIfs };
        progressed = true;
        break;
      }
    }
    if (!progressed) return { solved: solvedState(state), steps: count.n, whatIfs };
  }
  return { solved: solvedState(state), steps: count.n, whatIfs };
}
