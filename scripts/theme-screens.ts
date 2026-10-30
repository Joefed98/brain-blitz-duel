/**
 * The page skin's screens (polish-layout/theme.css), shared by theme-check and no-wrap-check: the
 * four tab screens (with a scheduled public game, room history and practice bests on the device),
 * the settings sheet, the room's lobby (2 and 10 players, and its confirm dialog), link join, the
 * round leaderboard (2 and 10 players, after a puzzle and an arcade round), the answer reveal
 * (puzzle and arcade), standings (2 and 10 players) and the final results and podium (2 and 10
 * players), and the daily challenge (21 Oct 2026: the Play card, /daily before and after playing,
 * the daily results and Profile's Daily row; scripts/daily-fixture.ts), drawn through
 * scripts/safe-area-harness.tsx (the real routes, network stubbed).
 */
import type { Browser, BrowserContext, Page } from "playwright";

import { DEVICE_INIT, IPHONE11_APP, emulateDevice } from "./device-emulation";
import { FIXED_NOW, fixClock } from "./fixed-clock";
import { ONBOARDING_KEY } from "../src/lib/onboarding";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { currentPracticeStamp } from "../src/lib/duel/practiceStamps";
import { practiceBestKey } from "../src/lib/duel/practiceBest";
import type { PuzzleData } from "../src/lib/duel/types";
import { dailyFixture, type HarnessDaily } from "./daily-fixture";
import { CHALLENGE_CODE, challengeFixture, type ChallengeScreenData } from "./challenge-fixture";

export const PUZZLE = splitPuzzle(withSeededRandom(41, () => generatePuzzle("sudoku")))
  .pub as PuzzleData;
const ARCADE = splitPuzzle(withSeededRandom(41, () => generatePuzzle("matchup"))).pub as PuzzleData;
const iso = (ms: number) => new Date(ms).toISOString();
/** Long names on purpose: a name never wraps; it truncates with an ellipsis. */
const NAMES = [
  "Me with a long name",
  "Another long player name",
  "Sam",
  "Priya",
  "Jordan",
  "Alex",
  "Robin",
  "Kai",
  "Morgan",
  "Charlie",
];

type Status = "waiting" | "in_progress" | "finished";
interface RoomOpts {
  join?: boolean;
  players?: number;
  arcade?: boolean;
  rounds?: number;
}

function roomNow(status: Status, phase: string, opts: RoomOpts) {
  const now = Date.now();
  const count = opts.players ?? 2;
  const rounds = opts.rounds ?? 1;
  const player = (slot: number) => ({
    id: `p${slot}`,
    duel_id: "duel-theme",
    player_slot: slot,
    display_name: NAMES[slot - 1] ?? `Player ${slot}`,
    user_id: `u${slot}`,
    ready_round: rounds,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: iso(now),
    status: "active",
    joined_at: iso(now - 60_000),
  });
  const result = (slot: number, round: number) => ({
    id: `r${slot}-${round}`,
    duel_id: "duel-theme",
    player_slot: slot,
    round_number: round,
    answer: "",
    is_correct: slot % 3 !== 0,
    ms_remaining: slot === 2 ? 0 : 20_000 - slot * 900,
    reaction_avg_ms: null,
    correct_count: null,
    errors: null,
    extra: null,
    score: 190 - slot * 13 - round,
    submitted_at: iso(now - 5_000),
  });
  const scored = status === "finished" || ["result", "standings", "winner_reveal"].includes(phase);
  const players = Array.from({ length: count }, (_, i) => player(i + 1));
  if (opts.join) players[0] = { ...players[0]!, status: "left" };
  const order = Array.from({ length: rounds }, (_, i) =>
    opts.arcade || i % 2 ? "matchup" : "sudoku",
  );
  return {
    duel: {
      id: "duel-theme",
      room_code: "SAFE",
      status,
      selected_categories: [],
      tournament_history: [],
      disbanded_at: null,
      host_user_id: "u1",
      max_players: 10,
      round_count: rounds,
      round_order: order,
      no_maths: false,
      puzzles_public: order.map((t) => (t === "matchup" ? ARCADE : PUZZLE)),
      current_round: status === "waiting" ? 0 : rounds,
      phase,
      phase_started_at: iso(now + 500),
      round_started_at: iso(now + 500),
      next_duel_id: null,
      created_at: iso(now - 60_000),
    },
    players,
    results: scored
      ? players.flatMap((p) =>
          Array.from({ length: rounds }, (_, r) => result(p.player_slot, r + 1)),
        )
      : [],
  };
}
export const room =
  (status: Status, phase: string, opts: RoomOpts = {}) =>
  () =>
    roomNow(status, phase, opts);

