/**
 * Opening a game from the Games tab (/practice) in a browser check.
 *
 * Changed with Joe's approval, 14 Nov 2026 (routine consequence of the Games catalogue, phase 2 step 3): the Practice
 * list's Puzzles | Arcade switch (30 Oct 2026) is gone for chips, and every playable game's tile is on the one page,
 * so showPracticeSide only waits for the game's tile to be there and the page to answer taps (it pressed the game's
 * side until it showed). A tile now opens the game's page, whose Play opens the round's intro already in its 3-2-1;
 * a `/practice?game=<id>` link still opens the round's full intro (Goal, How, Ready) at once, so checks that judge the
 * intro or press Ready open the game that way (practiceGameUrl), and checks that only need the live round may go
 * through the page (playFromCatalogue).
 */
import type { Page } from "playwright";

import { gameDisplayName } from "../src/lib/duel/gameNames";
import type { PuzzleType } from "../src/lib/duel/types";

export async function showPracticeSide(page: Page, game: string, timeout = 60_000): Promise<void> {
  const tile = page.locator(`[data-practice-game="${game}"]`).first();
  await tile.waitFor({ timeout });
  // The catalogue answers taps once the page has hydrated (it marks itself data-hydrated from an effect).
  await page.locator("[data-games-catalogue][data-hydrated]").first().waitFor({ timeout });
}

/** The link that opens a game's round with its full intro (Goal, How, Ready), as the list's tile did until 14 Nov 2026. */
export function practiceGameUrl(origin: string, game: string): string {
  return `${origin}/practice?game=${encodeURIComponent(game)}`;
}

/** From the catalogue: the game's tile, then its page's Play; the intro opens counting down (no Ready). */
export async function playFromCatalogue(page: Page, game: string, timeout = 60_000): Promise<void> {
  await showPracticeSide(page, game, timeout);
  await page.getByRole("button", { name: gameDisplayName(game as PuzzleType), exact: true }).first().click({ timeout });
  const play = page.locator(`[data-game-page-play="${game}"]`).first();
  await play.waitFor({ timeout });
  await play.click({ timeout });
}
