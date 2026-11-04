import type { Page } from "playwright";
import type { Driver } from "../driver";

const stage = (page: Page) => page.locator("[data-game-stage]");
const label = (op: string) => (op === "-" ? "−" : op);

/* Operator (signs only): tap from the four-button pad (the slots also show operators once filled). */
async function fillSigns(page: Page, ops: string[], settle = 180) {
  const pad = stage(page).locator('[data-equation-pad] button, [data-polish="equation"] .grid-cols-4 > button');
  for (const [i, op] of ops.entries()) {
    await pad.filter({ hasText: label(op) }).first().click();
    const pause = i < ops.length - 1 ? 180 : settle;
    if (pause) await page.waitForTimeout(pause);
  }
}

/* Operator's gaps (gapsRev 1): each fill in reading order, a sign key or an unused tray number. */
async function fillGaps(page: Page, fills: string[], settle = 180) {
  for (const [i, f] of fills.entries()) {
    const sign = ["+", "-", "×", "÷"].includes(f);
    const keys = stage(page).locator(`[data-equation-pad] button[data-kind="${sign ? "sign" : "number"}"]:not([data-used])`);
    await keys.filter({ hasText: new RegExp(`^${sign ? `\\${label(f)}` : f}$`) }).first().click();
    const pause = i < fills.length - 1 ? 180 : settle;
    if (pause) await page.waitForTimeout(pause);
  }
}

type Full = { operators?: string[][]; gapAnswers?: string[] };
const steps = (p: Full, i: number): string[] => (p.gapAnswers ? (p.gapAnswers[i] ?? "").split(",") : p.operators![i]!);
const fill = (page: Page, p: Full, tokens: string[], settle?: number) => (p.gapAnswers ? fillGaps(page, tokens, settle) : fillSigns(page, tokens, settle));

/* A solved stage is held about 1 s, then the next one comes in. */
const nextStage = (page: Page) => page.waitForTimeout(1400);

export const driver: Driver = {
  partial: async ({ page, puzzle }) => {
    await fill(page, puzzle, steps(puzzle, 0));
    await nextStage(page);
    await fill(page, puzzle, steps(puzzle, 1).slice(0, 2));
  },
  solve: async ({ page, puzzle }) => {
    await fill(page, puzzle, steps(puzzle, 1).slice(2));
    await nextStage(page);
    await fill(page, puzzle, steps(puzzle, 2));
    await nextStage(page);
    // The last tap solves the puzzle; the shot follows solveShotsMs later.
    await fill(page, puzzle, steps(puzzle, 3), 0);
  },
  solveShotsMs: [500],
};
