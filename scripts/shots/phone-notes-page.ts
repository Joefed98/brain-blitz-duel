/**
 * Phone-test notes review shots of the real page (27 Oct 2026, docs/phone-notes-oct-2026/): Fission, Wavefront,
 * Rainbow Bridge, Gemstone, Pinball and Flightpath's live practice round as an iPhone 11 home-screen app (414 × 896,
 * 48/34 px insets; scripts/device-emulation.ts), a moment after Ready and again later in the run, with no input.
 * Run it on main (--tag=before) and on the branch (--tag=after). A design tool, not a check.
 *
 *   bun scripts/shots/phone-notes-page.ts --url=http://127.0.0.1:5391 --tag=after [--out=screenshots/phone-notes-oct-2026] [games…]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { DEVICE_INIT, emulateDevice, IPHONE11_APP } from "../device-emulation";
import { gameDisplayName } from "../../src/lib/duel/gameNames";
import type { PuzzleType } from "../../src/lib/duel/types";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = opt("url") ?? "http://127.0.0.1:5391";
const OUT = opt("out") ?? "screenshots/phone-notes-oct-2026";
const TAG = opt("tag") ?? "after";
/** Milliseconds after the arena appears for each shot. */
const WAITS = (opt("waits") ?? "3000,20000").split(",").map(Number);
const FILE: Partial<Record<PuzzleType, string>> = { burst: "fission", inkbridge: "rainbow-bridge", matchup: "gemstone", bullseye: "flightpath" };
const only = process.argv.slice(2).filter((a) => !a.startsWith("--")) as PuzzleType[];
const games: PuzzleType[] = only.length ? only : ["burst", "wavefront", "inkbridge", "matchup", "pinball", "bullseye"];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const game of games) {
  const ctx = await browser.newContext({ viewport: { width: 414, height: 848 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(DEVICE_INIT);
  const page = await ctx.newPage();
  await emulateDevice(page, IPHONE11_APP);
  await page.goto(`${ORIGIN}/practice?terms=1`, { waitUntil: "domcontentloaded", timeout: 300_000 });
  const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
  await button.waitFor({ timeout: 180_000 });
  await page.waitForTimeout(1500);
  await button.click();
  await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 300_000 });
  await page.locator("[data-game-arena]").first().waitFor({ timeout: 300_000 });
  let waited = 0;
  for (const wait of WAITS) {
    await page.waitForTimeout(wait - waited);
    waited = wait;
    const path = `${OUT}/${FILE[game] ?? game}-${Math.round(wait / 1000)}s-414x896-${TAG}.png`;
    await page.screenshot({ path });
    console.log(path);
  }
  await ctx.close();
}
await browser.close();
