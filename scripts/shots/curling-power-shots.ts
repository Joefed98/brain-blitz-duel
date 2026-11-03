/**
 * Review shots of Curl Champ curlRev 4 (the power bar, three reds, curling's count; 3 Nov 2026; a design tool, not a
 * check): a practice round at each size (default 414×896, 375×667 and the computer layout at 1440×900), played with
 * the mouse as a finger would:
 *
 *   1-reds     the end's start: the three red stones in and around the house (the inset shows where each sits);
 *   2-power    the target dragged, Out picked, and a drag on the power bar mid-way: the marker, the fill and the gold
 *              HOUSE zone;
 *   3-set      the weight set (the marker stays) and the Throw button lit;
 *   4-throw    Throw tapped: the stone sliding, the bar's tick where it was thrown;
 *   5-reveal   the answer reveal after the other seven stones (Throw tapped again at the same weight).
 *
 *   bun scripts/shots/curling-power-shots.ts --url=http://127.0.0.1:5191 [--out=screenshots/sports-batch-nov-2026] [--sizes=414x896,375x667,1440x900]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { CURLING_REV, CURLING_W, curlingWorldHFor } from "../../src/lib/arcade/curling";
import { CURL_INSET, CURL_METER_V4, curlMeterY } from "../../src/lib/arcade/curling.renderer";

const opt = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/sports-batch-nov-2026";
const SIZES = (opt("sizes") ?? "414x896,375x667,1440x900").split(",").map((s) => s.split("x").map(Number) as [number, number]);
mkdirSync(OUT, { recursive: true });
const WORLD_H = curlingWorldHFor(CURLING_REV);

/** World px → page px over the stage's canvas (the world at its largest uniform scale, centred across, top-anchored). */
async function mapper(page: Page) {
  const box = (await page.locator("[data-game-arena] canvas").first().boundingBox())!;
  const k = Math.min(box.width / CURLING_W, box.height / WORLD_H);
  const ox = box.x + (box.width - CURLING_W * k) / 2;
  return (x: number, y: number) => ({ x: ox + x * k, y: box.y + y * k, k });
}

async function shoot(w: number, h: number) {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const desktop = w >= 1024;
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: desktop ? 1 : 2 });
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/practice?game=curling`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 120_000 });
  await ready.click();
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(4500); // the practice countdown
  const at = await mapper(page);
  const shot = (name: string) => page.screenshot({ path: join(OUT, `curling-${w}x${h}-${name}.png`) });
  await shot("1-reds");

  // The target, 30 cm right of the button in the inset; Out.
  const i = CURL_INSET;
  const target = at(i.x + i.w / 2 + 30 * i.scale, i.y + i.h / 2);
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x + 2, target.y, { steps: 3 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Out-turn" }).click();
  // A drag on the power bar from light up to a draw weight, shot mid-drag.
  const m = CURL_METER_V4;
  const barX = m.x + m.w / 2;
  const from = at(barX, curlMeterY(150, m));
  const to = at(barX, curlMeterY(320, m));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, (from.y + to.y) / 2, { steps: 6 });
  await page.waitForTimeout(200);
  await shot("2-power");
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await shot("3-set");
  const throwButton = page.getByRole("button", { name: "Throw" });
  await throwButton.click();
  await page.waitForTimeout(1800);
  await shot("4-throw");
  for (let t = 1; t < 8; t++) {
    // Wait for the stone to settle (Throw takes effect only while aiming), then throw the same weight again.
    await page.waitForTimeout(7500);
    await throwButton.click();
  }
  await page
    .locator("[data-reveal-score], [data-arcade-reveal]")
    .first()
    .waitFor({ timeout: 150_000 })
    .catch(async (e) => {
      await shot("stuck");
      throw e;
    });
  await page.waitForTimeout(2500);
  await shot("5-reveal");
  await browser.close();
  console.log(`${w}x${h}: shot`);
}

for (const [w, h] of SIZES) await shoot(w, h);
