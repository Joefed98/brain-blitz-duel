import type { Page } from "playwright";
import type { Driver } from "../driver";

const stage = (page: Page) => page.locator("[data-game-stage]");

type Scale = { tray: number[]; pegs?: number };

/** The notch's accessible name: 8 notches run 4…1 | 1…4, balanceRev 2's 10-notch scale 5…1 | 1…5. */
function notch(peg: number, pegs: number) {
  const half = pegs / 2;
  return peg < half ? `Place at distance ${half - peg} on the left` : `Place at distance ${peg - half + 1} on the right`;
}

/** A tray weight (not one already hanging on the beam), then the notch at its solution peg. */
async function hang(page: Page, w: number, peg: number, pegs: number) {
  await stage(page).locator(`button[aria-label="Select weight ${w}"]:not(.balance-instrument button)`).first().click();
  await stage(page).getByRole("button", { name: notch(peg, pegs), exact: true }).click();
  await page.waitForTimeout(300);
}

/**
 * Waits for the scale counter to show scale n (the stage advances after its correct hold): the stage's
 * "scale n / N" line, or the frame's goal line "Scale n of N" (polish batch W).
 */
async function onScale(page: Page, n: number, total: number) {
  await page
    .locator("[data-game-stage], [data-goal-line]")
    .getByText(new RegExp(`scale ${n} (/|of) ${total}`, "i"))
    .first()
    .waitFor({ timeout: 10_000 });
  await page.waitForTimeout(250);
}

const moves = (puzzle: Record<string, any>, s: number): [number, number][] =>
  (puzzle.scales[s] as Scale).tray.map((w, i) => [w, puzzle.solutions[s][i] as number]);
const pegsOf = (puzzle: Record<string, any>, s: number) => (puzzle.scales[s] as Scale).pegs ?? 8;

export const driver: Driver = {
  partial: async ({ page, puzzle }) => {
    const total = puzzle.scales.length;
    for (const [w, peg] of moves(puzzle, 0)) await hang(page, w, peg, pegsOf(puzzle, 0));
    await onScale(page, 2, total);
    const [first] = moves(puzzle, 1);
    await hang(page, first![0], first![1], pegsOf(puzzle, 1));
  },
  solve: async ({ page, puzzle }) => {
    const total = puzzle.scales.length;
    for (const [w, peg] of moves(puzzle, 1).slice(1)) await hang(page, w, peg, pegsOf(puzzle, 1));
    // Every scale but the last in full; the last up to its final weight, which is the solving input.
    for (let s = 2; s < total; s++) {
      await onScale(page, s + 1, total);
      const list = moves(puzzle, s);
      const pegs = pegsOf(puzzle, s);
      const finalScale = s === total - 1;
      for (const [w, peg] of finalScale ? list.slice(0, -1) : list) await hang(page, w, peg, pegs);
      if (finalScale) {
        const [w, peg] = list[list.length - 1]!;
        await stage(page).locator(`button[aria-label="Select weight ${w}"]:not(.balance-instrument button)`).first().click();
        await stage(page).getByRole("button", { name: notch(peg, pegs), exact: true }).click();
      }
    }
  },
  solveShotsMs: [450],
};
