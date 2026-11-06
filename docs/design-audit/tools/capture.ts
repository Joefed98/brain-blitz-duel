/**
 * Design audit screenshots (6 Nov 2026; a design tool, not a check, and nothing in the app is changed).
 *
 * Draws every audited screen through the repo's screen harness (scripts/safe-area-harness.tsx: the real
 * routes, components and CSS, only the network edge stubbed) on the fixed clock (Mon 26 Oct 2026), at
 * 390×844 (2×, a 47/34 px notch and home bar emulated) and the key screens at 1440×900 (1×, mouse).
 * Files: docs/design-audit/screenshots/<area>/<area>_<screen>_<state>_<size>.png
 *
 *   bun docs/design-audit/tools/capture.ts [name filters…] [--out=docs/design-audit/screenshots]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser, BrowserContext, Page } from "playwright";

import { startSafeAreaServer } from "../../../scripts/safe-area-server";
import { dailyFixture } from "../../../scripts/daily-fixture";
import { CHALLENGE_CODE, challengeFixture } from "../../../scripts/challenge-fixture";
import {
  CHALLENGE_SCREENS,
  CHROMIUM_PATHS,
  fixThemeClock,
  openThemeScreen,
  room,
  THEME_SCREENS,
  type ThemeScreen,
  type ThemeViewport,
} from "../../../scripts/theme-screens";
import { roomRound } from "../../../scripts/desktop-layout-screens";
import { INTRO_MS } from "../../../src/lib/duel/types";
import { ONBOARDING_KEY } from "../../../src/lib/onboarding";
import { PRACTICE_BEST_PREFIX } from "../../../src/lib/duel/practiceBest";
import { GOOGLE_FONTS_CSS } from "../../../src/lib/offline/assets";

const args = process.argv.slice(2);
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6) ?? "docs/design-audit/screenshots";
const ONLY = args.filter((a) => !a.startsWith("--"));
const PART = args.find((a) => a.startsWith("--part="))?.slice(7).split("/").map(Number) as [number, number] | undefined;

const PHONE: ThemeViewport = { name: "390x844", w: 390, h: 844, scale: 2 };
const DESKTOP: ThemeViewport = { name: "1440x900", w: 1440, h: 900, desktop: true };

/* -------------------------------------------------------------------- overrides */

/** Set in the page before the harness: stub answers and storage the theme fixtures don't cover. */
interface Override {
  /** localStorage keys (prefixes) the fixtures' seeding may not write: a new device. */
  block?: string[];
  /** Extra localStorage, written before the page's scripts. */
  storage?: Record<string, string>;
  /** The Play tab's Rejoin card's room (H.rejoin). */
  rejoin?: { code: string; status: string; players: number };
  /** The link join's preview (H.preview). */
  preview?: unknown;
  /** The public schedule (empty: none scheduled). */
  schedule?: unknown[];
  /** useRoomChat's state: messages, reactions, open sheet, a live toast. */
  chat?: { messages?: unknown[]; reactions?: boolean; sheetOpen?: boolean; incoming?: unknown };
  /** useDuel: the loading state. */
  loading?: boolean;
  /** navigator.share / canShare stubbed, so the podium's Share hands over the card (window.__sharedCard). */
  share?: boolean;
  /** Set for every shot: the app's Google Fonts stylesheet. */
  fontsCss?: string;
}

