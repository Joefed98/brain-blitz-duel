/**
 * Safe areas on the non-game screens (14 Oct 2026). The app's viewport is
 * `viewport-fit=cover` (so the game screens can pad the home bar), which lets every page
 * draw under a phone's notch, status bar and home bar. This check draws the real screens
 * in headless Chromium with a notch and home bar emulated (CDP
 * Emulation.setSafeAreaInsetsOverride: 47 px top, 34 px bottom, as an iPhone 14 in
 * portrait) at 375 × 667 and 390 × 844, and fails if any text or control sits under
 * either inset: at the top of the page, and (for a page that scrolls) at the bottom of
 * its scroll; or if a control at the top of the page is covered by another element
 * (the room's sticky chat bar over READY, for one).
 *
 * Screens: home (room join), the first-time intro (a fresh device), practice list, tournaments, profile (the app shell's
 * tab screens, 18 Oct 2026), the sound settings popover, a practice
 * round intro, an in-game help sheet, and a room's lobby, link join, Prepare to Duel
 * (starting), round title, round intro, round result, standings, winner reveal and
 * podium. The room screens come from the real room route (src/routes/duel.$code.tsx)
 * through scripts/safe-area-harness.tsx with only the network edge stubbed (the same
 * stubs as beat-hold-browser-check).
 *
 *   bun scripts/safe-area-screens-check.tsx [--verbose] [--shots=.shots]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Page } from "playwright";

import { startSafeAreaServer } from "./safe-area-server";
import { ONBOARDING_KEY } from "../src/lib/onboarding";

import { DEVICE_INIT, IPHONE11_APP, emulateDevice, type DeviceConfig } from "./device-emulation";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData } from "../src/lib/duel/types";
import { gameDisplayName as gameName } from "../src/lib/duel/gameNames";

const VERBOSE = process.argv.includes("--verbose");
/** --shots=<dir>: save each screen (a design aid; keep it in the gitignored .shots/). */
const SHOTS = process.argv.find((a) => a.startsWith("--shots="))?.slice(8);
/** --insets=T,B overrides the emulated notch and home bar (e.g. 0,0 to compare a plain phone). */
const INSET_ARG = process.argv
  .find((a) => a.startsWith("--insets="))
  ?.slice(9)
  .split(",")
  .map(Number);
const INSETS = { top: INSET_ARG?.[0] ?? 47, bottom: INSET_ARG?.[1] ?? 34 };
const SIZES = [
  [375, 667],
  [390, 844],
] as const;

