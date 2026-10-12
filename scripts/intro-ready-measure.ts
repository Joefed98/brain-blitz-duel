/**
 * Measures the round intro in headless Chromium: for each given game it opens
 * /practice at 375 × 667 (and 390 × 700), picks the game, and reports whether
 * the READY button is fully on screen without scrolling, plus the intro HOW
 * line count. A measuring tool for intro text changes (not a routine check:
 * it needs Chromium and a dev server, like arcade-play-check).
 *
 *   bun scripts/intro-ready-measure.ts bintoss bullseye rally beat inkbridge orbit
 *   bun scripts/intro-ready-measure.ts --url=http://127.0.0.1:5179 orbit
 *   bun scripts/intro-ready-measure.ts --all --sizes=375x667   # every game, puzzles included
 *
 * A case fails when READY is not fully on screen or the intro text above it
 * scrolls (any overflow inside .round-intro-content).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

import { gameDisplayName } from "../src/lib/duel/gameNames";

const args = process.argv.slice(2);
const URL_ARG = args.find((a) => a.startsWith("--url="))?.slice(6);
const ALL = args.includes("--all");
const SIZES = (args.find((a) => a.startsWith("--sizes="))?.slice(8) ?? "375x667,390x700")
  .split(",")
  .map((s) => s.split("x").map(Number) as [number, number]);
const GAMES = ALL
  ? await import("../src/lib/duel/registry").then((r) => r.PUZZLE_TYPES.filter((t) => r.puzzleDef(t).category !== "memory"))
  : args.filter((a) => !a.startsWith("--"));
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 5181;

async function startServer(): Promise<{ origin: string; proc: ChildProcess | null }> {
  if (URL_ARG) return { origin: URL_ARG.replace(/\/$/, ""), proc: null };
  const proc = spawn("npx", ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore", detached: true });
  const origin = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${origin}/practice`)).ok) return { origin, proc };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

if (!existsSync(CHROMIUM)) {
  console.log(`FAIL: environment: no Chromium at ${CHROMIUM}`);
  process.exit(1);
}
const { chromium } = await import("playwright");
const { origin, proc } = await startServer();
const browser = await chromium.launch({ executablePath: CHROMIUM });
let failures = 0;
try {
  for (const [width, height] of SIZES) {
    for (const game of GAMES) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" });
      const button = page.getByRole("button", { name: gameDisplayName(game as never), exact: true }).first();
      try {
        await button.waitFor({ timeout: ALL ? 15_000 : 60_000 });
      } catch {
        console.log(`skip ${width}x${height} ${game}: not in the practice list`);
        await page.close();
        continue;
      }
      await page.waitForTimeout(1500);
      await button.click();
      const ready = page.getByRole("button", { name: /^Ready/ });
      await ready.waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1200); // intro demo box and fonts settle
      const box = await ready.boundingBox();
      const scrolled = await page.evaluate(() => {
        const el = document.querySelector(".round-intro-content");
        return el ? el.scrollHeight - el.clientHeight : 0;
      });
      const visible = !!box && box.y >= 0 && box.y + box.height <= height && scrolled <= 0;
      if (!visible) failures++;
      console.log(`${visible ? "ok  " : "FAIL"} ${width}x${height} ${game.padEnd(10)} READY ${box ? `${Math.round(box.y)}-${Math.round(box.y + box.height)}` : "missing"} · intro overflow ${scrolled}px`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  if (proc?.pid) try { process.kill(-proc.pid); } catch { /* gone */ }
}
if (failures) {
  console.log(`FAIL: READY not fully visible or intro text scrolls in ${failures} case(s)`);
  process.exit(1);
}
console.log("READY fully visible and no intro scrolling for every game and size");
