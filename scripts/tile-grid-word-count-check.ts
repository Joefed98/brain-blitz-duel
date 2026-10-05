import { TG_CELLS, tileGridWordCells, scoreTileGrid } from "../src/lib/duel/tileGrid";
import { checkTileGridWord, judgeTileGrid } from "../src/lib/duel/tileGrid.server";

function expect(label: string, actual: number, expected: number) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}
const cells = Array<string>(TG_CELLS).fill("");
const count = () => tileGridWordCells(cells, (word) => checkTileGridWord(word).valid).size;
expect("empty board", count(), 0);
cells[0] = "C";
expect("isolated tile", count(), 0);
cells[1] = "A";
expect("two-letter run", count(), 0);
cells[2] = "T";
expect("CAT counts", count(), 3);
cells[9] = "O";
cells[16] = "P";
expect("CAT/TOP crossing counted once", count(), 5);
cells[48] = "Z";
expect("isolated extra tile ignored", count(), 5);
expect("server and live count agree", judgeTileGrid(cells, cells.filter(Boolean)).wordTiles, count());
expect("unfinished per-tile points", scoreTileGrid(false, 6, count(), 20), 40);
cells[16] = "Q";
expect("invalid down word does not erase valid across tile", count(), 3);
expect("server invalid run agrees", judgeTileGrid(cells, cells.filter(Boolean)).wordTiles, count());
cells[2] = "";
expect("removing shared tile invalidates both runs", count(), 0);
cells[2] = "T";
cells[3] = "Q";
expect("extending CAT to invalid CATQ stops counting substring", count(), 0);
const complete = Array<string>(TG_CELLS).fill("");
for (const [word, row, col, horizontal] of [["PLANETS", 2, 0, true], ["COMPLEX", 0, 0, false], ["BENT", 0, 3, false]] as const) {
  [...word].forEach((letter, i) => { complete[(row + (horizontal ? 0 : i)) * 7 + col + (horizontal ? i : 0)] = letter; });
}
const result = judgeTileGrid(complete, complete.filter(Boolean));
if (!result.valid) throw new Error("Complete grid rejected");
expect("complete count", result.wordTiles, 15);
expect("complete at buzzer unchanged", scoreTileGrid(result.valid, result.placed, result.wordTiles, 0), 130);
expect("complete half bonus unchanged", scoreTileGrid(result.valid, result.placed, result.wordTiles, 10), 140);
expect("complete full bonus unchanged", scoreTileGrid(result.valid, result.placed, result.wordTiles, 20), 150);
console.log("Tile Grid valid-word tile counting and unchanged completion scores pass");