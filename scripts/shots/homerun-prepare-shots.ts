/**
 * Review shots of Home Run's prepared swing (homerunRev 3, 1 Nov 2026; a design tool, not a check): a practice round at
 * 414×896 (or --sizes), warped (src/lib/arcade/devWarp.ts, development only) into the elite skill-band bot's run on the
 * practice deal's seed at the moments of one pitch: "choose" (Power picked, before the wind-up), "tell" (the pitcher's
 * tell late in the wind-up), "swing" (the swing under way), "call" (Early / Perfect / Late and the contact marker), then
 * the reveal. Each frame is its own page load (the warp starts the run at that tick); the reveal's grade request
 * carries the bot's whole run (encoded as the phone would), so it shows the server's own grade of it.
 *
 *   bun scripts/shots/homerun-prepare-shots.ts --url=http://127.0.0.1:5191 [--out=screenshots/sports-prepare-nov-2026]
 *       [--sizes=414x896] [--pitch=4] [--level=elite]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { homerunCheckpoint, homerunGameFor, homerunPlan, HOMERUN_INPUT_SWING, HOMERUN_REV_3, HOMERUN_WORLD_W } from "../../src/lib/arcade/homerun";
import { encodeHomerunRun } from "../../src/lib/duel/homerun";
import { Human, type SkillLevel } from "../arcade-skill-bands/human";
import { bot } from "../arcade-skill-bands/bots/homerun";

const opt = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/sports-prepare-nov-2026";
const PITCH = Number(opt("pitch") ?? 4);
const LEVEL = (opt("level") ?? "elite") as SkillLevel;
const SIZES = (opt("sizes") ?? "414x896").split(",").map((s) => s.split("x").map(Number) as [number, number]);
mkdirSync(OUT, { recursive: true });

const game = homerunGameFor(HOMERUN_REV_3);
/** The practice example's seed (homerunPuzzle.generate). */
const SEED = 1;
/** --burst: also a burst of tell frames into .shots/ (the tell is 0.4 s; pick one by eye). */
const BURST = process.argv.includes("--burst");

function planFor(seed: number) {
  const events = bot({ game, seed, rev: HOMERUN_REV_3, human: new Human("homerun", seed, LEVEL), fixes: true }).events ?? [];
  // Power for this pitch whatever the bot chose (an elite bot always does).
  const p = homerunPlan(seed).pitches[PITCH]!;
  const swing = events.find((e) => e.k === HOMERUN_INPUT_SWING && e.t >= p.release - 54 && e.t < p.arrive + 20) ?? { t: p.arrive - 6 };
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) checkpoints.push(homerunCheckpoint(s));
  }
  const answer = encodeHomerunRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  // "swing": warped to just after the release (the pitch on its way, the Contact / Power row faded out until the pitch
  // is decided); the shot swipes through the strike zone for real and is taken mid-swing (the warp replays only the
  // events up to its tick). "call": the result, the row back.
  const frames = { choose: p.release - 50, tell: p.release - 40, swing: p.release + 2, call: swing.t + 40 };
  const warp = (tick: number) => ({ game: "homerun", seed, tick, events: events.filter((e) => e.t <= tick) });
  return { frames, warp, answer, score: game.score(s), seed };
}

async function shoot(w: number, h: number) {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
  // The computer layout at DPR 1: a 2880 × 1800 page is slow enough that the swing frame's pitch is over before the swipe.
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w >= 1024 ? 1 : 2 });
  const page = await context.newPage();
  // The practice deal is switched to the game's fixed example (as scripts/shots/capture.ts does: a cloud container has
  // no database for a real deal), so the seed is the example's.
  let plan: ReturnType<typeof planFor> | null = null;
  const fnName = (url: string) => {
    const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
    try {
      return Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
    } catch {
      return id;
    }
  };
  await page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData() ?? "";
    if (/practiceGenerate/.test(fnName(route.request().url()))) {
      return route.continue({ postData: body.replace(/("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/, '$1{"t":2,"s":2}') });
    }
    if (plan && /practiceGrade/.test(fnName(route.request().url())) && body.includes('"answer"')) {
      const parsed = JSON.parse(body) as { t: { p: { v: { p: { k: string[]; v: unknown[] } }[] } } };
      const inner = parsed.t.p.v[0]!.p;
      const i = inner.k.indexOf("answer");
      if (i >= 0) inner.v[i] = { t: 1, s: plan.answer };
      return route.continue({ postData: JSON.stringify(parsed) });
    }
    return route.continue();
  });
  // Each load is a fresh practice round on the example's seed; the warp plays the bot's run on it up to the frame.
  const open = async (name: "choose" | "tell" | "swing" | "call") => {
    plan = planFor(SEED);
    await page.goto(`${ORIGIN}/practice?game=homerun`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    const ready = page.getByRole("button", { name: /^Ready/ }).first();
    await ready.waitFor({ timeout: 120_000 });
    const p = plan;
    await page.evaluate((warp) => ((window as unknown as { __duelzArcadeWarp: unknown }).__duelzArcadeWarp = warp), p.warp(p.frames[name]));
    await ready.click();
    await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  };
  for (const name of ["choose", "tell", "swing", "call"] as const) {
    await open(name);
    if (name === "swing") {
      // A real swipe from the strike zone's middle (world px 258, 506) up and to the left, then the frame mid-swing.
      await page.waitForTimeout(150);
      const box = (await page.locator("[data-game-arena] canvas").first().boundingBox())!;
      const k = box.width / HOMERUN_WORLD_W;
      const at = (x: number, y: number) => ({ x: box.x + x * k, y: box.y + y * k });
      const a = at(258, 506);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let i = 1; i <= 4; i++) {
        const b = at(258 - i * 9, 506 - i * 3);
        await page.mouse.move(b.x, b.y);
      }
      await page.mouse.up();
      await page.waitForTimeout(45);
    } else await page.waitForTimeout(30);
    await page.screenshot({ path: join(OUT, `homerun-${w}x${h}-${name}.png`) });
    // The tell lasts 0.4 s and a page's start lags by a varying few frames: a burst into .shots/ to pick from.
    if (name === "tell" && BURST)
      for (let i = 0; i < 14; i++) {
        await page.screenshot({ path: join(".shots", `homerun-${w}x${h}-tell-${i}.png`) });
        await page.waitForTimeout(40);
      }
  }
  await page
    .locator("[data-reveal-score], [data-arcade-reveal]")
    .first()
    .waitFor({ timeout: 120_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, `homerun-${w}x${h}-reveal.png`) });
  await browser.close();
  console.log(`${w}x${h}: the ${LEVEL} bot's run scores ${(plan as ReturnType<typeof planFor> | null)?.score}`);
}

for (const [w, h] of SIZES) await shoot(w, h);
