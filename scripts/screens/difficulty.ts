/**
 * The difficulty framework's screens (phase 2 step 4, 15 Nov 2026; docs/design/difficulty/README.md) for theme-check
 * and no-wrap-check: the Games page's top (the Puzzles | Arcade switch, the category tiles and the difficulty switch)
 * on Arcade at Hard, a game's page with its level selector (a stand-in registry, `__DUELZ_GAME_LEVELS__`: no game has
 * levels yet) and a game's page at a level it lacks, the room settings sheet's Difficulty choice and a Hard room's
 * lobby summary. Drawn after the core list (scripts/area-screens.ts finds this file).
 */
import type { Page } from "playwright";

import { gamesProgressFixture } from "./games";
import { ALL_SIZES, NAV_SIZES, room, type ThemeScreen } from "../theme-screens";

/** A stand-in registry: Polypotions with Easy and Hard (an open stand-in reason: nothing is dealt from it here). */
const STAND_IN_LEVELS = {
  tubes: {
    levels: {
      easy: { settings: {}, oneSolution: { open: "screens only" } },
      hard: { settings: {}, oneSolution: { open: "screens only" } },
    },
  },
};

const arcadeHard = async (page: Page) => {
  await page.locator("[data-practice-side='arcade']").click();
  await page.locator("[data-catalogue-level] [data-level-option='hard']").click();
  await page.waitForTimeout(300);
};

/** The catalogue's level set to Expert on this device, then the page drawn again. */
const expertStored = async (page: Page) => {
  await page.evaluate(() => localStorage.setItem("duelz-levels:v1", JSON.stringify({ catalogue: "expert", games: {} })));
  await page.reload();
  await page.locator("[data-game-page]").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(600);
};

export const DIFFICULTY_SCREENS = (): ThemeScreen[] => {
  const data = { __harnessProgress: gamesProgressFixture() };
  return [
    // The first-time explanation (Joe, 15 Nov 2026): a new device's first look at the selector.
    { name: "difficulty: catalogue, first-time explanation", mode: "practice", globals: data, sizes: NAV_SIZES },
    { name: "difficulty: catalogue, Arcade on Hard", mode: "practice", globals: data, sizes: NAV_SIZES, go: arcadeHard },
    {
      name: "difficulty: game page with levels",
      mode: "practice",
      plain: true,
      search: { page: "tubes" },
      globals: { ...data, __DUELZ_GAME_LEVELS__: STAND_IN_LEVELS },
      sizes: NAV_SIZES,
      waitMs: 900,
    },
    {
      name: "difficulty: game page, a level it lacks",
      mode: "practice",
      plain: true,
      search: { page: "pool" },
      globals: data,
      sizes: NAV_SIZES,
      waitMs: 900,
      go: expertStored,
    },
    {
      name: "difficulty: room settings sheet, Hard",
      mode: "room",
      room: room("waiting", "starting", { players: 3 }),
      sizes: ALL_SIZES,
      go: async (page: Page) => {
        await page.locator("[data-room-settings]").click();
        await page.locator("[data-room-settings-sheet]").waitFor({ timeout: 10_000 });
        await page.locator("[data-room-level-switch] [data-level-option='hard']").click();
        await page.locator("[data-room-level]").scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
      },
    },
    {
      name: "difficulty: lobby, a Hard room",
      mode: "room",
      room: room("waiting", "starting", { host: "u2", players: 3, settings: ["pattern", "logic", "rounds:6", "groups:2", "level:hard"] }),
      sizes: ALL_SIZES,
    },
  ];
};

/** This area's screens for theme-check and no-wrap-check (the area-file shape, scripts/area-screens.ts). */
export default (): ThemeScreen[] => DIFFICULTY_SCREENS();
