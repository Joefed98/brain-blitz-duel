/**
 * Before / after screenshots for the icon swap (7 Nov 2026; a design tool, not a check): the tab bar, Play,
 * a game header with the game menu open, the lobby and Settings at 390×844, on the real screens through
 * scripts/theme-screens.ts (network stubbed, fixed clock). Run it on main (in a worktree, with this file
 * copied in) with --tag=before and on the branch with --tag=after; the files sit side by side as
 * <screen>-390x844-<tag>.jpg.
 *
 *   bun scripts/shots/icon-swap-shots.ts [--out=screenshots/icon-swap-nov-2026] [--tag=after] [--scale=2]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, fixThemeClock, openThemeScreen, room, type ThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/icon-swap-nov-2026";
const TAG = process.argv.find((a) => a.startsWith("--tag="))?.slice(6) ?? "after";
const SCALE = Number(process.argv.find((a) => a.startsWith("--scale="))?.slice(8) ?? 2);
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });

const theme = (name: string): ThemeScreen => {
  const screen = THEME_SCREENS.find((s) => s.name === name);
  if (!screen) throw new Error(`no theme screen "${name}"`);
  return screen;
};
const gameMenu: ThemeScreen = {
  name: "room round intro, game menu open",
  mode: "room",
  room: room("in_progress", "intro"),
  go: async (page) => {
    await page.locator("[data-game-menu-button]").first().click();
    await page.locator("[data-game-menu-sheet]").waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
  },
};

fixThemeClock();
const viewport = { name: "390x844", w: 390, h: 844, scale: SCALE };
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-icon-swap-shots", buildId: "icon-swap-shots" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const [file, screen, clipTabBar] of [
    ["play", theme("play"), false],
    ["tab-bar", theme("profile"), true],
    ["game-menu", gameMenu, false],
    ["lobby", theme("lobby, 2 players"), false],
    ["settings", theme("settings sheet"), false],
  ] as const) {
    const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
    try {
      await page.waitForTimeout(600);
      const path = join(OUT, `${file}-390x844-${TAG}.jpg`);
      if (clipTabBar) {
        const bar = await page.locator("[data-app-tabbar]").first().boundingBox();
        if (!bar) throw new Error("no tab bar on the profile screen");
        await page.screenshot({ path, type: "jpeg", quality: 85, clip: { x: 0, y: bar.y - 8, width: viewport.w, height: bar.height + 16 } });
      } else {
        await page.screenshot({ path, type: "jpeg", quality: 82 });
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`screenshots in ${OUT}`);
