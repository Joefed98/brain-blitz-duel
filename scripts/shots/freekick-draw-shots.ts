/**
 * Review shots of Top Bins' drawn shot (freekickRev 4, 3 Nov 2026; a design tool, not a check): a practice round played
 * for real through the canvas at 414×896, 375×667 and the computer layout (1440×900): a stroke drawn from the ball,
 * shot while the finger is down ("1-draw"), the drawn line kept faintly with the marker and the curl dots ("2-drawn"),
 * the power bar held with its needle sweeping ("3-power"); the other kicks are drawn and struck quickly, the tenth kick
 * is shot while it is set ("4-late"), then the answer reveal ("5-reveal"). With --hoops, the real renderer
 * (@napi-rs/canvas) also draws a rev-4 deal seed's first and last corner-target kicks side by side, so the shrunken hoop
 * (55 cm on kick 1 → 38.5 cm on kick 10) is seen whatever kicks practice deals ("freekick-hoop-shrink.png").
 *
 *   bun scripts/shots/freekick-draw-shots.ts --url=http://127.0.0.1:5193 [--sizes=414x896,375x667,1440x900] [--hoops]
 *     [--out=screenshots/sports-batch-nov-2026]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { createCanvas } from "@napi-rs/canvas";
import { FK_AIM, FK_TARGET_LEFT, FK_TARGET_RIGHT, FREEKICK_REV_4, FREEKICK_WORLD_H, FREEKICK_WORLD_W, fkSeedPlan, freekickGameFor } from "../../src/lib/arcade/freekick";
import { drawFreekickArt } from "../../src/lib/arcade/freekick.renderer";
import { FREEKICK_DEAL_V4 } from "../../src/lib/duel/freekickDealV4.server";

const opt = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5193").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/sports-batch-nov-2026";
const SIZES = (opt("sizes") ?? "414x896,375x667,1440x900").split(",").map((s) => s.split("x").map(Number) as [number, number]);
mkdirSync(OUT, { recursive: true });
/** How long the power bar is held: the meter reaches the gold zone 35–38 ticks after the press (about 0.6 s). */
const HOLD_MS = Number(opt("hold") ?? 610);
/** The ball's place on screen (world px): the camera sits on the line to the goal's centre, 6 m back, 2.2 m up. */
const BALL = { x: 195, y: 576 };

/** World px → page px through the arena canvas (the world fitted whole, top-anchored, centred across). */
async function mapper(page: Page) {
  const box = await page.locator("[data-game-arena] canvas").first().boundingBox();
  if (!box) throw new Error("no arena canvas");
  const k = Math.min(box.width / FREEKICK_WORLD_W, box.height / FREEKICK_WORLD_H);
  const ox = box.x + (box.width - FREEKICK_WORLD_W * k) / 2;
  return (x: number, y: number) => ({ x: ox + x * k, y: box.y + y * k });
}

/** Draws a stroke from the ball to (ex, ey) bowed `bow` world px to the left (+) or right (−), `steps` moves. */
async function drawStroke(page: Page, at: (x: number, y: number) => { x: number; y: number }, ex: number, ey: number, bow: number, hold?: () => Promise<void>) {
  const s = at(BALL.x, BALL.y);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = BALL.x + (ex - BALL.x) * t - bow * Math.sin(Math.PI * t);
    const y = BALL.y + (ey - BALL.y) * t;
    const q = at(x, y);
    await page.mouse.move(q.x, q.y);
    await page.waitForTimeout(16);
  }
  if (hold) await hold();
  await page.mouse.up();
}

async function shoot(w: number, h: number) {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
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
  // 1. Draw: a stroke from the ball bowed left into the goal's top right (a curl to the right), shot with the finger down.
  await drawStroke(page, at, 268, 304, 46, async () => {
    await page.waitForTimeout(80);
    await page.screenshot({ path: join(OUT, `freekick-${tag}-1-draw.png`) });
  });
  await page.waitForTimeout(250);
  // 2. The drawn line kept faintly, with the marker and the curl dots.
  await page.screenshot({ path: join(OUT, `freekick-${tag}-2-drawn.png`) });
  // 3. Power: hold the bar, shot while the needle sweeps, released near the gold.
  let p = at(195, 663);
  await page.mouse.move(p.x, p.y);
  const t0 = Date.now();
  await page.mouse.down();
  await page.waitForTimeout(380);
  await page.screenshot({ path: join(OUT, `freekick-${tag}-3-power.png`) });
  await page.waitForTimeout(Math.max(0, HOLD_MS - (Date.now() - t0)));
  await page.mouse.up();
  // The other kicks, quickly (a drawn stroke and a press of the bar); the tenth is shot while it is set.
  for (let kick = 1; kick < 10; kick++) {
    await page.waitForTimeout(3700);
    await drawStroke(page, at, kick % 2 ? 128 : 262, 306, kick % 2 ? -44 : 44);
    await page.waitForTimeout(150);
    if (kick === 9) await page.screenshot({ path: join(OUT, `freekick-${tag}-4-late.png`) });
    p = at(195, 663);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(HOLD_MS);
    await page.mouse.up();
  }
  await page.locator("[data-practice-reveal-actions]").first().waitFor({ timeout: 120_000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, `freekick-${tag}-5-reveal.png`) });
  await browser.close();
}

/** The first and last corner-target kicks of a rev-4 deal seed, drawn side by side by the real renderer. */
function hoops() {
  const corner = (t: number) => t === FK_TARGET_LEFT || t === FK_TARGET_RIGHT;
  const seed = FREEKICK_DEAL_V4.find((s) => {
    const ks = fkSeedPlan(s, FREEKICK_REV_4).kicks;
    return corner(ks[0]!.target) && corner(ks[9]!.target);
  }) ?? FREEKICK_DEAL_V4[0]!;
  const game = freekickGameFor(FREEKICK_REV_4);
  const canvas = createCanvas(FREEKICK_WORLD_W * 2, FREEKICK_WORLD_H);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  [0, 9].forEach((k, i) => {
    // The kick in its aim phase, nothing struck (the state of a run reaching kick k).
    let s = game.init(seed);
    while (s.phase !== FK_AIM) s = game.step(s, null);
    s = { ...s, k, deadline: s.deadline + 540 * k, tick: s.tick + 540 * k };
    ctx.save();
    ctx.translate(FREEKICK_WORLD_W * i, 0);
    ctx.beginPath();
    ctx.rect(0, 0, FREEKICK_WORLD_W, FREEKICK_WORLD_H);
    ctx.clip();
    drawFreekickArt(ctx, s, { width: FREEKICK_WORLD_W, height: FREEKICK_WORLD_H });
    ctx.restore();
  });
  const path = join(OUT, "freekick-hoop-shrink.png");
  writeFileSync(path, canvas.toBuffer("image/png"));
  console.log(`hoops: ${path} (seed ${seed}: kick 1 and kick 10)`);
}

if (process.argv.includes("--hoops")) hoops();
if (!process.argv.includes("--hoops-only")) for (const [w, h] of SIZES) await shoot(w, h);
console.log(`freekick draw shots → ${OUT}`);
