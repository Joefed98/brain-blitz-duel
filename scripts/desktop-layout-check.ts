/**
 * The computer layout, chess.com style (31 Oct 2026; docs/desktop-layout.md, polish-layout/desktop-layout.css).
 *
 * Headless Chromium with a mouse draws the real routes through the safe-area harness (network stubbed, the
 * fixed clock of scripts/theme-screens.ts) at 1440×900, 1920×1080 and 1024×768, and fails if:
 *  - shell and rail: a tab page (Play, Practice, Tournaments, Profile) lacks the 240 px left rail (the
 *    logo, the four tabs, search, account and settings) or still draws the bottom tab bar or the phone
 *    header; a room or game screen lacks the 76 px icon rail; the page scrolls sideways;
 *  - the banner slot: with a house promotion configured (window.__DUELZ_BANNERS__, as config/banners.ts),
 *    Play, Practice and Tournaments do not show one 112 px slot across the top of the page, or Profile, a
 *    room, a round, a reveal or the standings shows one; with none configured, a slot shows anywhere;
 *  - the pages: the right column is not 320 px beside the page; Practice's switch, search and chips are not
 *    one row above the games, or a section's games are not a grid of large cards 3 to 5 across;
 *  - the room panel (16 players): the lobby, the standings and a live round lack the 380 px panel on the
 *    right with the room code, the round's progress bar (one segment a round, in its category's colour),
 *    every one of the 16 players with a status, and the chat (open between rounds, a quiet line in a round);
 *    the lobby's players are not four across;
 *  - each game's desktop mode (desktopModes.ts, every active game at 1440×900 and one game of each mode at
 *    every size): the play screen not in the registry's mode, a rotor on any but a rotate game (and none on
 *    one), the page scrolling, the world, its canvas or a control outside the centre between the rail and
 *    the panel or off screen, or a canvas not crisp within the pixel-ratio cap of 2;
 * and, the phones unchanged: at 414×896 (iPhone 11 home-screen app) and 375×667, any of those screens shows a
 * rail, the banner slot, a right column, the room panel, a controls hint, a desktop mode or a layout mark, or a
 * tab page lacks its bottom tab bar and header. A touch screen as wide as a desktop (1440×900 with touch) gets
 * the tablet layout: the page and its side column with the tab bar, and the game screens exactly as a phone's.
 *
 *   bun scripts/desktop-layout-check.ts [--part=k/n] [--verbose] [--shots=<dir>]
 *
 * Parts: part 1 also judges the pages, rooms, phones and the touch screen; the games are split evenly.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import type { Browser, Page } from "playwright";

import { ACTIVE_PUZZLE_TYPES } from "../src/lib/duel/registry";
import { DESKTOP_MODES } from "../src/lib/duel/desktopModes";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import type { PuzzleType } from "../src/lib/duel/types";
import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, VIEWPORTS, fixThemeClock, openThemeScreen, room, type ThemeScreen, type ThemeViewport } from "./theme-screens";
import { roomRound } from "./desktop-layout-screens";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const SHOTS = args.find((a) => a.startsWith("--shots="))?.slice(8);
const PART = args.find((a) => a.startsWith("--part="))?.slice(7) ?? "1/1";
const [PART_K, PART_N] = PART.split("/").map(Number) as [number, number];
if (!(PART_N >= 1 && PART_K >= 1 && PART_K <= PART_N)) {
  console.log(`FAIL: bad --part=${PART}`);
  process.exit(1);
}
const CHROMIUM = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const DESKTOP: ThemeViewport[] = [
  { name: "1440x900", w: 1440, h: 900, desktop: true },
  { name: "1920x1080", w: 1920, h: 1080, desktop: true },
  { name: "1024x768", w: 1024, h: 768, desktop: true },
];
const PHONES = VIEWPORTS.filter((v) => !v.desktop);
const RAIL = 240;
const RAIL_COMPACT = 76;
const ASIDE = 320;
const PANEL = 380;
const BANNER = 112;
const BANNERS = [{ id: "check-cup", title: "The Check Cup", line: "Six rounds on Saturday", action: "See the schedule", to: "/tournaments" }];

const named = (name: string) => THEME_SCREENS.find((s) => s.name === name)!;
const TAB_PAGES: { screen: ThemeScreen; banner: boolean }[] = [
  { screen: named("play"), banner: true },
  { screen: named("practice list"), banner: true },
  { screen: named("tournaments"), banner: true },
  { screen: named("profile"), banner: false },
];
const ROOMS: ThemeScreen[] = [
  { name: "lobby, 16 players", mode: "room", room: room("waiting", "starting", { players: 16 }) },
  { name: "standings, 16 players", mode: "room", room: room("in_progress", "standings", { players: 16, rounds: 2, meAt: 12 }), waitMs: 2500 },
  { name: "round leaderboard, 16 players", mode: "room", room: room("in_progress", "result", { players: 16, rounds: 2, meAt: 12 }), waitMs: 2500 },
  { ...roomRound("racing", true), name: "live round (Apex), 16 players" },
  { name: "answer reveal (arcade), 16 players", mode: "room", room: room("in_progress", "reveal", { arcade: true, players: 16, revealParts: true, meAt: 12 }), waitMs: 1500, plain: true },
];

const failures: string[] = [];
let judged = 0;

async function open(browser: Browser, origin: string, screen: ThemeScreen, viewport: ThemeViewport, banners = false, touch = false) {
  return openThemeScreen(browser, origin, screen, viewport, async (context) => {
    if (banners) await context.addInitScript((b) => ((window as unknown as { __DUELZ_BANNERS__: unknown }).__DUELZ_BANNERS__ = b), BANNERS);
    if (touch) await context.addInitScript(() => undefined);
  }).then(async (opened) => {
    if (touch) {
      const cdp = await opened.context.newCDPSession(opened.page);
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      await opened.page.reload();
      await opened.page.waitForSelector("#root *", { timeout: 60_000 });
      await opened.page.waitForTimeout(1500);
    }
    return opened;
  });
}

async function report(where: string, problems: string[], page?: Page) {
  judged++;
  if (SHOTS && page) writeFileSync(`${SHOTS}/${where.replace(/\W+/g, "-")}.png`, await page.screenshot());
  for (const p of problems) failures.push(`${where}: ${p}`);
  if (problems.length || VERBOSE) console.log(`${problems.length ? "FAIL" : "PASS"} ${where}${problems.length ? `: ${problems[0]}` : ""}`);
}

/** In-page: everything the judges read. */
function probe() {
  const box = (el: Element | null | undefined) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom };
  };
  const shell = document.querySelector("[data-shell-column]")?.parentElement ?? null;
  const rail = document.querySelector("[data-app-rail]");
  const panel = document.querySelector("[data-room-panel-body]");
  const arena = document.querySelector("[data-game-arena]") as HTMLElement | null;
  const turned = Boolean(arena?.closest("[data-arena-rotor]"));
  const practiceRows = [...document.querySelectorAll("[data-practice-group] .ap-panel")].map((p) => {
    const tops = [...p.querySelectorAll("[data-practice-game]")].map((b) => Math.round(b.getBoundingClientRect().top));
    return { count: tops.length, firstRow: tops.filter((t) => t === tops[0]).length };
  });
  const stage = document.querySelector("[data-game-stage]");
  const controls = [...(stage?.querySelectorAll("button") ?? [])]
    .filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== "hidden";
    })
    .map((b) => ({ what: b.getAttribute("aria-label") ?? (b.textContent ?? "").trim().slice(0, 16), ...box(b)! }));
  return {
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    dpr: window.devicePixelRatio,
    scrollX: document.documentElement.scrollWidth - window.innerWidth,
    scrollY: (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight,
    layout: shell?.getAttribute("data-layout") ?? null,
    anyLayout: document.querySelectorAll("[data-layout]").length,
    mode: document.querySelector("[data-desktop-mode]")?.getAttribute("data-desktop-mode") ?? null,
    rail: rail ? { kind: rail.getAttribute("data-app-rail"), ...box(rail)!, tabs: rail.querySelectorAll("[data-rail-tab]").length, logo: !!rail.querySelector("[data-rail-logo]"), search: !!rail.querySelector("input[type='search']"), account: !!rail.querySelector("[data-rail-account]"), settings: !!rail.querySelector("[data-rail-settings]") } : null,
    tabbar: !!document.querySelector("[data-app-tabbar]"),
    header: !!document.querySelector("[data-app-header]"),
    banner: box(document.querySelector("[data-banner-slot]")),
    banners: document.querySelectorAll("[data-banner-slot]").length,
    bannerId: document.querySelector("[data-banner-slot]")?.getAttribute("data-banner-slot") ?? null,
    aside: box(document.querySelector("[data-page-aside]")),
    column: box(document.querySelector("[data-shell-column]")),
    tools: (() => {
      const sw = box(document.querySelector("[data-practice-tools] [data-practice-switch]"));
      const search = box(document.querySelector("[data-practice-tools] input[type='search']"));
      const chips = box(document.querySelector("[data-practice-tools] [role='group'][aria-label]:not([data-practice-switch])"));
      const firstGame = box(document.querySelector("[data-practice-group]"));
      return { sw, search, chips, firstGame };
    })(),
    practiceRows,
    panel: panel
      ? {
          ...box(panel)!,
          code: (panel.querySelector("[data-room-panel-code]")?.textContent ?? "").trim(),
          segs: [...panel.querySelectorAll("[data-room-progress] .dk-rp-seg")].map((s) => ({ cat: s.getAttribute("data-cat"), colour: getComputedStyle(s).backgroundColor })),
          players: [...panel.querySelectorAll("[data-room-player]")].map((p) => ({ state: p.getAttribute("data-state"), status: (p.querySelector(".dk-rp-status")?.textContent ?? "").trim() })),
          chat: panel.querySelector("[data-room-panel-chat]")?.getAttribute("data-room-panel-chat") ?? null,
          chatInput: !!panel.querySelector("[data-room-panel-chat] input"),
        }
      : null,
    lobbyCols: (() => {
      const grid = document.querySelector("[data-lobby-grid]");
      if (!grid) return null;
      const tops = [...grid.children].map((c) => Math.round(c.getBoundingClientRect().top));
      return tops.filter((t) => t === tops[0]).length;
    })(),
    hint: !!document.querySelector("[data-controls-hint]"),
    hintBox: box(document.querySelector("[data-controls-hint]")),
    arena: arena ? { ...box(arena)!, turned, rotors: document.querySelectorAll("[data-arena-rotor]").length } : null,
    // Text inside a rotor would read sideways: none may be there (Cue Ball's HUD is on its upright strip).
    rotorText: [...document.querySelectorAll("[data-arena-rotor] *")].filter((el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim())).map((el) => (el.textContent ?? "").trim().slice(0, 20)),
    hudStrip: (() => {
      const strip = document.querySelector("[data-arena-hud]");
      return strip ? { inRotor: Boolean(strip.closest("[data-arena-rotor]")), ...box(strip)! } : null;
    })(),
    canvases: arena ? [...arena.querySelectorAll("canvas")].map((c) => ({ w: c.width, h: c.height, cssW: c.offsetWidth, cssH: c.offsetHeight })) : [],
    controls,
  };
}
type Probe = ReturnType<typeof probe>;

