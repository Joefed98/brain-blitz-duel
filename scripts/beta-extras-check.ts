/**
 * The beta extras (22 Oct 2026): the beta terms, the Add to Home Screen hint, Send feedback and crash
 * reporting, each with its value from src/config/betaConfig.ts.
 *
 *  1. betaConfig: SENTRY_DSN, TALLY_URL and CONTACT_EMAIL are empty strings in the repo (a follow-up
 *     only fills them), and every feature reads them through betaValue.
 *  2. Crash reporting, in bun: the DSN parsed to Sentry's envelope endpoint; an event carries only the
 *     device type, screen, viewport, display, route pattern (no room code, no query), game id, round,
 *     release (the commit) and environment, never a user, name, chat or answer; nothing starts while
 *     SENTRY_DSN is empty.
 *  3. Feedback and terms, in bun: the form address with the device's anonymous id and the version; no
 *     link without TALLY_URL; I AGREE keeps the date on the device and records it once.
 *  4. The hint's browser test: iPhone Safari outside a home-screen app only.
 *  5. In Chromium (the real screens through the screen harness, scripts/safe-area-harness.tsx):
 *     - the terms come first: Create a room on a fresh device shows the terms and creates nothing
 *       until I AGREE; a room link, the daily and a challenge show the terms first; once agreed, never
 *       again (a reload goes straight to the room); the contact line is hidden while CONTACT_EMAIL is
 *       empty and shown when set; Profile → settings → Beta terms;
 *     - the hint shows on iPhone Safari's first visit only (not a second visit, a home-screen app,
 *       Chrome on iPhone, Android or a desktop browser), and the ✕ collapses it;
 *     - Send feedback is hidden on Profile, the podium and the daily results while TALLY_URL is empty,
 *       and links to the form with ?version= when set (opening a new tab);
 *     - crash reporting: with SENTRY_DSN empty an error sends nothing; set, an uncaught error and an
 *       unhandled rejection in a room round reach the envelope endpoint tagged with the game and round,
 *       with no player name, chat or answer, and the round's screen keeps running.
 *
 *   bun scripts/beta-extras-check.ts [--shots=<dir>] [--verbose]
 *
 * `--shots=<dir>` saves 414×896 screenshots of the terms page, the hint and the feedback link.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";

import type { Browser, BrowserContext, Page } from "playwright";

import * as betaConfig from "../src/config/betaConfig";
import { PUBLIC_GAMES, PUBLIC_ROOM_CODE } from "../src/config/publicGames";
import { feedbackUrl } from "../src/lib/beta/feedback";
import { TERMS_KEY, agreeToTerms, resetTermsMemory, termsAgreement } from "../src/lib/beta/terms";
import { termsEventRow } from "../src/lib/duel/betaRecord.server";
import {
  buildEvent,
  deviceType,
  envelope,
  parseDsn,
  parseStack,
  releaseName,
  routePattern,
  startCrashReporting,
} from "../src/lib/crashReporting";
import { RESERVED_ROOM_CODES, generateRoomCode } from "../src/lib/duel/puzzles";
import { iphoneSafari } from "../src/lib/playCards";
import { ONBOARDING_KEY } from "../src/lib/onboarding";
import { IPHONE11_APP, emulateDevice } from "./device-emulation";
import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS, IPHONE_SAFARI_UA, THEME_SCREENS, VIEWPORTS, openThemeScreen, room as roomAt } from "./theme-screens";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const SHOTS = args.find((a) => a.startsWith("--shots="))?.slice(8);
let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string) {
  if (ok) {
    passes++;
    if (VERBOSE) console.log(`  ok ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

/* ------------------------------------------------------------------ 1. the config file */

check(betaConfig.SENTRY_DSN === "", "SENTRY_DSN is an empty string until Joe supplies it");
check(betaConfig.TALLY_URL === "", "TALLY_URL is an empty string until Joe supplies it");
check(betaConfig.CONTACT_EMAIL === "", "CONTACT_EMAIL is an empty string until Joe supplies it");
for (const [file, key] of [
  ["src/lib/crashReporting.ts", "SENTRY_DSN"],
  ["src/lib/beta/feedback.ts", "TALLY_URL"],
  ["src/components/beta/TermsScreen.tsx", "CONTACT_EMAIL"],
] as const)
  check(readFileSync(file, "utf8").includes(`betaValue("${key}")`), `${file} reads ${key} through betaValue`);
