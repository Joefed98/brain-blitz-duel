/**
 * Review screenshots for room settings (31 Oct 2026): the lobby (host and a guest's summary line), the settings
 * sheet with each preset and with the round count capped, and two room intros (a puzzle, an arcade game) in
 * their colours, at 414×896 (iPhone 11 home-screen app) and 375×667, through the theme screens' harness.
 *
 *   bun scripts/shots/room-settings-shots.ts [--out=screenshots/room-settings-oct-2026]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, VIEWPORTS, fixThemeClock, openThemeScreen, room, type ThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/room-settings-oct-2026";
mkdirSync(OUT, { recursive: true });
const CHROMIUM = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
if (!CHROMIUM) throw new Error("no Chromium");

const byName = (name: string) => THEME_SCREENS.find((s) => s.name === name)!;
const SHOTS: [string, ThemeScreen][] = [
  ["lobby-host", { name: "lobby, host", mode: "room", room: room("waiting", "starting", { players: 3 }) }],
  ["lobby-guest-summary", byName("lobby, guest's settings summary")],
  ["sheet-mixed", byName("room settings sheet, Mixed")],
  ["sheet-puzzles-only", byName("room settings sheet, Puzzles only")],
  ["sheet-arcade-only", byName("room settings sheet, Arcade only")],
  ["sheet-capped", byName("room settings sheet, capped rounds")],
  ["intro-puzzle-box-six", { name: "intro, puzzle", mode: "room", room: room("in_progress", "intro"), waitMs: 1500 }],
  ["intro-arcade-breaker-retro", { name: "intro, arcade", mode: "room", room: room("in_progress", "intro", { arcade: true, arcadeType: "breaker" }), waitMs: 1500 }],
];

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-room-settings-shots", buildId: "room-settings-shots" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const viewport of VIEWPORTS.slice(0, 2))
    for (const [file, screen] of SHOTS) {
      const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
      try {
        const name = `${file}-${viewport.app ? "414x896-app" : `${viewport.w}x${viewport.h}`}.png`;
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