export interface ThemeScreen {
  name: string;
  mode: "home" | "practice" | "tournaments" | "profile" | "room" | "daily" | "challenge" | "terms";
  /** The browser's user agent (the Add to Home Screen hint shows on iPhone Safari only). */
  userAgent?: string;
  /** Stand-in beta values (src/config/betaConfig.ts) through window.__DUELZ_BETA_CONFIG__. */
  beta?: Record<string, string>;
  /** Friend challenges' stand-in server (H.challenge), the run's view (H.daily) and the route's ?code=. */
  challenge?: () => ChallengeScreenData;
  search?: Record<string, string>;
  room?: () => ReturnType<typeof roomNow>;
  /** The daily challenge's stand-in server (H.daily) and this device's daily record. */
  daily?: () => HarnessDaily;
  /** After the page is drawn: open a sheet or dialog. */
  go?: (page: Page) => Promise<void>;
  waitMs?: number;
  /** Extra query on the harness page's URL (share-check: `ref=share`). */
  query?: string;
  /** A screen with no card of its own (link join, the answer reveal). */
  plain?: boolean;
}

/** Opens the challenge's run from its link: round 1 started `startOffsetMs` ago on the page's clock. */
export async function startChallengeRun(page: Page) {
  await page.evaluate(() => {
    const h = (window as unknown as { __harness: { startOffsetMs: number | null; daily?: { view?: { rounds: { startedAt: number | null }[] } } } }).__harness;
    if (h.startOffsetMs !== null && h.daily?.view) h.daily.view.rounds[0]!.startedAt = Date.now() - h.startOffsetMs;
  });
  await page.locator("[data-challenge-play]").click();
}

/** A challenge round's results screens are reached by playing: past round 1's time-out, its reveal, then them. */
async function toChallengeResults(page: Page, standingsToo: boolean) {
  await startChallengeRun(page);
  await page.getByText("Round results", { exact: true }).waitFor({ timeout: 45_000 });
  await page.waitForTimeout(800);
  if (!standingsToo) return;
  await page.locator("[data-continue-footer] button").click();
  // Polish batch R: the standings' one title line ("Standings" and "After round n of N").
  await page.getByText("Standings", { exact: true }).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
}

export const CHALLENGE_SCREENS: ThemeScreen[] = [
  { name: "challenge, make one", mode: "challenge", challenge: () => challengeFixture("create") },
  { name: "challenge, link opened", mode: "challenge", challenge: () => challengeFixture("landing"), search: { code: CHALLENGE_CODE } },
  {
    name: "challenge, round leaderboard",
    mode: "challenge",
    challenge: () => challengeFixture("result"),
    search: { code: CHALLENGE_CODE },
    go: (page) => toChallengeResults(page, false),
  },
  {
    name: "challenge, standings",
    mode: "challenge",
    challenge: () => challengeFixture("result"),
    search: { code: CHALLENGE_CODE },
    go: (page) => toChallengeResults(page, true),
  },
  { name: "challenge, podium", mode: "challenge", challenge: () => challengeFixture("podium"), search: { code: CHALLENGE_CODE }, waitMs: 2500 },
  { name: "challenge, creator's results", mode: "challenge", challenge: () => challengeFixture("creator"), search: { code: CHALLENGE_CODE }, waitMs: 1500 },
];

