/**
 * Expansion E1 review frames for Rainbow Bridge inkRev 9 (a design tool, not a check): plays a practice
 * round in headless Chromium at 414×896 (DPR 2), on a seed whose first level has a bounce cloud and a gold
 * star, drawing that level's proved trick line with the mouse, and saves mid-play frames to
 * screenshots/expansion-e1/: the level with its cloud and star, the coin springing off the cloud (squash),
 * the coin through the star high in the sky, and the TRICK SHOT pop over the pot.
 *
 *   bun scripts/shots/ink-expand-shots.ts --url=http://127.0.0.1:<port> [--out=screenshots/expansion-e1]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { inkBridgeGameFor, INK_INPUT_RELEASE, INK_INPUT_STROKE, INK_REV_EXPAND, INK_STEP_PX, INK_TALL_H, INK_WORLD_W, type InkLevel, type InkState } from "../../src/lib/arcade/inkBridge";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5203").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/expansion-e1";
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
mkdirSync(OUT, { recursive: true });

/** The points a finger sends drawing a polyline (one every INK_STEP_PX, then the end), as the stage does. */
function fingerPoints(pts: readonly number[]): [number, number][] {
  const out: [number, number][] = [[pts[0]!, pts[1]!]];
  let [lx, ly] = [pts[0]!, pts[1]!];
  for (let i = 2; i < pts.length; i += 2) {
    const [x0, y0, x1, y1] = [pts[i - 2]!, pts[i - 1]!, pts[i]!, pts[i + 1]!];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
    for (let k = 1; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const y = y0 + ((y1 - y0) * k) / n;
      if (Math.hypot(x - lx, y - ly) >= INK_STEP_PX) {
        out.push([Math.round(x), Math.round(y)]);
        [lx, ly] = [x, y];
      }
    }
  }
  out.push([pts[pts.length - 2]!, pts[pts.length - 1]!]);
  return out;
}

/** A seed whose first level (a still pot) has a cloud, and whose trick line, drawn by finger, bounces, takes the star and pots. */
function pickSeed(): number {
  const game = inkBridgeGameFor(INK_REV_EXPAND);
  for (let s = 1; s < 400; s++) {
    const seed = 424_242 + s * 97;
    let st: InkState = game.init(seed);
    const l: InkLevel = st.list[0]!;
    if (!(l.clouds?.length && l.star && l.trickRef && l.starRef === l.trickRef && l.slideAmp === 0 && l.star.y < 240 && l.star.x > 40)) continue;
    const events: { k: number; a: number; b: number; c: number }[] = [];
    for (const pts of l.trickRef) fingerPoints(pts).forEach(([a, b], i) => events.push({ k: INK_INPUT_STROKE, a, b, c: i === 0 ? 1 : 0 }));
    events.push({ k: INK_INPUT_RELEASE, a: 1, b: 0, c: 0 });
    for (let t = 0; t < 1200 && st.levels === 0 && st.fails === 0; t++) {
      const e = events.shift();
      st = game.step(st, e ? { t: st.tick + 1, d: 0, ...e } : null);
    }
    if (st.levels === 1 && st.stars === 1 && st.tricks === 1) return seed;
  }
  throw new Error("no seed");
}
const SEED = pickSeed();
const level = inkBridgeGameFor(INK_REV_EXPAND).init(SEED).list[0]!;
console.log(`seed ${SEED}: cloud ${JSON.stringify(level.clouds)}, star ${JSON.stringify(level.star)}, trick ${JSON.stringify(level.trickRef)}`);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("page error", e.message));
await page.clock.install();
await page.route("**/_serverFn/**", async (route) => {
  const url = route.request().url();
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  let name = id;
  try {
    name = Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
  } catch {
    /* plain */
  }
  if (!/practiceGenerate/.test(name)) return route.continue();
  const response = await route.fetch();
  const body = await response.text();
  // The public puzzle's seed (seroval: the "seed" key's value is a number node {"t":0,"s":N}): put ours in.
  const swapped = body.replace(/("k":\[[^\]]*"seed"[^\]]*\],"v":\[)([^\]]*)/, (_m, head: string, values: string) => {
    const keys = (/"k":\[([^\]]*)\]/.exec(head)![1] ?? "").split(",");
    const at = keys.indexOf('"seed"');
    const parts = values.split(/,(?=\{)/);
    parts[at] = `{"t":0,"s":${SEED}}`;
    return head + parts.join(",");
  });
  if (swapped === body) console.log("seed not swapped", body.slice(0, 400));
  return route.fulfill({ response, body: swapped });
});
await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded" });
await page.clock.runFor(2000);
const button = page.getByRole("button", { name: "Rainbow Bridge", exact: true }).first();
await button.waitFor({ timeout: 120_000 });
await page.clock.runFor(1500);
await button.click();
const ready = page.getByRole("button", { name: /^Ready/ }).first();
await ready.waitFor({ timeout: 120_000 });
await page.clock.runFor(1000);
await ready.click();
const canvas = page.locator("[data-game-stage] canvas").first();
await canvas.waitFor({ timeout: 60_000 });
// The round intro's countdown, then the level appears.
await page.clock.runFor(5000);
await page.screenshot({ path: `${OUT}/inkbridge-level.png` });

// World → page coordinates: the world fills the canvas box's width, top-anchored (fitWorld).
const box = (await canvas.boundingBox())!;
const scale = Math.min(box.width / INK_WORLD_W, box.height / INK_TALL_H);
const ox = box.x + (box.width - INK_WORLD_W * scale) / 2;
const oy = box.y;
const at = (x: number, y: number) => [ox + x * scale, oy + y * scale] as const;
for (const pts of level.trickRef!) {
  const [x0, y0] = at(pts[0]!, pts[1]!);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.clock.runFor(50);
  for (let i = 2; i < pts.length; i += 2) {
    const [px, py] = [pts[i - 2]!, pts[i - 1]!];
    const [qx, qy] = [pts[i]!, pts[i + 1]!];
    const n = Math.max(1, Math.ceil(Math.hypot(qx - px, qy - py) / 4));
    for (let k = 1; k <= n; k++) {
      const [mx, my] = at(px + ((qx - px) * k) / n, py + ((qy - py) * k) / n);
      await page.mouse.move(mx, my);
      await page.clock.runFor(17);
    }
  }
  await page.mouse.up();
  await page.clock.runFor(400);
}
await page.clock.runFor(1500);
await page.screenshot({ path: `${OUT}/inkbridge-trick-line.png` });

// Release, then step the clock a few frames at a time; every frame is saved as .frames-<tick>.png for picking.
const rel = (await page.getByRole("button", { name: "RELEASE", exact: true }).boundingBox())!;
// Time stops between steps from here, so a screenshot never lets the drop run on.
await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 200);
await page.mouse.click(rel.x + rel.width / 2, rel.y + rel.height / 2);
for (let f = 0; f < 60 * 6; f += 2) {
  await page.clock.runFor(33);
  await page.screenshot({ path: `${OUT}/.frames-${String(f).padStart(4, "0")}.png` });
}
await browser.close();
console.log(`frames in ${OUT}`);
