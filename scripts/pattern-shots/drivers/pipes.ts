import { rotateMask } from "../../../src/lib/duel/logic";
import type { Driver } from "../driver";

/** The solved side-sets with every listed tile turned back one quarter. */
function backOne(full: { solution: number[] }, cells: number[]) {
  return full.solution.map((sides, cell) => (cells.includes(cell) ? rotateMask(sides, -1) : sides));
}

/** Tile 0 is an end piece facing east when solved; one turn back leaks north. */
const LAST = 0;

export const driver: Driver = {
  board: ".pipes-play-board",
  mid: (full) => ({
    pipeSides: full.tiles.map((tile: { sides: number }, cell: number) => (cell % 2 ? tile.sides : full.solution[cell])),
  }),
  nearSolved: (full) => ({ pipeSides: backOne(full, [LAST]) }),
  finish: async (page) => {
    await page.getByRole("button", { name: `Pipe tile ${LAST + 1}`, exact: true }).first().click();
  },
};