function overrideInit(o: Override) {
  // The app root's Google Fonts stylesheet (src/routes/__root.tsx, GOOGLE_FONTS_CSS: Space Grotesk, Inter,
  // JetBrains Mono, Press Start 2P), which the harness page leaves out: the game screens use these faces.
  document.addEventListener("DOMContentLoaded", () => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = o.fontsCss!;
    document.head.appendChild(l);
  });
  try {
    const realSet = Storage.prototype.setItem;
    if (o.block?.length)
      Storage.prototype.setItem = function (key: string, value: string) {
        if (o.block!.some((b) => key.startsWith(b))) return;
        return realSet.call(this, key, value);
      };
    for (const [k, v] of Object.entries(o.storage ?? {})) realSet.call(localStorage, k, v);
    if (o.schedule) (window as unknown as { __DUELZ_PUBLIC_GAMES__: unknown }).__DUELZ_PUBLIC_GAMES__ = o.schedule;
  } catch {
    /* ignore */
  }
  if (o.share) {
    const nav = navigator as unknown as Record<string, unknown>;
    nav.canShare = () => true;
    nav.share = async (data: { files?: File[] }) => {
      const file = data.files?.[0];
      if (file)
        (window as unknown as { __sharedCard: string }).__sharedCard = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.readAsDataURL(file);
        });
    };
  }
  let harness: Record<string, unknown> | undefined;
  Object.defineProperty(window, "__harness", {
    configurable: true,
    get: () => harness,
    set: (h: Record<string, unknown>) => {
      harness = h;
      if (o.rejoin) h.rejoin = o.rejoin;
      if (o.preview) h.preview = o.preview;
      let call: ((m: string, n: string, a: unknown[]) => unknown) | undefined;
      Object.defineProperty(h, "call", {
        configurable: true,
        set: (fn) => (call = fn),
        get: () => (m: string, n: string, a: unknown[]) => {
          const real = call!(m, n, a) as (...x: unknown[]) => Record<string, unknown>;
          if (n === "useRoomChat" && o.chat) {
            const c = o.chat;
            return (...x: unknown[]) => {
              const base = real(...x);
              const now = Date.now();
              return {
                ...base,
                messages: c.messages ?? [],
                unread: (c.messages ?? []).length ? 2 : 0,
                sheetOpen: !!c.sheetOpen,
                incoming: c.incoming ?? base.incoming,
                reactions: c.reactions
                  ? [
                      { id: "x1", emoji: "🔥", name: "Sam", userId: "u3", at: now },
                      { id: "x2", emoji: "😂", name: "Priya", userId: "u4", at: now },
                    ]
                  : [],
              };
            };
          }
          if (n === "useDuel" && o.loading) return (...x: unknown[]) => ({ ...real(...x), loading: true });
          return real;
        },
      });
    },
  });
}

/* ----------------------------------------------------------------------- shots */

interface Shot {
  /** area_screen_state */
  area: string;
  screen: string;
  state: string;
  base: ThemeScreen;
  desktop?: boolean;
  phone?: boolean;
  override?: Override;
  /** After the page is up (and after base.go). */
  after?: (page: Page) => Promise<void>;
  /** Also save the end of the page's scroll. */
  scrollEnd?: boolean;
  /** Capture the share card the Share button hands over. */
  shareCard?: boolean;
  label: string;
}

type Room = ReturnType<ReturnType<typeof room>>;
const tweak = (make: () => Room, change: (r: Room) => void) => () => {
  const r = make();
  change(r);
  return r;
};
const theme = (name: string): ThemeScreen => {
  const s = [...THEME_SCREENS, ...CHALLENGE_SCREENS].find((x) => x.name === name);
  if (!s) throw new Error(`no theme screen "${name}"`);
  return s;
};
const NEW_DEVICE: Override = { block: [ONBOARDING_KEY, "duelz-room-history:v1", PRACTICE_BEST_PREFIX] };
const NEW_DEVICE_ONBOARDED: Override = { block: ["duelz-room-history:v1", PRACTICE_BEST_PREFIX] };
const REJOIN: Override = {
  storage: { "duelz-last-room:v1": JSON.stringify({ code: "ABCD", at: Date.now() - 60_000 }) },
  rejoin: { code: "ABCD", status: "waiting", players: 3 },
};
const now = () => Date.now();
const MESSAGES = [
  { id: "m1", duel_id: "duel-theme", sender_user_id: "u3", sender_name: "Sam", text: "gl everyone 👋", created_at: new Date(now() - 90_000).toISOString() },
  { id: "m2", duel_id: "duel-theme", sender_user_id: "u2", sender_name: "Another long player name", text: "That Box Six was brutal", created_at: new Date(now() - 60_000).toISOString() },
  { id: "m3", duel_id: "duel-theme", sender_user_id: "u1", sender_name: "Me with a long name", text: "Rematch after this?", created_at: new Date(now() - 30_000).toISOString() },
  { id: "m4", duel_id: "duel-theme", sender_user_id: "u4", sender_name: "Priya", text: "yes!! one more", created_at: new Date(now() - 5_000).toISOString() },
];

