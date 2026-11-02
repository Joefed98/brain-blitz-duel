/**
 * Review screenshots for rooms of 16 (31 Oct 2026): the lobby (and its colour wheel), round results,
 * standings, the arcade reveal's chart (four part lines) and the podium with 16 players, and Profile's
 * colour wheel, at 414×896 (iPhone 11 home-screen app) and 375×667. Drawn through the safe-area harness
 * (the real routes, network stubbed) on the fixed clock.
 *
 *   bun scripts/shots/room16-shots.ts [name filters…] [--out=screenshots/room16-oct-2026]
 */
import { mkdirSync } from "node:fs";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, ROOM_16_SCREENS, THEME_SCREENS, VIEWPORTS, fixThemeClock, openThemeScreen } from "../theme-screens";
import { existsSync } from "node:fs";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/room16-oct-2026";
mkdirSync(out, { recursive: true });
const only = process.argv.filter((a) => !a.startsWith("--")).slice(2);
const screens = [...ROOM_16_SCREENS(), THEME_SCREENS.find((s) => s.name === "profile, colour wheel")!].filter(
  (s) => !only.length || only.some((o) => s.name.includes(o)),
);
const viewports = VIEWPORTS.filter((v) => !v.desktop).map((v) => ({ ...v, scale: 2 }));
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-room16", buildId: "room16-shots" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p) => p && existsSync(p)) });
try {
  for (const screen of screens)
    for (const viewport of viewports) {
      const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
      const file = `${out}/${screen.name.replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "")}-${viewport.w}x${viewport.h}.png`;
      await page.screenshot({ path: file });
      console.log(file);
      await context.close();
    }
} finally {
  await browser.close();
  await server.close();
}
