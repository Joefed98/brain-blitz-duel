/**
 * High Rise's gallery frames for the Action overhaul (docs/design/pages-review/action/skyline/): the intro, the live
 * round a few seconds in and later (taps on a rhythm), the practice reveal, at the sizes given. A design tool, not a check.
 *
 *   bun scripts/shots/skyline-overhaul-shots.ts --url=<origin> --out=<dir> [--sizes=390x844,414x896,1366x900] [--tag=after]
 */
import { mkdirSync } from "node:fs";

import { chromium } from "playwright";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const origin = arg("url") ?? "http://127.0.0.1:5205";
const out = arg("out") ?? ".shots/skyline-overhaul";
const tag = arg("tag") ?? "after";
const sizes = (arg("sizes") ?? "390x844").split(",").map((s) => s.split("x").map(Number) as [number, number]);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: w < 700, isMobile: w < 700 });
  const page = await ctx.newPage();
  await page.goto(`${origin}/practice?game=skyline`, { waitUntil: "domcontentloaded", timeout: 240_000 });
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 240_000 }).catch(async (e) => {
    await page.screenshot({ path: `${out}/debug-${w}x${h}.png` });
    throw e;
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/skyline-${w}x${h}-intro-${tag}.png` });
  await ready.click();
  const canvas = page.locator("[data-game-stage] canvas, [data-game-arena] canvas").first();
  await canvas.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${out}/skyline-${w}x${h}-start-${tag}.png` });
  // Tap on a steady rhythm for a while (some drops land well, some trim).
  const box = await canvas.boundingBox();
  for (let k = 0; k < 40; k++) {
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(650);
  }
  await page.screenshot({ path: `${out}/skyline-${w}x${h}-mid-${tag}.png` });
  await page.locator("[data-practice-reveal-actions], [data-reveal-screen]").first().waitFor({ timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/skyline-${w}x${h}-end-${tag}.png` });
  await ctx.close();
}
await browser.close();
console.log(`frames in ${out}`);