const near = (a: number, b: number, tol = 0.75) => Math.abs(a - b) <= tol;

function judgeShell(m: Probe, tab: boolean, problems: string[]) {
  if (m.layout !== "desktop") problems.push(`layout ${m.layout}, want desktop`);
  if (m.scrollX > 0) problems.push(`the page scrolls sideways by ${m.scrollX}px`);
  if (!m.rail) return void problems.push("no left rail");
  const want = tab ? RAIL : RAIL_COMPACT;
  if (m.rail.kind !== (tab ? "full" : "compact")) problems.push(`rail "${m.rail.kind}", want ${tab ? "full" : "compact"}`);
  if (!near(m.rail.w, want) || !near(m.rail.x, 0) || !near(m.rail.y, 0) || !near(m.rail.h, m.innerH)) problems.push(`rail ${m.rail.w}×${m.rail.h} at ${m.rail.x},${m.rail.y}, want ${want}px wide down the whole left edge`);
  if (m.rail.tabs !== 4 || !m.rail.logo || !m.rail.account || !m.rail.settings) problems.push(`rail lacks the logo, the four tabs, the account or settings (${m.rail.tabs} tabs)`);
  if (tab && !m.rail.search) problems.push("the full rail has no search");
  if (m.tabbar) problems.push("the bottom tab bar is still drawn");
  if (tab && m.header) problems.push("the phone header is still drawn (the rail has the logo)");
}

