/**
 * Server-only generation for Sort the Tubes.
 *
 * Boards are built backwards from the solved state with legal reverse pours, so
 * a solution always exists by construction. The stored minimum then comes from
 * a breadth-first search over tube states — never from the scramble length.
 */

import { randInt, randomBelow, shuffled } from "./random";
import {
  colourAlreadyHome,
  decodeTubeMoves,
  replayTubes,
  cloneTubes,
  encodeTubeMoves,
  pour,
  topGroup,
  tubeSorted,
  tubesKey,
  tubesSolved,
  pourAmount,
  tubesCapacity as tubesCapacityOf,
  tubesSolved as tubesSolvedWith,
  type TubeMove,
  type TubeState,
} from "./tubes";
import { flasksKey, tubesLowerBound } from "./solverProgress.server";
import {
  TUBE_CAPACITY,
  TUBES_BFS_CAP,
  TUBES_COLOURS,
  TUBES_COUNT,
  TUBES_MAX_MIN_MOVES,
  TUBES_MAX_SCRAMBLE,
  TUBES_MIN_MIN_MOVES,
  TUBES_MIN_SCRAMBLE,
  type TubesPuzzleData,
} from "./types";

function solvedState(): TubeState {
  const full = Array.from({ length: TUBES_COLOURS }, (_, colour) =>
    new Array<number>(TUBE_CAPACITY).fill(colour),
  );
  const empties = Array.from({ length: TUBES_COUNT - TUBES_COLOURS }, () => [] as number[]);
  return shuffled([...full, ...empties]);
}

/**
 * One reverse pour: take `j` balls off a tube's top group and drop them on
 * another tube whose top colour differs, so the forward pour moves exactly
 * those `j` balls back again.
 */
function reversePours(state: TubeState): { from: number; to: number; count: number }[] {
  const options: { from: number; to: number; count: number }[] = [];
  for (let from = 0; from < state.length; from++) {
    const group = topGroup(state[from]!);
    if (!group) continue;
    for (let count = 1; count <= group.count; count++) {
      for (let to = 0; to < state.length; to++) {
        if (to === from) continue;
        const destination = state[to]!;
        if (destination.length + count > TUBE_CAPACITY) continue;
        const target = topGroup(destination);
        if (target && target.colour === group.colour) continue;
        options.push({ from, to, count });
      }
    }
  }
  return options;
}

function applyReverse(
  state: TubeState,
  move: { from: number; to: number; count: number },
): TubeState {
  const next = cloneTubes(state);
  const moved = next[move.from]!.splice(next[move.from]!.length - move.count, move.count);
  next[move.to]!.push(...moved);
  return next;
}

interface Node {
  state: TubeState;
  move: TubeMove | null;
  parent: number;
}

/** The fewest pours this board needs, plus one shortest pour list. */
export function tubesMinimum(
  start: TubeState,
  cap = TUBES_BFS_CAP,
): { minMoves: number; solution: TubeMove[] } | null {
  if (tubesSolved(start)) return { minMoves: 0, solution: [] };

  const nodes: Node[] = [{ state: cloneTubes(start), move: null, parent: -1 }];
  const seen = new Set<string>([tubesKey(start)]);

  for (let index = 0; index < nodes.length; index++) {
    if (nodes.length > cap) return null;
    const node = nodes[index]!;
    for (let from = 0; from < TUBES_COUNT; from++) {
      for (let to = 0; to < TUBES_COUNT; to++) {
        if (from === to) continue;
        const next = pour(node.state, from, to);
        if (next === node.state) continue;
        const key = tubesKey(next);
        if (seen.has(key)) continue;
        seen.add(key);
        const child: Node = { state: next, move: { from, to }, parent: index };
        nodes.push(child);
        if (tubesSolved(next)) {
          const path: TubeMove[] = [];
          let walk: Node | undefined = child;
          while (walk && walk.move) {
            path.unshift(walk.move);
            walk = nodes[walk.parent];
          }
          return { minMoves: path.length, solution: path };
        }
      }
    }
  }
  return null;
}