/** The intro, `goInMs` before GO from the moment the fixture is built. */
const introAt = (goInMs: number, players = 4, arcade = false) =>
  tweak(room("in_progress", "intro", { players, arcade }), (r) => {
    const start = Date.now() - (INTRO_MS - goInMs);
    r.duel.phase_started_at = new Date(start).toISOString();
    r.duel.round_started_at = new Date(start).toISOString();
    r.results = [];
  });
const revealWith = (score: number, arcade = false) =>
  tweak(room("in_progress", "result", { players: 4, arcade }), (r) => {
    r.duel.phase = "reveal";
    r.results = r.results.map((row) => (row.player_slot === 1 ? { ...row, score } : row));
  });
const tieStandings = tweak(room("in_progress", "standings", { players: 6, rounds: 2 }), (r) => {
  // Slots 2 and 3 level on total; slots 5 and 6 level too.
  const fix: Record<number, [number, number]> = { 1: [150, 140], 2: [130, 120], 3: [125, 125], 4: [110, 100], 5: [90, 80], 6: [100, 70] };
  r.results = r.results.map((row) => ({ ...row, score: fix[row.player_slot]![row.round_number - 1]! }));
});
const zeroRound = tweak(room("in_progress", "result", { players: 4, rounds: 2 }), (r) => {
  r.results = r.results.map((row) => (row.player_slot === 1 && row.round_number === 2 ? { ...row, score: 0, is_correct: false } : row));
});
const someoneLeft = (phase: string) =>
  tweak(room("in_progress", phase, { players: 4, rounds: 2 }), (r) => {
    r.players[2] = { ...r.players[2]!, status: "left" };
  });
const whitewash = tweak(room("finished", "result", { players: 4, rounds: 6 }), (r) => {
  r.results = r.results.map((row) => ({ ...row, score: row.player_slot === 1 ? 200 : 60 + row.player_slot * 5 }));
});
const lobbyLeft = tweak(room("waiting", "starting", { players: 4 }), (r) => {
  r.players[3] = { ...r.players[3]!, status: "left" };
});

const openSheet = (sel: string, sheet: string) => async (page: Page) => {
  await page.locator(sel).first().click();
  await page.locator(sheet).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(400);
};
const offline = async (page: Page) => {
  await page.context().setOffline(true);
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-offline", "");
    window.dispatchEvent(new Event("offline"));
  });
  await page.waitForTimeout(800);
};
/** The updater's overlay (src/components/app/AppUpdateOverlay.tsx) is mounted by the app root only, which the
 * harness does not draw: the same markup and classes are put on the page as the root would draw them. */
const updating = async (page: Page) => {
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.setAttribute("role", "status");
    d.setAttribute("data-app-updating", "");
    d.className = "fixed inset-0 z-[1000] flex items-center justify-center bg-background/90 font-display text-lg font-bold uppercase tracking-wide text-foreground";
    d.textContent = "Updating…";
    document.body.appendChild(d);
  });
  await page.waitForTimeout(300);
};

/** Re-fires a hero moment through the page's own celebrations module (as scripts/celebrations-browser.ts does)
 * and waits `ms` into it: the reveal plays it once on open, before a screenshot can settle. */
const hero = (fn: "heroRun" | "heroDance" | "heroGrand", ms: number) => async (page: Page) => {
  await page.evaluate(`import("/src/lib/fx/celebrations.ts").then((C) => { const scope = C.celebrationScope(); C.${fn}(scope, document.querySelector("[data-hero-spot]")); })`);
  await page.waitForTimeout(ms);
};