const CHROMIUM = [
  process.env.PLAYWRIGHT_CHROMIUM,
  "/opt/pw-browsers/chromium",
  "/usr/bin/chromium",
].find((path): path is string => Boolean(path && existsSync(path)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

const rootMeta = readFileSync("src/routes/__root.tsx", "utf8");
if (!/viewport-fit=cover/.test(rootMeta)) {
  console.log(
    "FAIL: src/routes/__root.tsx viewport has no viewport-fit=cover (the harness assumes it)",
  );
  process.exit(1);
}

// The stubbed network edge (as beat-hold) and the harness page: scripts/safe-area-server.ts.
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-safe-area", buildId: "safe-area-check" });
const origin = server.origin;

/* ---------------------------------------------------------------- the room states */

const PUZZLE = splitPuzzle(withSeededRandom(41, () => generatePuzzle("sudoku"))).pub as PuzzleData;
const iso = (ms: number) => new Date(ms).toISOString();

/** A room state, built when its screen loads so its phase clock and presence are current. */
const room =
  (status: "waiting" | "in_progress" | "finished", phase: string, opts: { join?: boolean } = {}) =>
  () =>
    roomNow(status, phase, opts);
function roomNow(
  status: "waiting" | "in_progress" | "finished",
  phase: string,
  opts: { join?: boolean },
) {
  const now = Date.now();
  const player = (slot: number, name: string) => ({
    id: `p${slot}`,
    duel_id: "duel-safe",
    player_slot: slot,
    display_name: name,
    user_id: `u${slot}`,
    ready_round: 1,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: iso(now),
    status: "active",
    joined_at: iso(now - 60_000),
  });
  const result = (slot: number, score: number) => ({
    id: `r${slot}`,
    duel_id: "duel-safe",
    player_slot: slot,
    round_number: 1,
    answer: "",
    is_correct: score > 100,
    ms_remaining: 20_000,
    reaction_avg_ms: null,
    correct_count: null,
    errors: null,
    extra: null,
    score,
    submitted_at: iso(now - 5_000),
  });
  const scored = status === "finished" || ["result", "standings", "winner_reveal"].includes(phase);
  return {
    duel: {
      id: "duel-safe",
      room_code: "SAFE",
      status,
      selected_categories: [],
      tournament_history: [],
      disbanded_at: null,
      host_user_id: "u1",
      max_players: 10,
      round_count: 1,
      round_order: ["sudoku"],
      no_maths: false,
      puzzles_public: [PUZZLE],
      current_round: status === "waiting" ? 0 : 1,
      phase,
      phase_started_at: iso(now + 500),
      round_started_at: iso(now + 500),
      next_duel_id: null,
      created_at: iso(now - 60_000),
    },
    // Link join: this phone's player row has left a lobby, so the room offers the name-only join.
    players: opts.join
      ? [
          { ...player(1, "Me with a long name"), status: "left" },
          player(2, "Another long player name"),
        ]
      : [player(1, "Me with a long name"), player(2, "Another long player name")],
    results: scored ? [result(1, 182), result(2, 140)] : [],
  };
}

interface Screen {
  name: string;
  mode: "home" | "practice" | "tournaments" | "profile" | "room";
  room?: () => ReturnType<typeof roomNow>;
  /** Steps after load (practice), then a settle wait. */
  go?: (page: Page) => Promise<void>;
  waitMs?: number;
  /** An open popover or sheet covers the screen's controls on purpose: skip the cover test. */
  overlay?: boolean;
  /** The screen must fit without scrolling (RoundIntro never scrolls; the shared-clock moments). */
  fits?: boolean;
  /** A fresh device: the first-time intro is up (every other screen has seen it, src/lib/onboarding.ts). */
  fresh?: boolean;
}
const openGame = async (page: Page) => {
  await page.getByRole("button", { name: "Box Six", exact: true }).first().click();
  await page
    .getByRole("button", { name: /^Ready/ })
    .first()
    .waitFor({ timeout: 30_000 });
};
const ONLY = process.argv.filter((a) => !a.startsWith("--")).slice(2);
/** --geometry=<file>: write the room play-header cases' boxes as JSON (before → after comparisons). */
const GEOMETRY = process.argv.find((a) => a.startsWith("--geometry="))?.slice(11);
const ALL_SCREENS: Screen[] = [
  { name: "home (room join)", mode: "home" },
  // Tab pages refresh (26 Oct 2026): the first visit's intro is a card at the top of the Play tab, a page
  // that scrolls like the other tab pages; its three panels (How it works) are judged to fit, without
  // scrolling, at four sizes by onboarding-check.
  { name: "first-time intro", mode: "home", fresh: true },
  { name: "practice list", mode: "practice" },
  { name: "tournaments", mode: "tournaments" },
  { name: "profile", mode: "profile" },
  {
    name: "sound settings",
    mode: "practice",
    overlay: true,
    go: async (page) => {
      await page.locator("[data-sound-channel=effects]").first().click();
      await page.getByRole("dialog").first().waitFor({ timeout: 10_000 });
    },
  },
  { name: "practice round intro", mode: "practice", go: openGame, fits: true },
  {
    name: "help sheet",
    mode: "practice",
    overlay: true,
    go: async (page) => {
      await openGame(page);
      await page
        .getByRole("button", { name: /^Ready/ })
        .first()
        .click();
      await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
      await page.getByRole("button", { name: "Show puzzle instructions" }).first().click();
      await page.getByRole("button", { name: "Close help" }).first().waitFor({ timeout: 10_000 });
    },
  },
  { name: "room lobby", mode: "room", room: room("waiting", "starting") },
  { name: "room link join", mode: "room", room: room("waiting", "starting", { join: true }) },
  {
    name: "Prepare to Duel",
    mode: "room",
    room: room("in_progress", "starting"),
    waitMs: 1200,
    fits: true,
  },
  {
    name: "round title",
    mode: "room",
    room: room("in_progress", "round_title"),
    waitMs: 200,
    fits: true,
  },
  {
    name: "room round intro",
    mode: "room",
    room: room("in_progress", "intro"),
    waitMs: 1500,
    fits: true,
  },
  { name: "round result", mode: "room", room: room("in_progress", "result"), waitMs: 2500 },
  { name: "standings", mode: "room", room: room("in_progress", "standings"), waitMs: 2500 },
  {
    name: "winner reveal",
    mode: "room",
    room: room("in_progress", "winner_reveal"),
    waitMs: 3000,
    fits: true,
  },
  { name: "podium", mode: "room", room: room("finished", "result"), waitMs: 3000 },
];

const SCREENS = ONLY.length
  ? ALL_SCREENS.filter((x) => ONLY.some((o) => x.name.includes(o)))
  : ALL_SCREENS;

/* ---------------------------------------------------------------- the measurement */

interface Hit {
  edge: "top" | "bottom" | "covered";
  label: string;
  at: number;
}

/** In-page: text and controls whose visible part sits under the top or bottom inset. */
function underInsets(arg: {
  top: number;
  bottom: number;
  edge: "top" | "bottom" | "both";
  covers: boolean;
}): Hit[] {
  const out: Hit[] = [];
  const H = window.innerHeight;
  const hidden = (el: Element) => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      if (n.getAttribute("aria-hidden") === "true") return true;
      // Inside a closed <details> (other than its summary): not drawn.
      if (
        n.parentElement?.tagName === "DETAILS" &&
        !(n.parentElement as HTMLDetailsElement).open &&
        n.tagName !== "SUMMARY"
      )
        return true;
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05)
        return true;
    }
    return false;
  };
  const controls =
    "button, a[href], input, select, textarea, [role='button'], [role='slider'], [role='tab']";
  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    const isControl = el.matches(controls);
    const hasText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "",
    );
    if (!isControl && !hasText) continue;
    if (el.closest("svg") && !isControl) continue;
    if (hidden(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    // The part actually shown: clipped by every scrolling/clipping ancestor and the screen.
    let top = Math.max(r.top, 0);
    let bottom = Math.min(r.bottom, H);
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowY)) {
        const b = n.getBoundingClientRect();
        top = Math.max(top, b.top);
        bottom = Math.min(bottom, b.bottom);
      }
    }
    if (bottom - top < 1) continue;
    const label =
      (el.getAttribute("aria-label") ?? (el.textContent ?? "").trim()).slice(0, 32) ||
      el.tagName.toLowerCase();
    // A control drawn under another element (a sticky bar over READY, say) cannot be tapped.
    if (arg.covers && isControl) {
      const hit = document.elementFromPoint(
        (Math.max(r.left, 0) + Math.min(r.right, window.innerWidth)) / 2,
        (top + bottom) / 2,
      );
      if (hit && !el.contains(hit) && !hit.contains(el))
        out.push({ edge: "covered", label, at: Math.round((top + bottom) / 2) });
    }
    if (arg.edge !== "bottom" && top < arg.top - 0.5)
      out.push({ edge: "top", label, at: Math.round(top) });
    if (arg.edge !== "top" && bottom > H - arg.bottom + 0.5)
      out.push({ edge: "bottom", label, at: Math.round(H - bottom) });
  }
  return out;
}


