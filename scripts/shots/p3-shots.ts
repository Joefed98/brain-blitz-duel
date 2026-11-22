/**
 * P3's review shots (22 Nov 2026; a tool, not a check): the named page screens (scripts/screens/*.ts and the core list)
 * at 390×844 and desktop 1440×900, full page, through the screen harness theme-check uses.
 *
 *   bun scripts/shots/p3-shots.ts <screen name filter…> [--out=<dir>] [--sizes=phone,desktop]
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { allThemeScreens, lightScreens } from "../area-screens";
import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, fixThemeClock, openThemeScreen, type ThemeViewport } from "../theme-screens";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);
const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/p3";
const sizes = (args.find((a) => a.startsWith("--sizes="))?.slice(8) ?? "phone,desktop").split(",");
const only = args.filter((a) => !a.startsWith("--"));
const VIEW: Record<string, ThemeViewport> = {
  phone: { name: "390x844", w: 390, h: 844 },
  small: { name: "375x667", w: 375, h: 667 },
  desktop: { name: "desktop 1440x900", w: 1440, h: 900, desktop: true },
};
const all = await allThemeScreens();
const screens = [...all, ...lightScreens(all)].filter((s) => only.some((o) => s.name.includes(o)));
mkdirSync(out, { recursive: true });
fixThemeClock();
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-theme", buildId: "theme-check" });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p) => existsSync(p)) });
try {
  for (const screen of screens)
    for (const size of sizes) {
      const viewport = VIEW[size]!;
      const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
      try {
        await page.waitForTimeout(400);
        const file = `${out}/${screen.name.replace(/\W+/g, "-")}-${size}.png`;
        writeFileSync(file, await page.screenshot({ fullPage: true }));
        console.log(file);
      } finally {
        await context.close();
      }
    }
} finally {
  await browser.close();
  await server.close();
}
process.exit(0);
