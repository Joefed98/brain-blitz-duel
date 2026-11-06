/**
 * The app shell (18 Oct 2026): the Play home screen and the bottom tab bar (Play, Practice,
 * Tournaments, Profile; src/components/app/AppTabBar.tsx), the game icons and the public-games
 * schedule (src/config/publicGames.ts, src/lib/publicSchedule.ts).
 *
 *  1. The schedule (no browser): UK times convert to the right instant in summer (BST) and winter
 *     (GMT), "Next up" offers Add to calendar before lobby time and Join now from it, past games
 *     drop off, and the calendar file is a valid VEVENT at the right UTC time with no stray text.
 *  2. The real app (its own Vite dev server, headless Chromium, 414 × 896 home-screen app geometry):
 *     the four tabs render, each with the tab bar and its own tab marked current in gold; tapping
 *     each tab navigates (URL and screen); Back from a tab reached from Play returns to Play once;
 *     every active game's practice row has its own icon (canvas painted or SVG art, never the
 *     fallback) and the button is named exactly the game; the Warm up tile opens that game's round;
 *     the tab bar is gone in a practice round's intro and live round; the Next public game card and
 *     Tournaments' Next up switch from "Add to calendar" to "Join now" at lobby time (the page's
 *     clock driven across it), and Join now opens the public room.
 *  3. Room screens (scripts/safe-area-harness.tsx, the real room route with the network stubbed):
 *     the lobby, link join, Prepare to Duel, round intro, round result, standings, winner reveal and
 *     podium never show the tab bar.
 *
 *   bun scripts/app-shell-check.ts [--verbose] [--url=<origin>]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import type { Page } from "playwright";

import { gotoRetried, warmUp } from "./browser-load";
import { DEVICE_INIT, IPHONE11_APP, emulateDevice } from "./device-emulation";
import { startSafeAreaServer } from "./safe-area-server";
import { ONBOARDING_KEY } from "../src/lib/onboarding";
import { calendarFile, nextUpState, scheduledGames, ukTimeToUtcMs, upcomingGames } from "../src/lib/publicSchedule";
import { ACTIVE_PUZZLE_TYPES, PUZZLE_REGISTRY } from "../src/lib/duel/registry";
import type { PublicGameConfig } from "../src/config/publicGames";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const URL_ARG = args.find((a) => a.startsWith("--url="))?.slice(6);
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);
const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, what: string) => {
  if (ok) passes++;
  else failures.push(what);
  if (VERBOSE || !ok) console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
};

/* ------------------------------------------------------------ 1. the schedule */

{
  check(ukTimeToUtcMs("2026-07-04", "19:00") === Date.UTC(2026, 6, 4, 18, 0), "summer: 19:00 UK is 18:00 UTC (BST)");
  check(ukTimeToUtcMs("2026-12-05", "19:00") === Date.UTC(2026, 11, 5, 19, 0), "winter: 19:00 UK is 19:00 UTC (GMT)");
  check(ukTimeToUtcMs("2026-10-25", "09:30") === Date.UTC(2026, 9, 25, 9, 30), "the clocks-back Sunday: 09:30 UK is 09:30 UTC");
  check(ukTimeToUtcMs("2026-03-29", "12:00") === Date.UTC(2026, 2, 29, 11, 0), "the clocks-forward Sunday: 12:00 UK is 11:00 UTC");
  check(Number.isNaN(ukTimeToUtcMs("24/10/2026", "7pm")), "a malformed entry gives no time");
  const config: PublicGameConfig[] = [
    { date: "2026-12-05", time: "19:00", lobbyOpens: "18:45", rounds: 6, roomCode: "play" },
    { date: "2026-12-12", time: "20:00", lobbyOpens: "19:50", rounds: 7, roomCode: "PLAY", title: "Big one" },
    { date: "bad", time: "19:00", lobbyOpens: "18:45", rounds: 6, roomCode: "PLAY" },
  ];
  const games = scheduledGames(config);
  check(games.length === 2 && games[0]!.roomCode === "PLAY", "malformed entries are left out and codes upper-cased");
  const first = games[0]!;
  check(nextUpState(first, first.lobbyAt - 1) === "calendar", "before lobby time: Add to calendar");
  check(nextUpState(first, first.lobbyAt) === "join" && nextUpState(first, first.startsAt - 1) === "join", "from lobby time to the start: Join now");
  check(upcomingGames(first.startsAt, games).length === 1 && upcomingGames(first.startsAt, games)[0] === games[1], "a started game drops off; the next is up");
  const ics = calendarFile(first, "https://example.app");
  check(/BEGIN:VCALENDAR[\s\S]*BEGIN:VEVENT[\s\S]*END:VEVENT[\s\S]*END:VCALENDAR/.test(ics), "the calendar file is a VCALENDAR with one VEVENT");
  check(ics.includes("DTSTART:20261205T190000Z") && ics.includes("DTEND:20261205T200000Z"), "the event starts at the game's UTC time and lasts an hour");
  check(ics.includes("TRIGGER:-PT15M") && ics.includes("https://example.app/duel/PLAY"), "a reminder at lobby time and the room link");
  check(ics.split("\r\n").every((line) => line.length <= 200), "no runaway lines");
}

