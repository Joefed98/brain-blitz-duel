/**
 * The Attention overhaul's screens (phase 2 step 4, 15 Nov 2026; docs/design/attention-overhaul.md) for theme-check and
 * no-wrap-check: each of the six Attention games' pages (their goal and how-to lines, changed for the new stamps: Double
 * Take's Next and misses, Tally's marks, Labyrinth's backtracking and controls, Bomb Defusal's "nothing reacts live",
 * Matchmaker's quick flip-back) and Settings with its Game controls (the arrows / joystick choice Labyrinth's game menu
 * now shares), at every size. Drawn after the core list (scripts/area-screens.ts finds this file).
 */
import type { Page } from "playwright";

import { ALL_SIZES, NAV_SIZES, type ThemeScreen } from "../theme-screens";

/** Stage 3 (the levels): the game's own level set to Expert on this device, then its page drawn again. */
const atExpert = (type: string) => async (page: Page) => {
  await page.evaluate((t) => localStorage.setItem("duelz-levels:v1", JSON.stringify({ catalogue: "normal", games: { [t]: "expert" } })), type);
  await page.reload();
  await page.locator("[data-game-page]").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(600);
};

const GAMES = [
  ["symscan", "Eagle Eye"],
  ["spotdiff", "Double Take"],
  ["countup", "Tally"],
  ["maze", "Labyrinth"],
  ["bomb", "Bomb Defusal"],
  ["pairmatch", "Matchmaker"],
] as const;

export default function attentionScreens(): ThemeScreen[] {
  return [
    ...GAMES.map(([type, name]): ThemeScreen => ({
      name: `attention: game page, ${name}`,
      mode: "practice",
      plain: true,
      search: { page: type },
      sizes: NAV_SIZES,
      waitMs: 900,
    })),
    // Stage 3: each game's page on Expert (its level selector and the level's lines).
    ...GAMES.map(([type, name]): ThemeScreen => ({
      name: `attention: game page at Expert, ${name}`,
      mode: "practice",
      plain: true,
      search: { page: type },
      sizes: NAV_SIZES,
      waitMs: 900,
      go: atExpert(type),
    })),
    { name: "attention: settings, game controls", mode: "settings", plain: true, sizes: ALL_SIZES, waitMs: 600 },
  ];
}
