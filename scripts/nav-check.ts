/**
 * nav-check (phase 2 step 1, the navigation frame, 14 Nov 2026; docs/design/style-guide, docs/design/nav-review/):
 *
 * 1. The rules, without a browser: the five destinations in order (Home · Games · Tournaments · Shop · More; no Play or
 *    Profile tab), the Shop only with its switch, the art (every image the navigation draws, its 1x/2x/3x WebP files on
 *    disk with alt text, under 150 KB in all, matching scripts/nav-art.ts), the new tokens added beside today's with no
 *    existing token's value changed, the route list (every route file is reached from the navigation, or is a page's own
 *    link, or is dev only).
 * 2. The real app on a dev server (an iPhone 11 home-screen app's geometry, a guest), end to end: every tab opens its
 *    screen; the gold Play bar is on Home and Games only, above the tab bar, and opens the Play page; More's rows
 *    open Profile, Friends (the save-your-progress sheet for a guest), Leaderboards, Challenges (Games, scrolled to the
 *    full list), Daily, Settings (/settings) and Support; the avatar opens the save-your-progress sheet for a guest.
 *    Back (Android's back button or gesture: the browser's history back): one screen at a time, and from any main tab
 *    to Home before leaving, including a tab opened directly (Home put beneath it). The tab bar and Play bar sit above
 *    the home bar / gesture bar inset. Every tab, row, the avatar and Play are at least 44 px. Tablets: the tab bar
 *    upright, the rail sideways. The desktop rail works by keyboard with a visible focus ring, and collapses to icons
 *    in a room. The launch screen is in the server's page and gone once the app has started; under Reduce motion it
 *    doesn't animate.
 * 3. The screen harness (scripts/safe-area-harness.tsx): the avatar opens Profile for an account; Tournaments shows the
 *    coming-soon page to a player without tournaments and the real screens (the Beta pill and hub, no coming-soon
 *    card) to a player with them.
 *
 *   bun scripts/nav-check.ts [--verbose] [--url=<origin>]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Browser, Page } from "playwright";

import { gotoRetried, warmUp } from "./browser-load";
import { DEVICE_INIT, IPHONE11_APP, emulateDevice } from "./device-emulation";
import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS, openThemeScreen, type ThemeScreen } from "./theme-screens";
import { TABS, TAB_PATHS, tabsFor } from "../src/design/components/TabBar";
import { NAV_ART } from "../src/components/nav/navArt.data";
import { ONBOARDING_KEY } from "../src/lib/onboarding";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const URL_ARG = args.find((a) => a.startsWith("--url="))?.slice(6);
const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, what: string) => {
  if (ok) passes++;
  else failures.push(what);
  if (VERBOSE || !ok) console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
};

/* ------------------------------------------------------------ 1. the rules */

