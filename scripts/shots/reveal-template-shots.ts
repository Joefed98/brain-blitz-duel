/**
 * Review shots of the reveal template (P2, 21 Nov 2026): a puzzle reveal and an arcade reveal in practice (left untouched
 * until the clock runs out), and a room's arcade reveal on both its views, at 390 × 844 and 375 × 667, phone pixels
 * (deviceScaleFactor 2). The practice reveals come from a dev server (SHOTS_ORIGIN, default http://127.0.0.1:5193; start
 * it with `npx vite dev --port 5193 --host 127.0.0.1 --strictPort`), the room's from the screen harness.
 *
 *   bun scripts/shots/reveal-template-shots.ts [--out=screenshots/reveal-template-nov-2026]
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, openThemeScreen, room, type ThemeScreen } from "../theme-screens";

const origin = process.env.SHOTS_ORIGIN ?? "http://127.0.0.1:5193";
const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/reveal-template-nov-2026";
mkdirSync(OUT, { recursive: true });
const SIZES = [
  [390, 844],
  [375, 667],
] as const;
const REVEAL = "[data-reveal-score], [data-arcade-reveal]";
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
const browser = await chromium.launch({ executablePath: CHROMIUM });

async function practice(game: string, w: number, h: number, file: string) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.clock.install();
    await page.goto(`${origin}/practice?game=${game}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 90_000 });
    await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await page.clock.fastForward(200_000);
    for (let i = 0; i < 400 && !(await page.locator(REVEAL).count()); i++) await page.clock.runFor(500);
    await page.locator(REVEAL).first().waitFor({ timeout: 60_000 });
    await page.clock.runFor(2500);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${file}-${w}x${h}.png` });
  } finally {
    await context.close();
  }
}

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-reveal-shots", buildId: "reveal-shots" });
try {
  for (const [w, h] of SIZES) {
    await practice("sudoku", w, h, "practice-puzzle-box-six");
    await practice("swing", w, h, "practice-arcade-grappler");
    const screen: ThemeScreen = { name: "room reveal", mode: "room", plain: true, room: room("in_progress", "reveal", { arcade: true, players: 10, revealParts: true }), waitMs: 1500 };
    const { context, page } = await openThemeScreen(browser, server.origin, screen, { name: `${w}x${h}`, w, h, scale: 2 });
    try {
      await page.screenshot({ path: `${OUT}/room-arcade-room-view-${w}x${h}.png` });
      await page.getByRole("radio", { name: "Your run" }).click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/room-arcade-your-run-${w}x${h}.png` });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`wrote ${OUT}`);
