/**
 * Before / after screenshots for the text emphasis pass (DESIGN.md section 3, "one bright thing per panel";
 * 6 Nov 2026; a design tool, not a check): the four tab pages, the lobby, round results, standings, the
 * two-player final and the podium at 390×844, on the real screens through scripts/theme-screens.ts (network
 * stubbed, fixed clock). Run it on main (in a worktree) with --tag=before and on the branch with --tag=after;
 * the files sit side by side as <screen>-390x844-<tag>.jpg.
 *
 *   bun scripts/shots/text-emphasis-shots.ts [--out=screenshots/text-emphasis-nov-2026] [--tag=after] [--scale=2]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, fixThemeClock, openThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/text-emphasis-nov-2026";
const TAG = process.argv.find((a) => a.startsWith("--tag="))?.slice(6) ?? "after";
const SCALE = Number(process.argv.find((a) => a.startsWith("--scale="))?.slice(8) ?? 2);
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });

fixThemeClock();
const viewport = { name: "390x844", w: 390, h: 844, scale: SCALE };
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-text-emphasis-shots", buildId: "text-emphasis-shots" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const [file, name] of [
    ["play", "play"],
    ["practice", "practice list"],
    ["practice-arcade", "practice list, arcade side"],
    ["tournaments", "tournaments"],
    ["profile", "profile"],
    ["lobby", "lobby, 10 players"],
    ["round-results", "round leaderboard, 10 players"],
    ["round-results-2p", "round leaderboard, 2 players"],
    ["standings", "standings, 10 players"],
    ["final-2p", "final results, 2 players"],
    ["podium", "podium, 10 players"],
  ] as const) {
    const screen = THEME_SCREENS.find((s) => s.name === name);
    if (!screen) throw new Error(`no theme screen "${name}"`);
    const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
    try {
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(OUT, `${file}-390x844-${TAG}.jpg`), type: "jpeg", quality: 82 });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`screenshots in ${OUT}`);
