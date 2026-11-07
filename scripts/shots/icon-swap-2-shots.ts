/**
 * Before / after screenshots for icon swap 2 (7 Nov 2026; a design tool, not a check): Play, Practice, the lobby
 * and the offline banner (Practice with <html data-offline>) at 390×844, on the real screens through
 * scripts/theme-screens.ts (network stubbed, fixed clock). Run it on main (in a worktree, with this file copied
 * in) with --tag=before and on the branch with --tag=after; the files sit side by side as
 * <screen>-390x844-<tag>.jpg.
 *
 *   bun scripts/shots/icon-swap-2-shots.ts [--out=screenshots/icon-swap-2-nov-2026] [--tag=after] [--scale=2]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, fixThemeClock, openThemeScreen, type ThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/icon-swap-2-nov-2026";
const TAG = process.argv.find((a) => a.startsWith("--tag="))?.slice(6) ?? "after";
const SCALE = Number(process.argv.find((a) => a.startsWith("--scale="))?.slice(8) ?? 2);
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });

const theme = (name: string): ThemeScreen => {
  const screen = THEME_SCREENS.find((s) => s.name === name);
  if (!screen) throw new Error(`no theme screen "${name}"`);
  return screen;
};

fixThemeClock();
const viewport = { name: "390x844", w: 390, h: 844, scale: SCALE };
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-icon-swap-2-shots", buildId: "icon-swap-2-shots" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const [file, screen, offline] of [
    ["play", theme("play"), false],
    ["practice", theme("practice list"), false],
    ["lobby", theme("lobby, 2 players"), false],
    ["offline-banner", theme("practice list"), true],
  ] as const) {
    const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
    try {
      if (offline) await page.evaluate(() => document.documentElement.setAttribute("data-offline", ""));
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(OUT, `${file}-390x844-${TAG}.jpg`), type: "jpeg", quality: 82 });
      // The whole page too (Play's Challenge row and Practice's offline marks sit below the fold).
      if (file === "play" || file === "practice")
        await page.screenshot({ path: join(OUT, `${file}-full-390x844-${TAG}.jpg`), type: "jpeg", quality: 78, fullPage: true });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`screenshots in ${OUT}`);
