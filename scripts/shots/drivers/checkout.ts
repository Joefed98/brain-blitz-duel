import type { Page } from "playwright";
import type { Driver } from "../number-drivers";
import { searchCheckout, CHECKOUT_BULL, type CheckoutDart } from "@/lib/duel/checkout";
import type { CheckoutStageData } from "@/lib/duel/types";

/*
 * Checkout: the driver proves its own route per stage with the game's exhaustive search
 * (read-only rules), then plays it through the real UI: board tab, wedge (by its
 * data-puzzle-cell, as labelled before and after polish), ring button, Throw.
 */
const stage = (page: Page) => page.locator("[data-game-stage]");

const routeFor = (s: CheckoutStageData): CheckoutDart[] => {
  const found = searchCheckout(s).route;
  if (!found) throw new Error("Checkout: no route");
  return found;
};

async function openBoard(page: Page, index: number) {
  await stage(page).getByRole("tab").nth(index).click();
  held = null;
  await page.waitForTimeout(200);
}

/** The wedge left selected by the last dart: tapping it again would deselect it. */
let held: number | null = null;

async function dart(page: Page, d: CheckoutDart) {
  const st = stage(page);
  if (held !== d.wedge) {
    const cell = d.wedge === CHECKOUT_BULL ? "bull" : `w${d.wedge}`;
    await st.locator(`[data-checkout-hits] [data-puzzle-cell="${cell}"]`).dispatchEvent("click");
    await page.waitForTimeout(150);
  }
  held = d.wedge;
  const label = d.wedge === CHECKOUT_BULL ? (d.ring === 2 ? "Bull 50" : "25") : `x${d.ring}`;
  await st
    .locator('[data-game-controls="rings"] button', { hasText: label })
    .first()
    .click();
  await page.waitForTimeout(300);
}

async function playStage(page: Page, puzzle: Record<string, any>, index: number, from = 0) {
  const s = puzzle.stages[index] as CheckoutStageData;
  if (from === 0) await openBoard(page, index);
  for (const d of routeFor(s).slice(from)) await dart(page, d);
  await stage(page).getByRole("button", { name: "Throw", exact: true }).click();
  held = null;
}

export const driver: Driver = {
  partial: async ({ page, puzzle }) => {
    await playStage(page, puzzle, 0);
    await page.waitForTimeout(1100);
    await openBoard(page, 1);
    await dart(page, routeFor(puzzle.stages[1])[0]!);
  },
  solve: async ({ page, puzzle }) => {
    await playStage(page, puzzle, 1, 1);
    for (let i = 2; i < puzzle.stages.length; i++) {
      await page.waitForTimeout(1100);
      await playStage(page, puzzle, i);
    }
  },
  completeShotMs: 380,
};
