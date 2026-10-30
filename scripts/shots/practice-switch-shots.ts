/**
 * Review shots of Practice's Puzzles | Arcade switch (30 Oct 2026; a design tool, not a check): both sides at
 * 414×896 as an iPhone 11 home-screen app and at 375×667, the screen and the whole list, at pixel ratio 2.
 *
 *   bun scripts/shots/practice-switch-shots.ts [--out=screenshots/practice-arcade-oct-2026]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, VIEWPORTS, fixThemeClock, openThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/practice-arcade-oct-2026";
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });
fixThemeClock();

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-practice-switch-shots", buildId: "practice-switch-shots" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const [screenName, side] of [["practice list", "puzzles"], ["practice list, arcade side", "arcade"]] as const) {
    const screen = THEME_SCREENS.find((s) => s.name === screenName)!;
    for (const vp of VIEWPORTS.filter((v) => !v.desktop)) {
      const { context, page } = await openThemeScreen(browser, server.origin, screen, { ...vp, scale: 2 });
      try {
        const size = vp.name.split(" ")[0];
        await page.screenshot({ path: join(OUT, `practice-${side}-${size}.png`) });
        await page.screenshot({ path: join(OUT, `practice-${side}-${size}-full.png`), fullPage: true });
        console.log(`wrote practice-${side}-${size}(.png, -full.png)`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(0);
