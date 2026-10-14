import type { Page } from "playwright";
import type { Driver } from "../driver";

const stage = (page: Page) => page.locator("[data-game-stage]");

/* Integer Pyramid: tap a bank tile by value, then the empty cell (the transparent overlay on top). */
async function fill(page: Page, puzzle: Record<string, any>, index: number, limit = Infinity) {
  const board = puzzle.pyramids[index];
  const solution: number[] = puzzle.solutions[index];
  const empties = (board.givens as (number | null)[]).map((g, i) => (g == null ? i : -1)).filter((i) => i >= 0);
  let placed = 0;
  for (const cell of empties) {
    if (placed >= limit) break;
    const cellLoc = stage(page).locator(`[data-np-cell="${cell}"]`);
    if ((await cellLoc.first().innerText()).trim()) continue;
    const tile = stage(page).locator("[data-np-tray] .pyramid-tray-tile").filter({ hasText: new RegExp(`^\\s*${solution[cell]}\\s*$`) }).first();
    await tile.click();
    await cellLoc.last().click();
    await page.waitForTimeout(140);
    placed++;
  }
}

export const driver: Driver = {
  partial: async ({ page, puzzle }) => {
    await fill(page, puzzle, 0, 2);
  },
  solve: async ({ page, puzzle }) => {
    for (let index = 0; index < 4; index++) {
      if (index > 0) await stage(page).getByText(`Pyramid ${index + 1} of 4`).waitFor({ timeout: 10_000 });
      await fill(page, puzzle, index);
    }
  },
  solveShotsMs: [450],
};
