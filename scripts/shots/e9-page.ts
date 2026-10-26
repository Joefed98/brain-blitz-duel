/**
 * Expansion E9 review shots of the real page (26 Oct 2026, docs/expansions/e9.md): Rally, Fission and Flightpath's
 * live practice round as an iPhone 11 home-screen app (414 × 896, 48/34 px insets; scripts/device-emulation.ts), a
 * moment after Ready: the game frame, the HUD lines and the arena as Joe sees them. The features themselves are
 * shown mid-round by scripts/shots/e9-shots.ts (the renderers on bot runs). A design tool, not a check.
 *
 *   bun scripts/shots/e9-page.ts --url=http://127.0.0.1:5391 [--wait=2500] [--out=screenshots/expansion-e9-oct-2026]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { DEVICE_INIT, emulateDevice, IPHONE11_APP } from "../device-emulation";
import { gameDisplayName } from "../../src/lib/duel/gameNames";
import type { PuzzleType } from "../../src/lib/duel/types";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = opt("url") ?? "http://127.0.0.1:5391";
const OUT = opt("out") ?? "screenshots/expansion-e9-oct-2026";
const WAIT = Number(opt("wait") ?? 2500);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const game of ["rally", "burst", "bullseye"] as PuzzleType[]) {
  const ctx = await browser.newContext({ viewport: { width: 414, height: 848 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(DEVICE_INIT);
  const page = await ctx.newPage();
  await emulateDevice(page, IPHONE11_APP);
  await page.goto(`${ORIGIN}/practice?terms=1`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
  await button.waitFor({ timeout: 180_000 });
  await page.waitForTimeout(1500);
  await button.click();
  await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 60_000 });
  await page.locator("[data-game-arena]").first().waitFor();
  await page.waitForTimeout(WAIT);
  await page.screenshot({ path: `${OUT}/${game === "burst" ? "fission" : game === "bullseye" ? "flightpath" : game}-play-screen-414x896.png` });
  console.log(`${game}: shot`);
  await ctx.close();
}
await browser.close();
