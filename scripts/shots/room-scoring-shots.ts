/**
 * Review screenshots for the room scoring choice (6 Nov 2026; scoringMode.ts) at 390×844, through the theme
 * screens' harness: before (a room row from before the migration, so Total score and no Scoring control, exactly
 * as main draws it) and after (the column present): the settings sheet with Placings chosen, a guest's lobby
 * summary, the standings after round 4 of 4 and the podium with my row open, under Total score and Placings.
 *
 *   bun scripts/shots/room-scoring-shots.ts [--out=screenshots/room-scoring-nov-2026]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import type { Page } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, fixThemeClock, openThemeScreen, room, type ThemeScreen, type ThemeViewport } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/room-scoring-nov-2026";
mkdirSync(OUT, { recursive: true });
const CHROMIUM = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
if (!CHROMIUM) throw new Error("no Chromium");

// Six players over four rounds: P2 has two huge rounds, P3 is second in every round; P4 and P5 swap places
// between the two modes.
const SCORES = [
  [150, 120, 90, 140],
  [40, 200, 200, 190],
  [140, 150, 160, 145],
  [100, 90, 150, 100],
  [120, 80, 60, 150],
  [30, 40, 50, 60],
];
const scores = (slot: number, round: number) => SCORES[slot - 1]![round - 1]!;
const VIEWPORT: ThemeViewport = { name: "390x844", w: 390, h: 844, scale: 2 };

const openSheet = (placings: boolean) => async (page: Page) => {
  await page.locator("[data-room-settings]").click();
  await page.locator("[data-room-settings-sheet]").waitFor({ timeout: 10_000 });
  if (placings) {
    await page.locator("[data-room-scoring-mode='placings']").click();
    await page.locator("[data-room-scoring-mode='placings']").scrollIntoViewIfNeeded();
  } else {
    await page.locator("[data-room-settings-save]").scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(400);
};
const openMyRow = async (page: Page) => {
  await page.locator("[data-podium-actions]").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(2500);
  await page.locator("button[data-you][aria-expanded]").first().click();
  await page.waitForTimeout(400);
};
const standings = (scoring?: "total" | "placings"): ThemeScreen => ({
  name: `standings ${scoring ?? "before"}`,
  mode: "room",
  room: room("in_progress", "standings", { players: 6, rounds: 4, scores, ...(scoring ? { scoring } : {}) }),
  waitMs: 2500,
});
const podium = (scoring?: "total" | "placings"): ThemeScreen => ({
  name: `podium ${scoring ?? "before"}`,
  mode: "room",
  room: room("finished", "result", { players: 6, rounds: 4, scores, ...(scoring ? { scoring } : {}) }),
  go: openMyRow,
});
const SHOTS: [string, ThemeScreen][] = [
  ["before-sheet", { name: "sheet before", mode: "room", room: room("waiting", "starting", { players: 3 }), go: openSheet(false) }],
  ["before-standings", standings()],
  ["before-podium", podium()],
  ["after-sheet-total", { name: "sheet total", mode: "room", room: room("waiting", "starting", { players: 3, scoring: "total" }), go: openSheet(false) }],
  ["after-sheet-placings", { name: "sheet placings", mode: "room", room: room("waiting", "starting", { players: 3, scoring: "total" }), go: openSheet(true) }],
  ["after-lobby-guest-placings", { name: "lobby guest", mode: "room", room: room("waiting", "starting", { host: "u2", players: 3, scoring: "placings" }) }],
  ["after-standings-total", standings("total")],
  ["after-standings-placings", standings("placings")],
  ["after-podium-total", podium("total")],
  ["after-podium-placings", podium("placings")],
];

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-room-scoring-shots", buildId: "room-scoring-shots" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const [file, screen] of SHOTS) {
    const { context, page } = await openThemeScreen(browser, server.origin, screen, VIEWPORT);
    try {
      const name = `${file}-390x844.png`;
      writeFileSync(`${OUT}/${name}`, await page.screenshot());
      console.log(`saved ${OUT}/${name}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
