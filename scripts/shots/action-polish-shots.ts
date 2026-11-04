/**
 * Action arcade polish (3 Nov 2026) review frames: each Action game's live practice round in headless Chromium at a
 * phone size, a few seconds in, with simple scripted input so the world is in motion (Slice swipes, Roofbound and
 * Moon Climb tap, Grappler holds and lets go, Iron Wall drags and lifts, High Rise drops). Frames
 * `<out>/<game>-<w>x<h>-<k>-<tag>.png` at 2× device pixels, two per game (about 4 s and 9 s in). A design tool, not a check.
 *
 *   bun scripts/shots/action-polish-shots.ts --url=<origin> [--tag=before|after] [--sizes=414x896,375x667]
 *       [--out=screenshots/action-polish-nov-2026] [games…]
 */
import { mkdirSync } from "node:fs";
import { chromium, type CDPSession, type Page } from "playwright";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = opt("url") ?? "http://127.0.0.1:5301";
const OUT = opt("out") ?? "screenshots/action-polish-nov-2026";
const TAG = opt("tag") ?? "after";
const SIZES = (opt("sizes") ?? "414x896").split(",").map((s) => s.split("x").map(Number) as [number, number]);
const ALL = ["slice", "flip", "swing", "ricochet", "bastion", "skyline"];
const named = args.filter((a) => !a.startsWith("--"));
const GAMES = named.length ? named : ALL;
mkdirSync(OUT, { recursive: true });

type Box = { x: number; y: number; width: number; height: number };

/** Touch input through CDP (the stages listen for touch pointers on a touch-emulated phone). */
class Touch {
  constructor(private cdp: CDPSession, private page: Page) {}
  private send(type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) {
    return this.cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  }
  async down(x: number, y: number) { await this.send("touchStart", x, y); }
  async move(x: number, y: number) { await this.send("touchMove", x, y); }
  async up() { await this.send("touchEnd", 0, 0); }
  async tap(x: number, y: number, hold = 60) { await this.down(x, y); await this.page.waitForTimeout(hold); await this.up(); }
}

/** One beat of each game's scripted input (about 0.3–1.4 s of real time). */
async function beat(page: Page, t: Touch, game: string, a: Box, k: number): Promise<void> {
  const cx = a.x + a.width / 2;
  const cy = a.y + a.height / 2;
  switch (game) {
    case "slice": {
      const y = a.y + a.height * (0.55 + 0.1 * (k % 3));
      await t.down(a.x + 20, y);
      for (let i = 1; i <= 10; i++) { await t.move(a.x + 20 + ((a.width - 40) * i) / 10, y - 60 + i * 6); await page.waitForTimeout(16); }
      await t.up();
      await page.waitForTimeout(350);
      return;
    }
    case "flip":
      await t.tap(cx, cy);
      await page.waitForTimeout(480);
      return;
    case "ricochet":
      await t.tap(cx + (k % 2 ? 60 : -60), cy);
      await page.waitForTimeout(380);
      return;
    case "swing":
      await t.tap(cx, cy, 700);
      await page.waitForTimeout(260);
      return;
    case "bastion": {
      await t.down(cx, a.y + a.height * 0.72);
      for (let i = 1; i <= 6; i++) { await t.move(cx + (k % 2 ? 7 : -7) * i, a.y + a.height * 0.72 - i * 4); await page.waitForTimeout(30); }
      await page.waitForTimeout(150);
      await t.up();
      await page.waitForTimeout(450);
      return;
    }
    default:
      await t.tap(cx, cy);
      await page.waitForTimeout(1300);
  }
}

async function shoot(game: string, w: number, h: number): Promise<void> {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(`${game}: page error: ${e.message}`));
  await page.addInitScript(() => {
    (window as unknown as { __duelzEffects: string }).__duelzEffects = "full";
    let seed = 7;
    Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  });
  await page.goto(`${ORIGIN}/practice?game=${game}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 150_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${game}-${w}x${h}-intro-${TAG}.png` });
  await ready.click();
  const arena = page.locator("[data-game-arena]").first();
  await arena.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(game === "flip" ? 1000 : 3600);
  const a = (await arena.boundingBox())!;
  const touch = new Touch(await context.newCDPSession(page), page);
  const start = Date.now();
  let k = 0;
  let shot = 0;
  // Roofbound ends at its first crash, so it is photographed early, before any input.
  for (const at of game === "flip" ? [800, 2000] : [4000, 9000]) {
    while (Date.now() - start < at) {
      if (game === "flip") await page.waitForTimeout(50);
      else await beat(page, touch, game, a, k++);
    }
    shot += 1;
    await page.screenshot({ path: `${OUT}/${game}-${w}x${h}-${shot}-${TAG}.png` });
    console.log(`${OUT}/${game}-${w}x${h}-${shot}-${TAG}.png`);
  }
  await browser.close();
}

for (const g of GAMES) for (const [w, h] of SIZES) await shoot(g, w, h);
