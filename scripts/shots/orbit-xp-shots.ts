/**
 * Review screenshots for Orbit's world expansion (orbitRev 11): the real practice round at 414 × 896 (DPR 2),
 * played through the UI on its course's proved witness taps (src/lib/duel/orbitXpBank.server.ts) with the page
 * clock stepped a frame at a time, photographed as the run reaches each new feature: a stardust trail, a
 * slingshot moon, an asteroid field, a perfect orbit (the first-lap arc) and a black hole.
 *
 *   bun scripts/shots/orbit-xp-shots.ts --url=http://127.0.0.1:5303 [--out=screenshots/e7-oct-2026]
 *
 * A design tool, not a check. Needs a running dev server (--url).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { decodeOrbitExtras, decodeOrbitHoles, decodeRev3Planets, initXpFrom, orbitRev3Game, ORBIT_REV3_WORLD_W, type OrbitRev3State } from "../../src/lib/arcade/orbitRev3";
import { ORBIT_INPUT_TAP } from "../../src/lib/arcade/orbit";
import { ORBIT_XP_BANK } from "../../src/lib/duel/orbitXpBank.server";
import { ORBIT_REV3_BANK } from "../../src/lib/duel/orbitRev3Bank.server";
import { ORBIT_HOLE_BANK } from "../../src/lib/duel/orbitHoleBank.server";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = arg("url") ?? "http://127.0.0.1:5303";
const OUT = arg("out") ?? "screenshots/e7-oct-2026";
mkdirSync(OUT, { recursive: true });

/** The ticks worth a photograph on a witness run: the first approach to each kind of feature. */
function moments(entrySeed: number, taps: number[]): { tick: number; name: string }[] {
  const entry = ORBIT_XP_BANK.find((e) => e.seed === entrySeed)!;
  const planets = decodeRev3Planets(ORBIT_REV3_BANK.find((e) => e.seed === entrySeed)!.planets);
  const holes = decodeOrbitHoles(ORBIT_HOLE_BANK.find((e) => e.seed === entrySeed)!.holes);
  let s: OrbitRev3State = initXpFrom(planets, ORBIT_REV3_WORLD_W, holes, decodeOrbitExtras(entry.extras));
  const set = new Set(taps);
  const out: { tick: number; name: string }[] = [];
  const want = new Set(["stardust", "slingshot", "asteroid-field", "perfect-orbit", "black-hole"]);
  const near = (x: number, y: number, r: number) => Math.hypot(s.x - x, s.y - y) < r * 256;
  let lastPerfect = 0;
  while (!s.ended && s.tick < orbitRev3Game.runTicks && want.size) {
    const prev = s;
    s = orbitRev3Game.step(s, set.has(s.tick + 1) ? { t: s.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null);
    if (want.has("stardust") && (s.dustGot ?? 0) !== (prev.dustGot ?? 0) && (s.dustGot ?? 0).toString(2).replace(/0/g, "").length === 3) {
      out.push({ tick: s.tick + 1, name: "stardust" });
      want.delete("stardust");
    }
    if (want.has("slingshot") && s.flying && (s.moons ?? []).some((m) => near(m.x, m.y, 30))) {
      out.push({ tick: s.tick + 1, name: "slingshot" });
      want.delete("slingshot");
    }
    if (want.has("asteroid-field") && s.flying && (s.fields ?? []).some((f) => near((f.ax + f.bx) / 2, (f.ay + f.by) / 2, 26))) {
      out.push({ tick: s.tick, name: "asteroid-field" });
      want.delete("asteroid-field");
    }
    if (want.has("perfect-orbit") && (s.perfect ?? 0) > lastPerfect && (s.perfect ?? 0) >= 3) {
      out.push({ tick: s.tick + 14, name: "perfect-orbit" });
      want.delete("perfect-orbit");
    }
    lastPerfect = s.perfect ?? 0;
    if (want.has("black-hole") && (s.holes ?? []).some((h) => h.from === s.cur && !s.flying && h.to > s.cur) && s.cur > 8) {
      out.push({ tick: s.tick + 20, name: "black-hole" });
      want.delete("black-hole");
    }
  }
  return out.sort((a, b) => a.tick - b.tick);
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.addInitScript(() => {
  (window as any).__arcadeProbe = (state: any) => {
    (window as any).__orbit = state;
  };
});
await page.clock.install();
await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded" });
const row = page.locator(`[data-practice-game="orbit"]`).first();
await row.waitFor({ state: "attached", timeout: 120_000 });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Orbit", exact: true }).first().click();
const ready = page.getByRole("button", { name: /^Ready/ });
await ready.waitFor({ timeout: 60_000 });
await ready.click();
await page.locator("[data-arcade-play] [data-game-stage]").first().waitFor({ timeout: 30_000 });
const now = await page.evaluate(() => Date.now());
await page.clock.pauseAt(now + 200);
const tickNow = () => page.evaluate(() => (window as any).__orbit?.tick ?? -1);
const frame = async () => {
  await page.clock.runFor(16);
  await page.waitForTimeout(8);
};
// The course: match the first stardust mote to the bank.
let first: { x: number; y: number } | null = null;
for (let k = 0; k < 120 && !first; k++) {
  await frame();
  first = await page.evaluate(() => (window as any).__orbit?.dust?.[0] ?? null);
}
const entry = ORBIT_XP_BANK.find((e) => e.extras.d[0]?.[0] === first?.x && e.extras.d[0]?.[1] === first?.y);
if (!entry) throw new Error("practice did not deal an orbitRev 11 bank course");
const shots = moments(entry.seed, entry.taps);
console.log(`course ${entry.seed}: shots at ${shots.map((s) => `${s.name} ${s.tick}`).join(", ")}`);
const arena = (await page.locator("[data-arcade-play] [data-game-arena]").first().boundingBox())!;
const taps = [...entry.taps];
let shot = 0;
for (let guard = 0; guard < 6000 && shot < shots.length; guard++) {
  const t = await tickNow();
  if (taps.length && t >= taps[0]! - 1) {
    taps.shift();
    await page.mouse.move(arena.x + arena.width / 2, arena.y + arena.height * 0.45);
    await page.mouse.down();
    await page.mouse.up();
  }
  if (t >= shots[shot]!.tick) {
    await page.waitForTimeout(60);
    await page.screenshot({ path: `${OUT}/orbit-${shot + 1}-${shots[shot]!.name}-414x896.png` });
    console.log(`  ${OUT}/orbit-${shot + 1}-${shots[shot]!.name}-414x896.png at tick ${t}`);
    shot++;
  }
  await frame();
}
await browser.close();
