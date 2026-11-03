/**
 * The 16-player room reveal's snake chart on chosen games' gradients (3 Nov 2026: the chart draws straight on the
 * reveal's gradient, no panel). A tool, not a check.
 *
 *   bun scripts/shots/chart-gradient-shots.ts --out=<dir> [--tag=after] [types…]   (default: pyramid orbit)
 *
 * Writes <dir>/room16-reveal-<type>-<viewport>-<tag>.png at 414x896 (home-screen app) and 375x667, deviceScaleFactor 2.
 * Works on any tree with scripts/theme-screens.ts (main included), for before / after pairs.
 */
import { existsSync, mkdirSync } from "node:fs";
import { startSafeAreaServer } from "../safe-area-server";
import { VIEWPORTS, fixThemeClock, openThemeScreen, room, type ThemeScreen } from "../theme-screens";

const args = process.argv.slice(2);
const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/chart-gradient";
const tag = args.find((a) => a.startsWith("--tag="))?.slice(6) ?? "after";
const types = args.filter((a) => !a.startsWith("--"));
const games = types.length ? types : ["pyramid", "orbit"];
mkdirSync(out, { recursive: true });

const CHROMIUM = ["/opt/pw-browsers/chromium", process.env.PLAYWRIGHT_CHROMIUM].find((p) => p && existsSync(p));
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-chart-shots", buildId: "chart-gradient-shots" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
try {
  for (const type of games)
    for (const viewport of VIEWPORTS.filter((v) => !v.desktop)) {
      const screen: ThemeScreen = {
        name: `answer reveal (arcade), 16 players, ${type}`,
        mode: "room",
        room: room("in_progress", "reveal", { arcade: true, arcadeType: type, players: 16, revealParts: true, meAt: 12 }),
        waitMs: 2500,
        plain: true,
      } as ThemeScreen;
      const { context, page } = await openThemeScreen(browser, server.origin, { ...screen }, { ...viewport, scale: 2 });
      const file = `${out}/room16-reveal-${type}-${viewport.w}x${viewport.h}-${tag}.png`;
      await page.screenshot({ path: file });
      console.log(`wrote ${file}`);
      await context.close();
    }
} finally {
  await browser.close();
  await server.close();
}
process.exit(0);
