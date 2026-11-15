/**
 * The Settings, account and onboarding session's review pictures (docs/design/pages-review/settings-account/): each
 * screen at 390 × 844 (one at a computer's 1440 × 900), shrunk to 300 px wide (the computer to 720) as compressed PNG.
 * `--tag=before` draws main's screens (run this file from a checkout of main, where the old screens have these names),
 * `--tag=after` this branch's (scripts/screens/settings-account.ts).
 *
 *   bun scripts/shots/settings-account-shots.ts --tag=before|after [--out=<dir>]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, fixThemeClock, openThemeScreen, type ThemeScreen, type ThemeViewport } from "../theme-screens";

const args = process.argv.slice(2);
const TAG = args.find((a) => a.startsWith("--tag="))?.slice(6) === "before" ? "before" : "after";
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6) ?? "docs/design/pages-review/settings-account";

const PHONE: ThemeViewport = { name: "390x844", w: 390, h: 844 };
const DESKTOP: ThemeViewport = { name: "desktop 1440x900", w: 1440, h: 900, desktop: true };

/** file → [main's screen name, this branch's screen name, viewport, width]. A null before draws only the after. */
const SHOTS: [string, string | null, string, ThemeViewport, number][] = [
  ["01-settings-guest", "settings sheet", "settings page: a guest", PHONE, 300],
  ["02-settings-account", null, "settings page: an account", PHONE, 300],
  ["03-settings-controls", null, "settings page: an account, controls", PHONE, 300],
  ["04-settings-light", null, "settings page light: an account", PHONE, 300],
  ["05-account-page", "account, settings", "settings page: account page", PHONE, 300],
  ["06-sign-in", "account, sign in", "settings page: sign-up, sign in", PHONE, 300],
  ["07-username", "account, username", "settings page: sign-up, username", PHONE, 300],
  ["08-welcome", "account, welcome", "settings page: sign-up, welcome", PHONE, 300],
  ["09-intro-1", null, "settings page: intro, panel 1", PHONE, 300],
  ["10-intro-3", null, "settings page: intro, panel 3", PHONE, 300],
  ["11-terms", "beta terms", "settings page: terms", PHONE, 300],
  ["12-desktop-settings", null, "settings page: an account", DESKTOP, 720],
  ["13-desktop-sign-in", null, "settings page: sign-up, sign in", DESKTOP, 720],
];

const CHROMIUM = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
if (!CHROMIUM) throw new Error("no Chromium");
mkdirSync(OUT, { recursive: true });
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-settings-shots", buildId: "settings-shots" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const [file, before, after, viewport, width] of SHOTS) {
    const name = TAG === "before" ? before : after;
    if (!name) continue;
    const screen = THEME_SCREENS.find((s: ThemeScreen) => s.name === name);
    if (!screen) {
      console.log(`skip ${file}: no screen "${name}"`);
      continue;
    }
    const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
    try {
      await page.waitForTimeout(screen.waitMs ?? 600);
      const png = await page.screenshot();
      const image = await loadImage(png);
      const h = Math.round((image.height * width) / image.width);
      const canvas = createCanvas(width, h);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, width, h);
      await Bun.write(join(OUT, `${file}-${TAG}.png`), await canvas.encode("png"));
      console.log(`${file}-${TAG}.png`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
