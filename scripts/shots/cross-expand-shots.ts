/**
 * Jaywalk expansion screenshots (crossRev 8, 25 Oct 2026): a near-perfect bot run is played in Bun,
 * then a headless Chromium page (414×896 at DPR 2, the play box's 414×772 under a 60 px header)
 * imports the real sim and renderer from a running dev server, replays the log and photographs the
 * frames that show each new feature: the island (banked), coins, a bus, a motorbike and the streak
 * multiplier in the HUD.
 *
 *   bun scripts/shots/cross-expand-shots.ts --url=http://127.0.0.1:5201 [--out=screenshots/expansion-e1]
 */
import { mkdirSync } from "node:fs";
import { crossCourse, crossGameFor, crossNextMultiplier, CROSS_KIND_BUS, CROSS_KIND_MOTO, CROSS_REV_EXPAND, CROSS_BOARD_X, CROSS_BOARD_W, type CrossState } from "../../src/lib/arcade/cross";
import { px } from "../../src/lib/arcade/engine";
import { decodeCrossRun } from "../../src/lib/duel/cross";
import { roomSeed } from "../arcade-skill-bands/games";
import { playCrossRun } from "../cross-expand-record";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const URL_ = opt("url") ?? "http://127.0.0.1:5201";
const OUT = opt("out") ?? "screenshots/expansion-e1";
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

/** True when a vehicle of this kind is on the visible board at this state. */
function onBoard(s: CrossState, kind: number): boolean {
  const course = crossCourse(s);
  const rel = s.tick - s.crossStart;
  return course.lanes.some((lane) => {
    if (lane.kind !== kind) return false;
    const start = (((lane.dir * lane.speed * rel + lane.phase) % lane.period) + lane.period) % lane.period;
    for (let i = -1; i <= Math.ceil((CROSS_BOARD_W * 256) / lane.period) + 1; i++)
      for (const off of lane.offsets ?? [0]) {
        const x = px(start + i * lane.period + off);
        if (x > CROSS_BOARD_X + 20 && x + px(lane.blockW) < CROSS_BOARD_X + CROSS_BOARD_W - 20) return true;
      }
    return false;
  });
}

// Find a run (near-perfect bot) that shows every feature, and the tick for each.
let picked: { seed: number; events: unknown[]; ticks: Record<string, number> } | null = null;
for (let n = 0; n < 40 && !picked; n++) {
  const seed = roomSeed(n);
  const run = playCrossRun(CROSS_REV_EXPAND, seed, "near");
  const events = decodeCrossRun(run.raw).events;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const game = crossGameFor(CROSS_REV_EXPAND);
  let s = game.init(seed) as CrossState;
  const ticks: Record<string, number> = {};
  let bankedAt = -1;
  while (!game.isOver(s)) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.banked && bankedAt < 0) bankedAt = s.tick;
    if (!s.banked) bankedAt = -1;
    const coinsLeft = (crossCourse(s).coins ?? []).filter((_, i) => !((s.coins ?? 0) & (1 << i))).length;
    if (ticks.island === undefined && bankedAt > 0 && s.tick === bankedAt + 8 && s.crossings >= 1) ticks.island = s.tick;
    if (ticks.coins === undefined && s.crossings >= 1 && s.lane >= 2 && s.lane <= 5 && coinsLeft >= 3 && s.hop === 0) ticks.coins = s.tick;
    if (ticks.bus === undefined && s.crossings >= 2 && onBoard(s, CROSS_KIND_BUS) && s.lane >= 1) ticks.bus = s.tick;
    if (ticks.motorbike === undefined && s.crossings >= 2 && onBoard(s, CROSS_KIND_MOTO) && s.lane >= 1) ticks.motorbike = s.tick;
    if (ticks.streak === undefined && crossNextMultiplier(s) >= 3 && s.lane >= 3 && s.hop === 0) ticks.streak = s.tick;
  }
  if (["island", "coins", "bus", "motorbike", "streak"].every((k) => ticks[k] !== undefined)) picked = { seed, events, ticks };
}
if (!picked) throw new Error("no run showed every feature");
console.log(`seed ${picked.seed}:`, picked.ticks);

mkdirSync(OUT, { recursive: true });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
// A static file (not the app), so nothing re-renders or reloads the page under the canvas.
await page.goto(`${URL_}/og-image.png`, { waitUntil: "load", timeout: 120_000 });
await page.waitForTimeout(1500);
await page.evaluate(async ({ seed, events }) => {
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
  const game = sim.crossGameFor(sim.CROSS_REV_EXPAND);
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
}, { seed: picked.seed, events: picked.events });
const order = Object.entries(picked.ticks).sort((a, b) => a[1] - b[1]);
for (const [name, tick] of order) {
  await page.evaluate((t) => (window as unknown as { __cross: { to(t: number): void } }).__cross.to(t), tick);
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${OUT}/cross-${name}.png` });
  console.log(`${OUT}/cross-${name}.png (tick ${tick})`);
}
await browser.close();
