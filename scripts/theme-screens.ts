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
import { readFileSync } from "node:fs";
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
import { boardsFixture } from "./leaderboards-fixture";
import { passFixture } from "./pass-fixture";
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
  // Rooms of 16 (31 Oct 2026).
  "Bartholomew Longname",
  "Zoë",
  "Mo",
  "Francesca",
  "Li",
  "Oluwaseun",
];

/** A standard game's four part lines and tiles (31 Oct 2026: the 375×667 chart overlap). */
const FOUR_PART_REVEAL = {
  axis: { value: 112, max: 150, label: "Core" },
  lines: ["Core 112 / 150", "Ice 8 / 10", "Big lines 6 / 10", "Treasures 18 / 30"],
  tiles: [
    { label: "Levels", value: "3" },
    { label: "Gold hits", value: "4" },
    { label: "Targets", value: "6" },
    { label: "Time bonus", value: "+12" },
  ],
  outcome: "time",
};

type Status = "waiting" | "in_progress" | "finished";
interface RoomOpts {
  join?: boolean;
  players?: number;
  arcade?: boolean;
  rounds?: number;
  /** The reveal phase with every player's stored result for the round, mine carrying FOUR_PART_REVEAL. */
  revealParts?: boolean;
  /** My place by score (slot 1 is "me"; everyone above moves up one). Unset: slot order. */
  meAt?: number;
  /** Rows from a database with the colour/icon columns: each player's stored colour (the lobby picker shows). */
  colours?: (slot: number) => number;
  /** An arcade round of this game instead of Gemstone (with `arcade`). */
  arcadeType?: string;
  /** The host's user id (default u1, this device: "u2" draws the lobby as a guest sees it). */
  host?: string;
  /** The room's stored settings (duels.selected_categories; default [], an older room's Standard mix). */
  settings?: string[];
  /** A row with the scoring column (scoringMode.ts) holding this mode; unset: a row from before the migration. */
  scoring?: "total" | "placings";
  /** Each stored round score (unset: the default spread). */
  scores?: (slot: number, round: number) => number;
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
    ...(opts.colours ? { colour: opts.colours(slot), icon: null } : {}),
  });
  const rankOf = (slot: number) => (!opts.meAt ? slot : slot === 1 ? opts.meAt : slot <= opts.meAt ? slot - 1 : slot);
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
    score: opts.scores ? opts.scores(slot, round) : 190 - rankOf(slot) * 13 - round,
    submitted_at: iso(now - 5_000),
  });
  const scored = status === "finished" || ["result", "standings", "winner_reveal"].includes(phase) || !!opts.revealParts;
  const players = Array.from({ length: count }, (_, i) => player(i + 1));
  if (opts.join) players[0] = { ...players[0]!, status: "left" };
  const arcadeType = opts.arcadeType ?? "matchup";
  const arcadePuzzle =
    arcadeType === "matchup" ? ARCADE : (splitPuzzle(withSeededRandom(41, () => generatePuzzle(arcadeType as never))).pub as PuzzleData);
  const order = Array.from({ length: rounds }, (_, i) =>
    opts.arcade || i % 2 ? arcadeType : "sudoku",
  );
  return {
    duel: {
      id: "duel-theme",
      room_code: "SAFE",
      status,
      selected_categories: opts.settings ?? [],
      ...(opts.scoring ? { scoring_mode: opts.scoring } : {}),
      tournament_history: [],
      disbanded_at: null,
      host_user_id: opts.host ?? "u1",
      max_players: 10,
      round_count: rounds,
      round_order: order,
      no_maths: false,
      puzzles_public: order.map((t) => (t === arcadeType ? arcadePuzzle : PUZZLE)),
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
          Array.from({ length: rounds }, (_, r) => {
            const row = result(p.player_slot, r + 1);
            return opts.revealParts && p.player_slot === 1 ? { ...row, extra: { reveal: FOUR_PART_REVEAL } } : row;
          }),
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
  mode: "home" | "practice" | "tournaments" | "profile" | "room" | "daily" | "challenge" | "terms" | "notfound" | "error" | "firstopen" | "account" | "saveprogress" | "friends" | "customise" | "rated" | "leaderboards" | "dailyboard" | "pass";
  /** Window globals set before the page loads (wave 1: `__harnessPreview`, a room link's preview). */
  globals?: Record<string, unknown>;
  /** false: a brand-new device, with no room history, practice bests or public games (wave 1's empty states). */
  records?: false;
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
  /**
   * More sizes to draw it at, after every screen's VIEWPORTS draws (so the parts of earlier draws keep their places):
   * a screen changed from 13 Nov 2026 is drawn at every size (ALL_SIZES).
   */
  sizes?: ThemeViewport[];
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

/**
 * Rooms of 16 (31 Oct 2026; room-16-check also draws these): the lobby's two columns, compact
 * leaderboards and standings with my row pinned, the arcade reveal's top 8 and me with four part
 * lines, and the podium's top three with my place.
 */
export function ROOM_16_SCREENS(): ThemeScreen[] {
  return [
    { name: "lobby, 16 players", mode: "room", room: room("waiting", "starting", { players: 16 }) },
    {
      name: "lobby, 16 players, colour wheel",
      mode: "room",
      // Stored colours spread over the wheel (every third swatch), so 15 are taken by others.
      room: room("waiting", "starting", { players: 16, colours: (slot) => ((slot - 1) * 2) % 32 }),
      go: async (page) => {
        await page.locator("[data-look-toggle]").click();
        await page.locator("[data-colour-wheel]").waitFor({ timeout: 10_000 });
        await page.waitForTimeout(300);
      },
    },
    { name: "round leaderboard, 16 players", mode: "room", room: room("in_progress", "result", { players: 16, rounds: 2, meAt: 12 }), waitMs: 2500 },
    {
      name: "round leaderboard after an arcade round, 16 players",
      mode: "room",
      room: room("in_progress", "result", { players: 16, arcade: true, rounds: 2, meAt: 12 }),
      waitMs: 2500,
    },
    { name: "standings, 16 players", mode: "room", room: room("in_progress", "standings", { players: 16, rounds: 2, meAt: 12 }), waitMs: 2500 },
    {
      name: "answer reveal (arcade), 16 players, four part lines",
      mode: "room",
      room: room("in_progress", "reveal", { arcade: true, players: 16, revealParts: true, meAt: 12 }),
      waitMs: 1500,
      plain: true,
    },
    { name: "podium, 16 players", mode: "room", room: room("finished", "result", { players: 16, rounds: 6, meAt: 12 }), waitMs: 3000 },
  ];
}

/**
 * Wave 1's first impressions (10 Nov 2026; docs/mockups/wave-1/): the empty states on a brand-new device,
 * the not-found screens, the offline screen, the error boundary and the first-open onboarding's three screens
 * (off until wave 3; drawn here directly). Appended last, so every earlier screen keeps its place in the parts.
 */
/** A signed-in player's account, as the account screens draw it (wave 1 sign-up screens). */
export const ACCOUNT_FIXTURE = {
  kind: "account" as const,
  userId: "00000000-0000-4000-8000-000000000042",
  username: "TheInventor",
  colour: 4,
  playerNumber: 42,
  founding: true,
  country: "GB",
  createdAt: "2026-11-10T12:00:00.000Z",
  status: "active",
  isUnder18: false,
  deletion: null,
  rename: { kind: "free" as const },
  email: "inventor@example.com",
};

/**
 * The account screens (wave 1 sign-up screens, docs/mockups/wave-1/ S1–S6): every step of the sign-up through the
 * check-only window.__DUELZ_ACCOUNT_FIXTURE__, Settings → Account, and the save-your-progress sheet and pop-up.
 * Appended last, so the screens before them keep their places in split checks.
 */
export const ACCOUNT_SCREENS = (): ThemeScreen[] => {
  const flow = (name: string, fixture: Record<string, unknown>, extra: Partial<ThemeScreen> = {}): ThemeScreen => ({
    name: `account, ${name}`,
    mode: "account",
    plain: true,
    globals: { __DUELZ_ACCOUNT_FIXTURE__: fixture },
    ...extra,
  });
  const card = { email: "inventor@example.com", username: "TheInventor", colour: 4, dob: { d: "14", m: "3", y: "1998" } };
  return [
    flow("sign in", { step: "signin" }),
    flow("email", { step: "email", email: "inventor@example.com" }),
    flow("inbox", { step: "inbox", ...card }),
    flow("username", { step: "username", ...card }),
    flow("username refused", { step: "username", ...card, username: "admin" }),
    flow("birthday", { step: "birthday", ...card }),
    flow("under 13", { step: "under13" }),
    flow("sign-in warning", { step: "warn", email: "inventor@example.com", progress: { rooms: 3, dailies: 2, challenges: 1, practice: 14 } }),
    flow("welcome", { step: "welcome", done: ACCOUNT_FIXTURE }),
    flow("welcome, player number", { step: "welcome", done: { ...ACCOUNT_FIXTURE, founding: false, playerNumber: 1287 } }),
    flow("deletion pending", { step: "deleting", done: { ...ACCOUNT_FIXTURE, deletion: { requestedAt: "2026-11-01T12:00:00.000Z", purgeAt: "2026-12-01T12:00:00.000Z" } } }),
    flow("settings", {}, { globals: { __harnessAccount: ACCOUNT_FIXTURE } }),
    {
      name: "account, save progress sheet",
      mode: "saveprogress",
      plain: true,
      waitMs: 2000,
    },
    {
      name: "account, save progress pop-up",
      mode: "saveprogress",
      plain: true,
      waitMs: 2000,
      globals: { __harnessSaveProgress: { finished: 3, keys: [], sheet: "dismissed", popup: "none", pending: "popup", pendingFrom: "daily" } },
    },
  ];
};

/**
 * The leaderboard screens (wave 4 W4a, docs/leaderboards.md; mockups 01 and 02) on the stand-in answers of
 * scripts/leaderboards-fixture.ts (window.__harnessBoards, served by the harness's board stubs). Appended last, so every
 * earlier screen keeps its place in the parts.
 */
export const LEADERBOARD_SCREENS = (): ThemeScreen[] => [
  { name: "leaderboards, joulz rating", mode: "leaderboards", plain: true, globals: { __harnessBoards: boardsFixture() }, waitMs: 1200 },
  {
    name: "leaderboards, a player's card",
    mode: "leaderboards",
    plain: true,
    globals: { __harnessBoards: boardsFixture() },
    waitMs: 800,
    go: async (page) => {
      await page.locator("[data-board-list] [data-open-card]").first().click();
      await page.locator("[data-card-sheet] [data-player-card]").waitFor({ timeout: 10_000 });
      await page.waitForTimeout(500);
    },
  },
  { name: "leaderboards, no ratings yet", mode: "leaderboards", plain: true, globals: { __harnessBoards: boardsFixture({ empty: true }) }, waitMs: 1200 },
  { name: "daily board, today", mode: "dailyboard", plain: true, globals: { __harnessBoards: boardsFixture() }, waitMs: 1200 },
  { name: "daily board, a guest", mode: "dailyboard", plain: true, globals: { __harnessBoards: boardsFixture({ dailyReason: "guest" }), __harnessBoardsGuest: true }, waitMs: 1200 },
  { name: "daily board, an earlier day", mode: "dailyboard", plain: true, globals: { __harnessBoards: boardsFixture({ dailyFinal: true }) }, query: "day=2026-10-25", waitMs: 1200 },
  // Settings → Account with "Show me on leaderboards" drawn (13 Nov 2026: its description once widened the page past
  // 390 px; it wraps left of its switch, as Friends' setting rows do), for an adult and an under-18.
  ...([
    ["an adult", { show: false, setting: false, adult: true }],
    ["an under-18", { show: false, setting: null, adult: false }],
  ] as const).map(([who, visibility]): ThemeScreen => ({
    name: `account settings, show me on leaderboards, ${who}`,
    mode: "account",
    plain: true,
    globals: { __harnessAccount: ACCOUNT_FIXTURE, __harnessBoards: { ...boardsFixture(), visibility } },
    waitMs: 800,
    go: async (page) => {
      const row = page.locator("[data-board-visibility]");
      await row.waitFor({ timeout: 10_000 });
      await row.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    },
  })),
];

export const WAVE1_SCREENS = (): ThemeScreen[] => [
  { name: "profile, new player, empty states", mode: "profile", records: false },
  { name: "tournaments, nothing played, empty states", mode: "tournaments", records: false },
  { name: "not found", mode: "notfound" },
  {
    name: "room not found",
    mode: "room",
    room: room("waiting", "starting", { join: true }),
    globals: { __harnessPreview: { found: false } },
  },
  {
    name: "challenge not found",
    mode: "challenge",
    challenge: () => {
      const data = challengeFixture("landing");
      return { ...data, challenge: { ...data.challenge, info: { found: false } } };
    },
    search: { code: CHALLENGE_CODE },
  },
  {
    name: "challenge ended",
    mode: "challenge",
    challenge: () => {
      const data = challengeFixture("landing");
      const info = data.challenge.info;
      return { ...data, challenge: { ...data.challenge, info: info.found ? { ...info, state: "closed" as const } : info } };
    },
    search: { code: CHALLENGE_CODE },
  },
  {
    name: "offline, play",
    mode: "home",
    plain: true,
    go: async (page) => {
      // The app's offline worker keeps every public file (Captain Joulz's pictures included); the harness has
      // none, so the pictures are fetched while online, as the worker would have kept them.
      await page.evaluate(() =>
        Promise.all(
          ["/art/captain-joulz-ready.svg", "/art/captain-joulz-win.svg"].map(
            (src) =>
              new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = img.onerror = () => resolve();
                img.src = src;
                (window as unknown as { __keptArt?: HTMLImageElement[] }).__keptArt = [
                  ...((window as unknown as { __keptArt?: HTMLImageElement[] }).__keptArt ?? []),
                  img,
                ];
              }),
          ),
        ),
      );
      // The real OnlineOnly (live on Play) follows the browser's connection.
      await page.context().setOffline(true);
      await page.locator("[data-offline-state]").waitFor({ timeout: 10_000 });
    },
  },
  { name: "error boundary", mode: "error", plain: true },
  ...[1, 2, 3].map(
    (n): ThemeScreen => ({
      name: `first open, screen ${n}`,
      mode: "firstopen",
      plain: true,
      go: async (page) => {
        for (let i = 1; i < n; i++) await page.locator("[data-first-open-next]").click();
        await page.waitForTimeout(450);
      },
    }),
  ),
];

