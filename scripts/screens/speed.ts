/**
 * The Speed overhaul's screens (phase 2 step 4, 15 Nov 2026; docs/design/pages-review/speed/GALLERY.md) for theme-check
 * and no-wrap-check: each Speed game's page (its tile, goal, how-to lines, challenges and Play), drawn after the core
 * list (scripts/area-screens.ts finds this file). Stage 3 (the levels) adds each page's level choice here.
 */
import type { Page } from "playwright";

import type { ThemeScreen } from "../theme-screens";

/** The six Speed games (Tenfall since 13 Nov 2026), by id. */
export const SPEED_PAGE_GAMES = ["reaction", "numhunt", "chain", "whack", "tendrop", "clayshoot"] as const;

const SPEED_SCREENS = (): ThemeScreen[] =>
  SPEED_PAGE_GAMES.map((type) => ({ name: `speed: game page, ${type}`, mode: "practice", plain: true, search: { page: type }, waitMs: 900 }));

/** This game's own level choice stored on the device (levelChoice.ts), then the page drawn again. */
const atLevel = (type: string, level: string) => async (page: Page) => {
  await page.evaluate(([t, l]) => localStorage.setItem("duelz-levels:v1", JSON.stringify({ catalogue: "normal", games: { [t!]: l } })), [type, level]);
  await page.reload();
  await page.locator(`[data-game-page-level-line='${level}']`).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(400);
};

/** Stage 3 (the levels, 15 Nov 2026): each page with Expert chosen, its level line under the switch. */
const SPEED_LEVEL_SCREENS = (): ThemeScreen[] =>
  SPEED_PAGE_GAMES.map((type) => ({ name: `speed: game page at Expert, ${type}`, mode: "practice", plain: true, search: { page: type }, waitMs: 900, go: atLevel(type, "expert") }));

/** This area's screens for theme-check and no-wrap-check (the area-file shape, scripts/area-screens.ts). */
export default (): ThemeScreen[] => [...SPEED_SCREENS(), ...SPEED_LEVEL_SCREENS()];