/* ------------------------------------------------------------ 2. the real app */

if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

const PORT = 5240 + Math.floor(Math.random() * 300);
async function startServer(): Promise<{ origin: string; proc: ChildProcess | null }> {
  if (URL_ARG) return { origin: URL_ARG.replace(/\/$/, ""), proc: null };
  // A 4 GB heap for this check's dev server (4 Nov 2026, #260; 6 GB from #258 until then): the first practice deal
  // compiles about 40 server bank modules at once (dev only), a brief spike past Node's ~2 GB default heap. With the
  // offline pack top-up off in checks (src/lib/offline/packs.ts) the server peaks at ~3.9 GB here; runners have ~7.7 GB.
  const proc = spawn("npx", ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], {
    stdio: "ignore",
    detached: true,
    env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=4096`.trim() },
  });
  const origin = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${origin}/practice`);
      if (r.ok) return { origin, proc };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

/** A public game whose lobby opens at 18:45 UK on 24 Oct 2026 (17:45 UTC), starting 19:00, and one a week later. */
const SCHEDULE: PublicGameConfig[] = [
  { date: "2026-10-24", time: "19:00", lobbyOpens: "18:45", rounds: 6, roomCode: "PUBL" },
  { date: "2026-10-31", time: "19:00", lobbyOpens: "18:45", rounds: 7, roomCode: "PUBL" },
];
const BEFORE_LOBBY = Date.UTC(2026, 9, 24, 17, 44, 30);

const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const { origin, proc } = await startServer();
const tabBar = (page: Page) => page.locator("[data-app-tabbar]").count();
/** The server-rendered page is up before React has hydrated it (a tap before then does nothing): wait for React. */
const hydrated = (page: Page, selector: string) =>
  page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!el && Object.keys(el).some((key) => key.startsWith("__react"));
  }, selector, { timeout: 120_000 });
const currentTab = (page: Page) => page.locator("[data-app-tabbar] [aria-current='page']").getAttribute("data-tab");

/**
 * A cold `vite dev` can reload the page once while it optimises newly found dependencies, destroying the
 * page's execution context mid-setup. Wait for the load, then until the main frame has gone 1 s without
 * navigating (at most 60 s), then for that load: nothing is judged before it.
 */
