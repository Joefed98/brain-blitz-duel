/**
 * Review shots of the 3 Nov 2026 Cards & Board and Strategy polish (a design tool, not a check): each game's practice
 * round on its fixed example a few seconds in (a few scripted taps where a board needs one), at 414×896 and, for Free Cell, Five Hands and Ball Tracker, 375×667.
 *
 *   bun scripts/shots/cards-strategy-shots.ts --url=http://127.0.0.1:5191 --tag=before|after
 *       [--out=screenshots/cards-strategy-nov-2026] [games…]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const opt = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/cards-strategy-nov-2026";
const TAG = opt("tag") ?? "after";
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));
mkdirSync(OUT, { recursive: true });

const GAMES = ["freecell", "fivehands", "mahjong", "minesweeper", "tripeaks", "pyramid", "balltrack", "matchup", "inkbridge", "tilt", "bubble"];
const SMALL = new Set(["freecell", "fivehands", "balltrack"]);
/** Seconds into the run before the shot (Ball Tracker's marbles need a while to come in). */
const WAIT: Record<string, number> = { balltrack: 9, inkbridge: 2.5, tilt: 3, matchup: 2.5, bubble: 2.5 };

function fnName(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
  } catch {
    return id;
  }
}

async function practice(page: Page, type: string) {
  await page.goto(`${ORIGIN}/practice?game=${type}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 120_000 });
  await ready.click();
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
}

async function shoot(w: number, h: number, games: string[]) {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData() ?? "";
    if (/practiceGenerate/.test(fnName(route.request().url()))) {
      return route.continue({ postData: body.replace(/("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/, '$1{"t":2,"s":2}') });
    }
    return route.continue();
  });
  for (const type of games) {
    try {
      await practice(page, type);
      await page.waitForTimeout((WAIT[type] ?? 1.5) * 1000);
      await page.screenshot({ path: join(OUT, `${type}-${w}x${h}-${TAG}.png`) });
      console.log(`${w}x${h}: ${type}`);
    } catch (e) {
      console.log(`${w}x${h}: ${type} FAILED ${(e as Error).message.split("\n")[0]}`);
    }
  }
  await browser.close();
}

const list = ONLY.length ? ONLY : GAMES;
await shoot(414, 896, list);
await shoot(375, 667, list.filter((g) => SMALL.has(g)));
