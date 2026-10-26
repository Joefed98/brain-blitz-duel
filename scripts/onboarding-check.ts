/**
 * The first-time intro (16 Oct 2026, presentation only; src/components/duel/Onboarding.tsx,
 * src/lib/onboarding.ts). Draws the real home and room screens in headless Chromium through
 * scripts/safe-area-harness.tsx (network edge stubbed, scripts/safe-area-server.ts) and fails
 * unless:
 *  - a fresh device sees the intro card on home (tab pages refresh, 26 Oct 2026: the first-time intro
 *    is a card at the top of the Play tab, src/components/app/IntroCard.tsx), and its How it works
 *    opens the three panels with dots, Next and Skip on each;
 *  - Let's play and Skip both land on home, closing the card removes it, and neither the card nor the
 *    panels show again on reload;
 *  - a swipe turns the panel either way, and Next plays the existing lock cue (no new sound);
 *  - a room invite link opens the room with no intro, and home never shows it afterwards;
 *  - "How it works" on home reopens it at any time;
 *  - with the flag's storage failing it still shows once a session;
 *  - reduced motion drops the slide;
 *  - at 414x896 (48/34 px insets, the iPhone 11 home-screen app), 390x844, 375x667 and 360x800
 *    (47/34 px insets) every panel fits without scrolling, nothing sits under the notch or home
 *    bar, and Skip and Next are at least 44 px tall;
 *  - the third panel states the games' top score from roundMax.ts ("Every game scores up to 150"
 *    while every game shares it, "Games score up to 200" once one game is raised; topRoundMax).
 *
 *   bun scripts/onboarding-check.ts [--verbose] [--shots=.shots]
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import type { Browser, BrowserContext, Page } from "playwright";

import { startSafeAreaServer } from "./safe-area-server";
import { gotoRetried, warmUp } from "./browser-load";
import { ONBOARDING_KEY } from "../src/lib/onboarding";
import { APP_NAME } from "../src/lib/brand";
import { ROUND_MAX } from "../src/lib/duel/roundMax";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData } from "../src/lib/duel/types";

const VERBOSE = process.argv.includes("--verbose");
/** --shots=<dir>: save each panel at each size (a design aid; keep it in the gitignored .shots/). */
const SHOTS = process.argv.find((a) => a.startsWith("--shots="))?.slice(8);
const SIZES = [
  { w: 414, h: 896, top: 48, bottom: 34 },
  { w: 390, h: 844, top: 47, bottom: 34 },
  { w: 375, h: 667, top: 47, bottom: 34 },
  { w: 360, h: 800, top: 47, bottom: 34 },
] as const;
const TITLES = ["Quick games. Real rivals.", "Same game, same time.", "Score big, win the room."];
/**
 * The third panel's opening, worked out here from the games' own maximums (ROUND_MAX), not from the
 * app's topRoundMax: the highest maximum, "Every game" while all share it, "Games" once they differ.
 */
const MAXES = Object.values(ROUND_MAX);
const TOP = Math.max(...MAXES);
const SCORE_LINE = `${MAXES.every((m) => m === TOP) ? "Every game scores" : "Games score"} up to ${TOP}.`;

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);
const ok = (msg: string) => console.log(`PASS ${msg}`);

/* ------------------------------------------------------------- source rules */