check(
  !/@sentry\//.test(readFileSync("package.json", "utf8")),
  "no new package (bun.lock is Lovable's): the reporter is first-party",
);

/* ------------------------------------------------------------------ 2. crash reporting (bun) */

check(startCrashReporting() === false, "SENTRY_DSN empty: crash reporting doesn't start");
const DSN = "https://abc123@o456.ingest.de.sentry.io/789";
const parsed = parseDsn(DSN);
check(
  parsed?.endpoint ===
    "https://o456.ingest.de.sentry.io/api/789/envelope/?sentry_key=abc123&sentry_version=7&sentry_client=joulz.crash%2F1.0.0",
  `the DSN gives Sentry's envelope endpoint (${parsed?.endpoint})`,
);
check(parseDsn("") === null && parseDsn("not a dsn") === null && parseDsn("https://o1.ingest.sentry.io/1") === null, "a malformed DSN starts nothing");
check(releaseName("1a2b3c4d5e-mabc12") === "joulz@1a2b3c4d5e", "the release is the build's commit");
check(routePattern("/duel/ABCD") === "/duel/$code" && routePattern("/challenge") === "/challenge", "routes are patterns (no room code)");
const IPHONE = IPHONE_SAFARI_UA;
check(
  deviceType(IPHONE) === "iphone" &&
    deviceType("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141 Mobile Safari/537.36") === "android-phone" &&
    deviceType("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15", 5) === "ipad" &&
    deviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141") === "desktop",
  "device types",
);
const frames = parseStack("Error: x\n    at paint (https://joulz.app/assets/game-abc.js?v=1:10:20)\n    at https://joulz.app/assets/main.js:1:2");
check(frames.length === 2 && frames[1]!.function === "paint" && frames[1]!.filename === "https://joulz.app/assets/game-abc.js" && frames[0]!.lineno === 1, "V8 stacks parse, oldest call first, no query");
check(parseStack("paint@https://joulz.app/a.js:3:4\n@https://joulz.app/b.js:5:6").length === 2, "Safari stacks parse");
{
  const event = buildEvent({
    error: new TypeError("cannot read x"),
    mechanism: "onerror",
    context: { gameId: "sudoku", round: 3 },
    device: { ua: IPHONE, touchPoints: 5, screen: "414x896", viewport: "414x848", standalone: true },
    route: routePattern("/duel/QRST"),
    release: "joulz@abc",
    environment: "production",
    eventId: "0".repeat(32),
    now: 1_792_000_000_000,
  });
  const tags = event["tags"] as Record<string, string>;
  check(
    tags["device"] === "iphone" && tags["screen"] === "414x896" && tags["viewport"] === "414x848" && tags["display"] === "home-screen-app" && tags["route"] === "/duel/$code" && tags["game"] === "sudoku" && tags["round"] === "3",
    `an event's tags: device, screen, viewport, display, route, game, round (${JSON.stringify(tags)})`,
  );
  const allowed = ["event_id", "timestamp", "platform", "level", "logger", "release", "environment", "exception", "tags", "request", "sdk"];
  check(Object.keys(event).every((k) => allowed.includes(k)), `an event carries only its listed fields (${Object.keys(event).join(", ")})`);
  check(!("user" in event) && !("breadcrumbs" in event) && !("extra" in event) && !("contexts" in event), "no user, breadcrumbs, extra or contexts");
  const body = envelope(event, DSN, 1_792_000_000_000);
  const lines = body.split("\n");
  check(lines.length === 3 && JSON.parse(lines[1]!).type === "event" && JSON.parse(lines[2]!).event_id === "0".repeat(32), "an envelope: header, item header, event");
  check(!/QRST/.test(body), "the room code never leaves the phone");
}
{
  const source = readFileSync("src/lib/crashReporting.ts", "utf8");
  check(
    !/getStoredName|display_name|displayName|chat|answer|currentUserId|ensureSession|localStorage/.test(
      source.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "the reporter reads no name, chat, answer, user id or device storage",
  );
  check(!/tracesSampleRate|startTransaction|"transaction"/.test(source.replace(/\/\*\*[\s\S]*?\*\//g, "")), "no performance data (sampling 0: no transactions)");
  check(/preventDefault/.test(source) === false, "the reporter never prevents an error's default handling");
}

/* ------------------------------------------------------------------ 3. feedback and terms (bun) */

const UUID = "0f8e5b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
check(feedbackUrl("", UUID, "v1") === null, "no TALLY_URL: no feedback link");
check(
  feedbackUrl("https://tally.so/r/abcd12", UUID, "1a2b3c-xyz") === `https://tally.so/r/abcd12?device=${UUID}&version=1a2b3c-xyz`,
  "the form address carries the device's anonymous id and the version",
);
check(feedbackUrl("https://tally.so/r/abcd12?x=1", "Jo", "v") === "https://tally.so/r/abcd12?x=1&version=v", "only an anonymous id (a UUID) is ever added, never anything else");
check(feedbackUrl("javascript:alert(1)", null, "v") === null, "only a web address");
{
  const store = new Map<string, string>();
  const fake = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  (globalThis as unknown as { window: unknown }).window = { localStorage: fake, sessionStorage: fake };
  resetTermsMemory();
  check(termsAgreement() === null, "a fresh device hasn't agreed");
  const recorded: unknown[] = [];
  const at = new Date("2026-10-27T18:30:00Z");
  agreeToTerms((a) => recorded.push(a), at);
  resetTermsMemory();
  check(termsAgreement()?.agreedAt === at.toISOString() && JSON.parse(store.get(TERMS_KEY)!).version === 1, "I AGREE keeps the date and terms version on the device");
  check(recorded.length === 1, "the agreement is recorded once with the beta events");
  const row = termsEventRow(UUID, { version: 1, agreedAt: at.toISOString() });
  check(row?.agreed_at === at.toISOString() && row.terms_version === 1 && termsEventRow(UUID, { version: "x", agreedAt: "y" }) === null, "terms_events rows: the stored date, refused when malformed");
  delete (globalThis as unknown as { window?: unknown }).window;
}
check(existsSync("supabase/migrations/20261023120000_beta_terms_events.sql"), "the terms_events migration is written");

/* ------------------------------------------------------------------ 4. the hint's browser test, and the public room */

const safari = { ua: IPHONE, standalone: false };
check(iphoneSafari(safari), "iPhone Safari: the hint may show");
check(!iphoneSafari({ ...safari, standalone: true }), "already a home-screen app: no hint");
check(!iphoneSafari({ ua: IPHONE.replace("Version/18.6", "CriOS/141.0"), standalone: false }), "Chrome on iPhone: no hint");
check(!iphoneSafari({ ua: `${IPHONE} [FBAN/FBIOS;FBAV/530.0]`, standalone: false }), "an in-app browser: no hint");
check(!iphoneSafari({ ua: IPHONE.replace("iPhone; CPU iPhone OS", "iPad; CPU OS"), standalone: false }), "iPad: no hint");
check(!iphoneSafari(null), "no browser: no hint");
check(PUBLIC_ROOM_CODE === "JULZ" && /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(PUBLIC_ROOM_CODE), "the public room's code is a valid room code (JOULZ isn't: 5 letters with an O)");
check(
  PUBLIC_GAMES.some((g) => g.date === "2026-10-27" && g.time === "20:00" && g.roomCode === "JULZ") &&
    PUBLIC_GAMES.some((g) => g.date === "2026-10-29" && g.time === "20:00" && g.roomCode === "JULZ"),
  "public games on Tue 27 Oct and Thu 29 Oct 2026 at 20:00 UK time",
);
{
  const original = Math.random;
  // Every draw lands on J, U, L, Z in turn first: a new room still never gets the public code.
  const seq = [8, 18, 10, 23].map((i) => (i + 0.5) / 24);
  let n = 0;
  Math.random = () => (n < 4 ? seq[n++]! : original());
  const code = generateRoomCode();
  Math.random = original;
  check(RESERVED_ROOM_CODES.has("JULZ") && code !== "JULZ" && /^[A-Z]{4}$/.test(code), `a new room never gets the public room's code (${code})`);
}

/* ------------------------------------------------------------------ 5. the screens in Chromium */

const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const APP = VIEWPORTS.find((v) => v.app)!;
const screenNamed = (name: string) => {
  const s = THEME_SCREENS.find((x) => x.name === name);
  if (!s) throw new Error(`no theme screen "${name}"`);
  return s;
};
type H = { calls?: string[] };
const calls = (page: Page) => page.evaluate(() => (window as unknown as { __harness: H }).__harness.calls ?? []);

const { chromium } = await import("playwright");
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-beta-extras", buildId: "beta-extras" });
const browser: Browser = await chromium.launch({ executablePath: CHROMIUM });

async function open(
  mode: string,
  opts: { query?: string; userAgent?: string; standalone?: boolean; beta?: Record<string, string>; harness?: Record<string, unknown>; context?: BrowserContext } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context =
    opts.context ??
    (await browser.newContext({
      viewport: { width: 414, height: 896 },
      hasTouch: true,
      isMobile: true,
      ...(opts.userAgent ? { userAgent: opts.userAgent } : {}),
    }));
  if (!opts.context) {
    await context.addInitScript(
      ({ onboarding, beta, harness, standalone }) => {
        try {
          localStorage.setItem(onboarding, "1");
        } catch {
          /* ignore */
        }
        if (standalone) Object.defineProperty(navigator, "standalone", { get: () => true });
        if (beta) (window as unknown as { __DUELZ_BETA_CONFIG__: unknown }).__DUELZ_BETA_CONFIG__ = beta;
        (window as unknown as { __harness: unknown }).__harness = {
          puzzles: {},
          verdict: { isCorrect: true, score: 150 },
          latencyMs: 50,
          submissions: [],
          verdictAt: null,
          room: null,
          ...(harness ?? {}),
        };
      },
      { onboarding: ONBOARDING_KEY, beta: opts.beta ?? null, harness: opts.harness ?? null, standalone: !!opts.standalone },
    );
  }
  const page = await context.newPage();
  const url = `${server.origin}/safe-area.html?mode=${mode}${opts.query ? `&${opts.query}` : ""}`;
  try {
    await page.goto(url, { timeout: 180_000 });
  } catch (error) {
    if (!/Timeout \d+ms exceeded/.test(String((error as Error).message))) throw error;
    await page.goto(url, { timeout: 90_000 });
  }
  await page.waitForSelector("#root *", { timeout: 60_000 });
  return { context, page };
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

try {
  // Warm the cold dev server once, unmeasured.
  {
    const { context, page } = await open("home");
    await page.getByRole("button", { name: "Create a room" }).waitFor({ timeout: 180_000 });
    await context.close();
  }

  /* The terms come first: Create a room. */
  {
    // The lobby the room link below opens (the home screen doesn't draw it).
    const lobby = screenNamed("lobby, 2 players").room!();
    const { context, page } = await open("home", { query: "terms=0", harness: { room: lobby } });
    try {
      await page.getByRole("button", { name: "Create a room" }).waitFor({ timeout: 60_000 });
      await page.locator("#name").fill("Jo");
      await page.getByRole("button", { name: "Create a room" }).click();
      await page.locator("[data-terms]").waitFor({ timeout: 10_000 });
      check(await page.getByRole("button", { name: "I agree" }).isVisible(), "Create a room on a fresh device: the terms with I AGREE");
      check(!(await calls(page)).includes("createRoom"), "no room is created before I AGREE");
      check((await page.locator("[data-terms-contact]").count()) === 0, "CONTACT_EMAIL empty: no contact line");
      const text = (await page.locator("[data-terms-content]").textContent()) ?? "";
      check(text.includes('Joulz ("we", "us")') && !/the company/.test(text), "the terms name the operator: Joulz (\"we\", \"us\")");
      check(text.includes("chat messages you send in a room"), "what we record includes room chat");
      for (const phrase of ["early-access beta", "free", "18", "copy", "reverse engineer", "scrape", "redistribute", "leaderboards", "share", "device ID", "nicknames", "scores", "crash reports", "run the game", "delete your data"])
        check(text.includes(phrase), `the terms say "${phrase}"`);
      check(text.includes("Joulz") && !text.includes("Duelz"), "the terms use the app's name");
      await page.getByRole("button", { name: "I agree" }).click();
      await page.waitForTimeout(500);
      const after = await calls(page);
      check(after.includes("createRoom"), "I AGREE goes on to create the room");
      check(after.includes("recordTermsAgreedFn"), "the agreement is sent with the beta events");
      const stored = await page.evaluate((k) => localStorage.getItem(k), TERMS_KEY);
      check(!!stored && Number.isFinite(Date.parse(JSON.parse(stored).agreedAt)), `the agreement's date is kept on the device (${stored})`);

      // Once: the room's own link now opens the room, never the terms again.
      await page.goto(`${server.origin}/safe-area.html?mode=room&terms=0`);
      await page.waitForSelector("#root *", { timeout: 60_000 });
      await page.waitForTimeout(800);
      check((await page.locator("[data-terms]").count()) === 0, "agreed once: a room opens without the terms again");
    } finally {
      await context.close();
    }
  }

  /* Never inside a room in progress: a device that hasn't agreed and is already in a room (its lobby,
     rounds, reveals, results, final screen) sees the room, not the terms; its next entry point shows them. */
  {
    const phases: [string, () => unknown][] = [
      ["lobby", roomAt("waiting", "starting")],
      ["Prepare to Duel", roomAt("in_progress", "starting")],
      ["round title", roomAt("in_progress", "round_title")],
      ["round intro", roomAt("in_progress", "intro")],
      ["live round", roomAt("in_progress", "puzzle")],
      ["answer reveal", roomAt("in_progress", "reveal")],
      ["round results", roomAt("in_progress", "result")],
      ["standings", roomAt("in_progress", "standings")],
      ["final screen", roomAt("finished", "standings", { players: 3 })],
    ];
    for (const [label, build] of phases) {
      const { context, page } = await open("room", { query: "terms=0", harness: { room: build() } });
      try {
        await page.waitForTimeout(1500);
        // Drawn: the room's screen is up (Prepare to Duel has no text in its first seconds).
        const drawn = await page.evaluate(() => document.querySelectorAll("#root *").length > 3);
        check(drawn && (await page.locator("[data-terms]").count()) === 0, `a room in progress (${label}): the room, never the terms`);
        check((await page.evaluate((k) => localStorage.getItem(k), TERMS_KEY)) === null, `a room in progress (${label}): still not agreed, so the next entry point asks`);
        if (label === "live round") {
          // The next entry point: Create a room from the Play tab shows the terms first.
          await page.goto(`${server.origin}/safe-area.html?mode=home&terms=0`);
          await page.getByRole("button", { name: "Create a room" }).waitFor({ timeout: 60_000 });
          await page.locator("#name").fill("Jo");
          await page.getByRole("button", { name: "Create a room" }).click();
          await page.locator("[data-terms]").waitFor({ timeout: 10_000 });
          check(!(await calls(page)).includes("createRoom"), "after a room in progress, the next entry point (Create) shows the terms first");
        }
      } finally {
        await context.close();
      }
    }
  }

  /* A room link (a device not in the room: its join), the daily and a challenge show the terms first, then the screen. */
  for (const [label, mode, screen] of [
    ["a room link", "room", "link join"],
    ["the daily", "daily", "daily, before playing"],
    ["a challenge", "challenge", "challenge, link opened"],
  ] as const) {
    const s = screenNamed(screen);
    const data = s.challenge?.();
    const { context, page } = await open(mode, {
      query: "terms=0",
      harness: {
        room: s.room?.() ?? null,
        daily: data?.daily ?? s.daily?.(),
        challenge: data?.challenge,
        search: s.search ?? {},
      },
    });
    try {
      await page.locator("[data-terms]").waitFor({ timeout: 30_000 });
      check(true, `${label}: the terms first`);
      // Nothing of the entry point behind starts: no room preview or join, no daily or challenge call.
      const early = (await calls(page)).filter((name) => /^(fetchRoomPreview|joinRoomByCode|daily|asyncAttempt|challenge)/.test(name));
      check(early.length === 0, `${label}: nothing of the screen behind starts before I AGREE (${early.join(", ")})`);
      await page.getByRole("button", { name: "I agree" }).click();
      await page.waitForTimeout(1200);
      check((await page.locator("[data-terms]").count()) === 0 && ((await page.textContent("#root")) ?? "").length > 0, `${label}: I AGREE opens it`);
    } finally {
      await context.close();
    }
  }

  /* The terms page itself: the contact line when set, Profile → settings → Beta terms; the screenshot. */
  {
    const { context, page } = await open("terms", { query: "terms=0", beta: { CONTACT_EMAIL: "beta@joulz.test" } });
    try {
      await page.locator("[data-terms]").waitFor({ timeout: 30_000 });
      check(((await page.locator("[data-terms-contact]").textContent()) ?? "").includes("beta@joulz.test"), "CONTACT_EMAIL set: the contact line shows it");
      check((await page.locator("[data-terms-contact] a").getAttribute("href")) === "mailto:beta@joulz.test", "the contact line is a mail link");
      await emulateDevice(page, IPHONE11_APP);
      await shot(page, "terms-414x896");
    } finally {
      await context.close();
    }
  }
  {
    const { context, page } = await open("profile");
    try {
      await page.locator("[data-open-settings]").click();
      check(await page.getByRole("button", { name: "Beta terms" }).isVisible(), "Profile → settings: Beta terms");
    } finally {
      await context.close();
    }
  }

  /* The Add to Home Screen hint. */
  {
    const { context, page } = await open("home", { userAgent: IPHONE });
    try {
      await page.locator("[data-home-hint]").waitFor({ timeout: 30_000 });
      const text = (await page.locator("[data-home-hint]").textContent()) ?? "";
      check(/Share/.test(text) && /Add to Home Screen/.test(text) && /full screen/i.test(text) && /streak and history stay in the app/.test(text), "iPhone Safari's first visit: the hint says how and why");
      await emulateDevice(page, { ...IPHONE11_APP, standalone: false, top: 47, bottom: 34, screenH: 896, h: 896 });
      await shot(page, "home-screen-hint-414x896");
      await page.locator("[data-home-hint] button[aria-label='Dismiss']").click();
      await page.waitForTimeout(600);
      check((await page.locator("[data-home-hint]").count()) === 0, "the ✕ collapses it");
      const second = await open("home", { context });
      await second.page.getByRole("button", { name: "Create a room" }).waitFor({ timeout: 60_000 });
      await second.page.waitForTimeout(500);
      check((await second.page.locator("[data-home-hint]").count()) === 0, "once per device: not on the next visit");
    } finally {
      await context.close();
    }
  }
  for (const [label, opts] of [
    ["a home-screen app", { userAgent: IPHONE, standalone: true }],
    ["Chrome on iPhone", { userAgent: IPHONE.replace("Version/18.6", "CriOS/141.0.7390.96") }],
    ["Android", { userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36" }],
    ["a desktop browser", {}],
  ] as const) {
    const { context, page } = await open("home", opts);
    try {
      await page.getByRole("button", { name: "Create a room" }).waitFor({ timeout: 60_000 });
      await page.waitForTimeout(500);
      check((await page.locator("[data-home-hint]").count()) === 0, `${label}: no hint`);
    } finally {
      await context.close();
    }
  }

  /* Send feedback: hidden while TALLY_URL is empty, the form with ?version= when set. */
  for (const [label, screen] of [
    ["Profile", "profile"],
    ["the podium", "podium, 10 players"],
    ["the daily results", "daily results"],
  ] as const) {
    for (const tally of ["", "https://tally.so/r/test12"]) {
      const s = { ...screenNamed(screen), beta: { TALLY_URL: tally } };
      const { context, page } = await openThemeScreen(browser, server.origin, s, APP);
      try {
        const links = page.locator("[data-feedback-link]");
        if (!tally) check((await links.count()) === 0, `${label}: no feedback link while TALLY_URL is empty`);
        else {
          await links.first().scrollIntoViewIfNeeded();
          const href = (await links.first().getAttribute("href")) ?? "";
          check(
            (await links.count()) === 1 && href.startsWith("https://tally.so/r/test12?") && new URL(href).searchParams.get("version") === "beta-extras",
            `${label}: SEND FEEDBACK opens the form with the app version (${href})`,
          );
          check((await links.first().getAttribute("target")) === "_blank" && /noopener/.test((await links.first().getAttribute("rel")) ?? ""), `${label}: in a new tab`);
          check(/send feedback/i.test((await links.first().textContent()) ?? ""), `${label}: it reads SEND FEEDBACK`);
          if (screen === "profile") {
            await links.first().evaluate((el) => el.scrollIntoView({ block: "center" }));
            await shot(page, "feedback-profile-414x896");
          }
          if (screen === "podium, 10 players") {
            await links.first().evaluate((el) => el.scrollIntoView({ block: "center" }));
            await shot(page, "feedback-podium-414x896");
          }
        }
      } finally {
        await context.close();
      }
    }
  }

  /* Crash reporting in the page: off while SENTRY_DSN is empty; set, errors in a round reach Sentry with ids only. */
  const reveal = screenNamed("answer reveal (puzzle)");
  for (const dsn of ["", DSN]) {
    const sent: string[] = [];
    const room = reveal.room!();
    const { page } = await open("room", { userAgent: IPHONE, beta: { SENTRY_DSN: dsn }, harness: { room } });
    // Reports are sent only once an error happens, so the stand-in endpoint can be set up now.
    await page.context().route(/sentry\.io/, async (route) => {
      sent.push(route.request().postData() ?? "");
      await route.fulfill({ status: 200, body: "{}" });
    });
    try {
      // The root's startCrashReporting runs in the app; the harness mounts the route alone, so start it here.
      await page.evaluate(async () => {
        const mod = await import("/src/lib/crashReporting.ts" as string);
        (window as unknown as { __crashOn: boolean }).__crashOn = mod.startCrashReporting();
      });
      const on = await page.evaluate(() => (window as unknown as { __crashOn: boolean }).__crashOn);
      check(on === !!dsn, dsn ? "SENTRY_DSN set: crash reporting starts" : "SENTRY_DSN empty: crash reporting is off");
      const names = (room.players as { display_name: string }[]).map((p) => p.display_name);
      const before = (await page.textContent("#root")) ?? "";
      await page.evaluate(() => {
        setTimeout(() => {
          throw new Error("a test error in a round");
        }, 0);
        void Promise.reject(new Error("a test rejection in a round"));
      });
      await page.waitForTimeout(1500);
      const afterText = (await page.textContent("#root")) ?? "";
      const ticks = await page.evaluate(
        () => new Promise<number>((done) => {
          let n = 0;
          const tick = () => (++n < 10 ? requestAnimationFrame(tick) : done(n));
          requestAnimationFrame(tick);
        }),
      );
      check(
        before.includes("Box Six") && afterText.includes("Box Six") && ticks === 10,
        `${dsn ? "reporting on" : "reporting off"}: the round's screen is still up and running after the errors`,
      );
      if (!dsn) check(sent.length === 0, "SENTRY_DSN empty: nothing is sent");
      else {
        check(sent.length === 2, `both errors reach Sentry's envelope endpoint (${sent.length})`);
        const events = sent.map((b) => JSON.parse(b.split("\n")[2] ?? "{}") as { tags: Record<string, string>; exception: { values: { value: string; mechanism: { type: string } }[] } });
        const mechanisms = events.map((e) => e.exception.values[0]!.mechanism.type).sort().join(",");
        check(mechanisms === "onerror,onunhandledrejection", `an uncaught error and an unhandled rejection (${mechanisms})`);
        const t = events[0]?.tags ?? {};
        check(t["device"] === "iphone" && t["screen"] === "414x896" && t["route"] && t["game"] === "sudoku" && t["round"] === "1", `tagged with device, screen, route, game and round (${JSON.stringify(t)})`);
        const all = sent.join("\n");
        check(!names.some((n) => n && all.includes(n)), "no player's name in a report");
        check(!/"user"|display_name|chat|"answer"/.test(all), "no user, chat or answer in a report");
      }
    } finally {
      await page.context().close();
    }
  }
} catch (error) {
  check(false, `browser pass: ${String((error as Error).message ?? error).split("\n")[0]}`);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} checks`);
  process.exit(1);
}
console.log(
  `PASS: ${passes} checks: the beta terms come first and show once, the Add to Home Screen hint shows once on iPhone Safari only, Send feedback is hidden until TALLY_URL is set and then carries the device id and version, and crash reporting is off without SENTRY_DSN and sends ids only with it`,
);