const RELOADED = /Execution context was destroyed/;
async function settled(page: Page): Promise<void> {
  await page.waitForLoadState("load", { timeout: 120_000 });
  let last = Date.now();
  const navigated = (frame: unknown) => {
    if (frame === page.mainFrame()) last = Date.now();
  };
  page.on("framenavigated", navigated);
  try {
    const until = Date.now() + 60_000;
    while (Date.now() - last < 1_000 && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
  } finally {
    page.off("framenavigated", navigated);
  }
  await page.waitForLoadState("load", { timeout: 120_000 });
}

async function openApp(path: string, opts: { clock?: number } = {}) {
  const context = await browser.newContext({ viewport: { width: IPHONE11_APP.w, height: IPHONE11_APP.h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.addInitScript(DEVICE_INIT);
  await page.addInitScript(
    ([key, schedule]) => {
      localStorage.setItem(key as string, "1");
      // A device that agreed to the beta terms on an earlier visit (beta-extras-check proves the first visit).
      localStorage.setItem("duelz-terms:v1", JSON.stringify({ version: 1, agreedAt: "2026-10-20T12:00:00.000Z" }));
      (window as unknown as { __DUELZ_PUBLIC_GAMES__: unknown }).__DUELZ_PUBLIC_GAMES__ = schedule;
    },
    [ONBOARDING_KEY, SCHEDULE] as const,
  );
  if (opts.clock !== undefined) await page.clock.install({ time: opts.clock });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]!));
  // Setup only (no assertion): load, let a cold dev server's reload pass, then the device. If the page
  // still reloads under it ("Execution context was destroyed"), the setup alone is run once more.
  const setup = async () => {
    await gotoRetried(page, `${origin}${path}`, path);
    await settled(page);
    await emulateDevice(page, IPHONE11_APP);
  };
  try {
    await setup();
  } catch (error) {
    if (!RELOADED.test(String((error as Error).message))) throw error;
    console.log(`  ${path}: the page reloaded during setup; setting up once more`);
    await setup();
  }
  return { page, context, errors };
}

try {
  await warmUp(browser, `${origin}/`, async (page) => {
    await page.locator("[data-app-tabbar]").first().waitFor({ timeout: 180_000 });
    // The dev server's optimiser reload, if any, happens here, not under the first real page.
    await settled(page);
    await page.locator("[data-app-tabbar]").first().waitFor({ timeout: 180_000 });
  }, {
    init: () => localStorage.setItem("duelz_onboarding_seen", "1"),
  });
  // Every other tab page the check visits, warmed the same way (unmeasured; nothing judged): a cold dev server
  // compiles each route's own modules on its first request (/practice, every game's tile, takes ~18 s cold here). The waits and assertions below are unchanged.
  for (const [path, heading] of [["/practice", "Practice"], ["/tournaments", "Tournaments"], ["/profile", "Profile"]] as const) {
    await warmUp(browser, `${origin}${path}`, async (page) => {
      await page.getByRole("heading", { level: 1, name: heading }).waitFor({ timeout: 180_000 });
    }, {
      init: () => localStorage.setItem("duelz_onboarding_seen", "1"),
    });
  }

  /* The four tabs, navigation, Back, and the schedule card switching at lobby time. */
  {
    const { page, context, errors } = await openApp("/", { clock: BEFORE_LOBBY });
    try {
      await page.getByRole("button", { name: "Create a room" }).waitFor({ timeout: 60_000 });
      await hydrated(page, "[data-app-tabbar] a");
      check((await tabBar(page)) === 1 && (await currentTab(page)) === "play", "Play: the tab bar is up with Play current");
      const tabs = await page.locator("[data-app-tabbar] a").evaluateAll((els) => els.map((el) => (el.textContent ?? "").trim()));
      check(tabs.join(",") === "Play,Practice,Tournaments,Profile", `four tabs with labels (${tabs.join(",")})`);
      const gold = await page.locator("[data-app-tabbar] [aria-current='page']").evaluate((el) => getComputedStyle(el).color);
      // The tab screens' gold: --jz-gold #E2C07A (src/design/tokens.css, design foundation F1, 6 Nov 2026).
      check(gold === "rgb(226, 192, 122)", `the current tab is gold (${gold})`);
      // The device's geometry (emulateDevice: the short layout viewport, the insets) lands a frame or more
      // after the load: wait (up to 5 s) for the bar to settle on the bottom for 3 frames before judging it,
      // the intermittent CI failure was a measurement taken mid-resize. The check below is unchanged.
      await page
        .waitForFunction(
          () =>
            new Promise<boolean>((done) => {
              const at = () => {
                const el = document.querySelector("[data-app-tabbar]");
                return el ? `${el.getBoundingClientRect().bottom}/${innerHeight}` : "";
              };
              const first = at();
              requestAnimationFrame(() =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => done(first !== "" && at() === first && Math.abs(Number(first.split("/")[0]) - innerHeight) < 0.5)),
                ),
              );
            }),
          undefined,
          { timeout: 5_000, polling: 100 },
        )
        .catch(() => undefined);
      const bar = await page.locator("[data-app-tabbar]").evaluate((el) => {
        const r = el.getBoundingClientRect();
        const row = el.querySelector(".app-tabbar-row")!.getBoundingClientRect();
        return { bottom: r.bottom, rowBottom: row.bottom, h: innerHeight };
      });
      check(Math.abs(bar.bottom - bar.h) < 0.5 && bar.h - bar.rowBottom >= 33.5, `the tab bar sits on the bottom, its tabs above the 34px home bar (${JSON.stringify(bar)})`);
      check(await page.getByRole("textbox", { name: "Room code" }).isVisible(), "Quick play: the join code field");
      check(await page.getByRole("button", { name: "Join", exact: true }).isVisible(), "Quick play: Join");
      check((await page.locator("[data-warm-up]").count()) === 3, "Warm up: three game tiles");
      check((await page.locator("[data-warm-up] [data-game-icon]").count()) === 3, "Warm up: each tile has its game's icon");

      const card = page.locator("[data-public-game]").first();
      check((await card.getAttribute("data-public-game")) === "calendar", "Next public game: before lobby time it offers a calendar");
      check(await page.getByRole("button", { name: "Add to calendar" }).isVisible(), 'Next public game: "Add to calendar"');
      check(await page.getByRole("button", { name: "Join now" }).isDisabled(), 'Next public game: "Join now" is off before lobby time');
      // Tab pages refresh (26 Oct 2026): the quiet button says when the lobby opens, the line how long until then.
      check(/Opens 6:45 pm/.test((await card.textContent()) ?? ""), "Next public game: the lobby time in UK time");
      check(/Lobby opens in under a minute/.test((await card.textContent()) ?? ""), "Next public game: how long until the lobby opens");
      const download = page.waitForEvent("download", { timeout: 10_000 }).catch(() => null);
      await page.getByRole("button", { name: "Add to calendar" }).click();
      const file = await download;
      check(!!file && /\.ics$/.test(file.suggestedFilename()), `"Add to calendar" downloads an .ics file (${file?.suggestedFilename() ?? "none"})`);
      await page.clock.fastForward(45_000);
      await page.waitForTimeout(300);
      check((await card.getAttribute("data-public-game")) === "join", "Next public game: at lobby time it switches to Join now");
      // Since the follow-up to #129 Join now is always on the card, off until lobby time: judge it enabled here.
      check((await page.getByRole("button", { name: "Join now" }).isVisible()) && (await page.getByRole("button", { name: "Join now" }).isEnabled()), 'Next public game: "Join now"');

      // Tabs: Play → Practice (pushed) → Tournaments → Profile (replaced), then Back returns to Play.
      for (const [label, path, tab] of [
        ["Practice", "/practice", "practice"],
        ["Tournaments", "/tournaments", "tournaments"],
        ["Profile", "/profile", "profile"],
      ] as const) {
        await page.locator(`[data-app-tabbar] [data-tab='${tab}']`).click();
        await page.getByRole("heading", { level: 1, name: label }).waitFor({ timeout: 30_000 });
        check(new URL(page.url()).pathname === path, `${label}: the URL is ${path} (${new URL(page.url()).pathname})`);
        check((await tabBar(page)) === 1 && (await currentTab(page)) === tab, `${label}: the tab bar is up with ${label} current`);
      }
      check((await page.locator("[data-public-game='join']").count()) === 0, "Profile has no schedule card");
      await page.locator("[data-open-settings]").click();
      check(await page.getByRole("dialog", { name: "Settings" }).isVisible(), "Profile: the gear opens the settings");
      check((await page.locator("[data-settings-sheet] [data-sound-controls]").count()) === 1, "Settings: the sound controls");
      await page.getByRole("button", { name: "Close settings" }).click();
      // A device with no rooms, dailies or bests (tab pages refresh): its badge, "Choose your look" and Get started.
      check(await page.getByRole("button", { name: "Choose your look" }).isVisible(), 'Profile (new player): "Choose your look"');
      check((await page.locator("[data-get-started] [data-step]").count()) === 3, "Profile (new player): the three Get started steps");
      await page.getByRole("button", { name: "Choose your look" }).click();
      check((await page.locator("[data-look-picker]").count()) === 1, "Profile: Choose your look opens the lobby's look picker");
      check(/Saved on this phone\. Sign-in after the beta will keep it all/.test((await page.textContent("body")) ?? ""), "Profile: the saved-on-this-phone note");
      await page.goBack();
      await page.getByRole("button", { name: "Create a room" }).waitFor({ timeout: 30_000 });
      check(new URL(page.url()).pathname === "/", "Back from the tabs returns to Play");

      // Tournaments: Next up (Join now, it is lobby time) and Coming up; Join now opens the public room.
      await page.locator("[data-app-tabbar] [data-tab='tournaments']").click();
      await page.getByRole("heading", { level: 1, name: "Tournaments" }).waitFor({ timeout: 30_000 });
      check((await page.locator("[data-public-game='join']").count()) === 1, "Tournaments: Next up offers Join now once the lobby is open");
      check((await page.locator("[data-public-later]").count()) === 1, "Tournaments: Coming up lists the later game");
      check((await page.locator("[data-public-results-empty]").count()) === 1, 'Tournaments: "No public games played yet"');
      await page.getByRole("button", { name: "Join now" }).click();
      await page.waitForURL(/\/duel\/PUBL$/, { timeout: 30_000 });
      check(true, "Join now opens the public room");
      // The URL changes before the room route has loaded and drawn (a cold route chunk on CI): wait for the
      // Tournaments screen to leave before judging the room's (the intermittent "no tab bar" failure).
      await page.getByRole("heading", { level: 1, name: "Tournaments" }).waitFor({ state: "detached", timeout: 60_000 });
      await page.waitForTimeout(1500);
      check((await tabBar(page)) === 0, "the room screen has no tab bar");
      for (const e of errors) check(false, `page error: ${e}`);
    } finally {
      await context.close();
    }
  }

  /* Tournaments before lobby time: Add to calendar, flipping to Join now as the clock passes it. */
  {
    const { page, context } = await openApp("/tournaments", { clock: BEFORE_LOBBY });
    try {
      await page.getByRole("heading", { level: 1, name: "Tournaments" }).waitFor({ timeout: 60_000 });
      check((await page.locator("[data-public-game='calendar']").count()) === 1, "Tournaments: before lobby time Next up offers Add to calendar");
      await page.clock.fastForward(45_000);
      await page.waitForTimeout(300);
      check((await page.locator("[data-public-game='join']").count()) === 1, "Tournaments: at lobby time Next up switches to Join now");
    } finally {
      await context.close();
    }
  }

  /* Practice: every active game has its icon and its name; a Warm up tile opens its round; no tab bar in rounds. */
  {
    const { page, context } = await openApp("/practice");
    try {
      await page.getByRole("heading", { level: 1, name: "Practice" }).waitFor({ timeout: 60_000 });
      await page.waitForTimeout(800);
      // The list has two sides (Puzzles | Arcade, 30 Oct 2026): every active game is on one of them.
      const sideRows = async () => page.locator("[data-practice-game]").evaluateAll((els) =>
        els.map((el) => {
          const icon = el.querySelector("[data-game-icon]");
          const canvas = icon?.querySelector("canvas");
          let painted = 0;
          if (canvas) {
            const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
            for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) painted++;
          }
          return {
            type: el.getAttribute("data-practice-game"),
            icon: icon?.getAttribute("data-game-icon") ?? null,
            art: icon?.getAttribute("data-icon-art") ?? null,
            painted: canvas ? painted / (canvas.width * canvas.height) : null,
            svg: icon ? icon.querySelectorAll("svg *").length : 0,
            text: icon ? Array.from(icon.querySelectorAll("text")).filter((t) => getComputedStyle(t).display !== "none" && (t.textContent ?? "").trim()).length : 0,
          };
        }),
      );
      const sideNames = async () => {
        const out: string[] = [];
        for (const type of ACTIVE_PUZZLE_TYPES) {
          const name = PUZZLE_REGISTRY[type].name;
          if ((await page.getByRole("button", { name, exact: true }).count()) >= 1) out.push(name);
        }
        return out;
      };
      const rows = await sideRows();
      const named = await sideNames();
      await page.locator("[data-practice-side='arcade']").click();
      await page.waitForTimeout(400);
      rows.push(...(await sideRows()));
      named.push(...(await sideNames()));
      await page.locator("[data-practice-side='puzzles']").click();
      await page.waitForTimeout(300);
      const byType = new Map(rows.map((r) => [r.type, r]));
      const missing: string[] = [];
      for (const type of ACTIVE_PUZZLE_TYPES) {
        const row = byType.get(type);
        if (!row || row.icon !== type || row.art === "none" || row.text > 0) missing.push(type);
        else if (row.art === "canvas" && (row.painted ?? 0) < 0.05) missing.push(`${type} (canvas ${(row.painted ?? 0).toFixed(2)} painted)`);
        else if (row.art === "svg" && row.svg < 2) missing.push(`${type} (empty svg)`);
      }
      check(missing.length === 0, `every active game (${ACTIVE_PUZZLE_TYPES.length}) has its own icon, drawn, with no text${missing.length ? `: ${missing.join(", ")}` : ""}`);
      const names = ACTIVE_PUZZLE_TYPES.map((type) => PUZZLE_REGISTRY[type].name).filter((name) => !named.includes(name));
      check(names.length === 0, `every practice button is named exactly its game${names.length ? `: ${names.join(", ")}` : ""}`);
      check((await page.locator("[data-practice-filter]").first().textContent()) === "All games", "the filter chips start with All games");
      await page.locator("[data-practice-filter='logic']").click();
      const logic = await page.locator("[data-practice-game]").evaluateAll((els) => els.map((el) => el.getAttribute("data-practice-game")));
      check(logic.length > 0 && logic.every((t) => PUZZLE_REGISTRY[t as keyof typeof PUZZLE_REGISTRY]?.category === "logic"), "the Logic chip shows only logic games");
      await page.locator("[data-practice-filter='all']").click();
      await page.getByRole("searchbox", { name: "Search puzzles" }).fill("grid");
      const found = await page.locator("[data-practice-game]").evaluateAll((els) => els.map((el) => el.getAttribute("data-practice-game")));
      check(found.includes("unblock") && found.every((t) => PUZZLE_REGISTRY[t as keyof typeof PUZZLE_REGISTRY]?.name.toLowerCase().includes("grid")), `search "grid" finds Gridlock and only names with "grid" (${found.join(",")})`);
      await page.getByRole("searchbox", { name: "Search puzzles" }).fill("");
      await page.getByRole("button", { name: "Gridlock", exact: true }).click();
      await page.getByRole("button", { name: /^Ready/ }).first().waitFor({ timeout: 60_000 });
      check((await tabBar(page)) === 0, "a practice round's intro has no tab bar");
      await page.getByRole("button", { name: /^Ready/ }).first().click();
      await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
      check((await tabBar(page)) === 0, "a practice round's live game has no tab bar");
    } finally {
      await context.close();
    }
  }
  {
    // On the schedule's clock, as the Play tab tests above: the page draws the same cards on any day.
    const { page, context } = await openApp("/", { clock: BEFORE_LOBBY });
    try {
      const tile = page.locator("[data-warm-up]").first();
      await tile.waitFor({ timeout: 60_000 });
      await hydrated(page, "[data-warm-up]");
      const type = await tile.getAttribute("data-warm-up");
      await tile.click();
      await page.getByRole("button", { name: /^Ready/ }).first().waitFor({ timeout: 60_000 });
      check(new URL(page.url()).pathname === "/practice", `a Warm up tile (${type}) opens its game's round in practice`);
      check((await tabBar(page)) === 0, "the Warm up round has no tab bar");
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close().catch(() => undefined);
  if (proc?.pid) {
    try {
      process.kill(-proc.pid);
    } catch {
      /* already gone */
    }
  }
}

/* ------------------------------------------------------------ 3. room screens */

{
  const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-app-shell", buildId: "app-shell-check" });
  const harnessBrowser = await chromium.launch({ executablePath: CHROMIUM });
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const room = (status: string, phase: string, opts: { join?: boolean } = {}) => {
    const player = (slot: number) => ({
      id: `p${slot}`, duel_id: "duel-shell", player_slot: slot, display_name: `Player ${slot}`, user_id: `u${slot}`,
      ready_round: 1, intro_ready_round: 0, muted_by_host: false, last_reaction_at: null, last_seen_at: iso(now), status: "active", joined_at: iso(now - 60_000),
    });
    const players = [player(1), player(2), player(3)];
    if (opts.join) players[0] = { ...players[0]!, status: "left" };
    const scored = status === "finished" || ["result", "standings", "winner_reveal"].includes(phase);
    return {
      duel: {
        id: "duel-shell", room_code: "SAFE", status, selected_categories: [], tournament_history: [], disbanded_at: null, host_user_id: "u1",
        max_players: 10, round_count: 1, round_order: ["reaction"], no_maths: false, puzzles_public: [], current_round: status === "waiting" ? 0 : 1,
        phase, phase_started_at: iso(now + 500), round_started_at: iso(now + 500), next_duel_id: null, created_at: iso(now - 60_000),
      },
      players,
      results: scored
        ? players.map((p) => ({ id: `r${p.player_slot}`, duel_id: "duel-shell", player_slot: p.player_slot, round_number: 1, answer: "", is_correct: true, ms_remaining: 9000, reaction_avg_ms: null, correct_count: null, errors: null, extra: null, score: 100 + p.player_slot, submitted_at: iso(now - 5000) }))
        : [],
    };
  };
  const screens: [string, ReturnType<typeof room>][] = [
    ["lobby", room("waiting", "starting")],
    ["link join", room("waiting", "starting", { join: true })],
    ["Prepare to Duel", room("in_progress", "starting")],
    ["round result", room("in_progress", "result")],
    ["standings", room("in_progress", "standings")],
    ["winner reveal", room("in_progress", "winner_reveal")],
    ["podium", room("finished", "result")],
  ];
  try {
    for (const [name, state] of screens) {
      const context = await harnessBrowser.newContext({ viewport: { width: 414, height: 848 } });
      const page = await context.newPage();
      await page.addInitScript((r) => {
        (window as unknown as { __harness: unknown }).__harness = { puzzles: {}, verdict: { isCorrect: true, score: 150 }, latencyMs: 50, submissions: [], verdictAt: null, room: r };
        localStorage.setItem("duelz_onboarding_seen", "1");
      }, state);
      try {
        await page.goto(`${server.origin}/safe-area.html?mode=room`, { timeout: 180_000 });
        await page.waitForSelector("#root *", { timeout: 120_000 });
        await page.waitForTimeout(1500);
        check((await tabBar(page)) === 0, `room ${name}: no tab bar`);
      } finally {
        await context.close();
      }
    }
    // The four tab screens in the same harness do have it (so the room result above is meaningful).
    for (const mode of ["home", "practice", "tournaments", "profile"]) {
      const context = await harnessBrowser.newContext({ viewport: { width: 414, height: 848 } });
      const page = await context.newPage();
      await page.addInitScript(() => {
        (window as unknown as { __harness: unknown }).__harness = { puzzles: {}, verdict: { isCorrect: true, score: 150 }, latencyMs: 50, submissions: [], verdictAt: null, room: null };
        localStorage.setItem("duelz_onboarding_seen", "1");
      });
      try {
        await page.goto(`${server.origin}/safe-area.html?mode=${mode}`, { timeout: 180_000 });
        await page.locator("[data-app-tabbar]").first().waitFor({ timeout: 60_000 }).catch(() => undefined);
        check((await tabBar(page)) === 1, `${mode}: the tab bar in the harness`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await harnessBrowser.close();
    await server.close();
  }
}

console.log(`app-shell-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  process.exit(1);
}
console.log("PASS: the four tabs render and navigate, Back returns to Play, every active game has its own icon, rooms and rounds have no tab bar, and the schedule card switches from Add to calendar to Join now at lobby time");