const S: Shot[] = [
  // ---------------------------------------------------------------- Play
  { area: "play", screen: "home", state: "first-visit", label: "Play: first visit (intro card)", base: { name: "play first", mode: "home", daily: () => dailyFixture().before, challenge: () => challengeFixture("create") }, override: NEW_DEVICE, desktop: true, scrollEnd: true },
  { area: "play", screen: "home", state: "returning", label: "Play: returning player", base: theme("play"), desktop: true, scrollEnd: true },
  { area: "play", screen: "home", state: "rejoin", label: "Play: Rejoin your last room", base: theme("play"), override: REJOIN },
  { area: "play", screen: "home", state: "home-screen-hint", label: "Play: Add to Home Screen hint (iPhone Safari)", base: theme("play, Add to Home Screen hint") },
  { area: "play", screen: "home", state: "no-public-game", label: "Play: nothing scheduled", base: theme("play"), override: { schedule: [] } },
  { area: "play", screen: "onboarding", state: "how-it-works", label: "First-time intro: How it works panels", base: { name: "play first", mode: "home", daily: () => dailyFixture().before }, override: NEW_DEVICE, after: async (p) => { const b = p.getByRole("button", { name: /how it works/i }).first(); if (await b.count()) { await b.click(); await p.waitForTimeout(700); } } },
  { area: "play", screen: "terms", state: "first-room", label: "Beta terms (before a first room)", base: theme("beta terms"), scrollEnd: true },
  // ------------------------------------------------------------- Practice
  { area: "practice", screen: "list", state: "puzzles", label: "Practice: Puzzles side", base: theme("practice list"), desktop: true, scrollEnd: true },
  { area: "practice", screen: "list", state: "arcade", label: "Practice: Arcade side", base: theme("practice list, arcade side"), desktop: true, scrollEnd: true },
  { area: "practice", screen: "list", state: "new-device", label: "Practice: no bests yet", base: theme("practice list"), override: NEW_DEVICE_ONBOARDED },
  { area: "practice", screen: "list", state: "filter-logic", label: "Practice: Logic chip", base: { ...theme("practice list"), go: (p) => p.locator("[data-practice-filter='logic']").first().click() } },
  { area: "practice", screen: "list", state: "search", label: "Practice: search \"ra\"", base: { ...theme("practice list"), go: (p) => p.getByRole("searchbox").first().fill("ra") } },
  { area: "practice", screen: "list", state: "search-empty", label: "Practice: search, no match", base: { ...theme("practice list"), go: (p) => p.getByRole("searchbox").first().fill("zzqx") } },
  // ---------------------------------------------------------- Tournaments
  { area: "tournaments", screen: "list", state: "with-event", label: "Tournaments: games scheduled", base: theme("tournaments"), desktop: true },
  { area: "tournaments", screen: "list", state: "empty", label: "Tournaments: none scheduled", base: theme("tournaments"), override: { ...NEW_DEVICE_ONBOARDED, schedule: [] } },
  // --------------------------------------------------------------- Profile
  { area: "profile", screen: "profile", state: "new", label: "Profile: new player", base: { name: "profile new", mode: "profile" }, override: NEW_DEVICE_ONBOARDED, scrollEnd: true },
  { area: "profile", screen: "profile", state: "returning", label: "Profile: returning player", base: theme("profile"), desktop: true, scrollEnd: true },
  { area: "profile", screen: "colour-wheel", state: "open", label: "Profile: colour wheel", base: theme("profile, colour wheel") },
  { area: "profile", screen: "settings", state: "open", label: "Settings sheet", base: theme("settings sheet"), desktop: true, scrollEnd: true },
  // ------------------------------------------------------------------ Room
  { area: "room", screen: "lobby", state: "2-players", label: "Lobby, 2 players", base: theme("lobby, 2 players") },
  { area: "room", screen: "lobby", state: "16-players", label: "Lobby, 16 players", base: theme("lobby, 16 players"), desktop: true, scrollEnd: true },
  { area: "room", screen: "lobby", state: "guest", label: "Lobby as a guest (settings summary)", base: theme("lobby, guest's settings summary") },
  { area: "room", screen: "lobby", state: "player-left", label: "Lobby after a player left", base: { name: "lobby left", mode: "room", room: lobbyLeft } },
  { area: "room", screen: "settings-sheet", state: "mixed", label: "Room settings sheet (Mixed)", base: theme("room settings sheet, Mixed"), desktop: true },
  { area: "room", screen: "settings-sheet", state: "capped", label: "Room settings sheet (rounds capped)", base: theme("room settings sheet, capped rounds") },
  { area: "room", screen: "menu", state: "disband-confirm", label: "Room menu: Disband confirm", base: theme("lobby confirm dialog") },
  { area: "room", screen: "menu", state: "player-options", label: "Host's options for a player (mute / remove)", base: { name: "opts", mode: "room", room: room("waiting", "starting", { players: 3 }), go: async (p) => { await p.locator("[aria-label^='Options for Sam']").first().click(); await p.waitForTimeout(400); } } },
  { area: "room", screen: "menu", state: "remove-confirm", label: "Host removes a player: confirm", base: { name: "rm", mode: "room", room: room("waiting", "starting", { players: 3 }), go: async (p) => { await p.locator("[aria-label^='Options for Sam']").first().click(); await p.getByRole("menuitem", { name: /remove/i }).click(); await p.getByRole("alertdialog").waitFor({ timeout: 10_000 }); } } },
  { area: "room", screen: "link-join", state: "open-lobby", label: "Room link: join with a name", base: theme("link join") },
  { area: "room", screen: "link-join", state: "not-found", label: "Room link: room not found", base: theme("link join"), override: { preview: { found: false, roomCode: "SAFE" } } },
  { area: "room", screen: "link-join", state: "full", label: "Room link: room full", base: theme("link join"), override: { preview: { found: true, roomCode: "SAFE", state: "lobby", playerCount: 16, maxPlayers: 16 } } },
  { area: "room", screen: "link-join", state: "finished", label: "Room link: game finished", base: theme("link join"), override: { preview: { found: true, roomCode: "SAFE", state: "finished", playerCount: 4, maxPlayers: 16 } } },
  { area: "room", screen: "loading", state: "loading", label: "Room loading", base: theme("lobby, 2 players"), override: { loading: true } },
  { area: "room", screen: "disbanded", state: "disbanded", label: "Room disbanded", base: { name: "disbanded", mode: "room", room: tweak(room("waiting", "starting", { players: 3 }), (r) => { r.duel.disbanded_at = new Date().toISOString(); }) } },
  { area: "room", screen: "prepare-to-duel", state: "start", label: "Prepare to Duel", base: { name: "prepare", mode: "room", room: room("in_progress", "starting"), waitMs: 1500, plain: true } },
  { area: "room", screen: "round-title", state: "round-1", label: "Round title", base: { name: "title", mode: "room", room: room("in_progress", "round_title"), waitMs: 900, plain: true } },
  { area: "room", screen: "intro", state: "puzzle", label: "Game intro (Box Six, room)", base: { name: "intro", mode: "room", room: introAt(25_000), waitMs: 1200, plain: true }, desktop: true },
  { area: "room", screen: "intro", state: "arcade", label: "Game intro (Gemstone, room)", base: { name: "intro arcade", mode: "room", room: introAt(25_000, 4, true), waitMs: 1500, plain: true } },
  { area: "room", screen: "countdown", state: "3-2-1", label: "3-2-1 countdown", base: { name: "countdown", mode: "room", room: introAt(4_600), waitMs: 0, plain: true } },
  { area: "room", screen: "game-frame", state: "puzzle", label: "Game frame: Box Six live round", base: { ...roomRound("sudoku", false), room: room("in_progress", "puzzle", { players: 4, rounds: 1 }) }, desktop: true },
  { area: "room", screen: "game-frame", state: "arcade", label: "Game frame: Gemstone live round", base: { ...roomRound("matchup", true), room: room("in_progress", "puzzle", { players: 4, arcade: true, rounds: 3 }) }, desktop: true },
  { area: "room", screen: "game-frame", state: "player-left", label: "Live round after a player left", base: { ...roomRound("sudoku", false), room: someoneLeft("puzzle") } },
  { area: "room", screen: "answer-reveal", state: "puzzle", label: "Answer reveal (puzzle)", base: theme("answer reveal (puzzle)") },
  { area: "room", screen: "answer-reveal", state: "arcade", label: "Answer reveal (arcade chart)", base: theme("answer reveal (arcade)"), desktop: true },
  { area: "room", screen: "answer-reveal", state: "arcade-16-breakdown", label: "Arcade reveal, 16 players, four part lines", base: [...THEME_SCREENS].find((s) => s.name.startsWith("answer reveal (arcade), 16"))! },
  { area: "room", screen: "answer-reveal", state: "zero-points", label: "Answer reveal: 0 points", base: { name: "zero", mode: "room", room: revealWith(0), waitMs: 1500, plain: true } },
  { area: "room", screen: "points", state: "2-players", label: "Round results (points), 2 players", base: theme("round leaderboard, 2 players") },
  { area: "room", screen: "points", state: "10-players", label: "Round results (points), 10 players", base: theme("round leaderboard, 10 players") },
  { area: "room", screen: "points", state: "16-players", label: "Round results (points), 16 players", base: theme("round leaderboard, 16 players"), scrollEnd: true },
  { area: "room", screen: "points", state: "zero", label: "Round results with a 0", base: { name: "zero", mode: "room", room: zeroRound, waitMs: 2500 } },
  { area: "room", screen: "standings", state: "10-players", label: "Standings, 10 players", base: theme("standings, 10 players") },
  { area: "room", screen: "standings", state: "tie", label: "Standings with ties", base: { name: "tie", mode: "room", room: tieStandings, waitMs: 2800 } },
  { area: "room", screen: "standings", state: "16-players", label: "Standings, 16 players", base: theme("standings, 16 players"), desktop: true, scrollEnd: true },
  { area: "room", screen: "standings", state: "player-left", label: "Standings after a player left", base: { name: "left", mode: "room", room: someoneLeft("standings"), waitMs: 2800 } },
  { area: "room", screen: "podium", state: "10-players", label: "Podium, 10 players", base: theme("podium, 10 players"), desktop: true, scrollEnd: true },
  { area: "room", screen: "podium", state: "16-players", label: "Podium, 16 players", base: theme("podium, 16 players"), scrollEnd: true },
  { area: "room", screen: "final", state: "2-players", label: "Two-player final", base: theme("final results, 2 players"), scrollEnd: true },
  { area: "room", screen: "chat", state: "sheet", label: "Chat sheet with messages and reactions", base: theme("lobby, 2 players"), override: { chat: { messages: MESSAGES, sheetOpen: true } } },
  { area: "room", screen: "chat", state: "reactions", label: "Floating reactions over the lobby", base: { ...theme("lobby, 10 players") }, override: { chat: { messages: MESSAGES, reactions: true } }, after: async (p) => p.waitForTimeout(150) },
  { area: "room", screen: "chat", state: "toast", label: "Chat toast between rounds", base: { name: "toast", mode: "room", room: room("in_progress", "standings", { players: 4, rounds: 2 }), waitMs: 2500 }, override: { chat: { messages: MESSAGES, incoming: MESSAGES[3] } } },
  // ------------------------------------------------------- Daily and challenge
  { area: "daily", screen: "daily", state: "puzzle-before", label: "Daily Puzzle, before playing", base: theme("daily, before playing"), desktop: true },
  { area: "daily", screen: "daily", state: "arcade-before", label: "Daily Arcade, before playing", base: { ...theme("daily, before playing"), go: async (p) => { await p.locator("[data-daily-tab='arcade']").first().click(); await p.waitForTimeout(500); } } },
  { area: "daily", screen: "daily", state: "puzzle-board", label: "Daily Puzzle, board after playing", base: theme("daily, board after playing"), scrollEnd: true },
  { area: "daily", screen: "daily", state: "arcade-board", label: "Daily Arcade, board after playing", base: { ...theme("daily, board after playing"), go: async (p) => { await p.locator("[data-daily-tab='arcade']").first().click(); await p.waitForTimeout(500); } } },
  { area: "daily", screen: "results", state: "done", label: "Daily results", base: theme("daily results"), scrollEnd: true },
  { area: "challenge", screen: "make", state: "pick", label: "Challenge: make one", base: theme("challenge, make one"), scrollEnd: true },
  { area: "challenge", screen: "link", state: "opened", label: "Challenge: friend opens the link", base: theme("challenge, link opened") },
  { area: "challenge", screen: "round-results", state: "after-round-1", label: "Challenge: round leaderboard", base: theme("challenge, round leaderboard") },
  { area: "challenge", screen: "standings", state: "after-round-1", label: "Challenge: standings", base: theme("challenge, standings") },
  { area: "challenge", screen: "podium", state: "finished", label: "Challenge: podium", base: theme("challenge, podium"), scrollEnd: true },
  { area: "challenge", screen: "creator", state: "link-to-send", label: "Challenge: creator's results and link", base: theme("challenge, creator's results") },
  { area: "challenge", screen: "error", state: "not-found", label: "Challenge link not found", base: { name: "nf", mode: "challenge", search: { code: "ZZZZZZ" }, waitMs: 1500 } },
  { area: "share", screen: "card", state: "room-podium", label: "Share card (room podium)", base: theme("podium, 10 players"), override: { share: true }, shareCard: true },
  // ------------------------------------------------------- Celebrations and Hero
  { area: "celebrations", screen: "reveal", state: "150-hero-run", label: "Reveal 150: the hero run", base: { name: "r150", mode: "room", room: revealWith(150), waitMs: 2600, plain: true }, after: hero("heroRun", 500) },
  { area: "celebrations", screen: "reveal", state: "190-hero-dance", label: "Reveal 190: the hero dance", base: { name: "r190", mode: "room", room: revealWith(190), waitMs: 3000, plain: true }, after: hero("heroDance", 800) },
  { area: "celebrations", screen: "reveal", state: "200-hero-grand", label: "Reveal 200: the grand lap and fireworks", base: { name: "r200", mode: "room", room: revealWith(200), waitMs: 2400, plain: true }, after: hero("heroGrand", 1250) },
  { area: "celebrations", screen: "reveal", state: "200-fireworks-late", label: "Reveal 200, later in the lap", base: { name: "r200b", mode: "room", room: revealWith(200), waitMs: 3600, plain: true }, after: hero("heroGrand", 2050) },
  { area: "celebrations", screen: "podium", state: "winner-hero", label: "Podium: the winner's hero and burst", base: { ...theme("podium, 10 players"), waitMs: 1200 } },
  { area: "celebrations", screen: "podium", state: "whitewash", label: "Podium after a whitewash (200 every round)", base: { name: "ww", mode: "room", room: whitewash, waitMs: 3500 } },
  { area: "celebrations", screen: "winner-reveal", state: "reveal", label: "Winner reveal", base: { name: "wr", mode: "room", room: room("in_progress", "winner_reveal", { players: 4, rounds: 6 }), waitMs: 1200, plain: true } },
  // --------------------------------------------------------------- States
  { area: "states", screen: "offline", state: "play", label: "Offline: Play tab", base: theme("play"), after: offline },
  { area: "states", screen: "offline", state: "practice", label: "Offline: Practice (banner)", base: theme("practice list"), after: offline },
  { area: "states", screen: "offline", state: "room", label: "Offline: in a room lobby", base: theme("lobby, 2 players"), after: offline },
  { area: "states", screen: "offline", state: "daily", label: "Offline: Daily", base: theme("daily, before playing"), after: offline },
  { area: "states", screen: "update", state: "updating", label: "Update available: the Updating… overlay", base: theme("play"), after: updating },
  { area: "states", screen: "error", state: "challenge-not-found", label: "Error: challenge not found", base: { name: "nf", mode: "challenge", search: { code: "ZZZZZZ" }, waitMs: 1500 } },
];

