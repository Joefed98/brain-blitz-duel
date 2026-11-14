/**
 * Review shots for the rooms and rated pages (phase 2 step 3, 14 Nov 2026; docs/design/pages-review/rooms-rated/):
 * the area's screens through the theme harness at phone size (390 × 844) and a few on a computer (1366 × 768).
 *
 *   bun scripts/shots/rooms-rated-shots.ts --out=<dir> [--tag=before|after] [names…]
 *
 * It starts theme-check's own harness server (safe-area-server.ts).
 *
 * A screen missing on an older tree (the match header) is skipped. Not a check.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Browser } from "playwright";

import { CHROMIUM_PATHS, fixThemeClock, openThemeScreen, room, type ThemeScreen, type ThemeViewport } from "../theme-screens";
import { startSafeAreaServer } from "../safe-area-server";

const args = process.argv.slice(2);
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/rooms-rated";
const TAG = args.find((a) => a.startsWith("--tag="))?.slice(6) ?? "after";
const ONLY = args.filter((a) => !a.startsWith("--"));

const PHONE: ThemeViewport = { name: "390x844", w: 390, h: 844 };
const DESK: ThemeViewport = { name: "desktop 1366x768", w: 1366, h: 768, desktop: true };
const rated = (screen: string): ThemeScreen => ({ name: screen, mode: "rated", plain: true, globals: { __harnessRated: { screen } } });
const SHOTS: { file: string; screen: ThemeScreen; viewport: ThemeViewport }[] = [
  { file: "lobby", screen: { name: "lobby", mode: "room", room: room("waiting", "starting", { players: 5 }), waitMs: 800 }, viewport: PHONE },
  { file: "round-result", screen: { name: "round", mode: "room", room: room("in_progress", "result"), waitMs: 1500 }, viewport: PHONE },
  { file: "standings", screen: { name: "standings", mode: "room", room: room("in_progress", "standings", { players: 6, rounds: 2 }), waitMs: 2500 }, viewport: PHONE },
  { file: "podium", screen: { name: "podium", mode: "room", room: room("finished", "result", { players: 6, rounds: 6 }), waitMs: 3000 }, viewport: PHONE },
  { file: "dropout", screen: rated("dropout-countdown"), viewport: PHONE },
  { file: "searching", screen: rated("searching"), viewport: PHONE },
  { file: "vs", screen: rated("vs-live"), viewport: PHONE },
  { file: "match-header", screen: rated("match-header"), viewport: PHONE },
  { file: "result", screen: rated("result-won"), viewport: PHONE },
  { file: "tiers", screen: rated("tiers"), viewport: PHONE },
  { file: "multi-standings", screen: rated("multi-standings"), viewport: PHONE },
  { file: "desktop-vs", screen: rated("vs-live"), viewport: DESK },
  { file: "desktop-result", screen: rated("result-won"), viewport: DESK },
];

const chromiumPath = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-theme", buildId: "theme-check" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser: Browser = await chromium.launch(chromiumPath ? { executablePath: chromiumPath } : {});
mkdirSync(OUT, { recursive: true });
for (const shot of SHOTS) {
  if (ONLY.length && !ONLY.includes(shot.file)) continue;
  try {
    const { context, page } = await openThemeScreen(browser, server.origin, shot.screen, shot.viewport);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(OUT, `${shot.file}-${TAG}.png`) });
    await context.close();
    console.log(`shot ${shot.file}`);
  } catch (e) {
    console.log(`skipped ${shot.file}: ${(e as Error).message.split("\n")[0]}`);
  }
}
await browser.close();
await server.close();
process.exit(0);
