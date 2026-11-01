/**
 * Review shots of Top Bins' prepared shot (freekickRev 3, 1 Nov 2026; a design tool, not a check): a practice round at
 * 414×896 (and 375×667 with --sizes), played for real through the canvas: the aim tap on the goal ("aim"), a sideways
 * drag for the curl with its preview ("curl"), the power bar held with its needle sweeping ("power"), the strike's
 * verdict in flight ("strike"); then the other nine kicks are taken quickly and the answer reveal is shot ("reveal").
 *
 *   bun scripts/shots/freekick-prepare-shots.ts --url=http://127.0.0.1:5193 [--out=screenshots/sports-prepare-nov-2026]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { FREEKICK_WORLD_H, FREEKICK_WORLD_W } from "../../src/lib/arcade/freekick";

const opt = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5193").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/sports-prepare-nov-2026";
const SIZES = (opt("sizes") ?? "414x896").split(",").map((s) => s.split("x").map(Number) as [number, number]);
mkdirSync(OUT, { recursive: true });
/** How long the power bar is held: the meter reaches the gold zone 35–38 ticks after the press (about 0.6 s). */
const HOLD_MS = Number(opt("hold") ?? 610);

/** World px → page px through the arena canvas (the world fitted whole, top-anchored, centred across). */
async function mapper(page: Page) {
  const box = await page.locator("[data-game-arena] canvas").first().boundingBox();
  if (!box) throw new Error("no arena canvas");
  const k = Math.min(box.width / FREEKICK_WORLD_W, box.height / FREEKICK_WORLD_H);
  const ox = box.x + (box.width - FREEKICK_WORLD_W * k) / 2;
  return (x: number, y: number) => ({ x: ox + x * k, y: box.y + y * k });
}

async function shoot(w: number, h: number) {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
  // The computer layout at DPR 1: a 2880 × 1800 capture is slow enough to run a kick's 9 s clock out between steps.
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w >= 1024 ? 1 : 2, hasTouch: false });
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/practice?game=freekick`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 120_000 });
  await ready.click();
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  const at = await mapper(page);
  const tag = `${w}x${h}`;
  // 1. Aim: a tap high in the goal's right side.
  let p = at(262, 306);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(OUT, `freekick-${tag}-1-aim.png`) });
  // 2. Curl: a sideways drag (the preview follows the finger), shot mid-drag, then released.
  p = at(150, 470);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    const q = at(150 - i * 8, 472);
    await page.mouse.move(q.x, q.y);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(OUT, `freekick-${tag}-2-curl.png`) });
  await page.mouse.up();
  await page.waitForTimeout(200);
  // 3. Power: hold the bar, shot while the needle sweeps, released near the gold.
  p = at(195, 663);
  await page.mouse.move(p.x, p.y);
  const t0 = Date.now();
  await page.mouse.down();
  await page.waitForTimeout(380);
  await page.screenshot({ path: join(OUT, `freekick-${tag}-3-power.png`) });
  await page.waitForTimeout(Math.max(0, HOLD_MS - (Date.now() - t0)));
  await page.mouse.up();
  await page.waitForTimeout(650);
  await page.screenshot({ path: join(OUT, `freekick-${tag}-4-strike.png`) });
  // The other nine kicks, quickly (an aim tap and a press of the bar).
  for (let kick = 1; kick < 10; kick++) {
    await page.waitForTimeout(process.argv.includes("--debug") ? 2500 : 3700);
    const a = at(kick % 2 ? 140 : 250, 318);
    await page.mouse.click(a.x, a.y);
    await page.waitForTimeout(120);
    const b = at(195, 663);
    await page.mouse.move(b.x, b.y);
    await page.mouse.down();
    await page.waitForTimeout(HOLD_MS);
    await page.mouse.up();
    if (process.argv.includes("--debug")) {
      await page.waitForTimeout(1200);
      await page.screenshot({ path: join(OUT, `debug-${tag}-kick${kick + 1}.png`) });
    }
  }
  await page.locator("[data-practice-reveal-actions]").first().waitFor({ timeout: 120_000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, `freekick-${tag}-5-reveal.png`) });
  await browser.close();
}

for (const [w, h] of SIZES) await shoot(w, h);
console.log(`freekick prepare shots → ${OUT}`);