/* ------------------------------------------------------------------------ run */

const fileOf = (s: Shot, size: string, suffix = "") =>
  `${s.area}_${s.screen}_${s.state}${suffix}_${size}.png`.replace(/[^a-z0-9_.-]+/gi, "-").toLowerCase();

async function insets(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: { top: 47, bottom: 34, left: 0, right: 0 } } as never).catch(() => {});
  await page.waitForTimeout(250);
}

fixThemeClock();
const CHROMIUM = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
const server = await startSafeAreaServer({ cacheDir: `node_modules/.vite-design-audit${PART ? PART[0] : ""}`, buildId: "design-audit" });
const { chromium } = await import("playwright");
const browser: Browser = await chromium.launch({ executablePath: CHROMIUM });
const index: { file: string; area: string; label: string; size: string }[] = [];
const misses: string[] = [];
try {
  // Warm the cold dev server once.
  {
    const { context } = await openThemeScreen(browser, server.origin, theme("play"), PHONE).catch(() => ({ context: null as unknown as BrowserContext }));
    await context?.close();
  }
  const todo = S.filter((s) => !ONLY.length || ONLY.some((o) => fileOf(s, "").includes(o))).filter((_, i) => !PART || i % PART[1] === PART[0] - 1);
  for (const shot of todo)
    for (const vp of [...(shot.phone === false ? [] : [PHONE]), ...(shot.desktop ? [DESKTOP] : [])]) {
      const dir = join(OUT, shot.area);
      mkdirSync(dir, { recursive: true });
      let context: BrowserContext | null = null;
      try {
        const opened = await openThemeScreen(browser, server.origin, shot.base, vp, async (c) => {
          await c.addInitScript(overrideInit, { ...shot.override, fontsCss: GOOGLE_FONTS_CSS });
        });
        context = opened.context;
        const page = opened.page;
        await page.waitForTimeout(400);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        if (!vp.desktop) await insets(page);
        if (shot.after) await shot.after(page);
        const file = fileOf(shot, vp.name);
        await page.screenshot({ path: join(dir, file) });
        index.push({ file: `${shot.area}/${file}`, area: shot.area, label: shot.label, size: vp.name });
        console.log(file);
        if (shot.scrollEnd) {
          const tall = await page.evaluate(() => {
            const els = [document.scrollingElement!, ...document.querySelectorAll<HTMLElement>("*")].filter(
              (e) => e.scrollHeight - e.clientHeight > 40 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) || e === document.scrollingElement,
            );
            let moved = false;
            for (const e of els)
              if (e.scrollHeight - e.clientHeight > 40) {
                e.scrollTop = e.scrollHeight;
                moved = true;
              }
            return moved;
          });
          if (tall) {
            await page.waitForTimeout(500);
            const end = fileOf(shot, vp.name, "-scrolled");
            await page.screenshot({ path: join(dir, end) });
            index.push({ file: `${shot.area}/${end}`, area: shot.area, label: `${shot.label} (scrolled to end)`, size: vp.name });
            console.log(end);
          }
        }
        if (shot.shareCard && !vp.desktop) {
          await page.getByRole("button", { name: /^share/i }).first().click();
          await page.waitForFunction(() => !!(window as unknown as { __sharedCard?: string }).__sharedCard, null, { timeout: 15_000 });
          const url = await page.evaluate(() => (window as unknown as { __sharedCard: string }).__sharedCard);
          const card = `share_card_result-card_1080x1350.png`;
          writeFileSync(join(dir, card), Buffer.from(url.split(",")[1]!, "base64"));
          index.push({ file: `${shot.area}/${card}`, area: shot.area, label: "Share card image (1080×1350, the PNG attached to the share sheet)", size: "1080x1350" });
          console.log(card);
        }
      } catch (e) {
        const msg = `${fileOf(shot, vp.name)}: ${String(e).split("\n")[0]}`;
        misses.push(msg);
        console.log(`MISS ${msg}`);
      } finally {
        await context?.close();
      }
    }
} finally {
  await browser.close();
  await server.close();
}
const indexFile = join(OUT, PART ? `index-part${PART[0]}.json` : "index.json");
const prior: typeof index = existsSync(indexFile) ? JSON.parse(await Bun.file(indexFile).text()) : [];
const merged = [...prior.filter((p) => !index.some((i) => i.file === p.file)), ...index];
writeFileSync(indexFile, `${JSON.stringify(merged, null, 2)}\n`);
writeFileSync(join(OUT, PART ? `misses-part${PART[0]}.txt` : "misses.txt"), misses.join("\n") + "\n");
console.log(`${index.length} screenshots, ${misses.length} misses`);
