/**
 * Measures, in headless Chromium at 375 × 667, where the practice intro's READY
 * button ends for the given arcade games, and saves a screenshot of each intro.
 * Not a routine check (it needs the dev server and Chromium); run by hand after
 * changing an intro:
 *
 *   bun scripts/intro-ready-375.ts <out-dir> wavefront swing breaker burst
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { showPracticeSide } from "./practice-side-lib";

const [out = "/tmp/intro-ready", ...games] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const PORT = 5183;
const origin = `http://127.0.0.1:${PORT}`;
const proc = spawn("npx", ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore", detached: true });
let failed = 0;
try {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${origin}/practice`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
  for (const game of games) {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 });
    await page.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" });
    await showPracticeSide(page, game);
    const button = page.getByRole("button", { name: gameDisplayName(game as never), exact: true }).first();
    await button.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    await button.click();
    const ready = page.getByRole("button", { name: /^Ready/ });
    await ready.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(800);
    const box = await ready.boundingBox();
    const bottom = box ? box.y + box.height : Number.NaN;
    const ok = bottom <= 667;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${game}: READY bottom ${bottom.toFixed(0)} px of 667`);
    await page.screenshot({ path: `${out}/${game}-intro-375.png` });
    await page.close();
  }
  await browser.close();
} finally {
  if (proc.pid) try { process.kill(-proc.pid); } catch { /* gone */ }
}
process.exit(failed ? 1 : 0);