/* ------------------------------------------------- the room play header (16 Oct 2026) */

/**
 * The room's play header: the game frame's 60px header (Polish 2, 24 Oct 2026; until then the
 * arcade's 44px row with RoundLabel beside the timer, 16 Oct 2026). Each case draws a room's live
 * round, arcade and puzzle, through the real room route and checks: the header is 60px at the top
 * inset (or 0) and an arcade arena starts directly under it; the timer is exactly centred; the
 * game's name is never cut (one line, or two for a long name) and the context line reads
 * "Round n of N" whole; the left half, the timer and every right-hand item keep the grid's 8px apart
 * and stay on screen; a puzzle screen has its goal line under the header. Every box is written with
 * --geometry=<file> so a run on main and one here compare before → after.
 */
interface HeaderSize {
  name: string;
  device: DeviceConfig;
  w: number;
  h: number;
  top: number;
  bottom: number;
}
/** A phone in the browser (not a home-screen app) with its insets. */
const phone = (w: number, h: number, top: number, bottom: number): DeviceConfig => ({ key: `${w}x${h}`, label: `${w}x${h}`, w, h, screenH: h, top, bottom, standalone: false });
const HEADER_SIZES: HeaderSize[] = [
  { name: "414x896 iPhone 11 home-screen app", device: IPHONE11_APP, w: 414, h: 848, top: 48, bottom: 34 },
  { name: "390x844", device: phone(390, 844, 47, 34), w: 390, h: 844, top: 47, bottom: 34 },
  { name: "375x667", device: phone(375, 667, 0, 0), w: 375, h: 667, top: 0, bottom: 0 },
  { name: "360x800", device: phone(360, 800, 0, 0), w: 360, h: 800, top: 0, bottom: 0 },
  // Wider screens (a tablet, a desktop window) exercise the wider forms.
  { name: "600x900", device: phone(600, 900, 0, 0), w: 600, h: 900, top: 0, bottom: 0 },
  { name: "1024x768", device: phone(1024, 768, 0, 0), w: 1024, h: 768, top: 0, bottom: 0 },
];
/** The longest display name in the bank, drawn as an arcade game's name. */
const LONGEST_NAME = "Don't Break the Chain";
interface HeaderCase {
  name: string;
  type: string;
  round: number;
  rounds: number;
  players: number;
  /** A display name drawn in place of the game's own. */
  as?: string;
  /** Expected long round text ("Round 2 of 6" / "Final round"); undefined on a puzzle screen. */
  long?: string;
}
const HEADER_CASES: HeaderCase[] = [
  { name: "Gemstone 2 of 6", type: "matchup", round: 2, rounds: 6, players: 2, long: "Round 2 of 6" },
  { name: "Rainbow Bridge 3 of 7", type: "inkbridge", round: 3, rounds: 7, players: 2, long: "Round 3 of 7" },
  { name: "longest name, final of 7", type: "inkbridge", round: 7, rounds: 7, players: 3, as: LONGEST_NAME, long: "Final round" },
  { name: "Mixed Signals 7 of 7", type: "stroop", round: 7, rounds: 7, players: 2, long: "Final round" },
  { name: "puzzle Box Six 2 of 7", type: "sudoku", round: 2, rounds: 7, players: 2 },
  { name: "puzzle Don't Break the Chain 6 of 6", type: "chain", round: 6, rounds: 6, players: 3 },
];