/**
 * Friends (wave 2 B1; Joe's phone check, 11 Nov 2026): the list with every section (requests, invites, online with a
 * lobby's Join, offline, "Show when I'm online", blocked) and a friend's profile, each player drawn with their card,
 * the longest usernames (16 characters). Appended last, so every earlier screen keeps its place in the parts.
 */
export const FRIENDS_SCREENS = (): ThemeScreen[] => {
  const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const at = "2026-10-26T10:00:00.000Z";
  const look = (frame: string, avatar: string, colour: number, badges: string[] = []) => ({
    cardArt: "card-art.bolt-stripes",
    frame,
    nameColour: null,
    avatar: { id: avatar, colour, gem: null },
    title: "rookie",
    badges,
  });
  const card = (n: number, username: string, frame: string, avatar: string) => ({
    id: uid(n),
    username,
    colour: n % 32,
    playerNumber: 100 + n,
    founding: false,
    look: look(frame, avatar, (n * 5) % 32, n === 1 ? ["friendly"] : []),
  });
  const overview = {
    friends: [
      { ...card(1, "Priya_Pattern_99", "frame.gold", "pinball"), since: at, status: { kind: "room", code: "BLTZ", players: 3, maxPlayers: 16 } },
      { ...card(2, "Sam_Speedrunner1", "frame.silver", "apex"), since: at, status: { kind: "playing", code: "QQQQ" } },
      { ...card(3, "Ali", "frame.bronze", "hover"), since: at, status: { kind: "practice" } },
      { ...card(4, "Jo_Wordsmith_007", "frame.plain", "captain-joulz"), since: at, status: { kind: "offline", lastSeen: "2026-10-26T08:00:00.000Z" } },
      { ...card(5, "Mia", "frame.gold", "gemstone"), since: at, status: { kind: "offline", lastSeen: "2026-10-25T09:00:00.000Z" } },
    ],
    incoming: [{ ...card(8, "Kai_Knows_Knots", "frame.silver", "hover"), requestId: uid(80), via: "link", at }],
    outgoing: [],
    invites: [{ ...card(1, "Priya_Pattern_99", "frame.gold", "pinball"), code: "BLTZ", at }],
    challenges: [],
    blocked: [{ id: uid(11), username: "Not_A_Friend" }],
    count: 5,
    cap: 200,
    showOnline: true,
    showOnlineSetting: null,
    adult: true,
  };
  const profile = {
    card: card(1, "Priya_Pattern_99", "frame.gold", "pinball"),
    relation: "friends",
    requestId: null,
    status: { kind: "online" },
    headToHead: { matches: 12, wins: 7, losses: 5, draws: 0, last: ["win", "win", "loss", "win", "loss"], best: { game: "wordsearch", wins: 4, played: 4 } },
    myRoom: { code: "MINE" },
  };
  const globals = { __harnessFriends: { account: { ...ACCOUNT_FIXTURE, rename: { free: true } }, overview, profile } };
  return [
    { name: "friends, list", mode: "friends", plain: true, globals },
    { name: "friends, a friend's profile", mode: "friends", plain: true, globals, search: { player: uid(1) } },
  ];
};

