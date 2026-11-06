/**
 * Before / after screenshots for design foundation F1 (6 Nov 2026; a design tool, not a check): Play,
 * Practice, the lobby and standings at 390×844, on the real screens through scripts/theme-screens.ts
 * (network stubbed, fixed clock). Run it on main (in a worktree) with --tag=before and on the branch with
 * --tag=after; the files sit side by side as <screen>-390x844-<tag>.jpg.
 *
 *   bun scripts/shots/design-f1-shots.ts [--out=screenshots/design-f1-nov-2026] [--tag=after] [--scale=2]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, fixThemeClock, openThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/design-f1-nov-2026";
const TAG = process.argv.find((a) => a.startsWith("--tag="))?.slice(6) ?? "after";
const SCALE = Number(process.argv.find((a) => a.startsWith("--scale="))?.slice(8) ?? 2);
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });

fixThemeClock();
const viewport = { name: "390x844", w: 390, h: 844, scale: SCALE };
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-design-f1-shots", buildId: "design-f1-shots" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const [file, name] of [
    ["play", "play"],
    ["practice", "practice list"],
    ["lobby", "lobby, 10 players"],
    ["standings", "standings, 10 players"],
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
