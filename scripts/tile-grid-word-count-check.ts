import { TG_CELLS, tileGridWordCells, scoreTileGrid } from "../src/lib/duel/tileGrid";
import { checkTileGridWord, generateTileGrid, judgeTileGrid } from "../src/lib/duel/tileGrid.server";
import { withSeededRandom } from "../src/lib/duel/random";

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
const puzzle = withSeededRandom(42, () => generateTileGrid());
const complete = puzzle.solution;
if (!complete) throw new Error("Missing generated solution");
const result = judgeTileGrid(complete, puzzle.tray);
if (!result.valid) throw new Error("Complete grid rejected");
expect("complete count", result.wordTiles, 15);
expect("complete at buzzer unchanged", scoreTileGrid(result.valid, result.placed, result.wordTiles, 0), 130);
expect("complete half bonus unchanged", scoreTileGrid(result.valid, result.placed, result.wordTiles, 10), 140);
expect("complete full bonus unchanged", scoreTileGrid(result.valid, result.placed, result.wordTiles, 20), 150);
const mismatchedTray = judgeTileGrid(complete, []);
expect("tray tampering gives no counted tiles", mismatchedTray.wordTiles, 0);
for (let seed = 1; seed <= 20; seed++) {
  const generated = withSeededRandom(seed, () => generateTileGrid());
  const solution = generated.solution;
  if (!solution) throw new Error("Missing solution");
  for (let removed = 0; removed <= 15; removed++) {
    const partial = [...solution];
    const filled = partial.map((letter, i) => letter ? i : -1).filter((i) => i >= 0);
    for (const cell of filled.slice(0, removed)) partial[cell] = "";
    const live = tileGridWordCells(partial, (word) => checkTileGridWord(word).valid).size;
    expect(`seed ${seed}, removals ${removed}`, judgeTileGrid(partial, generated.tray).wordTiles, live);
  }
}
console.log("Tile Grid valid-word tile counting and unchanged completion scores pass");