/**
 * Customise's Games tab (12 Nov 2026): the card back, game skins and world themes an account owns, each with its
 * picture, and the empty tab (nothing owned). The longest item names on purpose (Apex: Neon Night's game, Neon ball
 * set, Crimson Velvet). Appended last, so every earlier screen keeps its place in the parts.
 */
export const CUSTOMISE_SCREENS = (): ThemeScreen[] => {
  const catalogue = (JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: unknown[] }).items;
  const owns = [
    "card-back.holo-foil",
    "card-back.royal-damask",
    "card-back.neon",
    "game-skin.apex.molten-gold",
    "world-theme.apex.neon-night",
    "game-skin.cue-ball.neon-ball-set",
    "world-theme.cue-ball.neon-table",
    "game-skin.full-house.crimson-velvet",
    "game-skin.curl-champ.neon-stones",
    "world-theme.curl-champ.neon-rink",
  ];
  const fixture = (owned: string[], slots: Record<string, string>) => ({
    __harnessCustomise: { account: { ...ACCOUNT_FIXTURE, playerNumber: 1 }, catalogue, owned, slots },
  });
  const games = async (page: Page) => {
    await page.locator("[data-customise-tab='games']").click();
    await page.locator("[data-look-section='card-back']").waitFor({ timeout: 10_000 });
    await page.waitForTimeout(400);
  };
  return [
    {
      name: "customise, games",
      mode: "customise",
      plain: true,
      globals: fixture(owns, { "card-back": "card-back.holo-foil", "world-theme:pool": "world-theme.cue-ball.neon-table" }),
      go: games,
    },
    { name: "customise, games, nothing owned", mode: "customise", plain: true, globals: fixture([], {}), go: games },
  ];
};

