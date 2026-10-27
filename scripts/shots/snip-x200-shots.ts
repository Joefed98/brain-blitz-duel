/**
 * Review screenshots for Scrumper's 200-point expansion (snipRev 11, 26 Oct 2026; a design tool, not a check):
 * mid-play at 414×896 (the iPhone 11 home-screen size), the HUD's par cuts and par time on screen, plus the
 * opening pan and a level with several fruits.
 *
 *   bun scripts/shots/snip-x200-shots.ts --url=<origin> [--out=screenshots/x200-oct-2026]
 *
 * Each frame is a practice run opened through the dev-only warp (src/lib/arcade/devWarp.ts): the page plays
 * the stored perfect run (fixtures/snip-x200-runs.json.gz) up to a tick chosen here from the replayed states,
 * so the stage opens on that moment with the real renderer, frame and fill.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

import { gameDisplayName } from "../../src/lib/duel/gameNames";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { snipGameFor, SNIP_REV_EXPAND, type SnipState } from "../../src/lib/arcade/snip";
import { decodeSnipRun } from "../../src/lib/duel/snip";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/x200-oct-2026";
mkdirSync(OUT, { recursive: true });

const runs = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/snip-x200-runs.json.gz")).toString()).runs as { level: string; score: number; seed: number; raw: string }[];
const best = runs.find((r) => r.level === "perfect") ?? runs.reduce((a, b) => (b.score > a.score ? b : a));
const events = decodeSnipRun(best.raw).events;
const game = snipGameFor(SNIP_REV_EXPAND);

/** The first tick (from `from`) whose state passes `want`. */
function findTick(want: (s: SnipState) => boolean, from = 1): number {
  const map = new Map(events.map((e) => [e.t, e]));
  let s = game.init(best.seed);
  for (let t = 1; !game.isOver(s); t++) {
    s = game.step(s, map.get(t) ?? null);
    if (t >= from && want(s)) return t;
  }
  throw new Error("no tick shows the wanted moment");
}

const shots: { name: string; tick: number }[] = [
  // Mid-level, the par time still running (the dial part drained) on a golden level with two fruits.
  { name: "par-time", tick: findTick((s) => s.level === 1 && s.levelTick > 100 && (s.fruits ?? []).every((f) => f.st === 0)) },
  { name: "course-pan", tick: findTick((s) => s.level === 2 && s.levelTick === 30) },
  { name: "several-fruits", tick: findTick((s) => (s.fruits?.length ?? 0) >= 2 && s.levelTick > 95 && (s.fruits ?? []).every((f) => f.st === 0), 1) },
];

async function open(page: Page): Promise<void> {
  await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: gameDisplayName("snip"), exact: true }).first();
  await button.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1200);
  await button.click();
  await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 90_000 });
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const shot of shots) {
  const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await context.addInitScript(
    (w) => {
      (window as unknown as { __duelzArcadeWarp: unknown }).__duelzArcadeWarp = w;
      (window as unknown as { __duelzEffects: string }).__duelzEffects = "full";
      try {
        localStorage.setItem("duelz-terms:v1", JSON.stringify({ agreed: true, at: "2026-10-26" }));
      } catch {
        /* private window */
      }
    },
    { game: "snip", seed: best.seed, tick: shot.tick, events: events as readonly ArcadeInputEvent[] },
  );
  const page = await context.newPage();
  await open(page);
  await page.waitForTimeout(450);
  const file = join(OUT, `snip-${shot.name}-414x896.png`);
  await page.screenshot({ path: file });
  console.log(`${file}  (tick ${shot.tick})`);
  await context.close();
}
await browser.close();
