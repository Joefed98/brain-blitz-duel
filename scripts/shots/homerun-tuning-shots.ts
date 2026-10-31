/**
 * Review shots of Home Run (homerunRev 2, 31 Oct 2026; a design tool, not a check): a practice round at 414×896 and
 * 375×667. The practice deal's seed is read from its response; the run is warped (src/lib/arcade/devWarp.ts,
 * development only) into the near-perfect skill-band bot's run on that seed, just after its ninth swing starts:
 * "midrun" shows the call with Early / Perfect / Late, the contact-height marker and the radar board's reading. A warped
 * run's earlier inputs are not in what the phone sends, so the grade request carries that bot's whole run instead
 * (encoded as the phone would) and the reveal shows the server's own grade of it.
 *
 *   bun scripts/shots/homerun-tuning-shots.ts --url=http://127.0.0.1:5191 [--out=screenshots/sports-tuning-oct-2026]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { homerunCheckpoint, homerunGameFor, HOMERUN_REV_2 } from "../../src/lib/arcade/homerun";
import { encodeHomerunRun } from "../../src/lib/duel/homerun";
import { Human } from "../arcade-skill-bands/human";
import { bot } from "../arcade-skill-bands/bots/homerun";

const opt = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/sports-tuning-oct-2026";
const PITCH = Number(opt("pitch") ?? 8);
const SIZES: [number, number][] = [
  [414, 896],
  [375, 667],
];
mkdirSync(OUT, { recursive: true });

const game = homerunGameFor(HOMERUN_REV_2);

/** The near-perfect bot's run on `seed`: the warp to just after its swing at pitch PITCH, and the whole run encoded. */
function planFor(seed: number) {
  const events = bot({ game, seed, rev: HOMERUN_REV_2, human: new Human("homerun", seed, "near"), fixes: true }).events ?? [];
  const swing = events[Math.min(PITCH, events.length - 1)]!;
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) checkpoints.push(homerunCheckpoint(s));
  }
  const answer = encodeHomerunRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  return { warp: { game: "homerun", seed, tick: swing.t + 1, events: events.filter((e) => e.t <= swing.t) }, answer, score: game.score(s) };
}

async function shoot(w: number, h: number) {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  let plan: ReturnType<typeof planFor> | null = null;
  page.on("response", async (res) => {
    if (!/_serverFn/.test(res.url())) return;
    const body = await res.text().catch(() => "");
    const m = body.includes('"homerunRev"') ? /"s":(\d{4,})/.exec(body) : null;
    if (m && !plan) plan = planFor(Number(m[1]));
  });
  await page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData() ?? "";
    if (plan && body.includes('"answer"') && body.includes('"homerun"')) {
      // Seroval body: data's keys and values side by side; swap the answer string for the bot's whole run.
      const parsed = JSON.parse(body) as { t: { p: { v: { p: { k: string[]; v: unknown[] } }[] } } };
      const inner = parsed.t.p.v[0]!.p;
      const i = inner.k.indexOf("answer");
      if (i >= 0) inner.v[i] = { t: 1, s: plan.answer };
      return route.continue({ postData: JSON.stringify(parsed) });
    }
    return route.continue();
  });
  await page.goto(`${ORIGIN}/practice?game=homerun`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 120_000 });
  for (let i = 0; i < 100 && !plan; i++) await page.waitForTimeout(100);
  if (!plan) throw new Error("no seed read from the practice deal");
  const p = plan as ReturnType<typeof planFor>;
  await page.evaluate((warp) => ((window as unknown as { __duelzArcadeWarp: unknown }).__duelzArcadeWarp = warp), p.warp);
  await ready.click();
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(40);
  await page.screenshot({ path: join(OUT, `homerun-${w}x${h}-swing.png`) });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `homerun-${w}x${h}-midrun.png`) });
  await page
    .locator("[data-reveal-score], [data-arcade-reveal]")
    .first()
    .waitFor({ timeout: 120_000 })
    .catch(async (e) => {
      await page.screenshot({ path: join(OUT, `homerun-${w}x${h}-stuck.png`) });
      throw e;
    });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, `homerun-${w}x${h}-reveal.png`) });
  await browser.close();
  console.log(`${w}x${h}: deal seed ${p.warp.seed}, warped to tick ${p.warp.tick}; the bot's run scores ${p.score}`);
}

for (const [w, h] of SIZES) await shoot(w, h);
