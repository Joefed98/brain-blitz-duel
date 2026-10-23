/**
 * Screenshots of the tab screens' look for review (Prompt R, 23 Oct 2026; a design tool, not a check):
 * Play (top and scrolled, the public game card, the Add to Home Screen hint), Practice (top and scrolled), Tournaments,
 * Profile (and its footer with a test TALLY_URL) and the header close up, at 414×896 as an
 * iPhone 11 home-screen app, on the real screens with only the network edge stubbed
 * (scripts/theme-screens.ts: a scheduled public game, room history, practice bests, the daily and
 * challenge cards), plus the new app icon. JPEG at 2×, each well under 1 MB.
 *
 *   bun scripts/shots/app-pages-shots.ts [--out=screenshots/app-redesign-oct-2026] [--scale=2]
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { dailyFixture } from "../daily-fixture";
import { CHROMIUM_PATHS, THEME_SCREENS, VIEWPORTS, openThemeScreen, type ThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/app-redesign-oct-2026";
const SCALE = Number(process.argv.find((a) => a.startsWith("--scale="))?.slice(8) ?? 2);
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });

const viewport = { ...VIEWPORTS[0]!, scale: SCALE };
// Both of today's dailies already played on this device (the follow-up to #129: grey Done pills).
const bothDone = (): ThemeScreen => {
  const play = THEME_SCREENS.find((s) => s.name === "play")!;
  return {
    ...play,
    name: "play, both dailies done",
    daily: () => {
      const after = dailyFixture().after;
      return { ...after, status: { ...after.status, arcade: { state: "done", total: 412, rank: 9, count: null } } };
    },
  };
};
const screen = (name: string) => (name === "play, both dailies done" ? bothDone() : THEME_SCREENS.find((s) => s.name === name)!);
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-app-pages-shots", buildId: "app-pages-shots" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
const jpeg = { type: "jpeg" as const, quality: 82 };
try {
  for (const [file, name, act] of [
    ["play", "play", null],
    ["play-scrolled", "play", 2000],
    ["practice-top", "practice list", null],
    ["practice-scrolled", "practice list", 1400],
    ["tournaments", "tournaments", null],
    ["profile", "profile", null],
    // #128 connected (Prompt R merge): the public game card, the Add to Home Screen hint, the feedback link.
    ["play-public-card", "play", "[data-public-game]"],
    ["play-home-screen-hint", "play, Add to Home Screen hint", null],
    ["profile-footer-feedback", "profile, feedback link", 99999],
    ["play-dailies-done", "play, both dailies done", "[data-daily-card]"],
  ] as const) {
    const { context, page } = await openThemeScreen(browser, server.origin, screen(name), viewport);
    try {
      if (typeof act === "number") await page.evaluate((y) => window.scrollTo(0, y), act);
      else if (typeof act === "string")
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120);
        }, act);
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `${file}-414x896.jpg`), ...jpeg });
      if (file === "play") {
        const header = await page.locator("[data-app-header]").boundingBox();
        if (header)
          await page.screenshot({
            path: join(OUT, "header-closeup.jpg"),
            clip: { x: 0, y: Math.max(0, header.y - 12), width: viewport.w, height: header.height + 24 },
            ...jpeg,
          });
      }
    } finally {
      await context.close();
    }
  }
  // The app icon at its home-screen size and large, on a dark and a light background.
  const context = await browser.newContext({ viewport: { width: 560, height: 300 }, deviceScaleFactor: SCALE });
  const page = await context.newPage();
  const icon = `data:image/png;base64,${readFileSync("public/app-icon-512.png").toString("base64")}`;
  await page.setContent(`<body style="margin:0;display:flex;gap:40px;align-items:center;justify-content:center;height:100vh;background:linear-gradient(90deg,#0D0D0F 50%,#E9E6E0 50%)">
    <img src="${icon}" style="width:180px;height:180px;border-radius:40px">
    <img src="${icon}" style="width:60px;height:60px;border-radius:13px">
    <img src="${icon}" style="width:180px;height:180px;border-radius:40px">
  </body>`);
  await page.screenshot({ path: join(OUT, "app-icon.jpg"), ...jpeg });
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
console.log(`screenshots in ${OUT}`);
