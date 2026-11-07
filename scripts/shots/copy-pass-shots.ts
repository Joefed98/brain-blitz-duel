/**
 * Before / after screenshots for the copy pass's separators (7 Nov 2026; a design tool, not a check): Play, the
 * lobby, standings and Tournaments, plus the round results and the answer reveal (whose headers now take chips), at
 * 390×844 on the real screens through the safe-area harness (network stubbed) on the fixed clock. Run it on main
 * with --tag=before and on the branch with --tag=after.
 *
 *   bun scripts/shots/copy-pass-shots.ts [--out=screenshots/copy-pass-nov-2026] [--tag=after]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, fixThemeClock, openThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/copy-pass-nov-2026";
const TAG = process.argv.find((a) => a.startsWith("--tag="))?.slice(6) ?? "after";
mkdirSync(OUT, { recursive: true });
fixThemeClock();
const viewport = { name: "390x844", w: 390, h: 844, scale: 2 };
const SCREENS: [string, string][] = [
  ["play", "play"],
  ["lobby, 10 players", "lobby"],
  ["standings, 10 players", "standings"],
  ["tournaments", "tournaments"],
  ["round leaderboard, 10 players", "round-results"],
  ["answer reveal (puzzle)", "reveal"],
];
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-copy-pass", buildId: "copy-pass-shots" });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p) => p && existsSync(p)) });
try {
  for (const [name, file] of SCREENS) {
    const screen = THEME_SCREENS.find((s) => s.name === name);
    if (!screen) throw new Error(`no theme screen "${name}"`);
    const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
    await page.screenshot({ path: join(OUT, `${file}-390x844-${TAG}.png`) });
    console.log(`${file}-390x844-${TAG}`);
    if (file === "play") {
      // The rest of the page (the Daily rows) scrolled into view: a full-page shot would draw the fixed tab bar mid-page.
      await page.evaluate(() => {
        for (const el of [document.scrollingElement, ...document.querySelectorAll("*")]) {
          if (el && el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight;
        }
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `${file}-end-390x844-${TAG}.png`) });
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
