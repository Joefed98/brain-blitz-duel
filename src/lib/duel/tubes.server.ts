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
  type TubeMove,
  type TubeState,
} from "./tubes";
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
