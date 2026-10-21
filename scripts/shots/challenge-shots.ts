/**
 * Screenshots of friend challenges for review (22 Oct 2026; a design tool, not a check): the Play
 * tab's card, making a challenge, the creator's results with the link to send, a friend opening the
 * link, a live round with the earlier players' "finished ✓" pings, the round leaderboard and
 * standings with their stored results, the podium with awards, Profile's "Your challenges", a room's
 * podium with "Challenge a friend", and the daily's Share on its results and board. At 414×896 as an
 * iPhone 11 home-screen app (1× JPEG), on the real screens with only the network edge stubbed
 * (scripts/safe-area-harness.tsx, H.challenge; scripts/challenge-fixture.ts). The rounds are real
 * dealt puzzles (a fixed seed); names and scores are made up.
 *
 *   bun scripts/shots/challenge-shots.ts [--out=screenshots/challenge-oct-2026] [name filter…]
 */
import { existsSync, mkdirSync } from "node:fs";

import { chromium, type Page } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { CHALLENGE_CODE, challengeFixture } from "../challenge-fixture";
import { dailyFixture } from "../daily-fixture";
import { CHALLENGE_SCREENS, CHROMIUM_PATHS, THEME_SCREENS, VIEWPORTS, openThemeScreen, startChallengeRun, type ThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/challenge-oct-2026";
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });

const byName = (name: string) => [...THEME_SCREENS, ...CHALLENGE_SCREENS].find((s) => s.name === name)!;
const SHOTS: { file: string; screen: ThemeScreen; act?: (page: Page) => Promise<void> }[] = [
  {
    file: "01-play-card",
    screen: byName("play"),
    act: async (page) => {
      await page.locator("[data-challenge-card]").scrollIntoViewIfNeeded();
    },
  },
  { file: "02-make-a-challenge", screen: byName("challenge, make one") },
  { file: "03-creator-results-send", screen: byName("challenge, creator's results") },
  { file: "04-link-opened", screen: byName("challenge, link opened") },
  {
    file: "05-live-round-pings",
    screen: { name: "challenge, live round", mode: "challenge", challenge: () => challengeFixture("live"), search: { code: CHALLENGE_CODE } },
    act: async (page) => {
      await startChallengeRun(page);
      await page.locator("[data-finished-ping]").waitFor({ timeout: 30_000 });
      await page.waitForTimeout(500);
    },
  },
  { file: "06-round-leaderboard", screen: byName("challenge, round leaderboard") },
  { file: "07-standings", screen: byName("challenge, standings") },
  { file: "08-podium-awards", screen: byName("challenge, podium") },
  {
    file: "09-podium-actions",
    screen: byName("challenge, podium"),
    act: async (page) => {
      await page.locator("[data-challenge-actions]").scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    },
  },
  {
    file: "10-profile-your-challenges",
    screen: byName("profile"),
    act: async (page) => {
      await page.locator("[data-your-challenges]").scrollIntoViewIfNeeded();
    },
  },
  {
    file: "11-room-podium-challenge-a-friend",
    screen: { ...byName("podium, 10 players"), challenge: () => challengeFixture("create") },
    act: async (page) => {
      await page.locator("[data-room-challenge]").scrollIntoViewIfNeeded();
    },
  },
  {
    file: "12-room-podium-send",
    screen: { ...byName("podium, 10 players"), challenge: () => challengeFixture("create") },
    act: async (page) => {
      await page.locator("[data-room-challenge]").click();
      await page.locator('[data-room-challenge="ready"]').waitFor({ timeout: 10_000 });
    },
  },
  { file: "13-daily-results-share", screen: byName("daily results") },
  {
    file: "14-daily-board-share",
    screen: { name: "daily board", mode: "daily", daily: () => dailyFixture().after },
    act: async (page) => {
      await page.locator("[data-daily-me]").scrollIntoViewIfNeeded();
    },
  },
];

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-challenge-shots", buildId: "challenge-shots" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
const app = VIEWPORTS.find((v) => v.app)!;
try {
  for (const shot of SHOTS) {
    if (ONLY.length && !ONLY.some((o) => shot.file.includes(o))) continue;
    const { context, page } = await openThemeScreen(browser, server.origin, shot.screen, app);
    try {
      if (shot.act) await shot.act(page);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/${shot.file}.jpg`, type: "jpeg", quality: 85 });
      console.log(`wrote ${OUT}/${shot.file}.jpg`);
    } catch (err) {
      console.log(`FAILED ${shot.file}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
