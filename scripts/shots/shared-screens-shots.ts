/**
 * Review screenshots for the shared screens batch (3 Nov 2026; a design tool, not a check): the answer reveal's own
 * screen in a 16-player room (arcade, four bands) at 414×896 (iPhone 11 home-screen app), 390×700 and 375×667; the
 * Practice lists (High Rise in Action, Pull! in Sports, Bomb Defusal in Attention) and the Practice grid with Moon
 * Climb's, Iron Wall's and Ringer's tiles. Drawn through the safe-area harness (the real routes, network stubbed) on
 * the fixed clock. The practice reveals and Curl Champ's buttons come from `bun scripts/shots/capture.ts`.
 *
 *   bun scripts/shots/shared-screens-shots.ts [--out=screenshots/shared-screens-nov-2026]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, ROOM_16_SCREENS, THEME_SCREENS, VIEWPORTS, fixThemeClock, openThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/shared-screens-nov-2026";
mkdirSync(OUT, { recursive: true });
fixThemeClock();
const app = VIEWPORTS[0]!;
const sizes = [
  { ...app, scale: 2 },
  { name: "390x700", w: 390, h: 700, scale: 2 },
  { name: "375x667", w: 375, h: 667, scale: 2 },
];
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-shared-screens", buildId: "shared-screens-shots" });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p) => p && existsSync(p)) });
const size = (v: { w: number; h: number }) => `${v.w}x${v.h}`;
try {
  const reveal = ROOM_16_SCREENS().find((s) => s.name.startsWith("answer reveal (arcade), 16 players"))!;
  for (const v of sizes) {
    const { context, page } = await openThemeScreen(browser, server.origin, reveal, v);
    await page.screenshot({ path: join(OUT, `reveal-room16-${size(v)}.png`) });
    console.log(`reveal-room16-${size(v)}`);
    await context.close();
  }
  const lists: [string, string, string | null][] = [
    ["practice list", "practice-puzzles", "attention"],
    ["practice list, arcade side", "practice-arcade", null],
  ];
  for (const [name, file, chip] of lists) {
    const screen = THEME_SCREENS.find((s) => s.name === name)!;
    for (const v of [sizes[0]!, sizes[2]!]) {
      const { context, page } = await openThemeScreen(browser, server.origin, screen, v);
      await page.screenshot({ path: join(OUT, `${file}-${size(v)}-full.png`), fullPage: true });
      if (chip) {
        await page.locator(`[data-practice-filter='${chip}']`).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(OUT, `${file}-${chip}-${size(v)}.png`) });
      } else {
        for (const group of ["sports", "action"]) {
          await page.locator(`[data-practice-filter='${group}']`).click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: join(OUT, `${file}-${group}-${size(v)}.png`) });
        }
      }
      console.log(`${file}-${size(v)}`);
      await context.close();
    }
  }
  // The Practice grid on the computer layout (tiles at their largest), Action and Sports.
  const desk = VIEWPORTS.find((v) => v.desktop)!;
  const screen = THEME_SCREENS.find((s) => s.name === "practice list, arcade side")!;
  const { context, page } = await openThemeScreen(browser, server.origin, screen, { ...desk, scale: 1 });
  for (const group of ["action", "sports"]) {
    await page.locator(`[data-practice-filter='${group}']`).first().click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(OUT, `practice-grid-${group}-desktop.png`) });
  }
  await context.close();
  console.log("practice grid");
} finally {
  await browser.close();
  await server.close();
}
