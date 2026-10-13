import type { Page } from "playwright";
import type { Driver } from "../number-drivers";

const stage = (page: Page) => page.locator("[data-game-stage]");
const label = (op: string) => (op === "-" ? "−" : op);

/* Operator: tap from the four-button pad (the slots also show operators once filled). */
async function fill(page: Page, ops: string[], settle = 180) {
  const pad = stage(page).locator('[data-equation-pad] button, [data-polish="equation"] .grid-cols-4 > button');
  for (const [i, op] of ops.entries()) {
    await pad.filter({ hasText: label(op) }).first().click();
    const pause = i < ops.length - 1 ? 180 : settle;
    if (pause) await page.waitForTimeout(pause);
  }
}

/* A solved stage is held about 1 s, then the next one comes in. */
const nextStage = (page: Page) => page.waitForTimeout(1400);

export const driver: Driver = {
  partial: async ({ page, puzzle }) => {
    await fill(page, puzzle.operators[0]);
    await nextStage(page);
    await fill(page, puzzle.operators[1].slice(0, 2));
  },
  solve: async ({ page, puzzle }) => {
    await fill(page, puzzle.operators[1].slice(2));
    await nextStage(page);
    await fill(page, puzzle.operators[2]);
    await nextStage(page);
    // The last tap solves the puzzle; the shot follows completeShotMs later.
    await fill(page, puzzle.operators[3], 0);
  },
  completeShotMs: 500,
};
