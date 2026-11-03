/**
 * Audit screenshots (Nov 2026): intro, mid-round and reveal frames for every active game at one size.
 * A design tool, not a check. Built on scripts/shots/capture.ts's method (practice mode from the Practice list, the
 * fixed intro example, Math.random seeded, the drivers in scripts/shots/drivers/), all in real time:
 *
 *   intro   the RoundIntro 2.5 s after it opens;
 *   mid     the frame when the game header's timer shows half the round (its aria-label; the wall clock when the
 *           timer is not counting). Puzzles with a driver: the driver's partial inputs (or stage seed), then a wait.
 *           Arcade games, engine games, Speed games and puzzles with no partial driver: scripted, seeded taps, swipes,
 *           holds and stage-button presses (taps only for the flap/jump games, a stick push for Apex), after the
 *           driver's partial inputs when there is one. A run that ends sooner keeps a frame from ~2 s before its end;
 *   reveal  1.8 s after the AnswerReveal shows: the driver's solve where it has one (a solved reveal), else the run
 *           played (scripted) or waited (driven) to its end.
 *
 *   bun scripts/audit/audit-capture.ts [games…] [--category=<id> | --all] [--url=<origin, default :5191>]
 *       [--out=screenshots/audit-nov-2026] [--size=414x896] [--jobs=4]
 *
 * It needs a dev server (start one with scripts/audit/vite.audit.config.ts: HMR and watching off, so working-tree
 * edits never reload a page mid-round). Frames: <out>/<folder>/<game>-intro.png, -mid.png, -reveal.png (folder: the
 * puzzle category, or arcade-<group> from arcadeGroups.ts). A per-game log (input, times, score, the reveal's text)
 * goes to <out>/capture-report.json, merged across runs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Browser, Page } from "playwright";

import { ARCADE_GROUPS } from "../../src/lib/duel/arcadeGroups";
import { GAME_DISPLAY_NAMES, gameDisplayName } from "../../src/lib/duel/gameNames";
import { ACTIVE_PUZZLE_TYPES, puzzleDef } from "../../src/lib/duel/registry";
import type { PuzzleType } from "../../src/lib/duel/types";
import type { Driver, DriverCtx } from "../shots/driver";
import { DRIVERS } from "../shots/drivers";
import { exampleFor } from "../shots/examples";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name: string) => args.includes(`--${name}`);
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const OUT = opt("out") ?? "screenshots/audit-nov-2026";
const [W, H] = (opt("size") ?? "414x896").split("x").map(Number) as [number, number];
const JOBS = Number(opt("jobs") ?? 4);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const REVEAL = "[data-reveal-score], [data-arcade-reveal]";

export function folderFor(game: PuzzleType): string {
  const cat = puzzleDef(game).category;
  if (cat !== "arcade") return cat;
  const group = ARCADE_GROUPS.find((g) => g.games.includes(game));
  return `arcade-${group?.id ?? "other"}`;
}

function pickGames(): PuzzleType[] {
  const named = args.filter((a) => !a.startsWith("--"));
  for (const g of named) if (!(g in GAME_DISPLAY_NAMES)) throw new Error(`unknown game id ${g}`);
  const category = opt("category");
  if (!category && !flag("all")) return named as PuzzleType[];
  const pool = ACTIVE_PUZZLE_TYPES.filter(
    (t) => !category || puzzleDef(t).category === category || folderFor(t) === category,
  );
  return [...new Set([...(named as PuzzleType[]), ...pool])];
}

const SEED_RANDOM = `(() => {
  let s = 20261013 >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { localStorage.setItem("duelz-arrow-control", "arrows"); } catch { /* ignore */ }
})();`;

function serverFnName(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
  } catch {
    return id;
  }
}

interface Run {
  page: Page;
  close: () => Promise<void>;
  errors: string[];
}

async function newRun(
  browser: Browser,
  game: PuzzleType,
  opts: { clock: boolean; seed?: Record<string, unknown> },
): Promise<Run> {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await context.addInitScript(SEED_RANDOM);
  const page = await context.newPage();
  const run: Run = { page, close: () => context.close(), errors: [] };
  page.on("pageerror", (e) => run.errors.push(String(e.message ?? e).split("\n")[0]!));
  if (opts.clock) await page.clock.install();
  await page.route("**/_serverFn/**", async (route) => {
    const request = route.request();
    const name = serverFnName(request.url());
    const body = request.postData() ?? "";
    if (/practiceGenerate/.test(name)) {
      return route.continue({
        postData: body.replace(
          /("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/,
          '$1{"t":2,"s":2}',
        ),
      });
    }
    return route.continue();
  });
  await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const side = page.locator(
    `[data-practice-side='${puzzleDef(game).category === "arcade" ? "arcade" : "puzzles"}']`,
  );
  await side.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1200);
  await side.click();
  const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
  await button.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  if (opts.seed) {
    await page.evaluate(async (values) => {
      const seed = (await import(/* @vite-ignore */ "/scripts/shots/seed.tsx")) as {
        seedStageState: (k: string[], v: Record<string, unknown>) => void;
      };
      seed.seedStageState(["practice-1", "practice-2", "practice-3"], values);
    }, opts.seed);
  }
  await button.click();
  await page.getByRole("button", { name: /^Ready/ }).first().waitFor({ timeout: 90_000 });
  return run;
}

async function ready(run: Run, settleMs = 1200) {
  await run.page.getByRole("button", { name: /^Ready/ }).first().click();
  await run.page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  await run.page.waitForTimeout(settleMs);
}

/** A small seeded PRNG for the scripted input (node side). */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKIP_BUTTON = /help|sound|mute|music|quit|leave|back|give up|menu|settings|\?|close|play again/i;

/** One scripted input: a tap, swipe, hold or a press of a button inside the stage. */
async function scriptedInput(page: Page, rnd: () => number) {
  const arena =
    (await page.locator("[data-game-arena]").first().boundingBox().catch(() => null)) ??
    (await page.locator("[data-game-stage]").first().boundingBox().catch(() => null));
  if (!arena) return;
  const x = arena.x + arena.width * (0.12 + 0.76 * rnd());
  const y = arena.y + arena.height * (0.2 + 0.7 * rnd());
  const r = rnd();
  if (r < 0.4) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(40);
    await page.mouse.up();
  } else if (r < 0.7) {
    const ang = rnd() < 0.45 ? -Math.PI / 2 + (rnd() - 0.5) * 1.2 : rnd() * Math.PI * 2;
    const len = 60 + rnd() * 140;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let k = 1; k <= 6; k++) {
      await page.mouse.move(x + (Math.cos(ang) * len * k) / 6, y + (Math.sin(ang) * len * k) / 6);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
  } else if (r < 0.85) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(300 + rnd() * 600);
    await page.mouse.move(x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 60, { steps: 4 });
    await page.mouse.up();
  } else {
    const buttons = page.locator("[data-game-stage] button:visible");
    const n = await buttons.count().catch(() => 0);
    if (!n) return;
    const pickAt = Math.floor(rnd() * n);
    const b = buttons.nth(pickAt);
    const label = `${(await b.getAttribute("aria-label").catch(() => "")) ?? ""} ${(await b.textContent().catch(() => "")) ?? ""}`;
    if (SKIP_BUTTON.test(label)) return;
    await b.click({ timeout: 800 }).catch(() => {});
  }
}

/** The reveal's visible text, line by line (for docs/audit/intro-reveal-text.md). */
async function revealText(page: Page): Promise<string[]> {
  return page
    .evaluate((sel) => {
      const el =
        document.querySelector(".answer-reveal-content") ??
        document.querySelector("[data-arcade-reveal]") ??
        document.querySelector(sel);
      const root = el?.closest("[data-skin]") ?? el?.parentElement ?? el;
      return ((root as HTMLElement | null)?.innerText ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    }, REVEAL)
    .catch(() => []);
}

const revealUp = async (page: Page) => (await page.locator(REVEAL).count().catch(() => 0)) > 0;

function realtime(game: PuzzleType, driver: Driver | undefined) {
  const def = puzzleDef(game) as { category: string; arcadeRun?: unknown };
  return (
    def.category === "arcade" ||
    def.category === "speed" ||
    Boolean(def.arcadeRun) ||
    !driver ||
    (!driver.partial && !driver.seedMid)
  );
}

/** Games whose scripted input is taps alone (a flap, a jump, a leap): random swipes and holds end them at once. */
const TAP_ONLY = new Set<string>(["hover", "flip", "ricochet", "skyline", "reaction", "chain", "stopwatch", "swing"]);

/** Games whose scripted input needs a shape of its own. */
const CUSTOM_INPUT: Record<string, (page: Page, rnd: () => number) => Promise<void>> = {
  // Apex: the one-thumb stick drawn at the bottom centre; push it up (throttle) and steer a little.
  racing: async (page, rnd) => {
    const box = await page.locator("[data-game-arena]").first().boundingBox();
    if (!box) return;
    const x = box.x + box.width / 2;
    const y = box.y + box.height * 0.88;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 50, { steps: 4 });
    for (let i = 0; i < 8; i++) {
      await page.mouse.move(x + (rnd() - 0.5) * 70, y - 50, { steps: 2 });
      await page.waitForTimeout(220);
    }
    await page.mouse.up();
  },
};

/** The game frame timer's seconds left (its aria-label "N seconds remaining"), or null when none is drawn. */
async function secondsLeft(page: Page): Promise<number | null> {
  const label = await page
    .locator("[aria-label$='seconds remaining']")
    .first()
    .getAttribute("aria-label", { timeout: 300 })
    .catch(() => null);
  const n = label ? parseInt(label, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function captureGame(browser: Browser, game: PuzzleType) {
  const driver = DRIVERS[game];
  const full = exampleFor(game);
  const dir = join(OUT, folderFor(game));
  mkdirSync(dir, { recursive: true });
  const file = (phase: string) => join(dir, `${game}-${phase}.png`);
  const limit = puzzleDef(game).timeLimitMs ?? 60_000;
  const scripted = realtime(game, driver);
  const entry: Record<string, unknown> = { input: scripted ? (driver?.partial ? "driver partial + scripted" : "scripted") : "driver" };
  const ctx = (page: Page): DriverCtx => ({ page, puzzle: full, wait: (ms) => page.waitForTimeout(ms) });
  const errors: string[] = [];
  let run = await newRun(browser, game, { clock: false, seed: driver?.seedMid?.(full) });
  try {
    await run.page.waitForTimeout(2500);
    await run.page.screenshot({ path: file("intro") });
    entry.intro = true;
    // Tap games (Hover falls at once) start tapping as soon as the stage is up.
    await ready(run, TAP_ONLY.has(game) ? 0 : 1200);
    const t0 = Date.now() - 1200;
    const shown = await secondsLeft(run.page);
    const startLeft = shown && shown > 5 ? shown : Math.round(limit / 1000);
    entry.clockS = startLeft;
    if (driver?.partial)
      await driver.partial(ctx(run.page)).catch((e) => (entry.partialError = String(e).split("\n")[0]));
    const rnd = prng([...game].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7));
    const frames: { at: number; png: Buffer }[] = [];
    let midAt: number | null = null;
    const deadline = t0 + limit + 45_000;
    const solveNext = Boolean(driver?.solve && !scripted);
    // Mid-round: play on (scripted games) or wait (driven puzzles) until the clock shows half the round.
    while (Date.now() < deadline) {
      if (await revealUp(run.page)) break;
      const left = await secondsLeft(run.page);
      // Half the round on the frame's timer; a timer that is not counting (0, or none) falls back to the wall clock.
      const halfway =
        left !== null && left > 0 ? left <= startLeft / 2 : Date.now() - t0 >= (startLeft * 1000) / 2;
      if (halfway) {
        await run.page.screenshot({ path: file("mid") });
        midAt = Date.now() - t0;
        break;
      }
      if (!frames.length || Date.now() - frames[frames.length - 1]!.at > 1000) {
        const png = await run.page.screenshot().catch(() => null);
        if (png) frames.push({ at: Date.now(), png });
        if (frames.length > 4) frames.shift();
      }
      if (scripted) {
        if (CUSTOM_INPUT[game]) await CUSTOM_INPUT[game]!(run.page, rnd).catch(() => {});
        else if (TAP_ONLY.has(game)) {
          const box = await run.page.locator("[data-game-arena], [data-game-stage]").first().boundingBox().catch(() => null);
          if (box) await run.page.mouse.click(box.x + box.width * (0.3 + 0.4 * rnd()), box.y + box.height * (0.4 + 0.4 * rnd()));
          await run.page.waitForTimeout(game === "hover" ? 230 + rnd() * 120 : 300 + rnd() * 500);
        } else {
          await scriptedInput(run.page, rnd).catch(() => {});
          await run.page.waitForTimeout(150 + rnd() * 250);
        }
      } else await run.page.waitForTimeout(500);
    }
    if (midAt == null && frames.length) {
      // The run ended before half the round: the frame from a couple of seconds before its end.
      const pick = frames[Math.max(0, frames.length - 3)]!;
      writeFileSync(file("mid"), pick.png);
      midAt = pick.at - t0;
      entry.midNote = `run ended before half the round; frame from ${Math.round(midAt / 1000)} s`;
    }
    entry.midAtS = midAt == null ? null : Math.round(midAt / 1000);
    // The reveal: the driver's solve, or play on (scripted) / wait (driven) to the end of the round.
    if (solveNext && driver?.solve) {
      if (driver.seedNearSolved || driver.solveFromStart) {
        errors.push(...run.errors);
        await run.close();
        run = await newRun(browser, game, { clock: false, seed: driver.seedNearSolved?.(full) });
        await ready(run);
      }
      await driver.solve(ctx(run.page));
      entry.reveal = "solved by the driver";
    } else {
      while (Date.now() < deadline && !(await revealUp(run.page))) {
        if (scripted && CUSTOM_INPUT[game]) await CUSTOM_INPUT[game]!(run.page, rnd).catch(() => {});
        else if (scripted && !TAP_ONLY.has(game)) await scriptedInput(run.page, rnd).catch(() => {});
        else if (scripted) {
          const box = await run.page.locator("[data-game-arena], [data-game-stage]").first().boundingBox().catch(() => null);
          if (box) await run.page.mouse.click(box.x + box.width * (0.3 + 0.4 * rnd()), box.y + box.height * (0.4 + 0.4 * rnd())).catch(() => {});
        }
        await run.page.waitForTimeout(scripted ? 200 + rnd() * 250 : 1000);
      }
      entry.reveal = scripted ? "played to the end" : "timed out after the driver's partial play";
    }
    await run.page.locator(REVEAL).first().waitFor({ timeout: 150_000 });
    await run.page.waitForTimeout(1800);
    await run.page.screenshot({ path: file("reveal") });
    entry.revealText = await revealText(run.page);
    entry.revealAtS = Math.round((Date.now() - t0) / 1000);
    entry.score = await run.page
      .locator("[data-reveal-score]")
      .first()
      .getAttribute("data-reveal-score", { timeout: 1000 })
      .catch(() => null);
  } catch (error) {
    // The screen at the failure, for diagnosis (--errors=<dir>; never into the screenshots folder).
    const errDir = opt("errors");
    if (errDir) {
      mkdirSync(errDir, { recursive: true });
      await run.page.screenshot({ path: join(errDir, `${game}-error.png`) }).catch(() => {});
    }
    throw error;
  } finally {
    errors.push(...run.errors);
    await run.close();
  }
  if (errors.length) entry.pageErrors = [...new Set(errors)].slice(0, 5);
  return entry;
}

async function main() {
  if (!existsSync(CHROMIUM)) throw new Error(`no Chromium at ${CHROMIUM}`);
  const games = pickGames();
  if (!games.length) throw new Error("name games, --category=<id> or --all");
  mkdirSync(OUT, { recursive: true });
  const reportPath = join(OUT, "capture-report.json");
  const report: Record<string, unknown> = existsSync(reportPath)
    ? (JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, unknown>)
    : {};
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  // Warm the dev server once (its first page load optimises dependencies), unmeasured.
  {
    const context = await browser.newContext({ viewport: { width: W, height: H } });
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded", timeout: 300_000 }).catch(() => {});
    await page.locator("[data-practice-side]").first().waitFor({ timeout: 300_000 }).catch(() => {});
    await context.close();
  }
  const queue = [...games];
  const worker = async () => {
    for (let game = queue.shift(); game; game = queue.shift()) {
      const t = Date.now();
      try {
        report[game] = await captureGame(browser, game);
      } catch (error) {
        report[game] = { error: String((error as Error).message ?? error).split("\n")[0] };
      }
      (report[game] as Record<string, unknown>).seconds = Math.round((Date.now() - t) / 1000);
      writeFileSync(reportPath, JSON.stringify(report, null, 1));
      console.log(`${game}: ${JSON.stringify(report[game])}`);
    }
  };
  try {
    await Promise.all(Array.from({ length: JOBS }, worker));
  } finally {
    await browser.close();
  }
}

if (import.meta.main) await main();
