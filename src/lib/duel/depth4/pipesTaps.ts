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
