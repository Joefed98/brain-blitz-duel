/**
 * Server-only generation for Jumbled tilesRev 3 (jumbled.ts; docs/depth/d5-remodels.md).
 *
 * The solved gradient is scrambled by JUMBLED_SCRAMBLE random slides (never two on the same line in a row),
 * so every board is solvable. Its exact minimum is then proved by meeting in the middle: every frame within
 * JUMBLED_HALF slides of the solved board is tabled once (the same table for every board, the goal never
 * changes), and every frame within JUMBLED_HALF slides of the scramble is looked up in it. A board is kept
 * when its minimum is JUMBLED_MIN_MOVES or more; par is the minimum + JUMBLED_PAR_SLACK.
 */
import { randomBelow } from "./random";
import {
  JUMBLED_MOVES,
  JUMBLED_PAR_SLACK,
  JUMBLED_TIME_MS,
  TILES_REV_GRADIENT,
  encodeJumbledMove,
  jumbledInPlace,
  jumbledSlide,
  jumbledSolved,
  solvedJumbled,
  type JumbledMove,
} from "./jumbled";
import type { TilesPuzzleData } from "./types";

/** Slides in a scramble (so the minimum is at most this). */
export const JUMBLED_SCRAMBLE = 6;
/** Each side of the meet-in-the-middle search. */
export const JUMBLED_HALF = 3;
export const JUMBLED_MIN_MOVES = 5;
/** At least this many movable tiles start out of place. */
export const JUMBLED_MIN_OUT = 16;

const keyOf = (frame: readonly number[]) => String.fromCharCode(...frame.map((t) => 65 + t));

function inverse(move: JumbledMove, length: number): JumbledMove {
  return { kind: move.kind, index: move.index, shift: length - move.shift };
}
const LENGTH = (move: JumbledMove) => (move.kind === "R" ? (move.index === 0 || move.index === 4 ? 3 : 5) : move.index === 0 || move.index === 4 ? 3 : 5);

/** Breadth-first frames within `depth` slides, each with one shortest slide list from `start`. */
function ball(start: readonly number[], depth: number): Map<string, JumbledMove[]> {
  const seen = new Map<string, JumbledMove[]>([[keyOf(start), []]]);
  let frontier: { frame: number[]; path: JumbledMove[] }[] = [{ frame: [...start], path: [] }];
  for (let d = 0; d < depth; d++) {
    const next: typeof frontier = [];
    for (const { frame, path } of frontier) {
      const last = path[path.length - 1];
      for (const move of JUMBLED_MOVES) {
        if (last && last.kind === move.kind && last.index === move.index) continue;
        const f = jumbledSlide(frame, move);
        const k = keyOf(f);
        if (seen.has(k)) continue;
        const p = [...path, move];
        seen.set(k, p);
        next.push({ frame: f, path: p });
      }
    }
    frontier = next;
  }
  return seen;
}

let goalTable: Map<string, JumbledMove[]> | null = null;
/** Every frame within JUMBLED_HALF slides of the solved gradient, with a shortest list from solved to it. */
function goal(): Map<string, JumbledMove[]> {
  goalTable ??= ball(solvedJumbled(), JUMBLED_HALF);
  return goalTable;
}

/**
 * The exact fewest slides from `frame` to solved and one shortest list, when it is at most 2 × JUMBLED_HALF;
 * null when it is more.
 */
export function jumbledMinimum(frame: readonly number[]): { min: number; solution: JumbledMove[] } | null {
  if (jumbledSolved(frame)) return { min: 0, solution: [] };
  const table = goal();
  const near = ball(frame, JUMBLED_HALF);
  let best: { min: number; solution: JumbledMove[] } | null = null;
  for (const [key, there] of near) {
    const back = table.get(key);
    if (!back) continue;
    const total = there.length + back.length;
    if (best && total >= best.min) continue;
    // From the frame along `there`, then undo the solved → key list backwards.
    const home = [...back].reverse().map((m) => inverse(m, LENGTH(m)));
    best = { min: total, solution: [...there, ...home] };
  }
  return best;
}

function scramble(): number[] {
  let frame = solvedJumbled();
  let last: JumbledMove | null = null;
  for (let step = 0; step < JUMBLED_SCRAMBLE; step++) {
    const options = JUMBLED_MOVES.filter((m) => !last || m.kind !== last.kind || m.index !== last.index);
    const move = options[randomBelow(options.length)]!;
    frame = jumbledSlide(frame, move);
    last = move;
  }
  return frame;
}

/** A tilesRev 3 board: the scramble, its proved minimum and one shortest route (server-only), and par. */
export function generateJumbled(maxTries = 400): TilesPuzzleData {
  let fallback: TilesPuzzleData | null = null;
  for (let tries = 0; tries < maxTries; tries++) {
    const frame = scramble();
    if (21 - jumbledInPlace(frame) < JUMBLED_MIN_OUT) continue;
    const found = jumbledMinimum(frame);
    if (!found) continue;
    const puzzle: TilesPuzzleData = {
      type: "tiles",
      tilesRev: TILES_REV_GRADIENT,
      timeLimitMs: JUMBLED_TIME_MS,
      frame,
      par: found.min + JUMBLED_PAR_SLACK,
      minMoves: found.min,
      solution: found.solution.map((m) => Number(encodeJumbledMove(m).slice(1)) * (m.kind === "R" ? 1 : -1)),
    };
    if (found.min >= JUMBLED_MIN_MOVES) return puzzle;
    if (!fallback || found.min > fallback.minMoves!) fallback = puzzle;
  }
  if (fallback) return fallback;
  throw new Error("Jumbled generator found no board");
}

/** The stored route as moves: each number is index × 10 + shift, negative for a column. */
export function jumbledSolutionMoves(solution: readonly number[]): JumbledMove[] {
  return solution.map((n) => ({ kind: n < 0 ? "C" : "R", index: Math.floor(Math.abs(n) / 10), shift: Math.abs(n) % 10 }));
}

/** Re-checks a stored tilesRev 3 board: a legal frame, a proved minimum equal to the stored one, par, the route. */
export function verifyJumbledPuzzle(puzzle: TilesPuzzleData): string | null {
  if (puzzle.type !== "tiles" || puzzle.tilesRev !== TILES_REV_GRADIENT) return "not tilesRev 3";
  const { frame } = puzzle;
  if (frame.length !== 25 || new Set(frame).size !== 25 || frame.some((t) => !Number.isInteger(t) || t < 0 || t > 24)) return "frame";
  for (const corner of [0, 4, 20, 24]) if (frame[corner] !== corner) return "an anchor moved";
  const found = jumbledMinimum(frame);
  if (!found) return "no solution within the proof depth";
  if (found.min !== puzzle.minMoves) return `stored minimum ${puzzle.minMoves}, proved ${found.min}`;
  if (found.min < JUMBLED_MIN_MOVES) return "minimum under the band";
  if (puzzle.par !== found.min + JUMBLED_PAR_SLACK) return "par";
  let f = [...frame];
  for (const m of jumbledSolutionMoves(puzzle.solution ?? [])) f = jumbledSlide(f, m);
  if (!jumbledSolved(f) || (puzzle.solution ?? []).length !== found.min) return "stored route";
  return null;
}
