/**
 * Review screenshots for Roofbound flipRev 7 (a design tool, not a check): a real practice run at 414 × 896
 * in headless Chromium, the page clock stepped one sim tick at a time while the in-page route planner
 * (scripts/flip-rev7-plan.ts, on the live run's own state) taps, saving frames that show each new feature:
 * a star trail swept mid-flip, a moving spike in its groove, a speed zone, a checkpoint gate and the save
 * badge, a double flip, tall and tight cave, and a saved crash (the planner stops tapping after 45 s).
 *
 *   bun scripts/shots/flip-e7-shots.ts --url=http://127.0.0.1:5301 [--out=screenshots/e7-oct-2026]
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = opt("url") ?? "http://127.0.0.1:5301";
const OUT = opt("out") ?? "screenshots/e7-oct-2026";
mkdirSync(OUT, { recursive: true });

type Info = { tick: number; combos: number; saves: number; ended: number; cpPassed: number; inZone: boolean; height: number; trailLive: number; moverInView: boolean };

async function info(page: Page): Promise<Info> {
  return page.evaluate(() => {
    const w = window as unknown as { __fs: any; __flip: any };
    const s = w.__fs;
    const F = w.__flip;
    const v7 = s.v7;
    const trailLive = v7.trails.findIndex((t: any) => s.tick >= t.t1 - 30 && s.tick <= t.t1 - 6);
    const moverInView = s.segs.some((g: any) => g.amp && (g.x0 - s.x) / 256 > 60 && (g.x0 - s.x) / 256 < 260);
    return { tick: s.tick, combos: s.combos ?? 0, saves: s.saves ?? 0, ended: s.ended, cpPassed: s.cpPassed ?? 0, inZone: F.flipV7InZone(v7, s.tick), height: F.flipV7HeightAt(v7, s.x), trailLive, moverInView };
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
  await page.goto(`${ORIGIN}/practice`, { timeout: 180_000 });
  const button = page.getByRole("button", { name: "Roofbound", exact: true }).first();
  await button.waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1500);
  await button.click();
  const ready = page.getByRole("button", { name: /^Ready/ });
  await ready.waitFor({ timeout: 60_000 });
  await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    w.__flip = await import(/* @vite-ignore */ "/src/lib/arcade/flip.ts");
    w.__plan = await import(/* @vite-ignore */ "/scripts/flip-rev7-plan.ts");
  });
  await ready.click();
  // Let the run begin, then hold the clock and step it a tick at a time.
  for (let k = 0; k < 200; k++) {
    await page.waitForTimeout(50);
    if (await page.evaluate(() => Boolean((window as unknown as { __fs?: { tick: number } }).__fs?.tick))) break;
  }
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 200);
  const arena = (await page.locator("[data-game-arena]").first().boundingBox())!;
  const replan = async (stopAfter: number) =>
    page.evaluate((until) => {
      const w = window as unknown as { __fs: any; __flip: any; __plan: any; __taps: number[] };
      const route = w.__plan.planFlipRoute(w.__flip.flipGameFor(7), w.__fs, Math.min(3600, until), 600);
      w.__taps = route ? route.taps : [];
      return w.__taps.length;
    }, stopAfter);
  let taps: number[] = [];
  const plan = async (t: number) => {
    await replan(t + 900);
    taps = await page.evaluate(() => (window as unknown as { __taps: number[] }).__taps);
  };
  let s = await info(page);
  await plan(s.tick);
  const shots = new Map<string, number>();
  const want = (name: string, cond: boolean) => cond && !shots.has(name);
  let lastCombos = s.combos;
  let comboAt = -1;
  let savedAt = -1;
  let tapping = true;
  const tick = 1000 / 60;
  while (s.ended === 0 && s.tick < 3590) {
    const next = taps.find((t) => t > s.tick);
    if (tapping && next === s.tick + 1) {
      await page.mouse.move(arena.x + arena.width / 2, arena.y + arena.height / 2);
      await page.mouse.down();
      await page.clock.runFor(tick);
      await page.mouse.up();
    } else await page.clock.runFor(tick);
    const was = s;
    s = await info(page);
    if (s.tick !== was.tick + 1 && tapping) await plan(s.tick); // the stage skipped or held a tick: plan again from here
    if (s.combos > lastCombos) comboAt = s.tick;
    lastCombos = s.combos;
    if (s.saves > was.saves) savedAt = s.tick;
    const snap = async (name: string) => {
      shots.set(name, s.tick);
      await page.screenshot({ path: `${OUT}/flip-${name}.png` });
      console.log(`flip-${name}.png at tick ${s.tick}`);
    };
    if (want("trail", s.trailLive >= 1)) await snap("trail");
    if (want("double-flip", comboAt > 0 && s.tick === comboAt + 8)) await snap("double-flip");
    if (want("speed-zone", s.inZone && s.tick > 1200)) await snap("speed-zone");
    if (want("moving-spike", s.moverInView && s.tick > 900)) await snap("moving-spike");
    if (want("checkpoint", s.cpPassed === 1 && s.tick > 1700 && s.tick < 1800 && s.height !== 0)) {
      // The second gate comes into view about 1.7 s before 30 s.
      if (s.tick >= 1765) await snap("checkpoint");
    }
    if (want("tall", s.height === 340 && s.tick > 600)) await snap("tall");
    if (want("tight", s.height === 200 && s.tick > 600)) await snap("tight");
    // After 45 s (a save ready), stop tapping until a crash is saved, then plan on.
    if (tapping && s.tick > 2720 && s.cpPassed === 3 && !shots.has("saved")) tapping = false;
    if (!tapping && savedAt > 0 && s.tick === savedAt + 10) {
      await snap("saved");
      tapping = true;
      await plan(s.tick);
    }
  }
  console.log(`done at tick ${s.tick} (ended ${s.ended}); shots: ${[...shots.keys()].join(", ")}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
