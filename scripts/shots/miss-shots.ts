/**
 * Review screenshots for Polish 1 (24 Oct 2026; a design tool, not a check): an arcade miss in
 * Gemstone, Flightpath and Breaker, and Ascend's wrong tap, at 414×896 in practice.
 *
 *   bun scripts/shots/miss-shots.ts --url=<origin> [--out=<dir>, default .shots/miss]
 *
 * It plays each game in the pre-installed Chromium and keeps the frame where the miss shows: for
 * the arcade games, the moment the shared layer's red miss pulse is up on the game's canvas
 * (arcadeFxMissStats, read through the page's own module), then 150 ms later.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

import { gameDisplayName } from "../../src/lib/duel/gameNames";
import type { PuzzleType } from "../../src/lib/duel/types";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const OUT = opt("out") ?? ".shots/miss";
mkdirSync(OUT, { recursive: true });

async function open(page: Page, game: PuzzleType): Promise<void> {
  await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
  await button.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  await button.click();
  await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 90_000 });
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
}

/** World point → page point for a canvas drawing a w × h world at the largest centred uniform scale. */
async function mapper(page: Page, w: number, h: number) {
  const box = (await page.locator("[data-game-stage] canvas.puzzle-board").first().boundingBox())!;
  const s = Math.min(box.width / w, box.height / h);
  const ox = box.x + (box.width - w * s) / 2;
  const oy = box.y + (box.height - h * s) / 2;
  return { box, at: (x: number, y: number) => ({ x: ox + x * s, y: oy + y * s }) };
}

/** True while the shared layer's miss pulse is up on the game's canvas (read from the page's own module). */
async function pulseUp(page: Page, game: string): Promise<boolean> {
  return page.evaluate(async (id) => {
    const canvas = document.querySelector<HTMLCanvasElement>("[data-game-stage] canvas.puzzle-board");
    const ctx = canvas?.getContext("2d");
    if (!ctx) return false;
    const fx = (await import(/* @vite-ignore */ "/src/lib/arcade/arcadeFx.renderer.ts")) as {
      arcadeFxMissStats: (c: object, g: string) => { pulse: boolean };
    };
    return fx.arcadeFxMissStats(ctx, id).pulse;
  }, game);
}

/** Waits for the miss pulse, then keeps the frame (and one 150 ms later, the puff fading). */
async function catchMiss(page: Page, game: string, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await pulseUp(page, game)) {
      await page.waitForTimeout(30);
      writeFileSync(join(OUT, `${game}-miss.png`), await page.screenshot());
      await page.waitForTimeout(150);
      writeFileSync(join(OUT, `${game}-miss-later.png`), await page.screenshot());
      return true;
    }
    await page.waitForTimeout(16);
  }
  return false;
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const results: string[] = [];
const context = async () => {
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, hasTouch: false });
  return { ctx, page: await ctx.newPage() };
};

// Breaker: leave the paddle still until the ball is lost.
{
  const { ctx, page } = await context();
  await open(page, "breaker");
  const m = await mapper(page, 390, 730);
  const from = m.at(195, 690);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let k = 1; k <= 10; k++) await page.mouse.move(from.x - 17 * k, from.y);
  results.push(`breaker: ${(await catchMiss(page, "breaker", 40_000)) ? "miss caught" : "NO MISS SEEN"}`);
  await page.mouse.up();
  await ctx.close();
}

// Flightpath: flick darts a little wide of the target until one lands off the rings, in view.
{
  const { ctx, page } = await context();
  await open(page, "bullseye");
  await page.waitForTimeout(1500);
  let ok = false;
  for (let dart = 0; dart < 8 && !ok; dart++) {
    const m = await mapper(page, 390, 640);
    const from = m.at(195, 560);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    const wide = 10 + dart * 6;
    for (let k = 1; k <= 6; k++) await page.mouse.move(from.x + wide * k, from.y - 22 * k);
    await page.mouse.up();
    ok = await catchMiss(page, "bullseye", 3500);
    await page.waitForTimeout(1200);
  }
  results.push(`bullseye: ${ok ? "miss caught" : "NO MISS SEEN"}`);
  await ctx.close();
}

// Gemstone: swap neighbours until one makes no match.
{
  const { ctx, page } = await context();
  await open(page, "matchup");
  await page.waitForTimeout(1200);
  const m = await mapper(page, 390, 560);
  let ok = false;
  const cell = (row: number, col: number) => m.at(20 + col * 50 + 25, 100 + row * 50 + 25);
  for (let k = 0; k < 24 && !ok; k++) {
    const row = 1 + (k % 5), col = (k * 3) % 6;
    const a = cell(row, col), b = cell(row, col + 1);
    await page.mouse.click(a.x, a.y);
    await page.mouse.click(b.x, b.y);
    ok = await catchMiss(page, "matchup", 500);
    await page.waitForTimeout(900);
  }
  results.push(`matchup: ${ok ? "miss caught" : "NO MISS SEEN"}`);
  await ctx.close();
}

// Ascend: tap a disc out of order; the frame 60 ms after shows the shake and red outline.
{
  const { ctx, page } = await context();
  await open(page, "numhunt");
  await page.waitForTimeout(800);
  const discs = page.locator("[data-game-stage] [aria-label^='Circle ']");
  const labels = await discs.evaluateAll((els) => els.map((e) => Number(e.getAttribute("aria-label")!.slice(7))));
  const sorted = [...labels].sort((a, b) => a - b);
  // Two right taps, then a wrong one (the largest number).
  for (const n of sorted.slice(0, 2)) await page.locator(`[data-game-stage] [aria-label='Circle ${n}']`).click();
  await page.locator(`[data-game-stage] [aria-label='Circle ${sorted.at(-1)}']`).click();
  const outlined = await page.locator("[data-game-stage] [data-puzzle-rejected]").count();
  writeFileSync(join(OUT, "numhunt-wrong-tap.png"), await page.screenshot());
  results.push(`numhunt: wrong tap, ${outlined} element(s) outlined red`);
  await ctx.close();
}

await browser.close();
console.log(results.join("\n"));