function judgeTabPage(m: Probe, name: string, banner: boolean, withBanners: boolean, problems: string[]) {
  judgeShell(m, true, problems);
  if (!m.aside) problems.push("no right column");
  else {
    if (!near(m.aside.w, ASIDE)) problems.push(`right column ${m.aside.w.toFixed(1)}px wide, want ${ASIDE}`);
    if (m.column && m.aside.r > m.column.r + 0.5) problems.push("right column past the page");
    if (m.aside.x < RAIL + 0.5) problems.push("right column under the rail");
  }
  if (m.column && m.column.x < RAIL - 0.5) problems.push(`page starts at ${m.column.x}px, under the rail`);
  // With no house promotion configured, a page may still promote the next scheduled public game (the fixture
  // schedules one), and nothing else.
  const scheduled = (m.bannerId ?? "").startsWith("public-");
  const wantBanner = banner && (withBanners || scheduled);
  if (m.banners !== (wantBanner ? 1 : 0)) problems.push(`${m.banners} banner slot(s), want ${wantBanner ? 1 : 0}`);
  if (banner && !withBanners && m.banners && !scheduled) problems.push(`a banner "${m.bannerId}" with no promotion configured and no public game scheduled`);
  if (wantBanner && m.banner) {
    if (!near(m.banner.h, BANNER)) problems.push(`banner ${m.banner.h}px tall, want ${BANNER}`);
    if (m.aside && m.banner.r < m.aside.r - 0.75) problems.push("banner does not run across the page and its column");
    if (m.aside && m.banner.b > m.aside.y + 0.5) problems.push("banner is not above the right column");
  }
  if (name === "practice list") {
    const t = m.tools;
    if (!t.sw || !t.search || !t.chips) problems.push("practice: the switch, search or chips are missing from the tools row");
    else {
      if (Math.abs(t.sw.y + t.sw.h / 2 - (t.search.y + t.search.h / 2)) > 6) problems.push("practice: the switch and search are not one row");
      if (t.chips.y < t.search.b - 0.5) problems.push("practice: the chips are not under the switch and search");
      if (t.firstGame && t.firstGame.y < t.chips.b - 0.5) problems.push("practice: the games start above the tools row");
    }
    if (!m.practiceRows.length) problems.push("practice: no game sections");
    for (const row of m.practiceRows) {
      const want = Math.min(row.count, 3);
      if (row.firstRow < want || row.firstRow > 5) problems.push(`practice: ${row.firstRow} cards across (want 3 to 5)`);
    }
  }
}