function headerRoom(c: HeaderCase, puzzle: PuzzleData) {
  const base = roomNow("in_progress", "puzzle", {});
  const extra = Array.from({ length: Math.max(0, c.players - 2) }, (_, i) => ({
    ...base.players[1]!,
    id: `p${i + 3}`,
    player_slot: i + 3,
    user_id: `u${i + 3}`,
    display_name: `Player ${i + 3}`,
  }));
  return {
    ...base,
    duel: {
      ...base.duel,
      round_count: c.rounds,
      round_order: Array.from({ length: c.rounds }, () => c.type),
      puzzles_public: Array.from({ length: c.rounds }, () => puzzle),
      current_round: c.round,
    },
    players: [...base.players, ...extra],
    results: [],
  };
}

/** In-page: the header's items, the label and every box that must not move. */
function headerGeometry() {
  const box = (el: Element | null) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
  };
  const header = document.querySelector("[data-arcade-header]") ?? document.querySelector("[data-round-heading]");
  const label = document.querySelector<HTMLElement>("[data-round-label]");
  const shown = label?.firstElementChild as HTMLElement | null | undefined;
  const lines = shown
    ? (shown.matches(".flex-col") ? Array.from(shown.children) : [shown]).map((el) => {
        const e = el as HTMLElement;
        const cs = getComputedStyle(e);
        const lineH = parseFloat(cs.fontSize) * (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1);
        const parts = e.children.length ? Array.from(e.children, (c) => c.textContent ?? "") : [e.textContent ?? ""];
        return { text: parts.join(" ").replace(/\s+/g, " ").trim(), h: e.getBoundingClientRect().height, lineH, truncated: e.scrollWidth > e.clientWidth + 0.5, fontSize: parseFloat(cs.fontSize) };
      })
    : [];
  const controls = Array.from(document.querySelectorAll("[data-game-stage] button, [data-game-stage] [role='button']")).map((el) => ({
    label: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24),
    ...box(el)!,
  }));
  const headerItems = header
    ? Array.from(header.querySelectorAll("button, [role='timer'], [aria-label='Round progress'], [data-sound-controls]"))
        .filter((el) => !el.closest("[data-sound-controls]") || el.matches("[data-sound-controls]"))
        .map((el) => ({ what: el.getAttribute("role") === "timer" ? "timer" : (el.getAttribute("aria-label") ?? el.getAttribute("data-sound-controls") ?? el.tagName).slice(0, 24) || "sound", ...box(el)! }))
    : [];
  const left = header?.querySelector("[data-header-left] > div");
  const scoreContent = left ? Array.from(left.querySelectorAll("*")).map(box).filter(Boolean) : [];
  const scoreRight = scoreContent.length ? Math.max(...scoreContent.map((b) => b!.x + b!.w)) : null;
  const nameEl = header?.querySelector<HTMLElement>("[data-frame-name]") ?? null;
  const contextEl = header?.querySelector<HTMLElement>(".game-frame-context-text") ?? null;
  const frame = {
    left: box(header?.querySelector("[data-header-left]") ?? null),
    right: Array.from(header?.querySelectorAll("[data-header-right] > *") ?? []).map((el) => ({ what: (el.getAttribute("aria-label") ?? el.getAttribute("data-sound-controls") ?? el.className).toString().slice(0, 24), ...box(el)! })),
    name: nameEl ? { text: nameEl.textContent ?? "", cut: nameEl.scrollWidth > nameEl.clientWidth + 0.5 || nameEl.scrollHeight > nameEl.clientHeight + 1, lines: Math.round(nameEl.getBoundingClientRect().height / parseFloat(getComputedStyle(nameEl).lineHeight)), size: parseFloat(getComputedStyle(nameEl).fontSize) } : null,
    context: contextEl ? { text: (contextEl.textContent ?? "").replace(/\s+/g, " ").trim(), cut: contextEl.scrollWidth > contextEl.clientWidth + 0.5 } : null,
    goal: box(document.querySelector("[data-goal-line]")),
  };
  return {
    width: window.innerWidth,
    frame,
    header: box(header),
    arcade: Boolean(document.querySelector("[data-arcade-header]")),
    timer: box(header?.querySelector("[role='timer']") ?? null),
    pips: box(header?.querySelector("[aria-label='Round progress']") ?? null),
    label: label ? { form: label.dataset["roundLabel"], room: Number(label.style.maxWidth.replace("px", "")), ...box(shown ?? label)!, lines } : null,
    headerItems,
    scoreRight,
    region: box(document.querySelector("[data-game-region]")),
    slot: box(document.querySelector("[data-arena-slot]")),
    world: box(document.querySelector("[data-arena-slot] [data-game-arena]") ?? document.querySelector("[data-arena-slot] canvas")),
    stage: box(document.querySelector("[data-game-stage]")),
    controls,
  };
}
type HeaderGeometry = ReturnType<typeof headerGeometry>;

