/**
 * Review shots of Curl Champ curlRev 3 ("prepare the shot", 1 Nov 2026; a design tool, not a check): a practice round
 * at 414×896 (and `--sizes=` more). The practice deal's seed is read from its response; the run is warped
 * (src/lib/arcade/devWarp.ts, development only) into the elite skill-band bot's run on that seed just before its sixth
 * throw, so the sheet has stones on it. Then each setup step is played with the mouse as a finger would and shot:
 *
 *   1-target   the gold target dragged in the inset: the faint aim line and the meter's draw zone for it;
 *   2-turn     Out picked: the line and the zone follow the turn;
 *   3-slide    the stone slid along the hog line;
 *   4-swipe    mid-swipe: the meter filling live;
 *   5-release  the stone sliding, the meter's tick where it was released;
 *   6-reveal   the answer reveal.
 *
 * A warped run's earlier inputs are not in what the phone sends, so the grade request carries the bot's whole run
 * instead (encoded as the phone would) and the reveal shows the server's own grade of it.
 *
 *   bun scripts/shots/curling-prepare-shots.ts --url=http://127.0.0.1:5191 [--out=screenshots/sports-prepare-nov-2026] [--sizes=414x896]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { curlingCheckpoint, curlingGameFor, CURL_INPUT_THROW, CURLING_REV, CURLING_W, curlingWorldHFor, HOG_NEAR } from "../../src/lib/arcade/curling";
import { CURL_INSET, curlProject, curlViewFor } from "../../src/lib/arcade/curling.renderer";
import { SPORTS_CHECKPOINT_INTERVAL } from "../../src/lib/arcade/sportsKit";
import { encodeCurlingRun } from "../../src/lib/duel/curling";
import { Human } from "../arcade-skill-bands/human";
import { bot } from "../arcade-skill-bands/bots/curling";

const opt = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/sports-prepare-nov-2026";
const SIZES = (opt("sizes") ?? "414x896").split(",").map((s) => s.split("x").map(Number) as [number, number]);
mkdirSync(OUT, { recursive: true });

/** The scripted swipe: world px a step and ms between steps (`--swipe-step=`, `--swipe-wait=`). */
const SWIPE_STEP = Number(opt("swipe-step") ?? 26);
const SWIPE_WAIT = Number(opt("swipe-wait") ?? 18);

const game = curlingGameFor(CURLING_REV);
const view = curlViewFor(CURLING_REV);
const WORLD_H = curlingWorldHFor(CURLING_REV);

/** The elite bot's run on `seed`: the warp to just before its sixth throw, and the whole run encoded. */
function planFor(seed: number) {
  const events = bot({ game, seed, rev: CURLING_REV, human: new Human("curling", seed, "elite"), fixes: true }).events ?? [];
  const throws = events.filter((e) => e.k === CURL_INPUT_THROW);
  const sixth = throws[Math.min(5, throws.length - 1)]!;
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % SPORTS_CHECKPOINT_INTERVAL === 0) checkpoints.push(curlingCheckpoint(s));
  }
  const answer = encodeCurlingRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  return { warp: { game: "curling", seed, tick: sixth.t - 1, events: events.filter((e) => e.t < sixth.t) }, answer, score: game.score(s) };
}

/** World px → page px over the stage's canvas (the world at its largest uniform scale, centred across, top-anchored). */
async function mapper(page: Page) {
  const box = (await page.locator("[data-game-arena] canvas").first().boundingBox())!;
  const k = Math.min(box.width / CURLING_W, box.height / WORLD_H);
  const ox = box.x + (box.width - CURLING_W * k) / 2;
  return (x: number, y: number) => ({ x: ox + x * k, y: box.y + y * k, k });
}

async function shoot(w: number, h: number) {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  let plan: ReturnType<typeof planFor> | null = null;
  page.on("response", async (res) => {
    if (!/_serverFn/.test(res.url())) return;
    const body = await res.text().catch(() => "");
    const m = body.includes('"curlRev"') ? /"s":(\d{4,})/.exec(body) : null;
    if (m && !plan) plan = planFor(Number(m[1]));
  });
  await page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData() ?? "";
    if (plan && body.includes('"answer"') && body.includes('"curling"')) {
      const parsed = JSON.parse(body) as { t: { p: { v: { p: { k: string[]; v: unknown[] } }[] } } };
      const inner = parsed.t.p.v[0]!.p;
      const i = inner.k.indexOf("answer");
      if (i >= 0) inner.v[i] = { t: 1, s: plan.answer };
      return route.continue({ postData: JSON.stringify(parsed) });
    }
    return route.continue();
  });
  await page.goto(`${ORIGIN}/practice?game=curling`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 120_000 });
  for (let i = 0; i < 300 && !plan; i++) await page.waitForTimeout(100);
  if (!plan) throw new Error("no seed read from the practice deal");
  const p = plan as ReturnType<typeof planFor>;
  await page.evaluate((warp) => ((window as unknown as { __duelzArcadeWarp: unknown }).__duelzArcadeWarp = warp), p.warp);
  await ready.click();
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(4500); // the practice countdown
  const at = await mapper(page);
  const shot = (name: string) => page.screenshot({ path: join(OUT, `curling-${w}x${h}-${name}.png`) });

  // 1: the target, dragged in the inset to 45 cm left of the button.
  const i = CURL_INSET;
  const target = at(i.x + i.w / 2 - 45 * i.scale, i.y + i.h / 2 + 10 * i.scale);
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x - 2, target.y, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await shot("1-target");
  // 2: Out.
  await page.getByRole("button", { name: "Out-turn" }).click();
  await page.waitForTimeout(400);
  await shot("2-turn");
  // 3: slide the stone 40 cm right along the near hog line.
  const stone = curlProject(0, HOG_NEAR, view);
  const from = at(stone.sx, stone.sy - 6);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 40 * stone.k * from.k, from.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await shot("3-slide");
  // 4 and 5: a swipe up the lane at about a draw's speed (≈ 0.96 world px a ms), shot halfway, then released.
  const start = at(stone.sx + 40 * stone.k, stone.sy + 30);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // Each step's real interval is measured, so the swipe's speed is what the page sees, not what was asked for.
  const stepPx = SWIPE_STEP * start.k;
  for (let n = 1; n <= 5; n++) {
    await page.mouse.move(start.x, start.y - n * stepPx);
    await page.waitForTimeout(SWIPE_WAIT);
  }
  await shot("4-swipe");
  for (let n = 6; n <= 8; n++) {
    await page.mouse.move(start.x, start.y - n * stepPx);
    await page.waitForTimeout(SWIPE_WAIT);
  }
  await page.mouse.up();
  await page.waitForTimeout(1600);
  await shot("5-release");
  // Two more throws to finish the end (any weight), then the reveal.
  for (let t = 0; t < 2; t++) {
    await page.waitForTimeout(9000);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let n = 1; n <= 8; n++) {
      await page.mouse.move(start.x, start.y - n * stepPx);
      await page.waitForTimeout(SWIPE_WAIT);
    }
    await page.mouse.up();
  }
  await page
    .locator("[data-reveal-score], [data-arcade-reveal]")
    .first()
    .waitFor({ timeout: 150_000 })
    .catch(async (e) => {
      await shot("stuck");
      throw e;
    });
  await page.waitForTimeout(2500);
  await shot("6-reveal");
  await browser.close();
  console.log(`${w}x${h}: deal seed ${p.warp.seed}, warped to tick ${p.warp.tick}; the elite bot's run scores ${p.score}`);
}

for (const [w, h] of SIZES) await shoot(w, h);