{
  check(TABS.map((t) => t.label).join(",") === "Home,Games,Compete,Shop,You", `the five destinations in order (${TABS.map((t) => t.label).join(",")})`); // Changed with Joe's approval, 21 Nov 2026
  check(!TABS.some((t) => /^(Play|Profile)$/.test(t.label)), "no Play tab and no Profile tab");
  check(tabsFor(false).map((t) => t.label).join(",") === "Home,Games,Compete,You", "the Shop switch off: four, Compete always there"); // Changed with Joe's approval, 21 Nov 2026
  check(TAB_PATHS.play === "/" && TAB_PATHS.practice === "/practice" && TAB_PATHS.you === "/profile" && TAB_PATHS.tournaments === "/tournaments", "Home is /, Games is /practice, You is /profile"); // Changed with Joe's approval, 21 Nov 2026

  let total = 0;
  const files = readdirSync("public/nav");
  for (const [name, art] of Object.entries(NAV_ART)) {
    check(art.alt.length > 0, `${name}: alt text`);
    check(art.urls.length >= 2, `${name}: at least 1x and 2x`);
    for (const url of art.urls) {
      const file = url.split("?")[0]!.replace(/^\//, "public/");
      check(existsSync(file), `${name}: ${file} exists`);
    }
  }
  for (const f of files) total += statSync(join("public/nav", f)).size;
  check(total < 150 * 1024, `the navigation art is small (${(total / 1024).toFixed(1)} KB, under 150 KB)`);
  const regen = Bun.spawnSync(["bun", "scripts/nav-art.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
  check(regen.exitCode === 0, `the art matches scripts/nav-art.ts (${regen.stdout.toString().trim()})`);

  const tokens = readFileSync("src/design/tokens.css", "utf8");
  for (const [token, value] of [
    ["--jz-loss-text", "#FF5A6E"],
    ["--jz-surface-3", "#26376B"], // Changed with Joe's approval, 21 Nov 2026
    ["--jz-gold-ink", "#E2C07A"],
    ["--jz-cut-lg", "14px"],
    ["--jz-cut-sm", "8px"],
    ["--jz-dur-press", "70ms"],
    ["--jz-dur-sheet-in", "280ms"],
  ] as const)
    check(new RegExp(`${token}:\\s*${value}`).test(tokens), `token ${token}: ${value}`);
  // Today's values. Changed with Joe's approval, 14 Nov 2026 (routine consequence of the components step: --jz-loss
  // takes the guide's #FF5A6E; was #E5243F).
  for (const [token, value] of [["--jz-loss", "#FF5A6E"], ["--jz-bg", "#04060C"], ["--jz-gold", "#E2C07A"], ["--jz-surface", "#101A33"]] as const) { // Changed with Joe's approval, 21 Nov 2026
    // Its first definition (the dark :root block; the light one comes after it, scoped to the navigation).
    const first = new RegExp(`\\n\\s*${token}:\\s*([^;]+);`).exec(tokens);
    check(first?.[1]?.trim() === value, `existing token ${token} still ${value} (${first?.[1]})`);
  }
  // Changed with Joe's approval, 14 Nov 2026 (routine consequence of 2b, the light theme on every page, Joe's brief:
  // was "the light theme reaches only the navigation frame"): light on the whole page, game screens kept dark.
  check(
    /:root\[data-theme="light"\] \{/.test(tokens) && /:root\[data-theme="light"\] :is\(\.game-screen, \[data-skin-off\], \.pcard\) \{/.test(tokens),
    "the light theme reaches every page, game screens and game art kept dark",
  );

  // The route list: every route file, and how a player reaches it (docs/design/nav-review/GALLERY.md lists the same).
  const ROUTES: Record<string, string> = {
    "index.tsx": "tab: Home",
    "practice.tsx": "tab: Games",
    "tournaments.tsx": "tab: Tournaments",
    "shop.tsx": "tab: Shop (with its switch); More: Joulz Plus",
    "more.tsx": "redirects to /profile (You)", // Changed with Joe's approval, 21 Nov 2026
    "profile.tsx": "avatar (an account); More: Profile",
    "friends.tsx": "More: Friends; Profile's Friends",
    "leaderboards.tsx": "More: Leaderboards",
    "daily.tsx": "More: Daily; Home's Daily cards",
    "account.tsx": "the save-your-progress sheet (avatar, More: Friends); Settings → Account",
    "customise.tsx": "Profile: Customise card",
    // Changed with Joe's approval, 14 Nov 2026 (routine consequence of the Home and Play pages, phase 2 step 3): Create,
    // Join, Rejoin and Challenge a friend moved from Home to the Rooms page; rated play's Play to the Play page.
    "challenge.tsx": "Rooms: Challenge a friend; Profile: Your challenges; a challenge link",
    "duel.$code.tsx": "Rooms: Create a room, Join, Rejoin; Play: Create a room; a room link",
    "rated.tsx": "Play: Find a match (where rated play is open)",
    "tiers.tsx": "Home: Ratings' All ratings; Profile's rating",
    "play.tsx": "redirects to / (Home)", // Changed with Joe's approval, 21 Nov 2026
    "rooms.tsx": "Play: Rooms",
    "tournament.tsx": "Tournaments: an event (players with tournaments)",
    "tournament-rules.tsx": "an event's rules link",
    "daily-board.tsx": "the Daily screens' Top 100; Leaderboards",
    "daily-archive.tsx": "Joulz Plus: the Daily archive",
    "terms.tsx": "Settings: Beta terms; the first room, Daily or challenge",
    // Changed with Joe's approval, 14 Nov 2026 (routine consequence of the settings sheet becoming /settings).
    "settings.tsx": "More: Settings; Profile's gear; the rail's gear",
    "__root.tsx": "the app's root (the launch screen)",
    "dev-crash.tsx": "development only",
    "dev-design.tsx": "development only",
    "replay-lab.tsx": "development only",
    // Changed with Joe's approval, 14 Nov 2026 (routine consequence of the Profile session's two new pages).
    "badges.tsx": "Profile: the Badges row's See all",
    "card.tsx": "Profile: a tap on your card",
    // Added 14 Nov 2026 (the Games session): the full challenges list, its own page.
    "challenges.tsx": "More: Challenges",
  };
  for (const file of readdirSync("src/routes").filter((f) => f.endsWith(".tsx")))
    check(file in ROUTES, `route ${file} has an entry point (${ROUTES[file] ?? "none"})`);
}

/* ------------------------------------------------------------ 2. the real app */

const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

const PORT = 5540 + Math.floor(Math.random() * 300);
async function startServer(): Promise<{ origin: string; proc: ChildProcess | null }> {
  if (URL_ARG) return { origin: URL_ARG.replace(/\/$/, ""), proc: null };
  const proc = spawn("npx", ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], {
    stdio: "ignore",
    detached: true,
    env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=4096`.trim() },
  });
  const origin = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${origin}/profile`); // Changed with Joe's approval, 21 Nov 2026
      if (r.ok) return { origin, proc };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

const { chromium } = await import("playwright");
const browser: Browser = await chromium.launch({ executablePath: CHROMIUM });
const { origin, proc } = await startServer();

const hydrated = (page: Page, selector: string) =>
  page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!el && Object.keys(el).some((key) => key.startsWith("__react"));
  }, selector, { timeout: 120_000 });
const path = (page: Page) => new URL(page.url()).pathname;
/** Waits for the address bar's path; a miss is a failed check (with what the page shows instead), not a crash. */
const waitPath = async (page: Page, want: string) => {
  const ok = await page.waitForFunction((w) => location.pathname === w, want, { timeout: 30_000 }).then(() => true, () => false);
  if (!ok) check(false, `reached ${want} (at ${new URL(page.url()).pathname})`);
  return ok;
};

async function openApp(start: string, opts: { w?: number; h?: number; touch?: boolean; app?: boolean; reduce?: boolean; shop?: boolean } = {}) {
  const context = await browser.newContext({
    viewport: { width: opts.w ?? IPHONE11_APP.w, height: opts.h ?? IPHONE11_APP.h },
    hasTouch: opts.touch ?? true,
    isMobile: false,
    ...(opts.reduce ? { reducedMotion: "reduce" as const } : {}),
  });
  await context.addInitScript(DEVICE_INIT);
  await context.addInitScript(
    ([key, shop]) => {
      localStorage.setItem(key as string, "1");
      localStorage.setItem("duelz-terms:v1", JSON.stringify({ version: 1, agreedAt: "2026-10-20T12:00:00.000Z" }));
      if (shop) (window as unknown as { __DUELZ_SHOP_TAB__: boolean }).__DUELZ_SHOP_TAB__ = true;
    },
    [ONBOARDING_KEY, !!opts.shop] as const,
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]!));
  await gotoRetried(page, `${origin}${start}`, start);
  await page.waitForLoadState("load");
  if (opts.app !== false && !opts.w) await emulateDevice(page, IPHONE11_APP);
  return { page, context, errors };
}

const tapTab = async (page: Page, tab: string) => {
  await page.locator(`[data-app-tabbar] [data-tab='${tab}']`).click();
};
const box = (page: Page, selector: string) => page.locator(selector).first().boundingBox();

try {
  await warmUp(browser, `${origin}/`, async (page) => {
    await page.locator("[data-app-tabbar]").first().waitFor({ timeout: 180_000 });
  }, { init: () => localStorage.setItem("duelz_onboarding_seen", "1") });
  for (const p of ["/practice", "/tournaments", "/profile", "/leaderboards", "/daily"]) // Changed with Joe's approval, 21 Nov 2026
    await warmUp(browser, `${origin}${p}`, async (page) => {
      await page.waitForSelector("#app, body *", { timeout: 180_000 });
      await page.waitForTimeout(3000);
    }, { init: () => localStorage.setItem("duelz_onboarding_seen", "1") });

  /* The launch screen: in the server's page, gone once the app has started. */
  {
    const html = await (await fetch(`${origin}/`)).text();
    check(/data-launch/.test(html) && /data-launch-bolt/.test(html), "the launch screen (the vector bolt) is in the server's page"); // Changed with Joe's approval, 21 Nov 2026
    const { page, context } = await openApp("/");
    await hydrated(page, "[data-app-tabbar] a");
    const shown = await page.locator("[data-launch]").evaluate((el) => getComputedStyle(el).display);
    check(shown === "none", `the launch screen is gone once the app has started (${shown})`);
    await context.close();
    const reduced = await openApp("/", { reduce: true });
    const anim = await reduced.page.locator("[data-launch] .jz-launch-bolt-fill").evaluate((el) => getComputedStyle(el).animationName); // Changed with Joe's approval, 21 Nov 2026
    check(anim === "none", `Reduce motion: the bolt doesn't animate (${anim})`);
    await reduced.context.close();
  }

  /* Tabs, the Play bar, safe areas and targets (a guest, the Shop switch on so all five show). */
  {
    const { page, context, errors } = await openApp("/", { shop: true });
    await hydrated(page, "[data-app-tabbar] a");
    // The server's page has four tabs (no switch there); the check's switch adds the Shop once the app has started.
    await page.waitForFunction(() => document.querySelectorAll("[data-app-tabbar] a").length === 5, undefined, { timeout: 20_000 }).catch(() => undefined);
    const labels = await page.locator("[data-app-tabbar] a").evaluateAll((els) => els.map((el) => (el.textContent ?? "").trim()));
    check(labels.join(",") === "Home,Games,Compete,Shop,You", `the tab bar (${labels.join(",")})`); // Changed with Joe's approval, 21 Nov 2026
    check((await page.locator("[data-app-tabbar] [aria-current='page']").getAttribute("data-tab")) === "play", "Home is current on /");
    const names = await page.locator("[data-app-tabbar] a").evaluateAll((els) => els.map((el) => (el as HTMLElement).innerText.trim()));
    check(names.every((n) => n.length > 0), "every tab has a name for screen readers");
    const tabBoxes = await page.locator("[data-app-tabbar] a").evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => [r.width, r.height]));
    check(tabBoxes.every(([w, h]) => w! >= 44 && h! >= 44), `every tab is at least 44 px (${JSON.stringify(tabBoxes)})`);

    // Above the home bar / gesture bar: the row ends at least the inset above the screen's bottom.
    const row = await box(page, "[data-app-tabbar] .app-tabbar-row");
    const vh = await page.evaluate(() => window.innerHeight);
    const inset = await page.evaluate(() => {
      const p = document.createElement("div");
      p.style.cssText = "position:fixed;padding-bottom:env(safe-area-inset-bottom,0px)";
      document.body.appendChild(p);
      const v = parseFloat(getComputedStyle(p).paddingBottom) || 0;
      p.remove();
      return v;
    });
    check(!!row && row.y + row.height <= vh - inset + 0.5, `the tab bar sits above the home bar (row ends ${row && row.y + row.height}, inset ${inset}, screen ${vh})`);
    check((await page.locator("[data-nav-play]").count()) === 0, "no floating Play bar"); // Changed with Joe's approval, 21 Nov 2026
    const avatar = await box(page, "[data-app-header] [data-nav-avatar]");
    check(!!avatar && avatar.x < 40 && avatar.y < 80 && avatar.width >= 44 && avatar.height >= 44, `the avatar is top left and 44 px (${JSON.stringify(avatar)})`);
    check(!!(await page.locator("[data-app-header] [data-nav-avatar]").getAttribute("aria-label")), "the avatar has a screen-reader label");

    // Changed with Joe's approval, 21 Nov 2026 (P1: the Play page folded into Home): /play redirects to Home, and Home's
    // one gold button is the player banner's.
    check((await page.locator(".jz-btn[data-variant='gold']:visible").count()) === 1 && (await page.locator("[data-hp-banner] [data-hp-hero]").count()) === 1, "Home has one gold button, the banner's"); // Changed with Joe's approval, 21 Nov 2026
    await page.goto(`${origin}/play`);
    await waitPath(page, "/"); // Changed with Joe's approval, 21 Nov 2026
    check(path(page) === "/", "/play redirects to Home"); // Changed with Joe's approval, 21 Nov 2026
    await hydrated(page, "[data-app-tabbar] a");
    await page.waitForFunction(() => document.querySelectorAll("[data-app-tabbar] a").length === 5, undefined, { timeout: 20_000 }).catch(() => undefined);

    // Every tab opens its screen; Back from them returns to Home once, then leaves.
    await tapTab(page, "practice");
    await waitPath(page, "/practice");
    // Changed with Joe's approval, 14 Nov 2026 (routine consequence of the Games catalogue: titled "Games").
    await page.getByRole("heading", { level: 1, name: "Games" }).waitFor({ timeout: 60_000 });
    check((await page.locator("[data-nav-play]").count()) === 0, "Games has no Play bar"); // Changed with Joe's approval, 21 Nov 2026
    // Changed with Joe's approval, 14 Nov 2026 (routine consequence of the Games catalogue: the tab's page is titled
    // "Games", was "Practice").
    for (const [tab, to, heading] of [["practice", "/practice", "Games"], ["tournaments", "/tournaments", "Tournaments"], ["shop", "/shop", null], ["you", "/profile", "Profile"]] as const) { // Changed with Joe's approval, 21 Nov 2026
      await tapTab(page, tab);
      await waitPath(page, to);
      if (heading) await page.getByRole("heading", { level: 1, name: heading }).waitFor({ timeout: 30_000 });
      await page.locator(`[data-tab-screen='${tab === "you" ? "profile" : tab}']`).waitFor({ timeout: 30_000 }).catch(() => undefined); // Changed with Joe's approval, 21 Nov 2026
      check((await page.locator("[data-app-tabbar] [aria-current='page']").getAttribute("data-tab")) === tab, `${tab}: its tab is current`);
      check((await page.locator("[data-nav-play]").count()) === 0, `${tab}: no Play bar`); // Changed with Joe's approval, 21 Nov 2026
    }
    await page.goBack();
    await waitPath(page, "/");
    check(path(page) === "/", "Back from the last of several tabs returns to Home");
    // The check's own Shop switch (window.__DUELZ_SHOP_TAB__) differs from the server's page, so React redraws the bar
    // on start; that hydration notice is the check's doing (the plain page below must have none at all).
    const real = errors.filter((e) => !/^Hydration failed/.test(e));
    check(real.length === 0, `no page errors (${real.join(" | ")})`);
    await context.close();
  }

  /* No page errors (hydration included) on Home and More as everyone opens them. */
  for (const start of ["/", "/profile", "/tournaments"]) { // Changed with Joe's approval, 21 Nov 2026
    const { page, context, errors } = await openApp(start);
    await hydrated(page, "[data-app-tabbar] a");
    await page.waitForTimeout(1500);
    check(errors.length === 0, `${start}: no page errors (${errors.join(" | ")})`);
    await context.close();
  }

  /* Changed with Joe's approval, 21 Nov 2026 (P1: More folded into You, the Profile page; its rows are You's, P3's):
     /more redirects to You; a guest's avatar opens You with no sheet; You opened directly: Back to Home, then out. */
  {
    const { page, context } = await openApp("/more", { shop: true });
    await waitPath(page, "/profile");
    check(path(page) === "/profile", "/more redirects to You (/profile)"); // Changed with Joe's approval, 21 Nov 2026
    await hydrated(page, "[data-app-tabbar] a");
    check((await page.locator("[data-app-tabbar] [aria-current='page']").getAttribute("data-tab")) === "you", "You's tab is current on /profile"); // Changed with Joe's approval, 21 Nov 2026
    await page.goto(`${origin}/`);
    await hydrated(page, "[data-app-header] [data-nav-avatar]");
    await page.locator("[data-app-header] [data-nav-avatar]").click();
    await waitPath(page, "/profile");
    await page.waitForTimeout(600);
    check(path(page) === "/profile" && (await page.locator("[role='dialog']").count()) === 0, "a guest's avatar opens You (/profile), no sheet"); // Changed with Joe's approval, 21 Nov 2026
    await context.close();
  }
  {
    const { page, context } = await openApp("/profile");
    await hydrated(page, "[data-app-tabbar] a");
    await page.waitForTimeout(500);
    await page.goBack();
    await waitPath(page, "/");
    check(path(page) === "/", "a tab opened directly: Back returns to Home"); // Changed with Joe's approval, 21 Nov 2026
    await page.goBack();
    await page.waitForTimeout(800);
    check(!page.url().startsWith(origin) || page.url() === "about:blank", `then Back leaves the app (${page.url()})`); // Changed with Joe's approval, 21 Nov 2026
    await context.close();
  }

  /* Each main tab opened directly returns to Home on Back. */
  for (const start of ["/practice", "/tournaments"]) {
    const { page, context } = await openApp(start);
    await hydrated(page, "[data-app-tabbar] a");
    await page.waitForTimeout(500);
    await tapTab(page, "you"); // Changed with Joe's approval, 21 Nov 2026
    await waitPath(page, "/profile"); // Changed with Joe's approval, 21 Nov 2026
    await page.goBack();
    await waitPath(page, "/");
    check(path(page) === "/", `${start} opened directly, then You: Back returns to Home`); // Changed with Joe's approval, 21 Nov 2026
    await context.close();
  }

  /* Tablets: upright the tab bar, sideways the rail. */
  for (const [label, w, h, rail] of [["tablet upright 820×1180", 820, 1180, false], ["tablet sideways 1180×820", 1180, 820, true]] as const) {
    const { page, context } = await openApp("/tournaments", { w, h, touch: true, app: false }); // Changed with Joe's approval, 21 Nov 2026
    await hydrated(page, "[data-app-tabbar] a, [data-app-rail] a"); // Changed with Joe's approval, 21 Nov 2026
    await page.waitForTimeout(400);
    const bar = await page.locator("[data-app-tabbar]").count();
    const railed = await page.locator("[data-app-rail='full']").count();
    check(rail ? bar === 0 && railed === 1 : bar === 1 && railed === 0, `${label}: ${rail ? "the rail" : "the tab bar"} (bar ${bar}, rail ${railed})`);
    await context.close();
  }

  /* The computer: the rail by keyboard, a visible focus ring, collapsed in a room. */
  {
    const { page, context } = await openApp("/tournaments", { w: 1440, h: 900, touch: false, app: false }); // Changed with Joe's approval, 21 Nov 2026
    await hydrated(page, "[data-app-rail] [data-rail-tab]");
    const railTabs = await page.locator("[data-app-rail] [data-rail-tab]").evaluateAll((els) => els.map((el) => el.textContent?.trim()));
    check(railTabs.join(",") === "Home,Games,Compete,You", `the rail's destinations (${railTabs.join(",")})`); // Changed with Joe's approval, 21 Nov 2026
    check((await page.locator("[data-app-rail] [data-rail-account]").count()) === 1 && (await page.locator("[data-app-rail] [data-nav-play='rail']").count()) === 1, "the rail carries the avatar and the gold Play button");
    // Added 21 Nov 2026 (P1, Joe's rail rows of 20 Nov): under "More" the six rows, each opening its page; Settings at the foot.
    const more = await page.locator("[data-app-rail] [data-rail-more]").evaluateAll((els) => els.map((el) => el.getAttribute("data-rail-more")));
    check(more.join(",") === "daily,leaderboards,friends,challenges,badges,notifications", `the rail's More rows (${more.join(",")})`);
    const foot = await page.evaluate(() => {
      const rail = document.querySelector("[data-app-rail]")!.getBoundingClientRect();
      const settings = document.querySelector("[data-app-rail] [data-rail-settings]")!.getBoundingClientRect();
      const last = Array.from(document.querySelectorAll("[data-app-rail] [data-rail-more]")).pop()!.getBoundingClientRect();
      return { settings: settings.top, bottom: rail.bottom, last: last.bottom, h: settings.height };
    });
    check(foot.settings > foot.last && foot.bottom - (foot.settings + foot.h) < 40 && foot.h >= 44, `Settings sits at the rail's foot (${JSON.stringify(foot)})`);
    for (const [row, to] of [["daily", "/daily"], ["leaderboards", "/leaderboards"], ["challenges", "/challenges"], ["badges", "/badges"], ["notifications", "/settings"]] as const) {
      await page.locator(`[data-app-rail] [data-rail-more='${row}']`).click();
      await waitPath(page, to);
      check(path(page) === to, `the rail's ${row} opens ${to}`);
      await page.goBack();
      await waitPath(page, "/tournaments");
      await hydrated(page, "[data-app-rail] [data-rail-tab]");
    }
    // The guest rule of More's Friends row (14 Nov 2026), now on the rail's. // Changed with Joe's approval, 21 Nov 2026
    await page.locator("[data-app-rail] [data-rail-more='friends']").click();
    await page.waitForTimeout(600);
    check((await page.locator("[data-save-progress], [role='dialog']").count()) > 0 && path(page) === "/tournaments", "the rail's Friends offers a guest the save-your-progress sheet"); // Changed with Joe's approval, 21 Nov 2026
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    // The keyboard walk below starts from a fresh page, as before the rows above were added (they leave focus in the rail).
    await page.reload();
    await hydrated(page, "[data-app-rail] [data-rail-tab]");
    const seen: string[] = [];
    let ringed = 0;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || !el.closest("[data-app-rail]")) return null;
        const outline = parseFloat(getComputedStyle(el).outlineWidth) || 0;
        const frame = el.matches("[data-nav-play]") ? getComputedStyle(el, "::before").opacity : "0";
        return { name: el.getAttribute("data-rail-tab") ?? el.getAttribute("data-nav-play") ?? (el.hasAttribute("data-rail-account") ? "avatar" : el.tagName), ring: outline >= 2 || frame === "1" };
      });
      if (!info) continue;
      seen.push(info.name);
      if (info.ring) ringed++;
    }
    check(["avatar", "rail", "play", "practice", "tournaments", "you"].every((n) => seen.includes(n)), `Tab reaches the rail's avatar, Play and destinations (${seen.join(",")})`); // Changed with Joe's approval, 21 Nov 2026
    check(ringed === seen.length && seen.length > 0, `every focused rail item shows a focus ring (${ringed} of ${seen.length})`);
    await page.locator("[data-app-rail] [data-rail-tab='practice']").focus();
    await page.keyboard.press("Enter");
    await waitPath(page, "/practice");
    check(path(page) === "/practice", "Enter on a rail destination opens it");
    await context.close();
  }

  /* 3. The screen harness: an account's avatar, Tournaments with and without tournaments. */
  const harness = await startSafeAreaServer({ cacheDir: "node_modules/.vite-nav-check", buildId: "nav-check" });
  try {
    const PHONE = { name: "390x844", w: 390, h: 844 };
    const ACCOUNT = {
      kind: "account", userId: "00000000-0000-4000-8000-000000000042", username: "TheInventor", colour: 4, playerNumber: 42,
      founding: true, country: "GB", createdAt: "2026-11-10T12:00:00.000Z", status: "active", isUnder18: false, deletion: null,
      rename: { kind: "free" }, email: "inventor@example.com",
    };
    {
      const screen: ThemeScreen = { name: "nav: avatar, an account", mode: "home", plain: true, globals: { __harnessNavAccount: ACCOUNT } }; // Changed with Joe's approval, 21 Nov 2026
      const { context, page } = await openThemeScreen(browser, harness.origin, screen, PHONE);
      check((await page.locator("[data-app-header] [data-nav-avatar='account']").count()) === 1, "an account's avatar shows in the header");
      await page.locator("[data-app-header] [data-nav-avatar]").click();
      await page.waitForTimeout(300);
      const went = await page.evaluate(() => ((window as unknown as { __harness: { routerNavigations?: { to: string }[] } }).__harness.routerNavigations ?? []).map((n) => n.to));
      check(went.includes("/profile"), `an account's avatar opens Profile (${went.join(",")})`);
      check((await page.locator("[role='dialog']").count()) === 0, "no sheet for an account");
      await context.close();
    }
    {
      const screen: ThemeScreen = { name: "nav: tournaments, coming soon", mode: "tournaments", records: false };
      const { context, page } = await openThemeScreen(browser, harness.origin, screen, PHONE);
      check((await page.locator("[data-tournaments-soon]").count()) === 1, "a player without tournaments sees the coming-soon page");
      check((await page.locator("[data-public-none]").count()) === 0 && (await page.locator("[data-public-game]").count()) === 0, "with nothing scheduled the coming-soon page shows no list");
      await context.close();
    }
    {
      const hub = { open: true, account: true, now: Date.now(), live: [], next: null, week: [], entries: [], trophies: [] };
      const screen: ThemeScreen = { name: "nav: tournaments, a tester", mode: "tournaments", records: false, globals: { __DUELZ_ALLOW_TOURNAMENTS__: true, __harnessTournamentHub: hub } };
      const { context, page } = await openThemeScreen(browser, harness.origin, screen, PHONE);
      await page.waitForTimeout(800);
      check((await page.locator("[data-tournaments-soon]").count()) === 0, "a player with tournaments: no coming-soon page");
      check((await page.locator(".ap-beta").count()) === 1 && (await page.locator("[data-public-none]").count()) === 1, "a player with tournaments gets the tournaments screens as before");
      await context.close();
    }
  } finally {
    await harness.close();
  }
} finally {
  await browser.close();
  if (proc?.pid) {
    try {
      process.kill(-proc.pid);
    } catch {
      /* gone */
    }
  }
}

console.log(`nav-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  process.exit(1);
}
console.log("PASS: the navigation frame: destinations, no Play bar, /more and /play redirected, the avatar, Back to Home, tablets, the rail's tabs, More rows and keyboard, the launch screen and Tournaments for both kinds of player"); // Changed with Joe's approval, 21 Nov 2026
