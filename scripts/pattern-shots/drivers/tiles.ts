import type { Driver } from "../driver";

// `tileMoves` stores the tapped tile VALUES (1–8), not cell indices; -1/-2 are Undo/Reset.
const moves = (full: { solution: number[] }) => full.solution;

export const driver: Driver = {
  board: ".puzzle-board",
  mid: (full) => ({ tileMoves: moves(full).slice(0, Math.floor(moves(full).length / 2)) }),
  nearSolved: (full) => ({ tileMoves: moves(full).slice(0, -1) }),
  finish: async (page, full) => {
    const last = moves(full).at(-1)!;
    // Tiles act on pointerdown; a real click fires it.
    await page.locator(`[data-game-stage] button[aria-label="Tile ${last}"]`).first().click();
  },
};
