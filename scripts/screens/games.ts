/**
 * The Games session's screens (phase 2 step 3, 14 Nov 2026; docs/design/pages-review/games/GALLERY.md) for theme-check
 * and no-wrap-check: the Games catalogue (All, a chip chosen, the search open), a game's page (a puzzle and an arcade
 * game, with their challenges and, for a tester whose pass is on, each challenge's Joules) and the full Challenges page,
 * in the dark theme at every size and the sideways tablet, and the catalogue, a game's page and Challenges again in
 * light at every size. Drawn by theme-check and no-wrap-check after the core list (scripts/area-screens.ts finds this file, 14 Nov 2026).
 */
import type { Page } from "playwright";

import { challengeFixture } from "../challenge-fixture";
import { passFixture } from "../pass-fixture";
import { PRACTICE_CHALLENGES, challengeLive } from "../../src/lib/duel/practiceChallenges";
import type { ServerChallenges } from "../../src/lib/challenges/challengesClient";
import type { PracticeProgressView } from "../../src/lib/practice/progress";
import { ALL_SIZES, NAV_SIZES, type ThemeScreen, type ThemeViewport } from "../theme-screens";

/** A player part-way through: stars and bests on a spread of games, every level drawn. */
export function gamesProgressFixture(): PracticeProgressView {
  const games: PracticeProgressView["games"] = {};
  const set = (type: string, best: number, stars: { easy?: boolean; classic?: boolean; hard?: boolean }) => {
    games[type] = {
      easy: { best, star: Boolean(stars.easy), starScore: stars.easy ? 180 : null },
      classic: { best, star: Boolean(stars.classic), starScore: stars.classic ? 182 : null },
      hard: { best, star: Boolean(stars.hard), starScore: stars.hard ? 190 : null },
    };
  };
  set("tubes", 182, { easy: true, classic: true });
  set("matchup", 141, { easy: true });
  set("tower", 196, { easy: true, classic: true, hard: true });
  set("blockfall", 188, { easy: true, classic: true, hard: true });
  set("pool", 164, { easy: true, classic: true });
  set("tilt", 120, { easy: true });
  return { games, stars: 74, gems: [], noteSeen: true, freshStartAt: null };
}

/** The server's challenge rows: Polypotions' first done, others part-way, the rest new. */
export function gamesChallengesFixture(): ServerChallenges {
  const rows: ServerChallenges["rows"] = [];
  let n = 0;
  for (const c of PRACTICE_CHALLENGES.filter(challengeLive)) {
    n++;
    if (n % 4 === 0) rows.push({ id: c.id, best: 0, done: true, doneAt: "2026-11-10T12:00:00.000Z", coins: c.coins, paid: true });
    else if (n % 3 === 0) rows.push({ id: c.id, best: 1, done: false, doneAt: null, coins: c.coins, paid: false });
  }
  return { account: true, rows };
}

const pageOf = (type: string) => ({ page: type });

/** The Challenges page's Friends tab chosen. */
const friendsTab = async (page: Page) => {
  await page.locator("[data-challenge-filter='friends']").click();
  await page.locator("[data-your-challenges], [data-your-challenges-empty]").first().waitFor({ timeout: 15_000 });
};

export const GAMES_SCREENS = (sizes: ThemeViewport[], allSizes: ThemeViewport[]): ThemeScreen[] => {
  const data = { __harnessProgress: gamesProgressFixture(), __DUELZ_CHALLENGES__: gamesChallengesFixture() };
  const pass = passFixture();
  const withPass = { ...data, __harnessPass: pass };
  const light = { __harnessTheme: "light" };
  return [
    { name: "games: catalogue", mode: "practice", globals: data, sizes },
    {
      name: "games: catalogue, Logic chosen",
      mode: "practice",
      globals: data,
      sizes,
      // Changed with Joe's approval, 22 Nov 2026 (P2, Shelves · All): no category chips; the screen scrolls to the Logic shelf. Was the Logic chip pressed.
      go: async (page: Page) => {
        await page.locator("[data-games-shelf='logic']").scrollIntoViewIfNeeded({ timeout: 10_000 }); // Changed with Joe's approval, 22 Nov 2026
        await page.waitForTimeout(300);
      },
    },
    {
      name: "games: catalogue, search open",
      mode: "practice",
      globals: data,
      sizes,
      go: async (page: Page) => {
        await page.locator("[data-games-search-toggle]").click();
        await page.locator("#games-search").fill("ball");
        await page.waitForTimeout(300);
      },
    },
    { name: "games: game page, Polypotions", mode: "practice", plain: true, search: pageOf("tubes"), globals: withPass, sizes, waitMs: 900 },
    { name: "games: game page, Cue Ball", mode: "practice", plain: true, search: pageOf("pool"), globals: data, sizes, waitMs: 900 },
    { name: "games: challenges", mode: "challenges", plain: true, globals: withPass, sizes, waitMs: 900 },
    { name: "games light: catalogue", mode: "practice", globals: { ...data, ...light }, sizes: allSizes },
    { name: "games light: game page", mode: "practice", plain: true, search: pageOf("tubes"), globals: { ...withPass, ...light }, sizes: allSizes, waitMs: 900 },
    { name: "games light: challenges", mode: "challenges", plain: true, globals: { ...withPass, ...light }, sizes: allSizes, waitMs: 900 },
    // The Friends tab (Joe, 14 Nov 2026): this device's friend challenges (Profile's former "Your challenges"), and none.
    { name: "games: challenges, friends", mode: "challenges", plain: true, globals: data, challenge: () => challengeFixture("create"), sizes, waitMs: 600, go: friendsTab },
    { name: "games: challenges, friends, none", mode: "challenges", plain: true, records: false, globals: data, sizes, waitMs: 600, go: friendsTab },
  ];
};

/** This area's screens for theme-check and no-wrap-check (the area-file shape, scripts/area-screens.ts). */
export default (): ThemeScreen[] => GAMES_SCREENS(NAV_SIZES, ALL_SIZES);