/** iPhone 11 Safari (iOS 18), not a home-screen app. */
export const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";

export const THEME_SCREENS: ThemeScreen[] = [
  { name: "play", mode: "home", daily: () => dailyFixture().after, challenge: () => challengeFixture("create") },
  { name: "practice list", mode: "practice" },
  // Practice's Arcade side (30 Oct 2026: the Puzzles | Arcade switch).
  {
    name: "practice list, arcade side",
    mode: "practice",
    go: async (page) => {
      await page.locator("[data-practice-side='arcade']").click();
      await page.locator("[data-practice-switch='arcade']").waitFor({ timeout: 10_000 });
      await page.waitForTimeout(400);
    },
  },
  { name: "tournaments", mode: "tournaments" },
  { name: "profile", mode: "profile", daily: () => dailyFixture().after, challenge: () => challengeFixture("create") },
  ...CHALLENGE_SCREENS,
  { name: "daily, before playing", mode: "daily", daily: () => dailyFixture().before },
  { name: "daily, board after playing", mode: "daily", daily: () => dailyFixture().after },
  {
    name: "daily results",
    mode: "daily",
    daily: () => dailyFixture().after,
    go: async (page) => {
      await page.locator("[data-daily-results]").click();
      await page.locator("[data-async-results]").waitFor({ timeout: 20_000 });
      await page.waitForTimeout(600);
    },
  },
  // The beta extras (22 Oct 2026): the terms before a first room, the iPhone Safari hint, the feedback link.
  { name: "beta terms", mode: "terms", query: "terms=0" },
  { name: "play, Add to Home Screen hint", mode: "home", userAgent: IPHONE_SAFARI_UA },
  { name: "profile, feedback link", mode: "profile", beta: { TALLY_URL: "https://tally.so/r/test12" } },
  {
    name: "settings sheet",
    mode: "profile",
    go: async (page) => {
      await page.locator("[data-open-settings]").click();
      await page.locator("[data-settings-sheet]").waitFor({ timeout: 10_000 });
    },
  },
  { name: "lobby, 2 players", mode: "room", room: room("waiting", "starting") },
  { name: "lobby, 10 players", mode: "room", room: room("waiting", "starting", { players: 10 }) },
  {
    name: "lobby confirm dialog",
    mode: "room",
    room: room("waiting", "starting", { players: 3 }),
    go: async (page) => {
      // Polish batch R: Disband room is in the header's "⋯" menu.
      await page.locator("[data-room-menu]").first().click();
      await page.getByRole("menuitem", { name: "Disband room" }).click();
      await page.getByRole("alertdialog").waitFor({ timeout: 10_000 });
    },
  },
  {
    name: "link join",
    mode: "room",
    room: room("waiting", "starting", { join: true }),
    plain: true,
  },
  {
    name: "answer reveal (puzzle)",
    mode: "room",
    room: room("in_progress", "reveal"),
    waitMs: 1500,
    plain: true,
  },
  {
    name: "answer reveal (arcade)",
    mode: "room",
    room: room("in_progress", "reveal", { arcade: true, players: 6 }),
    waitMs: 1500,
    plain: true,
  },
  {
    name: "round leaderboard, 2 players",
    mode: "room",
    room: room("in_progress", "result", { rounds: 2 }),
    waitMs: 2500,
  },
  {
    name: "round leaderboard, 10 players",
    mode: "room",
    room: room("in_progress", "result", { players: 10, rounds: 2 }),
    waitMs: 2500,
  },
  {
    name: "round leaderboard after an arcade round, 10 players",
    mode: "room",
    room: room("in_progress", "result", { players: 10, arcade: true, rounds: 2 }),
    waitMs: 2500,
  },
  {
    name: "standings, 2 players",
    mode: "room",
    room: room("in_progress", "standings", { rounds: 2 }),
    waitMs: 2500,
  },
  {
    name: "standings, 10 players",
    mode: "room",
    room: room("in_progress", "standings", { players: 10, rounds: 2 }),
    waitMs: 2500,
  },
  {
    name: "final results, 2 players",
    mode: "room",
    room: room("finished", "result", { rounds: 6 }),
    waitMs: 3000,
  },
  {
    name: "podium, 10 players",
    mode: "room",
    room: room("finished", "result", { players: 10, rounds: 6 }),
    waitMs: 3000,
  },
];