/** The live generator's own attempt cap. */
export const TUBES_MAX_ATTEMPTS = 400;

export function generateTubes(maxAttempts = TUBES_MAX_ATTEMPTS): TubesPuzzleData {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let state = solvedState();
    const scrambles = randInt(TUBES_MIN_SCRAMBLE, TUBES_MAX_SCRAMBLE);
    for (let step = 0; step < scrambles; step++) {
      const options = reversePours(state);
      if (!options.length) break;
      state = applyReverse(state, options[randomBelow(options.length)]!);
    }

    // No tube may start finished, and no colour may already sit in one tube.
    if (state.some(tubeSorted)) continue;
    if (colourAlreadyHome(state)) continue;

    const found = tubesMinimum(state);
    if (!found) continue;
    if (found.minMoves < TUBES_MIN_MIN_MOVES || found.minMoves > TUBES_MAX_MIN_MOVES) continue;

    return {
      type: "tubes",
      tubes: state,
      minMoves: found.minMoves,
      solution: encodeTubeMoves(found.solution),
    };
  }
  throw new Error("Sort the Tubes generator could not build a proven-solvable board");
}

/**
 * Re-checks a stored board as `generateTubes` accepts one: eight colours of
 * five balls in ten tubes, no tube finished and no colour home, and a fresh
 * breadth-first search giving the same minimum and pour list, inside the band.
 */
export function verifyTubesPuzzle(puzzle: TubesPuzzleData): string | null {
  const { tubes } = puzzle;
  if (puzzle.type !== "tubes") return "wrong type";
  if (tubes.length !== TUBES_COUNT) return "tube count";
  if (tubes.some((tube) => tube.length > TUBE_CAPACITY)) return "overfull tube";
  const counts = new Array<number>(TUBES_COLOURS).fill(0);
  for (const tube of tubes) for (const ball of tube) {
    if (!Number.isInteger(ball) || ball < 0 || ball >= TUBES_COLOURS) return "ball colour";
    counts[ball]! += 1;
  }
  if (counts.some((n) => n !== TUBE_CAPACITY)) return "balls per colour";
  if (tubes.some(tubeSorted)) return "a tube starts finished";
  if (colourAlreadyHome(tubes)) return "a colour starts home";
  const found = tubesMinimum(tubes);
  if (!found) return "no solution within the search cap";
  if (found.minMoves < TUBES_MIN_MIN_MOVES || found.minMoves > TUBES_MAX_MIN_MOVES) return "minimum outside the band";
  if (found.minMoves !== puzzle.minMoves) return "stored minimum";
  if (encodeTubeMoves(found.solution) !== puzzle.solution) return "stored solution";
  const replay = replayTubes(tubes, decodeTubeMoves(puzzle.solution ?? ""));
  if (!replay.solved || replay.moves !== puzzle.minMoves) return "solution does not replay";
  return null;
}

/* ------------------------------------------------------------------ levels (the Logic overhaul, 15 Nov 2026) */

/**
 * The fewest pours and one shortest list, by A* on the admissible bound solverProgress.server.ts proves exact
 * (tubesLowerBound), within a node budget; null past it. The levels' boards are too large for today's breadth-first
 * search, and this finds the same minimum.
 */
