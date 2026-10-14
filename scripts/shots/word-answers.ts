/**
 * Full answers for the fixed intro examples of the word games: the screenshot tool
 * (scripts/shots/capture.ts, "full" phase) swaps one into the practice grade request
 * instead of an empty answer, so each reveal is shown at its fullest. Reads the
 * example's server-side solution (dev tool only).
 */
import { encodeStrikeout } from "../../src/lib/duel/strikeout";
import { encodeCodeword } from "../../src/lib/duel/codeword";
import { encodeSwapword, type SwSwap } from "../../src/lib/duel/swapword";
import { wsEncode } from "../../src/lib/duel/wordSearch";
import { encodeTileGrid } from "../../src/lib/duel/tileGrid";
import type { PuzzleData } from "../../src/lib/duel/types";

/** The fullest honest answer for a word game's intro example, or null for other games. */
export function wordAnswer(puzzle: PuzzleData): string | null {
  const p = puzzle as PuzzleData & Record<string, unknown>;
  switch (p.type) {
    case "wordsmith":
      return (p.words ?? []).map((w) => w.word).join(",");
    case "wordhunt":
      // A strong real run: the 30 longest words (the board allows hundreds).
      return (p.words ?? [])
        .slice(0, 30)
        .map((w) => `${w.word}:${w.path.join("-")}`)
        .join(",");
    case "tilegrid":
      return p.solution ? encodeTileGrid(p.solution) : "";
    case "wordsearch":
      return wsEncode((p.placements ?? []).map((pl) => [...pl.cells]));
    case "letterwheel":
      return (p.words ?? []).join(",");
    case "strikeout":
      if ((p.strikeoutRev ?? 1) >= 2) return (p.words ?? []).map((word, i) => `${i}${word.toUpperCase()}`).join(",");
      return encodeStrikeout(
        (p.words ?? []).map((word, row) => ({
          kind: "solve" as const,
          row,
          word: word.toUpperCase(),
        })),
      );
    case "codeword": {
      const given = new Set(p.givens.map((g) => g.n));
      const sol = p.solution ?? "";
      return encodeCodeword(
        [...sol].flatMap((letter, i) => (given.has(i + 1) ? [] : [{ n: i + 1, letter }])),
      );
    }
    case "swapword": {
      const sol = p.solution ?? "";
      const board = [...p.start];
      const swaps: SwSwap[] = [];
      for (let i = 0; i < board.length; i++) {
        if (board[i] === sol[i]) continue;
        let j = board.findIndex(
          (ch, k) => k > i && ch === sol[i] && board[k] !== sol[k] && board[i] === sol[k],
        );
        if (j < 0) j = board.findIndex((ch, k) => k > i && ch === sol[i] && board[k] !== sol[k]);
        [board[i], board[j]] = [board[j]!, board[i]!];
        swaps.push([i, j]);
      }
      return encodeSwapword(swaps);
    }
    default:
      return null;
  }
}
