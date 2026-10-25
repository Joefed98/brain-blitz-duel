/** E2 expansion probe: the arena box and world size of Meteor, Fission and Tempo's play screen at 414x896 (iPhone 11 app). */
import { chromium } from "playwright";
import { DEVICE_INIT, emulateDevice, IPHONE11_APP } from "../device-emulation";
import { gameDisplayName } from "../../src/lib/duel/gameNames";
import type { PuzzleType } from "../../src/lib/duel/types";
const ORIGIN = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://127.0.0.1:5391";
const games = (process.argv.slice(2).filter((a) => !a.startsWith("--")) as PuzzleType[]);
const shot = process.argv.find((a) => a.startsWith("--shot="))?.slice(7);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const game of games.length ? games : (["snake", "burst", "beat"] as PuzzleType[])) {
  const ctx = await browser.newContext({ viewport: { width: 414, height: 848 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(DEVICE_INIT);
  const page = await ctx.newPage();
  await emulateDevice(page, IPHONE11_APP);
  await page.goto(`${ORIGIN}/practice?terms=1`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
  await button.waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1500);
  await button.click();
  await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 60_000 });
  await page.locator("[data-game-arena]").first().waitFor();
  await page.waitForTimeout(Number(process.argv.find((a) => a.startsWith("--wait="))?.slice(7) ?? 1500));
  const box = await page.evaluate(() => {
    const a = document.querySelector("[data-game-arena]") as HTMLElement;
    const r = a.getBoundingClientRect();
    const slot = a.closest("[data-arena-slot]") ?? a.parentElement!;
    const s = (slot as HTMLElement).getBoundingClientRect();
    return { arena: [r.x, r.y, r.width, r.height].map(Math.round), slot: [s.x, s.y, s.width, s.height].map(Math.round) };
  });
  console.log(game, JSON.stringify(box));
  if (shot) await page.screenshot({ path: `${shot}/${game}-414x896.png` });
  await ctx.close();
}
await browser.close();