export function tubesLevelMinimum(start: TubeState, budget = 2_000_000): { minMoves: number; solution: TubeMove[] } | null {
  const cap = tubesCapacityOf(start);
  if (tubesSolvedWith(start, cap)) return { minMoves: 0, solution: [] };
  interface N { f: number; g: number; s: TubeState; parent: N | null; move: TubeMove | null }
  const heap: N[] = [];
  const better = (a: N, b: N) => a.f < b.f || (a.f === b.f && a.g > b.g);
  const push = (n: N) => {
    heap.push(n);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!better(heap[i]!, heap[p]!)) break;
      [heap[i], heap[p]] = [heap[p]!, heap[i]!];
      i = p;
    }
  };
  const pop = (): N => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && better(heap[l]!, heap[m]!)) m = l;
        if (r < heap.length && better(heap[r]!, heap[m]!)) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m]!, heap[i]!];
        i = m;
      }
    }
    return top;
  };
  const seen = new Map<string, number>([[flasksKey(start), 0]]);
  push({ f: tubesLowerBound(start), g: 0, s: start, parent: null, move: null });
  let nodes = 0;
  while (heap.length) {
    const node = pop();
    if (tubesSolvedWith(node.s, cap)) {
      const path: TubeMove[] = [];
      for (let w: N | null = node; w && w.move; w = w.parent) path.unshift(w.move);
      return { minMoves: path.length, solution: path };
    }
    if ((seen.get(flasksKey(node.s)) ?? Infinity) < node.g) continue;
    for (let from = 0; from < node.s.length; from++) {
      for (let to = 0; to < node.s.length; to++) {
        if (pourAmount(node.s, from, to, cap) <= 0) continue;
        if (++nodes > budget) return null;
        const next = pour(node.s, from, to, cap);
        const k = flasksKey(next);
        const g = node.g + 1;
        if ((seen.get(k) ?? Infinity) <= g) continue;
        seen.set(k, g);
        push({ f: g + tubesLowerBound(next), g, s: next, parent: node, move: { from, to } });
      }
    }
  }
  return null;
}

/**
 * A level's board (logicLevels.ts TubesLevel): `colours` full flasks of `capacity` layers scrambled backwards with
 * legal reverse pours among `flasks` flasks (the rest empty), no flask finished and no colour home at the start, its
 * exact minimum (tubesLevelMinimum) inside the level's band. The flasks, layers and clock ride on the board itself
 * (each colour's layer count is the capacity, tubes.ts tubesCapacity) and `timeLimitMs`; Expert adds `hidden: true`
 * (the stage shows only each flask's top colour until it is uncovered; the grade is unchanged).
 */
export function generateTubesLevel(level: import("./logicLevels").TubesLevel): TubesPuzzleData {
  const [lo, hi] = level.minMoves;
  for (let attempt = 0; attempt < 600; attempt++) {
    const full = Array.from({ length: level.colours }, (_, colour) => new Array<number>(level.capacity).fill(colour));
    let state: TubeState = shuffled([...full, ...Array.from({ length: level.flasks - level.colours }, () => [] as number[])]);
    const scrambles = randInt(level.capacity * level.colours * 2, level.capacity * level.colours * 3);
    for (let step = 0; step < scrambles; step++) {
      const options = reversePoursCap(state, level.capacity);
      if (!options.length) break;
      state = applyReverse(state, options[randomBelow(options.length)]!);
    }
    if (state.some((tube) => tubeSorted(tube, level.capacity))) continue;
    if (colourAlreadyHome(state)) continue;
    const found = tubesLevelMinimum(state);
    if (!found || found.minMoves < lo || found.minMoves > hi) continue;
    return {
      type: "tubes",
      tubes: state,
      minMoves: found.minMoves,
      solution: encodeTubeMoves(found.solution),
      timeLimitMs: level.timeMs,
      ...(level.hidden ? { hidden: true } : {}),
    };
  }
  throw new Error("Polypotions generator could not build a proven board for the level");
}

/** Reverse pours on a board of `capacity`-layer flasks (today's reversePours, its capacity a parameter). */
function reversePoursCap(state: TubeState, capacity: number): { from: number; to: number; count: number }[] {
  const options: { from: number; to: number; count: number }[] = [];
  for (let from = 0; from < state.length; from++) {
    const group = topGroup(state[from]!);
    if (!group) continue;
    for (let count = 1; count <= group.count; count++) {
      for (let to = 0; to < state.length; to++) {
        if (to === from) continue;
        const destination = state[to]!;
        if (destination.length + count > capacity) continue;
        const target = topGroup(destination);
        if (target && target.colour === group.colour) continue;
        options.push({ from, to, count });
      }
    }
  }
  return options;
}
