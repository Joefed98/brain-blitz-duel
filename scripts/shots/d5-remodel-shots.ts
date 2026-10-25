/**
 * Review screenshots for the D5 remodels (docs/depth/d5-remodels.md): Topsy-Turvy and Jumbled mid-play on
 * several fresh practice puzzles (each run deals a new one), as an iPhone 11 home-screen app's viewport (414 × 896).
 * A design tool, not a check.
 *
 *   bun scripts/shots/d5-remodel-shots.ts [--url=<origin>] [--out=screenshots/d5-remodels-oct-2026] [--runs=3]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Page } from "playwright";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = opt("out") ?? "screenshots/d5-remodels-oct-2026";
const RUNS = Number(opt("runs") ?? 3);
const PORT = 5193;

async function server(): Promise<{ origin: string; proc: ChildProcess | null }> {
  const url = opt("url");
  if (url) return { origin: url.replace(/\/$/, ""), proc: null };
  const proc = spawn("npx", ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore", detached: true });
  const origin = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${origin}/practice`)).ok) return { origin, proc };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

async function open(page: Page, origin: string, name: string) {
  await page.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name, exact: true }).first();
  await button.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  await button.click();
  await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 90_000 });
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);
}

async function drag(page: Page, kind: "R" | "C", index: number, steps: number) {
  const box = (await page.locator("[data-game-stage] [data-jumbled-board]").first().boundingBox())!;
  const step = box.width / 5;
  const x = box.x + (kind === "R" ? 2.5 : index + 0.5) * step;
  const y = box.y + (kind === "R" ? index + 0.5 : 2.5) * step;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (kind === "R" ? steps * step : 0), y + (kind === "C" ? steps * step : 0), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

const { origin, proc } = await server();
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
try {
  for (let run = 1; run <= RUNS; run++) {
    for (const game of ["gravity", "tiles"] as const) {
      const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
      const page = await context.newPage();
      await open(page, origin, game === "gravity" ? "Topsy-Turvy" : "Jumbled");
      if (game === "gravity") {
        for (const dir of ["Down", "Right", "Up"].slice(0, run)) {
          await page.getByRole("button", { name: dir, exact: true }).first().click();
          await page.waitForTimeout(450);
        }
      } else {
        await drag(page, "R", 2, 1);
        if (run > 1) await drag(page, "C", 1, -1);
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(OUT, `${game === "gravity" ? "topsy" : "jumbled"}-414x896-midplay-${run}.png`) });
      await context.close();
    }
  }
  // A dragged line mid-swipe (the wrap), held before release.
  const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await open(page, origin, "Jumbled");
  const box = (await page.locator("[data-game-stage] [data-jumbled-board]").first().boundingBox())!;
  const step = box.width / 5;
  await page.mouse.move(box.x + 2.5 * step, box.y + 1.5 * step);
  await page.mouse.down();
  await page.mouse.move(box.x + 3.9 * step, box.y + 1.5 * step, { steps: 10 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(OUT, "jumbled-414x896-mid-swipe.png") });
  await page.mouse.up();
  await context.close();
  console.log(`screenshots in ${OUT}`);
} finally {
  await browser.close();
  if (proc?.pid) process.kill(-proc.pid);
}
