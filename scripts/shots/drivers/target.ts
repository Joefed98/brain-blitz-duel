import type { Page } from "playwright";
import type { Driver } from "../number-drivers";

export const stage = (page: Page) => page.locator("[data-game-stage]");

/* Exact: tiles by value (active ones only), then an operator, then the second tile. */
async function exactStep(page: Page, a: number, op: string, b: number) {
  const tiles = stage(page).locator('[data-game-controls="numbers"] button:not([disabled])');
  const tap = async (value: number, skipFirst = false) => {
    const n = await tiles.count();
    let seen = false;
    for (let i = 0; i < n; i++) {
    const t = tiles.nth(i);
    if ((await t.innerText()).trim() !== String(value)) continue;
    const selected = (await t.getAttribute("aria-pressed")) === "true" || /border-primary|selected/.test((await t.getAttribute("class")) ?? "") || (await t.getAttribute("data-selected")) === "true";
    if (skipFirst && selected && !seen) { seen = true; continue; }
    await t.click();
    return;
    }
    throw new Error(`Exact: no tile ${value}`);
};
  await tap(a);
  const label = op === "-" ? "−" : op;
  await stage(page).locator('[data-game-controls="operators"] button', { hasText: label }).first().click();
  await tap(b, a === b);
  await page.waitForTimeout(250);
}

export const driver: Driver = {
  partial: async ({ page, puzzle }) => {
    const [s0, s1] = puzzle.solution;
    await exactStep(page, s0.a, s0.operator, s0.b);
    await exactStep(page, s1.a, s1.operator, s1.b);
  },
  solve: async ({ page, puzzle }) => {
    for (const s of puzzle.solution.slice(2)) await exactStep(page, s.a, s.operator, s.b);
  },
  completeShotMs: 200,
};
