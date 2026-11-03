/**
 * Jaywalk crossRev 11 screenshot (3 Nov 2026, docs/arcade-standard/cross.md "crossRev 11"): an elite bot run is played
 * in Bun, then a headless Chromium page (414×896 at DPR 2, the play box's 414×772 under a 60 px header) imports the real
 * sim and renderer from a running dev server, replays the log and photographs one frame mid-run: no coins, the HUD's
 * "NO-STOP ×n" pill gold (a streak paying), the walker in traffic after the island.
 *
 *   bun scripts/shots/jaywalk-rev11-shots.ts --url=http://127.0.0.1:5201 [--out=screenshots/arcade-batch-nov-2026]
 */
import { mkdirSync } from "node:fs";
import { crossFlowNext, crossGameFor, CROSS_REV_FLOW, CROSS_X_ISLAND, type CrossState } from "../../src/lib/arcade/cross";
import { decodeCrossRun } from "../../src/lib/duel/cross";
import { roomSeed } from "../arcade-skill-bands/games";
import { playCrossRun } from "../cross-expand-record";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const URL_ = opt("url") ?? "http://127.0.0.1:5201";
const OUT = opt("out") ?? "screenshots/arcade-batch-nov-2026";
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

// A mid-run frame: the third crossing or later, the streak paying from ×2, the walker standing in a lane above the island.
let picked: { seed: number; events: unknown[]; tick: number } | null = null;
for (let n = 0; n < 40 && !picked; n++) {
  const seed = roomSeed(n);
  const run = playCrossRun(CROSS_REV_FLOW, seed, "elite", true);
  const events = decodeCrossRun(run.raw).events;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const game = crossGameFor(CROSS_REV_FLOW);
  let s = game.init(seed) as CrossState;
  while (!game.isOver(s) && !picked) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.crossings >= 2 && crossFlowNext(s) >= 3 && s.lane > CROSS_X_ISLAND + 2 && s.hop === 0 && s.tick > 1500) picked = { seed, events, tick: s.tick };
  }
}
if (!picked) throw new Error("no run showed a paying streak mid-crossing");
console.log(`seed ${picked.seed}, tick ${picked.tick}`);

mkdirSync(OUT, { recursive: true });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
// A static file (not the app), so nothing re-renders or reloads the page under the canvas.
await page.goto(`${URL_}/og-image.png`, { waitUntil: "load", timeout: 120_000 });
await page.waitForTimeout(1500);
await page.evaluate(async ({ seed, events, rev }) => {
  const sim = await import("/src/lib/arcade/cross.ts");
  const art = await import("/src/lib/arcade/cross.renderer.ts");
  document.body.innerHTML = "";
  document.body.style.margin = "0";
  document.body.style.background = "#070709";
  const header = document.createElement("div");
  header.style.cssText = "height:60px;background:#070709";
  const canvas = document.createElement("canvas");
  canvas.width = 414 * 2;
  canvas.height = 772 * 2;
  canvas.style.cssText = "width:414px;height:772px;display:block";
  document.body.append(header, canvas);
  const ctx = canvas.getContext("2d")!;
  const game = sim.crossGameFor(rev);
  const byTick = new Map((events as { t: number }[]).map((e) => [e.t, e]));
  let state = game.init(seed);
  (window as unknown as { __cross: unknown }).__cross = {
    to(tick: number) {
      while (state.tick < tick) {
        state = game.step(state, (byTick.get(state.tick + 1) as never) ?? null);
        if (tick - state.tick < 90 || state.tick % 3 === 0) {
          ctx.setTransform(2, 0, 0, 2, 0, 0);
          art.drawCrossArt(ctx, state, { width: 414, height: 772 }, true, true);
        }
      }
    },
  };
}, { seed: picked.seed, events: picked.events, rev: CROSS_REV_FLOW });
await page.evaluate((t) => (window as unknown as { __cross: { to(t: number): void } }).__cross.to(t), picked.tick);
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/jaywalk-rev11-midrun.png` });
console.log(`${OUT}/jaywalk-rev11-midrun.png (tick ${picked.tick})`);
await browser.close();
