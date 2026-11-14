/**
 * Review pictures for the components step (phase 2 step 2, 14 Nov 2026; a design tool, not a check): Home, Games,
 * Profile, Shop, More, a room lobby and a results screen at 390×844, before or after (`--tag`), plus, after, the
 * components sheet and Settings. Raw PNGs go to `--out` (default .shots/components-review); scripts/shots/
 * components-review-pack.py palette-compresses the chosen ones into docs/design/components-review/.
 *
 *   bun scripts/shots/components-review-shots.ts --tag=before|after [--out=<dir>] [--only=<file,…>]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, NAV_SCREENS, THEME_SCREENS, openThemeScreen, type ThemeScreen } from "../theme-screens";

const TAG = process.argv.find((a) => a.startsWith("--tag="))?.slice(6) ?? "after";
const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/components-review";
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7)?.split(",");
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });

const all = [...THEME_SCREENS, ...NAV_SCREENS()];
const named = (name: string): ThemeScreen => {
  const found = all.find((s) => s.name === name);
  if (!found) throw new Error(`no theme screen "${name}"`);
  return found;
};
const LIST: [file: string, screen: string, afterOnly?: boolean][] = [
  ["home", "nav: home, an account with the Shop"],
  ["games", "nav: games"],
  ["profile", "profile"],
  ["shop", "nav: shop"],
  ["more", "nav: more, an account with the Shop"],
  ["lobby", "identity: lobby, 10 players with cards"],
  ["results", "identity: final results, 2 players with cards"],
  ["components", "components", true],
  ["components-light", "components, light", true],
  ["settings", "settings, sound and volume", true],
];

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-components-review", buildId: "components-review" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
const viewport = { name: "390x844", w: 390, h: 844, scale: 1 };
try {
  for (const [file, name, afterOnly] of LIST) {
    if (afterOnly && TAG === "before") continue;
    if (ONLY && !ONLY.includes(file)) continue;
    const { context, page } = await openThemeScreen(browser, server.origin, named(name), viewport);
    try {
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(OUT, `${file}-${TAG}.png`), fullPage: file.startsWith("components") });
      console.log(`${file}-${TAG}.png`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