/**
 * The rated match screens (wave 3, W3c, 12 Nov 2026): Home's rank panel (placed and in placement), searching, VS (live
 * and recorded), the live header's two scores (shown and hidden), the result (won, lost, a placement match, ratings
 * frozen), the placement reveal, the tier ladder and Profile's rating panel, from scripts/rated-fixture.tsx with
 * 16-character names. Appended last, so every earlier screen keeps its place in the parts.
 */
export const RATED_SCREENS = (): ThemeScreen[] =>
  (
    [
      "home",
      "home-placement",
      "searching",
      "vs-live",
      "vs-recorded",
      "header",
      "result-won",
      "result-lost",
      "result-placement",
      "result-frozen",
      "reveal",
      "tiers",
      "profile",
      "result-forfeit-stayed",
      "result-forfeit-left",
      "aborted",
    ] as const
  ).map((screen) => ({ name: `rated, ${screen.replaceAll("-", " ")}`, mode: "rated" as const, plain: true, globals: { __harnessRated: { screen } } }));

/** The other sizes every screen changed from 13 Nov 2026 is drawn at (ThemeScreen.sizes): with VIEWPORTS, all six. */
export const ALL_SIZES: ThemeViewport[] = [
  { name: "390x844", w: 390, h: 844 },
  { name: "tablet 820x1180", w: 820, h: 1180 },
  { name: "desktop 1366x768", w: 1366, h: 768, desktop: true },
  { name: "desktop 1920x1080", w: 1920, h: 1080, desktop: true },
];
/**
 * The Pass (the Shop tab's Pass part; Joules rework, 13 Nov 2026: its "where Joules come from" line changed), a
 * tester's pass at level 12 from scripts/pass-fixture.ts, with and without the premium track, at every size.
 * Appended last, so every earlier screen keeps its place in the parts.
 */