function judgeRoom(m: Probe, name: string, problems: string[]) {
  judgeShell(m, false, problems);
  if (m.banners) problems.push("a banner slot in a room");
  if (!m.panel) return void problems.push("no room panel");
  if (!near(m.panel.w, PANEL) || !near(m.panel.r, m.innerW) || !near(m.panel.y, 0) || !near(m.panel.h, m.innerH)) problems.push(`room panel ${m.panel.w}×${m.panel.h} at ${m.panel.x}, want ${PANEL}px down the right edge`);
  if (m.panel.code !== "SAFE") problems.push(`room panel code "${m.panel.code}"`);
  if (m.panel.players.length !== 16) problems.push(`room panel lists ${m.panel.players.length} players, want 16`);
  const waiting = name.startsWith("lobby");
  if (waiting) {
    if (m.panel.segs.length) problems.push("a progress bar in the lobby (no rounds are dealt yet)");
    if (m.lobbyCols !== 4) problems.push(`lobby players ${m.lobbyCols} across, want 4`);
  } else {
    if (!m.panel.segs.length) problems.push("no round progress bar");
    for (const s of m.panel.segs) if (!s.cat || s.colour === "rgba(0, 0, 0, 0)") problems.push(`a progress segment without its category colour (${s.cat}, ${s.colour})`);
  }
  const inRound = name.startsWith("live round") || name.startsWith("answer reveal");
  if (inRound) {
    if (m.panel.chat !== "closed") problems.push("chat open during a round");
    if (name.startsWith("live round") && m.panel.players.some((p) => p.state !== "playing" && p.state !== "finished")) problems.push("a player without a playing / finished status in a live round");
  } else if (m.panel.chat !== "open" || !m.panel.chatInput) problems.push("chat not open between rounds");
}

