/**
 * Home and Play's review screenshots (phase 2 step 3, 14 Nov 2026): Home, the Play page and the Rooms page as the
 * theme screens draw them (scripts/screens/home-play.ts), at a phone size and a computer, full page.
 *
 *   bun scripts/shots/home-play-shots.ts [name filter…] [--out=<dir>] [--sizes=390x844,1440x900d] [--dpr=1] [--tag=after]
 *
 * A size ending in "d" is a computer (mouse and trackpad). Writes <out>/<screen>-<size>-<tag>.png.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, fixThemeClock, openThemeScreen, type ThemeScreen, type ThemeViewport } from "../theme-screens";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const only = args.filter((a) => !a.startsWith("--"));
const out = opt("out") ?? ".shots/home-play";
const tag = opt("tag") ?? "after";
const dpr = Number(opt("dpr") ?? 1);
const sizes: ThemeViewport[] = (opt("sizes") ?? "390x844,1440x900d").split(",").map((s) => {
  const m = /^(\d+)x(\d+)(d?)$/.exec(s)!;
  return { name: s, w: Number(m[1]), h: Number(m[2]), desktop: m[3] === "d", scale: dpr };
});
const extra: ThemeScreen[] = [
  { name: "before: home, a guest", mode: "home" },
];
const screens = [...THEME_SCREENS, ...extra].filter((s) => (only.length ? only.some((o) => s.name.includes(o)) : s.name.startsWith("home")));
mkdirSync(out, { recursive: true });
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-home-play-shots", buildId: "home-play-shots" });
fixThemeClock();
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p))) });
try {
  for (const screen of screens)
    for (const viewport of sizes) {
      const { context, page } = await openThemeScreen(browser, server.origin, { ...screen, sizes: [] }, viewport);
      const file = join(out, `${screen.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${viewport.name}-${tag}.png`);
      await page.screenshot({ path: file, fullPage: !screen.go || !/sheet/.test(screen.name) });
      console.log(file);
      await context.close();
    }
} finally {
  await browser.close();
  await server.close();
}
