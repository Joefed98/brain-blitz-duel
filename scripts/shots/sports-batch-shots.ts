/**
 * Review shots of the 3 Nov 2026 Sports batch (a design tool, not a check): Home Run homerunRev 4 (pick your spot) and
 * Cue Ball poolRev 4 (a seeded set, 90 s), as practice rounds on each game's fixed example (seed 1: a stripes table for
 * Cue Ball, a curveball first for Home Run) at 414×896, 375×667 and the computer layout (1440×900).
 *
 * Home Run is warped (src/lib/arcade/devWarp.ts, development only) into the elite skill-band bot's run on the example's
 * seed: "spot" (the spot tapped before the second pitch, the fielders in their circles, the lit BONUS sign), "ring"
 * (the curveball bending in with the ring closing on it) and "call" (the result). Cue Ball: "stripes" (the opening
 * YOU'RE STRIPES banner) and "table" (the HUD's STRIPES rack once it has gone).
 *
 *   bun scripts/shots/sports-batch-shots.ts --url=http://127.0.0.1:5191 [--out=screenshots/sports-batch-nov-2026]
 *       [--sizes=414x896,375x667,1440x900]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { homerunGameFor, homerunPlan, HOMERUN_REV_4 } from "../../src/lib/arcade/homerun";
import { Human } from "../arcade-skill-bands/human";
import { bot } from "../arcade-skill-bands/bots/homerun";

const opt = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/sports-batch-nov-2026";
const SIZES = (opt("sizes") ?? "414x896,375x667,1440x900").split(",").map((s) => s.split("x").map(Number) as [number, number]);
mkdirSync(OUT, { recursive: true });

const SEED = 1;
const game = homerunGameFor(HOMERUN_REV_4);
const events = bot({ game, seed: SEED, rev: HOMERUN_REV_4, human: new Human("homerun", SEED, "elite"), fixes: true }).events ?? [];
const pitch = homerunPlan(SEED, HOMERUN_REV_4).pitches[1]!;
const tap = events.find((e) => e.k === 4 && e.t >= pitch.release - 12 && e.t < pitch.arrive + 10)?.t ?? pitch.arrive - 6;
// The page starts the warped run a few frames after its tick (its load and the stage's first frames), so "spot" is taken
// well before the release and "ring" just before it: the screenshot lands with the curveball part-way in.
const FRAMES = { spot: pitch.release - 60, ring: pitch.release - 6, call: tap + 50 } as const;

function fnName(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
  } catch {
    return id;
  }
}

async function practice(page: Page, type: string, warp?: unknown) {
  await page.goto(`${ORIGIN}/practice?game=${type}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 120_000 });
  if (warp) await page.evaluate((w) => ((window as unknown as { __duelzArcadeWarp: unknown }).__duelzArcadeWarp = w), warp);
  await ready.click();
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
}

async function shoot(w: number, h: number) {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w >= 1024 ? 1 : 2 });
  const page = await context.newPage();
  // The practice deal is switched to the game's fixed example (a cloud container has no database for a real deal).
  await page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData() ?? "";
    if (/practiceGenerate/.test(fnName(route.request().url()))) {
      return route.continue({ postData: body.replace(/("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/, '$1{"t":2,"s":2}') });
    }
    return route.continue();
  });
  for (const name of ["spot", "ring", "call"] as const) {
    await practice(page, "homerun", { game: "homerun", seed: SEED, tick: FRAMES[name], events: events.filter((e) => e.t <= FRAMES[name]) });
    await page.waitForTimeout(name === "ring" ? 0 : 120);
    await page.screenshot({ path: join(OUT, `homerun-${w}x${h}-${name}.png`) });
    console.log(`${w}x${h}: homerun ${name}`);
  }
  await practice(page, "pool");
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `pool-${w}x${h}-stripes.png`) });
  await page.waitForTimeout(4200);
  await page.screenshot({ path: join(OUT, `pool-${w}x${h}-table.png`) });
  await browser.close();
  console.log(`${w}x${h}: done`);
}

for (const [w, h] of SIZES) await shoot(w, h);
