/**
 * Review screenshots for Roofbound flipRev 11 (3 Nov 2026, docs/arcade-standard/flip.md "flipRev 11"; a design tool,
 * not a check): a real practice run at 414 × 896 in headless Chromium (rooms and practice deal flipRev 11), the page
 * clock stepped one sim tick at a time while the in-page route planner (scripts/flip-x200-plan.ts, on the live run's
 * own state and flipRev 11's game) taps, saving
 *  - roofbound-rev11-midrun.png: mid-run (from 25 s) with the flow streak in the HUD and the faint star trail guide
 *    when one is in view, and
 *  - roofbound-rev11-perfect.png: a perfect landing on a sweet spot 6 ticks (100 ms) in, the molten PERFECT up.
 *
 *   bun scripts/shots/roofbound-rev11-shots.ts --url=http://127.0.0.1:5301 [--out=screenshots/arcade-batch-nov-2026]
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = opt("url") ?? "http://127.0.0.1:5301";
const OUT = opt("out") ?? "screenshots/arcade-batch-nov-2026";
mkdirSync(OUT, { recursive: true });

type Info = { tick: number; ended: number; flow: number; streak: number; sweetT: number; trailInView: boolean };

async function info(page: Page): Promise<Info> {
  return page.evaluate(() => {
    const s = (window as unknown as { __fs: any }).__fs;
    const trailInView = s.v8.trails.some((t: any) => (t.x[0] - s.x) / 256 > 40 && (t.x[4] - s.x) / 256 < 330);
    return { tick: s.tick, ended: s.ended, flow: s.flow ?? 0, streak: s.streak ?? 0, sweetT: s.sweetT ?? 0, trailInView };
  });
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await page.addInitScript(() => {
    (window as unknown as { __duelzEffects: string }).__duelzEffects = "full";
    (globalThis as unknown as { __arcadeProbe: (s: object) => void }).__arcadeProbe = (s) => {
      (window as unknown as { __fs: object }).__fs = s;
    };
  });
  await page.clock.install();
  await page.goto(`${ORIGIN}/practice?game=flip`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 150_000 });
  await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    w.__flip = await import(/* @vite-ignore */ "/src/lib/arcade/flip.ts");
    w.__plan = await import(/* @vite-ignore */ "/scripts/flip-x200-plan.ts");
  });
  await ready.click();
  for (let k = 0; k < 200; k++) {
    await page.waitForTimeout(50);
    if (await page.evaluate(() => Boolean((window as unknown as { __fs?: { tick: number } }).__fs?.tick))) break;
  }
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 200);
  const arena = (await page.locator("[data-game-arena]").first().boundingBox())!;
  let s = await info(page);
  if (!s.flow) throw new Error("the practice run is not on flipRev 11");
  let taps: number[] = [];
  const plan = async () => {
    taps = await page.evaluate(() => {
      const w = window as unknown as { __fs: any; __flip: any; __plan: any };
      const route = w.__plan.planFlipRoute(w.__flip.flipGameFor(w.__flip.FLIP_REV_FLOW), w.__fs, 3600, 600);
      return route ? (route.taps as number[]) : [];
    });
  };
  await plan();
  const done = new Set<string>();
  const tick = 1000 / 60;
  const snap = async (name: string) => {
    done.add(name);
    await page.screenshot({ path: `${OUT}/roofbound-rev11-${name}.png` });
    console.log(`roofbound-rev11-${name}.png at tick ${s.tick} (streak ${s.streak})`);
  };
  while (s.ended === 0 && s.tick < 3590 && done.size < 2) {
    const next = taps.find((t) => t > s.tick);
    const tapNow = next === s.tick + 1;
    if (tapNow) {
      await page.mouse.move(arena.x + arena.width / 2, arena.y + arena.height / 2);
      await page.mouse.down();
      await page.clock.runFor(tick);
      await page.mouse.up();
    } else await page.clock.runFor(tick);
    const was = s;
    s = await info(page);
    if (s.tick !== was.tick + 1) await plan();
    if (!done.has("perfect") && s.sweetT > 600 && s.tick === s.sweetT + 6) await snap("perfect");
    if (!done.has("midrun") && s.tick > 1500 && s.streak >= 10 && s.trailInView) await snap("midrun");
  }
  await browser.close();
  if (done.size < 2) throw new Error(`only ${[...done].join(", ")} captured`);
}

await main();
