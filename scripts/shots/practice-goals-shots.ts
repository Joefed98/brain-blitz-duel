/**
 * Review shots of Practice goals (6 Nov 2026; a design tool, not a check): Practice's stars total, row stars and
 * Challenges on both sides, and Box Six's intro with its stars, at 390×844 (pixel ratio 2), on a seeded device record
 * (some bests, stars and challenge progress).
 *
 *   bun scripts/shots/practice-goals-shots.ts [--out=screenshots/practice-goals-nov-2026]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { practiceBestKey } from "../../src/lib/duel/practiceBest";
import { PRACTICE_GOALS_KEY } from "../../src/lib/duel/practiceGoals";
import { currentPracticeStamp } from "../../src/lib/duel/practiceStamps";
import type { PuzzleType } from "../../src/lib/duel/types";
import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, fixThemeClock, openThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/practice-goals-nov-2026";
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });
fixThemeClock();

const BESTS: [PuzzleType, number][] = [
  ["sudoku", 172], ["unblock", 194], ["lightsout", 131], ["flood", 118], ["tower", 163], ["safe", 150],
  ["pinball", 178], ["skyline", 121], ["beat", 191], ["homerun", 140], ["pool", 165], ["blockfall", 96],
];
const storage: [string, string][] = BESTS.map(([t, s]) => [practiceBestKey(t, currentPracticeStamp(t)), String(s)]);
storage.push([
  PRACTICE_GOALS_KEY,
  JSON.stringify({
    v: 1,
    stars: { sudoku: 2, unblock: 3, wordslide: 1 },
    challenges: {
      "unblock.par": { value: 20, done: "2026-11-06" },
      "unblock.speed": { value: 22 },
      "sudoku.clean": { value: 7.5 },
      "lightsout.speed": { value: 12 },
      "pinball.joulz": { value: 12 },
      "pinball.multiball": { value: 20, done: "2026-11-05" },
      "beat.score180": { value: 164 },
      "pool.black": { value: 10, done: "2026-11-04" },
      "skyline.perfects": { value: 9 },
    },
  }),
]);

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-practice-goals-shots", buildId: "practice-goals-shots" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
const vp = { name: "390x844", w: 390, h: 844, scale: 2 } as never;
const seed = async (context: import("playwright").BrowserContext) => {
  await context.addInitScript((pairs: [string, string][]) => {
    for (const [k, v] of pairs) localStorage.setItem(k, v);
  }, storage);
};
try {
  const screen = THEME_SCREENS.find((s) => s.name === "practice list")!;
  for (const side of ["puzzles", "arcade"] as const) {
    const { context, page } = await openThemeScreen(browser, server.origin, screen, vp, seed);
    try {
      if (side === "arcade") {
        await page.locator("[data-practice-side='arcade']").click();
        await page.locator("[data-practice-switch='arcade']").waitFor({ timeout: 10_000 });
      }
      await page.locator("[data-practice-challenges]").waitFor({ timeout: 10_000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `practice-${side}-390x844.png`) });
      await page.screenshot({ path: join(OUT, `practice-${side}-390x844-full.png`), fullPage: true });
      if (side === "puzzles") {
        await page.locator("[data-challenge-filter='done']").click();
        await page.waitForTimeout(200);
        await page.locator("[data-practice-challenges]").screenshot({ path: join(OUT, `challenges-done-390x844.png`) });
        await page.locator("[data-challenge-filter='new']").click();
        await page.waitForTimeout(200);
        await page.locator("[data-practice-challenges]").screenshot({ path: join(OUT, `challenges-new-390x844.png`) });
        // Box Six's intro with its stars.
        await page.locator("[data-practice-game='sudoku']").first().click();
        await page.locator("[data-intro-best]").waitFor({ timeout: 15_000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: join(OUT, `intro-sudoku-390x844.png`) });
      }
      console.log(`wrote ${side}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(0);