export const PASS_SCREENS = (): ThemeScreen[] => [
  { name: "pass, a tester at level 12", mode: "pass", plain: true, globals: { __harnessPass: passFixture() }, waitMs: 800, sizes: ALL_SIZES },
  { name: "pass, premium", mode: "pass", plain: true, globals: { __harnessPass: passFixture({ premium: true }) }, waitMs: 800, sizes: ALL_SIZES },
];

/**
 * One identity everywhere (13 Nov 2026): the room screens drawn with real cards (window.__harnessRoomCards, by seat): a
 * full room of 10 with long names, me (slot 1) wearing every card cosmetic with badges and a tier, an under-18 account
 * (slot 2: shown with their card inside their own room), a third account, and guests (colour and initial); the chat
 * sheet open with their messages. Outside the room a hidden under-18 is drawn by the Daily top 100's screens
 * (LEADERBOARD_SCREENS). Every size: VIEWPORTS plus ALL_SIZES. Appended last.
 */
export const ROOM_IDENTITY_SCREENS = (): ThemeScreen[] => {
  const card = (colour: number, extra: Record<string, unknown> = {}) => ({
    avatarId: "captain-joulz",
    colour,
    gem: null,
    cardArt: "card-art.joulz-navy",
    frame: "frame.plain",
    nameColour: null,
    badges: [],
    title: "rookie",
    ...extra,
  });
  const cards = {
    p1: { card: card(7, { cardArt: "card-art.grid", frame: "frame.gold", nameColour: "name-colour.gold-leaf", badges: ["friendly", "founding-player", "first-star"] }), playerNumber: 42, tier: "volt" },
    p2: { card: card(12, { frame: "frame.neon-circuit" }), playerNumber: 44, tier: null },
    p3: { card: card(20, { cardArt: "card-art.bolt-stripes" }), playerNumber: 45, tier: "top500" },
  };
  const at = "2026-10-26T10:00:00.000Z";
  const messages = [1, 2, 3, 5].map((slot, i) => ({
    id: `m${i}`,
    duel_id: "duel-theme",
    sender_user_id: `u${slot}`,
    sender_name: NAMES[slot - 1] ?? `Player ${slot}`,
    text: ["Good luck everyone!", "That last round was close", "gg", "Rematch after this?"][i]!,
    created_at: at,
  }));
  const globals = { __harnessRoomCards: cards };
  return [
    { name: "identity: lobby, 10 players with cards", mode: "room", room: room("waiting", "starting", { players: 10 }), globals, sizes: ALL_SIZES, waitMs: 1500 },
    { name: "identity: round leaderboard, 10 players with cards", mode: "room", room: room("in_progress", "result", { players: 10, rounds: 2 }), globals, sizes: ALL_SIZES, waitMs: 2500 },
    { name: "identity: standings, 10 players with cards", mode: "room", room: room("in_progress", "standings", { players: 10, rounds: 2 }), globals, sizes: ALL_SIZES, waitMs: 2500 },
    { name: "identity: podium, 10 players with cards", mode: "room", room: room("finished", "result", { players: 10, rounds: 6 }), globals, sizes: ALL_SIZES, waitMs: 3000 },
    { name: "identity: final results, 2 players with cards", mode: "room", room: room("finished", "result", { rounds: 6 }), globals, sizes: ALL_SIZES, waitMs: 3000 },
    {
      name: "identity: chat with mini cards",
      mode: "room",
      room: room("in_progress", "standings", { players: 10, rounds: 2 }),
      globals: { ...globals, __harnessChatMessages: messages, __harnessChatOpen: true },
      sizes: ALL_SIZES,
      waitMs: 2500,
    },
    {
      name: "identity: a player's card opened from standings",
      mode: "room",
      room: room("in_progress", "standings", { players: 10, rounds: 2 }),
      globals,
      sizes: ALL_SIZES,
      waitMs: 2500,
      go: async (page) => {
        await page.locator("[data-open-card]").first().click();
        await page.locator("[data-card-sheet]").waitFor({ timeout: 10_000 });
        await page.waitForTimeout(400);
      },
    },
  ];
};

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
    // Changed with Joe's approval, 13 Nov 2026: Profile's "Your look" is retired, so the colour wheel is drawn where a
    // guest now picks their colour, the lobby (a 2-player room; the 16-player wheel is drawn above).
    name: "lobby, colour wheel",
    mode: "room",
    // Stored colours (a database with the colour/icon columns): the lobby's picker shows only then.
    room: room("waiting", "starting", { colours: (slot) => (slot - 1) * 5 }),
    go: async (page) => {
      await page.locator("[data-look-toggle]").click();
      await page.locator("[data-colour-wheel]").waitFor({ timeout: 10_000 });
      await page.waitForTimeout(300);
    },
  },
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
  // Room settings (31 Oct 2026): a guest's summary line under the code, the host's sheet with each preset
  // and with the round count capped by the picks.
  {
    name: "lobby, guest's settings summary",
    mode: "room",
    room: room("waiting", "starting", { host: "u2", players: 3, settings: ["pattern", "logic", "retro", "sports", "rounds:9"] }),
  },
  ...(["mixed", "puzzles", "arcade"] as const).map((preset) => ({
    name: `room settings sheet, ${preset === "mixed" ? "Mixed" : preset === "puzzles" ? "Puzzles only" : "Arcade only"}`,
    mode: "room" as const,
    room: room("waiting", "starting", { players: 3 }),
    go: async (page: Page) => {
      await page.locator("[data-room-settings]").click();
      await page.locator("[data-room-settings-sheet]").waitFor({ timeout: 10_000 });
      await page.locator(`[data-room-preset='${preset}']`).click();
      await page.waitForTimeout(250);
    },
  })),
  {
    name: "room settings sheet, capped rounds",
    mode: "room",
    room: room("waiting", "starting", { players: 3 }),
    go: async (page) => {
      await page.locator("[data-room-settings]").click();
      await page.locator("[data-room-settings-sheet]").waitFor({ timeout: 10_000 });
      await page.locator("[data-room-preset='arcade']").click();
      for (const pick of ["retro", "sports", "action", "strategy"]) await page.locator(`[data-room-pick='${pick}']`).click();
      // The count drops to the picks' cap by itself (Cards & Board's five games since Full House retired, 1 Nov
      // 2026, so the 6 button is disabled too).
      await page.waitForTimeout(250);
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
  ...ROOM_16_SCREENS(),
  ...WAVE1_SCREENS(),
  ...ACCOUNT_SCREENS(),
  ...FRIENDS_SCREENS(),
  ...CUSTOMISE_SCREENS(),
  ...RATED_SCREENS(),
  ...LEADERBOARD_SCREENS(),
  ...PASS_SCREENS(),
  ...ROOM_IDENTITY_SCREENS(),
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
/** Every draw of these screens: each at VIEWPORTS[index], then each screen's extra sizes after all of them. */
export function themeDraws(screens: ThemeScreen[], viewports: ThemeViewport[]): { viewport: ThemeViewport; screen: ThemeScreen }[] {
  return [
    ...viewports.flatMap((viewport) => screens.map((screen) => ({ viewport, screen }))),
    ...screens.flatMap((screen) => (screen.sizes ?? []).map((viewport) => ({ viewport, screen }))),
  ];
}

/** The device's own records: a public game today, room history and practice bests. */
function deviceInit(seed: { records: boolean; onboarding: string; bests: [string, number][] }) {
  try {
    localStorage.setItem(seed.onboarding, "1");
    // A brand-new device (wave 1's empty states): no room history, bests or public games.
    if (!seed.records) return;
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
  if (screen.globals)
    await context.addInitScript((globals) => {
      Object.assign(window, globals);
    }, screen.globals);
  await context.addInitScript(deviceInit, {
    records: screen.records !== false,
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