{
  const home = readFileSync("src/routes/index.tsx", "utf8");
  const room = readFileSync("src/routes/duel.$code.tsx", "utf8");
  const intro = readFileSync("src/components/duel/Onboarding.tsx", "utf8");
  if (!/onboardingSeen\(\)/.test(home)) fail("source: home does not read the onboarding flag");
  if (!/markOnboardingSeen\(\)/.test(room)) fail("source: the room route does not mark the intro seen");
  if (new RegExp(APP_NAME).test(intro.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")))
    fail(`source: Onboarding.tsx spells the app name (take it from APP_NAME)`);
  // A body may be a template literal (the third panel's top score comes from roundMax.ts).
  const copy = intro.match(/(?:title|body): (?:"[^"]*"|`[^`]*`)/g) ?? [];
  if (copy.length !== 6) fail(`source: expected 3 titles and 3 bodies, found ${copy.length}`);
  // Sound: only the existing lock cue, nothing new.
  const sounds = intro.match(/play[A-Z]\w*\(/g) ?? [];
  if (sounds.some((s) => s !== "playLock(")) fail(`source: Onboarding.tsx plays ${sounds.join(", ")} (only playLock is allowed)`);
  // Presentation only: the flag module imports nothing, the intro no game, sim or room code.
  if (/^import /m.test(readFileSync("src/lib/onboarding.ts", "utf8"))) fail("source: src/lib/onboarding.ts imports code");
  // The one exception is the games' maximums (roundMax.ts), which imports nothing but types.
  const libImports = intro.match(/from "@\/lib\/(arcade|duel)\/[^"]*"/g) ?? [];
  if (libImports.some((i) => i !== 'from "@/lib/duel/roundMax"')) fail("source: Onboarding.tsx imports game or room code");
  if (/^import (?!type )/m.test(readFileSync("src/lib/duel/roundMax.ts", "utf8"))) fail("source: roundMax.ts (read by the intro) imports code");
  if (!failures.length) ok("source: home reads the flag, the room marks it, no name or new sound in the intro");
}

/* ------------------------------------------------------------------ browser */

const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

const PUZZLE = splitPuzzle(withSeededRandom(41, () => generatePuzzle("sudoku"))).pub as PuzzleData;
function lobby() {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const player = (slot: number, name: string) => ({
    id: `p${slot}`,
    duel_id: "duel-safe",
    player_slot: slot,
    display_name: name,
    user_id: `u${slot}`,
    ready_round: 0,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: iso(now),
    status: "active",
    joined_at: iso(now - 60_000),
  });
  return {
    duel: {
      id: "duel-safe",
      room_code: "SAFE",
      status: "waiting",
      selected_categories: [],
      tournament_history: [],
      disbanded_at: null,
      host_user_id: "u1",
      max_players: 10,
      round_count: 1,
      round_order: ["sudoku"],
      no_maths: false,
      puzzles_public: [PUZZLE],
      current_round: 0,
      phase: "starting",
      phase_started_at: iso(now + 500),
      round_started_at: iso(now + 500),
      next_duel_id: null,
      created_at: iso(now - 60_000),
    },
    players: [player(1, "Me"), player(2, "Friend")],
    results: [],
  };
}

interface Opts {
  w?: number;
  h?: number;
  top?: number;
  bottom?: number;
  reducedMotion?: boolean;
  /** The flag's localStorage fails (reads and writes of the onboarding key throw). */
  brokenStorage?: boolean;
}

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-onboarding", buildId: "onboarding-check" });
const { chromium } = await import("playwright");
const browser: Browser = await chromium.launch({ executablePath: CHROMIUM });

async function newDevice(opts: Opts = {}): Promise<{ context: BrowserContext; page: Page; cues: () => Promise<string[]> }> {
  const context = await browser.newContext({
    viewport: { width: opts.w ?? 390, height: opts.h ?? 844 },
    reducedMotion: opts.reducedMotion ? "reduce" : "no-preference",
    hasTouch: false,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send(
    "Emulation.setSafeAreaInsetsOverride" as never,
    { insets: { top: opts.top ?? 47, bottom: opts.bottom ?? 34 } } as never,
  );
  page.on("pageerror", (e) => {
    if (VERBOSE) console.log(`  page error: ${e.message.split("\n")[0]}`);
  });
  await page.addInitScript(
    (r) => {
      const w = window as unknown as { __harness: unknown; __cues: string[] };
      w.__harness = {
        puzzles: { sudoku: r.puzzle },
        verdict: { isCorrect: true, score: 150 },
        latencyMs: 50,
        submissions: [],
        verdictAt: null,
        room: r.room,
      };
      w.__cues = [];
      window.addEventListener("duelz-cue", (e) => w.__cues.push(String((e as CustomEvent).detail)));
      if (r.broken) {
        const get = Storage.prototype.getItem;
        const set = Storage.prototype.setItem;
        Storage.prototype.getItem = function (key: string) {
          if (this === window.localStorage && key === r.key) throw new Error("storage blocked");
          return get.call(this, key);
        };
        Storage.prototype.setItem = function (key: string, value: string) {
          if (this === window.localStorage && key === r.key) throw new Error("storage blocked");
          return set.call(this, key, value);
        };
      }
    },
    { puzzle: PUZZLE, room: lobby(), broken: Boolean(opts.brokenStorage), key: ONBOARDING_KEY },
  );
  return { context, page, cues: () => page.evaluate(() => (window as unknown as { __cues: string[] }).__cues) };
}

async function open(page: Page, mode: "home" | "room", where: string) {
  await gotoRetried(page, `${server.origin}/safe-area.html?mode=${mode}`, where);
  await page.waitForSelector("#root *", { timeout: 60_000 });
  // Home decides after mount; give the effect and the entrance time to land.
  await page.waitForTimeout(500);
}

const introUp = (page: Page) => page.locator("[data-onboarding]").count().then((n) => n > 0);
/** The first-time intro card on the Play tab, drawn (not collapsed away). */
const cardUp = (page: Page) =>
  page.locator("[data-intro-card]").evaluateAll((els) => els.some((el) => el.getBoundingClientRect().height > 0 && !el.closest("[data-slot-state='hide']")));
/** The card's How it works: the three panels. */
async function openFromCard(page: Page) {
  await page.locator("[data-intro-how]").click();
  await page.locator("[data-onboarding]").waitFor({ timeout: 10_000 });
}
const homeUp = (page: Page) => page.getByRole("button", { name: "Create a room" }).count().then((n) => n > 0);
const currentPanel = (page: Page) =>
  page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll("[data-onboarding-dot]"));
    return dots.findIndex((d) => d.getAttribute("data-onboarding-dot") === "current") + 1;
  });
/** Waits out the slide (300 ms) before measuring. */
const settle = (page: Page) => page.waitForTimeout(450);

/** In-page geometry of the intro's current panel. */
function measure(arg: { top: number; bottom: number }) {
  const H = window.innerHeight;
  const out: string[] = [];
  const root = document.documentElement;
  window.scrollTo(0, root.scrollHeight);
  if (window.scrollY > 0) out.push(`the page scrolls ${window.scrollY}px`);
  window.scrollTo(0, 0);
  const dialog = document.querySelector("[data-onboarding]")!;
  for (const el of [dialog, ...Array.from(dialog.querySelectorAll("*"))] as HTMLElement[]) {
    if (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))
      out.push(`${el.tagName.toLowerCase()} scrolls`);
  }
  const index = Array.from(dialog.querySelectorAll("[data-onboarding-dot]")).findIndex(
    (d) => d.getAttribute("data-onboarding-dot") === "current",
  );
  const panel = dialog.querySelector(`[data-onboarding-panel="${index + 1}"]`)!;
  const track = dialog.querySelector("[data-onboarding-track]")!.getBoundingClientRect();
  const visible = [
    ...Array.from(panel.querySelectorAll("h2, p")),
    dialog.querySelector("[data-onboarding-skip]")!,
    dialog.querySelector("[data-onboarding-next]")!,
  ];
  for (const el of visible) {
    const r = el.getBoundingClientRect();
    const label = (el.textContent ?? "").trim().slice(0, 24);
    if (r.top < arg.top - 0.5) out.push(`"${label}" under the notch (top ${Math.round(r.top)}px)`);
    if (r.bottom > H - arg.bottom + 0.5) out.push(`"${label}" under the home bar (${Math.round(H - r.bottom)}px from the bottom)`);
    if (el.closest("[data-onboarding-panel]") && (r.top < track.top - 0.5 || r.bottom > track.bottom + 0.5))
      out.push(`"${label}" clipped by the panel area`);
    if (r.left < -0.5 || r.right > window.innerWidth + 0.5) out.push(`"${label}" off the side of the screen`);
  }
  for (const sel of ["[data-onboarding-skip]", "[data-onboarding-next]"]) {
    const r = dialog.querySelector(sel)!.getBoundingClientRect();
    if (r.height < 44) out.push(`${sel} is ${r.height}px tall (min 44)`);
  }
  const h2 = panel.querySelector("h2")!.textContent;
  const body = panel.querySelector("p")!.textContent;
  return { out, title: h2, body };
}

try {
  await warmUp(browser, `${server.origin}/safe-area.html?mode=home`, (p) => p.waitForSelector("#root *", { timeout: 120_000 }), {
    verbose: VERBOSE,
    init: () => {
      (window as unknown as { __harness: unknown }).__harness = { puzzles: {}, verdict: { isCorrect: true, score: 150 }, latencyMs: 50, submissions: [], verdictAt: null, room: null };
    },
  });
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });

  /* Every size: a fresh device sees the intro; each panel fits; Let's play lands on home; no repeat. */
  for (const size of SIZES) {
    const where = `${size.w}x${size.h}`;
    const { context, page, cues } = await newDevice(size);
    try {
      await open(page, "home", where);
      if (!(await cardUp(page))) {
        fail(`${where}: a fresh device did not see the intro card on home`);
        continue;
      }
      if (await introUp(page)) fail(`${where}: the panels opened by themselves (the card stands in for them)`);
      await openFromCard(page);
      const before = failures.length;
      for (let i = 0; i < 3; i++) {
        await settle(page);
        const m = await page.evaluate(measure, { top: size.top, bottom: size.bottom });
        if (m.title !== TITLES[i]) fail(`${where}: panel ${i + 1} title "${m.title}" (expected "${TITLES[i]}")`);
        if (i === 2 && !m.body?.startsWith(SCORE_LINE)) fail(`${where}: panel 3 says "${m.body}" (expected it to open "${SCORE_LINE}")`);
        if ((await currentPanel(page)) !== i + 1) fail(`${where}: dots show panel ${await currentPanel(page)} on panel ${i + 1}`);
        for (const o of m.out) fail(`${where} panel ${i + 1}: ${o}`);
        const label = (await page.locator("[data-onboarding-next]").textContent())?.trim();
        if (label !== (i === 2 ? "Let's play" : "Next")) fail(`${where} panel ${i + 1}: button says "${label}"`);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/onboarding-${i + 1}-${where}.png` });
        await page.locator("[data-onboarding-next]").click();
      }
      await page.waitForTimeout(300);
      if (await introUp(page)) fail(`${where}: Let's play did not close the intro`);
      if (!(await homeUp(page))) fail(`${where}: Let's play did not land on home`);
      const lockCues = (await cues()).filter((c) => c === "lock").length;
      if (lockCues !== 2) fail(`${where}: Next played the lock cue ${lockCues} times over two Nexts (expected 2, none on Let's play)`);
      const other = (await cues()).filter((c) => c !== "lock");
      if (other.length) fail(`${where}: the intro played ${other.join(", ")}`);
      await open(page, "home", where);
      if (await introUp(page)) fail(`${where}: the intro showed again after Let's play`);
      if (await cardUp(page)) fail(`${where}: the intro card showed again on reload`);
      if (failures.length === before) ok(`${where}: the card, then three panels that fit with no scrolling, clear of the insets; Let's play lands on home once`);
    } finally {
      await context.close();
    }
  }

  /* Skip on the first panel lands on home, for good. */
  {
    const { context, page } = await newDevice();
    const before = failures.length;
    await open(page, "home", "skip");
    if (!(await cardUp(page))) fail("skip: no intro card on a fresh device");
    await openFromCard(page);
    await page.locator("[data-onboarding-skip]").click();
    await page.waitForTimeout(300);
    if (await introUp(page)) fail("skip: Skip did not close the intro");
    if (!(await homeUp(page))) fail("skip: Skip did not land on home");
    // The card's close button removes it (it collapses away).
    await page.locator("[data-intro-close]").click();
    await page.waitForTimeout(700);
    if (await cardUp(page)) fail("skip: the card's close button did not remove it");
    await open(page, "home", "skip");
    if ((await introUp(page)) || (await cardUp(page))) fail("skip: the intro showed again after Skip");
    // Skip on a later panel too.
    await page.getByRole("button", { name: "How it works" }).click();
    await page.locator("[data-onboarding-next]").click();
    await settle(page);
    await page.locator("[data-onboarding-skip]").click();
    await page.waitForTimeout(300);
    if (!(await homeUp(page)) || (await introUp(page))) fail("skip: Skip on panel 2 did not land on home");
    if (failures.length === before) ok("Skip (panel 1 and 2) lands on home, the card closes, and the intro does not return");
    await context.close();
  }

  /* Swipe left and right. */
  {
    const { context, page } = await newDevice();
    const before = failures.length;
    await open(page, "home", "swipe");
    await openFromCard(page);
    const box = (await page.locator("[data-onboarding-track]").boundingBox())!;
    const y = box.y + box.height / 2;
    const swipe = async (from: number, to: number) => {
      await page.mouse.move(from, y);
      await page.mouse.down();
      for (let s = 1; s <= 6; s++) await page.mouse.move(from + ((to - from) * s) / 6, y);
      await page.mouse.up();
      await settle(page);
    };
    await swipe(box.x + box.width * 0.8, box.x + box.width * 0.2);
    if ((await currentPanel(page)) !== 2) fail(`swipe: a left swipe left the intro on panel ${await currentPanel(page)}`);
    await swipe(box.x + box.width * 0.8, box.x + box.width * 0.2);
    if ((await currentPanel(page)) !== 3) fail(`swipe: a second left swipe left the intro on panel ${await currentPanel(page)}`);
    await swipe(box.x + box.width * 0.2, box.x + box.width * 0.8);
    if ((await currentPanel(page)) !== 2) fail(`swipe: a right swipe left the intro on panel ${await currentPanel(page)}`);
    await swipe(box.x + box.width * 0.5, box.x + box.width * 0.45);
    if ((await currentPanel(page)) !== 2) fail("swipe: a short drag turned the panel");
    if (failures.length === before) ok("swipe: left and right turn the panel; a short drag does not");
    await context.close();
  }

  /* A room invite link: straight to the room, never the intro later. */
  {
    const { context, page } = await newDevice();
    const before = failures.length;
    await open(page, "room", "invite");
    await page.waitForTimeout(800);
    if (await introUp(page)) fail("invite: the room link showed the intro");
    const text = await page.locator("#root").innerText();
    if (!/SAFE/.test(text)) fail("invite: the room did not render (no room code on screen)");
    await open(page, "home", "invite");
    if ((await introUp(page)) || (await cardUp(page))) fail("invite: home showed the intro after arriving by a room link");
    if (!(await homeUp(page))) fail("invite: home did not render afterwards");
    if (failures.length === before) ok("room invite link: straight to the room, and no intro on home afterwards");
    await context.close();
  }

  /* "How it works" reopens the intro at any time. */
  {
    const { context, page } = await newDevice();
    const before = failures.length;
    await page.addInitScript((key) => localStorage.setItem(key, "1"), ONBOARDING_KEY);
    await open(page, "home", "how it works");
    if ((await introUp(page)) || (await cardUp(page))) fail("how it works: the intro showed on a device that has seen it");
    for (let round = 0; round < 2; round++) {
      await page.getByRole("button", { name: "How it works" }).click();
      await settle(page);
      if (!(await introUp(page))) fail(`how it works: the link did not reopen the intro (time ${round + 1})`);
      if ((await currentPanel(page)) !== 1) fail("how it works: the intro did not open on panel 1");
      await page.locator("[data-onboarding-skip]").click();
      await page.waitForTimeout(300);
      if (!(await homeUp(page))) fail("how it works: closing the reopened intro did not land on home");
    }
    if (failures.length === before) ok('"How it works" on home reopens the three panels, and closing lands on home');
    await context.close();
  }

  /* The flag's storage fails: once a session. */
  {
    const { context, page } = await newDevice({ brokenStorage: true });
    const before = failures.length;
    await open(page, "home", "storage");
    if (!(await cardUp(page))) fail("storage: with localStorage failing a fresh device saw no intro card");
    await openFromCard(page);
    await page.locator("[data-onboarding-skip]").click();
    await page.waitForTimeout(300);
    if (!(await homeUp(page))) fail("storage: Skip did not land on home with localStorage failing");
    await open(page, "home", "storage");
    if ((await introUp(page)) || (await cardUp(page))) fail("storage: the intro showed twice in one session with localStorage failing");
    if (failures.length === before) ok("storage failing: the intro shows once a session (sessionStorage fallback), no errors");
    await context.close();
  }

  /* Reduced motion: no slide. */
  {
    const { context, page } = await newDevice({ reducedMotion: true });
    await open(page, "home", "reduced motion");
    await openFromCard(page);
    const duration = await page.evaluate(
      () => getComputedStyle(document.querySelector("[data-onboarding-track] > div")!).transitionDuration,
    );
    // The app's global reduced-motion rule may leave a token 0.01 ms; anything under 10 ms is no slide.
    if (!(parseFloat(duration) < 0.01)) fail(`reduced motion: the panels still slide (transition ${duration})`);
    else ok("reduced motion: the panels change without sliding");
    await context.close();
  }
} catch (error) {
  fail(`did not run: ${String((error as Error).message ?? error).split("\n")[0]}`);
} finally {
  await browser.close();
  await server.close();
}

for (const f of failures) console.log(`  ${f}`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} onboarding problem(s)`);
  process.exit(1);
}
console.log("PASS: first-time intro card shows once on home, its How it works opens the panels, never after a room link, reopens from How it works, and fits at 414x896, 390x844, 375x667 and 360x800");
