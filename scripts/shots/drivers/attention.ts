/**
 * Attention rework drivers (14 Oct 2026): Eagle Eye, Double Take and Tally. The mid-play
 * frame shows the new part of each game: Eagle Eye's two-target grid 3, Double Take's
 * rock pool (picture 2) and Tally's comparison tray.
 */
import type { Page } from "playwright";
import type { Driver, FullPuzzle } from "../driver";

const stage = (page: Page) => page.locator("[data-game-stage]");

/* Double Take: tap a cell in the first (top) panel of the picture on screen. */
async function tapCell(page: Page, cell: number) {
  await stage(page)
    .locator("[data-dt-panel]")
    .first()
    .locator(`rect[aria-label="Cell ${cell + 1}"]`)
    .click();
  await page.waitForTimeout(160);
}
const sceneCells = (puzzle: FullPuzzle, scene: number): number[] =>
  (puzzle.differences ?? [])
    .filter((d: { scene?: number }) => (d.scene ?? 0) === scene)
    .map((d: { cells: number[] }) => d.cells[0]);

const symscan: Driver = {
  board: ".eye-grid",
  seedMid: () => ({ scanStage: 2, scanSel: [[], [], []] }),
};

const spotdiff: Driver = {
  board: ".dt-arena",
  partial: async ({ page, puzzle }) => {
    // spotRev 2 (depth to 200): the hidden seventh difference is tapped too, so mid-play shows its double ring and star.
    const bonus = (puzzle as { bonus?: { scene?: number; cells: number[] } }).bonus;
    if (bonus && (bonus.scene ?? 0) === 0) {
      for (const cell of sceneCells(puzzle, 0).slice(0, 3)) await tapCell(page, cell);
      await tapCell(page, bonus.cells[0]!);
      return;
    }
    for (const cell of sceneCells(puzzle, 0)) await tapCell(page, cell);
    // Picture 1 done: glow, then the rock pool slides in.
    await page.waitForTimeout(1300);
    for (const cell of sceneCells(puzzle, 1).slice(0, 2)) await tapCell(page, cell);
    if (bonus) await tapCell(page, bonus.cells[0]!);
  },
  solve: async ({ page, puzzle }) => {
    for (const cell of sceneCells(puzzle, 1).slice(2)) await tapCell(page, cell);
  },
  solveShotsMs: [500],
};

const countup: Driver = {
  board: ".tally-tray",
  seedMid: (puzzle) => ({
    countStage: 3,
    countAnswers: (puzzle.counts ?? []).slice(0, 3).map(String).concat([""]),
  }),
};

export const ATTENTION_DRIVERS: Record<string, Driver> = { symscan, spotdiff, countup };
