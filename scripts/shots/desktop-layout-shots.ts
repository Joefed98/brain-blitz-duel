/**
 * Review screenshots for the computer layout (31 Oct 2026, docs/desktop-layout.md): Practice, Play, a room
 * lobby of 16, a room mid-round with a tall game (Apex), a rotated game (Cue Ball), a wide puzzle (Box Six)
 * and a card game (Free Cell), at 1440×900 and 1920×1080; the 1024×768 layout and both phone sizes (414×896
 * home-screen app, 375×667) to show the phones unchanged. Drawn through the safe-area harness (the real
 * routes, network stubbed) on the fixed clock.
 *
 *   bun scripts/shots/desktop-layout-shots.ts [name filters…] [--sizes=1440x900,…] [--out=screenshots/desktop-layout-oct-2026]
 */
import { existsSync, mkdirSync } from "node:fs";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, VIEWPORTS, fixThemeClock, openThemeScreen, type ThemeScreen, type ThemeViewport } from "../theme-screens";
import { DESKTOP_LAYOUT_SCREENS } from "../desktop-layout-screens";

const args = process.argv.slice(2);
const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/desktop-layout-oct-2026";
const sizeArg = args.find((a) => a.startsWith("--sizes="))?.slice(8);
mkdirSync(out, { recursive: true });
const only = args.filter((a) => !a.startsWith("--"));
const screens: ThemeScreen[] = DESKTOP_LAYOUT_SCREENS.filter((s) => !only.length || only.some((o) => s.name.includes(o)));
const phone = VIEWPORTS.filter((v) => !v.desktop);
const viewports: ThemeViewport[] = sizeArg
  ? sizeArg.split(",").map((s) => {
      const [w, h] = s.split("x").map(Number) as [number, number];
      return phone.find((v) => v.w === w && v.h === h) ?? { name: s, w, h, desktop: true };
    })
  : [
      { name: "1440x900", w: 1440, h: 900, desktop: true },
      { name: "1920x1080", w: 1920, h: 1080, desktop: true },
      { name: "1024x768", w: 1024, h: 768, desktop: true },
      ...phone,
    ];
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-desktop-layout", buildId: "desktop-layout-shots" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p) => p && existsSync(p)) });
try {
  for (const screen of screens)
    for (const viewport of viewports) {
      const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
      page.on("pageerror", (e) => console.log(`page error (${screen.name}): ${e.message}`));
      const file = `${out}/${screen.name.replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "")}-${viewport.w}x${viewport.h}.png`;
      await page.screenshot({ path: file });
      console.log(file);
      await context.close();
    }
} finally {
  await browser.close();
  await server.close();
}