export interface ThemeViewport {
  name: string;
  w: number;
  h: number;
  /** The iPhone 11 home-screen app's geometry (scripts/device-emulation.ts). */
  app?: boolean;
  /** A mouse or trackpad (hover, fine pointer): the desktop layout (#109). */
  desktop?: boolean;
  /** Device pixel ratio for screenshots (scripts/shots/app-pages-shots.ts); 1 when unset. */
  scale?: number;
}
export const VIEWPORTS: ThemeViewport[] = [
  { name: "414x896 home-screen app", w: IPHONE11_APP.w, h: IPHONE11_APP.h, app: true },
  { name: "375x667", w: 375, h: 667 },
  { name: "desktop 1440x900", w: 1440, h: 900, desktop: true },
];

/** The device's own records: a public game today, room history and practice bests. */
function deviceInit(seed: { onboarding: string; bests: [string, number][] }) {
  try {
    localStorage.setItem(seed.onboarding, "1");
    const now = Date.now();
    const day = (offset: number) => {
      const d = new Date(now + offset * 86_400_000);
      return d.toISOString().slice(0, 10);
    };
    // A check that set its own schedule first (share-check: none) keeps it.
    const schedule = window as unknown as { __DUELZ_PUBLIC_GAMES__?: unknown };
    if (!schedule.__DUELZ_PUBLIC_GAMES__)
      schedule.__DUELZ_PUBLIC_GAMES__ = [
      {
        date: day(2),
        time: "19:00",
        lobbyOpens: "18:45",
        rounds: 6,
        roomCode: "PLAY",
        title: "Saturday night quiz",
      },
      {
        date: day(9),
        time: "20:30",
        lobbyOpens: "20:15",
        rounds: 7,
        roomCode: "PLAY",
        title: "The long weekend championship final",
      },
    ];
    localStorage.setItem(
      "duelz-room-history:v1",
      JSON.stringify([
        { key: "a:1", code: "PLAY", at: now - 86_400_000, players: 10, place: 1, points: 812 },
        { key: "b:1", code: "WXYZ", at: now - 2 * 86_400_000, players: 4, place: 3, points: 640 },
        {
          key: "c:1",
          code: "PLAY",
          at: now - 3 * 86_400_000,
          players: 7,
          place: null,
          points: 120,
        },
      ]),
    );
    for (const [key, best] of seed.bests) localStorage.setItem(key, String(best));
  } catch {
    /* ignore */
  }
}

const BEST_TYPES = ["tilegrid", "matchup", "sudoku"] as const;

let pageClock: ReturnType<typeof fixClock> | null = null;
/**
 * Draws every screen opened from here on with a fixed clock (scripts/fixed-clock.ts): the dated screens
 * (the Play tab's public games, scheduled `day(2)` after "now", Tournaments, room history) then read the
 * same on any day. Shifts this process's Date too, so the room and daily fixtures agree with the page.
 */
export function fixThemeClock(at: number = FIXED_NOW): void {
  pageClock = fixClock(at);
}

