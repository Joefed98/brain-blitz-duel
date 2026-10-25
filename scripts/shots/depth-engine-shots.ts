/**
 * Review screenshots for Bonk whackRev 3 and Pull! clayRev 9 (depth to 200, 25 Oct 2026): plays the live practice
 * round at 414 × 896 on a fixed seed with the page clock paused, tapping from the schedule (the sim's own init
 * run here), and saves the moments that show each feature to screenshots/depth-d3/.
 *
 *   bun scripts/shots/depth-engine-shots.ts --url=http://127.0.0.1:5610 [whack|clayshoot]
 */
import { chromium, type Page } from "playwright";
import { whackDepthGame, whackRule, WHACK_COLS, WHACK_GAP_PX } from "../../src/lib/arcade/whack";
import { clayDepthGame, clayGravity, CLAY_CONFIG, CLAY_FLYING, CLAY_W, clayWorldH, type ClayState } from "../../src/lib/arcade/clayShoot";

const args = process.argv.slice(2);
const origin = (args.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://127.0.0.1:5610").replace(/\/$/, "");
const games = args.filter((a) => !a.startsWith("--"));
const OUT = "screenshots/depth-d3";
const SEED = 424242;
const TICK_MS = 1000 / 60;

async function open(name: string): Promise<Page> {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.clock.install();
  await page.route("**/_serverFn/**", async (route) => {
    const id = route.request().url().split("/_serverFn/")[1]?.split("?")[0] ?? "";
    const fn = Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
    if (!/practiceGenerate/.test(fn)) return route.continue();
    const res = await route.fetch();
    const body = (await res.text()).replace(/("k":\["type","seed",[^\]]*\],"v":\[\{"t":1,"s":"\w+"\},\{"t":0,"s":)-?\d+/, `$1${SEED}`);
    return route.fulfill({ response: res, body });
  });
  await page.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name, exact: true }).first();
  await button.waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1500);
  await button.click();
  await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 90_000 });
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 200);
  return page;
}

/** The sim tick the stage has reached (the arcade clock module the app reports to). */
async function tickOf(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const clock = (await import(/* @vite-ignore */ "/src/lib/arcade/clock.ts")) as { arcadeMsRemaining: (ms: number) => number };
    return Math.round((60_000 - clock.arcadeMsRemaining(60_000)) / (1000 / 60));
  });
}

async function step(page: Page): Promise<number> {
  await page.clock.runFor(Math.ceil(TICK_MS));
  return tickOf(page);
}

async function bonk(): Promise<void> {
  const page = await open("Bonk");
  const s = whackDepthGame.init(SEED);
  const dp = s.dp!;
  const board = (await page.locator('[aria-label="Bonk board"]').boundingBox())!;
  const cellW = (board.width - WHACK_GAP_PX * (WHACK_COLS - 1)) / WHACK_COLS;
  const cellH = (board.height - WHACK_GAP_PX * (WHACK_COLS - 1)) / WHACK_COLS;
  const centre = (h: number) => ({ x: board.x + (h % WHACK_COLS) * (cellW + WHACK_GAP_PX) + cellW / 2, y: board.y + Math.floor(h / WHACK_COLS) * (cellH + WHACK_GAP_PX) + cellH / 2 });
  const tapped = new Set<number>();
  let t = await tickOf(page);
  let shotCombo = false;
  let shotDiamond = false;
  while (t < 1900 && !(shotCombo && shotDiamond)) {
    const sch = s.schedule;
    let tap: number | null = null;
    for (let i = 0; i < sch.at.length && tap === null; i++) {
      if (tapped.has(i) || sch.kind[i] !== whackRule(sch.flips, sch.at[i]!)) continue;
      if (t >= sch.at[i]! + 5 && t < sch.at[i]! + sch.life[i]! - 8) { tapped.add(i); tap = sch.hole[i]!; }
    }
    // The first diamond is left up for its photo, then taken.
    if (tap === null) for (let d = 0; d < dp.at.length; d++) if (!tapped.has(1000 + d) && t >= dp.at[d]! + 10 && t < dp.at[d]! + 16 && shotDiamond) { tapped.add(1000 + d); tap = dp.hole[d]!; }
    if (tap !== null) { const c = centre(tap); await page.mouse.click(c.x, c.y); }
    t = await step(page);
    if (!shotDiamond && t >= dp.at[0]! + 7 && t < dp.at[0]! + 14) {
      await page.screenshot({ path: `${OUT}/whack-diamond.png` });
      shotDiamond = true;
    }
    if (!shotCombo && tap !== null && tapped.size >= 12) {
      await step(page);
      await step(page);
      await page.screenshot({ path: `${OUT}/whack-combo.png` });
      shotCombo = true;
    }
  }
  console.log(`Bonk: combo ${shotCombo}, diamond ${shotDiamond} (tick ${t})`);
  await page.context().browser()!.close();
}

