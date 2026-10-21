/**
 * Screenshots of the daily challenge for review (21 Oct 2026; a design tool, not a check): the Play
 * tab's Daily challenge card, /daily before and after playing, the daily results and Profile's Daily
 * row, at 414×896 as an iPhone 11 home-screen app, on the real screens with only the network edge
 * stubbed (scripts/safe-area-harness.tsx, H.daily). The rounds are real dealt puzzles (a fixed seed)
 * with sample results; names and scores are made up.
 *
 *   bun scripts/shots/daily-shots.ts [--out=screenshots/daily-oct-2026]
 */
import { existsSync, mkdirSync } from "node:fs";

import { chromium } from "playwright";

import { DEVICE_INIT, IPHONE11_APP, emulateDevice } from "../device-emulation";
import { startSafeAreaServer } from "../safe-area-server";
import { dailyFixture } from "../daily-fixture";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/daily-oct-2026";
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);
mkdirSync(OUT, { recursive: true });

const { before, after, record } = dailyFixture();
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-daily-shots", buildId: "daily-shots" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
async function shot(name: string, mode: string, daily: unknown, act?: (page: import("playwright").Page) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width: IPHONE11_APP.w, height: IPHONE11_APP.h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.addInitScript(DEVICE_INIT);
  await page.addInitScript(
    ([d, record]) => {
      (window as unknown as { __harness: unknown }).__harness = { puzzles: {}, verdict: { isCorrect: true, score: 150 }, latencyMs: 50, submissions: [], verdictAt: null, room: null, daily: d };
      localStorage.setItem("duelz_onboarding_seen", "1");
      localStorage.setItem("duelz_display_name", "Joe");
      localStorage.setItem("duelz_player_look", JSON.stringify({ colour: 6, icon: null }));
      localStorage.setItem(record[0], record[1]);
    },
    [daily, record] as const,
  );
  await emulateDevice(page, IPHONE11_APP);
  try {
    await page.goto(`${server.origin}/safe-area.html?mode=${mode}`, { timeout: 180_000 });
    await page.waitForSelector("#root *", { timeout: 120_000 });
    await page.waitForTimeout(1500);
    if (act) await act(page);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log(`wrote ${OUT}/${name}.png`);
  } finally {
    await context.close();
  }
}
try {
  await shot("play-card", "home", after, async (page) => {
    await page.locator("[data-daily-card]").scrollIntoViewIfNeeded();
  });
  await shot("daily-before", "daily", before);
  await shot("daily-after", "daily", after);
  await shot("daily-results", "daily", after, async (page) => {
    await page.locator("[data-daily-results]").click();
    await page.locator("[data-async-results]").waitFor({ timeout: 20_000 });
  });
  await shot("profile-daily", "profile", after);
} finally {
  await browser.close();
  await server.close();
}