function judgeGame(m: Probe, type: PuzzleType, problems: string[]) {
  judgeShell(m, false, problems);
  if (m.banners) problems.push("a banner slot on a round");
  const want = DESKTOP_MODES[type].mode;
  if (m.mode !== want) problems.push(`desktop mode ${m.mode}, want ${want}`);
  if (m.scrollX > 0 || m.scrollY > 0) problems.push(`the page scrolls (${m.scrollX}, ${m.scrollY})`);
  const left = RAIL_COMPACT;
  const right = m.panel ? m.innerW - PANEL : m.innerW;
  if (m.arena) {
    if (m.arena.rotors !== (want === "rotate" ? 1 : 0)) problems.push(`${m.arena.rotors} rotor(s), want ${want === "rotate" ? 1 : 0}`);
    if (m.arena.turned !== (want === "rotate")) problems.push(`world ${m.arena.turned ? "turned" : "upright"}`);
    if (m.arena.x < left - 0.75 || m.arena.r > right + 0.75 || m.arena.y < -0.75 || m.arena.b > m.innerH + 0.75) problems.push(`world ${m.arena.w.toFixed(0)}×${m.arena.h.toFixed(0)} at ${m.arena.x.toFixed(0)},${m.arena.y.toFixed(0)} outside the centre ${left}..${right}`);
    const ratio = Math.min(2, m.dpr);
    for (const c of m.canvases) {
      if (c.cssW < 2) continue;
      if (Math.abs(c.w - c.cssW * ratio) > 2) problems.push(`canvas ${c.w}px wide for ${c.cssW}px CSS at pixel ratio ${ratio}`);
    }
  } else if (want === "rotate") problems.push("no world on a rotate game");
  if (m.hintBox && m.column && m.hintBox.r > m.column.x + 0.5) problems.push(`the controls hint (${m.hintBox.x.toFixed(0)}..${m.hintBox.r.toFixed(0)}) runs over the play column (from ${m.column.x.toFixed(0)})`);
  if (m.rotorText.length) problems.push(`text inside the turned world (drawn rotated): ${m.rotorText.slice(0, 3).join(", ")}`);
  if (want === "rotate" && (!m.hudStrip || m.hudStrip.inRotor || m.hudStrip.h < 20)) problems.push("a rotate game without its upright HUD strip outside the turned world");
  if (want !== "rotate" && m.hudStrip) problems.push("an upright HUD strip on a game that is not turned");
  for (const c of m.controls) if (c.x < left - 0.75 || c.r > right + 0.75 || c.y < -0.75 || c.b > m.innerH + 0.75) problems.push(`control "${c.what}" outside the centre or off screen (${c.x.toFixed(0)}..${c.r.toFixed(0)}, ${c.y.toFixed(0)}..${c.b.toFixed(0)})`);
}

function judgePhone(m: Probe, tab: boolean, problems: string[]) {
  if (m.anyLayout) problems.push(`a layout mark on a phone (${m.layout})`);
  if (m.rail) problems.push("a rail on a phone");
  if (m.banners) problems.push("a banner slot on a phone");
  if (m.aside) problems.push("a right column on a phone");
  if (m.panel) problems.push("a room panel on a phone");
  if (m.hint) problems.push("a controls hint on a phone");
  if (m.mode) problems.push(`desktop mode ${m.mode} on a phone`);
  if (tab && (!m.tabbar || !m.header)) problems.push("a tab page without its bottom tab bar and header");
  if (m.scrollX > 0) problems.push(`the page scrolls sideways by ${m.scrollX}px`);
}

/* ------------------------------------------------------------------ the run */

