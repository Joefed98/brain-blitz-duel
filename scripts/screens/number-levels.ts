/**
 * The Number levels' screens (D2, 22 Nov 2026) for theme-check and no-wrap-check: each Number game's page with a level
 * chosen, its level switch and that level's one line under it (src/lib/levels/number.ts). The four games whose boards
 * grow with the level (Kakuro, Integer Pyramid, Counterweight, Operator) at Hard and Expert, the other four at Expert.
 * The boards themselves are game screens, never skinned: they are measured by scripts/shots/number-level-cells.ts
 * (screenshots/d2-number-levels-nov-2026/). Drawn after the core list (scripts/area-screens.ts finds this file).
 */
import type { Page } from "playwright";

import type { ThemeScreen } from "../theme-screens";

/** The Number games whose boards grow with the level. */
export const NUMBER_BIG_BOARD_GAMES = ["kakuro", "numpyramid", "balance", "equation"] as const;
/** The other Number games. */
export const NUMBER_OTHER_GAMES = ["target", "measure", "checkout", "numline"] as const;

/** This game's own level choice stored on the device (levelChoice.ts), then the page drawn again with its line. */
const atLevel = (type: string, level: string) => async (page: Page) => {
  await page.evaluate(([t, l]) => localStorage.setItem("duelz-levels:v1", JSON.stringify({ catalogue: "normal", games: { [t!]: l } })), [type, level]);
  await page.reload();
  await page.locator(`[data-game-page-level-about='${level}']`).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(400);
};

const pageAt = (type: string, level: "hard" | "expert"): ThemeScreen => ({
  name: `number levels: game page at ${level === "hard" ? "Hard" : "Expert"}, ${type}`,
  mode: "practice",
  plain: true,
  search: { page: type },
  waitMs: 900,
  go: atLevel(type, level),
});

/** This area's screens for theme-check and no-wrap-check (the area-file shape, scripts/area-screens.ts). */
export default (): ThemeScreen[] => [
  ...NUMBER_BIG_BOARD_GAMES.flatMap((type) => [pageAt(type, "hard"), pageAt(type, "expert")]),
  ...NUMBER_OTHER_GAMES.map((type) => pageAt(type, "expert")),
];
