/**
 * Full answers for the fixed intro examples of the word games, for the
 * word-polish-shots reveal layout test: the shots tool sends these instead of
 * an empty answer so each reveal is shown at its fullest. Prints JSON
 * { type: answer }. Reads the server generators directly (dev tool only).
 *
 *   bun scripts/word-polish-answers.ts
 */
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import { generateWordsmithExample } from "../src/lib/duel/wordsmith.server";
import { bankedIntroExample } from "../src/lib/duel/puzzleBank.server";
import { encodeStrikeout } from "../src/lib/duel/strikeout";
import { encodeCodeword } from "../src/lib/duel/codeword";
import { encodeSwapword, type SwSwap } from "../src/lib/duel/swapword";
import { wsEncode } from "../src/lib/duel/wordSearch";
import { encodeTileGrid } from "../src/lib/duel/tileGrid";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

function example(type: PuzzleType): PuzzleData {
  return (bankedIntroExample(type) ??
    withSeededRandom(INTRO_EXAMPLE_SEED, () => (type === "wordsmith" ? generateWordsmithExample() : generatePuzzle(type, { unblockRow: null })))) as PuzzleData;
}

const out: Record<string, string> = {};
for (const type of ["wordsmith", "wordhunt", "tilegrid", "wordsearch", "letterwheel", "strikeout", "codeword", "swapword"] as PuzzleType[]) {
  const p = example(type) as PuzzleData & Record<string, unknown>;
  switch (p.type) {
    case "wordsmith":
      out[type] = (p.words ?? []).map((w) => w.word).join(",");
      break;
    case "wordhunt":
      // A strong real run: the 30 longest words (the board allows hundreds).
      out[type] = (p.words ?? []).slice(0, 30).map((w) => `${w.word}:${w.path.join("-")}`).join(",");
      break;
    case "tilegrid":
      out[type] = p.solution ? encodeTileGrid(p.solution) : "";
      break;
    case "wordsearch":
      out[type] = wsEncode((p.placements ?? []).map((pl) => [...pl.cells]));
      break;
    case "letterwheel":
      out[type] = (p.words ?? []).join(",");
      break;
    case "strikeout":
      out[type] = encodeStrikeout((p.words ?? []).map((word, row) => ({ kind: "solve" as const, row, word: word.toUpperCase() })));
      break;
    case "codeword": {
      const given = new Set(p.givens.map((g) => g.n));
      const sol = p.solution ?? "";
      out[type] = encodeCodeword([...sol].flatMap((letter, i) => (given.has(i + 1) ? [] : [{ n: i + 1, letter }])));
      break;
    }
    case "swapword": {
      const sol = p.solution ?? "";
      const board = [...p.start];
      const swaps: SwSwap[] = [];
      for (let i = 0; i < board.length; i++) {
        if (board[i] === sol[i]) continue;
        let j = board.findIndex((ch, k) => k > i && ch === sol[i] && board[k] !== sol[k] && board[i] === sol[k]);
        if (j < 0) j = board.findIndex((ch, k) => k > i && ch === sol[i] && board[k] !== sol[k]);
        [board[i], board[j]] = [board[j]!, board[i]!];
        swaps.push([i, j]);
      }
      out[type] = encodeSwapword(swaps);
      break;
    }
  }
}
console.log(JSON.stringify(out));
