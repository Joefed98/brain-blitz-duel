/**
 * Review screenshots for Roofbound flipRev 8 (a design tool, not a check): a real practice run at 414 × 896
 * in headless Chromium, the page clock stepped one sim tick at a time while the in-page route planner
 * (scripts/flip-x200-plan.ts, on the live run's own state) taps, saving frames that show each feature:
 * a roof's sweet spot ahead and a sweet landing's glint, a star trail swept mid-flip, a moving spike in its
 * groove, a speed zone, a checkpoint gate and the save badge, a double flip, tall and tight cave, and a
 * saved crash (the planner stops tapping after 30 s). Frames are flip-<what>-414x896.png.
 *
 *   bun scripts/shots/flip-x200-shots.ts --url=http://127.0.0.1:5301 [--out=screenshots/x200-oct-2026] [--only=sweet-spot,sweet-glint]
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = opt("url") ?? "http://127.0.0.1:5301";
const OUT = opt("out") ?? "screenshots/x200-oct-2026";
const ONLY = opt("only")?.split(",") ?? null;
mkdirSync(OUT, { recursive: true });

type Info = { launched: boolean; tick: number; combos: number; saves: number; ended: number; cpPassed: number; inZone: boolean; height: number; trailLive: number; moverInView: boolean; sweetAhead: boolean; sweetT: number };

async function info(page: Page): Promise<Info> {
  return page.evaluate(() => {
    const w = window as unknown as { __fs: any; __flip: any };
    const s = w.__fs;
    const F = w.__flip;
    const v8 = s.v8;
    const trailLive = v8.trails.findIndex((t: any) => s.tick >= t.t1 - 30 && s.tick <= t.t1 - 6);
    const moverInView = s.segs.some((g: any) => g.amp && (g.x0 - s.x) / 256 > 60 && (g.x0 - s.x) / 256 < 260);
    // A sweet spot well in view ahead of the runner (70–140 px), not yet landed on.
    const sweetAhead = v8.sweets.some((sw: any, i: number) => !((s.sweetGot ?? 0) & (1 << i)) && (sw.x0 - s.x) / 256 > 70 && (sw.x1 - s.x) / 256 < 140);
    return { launched: s.flipT > 0 && s.flipT === s.arcN, tick: s.tick, combos: s.combos ?? 0, saves: s.saves ?? 0, ended: s.ended, cpPassed: s.cpPassed ?? 0, inZone: F.flipV8InZone(v8, s.tick), height: F.flipV8HeightAt(v8, s.x), trailLive, moverInView, sweetAhead, sweetT: s.sweetT ?? 0 };
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
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 150_000 });
  await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    w.__flip = await import(/* @vite-ignore */ "/src/lib/arcade/flip.ts");
    w.__plan = await import(/* @vite-ignore */ "/scripts/flip-x200-plan.ts");
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
      const route = w.__plan.planFlipRoute(w.__flip.flipGameFor(w.__flip.FLIP_REV_EXPAND), w.__fs, Math.min(3600, until), 600);
      w.__taps = route ? route.taps : [];
      return w.__taps.length;
    }, stopAfter);
  let taps: number[] = [];
  const plan = async (t: number) => {
    void t;
    await replan(3600);
    taps = await page.evaluate(() => (window as unknown as { __taps: number[] }).__taps);
  };
  let s = await info(page);
  await plan(s.tick);
  const shots = new Map<string, number>();
  const want = (name: string, cond: boolean) => cond && !shots.has(name) && (!ONLY || ONLY.includes(name));
  let lastCombos = s.combos;
  let comboAt = -1;
  let savedAt = -1;
  let tapping = true;
  const tick = 1000 / 60;
  while (s.ended === 0 && s.tick < 3590 && !(ONLY && ONLY.every((n) => shots.has(n)))) {
    const next = taps.find((t) => t > s.tick);
    const tapNow = tapping && next === s.tick + 1;
    if (tapNow) {
      await page.mouse.move(arena.x + arena.width / 2, arena.y + arena.height / 2);
      await page.mouse.down();
      await page.clock.runFor(tick);
      await page.mouse.up();
    } else await page.clock.runFor(tick);
    const was = s;
    s = await info(page);
    // The stage skipped or held a tick, or the tap landed on another tick than planned: plan again from here.
    const landed = s.launched && s.tick === was.tick + 1;
    if (tapping && (s.tick !== was.tick + 1 || tapNow !== landed)) await plan(s.tick);
    if (s.combos > lastCombos) comboAt = s.tick;
    lastCombos = s.combos;
    if (s.saves > was.saves) savedAt = s.tick;
    const snap = async (name: string) => {
      shots.set(name, s.tick);
      await page.screenshot({ path: `${OUT}/flip-${name}-414x896.png` });
      console.log(`flip-${name}-414x896.png at tick ${s.tick}`);
    };
    if (want("sweet-spot", s.sweetAhead && s.tick > 700)) await snap("sweet-spot");
    // A sweet landing's glint runs along the strip for 24 ticks: caught 5 ticks in.
    if (want("sweet-glint", s.sweetT > 700 && s.tick === s.sweetT + 5)) await snap("sweet-glint");
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
    // After the second checkpoint (a save ready), stop tapping until a crash is saved, then plan on.
    if (tapping && s.tick > 1960 && s.cpPassed >= 2 && !shots.has("saved") && (!ONLY || ONLY.includes("saved"))) tapping = false;
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
