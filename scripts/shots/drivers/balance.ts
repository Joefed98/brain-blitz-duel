import type { Page } from "playwright";
import type { Driver } from "../number-drivers";

const stage = (page: Page) => page.locator("[data-game-stage]");

/** A tray weight (not one already hanging on the beam), then the notch at its solution peg. */
async function hang(page: Page, w: number, peg: number) {
  await stage(page).locator(`button[aria-label="Select weight ${w}"]:not(.balance-instrument button)`).first().click();
  const side = peg < 4 ? "left" : "right";
  const distance = peg < 4 ? 4 - peg : peg - 3;
  await stage(page).getByRole("button", { name: `Place at distance ${distance} on the ${side}`, exact: true }).click();
  await page.waitForTimeout(300);
}

/** Waits for the scale counter to show scale n (the stage advances after its correct hold). */
async function onScale(page: Page, n: number) {
  await stage(page).getByText(new RegExp(`scale ${n} / 3`, "i")).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(250);
}

type Scale = { tray: number[] };
const moves = (puzzle: Record<string, any>, s: number): [number, number][] =>
  (puzzle.scales[s] as Scale).tray.map((w, i) => [w, puzzle.solutions[s][i] as number]);

export const driver: Driver = {
  partial: async ({ page, puzzle }) => {
    for (const [w, peg] of moves(puzzle, 0)) await hang(page, w, peg);
    await onScale(page, 2);
    const [first] = moves(puzzle, 1);
    await hang(page, first![0], first![1]);
  },
  solve: async ({ page, puzzle }) => {
    for (const [w, peg] of moves(puzzle, 1).slice(1)) await hang(page, w, peg);
    await onScale(page, 3);
    const last = moves(puzzle, 2);
    for (const [w, peg] of last.slice(0, -1)) await hang(page, w, peg);
    const [w, peg] = last[last.length - 1]!;
    await stage(page).locator(`button[aria-label="Select weight ${w}"]:not(.balance-instrument button)`).first().click();
    await stage(page).getByRole("button", { name: `Place at distance ${peg < 4 ? 4 - peg : peg - 3} on the ${peg < 4 ? "left" : "right"}`, exact: true }).click();
  },
  completeShotMs: 450,
};
