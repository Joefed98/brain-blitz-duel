/**
 * Review screenshots of the Games session's screens (phase 2 step 3, 14 Nov 2026): every screen of scripts/screens/
 * games.ts at the sizes asked, from the screen harness. A tool, not a check.
 *
 *   bun scripts/shots/games-shots.ts [--out=<dir>] [--sizes=390x844,1366x768] [name filter…]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { startSafeAreaServer } from "../safe-area-server";
import { ALL_SIZES, CHROMIUM_PATHS, NAV_SIZES, THEME_SCREENS, fixThemeClock, openThemeScreen, type ThemeViewport } from "../theme-screens";

const args = process.argv.slice(2);
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/games";
const SIZES = args.find((a) => a.startsWith("--sizes="))?.slice(8);
const ONLY = args.filter((a) => !a.startsWith("--"));
mkdirSync(OUT, { recursive: true });
const known = [...ALL_SIZES, ...NAV_SIZES, { name: "375x667", w: 375, h: 667 }];
const sizes: ThemeViewport[] = SIZES
  ? SIZES.split(",").map((s) => {
      const [w, h] = s.split("x").map(Number) as [number, number];
      return known.find((v) => v.w === w && v.h === h) ?? { name: s, w, h, desktop: w >= 1024 };
    })
  : [{ name: "390x844", w: 390, h: 844 }];
const screens = THEME_SCREENS.filter((s) => s.name.startsWith("games") && (ONLY.length === 0 || ONLY.some((o) => s.name.includes(o))));
fixThemeClock();
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-games-shots", buildId: "games-shots" });
const { chromium } = await import("playwright");
const { existsSync } = await import("node:fs");
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p))) });
try {
  for (const screen of screens)
    for (const viewport of sizes) {
      const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
      const file = join(OUT, `${screen.name.replace(/\W+/g, "-")}-${viewport.w}x${viewport.h}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
      await context.close();
    }
} finally {
  await browser.close();
  await server.close();
}
