/**
 * The Practice list's Puzzles | Arcade switch (30 Oct 2026, practice-switch-check): a game's button is only on the page
 * while its side is showing (the list opens on the side last chosen, Puzzles on a fresh device). Browser checks that open a
 * game from /practice call showPracticeSide first; it presses the game's side and waits until it is the one showing.
 */
import type { Page } from "playwright";
import { practiceSideOf } from "../src/lib/duel/practiceSide";
import type { PuzzleType } from "../src/lib/duel/types";

export async function showPracticeSide(page: Page, game: string, timeout = 60_000): Promise<void> {
  const side = practiceSideOf(game as PuzzleType);
  const option = page.locator(`[data-practice-side="${side}"]`).first();
  await option.waitFor({ timeout });
  const until = Date.now() + timeout;
  // The switch answers once the page has hydrated: press until it shows this side.
  while ((await page.locator(`[data-practice-switch="${side}"]`).count()) === 0) {
    if (Date.now() > until) throw new Error(`practice side ${side} never showed for ${game}`);
    await option.click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(250);
  }
}
