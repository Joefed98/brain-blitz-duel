/**
 * Before / after screenshots for copy pass 2's voice changes (7 Nov 2026; a design tool, not a check), at 390×844 on
 * the real screens through the safe-area harness (network stubbed) on the fixed clock: Play's join refusal, Practice's
 * empty search and the winner reveal (capitals now from CSS, so it should look the same). Run it on
 * main with --tag=before and on the branch with --tag=after.
 *
 *   bun scripts/shots/voice-pass-shots.ts [--out=screenshots/voice-pass-nov-2026] [--tag=after]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, fixThemeClock, openThemeScreen, room, type ThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/voice-pass-nov-2026";
const TAG = process.argv.find((a) => a.startsWith("--tag="))?.slice(6) ?? "after";
mkdirSync(OUT, { recursive: true });
fixThemeClock();
const viewport = { name: "390x844", w: 390, h: 844, scale: 2 };
const SCREENS: [string, ThemeScreen][] = [
  [
    "play-join-refused",
    {
      name: "play, join refused",
      mode: "home",
      go: async (page) => {
        await page.getByPlaceholder("Your name").fill("Sam");
        await page.locator("[data-jz='code-input'] input").fill("AB");
        await page.getByRole("button", { name: "Join", exact: true }).click();
        await page.waitForTimeout(400);
      },
    },
  ],
  [
    "practice-no-match",
    {
      name: "practice, no match",
      mode: "practice",
      go: async (page) => {
        await page.getByPlaceholder("Search puzzles").fill("zzqq");
        await page.getByText(/No games match|Nothing matches that/).first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      },
    },
  ],
  ["winner-reveal", { name: "winner reveal", mode: "room", room: room("in_progress", "winner_reveal"), waitMs: 1600 }],
];
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-voice-pass", buildId: "voice-pass-shots" });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p) => p && existsSync(p)) });
try {
  for (const [file, screen] of SCREENS) {
    try {
      const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
      await page.screenshot({ path: join(OUT, `${file}-390x844-${TAG}.png`) });
      console.log(`${file}-390x844-${TAG}`);
      await context.close();
    } catch (error) {
      console.log(`${file}: ${(error as Error).message.split("\n")[0]}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