/** Opens one screen at one viewport; the caller closes the context. */
export async function openThemeScreen(
  browser: Browser,
  origin: string,
  screen: ThemeScreen,
  viewport: ThemeViewport,
  /** Extra set-up on the context before the page opens (share-check's share-sheet stubs). */
  prepare?: (context: BrowserContext) => Promise<void>,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: viewport.w, height: viewport.h },
    ...(viewport.scale ? { deviceScaleFactor: viewport.scale } : {}),
    ...(viewport.desktop ? { hasTouch: false, isMobile: false } : { hasTouch: true }),
    ...(screen.userAgent ? { userAgent: screen.userAgent } : {}),
  });
  if (pageClock) await context.addInitScript(pageClock.script, pageClock.arg);
  await context.addInitScript(DEVICE_INIT);
  if (screen.beta)
    await context.addInitScript((beta) => {
      (window as unknown as { __DUELZ_BETA_CONFIG__: unknown }).__DUELZ_BETA_CONFIG__ = beta;
    }, screen.beta);
  if (prepare) await prepare(context);
  await context.addInitScript(
    (r) => {
      const daily = (r.challengeRun?.daily ?? r.daily) as { view?: { rounds: { startedAt: number | null }[] } } | undefined;
      // A challenge run starts mid-round (or past round 1's time-out): startChallengeRun sets round 1's
      // start on this page's clock just before the run opens (a slow page open must not pass its close).
      (window as unknown as { __harness: unknown }).__harness = {
        puzzles: { sudoku: r.puzzle, ...(r.challengeRun?.challenge.puzzles ?? {}) },
        verdict: { isCorrect: true, score: 150 },
        latencyMs: 50,
        submissions: [],
        verdictAt: null,
        room: r.room,
        daily,
        challenge: r.challengeRun?.challenge,
        startOffsetMs: r.challengeRun?.startOffsetMs ?? null,
        search: r.search,
      };
      try {
        if (r.record) localStorage.setItem(r.record[0], r.record[1]);
        if (r.challengeRun) localStorage.setItem(r.challengeRun.record[0], r.challengeRun.record[1]);
      } catch {
        /* ignore */
      }
    },
    {
      room: screen.room?.() ?? null,
      puzzle: PUZZLE,
      daily: screen.daily?.() ?? undefined,
      record: screen.daily ? dailyFixture().record : null,
      // Run screens carry their own attempt view; the others only the challenge server (the daily's stays).
      challengeRun: screen.challenge
        ? (() => {
            const data = screen.challenge();
            return screen.mode === "challenge" ? data : { ...data, daily: undefined, startOffsetMs: null };
          })()
        : null,
      search: screen.search ?? {},
    },
  );
  await context.addInitScript(deviceInit, {
    onboarding: ONBOARDING_KEY,
    bests: BEST_TYPES.map(
      (t, i) =>
        [practiceBestKey(t, currentPracticeStamp(t)), 148 - i * 21] as [
          string,
          number,
        ],
    ),
  });
  const page = await context.newPage();
  const url = `${origin}/safe-area.html?mode=${screen.mode}${screen.query ? `&${screen.query}` : ""}`;
  try {
    await page.goto(url, { timeout: 180_000 });
  } catch (error) {
    if (!/Timeout \d+ms exceeded/.test(String((error as Error).message))) throw error;
    await page.goto(url, { timeout: 90_000 });
  }
  if (screen.mode === "practice")
    await page.locator("[data-practice-game]").first().waitFor({ timeout: 60_000 });
  else await page.waitForSelector("#root *", { timeout: 60_000 });
  if (viewport.app) await emulateDevice(page, IPHONE11_APP);
  await page.waitForTimeout(800);
  if (screen.go) await screen.go(page);
  await page.waitForTimeout(screen.waitMs ?? 600);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return { context, page };
}

export const CHROMIUM_PATHS = [
  process.env.PLAYWRIGHT_CHROMIUM,
  "/opt/pw-browsers/chromium",
  "/usr/bin/chromium",
];

/** `--part=k/n`: every n-th draw from the k-th (a CI shard's share); the parts together are one whole run. */
export function partOf<T>(items: T[], argv: string[]): T[] {
  const part = argv.find((a) => a.startsWith("--part="))?.slice(7);
  if (!part) return items;
  const m = /^(\d+)\/(\d+)$/.exec(part);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > Number(m[2])) throw new Error(`bad --part=${part}`);
  const [k, n] = [Number(m[1]), Number(m[2])];
  return items.filter((_, i) => i % n === k - 1);
}
