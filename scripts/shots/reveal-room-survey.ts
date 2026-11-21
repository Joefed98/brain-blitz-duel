/**
 * The reveal template's room measurement (P2, 21 Nov 2026; the plan's fix (a), docs/polish-plan-final.md section 2.1):
 * how much of a room's answer reveal is hidden on its "Your run" view, per game and phone size. A tool, not a check.
 *
 *   1. start a dev server:   npx vite dev --port 5193 --host 127.0.0.1 --strictPort
 *   2. bun scripts/shots/reveal-room-survey.ts minigolf bastion freecell …   (game ids)
 *
 * Each game is first played in practice on that server, left untouched until the clock runs out (exactly as
 * docs/polish-plan-final/direction/source/reveal-survey.mjs does), and the public puzzle and the answer the phone sends
 * to practiceGradeFn are captured. That puzzle and answer are then stored as player 1's round in a 4-player room on the
 * screen harness (scripts/theme-screens.ts, the room's reveal phase), "Your run" is tapped, and the reveal is measured
 * at 375 × 667 and 390 × 844 with the practice survey's own probe: "stageOverflowPx" is the height hidden below the
 * stage, "bodyScroll" the body column's scroll and client heights (a column that scrolls reaches all of it). One JSON
 * line a game and size goes to SURVEY_OUT/room-survey.jsonl (default: a folder in the system temp directory) with a
 * screenshot of the top and of the scrolled end. SURVEY_ORIGIN changes the dev server's address.
 */
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { fromJSON } from "seroval";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, openThemeScreen, room, type ThemeScreen, type ThemeViewport } from "../theme-screens";

const origin = process.env.SURVEY_ORIGIN ?? "http://127.0.0.1:5193";
const games = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SIZES = [
  [375, 667],
  [390, 844],
] as const;
const OUT = join(process.env.SURVEY_OUT ?? join(tmpdir(), "reveal-room-survey"), "/");
mkdirSync(OUT, { recursive: true });
const REVEAL = "[data-reveal-score], [data-arcade-reveal]";

const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
const browser = await chromium.launch({ executablePath: CHROMIUM });

/** The practice run's public puzzle and answer, captured from the request the phone sends to practiceGradeFn. */
async function capture(game: string): Promise<{ puzzle: Record<string, unknown>; answer: string } | null> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  let found: { puzzle: Record<string, unknown>; answer: string } | null = null;
  page.on("request", (req) => {
    if (req.method() !== "POST" || found) return;
    const body = req.postData() ?? "";
    if (!body.includes("sealed") || !body.includes("answer")) return;
    found = parseGrade(body);
  });
  try {
    await page.clock.install();
    await page.goto(`${origin}/practice?game=${game}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Ready/ }).first().waitFor({ timeout: 90_000 });
    await page.getByRole("button", { name: /^Ready/ }).first().click();
    await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await page.clock.fastForward(200_000);
    for (let i = 0; i < 400 && !(await page.locator(REVEAL).count()); i++) await page.clock.runFor(500);
    await page.locator(REVEAL).first().waitFor({ timeout: 60_000 });
  } finally {
    await context.close();
  }
  return found;
}

/** The grade call's body (TanStack Start's seroval JSON, decoded with seroval): its `data` with puzzle and answer. */
function parseGrade(body: string): { puzzle: Record<string, unknown>; answer: string } | null {
  try {
    const decoded = fromJSON(JSON.parse(body)) as { data?: { puzzle?: unknown; answer?: unknown } };
    const data = decoded?.data;
    if (data && data.puzzle && typeof data.puzzle === "object" && typeof data.answer === "string") return { puzzle: data.puzzle as Record<string, unknown>, answer: data.answer };
  } catch {
    /* not a grade call */
  }
  return null;
}

/** The practice survey's probe, plus the body column's scroll. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const q = (s: string) => document.querySelector(s);
    const R = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), width: Math.round(b.width), height: Math.round(b.height) };
    };
    const stage = q('[data-reveal-slot="stage"]');
    const sr = stage?.getBoundingClientRect();
    let deepest = sr ? sr.top : 0;
    if (stage)
      for (const el of stage.querySelectorAll("*")) {
        if (el.closest("[hidden]")) continue;
        if (el.parentElement?.closest(".answer-reveal-content")) continue;
        const b = el.getBoundingClientRect();
        if (b.width < 1 || b.height < 1) continue;
        if (b.bottom > deepest) deepest = b.bottom;
      }
    const body = q('[data-reveal-slot="body"]') as HTMLElement | null;
    const view = q("[data-reveal-view]:not([hidden])");
    return {
      view: view?.getAttribute("data-reveal-view") ?? null,
      stage: R(stage),
      picture: R(q("[data-reveal-picture]")),
      runPicture: R(q("[data-reveal-run-picture]")),
      stageOverflowPx: sr ? Math.round(deepest - sr.bottom) : null,
      bodyScroll: body ? [body.scrollHeight, body.clientHeight] : null,
      page: [document.scrollingElement!.scrollWidth, document.scrollingElement!.scrollHeight, innerWidth, innerHeight],
    };
  });
}

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-room-survey", buildId: "room-survey" });
try {
  for (const game of games) {
    let run: Awaited<ReturnType<typeof capture>> = null;
    let fail: string | null = null;
    try {
      run = await capture(game);
      if (!run) fail = "no grade request captured";
    } catch (e) {
      fail = String((e as Error).message ?? e).split("\n")[0]!;
    }
    for (const [w, h] of SIZES) {
      let out: Awaited<ReturnType<typeof measure>> | null = null;
      let err = fail;
      if (run) {
        const screen: ThemeScreen = {
          name: `room reveal survey, ${game}`,
          mode: "room",
          plain: true,
          room: room("in_progress", "reveal", { arcade: true, arcadeType: game, arcadeRun: { puzzle: run.puzzle as never, answer: run.answer }, players: 4 }),
        };
        try {
          const { context, page } = await openThemeScreen(browser, server.origin, screen, { name: `${w}x${h}`, w, h } satisfies ThemeViewport);
          try {
            await page.locator("[data-reveal-views]").first().waitFor({ timeout: 60_000 });
            await page.getByRole("radio", { name: "Your run" }).click();
            await page.waitForTimeout(2500);
            out = await measure(page);
            await page.screenshot({ path: `${OUT}${game}-room-${w}x${h}.png` });
            await page.evaluate(() => {
              const body = document.querySelector('[data-reveal-slot="body"]');
              if (body) body.scrollTop = body.scrollHeight;
            });
            await page.waitForTimeout(300);
            await page.screenshot({ path: `${OUT}${game}-room-${w}x${h}-end.png` });
          } finally {
            await context.close();
          }
        } catch (e) {
          err = String((e as Error).message ?? e).split("\n")[0]!;
        }
      }
      appendFileSync(`${OUT}room-survey.jsonl`, JSON.stringify({ game, size: [w, h], fail: err, ...out }) + "\n");
    }
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`wrote ${OUT}room-survey.jsonl`);
