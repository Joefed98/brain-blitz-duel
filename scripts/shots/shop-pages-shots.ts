/**
 * Review screenshots of the Shop, Pass and Plus pages (the Shop pages session, 14 Nov 2026): every screen in
 * scripts/screens/shop.ts at the sizes asked for, drawn as theme-check draws them, saved as
 * <out>/<screen>--<size>.png. A tool, not a check.
 *
 *   bun scripts/shots/shop-pages-shots.ts --out=<dir> [--sizes=390x844,desktop 1366x768] [--full] [screen filter…]
 */
import { mkdirSync } from "node:fs";

import { startSafeAreaServer } from "../safe-area-server";
// theme-screens first: it imports scripts/screens/shop.ts, which reads its sizes.
import { ALL_SIZES, CHROMIUM_PATHS, NAV_SIZES, VIEWPORTS, fixThemeClock, openThemeScreen } from "../theme-screens";
import { SHOP_SCREENS } from "../screens/shop";

const args = process.argv.slice(2);
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/shop-pages";
const SIZES = args.find((a) => a.startsWith("--sizes="))?.slice(8).split(",") ?? ["390x844"];
const FULL = args.includes("--full");
const ONLY = args.filter((a) => !a.startsWith("--"));
const every = [...VIEWPORTS, ...ALL_SIZES, ...NAV_SIZES];
// A named size, or any "WxH" (a tall one shows a whole page that scrolls inside its column).
const viewports = SIZES.map((s) => {
  const named = every.find((v) => v.name === s);
  if (named) return named;
  const m = /^(\d+)x(\d+)$/.exec(s);
  if (!m) throw new Error(`no size ${s}`);
  return { name: s, w: Number(m[1]), h: Number(m[2]) };
});
const screens = SHOP_SCREENS().filter((s) => !ONLY.length || ONLY.some((o) => s.name.includes(o)));

mkdirSync(OUT, { recursive: true });
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-theme", buildId: "shop-pages-shots" });
fixThemeClock();
const { chromium } = await import("playwright");
const { existsSync } = await import("node:fs");
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p) => existsSync(p)) });
try {
  for (const viewport of viewports)
    for (const screen of screens) {
      const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
      try {
        await page.waitForTimeout(400);
        const file = `${OUT}/${screen.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}--${viewport.name.replace(/[^a-z0-9]+/gi, "-")}.png`;
        await page.screenshot({ path: file, fullPage: FULL });
        console.log(file);
      } finally {
        await context.close();
      }
    }
} finally {
  await browser.close();
  await server.close();
}
