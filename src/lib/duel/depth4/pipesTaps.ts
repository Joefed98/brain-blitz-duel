/**
 * Pipeline's par turns (pipesRev 1, depth batch 4; docs/depth/d4-pattern.md). The answer is the final
 * side-sets as before ("3c9a…", one hex digit a tile, so older readers still read the board) followed by
 * "~" and the tap log (tile indices in tap order, comma separated). The server takes the board from the
 * taps alone, replayed on the stored tiles (each tap one quarter turn clockwise, as the phone turns it), and
 * counts the taps up to the solve. Par is the fewest taps that turn the dealt board into the stored
 * solution. Shared, pure.
 */
import { encodeSides, rotateMask, tileOpenings } from "../logic";
import type { PipeTile } from "../types";

/** Most taps a log keeps (an answer stays well inside the grader's 4,000 characters). */
export const PIPES_TAP_CAP = 1_000;

/** The fewest clockwise taps that turn each start tile into its solved side-set, summed. */
export function pipesParTurns(tiles: PipeTile[], solution: number[]): number {
  let total = 0;
  tiles.forEach((tile, index) => {
    const want = (solution[index] ?? tileOpenings(tile)) & 15;
    for (let t = 0; t < 4; t++) {
      if (rotateMask(tileOpenings(tile), t) === want) {
        total += t;
        return;
      }
    }
  });
  return total;
}

export function encodePipesTapAnswer(tiles: PipeTile[], taps: number[]): string {
  return `${encodeSides(tiles)}~${taps.slice(0, PIPES_TAP_CAP).join(",")}`;
}

/** The tap log from a pipesRev 1 answer (cells inside the board only). */
export function decodePipesTaps(raw: string, cells: number): number[] {
  const at = String(raw ?? "").indexOf("~");
  if (at < 0) return [];
  return String(raw)
    .slice(at + 1)
    .split(",")
    .filter((part) => /^\d{1,3}$/.test(part))
    .map(Number)
    .filter((cell) => cell >= 0 && cell < cells)
    .slice(0, PIPES_TAP_CAP);
}

/** The board after `taps`, from the stored start tiles. */
export function pipesAfterTaps(tiles: PipeTile[], taps: number[]): PipeTile[] {
  const sides = tiles.map((tile) => tileOpenings(tile));
  for (const cell of taps) sides[cell] = rotateMask(sides[cell] ?? 0, 1);
  return sides.map((value) => ({ sides: value }));
}

/* ---------------------------------------------------------------- pipesRev 5: turns both ways (15 Nov 2026) */

/**
 * The Pattern overhaul (patternNov15.ts): from pipesRev 5 a tile turns both ways. A tap is a quarter turn clockwise
 * ("12" in the log, as before); a long press or a swipe a quarter turn anticlockwise ("-12"). Every older stamp reads
 * its log exactly as before (a "-12" part is no tap there, as `decodePipesTaps` always dropped it).
 */
export interface PipesTurn {
  cell: number;
  /** Quarter turns clockwise: 1 for a tap, 3 for an anticlockwise turn. */
  turn: 1 | 3;
}

/** The turns from an answer's log: two-way (pipesRev 5) reads "-cell" as anticlockwise; else `decodePipesTaps`. */
export function decodePipesTurns(raw: string, cells: number, twoWay: boolean): PipesTurn[] {
  if (!twoWay) return decodePipesTaps(raw, cells).map((cell) => ({ cell, turn: 1 }));
  const at = String(raw ?? "").indexOf("~");
  if (at < 0) return [];
  const out: PipesTurn[] = [];
  for (const part of String(raw).slice(at + 1).split(",")) {
    if (!/^-?\d{1,3}$/.test(part)) continue;
    const cell = Number(part.replace("-", ""));
    if (cell < 0 || cell >= cells) continue;
    out.push({ cell, turn: part.startsWith("-") ? 3 : 1 });
    if (out.length >= PIPES_TAP_CAP) break;
  }
  return out;
}

/** The board after `turns`, from the stored start tiles. */
export function pipesAfterTurns(tiles: PipeTile[], turns: readonly PipesTurn[]): PipeTile[] {
  const sides = tiles.map((tile) => tileOpenings(tile));
  for (const { cell, turn } of turns) sides[cell] = rotateMask(sides[cell] ?? 0, turn);
  return sides.map((value) => ({ sides: value }));
}

/** The answer: the final side-sets, "~", then the log ("-cell" for an anticlockwise turn). */
export function encodePipesTurnAnswer(tiles: PipeTile[], turns: readonly PipesTurn[]): string {
  return `${encodeSides(tiles)}~${turns.slice(0, PIPES_TAP_CAP).map((t) => (t.turn === 3 ? `-${t.cell}` : String(t.cell))).join(",")}`;
}

/** The fewest turns, either way, that turn each start tile into its solved side-set, summed (pipesRev 5's par). */
export function pipesTwoWayParTurns(tiles: PipeTile[], solution: number[]): number {
  let total = 0;
  tiles.forEach((tile, index) => {
    const want = (solution[index] ?? tileOpenings(tile)) & 15;
    let best = 0;
    for (let t = 0; t < 4; t++) {
      if (rotateMask(tileOpenings(tile), t) === want) {
        best = Math.min(t, 4 - t) % 4;
        break;
      }
    }
    total += best;
  });
  return total;
}

/** pipesRev 5's deal: par counted both ways (the same board, solution and clock). */
export function withPipesTwoWayPar<T extends { type: string }>(puzzle: T): T {
  if (puzzle.type !== "pipes") return puzzle;
  const p = puzzle as unknown as { tiles: PipeTile[]; solution?: number[] };
  if (!p.solution?.length) return puzzle;
  return { ...puzzle, par: pipesTwoWayParTurns(p.tiles, p.solution) };
}
