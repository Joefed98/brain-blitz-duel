/**
 * Records the six puzzle intro demos of the Logic overhaul (session 1; Joe 16 Nov 2026: "record them by real play on
 * Normal and bundle them with the app, as Pattern did"): a dev server with a local intro-demo key, the practice page in
 * its "Intro examples" mode (the fixed intro example, the touch recorder on), each game solved through the real stage
 * by the screenshot tool's driver (scripts/shots/drivers/logic.ts: real taps and presses, paced like a player), and
 * the log the Save button sends captured from its request (never saved to any database), then written as one
 * `intro_demos` row to src/lib/duel/bundledDemos/<game>.json. logic-demos-check proves each against today's deal.
 *
 *   bun scripts/logic-demos-puzzle-record.ts [games…] [--url=<origin with INTRO_DEMO_KEY=local-logic-demos>]
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";

import { fromJSON } from "seroval";
import { exampleFor } from "./shots/examples";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { LOGIC_DRIVERS } from "./shots/drivers/logic";
import { playFromCatalogue } from "./practice-side-lib";
import type { PuzzleType } from "../src/lib/duel/types";

const KEY = "local-logic-demos";
const args = process.argv.slice(2);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const GAMES = (args.filter((a) => !a.startsWith("--")) as PuzzleType[]).length
  ? (args.filter((a) => !a.startsWith("--")) as PuzzleType[])
  : (["sudoku", "tubes", "tower", "safe", "nonogram", "flood"] as PuzzleType[]);
let origin = opt("url");
let server: ReturnType<typeof spawn> | null = null;
if (!origin) {
  origin = "http://127.0.0.1:5193";
  server = spawn("npx", ["vite", "--port", "5193", "--strictPort", "--host", "127.0.0.1"], {
    env: { ...process.env, INTRO_DEMO_KEY: KEY, NODE_OPTIONS: "--max-old-space-size=6144" },
    stdio: "ignore",
    detached: true,
  });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const nameOf = (url: string) => {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
  } catch {
    return id;
  }
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let failed = 0;
try {
  for (const game of GAMES) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: false });
    const page: Page = await context.newPage();
    let saved: unknown = null;
    await page.route("**/_serverFn/**", async (route) => {
      const name = nameOf(route.request().url());
      if (/savePuzzleDemo/.test(name)) {
        try {
          saved = fromJSON(JSON.parse(route.request().postData() ?? "{}"));
        } catch (e) {
          saved = { error: String(e) };
        }
        return route.fulfill({ status: 500, body: "not saved (recorded for the bundle)" });
      }
      return route.continue();
    });
    try {
      await page.goto(`${origin}/practice?dev=1&key=${KEY}`, { waitUntil: "domcontentloaded" });
      const toggle = page.getByRole("switch").filter({ has: page.locator("xpath=..") }).first();
      await page.getByText("Intro examples").waitFor({ timeout: 90_000 });
      await page.locator('label:has-text("Intro examples") input[role="switch"]').check();
      await playFromCatalogue(page, game, 90_000);
      void toggle;
      await page.locator("[data-game-stage]").first().waitFor({ timeout: 90_000 });
      await page.waitForTimeout(4200);
      const puzzle = exampleFor(game);
      if (game === "tubes") {
        // Polypotions: a tap to lift and one to pour, paced past the pour's animation (about 0.9 s).
        for (const move of String((puzzle as { solution?: string }).solution ?? "").split(",")) {
          const [from, to] = move.split(">").map(Number);
          await page.locator(`[data-game-stage] button[aria-label^="Flask ${from! + 1}:"]`).first().click();
          await page.waitForTimeout(220);
          await page.locator(`[data-game-stage] button[aria-label^="Flask ${to! + 1}:"]`).first().click();
          await page.waitForTimeout(1000);
        }
      } else if (game === "tower") {
        // Hanoi: each move a tap on the post to lift and one to drop, paced so the ring lands before the next lift.
        for (const move of String((puzzle as { solution?: string }).solution ?? "").split(",")) {
          const [from, to] = move.split(">").map(Number);
          await page.locator(`[data-game-stage] button[aria-label="Post ${from! + 1}"]`).first().click();
          await page.waitForTimeout(220);
          await page.locator(`[data-game-stage] button[aria-label="Post ${to! + 1}"]`).first().click();
          await page.waitForTimeout(480);
        }
      } else {
        const driver = LOGIC_DRIVERS[game]!;
        await driver.partial?.({ page, puzzle, wait: (ms) => page.waitForTimeout(ms) });
        await driver.solve?.({ page, puzzle, wait: (ms) => page.waitForTimeout(ms) });
      }
      const save = page.getByRole("button", { name: /intro demo/i }).first();
      await save.waitFor({ timeout: 30_000 });
      await save.click();
      for (let i = 0; i < 40 && !saved; i++) await page.waitForTimeout(250);
      if (!saved) throw new Error("no save request seen");
      const data = (saved as { data?: { puzzle: unknown; log: unknown } }).data ?? (saved as { puzzle: unknown; log: unknown });
      const log = data.log as { actions: { t: number }[] } & Record<string, unknown>;
      // The intro's countdown before the first touch is not part of the demo: the first touch at 0.6 s, as Pattern's.
      const lead = Math.max(0, (log.actions[0]?.t ?? 0) - 600);
      for (const a of log.actions) a.t -= lead;
      const lengthMs = Math.max(0, ...log.actions.map((a) => Number(a.t) || 0));
      // The public half only (what the Save function stores: the server opens the sealed deal and keeps `pub`).
      const pub = splitPuzzle(data.puzzle as never).pub;
      const row = { game_type: game, seed: 0, puzzle: pub, input_log: log, example_id: "intro-1", start_tick: 0, length_ticks: Math.round(lengthMs) };
      writeFileSync(new URL(`../src/lib/duel/bundledDemos/${game}.json`, import.meta.url), JSON.stringify(row));
      console.log(`OK ${game}: ${log.actions.length} actions, ${(lengthMs / 1000).toFixed(1)} s`);
    } catch (e) {
      failed++;
      await page.screenshot({ path: `/tmp/claude-0/demo-fail-${game}.png` }).catch(() => {});
      console.log(`FAIL ${game}: ${(e as Error).message.split("\n")[0]}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  if (server?.pid) process.kill(-server.pid);
}
process.exit(failed ? 1 : 0);
