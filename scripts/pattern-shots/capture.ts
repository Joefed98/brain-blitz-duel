/**
 * Pattern polish capture tool (not a check). For each Pattern game and each
 * viewport it opens /practice on a running dev server, loads the game's fixed
 * intro example (the generate request is rewritten to `example: true`, as the
 * October 2026 snapshots did) and saves:
 *
 *   <game>-<w>x<h>-intro.png   the RoundIntro, 2.5 s after it opens
 *   <game>-<w>x<h>-play.png    mid-play (a seeded or played partial solve)
 *   <game>-<w>x<h>-solve1/2/3  the completion moment, 0.15 / 0.5 / 0.9 s after the solve
 *   <game>-<w>x<h>-reveal.png  the AnswerReveal of that real solve, 1.5 s after it lands
 *
 * The practice grade request is held for 2.2 s so the solved board stays on
 * screen long enough to photograph the completion moment (a room keeps the
 * locked board up instead). It also measures the gap above and below each
 * board (to the nearest element above it and the first control below it) and
 * writes them to <out>/gaps.json.
 *
 *   bun scripts/pattern-shots/capture.ts --url=http://127.0.0.1:5180 --out=<dir> [games...] [--sizes=375x667,390x844]
 *
 * Serve with SUPABASE_URL pointing nowhere and any SUPABASE_SERVICE_ROLE_KEY so
 * Gridlock's practice example falls back to the built-in bank.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "playwright";

import { gameDisplayName } from "../../src/lib/duel/gameNames";
import type { Driver, FullPuzzle } from "./driver";

const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const GAMES = ["unblock", "blockparty", "iceslide", "gravity", "tiles", "rings", "laser", "flow", "pipes", "push"];

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const origin = flag("url") ?? "http://127.0.0.1:5180";
const out = flag("out") ?? "screenshots/pattern-polish/after";
const sizes = (flag("sizes") ?? "375x667,390x844").split(",").map((s) => s.split("x").map(Number) as [number, number]);
const only = args.filter((a) => !a.startsWith("--"));
const games = only.length ? only : GAMES;
mkdirSync(out, { recursive: true });

const examples = JSON.parse(
  execFileSync("bun", [join(import.meta.dirname, "examples.ts")], { encoding: "utf8", maxBuffer: 64 << 20 }),
) as Record<string, FullPuzzle>;

/** Server-function name from a TanStack Start request URL. */
function serverFnName(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return Buffer.from(decodeURIComponent(id), "base64").toString("utf8") + " " + id;
  } catch {
    return id;
  }
}

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    // Presentation randomness repeats between runs.
    let a = 20261013;
    Math.random = () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try {
      localStorage.setItem("duelz-arrow-control", "arrows");
    } catch {
      /* ignore */
    }
    (window as unknown as { __cues: string[] }).__cues = [];
    window.addEventListener("duelz-sound", (event) => {
      (window as unknown as { __cues: string[] }).__cues.push(
        String((event as CustomEvent<{ cue: string }>).detail?.cue),
      );
    });
  });
  await page.route("**/_serverFn/**", async (route) => {
    const request = route.request();
    const name = serverFnName(request.url());
    const body = request.postData() ?? "";
    if (/practiceGenerate/.test(name)) {
      // Seroval: {"t":2,"s":3} is false, {"t":2,"s":2} is true.
      return route.continue({ postData: body.replace('{"t":2,"s":3}', '{"t":2,"s":2}') });
    }
    if (/practiceGrade/.test(name)) {
      await new Promise((done) => setTimeout(done, 2200));
    }
    return route.continue();
  });
}

async function openGame(page: Page, game: string) {
  await page.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: gameDisplayName(game as never), exact: true }).first();
  await button.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500); // hydration
  await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    w.__seed = await import(/* @vite-ignore */ "/scripts/pattern-shots/seed.tsx");
  });
  return button;
}

async function seed(page: Page, values: Record<string, unknown> | undefined) {
  if (!values) return;
  await page.evaluate((v) => {
    const w = window as unknown as { __seed: { seedStageState: (k: string[], v: Record<string, unknown>) => void } };
    w.__seed.seedStageState(["practice-1", "practice-2", "practice-3"], v);
  }, values);
}

interface Gaps {
  board: { top: number; bottom: number; height: number; width: number } | null;
  above: number | null;
  below: number | null;
  aboveFrom: string;
  belowTo: string;
  regionTop: number;
}

