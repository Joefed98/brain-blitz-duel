/**
 * Identity art (S5 step 2): before/after phone shots of every screen that draws the art, and the largest size it is
 * drawn at. Not a check.
 *
 *   bun scripts/shots/identity-shots.ts --tag=before|after [--out=<dir>] [--kind=avatar] [--measure]
 *
 * Opens every harness screen (scripts/theme-screens.ts and the area files, dark and light; the real routes with the
 * network stubbed) and finds the art by its own markup: an avatar is an svg holding the avatar drawing's clip
 * (`…av<n>c`) or the layered drawing's `data-avatar-layers`. Shots: each screen that shows the art, at 375 × 667,
 * dark and light, DPR 2, saved as <out>/<tag>/<screen>.png. --measure also draws every screen at every size the
 * checks use (VIEWPORTS and ALL_SIZES) and prints the largest box the art takes, per screen and overall.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { startSafeAreaServer } from "../safe-area-server";
import { ALL_SIZES, CHROMIUM_PATHS, VIEWPORTS, fixThemeClock, openThemeScreen, type ThemeScreen, type ThemeViewport } from "../theme-screens";
import { allThemeScreens, lightScreens } from "../area-screens";

const args = process.argv.slice(2);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tag = opt("tag") ?? "shot";
const out = opt("out") ?? ".shots/identity";
const measure = args.includes("--measure");
const only = opt("only")?.split(",");

const PHONE: ThemeViewport = { name: "375x667", w: 375, h: 667, scale: 2 };

/** In-page: every avatar drawing's box (w, h) on the page. */
function avatarBoxes(): { w: number; h: number }[] {
  const out: { w: number; h: number }[] = [];
  for (const svg of Array.from(document.querySelectorAll("svg"))) {
    if (svg.parentElement?.closest("svg")) continue;
    const html = svg.innerHTML;
    if (!/av\d+c"/.test(html) && !svg.hasAttribute("data-avatar-layers")) continue;
    const r = svg.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    out.push({ w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 });
  }
  return out;
}

const CHROMIUM = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
if (!CHROMIUM) throw new Error("no Chromium");
const dark = await allThemeScreens();
const screens: ThemeScreen[] = [...dark, ...lightScreens(dark)].filter((s) => !only || only.some((o) => s.name.includes(o)));
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-identity-shots", buildId: "identity-shots" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
mkdirSync(`${out}/${tag}`, { recursive: true });
const largest: { screen: string; viewport: string; w: number }[] = [];
const shot: string[] = [];
const sizes = measure ? [...VIEWPORTS, ...ALL_SIZES.filter((s) => !VIEWPORTS.some((v) => v.name === s.name))] : [];
for (const screen of screens) {
  for (const viewport of [PHONE, ...sizes]) {
    const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport).catch(() => ({ context: null, page: null }));
    if (!page || !context) continue;
    try {
      await page.waitForTimeout(screen.waitMs ?? 400);
      const boxes = await page.evaluate(avatarBoxes).catch(() => []);
      if (boxes.length) {
        const w = Math.max(...boxes.map((b) => b.w));
        largest.push({ screen: screen.name, viewport: viewport.name, w });
        if (viewport === PHONE) {
          const file = `${out}/${tag}/${screen.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
          await page.screenshot({ path: file, fullPage: true });
          shot.push(file);
        }
      }
    } catch (e) {
      console.log(`skipped ${screen.name} (${viewport.name}): ${(e as Error).message.split("\n")[0]}`);
    }
    await context.close().catch(() => {});
  }
}
await browser.close();
await server.close();
largest.sort((a, b) => b.w - a.w);
writeFileSync(`${out}/${tag}/sizes.json`, JSON.stringify(largest, null, 1));
console.log(`${shot.length} shots in ${out}/${tag}`);
if (measure) for (const l of largest.slice(0, 12)) console.log(`${l.w} px  ${l.screen} (${l.viewport})`);
process.exit(0);
