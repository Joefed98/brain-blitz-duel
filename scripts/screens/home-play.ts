/**
 * Home and Rooms (phase 2 step 3, 14 Nov 2026; P1, 21 Nov 2026: Joe's mix of H1 and H2, plan section 3.3): Home in its
 * player banner's three states (placed, with the two rating chips; placement; rated play off, "Play now" on the game
 * of the day) for an account with everything on (the Shop and pass, friends, Jump back in, today's dailies), Home for a
 * new guest, and the Rooms page, in the dark theme and the light theme at every size. The Play page folded into Home
 * (/play redirects there). Drawn by theme-check and no-wrap-check after the core list (scripts/area-screens.ts finds
 * this file, 14 Nov 2026).
 */
import type { Page } from "playwright";

import type { RatedStatus } from "../../src/lib/rated/backend";
import type { RankView } from "../../src/lib/rated/tierDisplay";
import { tierFor } from "../../src/lib/rated/tiers";
import { dailyFixture } from "../daily-fixture";
import { passFixture } from "../pass-fixture";
import { ALL_SIZES, type ThemeScreen, type ThemeViewport } from "../theme-screens";

const rankAt = (r: number): RankView => ({ ...tierFor(r, null), rating: r });
const LOOK = { cardArt: "card-art.joulz-navy", frame: "frame.plain", nameColour: null, avatar: { id: "captain-joulz", colour: 4, gem: null } };

/** A placed player with rated play open (the launch options: Mixed, All puzzles, All arcade; best of 3). */
export const HOME_RATED_STATUS = {
  open: true,
  guest: false,
  me: { userId: "u-5", username: "TheInventor", playerNumber: 42, look: LOOK, title: null, badges: [], rank: rankAt(1482), guest: false, deleted: false },
  options: { picks: ["mixed", "puzzles", "arcade"], formats: ["bo3"], bestOf: [3], sizes: [2] },
  season: null,
  standing: { state: "placed", rank: rankAt(1482), puzzles: { rating: 1530, matches: 22 }, arcade: { rating: 1410, matches: 18 }, categories: [] },
  activeMatchId: null,
} as unknown as RatedStatus;

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const friend = (n: number, username: string, avatar: string, status: unknown) => ({
  id: uid(n),
  username,
  colour: n % 32,
  playerNumber: 100 + n,
  founding: false,
  since: "2026-10-26T10:00:00.000Z",
  status,
  look: { cardArt: "card-art.bolt-stripes", frame: "frame.plain", nameColour: null, avatar: { id: avatar, colour: (n * 5) % 32, gem: null }, title: "rookie", badges: [] },
});
const OVERVIEW = {
  friends: [
    friend(1, "Sam_Volt_Speedrunner", "apex", { kind: "online" }),
    friend(2, "KiraPlays", "pinball", { kind: "practice" }),
    friend(3, "Ollie_K", "hover", { kind: "offline", lastSeen: "2026-10-26T08:00:00.000Z" }),
  ],
  incoming: [],
  outgoing: [],
  invites: [],
  challenges: [],
  blocked: [],
  count: 3,
  cap: 200,
  showOnline: true,
  showOnlineSetting: null,
  adult: true,
};

const RECENT = ["pool", "tubes", "matchup", "blockfall", "sudoku", "minesweeper"];

/** Seeds this device's recently played games, then reloads (device storage is read before the first paint). */
async function withRecent(page: Page) {
  await page.evaluate((recent) => localStorage.setItem("duelz-practice-recent:v1", JSON.stringify(recent)), RECENT);
  await page.reload();
  await page.waitForSelector("[data-hp-recent]", { timeout: 30_000 });
  await page.waitForTimeout(800);
}

export const HOME_PLAY_SCREENS = (ALL_SIZES: ThemeViewport[]): ThemeScreen[] => {
  const pass = passFixture();
  const everything = {
    __harnessPass: pass,
    __DUELZ_SHOP_TAB__: true,
    __harnessRatedStatus: HOME_RATED_STATUS,
    // The Play page's stakes line (the rated server's stakesEstimate, #411).
    __harnessRatedStakes: { win: 12, loss: -12 },
    __harnessFriends: { account: pass.account, overview: OVERVIEW, profile: null },
    __harnessDailyCounts: { day: "2026-10-26", puzzle: 12431, arcade: 8902 },
    __harnessWallet: true,
    // The player banner's "+22 this week" (the server's ratedWeekChangeFn, stood in for the screen).
    __DUELZ_RATED_WEEK__: 22,
    __DUELZ_PUSH_PUBLIC_KEY__: "BNYcXg0Xpca8-OwTPsK5UfzinOSSLskdCpZtDqHpTCU5gmv6jd_qCZw9zXF418o4_tKAy6lldWvsxMXwaAlP0yA",
  };
  const light = { __harnessTheme: "light" };
  const placement = {
    ...everything,
    __harnessRatedStatus: {
      ...HOME_RATED_STATUS,
      standing: { state: "placement", results: ["won", "lost"], puzzles: { rating: null, matches: 1 }, arcade: { rating: null, matches: 1 } },
    },
  };
  const { __harnessRatedStatus: _rated, ...ratedOff } = everything;
  const screens: ThemeScreen[] = [
    { name: "home: an account with rated play, the pass and friends", mode: "home", daily: () => dailyFixture().before, globals: everything, go: withRecent, waitMs: 800 },
    { name: "home: placement matches to play", mode: "home", daily: () => dailyFixture().before, globals: placement, go: withRecent, waitMs: 800 },
    { name: "home: rated play off, play now", mode: "home", daily: () => dailyFixture().before, globals: ratedOff, go: withRecent, waitMs: 800 },
    { name: "home: a new guest", mode: "home", daily: () => dailyFixture().before, waitMs: 800 },
    { name: "home: rooms", mode: "rooms" },
    { name: "home light: home, an account with everything", mode: "home", daily: () => dailyFixture().before, globals: { ...everything, ...light }, go: withRecent, waitMs: 800 },
    { name: "home light: rated play off, play now", mode: "home", daily: () => dailyFixture().before, globals: { ...ratedOff, ...light }, go: withRecent, waitMs: 800 },
    { name: "home light: rooms", mode: "rooms", globals: light },
  ];
  return screens.map((s) => ({ ...s, sizes: ALL_SIZES }));
};

/** This area's screens for theme-check and no-wrap-check (the area-file shape, scripts/area-screens.ts). */
export default (): ThemeScreen[] => HOME_PLAY_SCREENS(ALL_SIZES);
