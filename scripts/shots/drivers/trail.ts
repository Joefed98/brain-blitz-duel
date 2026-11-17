import type { Page } from "playwright";
import type { Driver } from "../driver";

/* Trail: tap each empty cell in solution order at its centre on the 6×6 board (4px gaps; cells may be taller than wide
   since the Logic overhaul, 15 Nov 2026). */
async function tapSteps(page: Page, puzzle: Record<string, any>, from: number, to: number) {
  const arena = page.locator("[data-game-stage] [data-game-arena]").first();
  const box = await arena.boundingBox();
  if (!box) throw new Error("Trail: no board");
  const pitch = (box.width + 4) / 6;
  const cell = pitch - 4;
  const pitchY = (box.height + 4) / 6;
  const cellY = pitchY - 4;
  const solution: number[] = puzzle.solution;
  for (let step = from; step < to; step++) {
    const c = solution[step]!;
    if (puzzle.givens[c] != null) continue;
    await page.mouse.click(box.x + (c % 6) * pitch + cell / 2, box.y + Math.floor(c / 6) * pitchY + cellY / 2);
    await page.waitForTimeout(70);
  }
}

export const driver: Driver = {
  partial: async ({ page, puzzle }) => tapSteps(page, puzzle, 1, 9),
  solve: async ({ page, puzzle }) => tapSteps(page, puzzle, 9, 36),
  solveShotsMs: [450],
};
