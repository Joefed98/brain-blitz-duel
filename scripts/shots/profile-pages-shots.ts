/**
 * The Profile session's review pictures (phase 2 step 3; docs/design/pages-review/profile/GALLERY.md): each of the
 * Profile screens (scripts/screens/profile.ts) at phone size, before (`--tag=before`, on main) or after, plus one
 * computer picture, drawn through the screen harness and squeezed to small 8-bit PNGs (python3 + Pillow).
 *
 *   bun scripts/shots/profile-pages-shots.ts --tag=before|after [--only=<name part>]
 */
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, fixThemeClock, openThemeScreen, type ThemeViewport } from "../theme-screens";
import { PROFILE_SCREENS } from "../screens/profile";

const OUT = "docs/design/pages-review/profile";
mkdirSync(OUT, { recursive: true });
const tag = process.argv.find((a) => a.startsWith("--tag="))?.slice(6) ?? "after";
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const PHONE: ThemeViewport = { name: "390x844", w: 390, h: 844 };
const DESKTOP: ThemeViewport = { name: "desktop 1440x900", w: 1440, h: 900, desktop: true };
const TABLET: ThemeViewport = { name: "tablet 820x1180", w: 820, h: 1180 };

const byName = Object.fromEntries(PROFILE_SCREENS().map((s) => [s.name, s]));
const BEFORE_ONLY = new Set(["badges", "card", "light-badges"]);
const SHOTS: [string, string, ThemeViewport][] = [
  ["01-profile-rated", "profile page: an account, rated", PHONE],
  ["02-profile-rated-scrolled", "profile page: an account, rated, scrolled", PHONE],
  ["03-profile-unrated", "profile page: an account without rated play", PHONE],
  ["04-profile-guest", "profile page: a guest", PHONE],
  ["05-badges", "profile page: badges", PHONE],
  ["06-card", "profile page: the player card", PHONE],
  ["07-friends", "profile page: friends list", PHONE],
  ["08-friend-profile", "profile page: a friend's profile", PHONE],
  ["09-add-friend", "profile page: add a friend", PHONE],
  ["10-customise-avatar", "profile page: customise, avatar", PHONE],
  ["11-customise-card", "profile page: customise, card", PHONE],
  ["12-profile-light", "profile page light: an account, rated", PHONE],
  ["13-desktop-profile", "profile page: an account, rated", DESKTOP],
  ["14-tablet-profile", "profile page: an account, rated", TABLET],
];

fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p))) });
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-profile-shots", buildId: "profile-shots" });
try {
  for (const [file, name, viewport] of SHOTS) {
    if (only && !file.includes(only)) continue;
    const key = file.replace(/^\d+-/, "");
    if (tag === "before" && [...BEFORE_ONLY].some((b) => key === b)) continue;
    const screen = byName[name];
    if (!screen) throw new Error(`no screen ${name}`);
    const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, `${file}-${tag}.png`) });
    await context.close();
    console.log(`drew ${file}-${tag}`);
  }
} finally {
  await server.close();
  await browser.close();
}
const squeeze = Bun.spawnSync(["python3", "-I", "-c", `
import sys, glob
from PIL import Image
for f in glob.glob(sys.argv[1] + "/*-" + sys.argv[2] + ".png"):
    im = Image.open(f).convert("RGB")
    w = 300 if im.width < 500 else 720
    im = im.resize((w, im.height * w // im.width), Image.LANCZOS)
    im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True)
`, OUT, tag]);
if (squeeze.exitCode !== 0) throw new Error(squeeze.stderr.toString());
let total = 0;
for (const f of readdirSync(OUT)) if (f.endsWith(".png")) total += statSync(join(OUT, f)).size;
console.log(`${OUT}: ${(total / 1024).toFixed(0)} KB`);
