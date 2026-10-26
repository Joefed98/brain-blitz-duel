/**
 * Review screenshots for the 200 expansion (Hover hoverRev 9; a design tool, not a check): mid-play
 * frames at 414×896 (DPR 2) showing each new feature — a tight gate being threaded, a star chain
 * half swept, a shield bubble ahead, the shield held and a shield breaking.
 *
 *   bun scripts/shots/hover-x200-shots.ts --url=<origin> [--out=screenshots/expansion-e1]
 *
 * Practice deals its fixed example (seed 1, as scripts/shots/capture.ts does), the page clock is
 * faked and stepped, and the taps of scripts/shots/hover-x200-plan.ts (the flawless skill-band
 * player, then no tap after the shield is held) are clicked on the sim tick they were planned for.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

import { gameDisplayName } from "../../src/lib/duel/gameNames";
import { hoverShotPlan } from "./hover-x200-plan";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5202").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/expansion-e1";
mkdirSync(OUT, { recursive: true });

/** A server function's name from its URL (as scripts/shots/capture.ts reads it). */
function serverFnName(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
  } catch {
    return id;
  }
}

const NAMES: Record<string, string> = { tight: "hover-tight-gate", chain: "hover-star-chain", bubble: "hover-shield-bubble", held: "hover-shield-held", break: "hover-shield-break" };

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, hasTouch: false });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("pageerror", String(e.message ?? e).split("\n")[0]));
// The page clock only moves when this script steps it.
await page.clock.install({ time: new Date("2026-10-25T12:00:00Z") });
await page.clock.pauseAt(new Date("2026-10-25T12:00:01Z"));
// Each faked frame (every 16 ms of the page clock) is handed a time exactly one sim tick after the
// last, so the stage runs one tick per frame and a tap clicked between frames lands on the next tick.
await page.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  let base: number | null = null;
  window.requestAnimationFrame = (cb) =>
    raf(() => {
      const now = performance.now();
      if (base === null) base = now;
      cb(base + Math.round((now - base) / 16) * (1000 / 60 + 1e-7));
    });
});
await page.route("**/_serverFn/**", async (route) => {
  const request = route.request();
  const body = request.postData() ?? "";
  if (/practiceGenerate/.test(serverFnName(request.url()))) {
    const example = body.replace(/("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/, '$1{"t":2,"s":2}');
    if (example === body) console.log("practiceGenerate: example flag not found in", body.slice(0, 200));
    const response = await route.fetch({ postData: example });
    // The planned course: the practice puzzle's seed set to 1 (display only; this run is never graded).
    const text = (await response.text()).replace(/(\{"t":1,"s":"hover"\},\{"t":0,"s":)\d+\}/, "$11}");
    if (!/\{"t":1,"s":"hover"\},\{"t":0,"s":1\}/.test(text)) console.log("practiceGenerate: seed not set", text.slice(0, 300));
    return route.fulfill({ response, body: text });
  }
  return route.continue();
});
await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded", timeout: 180_000 });
const button = page.getByRole("button", { name: gameDisplayName("hover"), exact: true }).first();
for (let i = 0; i < 600 && !(await button.isVisible().catch(() => false)); i++) await page.clock.runFor(100);
await page.clock.runFor(1500);
await button.click();
const ready = page.getByRole("button", { name: /^Ready/ }).first();
for (let i = 0; i < 600 && !(await ready.isVisible().catch(() => false)); i++) await page.clock.runFor(100);
await ready.click();
const canvas = page.locator("[data-game-stage] canvas.puzzle-board").first();
for (let i = 0; i < 600 && !(await canvas.isVisible().catch(() => false)); i++) await page.clock.runFor(100);
const box = (await canvas.boundingBox())!;
const tickNow = () =>
  page.evaluate(async () => {
    const clock = (await import(/* @vite-ignore */ "/src/lib/arcade/clock.ts")) as { arcadeMsRemaining: (ms: number) => number };
    return Math.round((60_000 - clock.arcadeMsRemaining(60_000)) / (1000 / 60));
  });
// Wait for the run to start (the round intro's countdown on the faked clock).
let tick = await tickNow();
for (let i = 0; i < 2000 && tick === 0; i++) {
  await page.clock.runFor(8);
  tick = await tickNow();
}
// The planner flies the page's course from the tick it hands over (no tap before it).
const plan = hoverShotPlan(1, tick);
const taps = new Set(plan.breakTaps ?? plan.taps);
const shots = Object.entries(plan.shots).sort((a, b) => a[1] - b[1]);
console.log("plan from tick", tick, plan.shots, plan.final);
let tapped = 0;
let logged = 0;
let next = 0;
while (next < shots.length) {
  tick = await tickNow();
  if (process.env.SHOT_DBG && logged++ < 60) console.log("tick", tick, "next tap", [...taps].find((t) => t > tick));
  if (taps.has(tick + 1) && tapped !== tick + 1) {
    tapped = tick + 1;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    if (process.env.SHOT_DBG) console.log("click for", tick + 1);
  }
  const [name, at] = shots[next]!;
  if (tick >= at) {
    if (tick > at + 1) console.log(`${name}: wanted tick ${at}, got ${tick}`);
    writeFileSync(join(OUT, `${NAMES[name] ?? name}.png`), await page.screenshot());
    console.log("shot", name, tick);
    next++;
    continue;
  }
  await page.clock.runFor(16);
}
await browser.close();