/** Gap from the board to the nearest thing above it and the first control below it. */
async function measure(page: Page, boardSelector: string): Promise<Gaps> {
  return page.evaluate((selector) => {
    const region = document.querySelector("[data-game-region]");
    const stage = document.querySelector("[data-game-stage]");
    const board = stage?.querySelector(selector) ?? null;
    const regionBox = region?.getBoundingClientRect();
    const result = {
      board: null as null | { top: number; bottom: number; height: number; width: number },
      above: null as null | number,
      below: null as null | number,
      aboveFrom: "region top",
      belowTo: "region bottom",
      regionTop: regionBox?.top ?? 0,
    };
    if (!board || !regionBox || !stage) return result;
    const b = board.getBoundingClientRect();
    result.board = { top: b.top, bottom: b.bottom, height: b.height, width: b.width };
    let top = regionBox.top;
    let bottom = regionBox.bottom;
    // Siblings along the board's ancestor chain up to the stage.
    for (let node: Element | null = board; node && node !== stage; node = node.parentElement) {
      const parent = node.parentElement;
      if (!parent) break;
      for (const sibling of Array.from(parent.children)) {
        if (sibling === node) continue;
        const r = sibling.getBoundingClientRect();
        if (r.height < 1 || r.width < 1) continue;
        const style = getComputedStyle(sibling);
        if (style.position === "absolute" || style.position === "fixed" || style.visibility === "hidden") continue;
        const label = sibling.getAttribute("data-game-controls") ?? sibling.className.toString().slice(0, 40);
        if (r.bottom <= b.top + 0.5 && r.bottom > top) {
          top = r.bottom;
          result.aboveFrom = label;
        }
        if (r.top >= b.bottom - 0.5 && r.top < bottom) {
          bottom = r.top;
          result.belowTo = label;
        }
      }
    }
    result.above = Math.round(b.top - top);
    result.below = Math.round(bottom - b.bottom);
    return result;
  }, boardSelector);
}

async function main() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const gaps: Record<string, Record<string, Gaps & { cues: string[] }>> = {};
  try {
    for (const game of games) {
      const driver = ((await import(`./drivers/${game}.ts`)) as { driver: Driver }).driver;
      const full = examples[game];
      gaps[game] = {};
      for (const [w, h] of sizes) {
        const tag = `${game}-${w}x${h}`;
        const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: false });
        const page = await context.newPage();
        page.on("pageerror", (e) => console.log(`  [${tag}] page error: ${e.message}`));
        await preparePage(page);
        try {
          // Run 1: intro and mid-play.
          let button = await openGame(page, game);
          await seed(page, driver.mid?.(full));
          await button.click();
          const ready = page.getByRole("button", { name: /^Ready/ });
          await ready.waitFor({ timeout: 90_000 });
          await page.waitForTimeout(2500);
          await page.screenshot({ path: join(out, `${tag}-intro.png`) });
          await ready.click();
          await page.waitForTimeout(1200);
          if (driver.midPlay) await driver.midPlay(page, full);
          await page.waitForTimeout(600);
          await page.screenshot({ path: join(out, `${tag}-play.png`) });
          const measured = await measure(page, driver.board);

          // Run 2: the real solve, its completion moment and the reveal.
          button = await openGame(page, game);
          await seed(page, driver.nearSolved?.(full));
          await button.click();
          await page.getByRole("button", { name: /^Ready/ }).click({ timeout: 90_000 });
          await page.waitForTimeout(1200);
          await page.evaluate(() => {
            (window as unknown as { __cues: string[] }).__cues = [];
          });
          await driver.finish(page, full);
          // The solve lands when the stage submits; wait for the locked state or a short settle.
          const t0 = Date.now();
          const shots = [150, 500, 900];
          for (const [i, at] of shots.entries()) {
            const wait = at - (Date.now() - t0);
            if (wait > 0) await page.waitForTimeout(wait);
            await page.screenshot({ path: join(out, `${tag}-solve${i + 1}.png`) });
          }
          await page.getByText(/Your score|Scoring|points|pts/i).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
          await page.waitForTimeout(1500);
          await page.screenshot({ path: join(out, `${tag}-reveal.png`) });
          const cues = await page.evaluate(() => (window as unknown as { __cues: string[] }).__cues);
          // Largest hidden overflow of any scrollable box on the reveal (0 = fits on one screen).
          const overflow = await page.evaluate(() => {
            let worst = 0;
            for (const el of Array.from(document.querySelectorAll("*"))) {
              const style = getComputedStyle(el);
              if (!/(auto|scroll)/.test(style.overflowY) && el !== document.scrollingElement) continue;
              worst = Math.max(worst, el.scrollHeight - el.clientHeight);
            }
            return worst;
          });
          gaps[game][`${w}x${h}`] = { ...measured, cues };
          console.log(
            `${tag}: board ${measured.board ? `${Math.round(measured.board.width)}×${Math.round(measured.board.height)}` : "?"} · above ${measured.above} (${measured.aboveFrom}) · below ${measured.below} (${measured.belowTo}) · reveal overflow ${overflow}px · cues ${cues.join(", ") || "none"}`,
          );
        } catch (e) {
          console.log(`  [${tag}] FAILED: ${String((e as Error).message ?? e).split("\n")[0]}`);
          await page.screenshot({ path: join(out, `${tag}-error.png`) }).catch(() => undefined);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(out, `gaps-${games.join("_").slice(0, 60)}.json`), JSON.stringify(gaps, null, 2));
}

await main();