async function roomPlayHeader(): Promise<{ rows: string[]; geometry: Record<string, HeaderGeometry> }> {
  const rows: string[] = [];
  const geometry: Record<string, HeaderGeometry> = {};
  const puzzles = new Map<string, PuzzleData>();
  for (const c of HEADER_CASES)
    if (!puzzles.has(c.type))
      puzzles.set(c.type, splitPuzzle(withSeededRandom(41, () => generatePuzzle(c.type as never))).pub as PuzzleData);
  for (const size of HEADER_SIZES) {
    for (const c of HEADER_CASES) {
      const where = `room play header ${c.name} ${size.name}`;
      const context = await browser.newContext({ viewport: { width: size.w, height: size.h } });
      const page = await context.newPage();
      await context.addInitScript(DEVICE_INIT);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]!));
      await page.addInitScript(
        (r) => {
          (window as unknown as { __harness: unknown }).__harness = {
            puzzles: {},
            verdict: { isCorrect: true, score: 150 },
            latencyMs: 50,
            submissions: [],
            verdictAt: null,
            room: r.room,
            names: r.names,
          };
        },
        { room: headerRoom(c, puzzles.get(c.type)!), names: c.as ? { [c.type]: c.as } : {} },
      );
      const fails: string[] = [];
      try {
        await gotoRetried(page, `${origin}/safe-area.html?mode=room`, where);
        await page.waitForSelector("[data-game-stage]", { timeout: 60_000 });
        await emulateDevice(page, size.device);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1200);
        const g = await page.evaluate(headerGeometry);
        geometry[`${c.name} | ${size.name}`] = g;
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/room-header-${c.name.replace(/\W+/g, "-")}-${size.w}x${size.device.screenH}.png`, clip: { x: 0, y: 0, width: size.w, height: Math.max(4, size.top) + 60 } });
        const near = (a: number, b: number, tol = 0.6) => Math.abs(a - b) <= tol;
        const top = size.top;
        const F = g.frame;
        if (!g.header || !near(g.header.h, 60) || !near(g.header.y, top)) fails.push(`header ${JSON.stringify(g.header)}: want 60px at y ${top}`);
        if (!g.timer || !near(g.timer.x + g.timer.w / 2, g.width / 2)) fails.push(`timer centre ${g.timer ? g.timer.x + g.timer.w / 2 : "?"}: want ${g.width / 2}`);
        if (g.label) fails.push("a RoundLabel drawn in the frame header");
        const name = c.as ?? gameName(c.type);
        if (!F.name || F.name.text !== name) fails.push(`name reads "${F.name?.text}": want "${name}"`);
        else if (F.name.cut || F.name.lines > 2) fails.push(`name "${F.name.text}" cut (${F.name.lines} line(s), ${F.name.size}px)`);
        const want = `Round ${c.round} of ${c.rounds}`;
        if (!F.context || !F.context.text.endsWith(want) || F.context.cut) fails.push(`context reads "${F.context?.text}"${F.context?.cut ? " (cut)" : ""}: want it to end "${want}"`);
        if (F.left && g.timer && F.left.x + F.left.w > g.timer.x - 8 + 0.5) fails.push(`left half ${(g.timer.x - F.left.x - F.left.w).toFixed(1)}px from the timer (want ≥ 8)`);
        const rightStart = Math.min(...F.right.map((r) => r.x));
        if (g.timer && F.right.length && rightStart < g.timer.x + g.timer.w + 8 - 0.5) fails.push(`right items ${(rightStart - g.timer.x - g.timer.w).toFixed(1)}px from the timer (want ≥ 8)`);
        for (const r of F.right) if (r.x < -0.5 || r.x + r.w > g.width + 0.5) fails.push(`${r.what} off screen`);
        if (c.long) {
          if (!g.arcade) fails.push("an arcade screen without data-arcade-header");
          if (!g.slot || !near(g.slot.y, top + 60)) fails.push(`arena slot at y ${g.slot?.y}: want ${top + 60} (directly under the 60px header)`);
        } else {
          if (g.arcade) fails.push("a puzzle screen drew the arcade header");
          if (!F.goal || !g.header || !near(F.goal.y, g.header.y + 60)) fails.push(`goal line at ${F.goal?.y}: want directly under the header`);
        }
        rows.push(`| ${c.name} | ${size.name} | ${F.name?.text} (${F.name?.size}px, ${F.name?.lines} line) | ${F.context?.text} | ${F.left?.w.toFixed(0)}px |`);
        if (errors.length) fails.push(`page errors: ${[...new Set(errors)].slice(0, 2).join(" | ")}`);
      } catch (error) {
        fails.push(String((error as Error).message ?? error).split("\n")[0]!);
      } finally {
        await context.close();
      }
      for (const f of fails) failures.push(`${where}: ${f}`);
      console.log(`${fails.length ? "FAIL" : "PASS"} ${where}${fails.length ? `: ${fails[0]}` : ""}`);
    }
  }
  return { rows, geometry };
}

const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const failures: string[] = [];

/**
 * A cold dev server compiles the whole app on the first request (about 30 s on a 2-core runner,
 * right at Playwright's default goto timeout), so the first screen measured used to time out
 * before it rendered. Load the harness once, unmeasured, before any screen; nothing is judged here.
 */
async function warmUp(): Promise<void> {
  const started = Date.now();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      (window as unknown as { __harness: unknown }).__harness = {
        puzzles: {},
        verdict: { isCorrect: true, score: 150 },
        latencyMs: 50,
        submissions: [],
        verdictAt: null,
        room: null,
      };
    });
    await page.goto(`${origin}/safe-area.html?mode=home`, { timeout: 180_000 });
    await page.waitForSelector("#root *", { timeout: 120_000 });
    if (VERBOSE) console.log(`  warm-up: harness loaded in ${Date.now() - started} ms`);
  } finally {
    await context.close();
  }
}

/** goto, retried once if the load itself times out (a slow first compile); any other error stands. */
async function gotoRetried(page: import("playwright").Page, url: string, where: string): Promise<void> {
  try {
    await page.goto(url);
  } catch (error) {
    if (!/Timeout \d+ms exceeded/.test(String((error as Error).message))) throw error;
    console.log(`  ${where}: first load timed out; retrying once`);
    await page.goto(url, { timeout: 90_000 });
  }
}

const HEADER_RUN = !ONLY.length || ONLY.some((o) => "room play header".includes(o));
let headerRows: string[] = [];
try {
  await warmUp();
  if (HEADER_RUN) {
    const header = await roomPlayHeader();
    headerRows = header.rows;
    if (GEOMETRY) writeFileSync(GEOMETRY, JSON.stringify(header.geometry, null, 1));
  }
  for (const [w, h] of SIZES) {
    for (const screen of SCREENS) {
      const context = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: INSETS } as never);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]!));
      await page.addInitScript(
        (r) => {
          (window as unknown as { __harness: unknown }).__harness = {
            puzzles: { sudoku: r.puzzle },
            verdict: { isCorrect: true, score: 150 },
            latencyMs: 50,
            submissions: [],
            verdictAt: null,
            room: r.room,
          };
          if (r.seen) localStorage.setItem(r.key, "1");
        },
        { room: screen.room?.() ?? null, puzzle: PUZZLE, seen: !screen.fresh, key: ONBOARDING_KEY },
      );
      const where = `${screen.name} ${w}x${h}`;
      try {
        await gotoRetried(page, `${origin}/safe-area.html?mode=${screen.mode}`, where);
        if (screen.mode === "practice")
          await page
            .getByRole("button", { name: "Box Six", exact: true })
            .first()
            .waitFor({ timeout: 60_000 });
        else await page.waitForSelector("#root *", { timeout: 60_000 });
        await page.waitForTimeout(800);
        if (screen.go) await screen.go(page);
        await page.waitForTimeout(screen.waitMs ?? 600);
        const insets = await page.evaluate(() => {
          const d = document.createElement("div");
          d.style.cssText =
            "position:fixed;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
          document.body.append(d);
          const cs = getComputedStyle(d);
          const v = [parseFloat(cs.paddingTop), parseFloat(cs.paddingBottom)];
          d.remove();
          return v;
        });
        if (insets[0] !== INSETS.top || insets[1] !== INSETS.bottom)
          failures.push(`${where}: inset emulation not applied (${insets.join("/")})`);
        // Does the page scroll? (Judged first, then back to the top.)
        const scroll = await page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
          const y = window.scrollY;
          window.scrollTo(0, 0);
          return { y, height: document.documentElement.scrollHeight };
        });
        const scrolls = scroll.y > 0;
        if (screen.fits && scrolls)
          failures.push(`${where}: scrolls ${scroll.y}px (it must fit the screen)`);
        await page.waitForTimeout(100);
        if (SHOTS)
          await page.screenshot({
            path: `${SHOTS}/safe-${screen.name.replace(/\W+/g, "-")}-${w}x${h}.png`,
          });
        // At the top: nothing under the notch; on a page that does not scroll, nothing under
        // the home bar and no control covered. A page that scrolls is judged at its scroll
        // end for the home bar, and for controls left covered in its lower half (content
        // above that scrolls out from under a fixed bar).
        const atTop = await page.evaluate(underInsets, {
          ...INSETS,
          edge: scrolls ? ("top" as const) : ("both" as const),
          covers: !scrolls && !screen.overlay,
        });
        let atEnd: Hit[] = [];
        if (scrolls) {
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await page.waitForTimeout(150);
          atEnd = (
            await page.evaluate(underInsets, {
              ...INSETS,
              edge: "bottom" as const,
              covers: !screen.overlay,
            })
          ).filter((x) => x.edge !== "covered" || x.at > h / 2);
        }
        if (VERBOSE)
          console.log(
            `  ${where}: ${scrolls ? `scrolls ${scroll.y}px (document ${scroll.height}px)` : "fits"}`,
          );
        const hits = [...atTop, ...atEnd];
        const seen = new Set<string>();
        for (const x of hits) {
          const key = `${x.edge}:${x.label}`;
          if (seen.has(key)) continue;
          seen.add(key);
          failures.push(
            x.edge === "covered"
              ? `${where}: "${x.label}" is covered by another element (at y ${x.at}px)`
              : `${where}: "${x.label}" under the ${x.edge === "top" ? "notch / status bar" : "home bar"} (${x.edge === "top" ? `top at ${x.at}px, inset ${INSETS.top}` : `${x.at}px from the bottom, inset ${INSETS.bottom}`})`,
          );
        }
        const mine = failures.filter((f) => f.startsWith(where)).length;
        console.log(
          `${mine ? "FAIL" : "PASS"} ${where}${mine ? `: ${mine} item(s) under an inset` : ": clear of the notch and home bar"}`,
        );
        if (VERBOSE && errors.length)
          console.log(`  page errors: ${[...new Set(errors)].slice(0, 2).join(" | ")}`);
      } catch (error) {
        failures.push(`${where}: ${String((error as Error).message ?? error).split("\n")[0]}`);
        console.log(`FAIL ${where}: did not render`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}
if (headerRows.length) console.log(["| Case | Size | Name | Context | Left half |", "|---|---|---|---|---|", ...headerRows].join("\n"));
for (const f of failures) console.log(`  ${f}`);
if (failures.length) {
  console.log(
    `FAIL: ${failures.length} problem(s) on the non-game screens with a ${INSETS.top}px notch and ${INSETS.bottom}px home bar`,
  );
  process.exit(1);
}
console.log(
  `PASS: ${SCREENS.length} screens at 375x667 and 390x844 keep text and controls clear of a ${INSETS.top}px notch and a ${INSETS.bottom}px home bar${HEADER_RUN ? `; ${HEADER_CASES.length} room play-header cases at ${HEADER_SIZES.length} sizes keep the 60px frame header, a centred timer, the name and "Round n of N" whole and 8px between its parts` : ""}`,
);
