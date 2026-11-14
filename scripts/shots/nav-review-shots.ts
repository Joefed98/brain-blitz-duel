/**
 * The navigation step's review pictures (docs/design/nav-review/): every new screen at phone size in the dark theme,
 * Home (and More) in the light, the tablet sideways and the computer rail, drawn through the screen harness, then
 * squeezed to 8-bit PNGs (python3 + Pillow) so the whole set stays under 1 MB.
 *
 *   bun scripts/shots/nav-review-shots.ts
 */
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { startSafeAreaServer } from "../safe-area-server";
import { ACCOUNT_FIXTURE, CHROMIUM_PATHS, NAV_SCREENS, fixThemeClock, openThemeScreen, type ThemeViewport } from "../theme-screens";

const OUT = "docs/design/nav-review";
mkdirSync(OUT, { recursive: true });
const PHONE: ThemeViewport = { name: "390x844", w: 390, h: 844 };
const TABLET: ThemeViewport = { name: "tablet 1180x820 landscape", w: 1180, h: 820 };
const DESKTOP: ThemeViewport = { name: "desktop 1440x900", w: 1440, h: 900, desktop: true };

const byName = Object.fromEntries(NAV_SCREENS().map((s) => [s.name, s]));
const SHOTS: [string, string, ThemeViewport][] = [
  ["01-home-guest", "nav: home, a guest", PHONE],
  ["02-home-account-shop", "nav: home, an account with the Shop", PHONE],
  ["03-games", "nav: games", PHONE],
  ["04-tournaments-coming-soon", "nav: tournaments, coming soon", PHONE],
  ["05-shop", "nav: shop", PHONE],
  ["06-more", "nav: more", PHONE],
  ["07-more-account-shop", "nav: more, an account with the Shop", PHONE],
  ["08-launch", "nav: launch screen", PHONE],
  ["09-home-light", "nav light: home", PHONE],
  ["10-more-light", "nav light: more", PHONE],
  ["11-tablet-sideways-more", "nav: more", TABLET],
  ["12-desktop-rail-home", "nav: home, an account with the Shop", DESKTOP],
  ["13-desktop-rail-collapsed-room", "nav: room lobby, the rail collapsed", DESKTOP],
];
void ACCOUNT_FIXTURE;

fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p))) });
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-nav-shots", buildId: "nav-shots" });
try {
  for (const [file, name, viewport] of SHOTS) {
    const screen = byName[name];
    if (!screen) throw new Error(`no screen ${name}`);
    const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, `${file}.png`) });
    await context.close();
    console.log(`drew ${file}`);
  }
} finally {
  await server.close();
  await browser.close();
}
const squeeze = Bun.spawnSync(["python3", "-I", "-c", `
import sys, glob
from PIL import Image
for f in glob.glob(sys.argv[1] + "/*.png"):
    im = Image.open(f).convert("RGB")
    if im.width > 900:
        im = im.resize((im.width * 2 // 3, im.height * 2 // 3), Image.LANCZOS)
    im.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True)
`, OUT]);
if (squeeze.exitCode !== 0) throw new Error(squeeze.stderr.toString());
let total = 0;
for (const f of readdirSync(OUT)) if (f.endsWith(".png")) total += statSync(join(OUT, f)).size;
console.log(`${OUT}: ${(total / 1024).toFixed(0)} KB`);