async function pull(): Promise<void> {
  const page = await open("Pull!");
  let sim: ClayState = clayDepthGame.init(SEED);
  const area = (await page.locator("[data-play-area]").first().boundingBox())!;
  const worldH = clayWorldH(sim);
  const toScreen = (x: number, y: number) => ({ x: area.x + (x / CLAY_W) * area.width, y: area.y + (y / worldH) * area.height });
  const shot = new Set<number>();
  const p0 = CLAY_CONFIG.singles;
  let t = await tickOf(page);
  const shots = { streak: false, tether: false, partner: false, double: false };
  while (t < 3000 && !shots.double) {
    while (sim.tick < t + 1) sim = clayDepthGame.step(sim, null);
    let aim: { x: number; y: number } | null = null;
    let fired = -1;
    for (let i = 0; i < sim.status.length && !aim; i++) {
      if (sim.status[i] !== CLAY_FLYING || shot.has(i)) continue;
      const x = sim.x[i]! / 256, y = sim.y[i]! / 256;
      if (x < 8 || x > CLAY_W - 8 || y < 8 || y > worldH - 8) continue;
      // The first double waits until both are up (its tether photo), then one, then the other.
      if ((i === p0 || i === p0 + 1) && !shots.tether) continue;
      if (i === p0 + 1 && !shots.partner) continue;
      const vy = sim.vy[i]! + clayGravity(sim);
      aim = toScreen((sim.x[i]! + sim.schedule.vx[i]!) / 256, (sim.y[i]! + vy) / 256);
      fired = i;
    }
    if (aim) { shot.add(fired); await page.mouse.click(aim.x, aim.y); }
    t = await step(page);
    while (sim.tick < t) sim = clayDepthGame.step(sim, null);
    if (!shots.streak && shot.size === 10 && aim) { await step(page); await step(page); await step(page); await page.screenshot({ path: `${OUT}/clayshoot-streak.png` }); shots.streak = true; }
    const bothUp = sim.status[p0] === CLAY_FLYING && sim.status[p0 + 1] === CLAY_FLYING;
    if (!shots.tether && bothUp && sim.x[p0 + 1]! / 256 > 40 && sim.x[p0 + 1]! / 256 < CLAY_W - 40) { await page.screenshot({ path: `${OUT}/clayshoot-double-tether.png` }); shots.tether = true; }
    else if (shots.tether && !shots.partner && shot.has(p0)) { await step(page); await step(page); await page.screenshot({ path: `${OUT}/clayshoot-double-partner.png` }); shots.partner = true; }
    else if (shots.partner && !shots.double && shot.has(p0 + 1)) { await step(page); await step(page); await step(page); await page.screenshot({ path: `${OUT}/clayshoot-double-streak.png` }); shots.double = true; }
  }
  console.log(`Pull!: ${JSON.stringify(shots)} (tick ${t})`);
  await page.context().browser()!.close();
}

if (!games.length || games.includes("whack")) await bonk();
if (!games.length || games.includes("clayshoot")) await pull();