const GAMES = ACTIVE_PUZZLE_TYPES.filter((_, i) => i % PART_N === PART_K - 1);
const SAMPLE: PuzzleType[] = ["pool", "racing", "freecell", "sudoku"];
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-desktop-layout", buildId: "desktop-layout-check" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  if (PART_K === 1) {
    for (const viewport of DESKTOP) {
      for (const { screen, banner } of TAB_PAGES)
        for (const withBanners of screen.name === "play" ? [true, false] : [true]) {
          const { context, page } = await open(browser, server.origin, screen, viewport, withBanners);
          const problems: string[] = [];
          judgeTabPage(await page.evaluate(probe), screen.name, banner, withBanners, problems);
          await report(`${screen.name}${withBanners ? "" : ", no promotion"} ${viewport.name}`, problems, page);
          await context.close();
        }
      for (const screen of ROOMS) {
        const { context, page } = await open(browser, server.origin, screen, viewport, true);
        const problems: string[] = [];
        judgeRoom(await page.evaluate(probe), screen.name, problems);
        await report(`room ${screen.name} ${viewport.name}`, problems, page);
        await context.close();
      }
    }
    // The phones: nothing of the computer layout, the screens as before.
    for (const viewport of PHONES) {
      for (const screen of [named("play"), named("practice list"), ROOMS[0]!, ROOMS[3]!]) {
        const { context, page } = await open(browser, server.origin, screen, viewport, true);
        const problems: string[] = [];
        judgePhone(await page.evaluate(probe), screen.mode !== "room", problems);
        await report(`phone ${screen.name} ${viewport.name}`, problems, page);
        await context.close();
      }
    }
    // A touch screen as wide as a desktop: the tablet layout (pages two columns, games as on a phone).
    {
      const viewport: ThemeViewport = { name: "1440x900 touch", w: 1440, h: 900 };
      for (const screen of [named("practice list"), roomRound("racing", true)]) {
        const { context, page } = await open(browser, server.origin, screen, viewport, true);
        const problems: string[] = [];
        const m = await page.evaluate(probe);
        if (m.layout !== "tablet") problems.push(`layout ${m.layout}, want tablet`);
        if (m.rail || m.panel || m.banners || m.mode || m.hint) problems.push("a touch screen shows the desktop rail, panel, banner, mode or hint");
        if (screen.mode !== "room" && (!m.aside || !m.tabbar)) problems.push("the tablet page lacks its side column or tab bar");
        if (screen.mode === "room" && m.arena && m.arena.turned) problems.push("a touch screen turned the world");
        await report(`tablet ${screen.name} ${viewport.name}`, problems, page);
        await context.close();
      }
    }
  }
  // Every active game's desktop mode at 1440×900, and one of each mode at every size.
  const cases: [PuzzleType, ThemeViewport][] = [
    ...GAMES.map((t) => [t, DESKTOP[0]!] as [PuzzleType, ThemeViewport]),
    ...(PART_K === 1 ? SAMPLE.flatMap((t) => DESKTOP.slice(1).map((v) => [t, v] as [PuzzleType, ThemeViewport])) : []),
  ];
  for (const [type, viewport] of cases) {
    const screen = { ...roomRound(type, true), waitMs: 2500 };
    const { context, page } = await open(browser, server.origin, screen, viewport);
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`page error: ${String(e.message ?? e).slice(0, 160)}`));
    try {
      await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(500);
      judgeGame(await page.evaluate(probe), type, problems);
    } catch (e) {
      problems.push(`harness: ${String((e as Error).message ?? e).split("\n")[0]}`);
    }
    await report(`${gameDisplayName(type)} (${type}, ${DESKTOP_MODES[type].mode}) ${viewport.name}`, problems, page);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}

for (const f of failures) console.log(`  ${f}`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} problem(s) in the computer layout (part ${PART})`);
  process.exit(1);
}
const modes = (["wide", "rotate", "tall"] as const).map((m) => `${m} ${ACTIVE_PUZZLE_TYPES.filter((t) => DESKTOP_MODES[t].mode === m).length}`).join(", ");
console.log(
  `PASS: computer layout (part ${PART}): ${judged} screens. ${PART_K === 1 ? `Tab pages with the 240px rail, banner slot and 320px column, Practice's one tools row and 3–5 card grid, rooms with the 76px rail and the 380px panel for 16 players at ${DESKTOP.map((v) => v.name).join(", ")}; phones (${PHONES.map((v) => v.name).join(", ")}) unchanged; a touch screen gets the tablet layout. ` : ""}${GAMES.length} games' desktop modes (active games: ${modes}) without overflow, crisp, in the centre.`,
);
