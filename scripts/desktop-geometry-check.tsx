/**
 * Desktop browsers (17 Oct 2026, display only; docs/desktop-support.md, polish-layout/desktop.css).
 *
 * Headless Chromium as a PC or laptop browser (a mouse: hover and a fine pointer, DPR 1 and 2)
 * draws the real screens through scripts/safe-area-harness.tsx (home, practice and room routes,
 * network stubbed) at 1366×768, 1440×900, 1920×1080 and a short 1280×720 window, and fails if:
 *  - pages (home, practice list, room lobby, round result, standings, podium; 10 players) are not
 *    beside the left rail (the computer layout, 31 Oct 2026: the tab pages' page and right column after
 *    the 240px rail, room pages a column at most 760px wide centred beside the 76px rail and the room's
 *    380px panel; until then one centred 480px column), scroll sideways, or show text under 10px (the
 *    phone's smallest label; page text keeps its phone size);
 *  - a puzzle's live round (Box Six, Cryptogrid, Nucleus, Echo Maze; desktop mode `wide`) is not a column
 *    at most 760px wide and 1100px tall (560 × 1000 before 31 Oct 2026), centred across the space beside
 *    the rail and vertically, with its board and every control inside it and on screen, or the page scrolls;
 *  - an arcade live round (Breaker, Coral Pop, Tilt, Gemstone, Fission, Orbit; Breaker, Tilt and Gemstone at DPR 1 and 2) is not a column
 *    centred beside the rail, at most its desktop mode's width (desktopModes.ts: `tall` 640px, `wide` 960px,
 *    `rotate` 1000px; 640 × 1120 before 31 Oct 2026) and the screen's height; its header not the game frame's 60px with its 48px timer ring
 *    and 15px seconds (Polish 2, 24 Oct 2026; 56px, 28px and 24px before), the timer not centred; its world not the game's phone shape (within 2px), not the
 *    largest uniform fit of its box (within 2px: an even whole-pixel width), not on whole CSS pixels, or its canvas backing
 *    store not the box × the pixel ratio (crisp at DPR 1 and 2); its fill (where the game has one)
 *    not covering the whole screen; a control off screen; the page scrolling;
 *  - while one arcade round is resized through every size (and down to a 1000×768 window, where
 *    the phone's game layout returns, and back; 1024×768 until 31 Oct 2026, now the desktop layout's
 *    narrowest) any of the above fails at any step;
 *  - the intro does not show the game's keys (DESKTOP_KEYS) with READY on screen;
 *  - keys do not drive a game through its own handlers (Nucleus: a typed letter taps its tile and
 *    Backspace takes it off; Gemstone: an arrow shows the board cursor);
 *  - the same 1440×900 window with a touch screen (a coarse pointer, as a tablet) does not keep the
 *    phone's game layout: the desktop rules must never reach a touch device (its pages take the tablet
 *    layout since 31 Oct 2026; its game screens are the phone's).
 *
 *   bun scripts/desktop-geometry-check.tsx [--verbose] [--shots=<dir>]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import type { Browser, Page } from "playwright";

import { startSafeAreaServer } from "./safe-area-server";
import { ONBOARDING_KEY } from "../src/lib/onboarding";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { DESKTOP_KEYS } from "../src/lib/desktopKeys";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { DESKTOP_MODES } from "../src/lib/duel/desktopModes";
import { DESKTOP_LAYOUT_QUERY } from "../src/lib/layoutMode";
import { ARENA_CABINET_LEFT } from "../src/lib/gameFrame/arena";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const SHOTS = args.find((a) => a.startsWith("--shots="))?.slice(8);
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

const SIZES = [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [1280, 720],
] as const;
/** The computer layout (31 Oct 2026, desktop-layout.css): the rails and the room panel. */
const RAIL = 240;
const RAIL_COMPACT = 76;
const ROOM_PANEL = 380;
/** A room page's column beside the compact rail (and the panel). */
const PAGE_MAX = 760;
// Changed with Joe's approval, 15 Nov 2026 (routine consequence of the game frame restyle): the arena's puzzle column is
// 85 % of the screen's height, between 760 (as before) and 960 px, between the rail and the 320 px arena panel
// (lib/gameFrame/arena.ts, polish-layout/game-fx.css).
const PUZZLE_MAX_W = 960;
const puzzleMaxW = (innerH: number) => Math.min(PUZZLE_MAX_W, Math.max(760, 0.85 * innerH));
/** The arena's side panel outside a room (lib/gameFrame/arena.ts ARENA_PANEL_W). */
const ARENA_PANEL = 320;
const PUZZLE_MAX_H = 1100;
/** An arcade column's width by desktop mode (desktop-layout.css); no height cap but the screen's. */
const ARCADE_MAX_W = { tall: 640, wide: 960, rotate: 1000 } as const;
const PUZZLES: PuzzleType[] = ["sudoku", "codeword", "wordsmith", "maze"];
const ARCADE: PuzzleType[] = ["breaker", "bubble", "tilt", "matchup", "burst", "orbit"];
/** Also drawn at DPR 2 (a high-DPI laptop screen). */
const HIGH_DPI: PuzzleType[] = ["breaker", "tilt", "matchup"];

const puzzleOf = (type: PuzzleType) => splitPuzzle(withSeededRandom(41, () => generatePuzzle(type as never))).pub as PuzzleData;
const PUZZLE_DATA: Record<string, PuzzleData> = Object.fromEntries([...PUZZLES, ...ARCADE].map((t) => [t, puzzleOf(t)]));

/* ------------------------------------------------------------------ room states */

const iso = (ms: number) => new Date(ms).toISOString();
function roomNow(status: "waiting" | "in_progress" | "finished", phase: string) {
  const now = Date.now();
  const players = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i + 1}`,
    duel_id: "duel-desk",
    player_slot: i + 1,
    display_name: i === 0 ? "Me with a long name" : `Player ${i + 1}`,
    user_id: `u${i + 1}`,
    ready_round: 1,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: iso(now),
    status: "active",
    joined_at: iso(now - 60_000),
  }));
  const scored = status === "finished" || ["result", "standings"].includes(phase);
  return {
    duel: {
      id: "duel-desk",
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
      puzzles_public: [PUZZLE_DATA["sudoku"]],
      current_round: status === "waiting" ? 0 : 1,
      phase,
      phase_started_at: iso(now + 500),
      round_started_at: iso(now + 500),
      next_duel_id: null,
      created_at: iso(now - 60_000),
    },
    players,
    results: scored
      ? players.map((p) => ({
          id: `r${p.player_slot}`,
          duel_id: "duel-desk",
          player_slot: p.player_slot,
          round_number: 1,
          answer: "",
          is_correct: p.player_slot % 3 !== 0,
          ms_remaining: 20_000 - p.player_slot * 900,
          reaction_avg_ms: null,
          correct_count: null,
          errors: null,
          extra: null,
          score: 190 - p.player_slot * 13,
          submitted_at: iso(now - 5_000),
        }))
      : [],
  };
}

/* ------------------------------------------------------------------ in-page probes */

type Box = { x: number; y: number; w: number; h: number; r: number; b: number };

/** In-page: the shell column, page scroll and smallest text inside the column. */
function pageProbe(query: string) {
  const box = (el: Element | null) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom };
  };
  const column = document.querySelector("[data-shell-column]");
  const texts = column
    ? [...column.querySelectorAll("*")].filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest("[aria-hidden='true'], svg, canvas") && [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim());
      })
    : [];
  const small = texts.map((el) => ({ size: parseFloat(getComputedStyle(el).fontSize), text: (el.textContent ?? "").trim().slice(0, 24) })).sort((a, b) => a.size - b.size)[0];
  return {
    kind: column?.getAttribute("data-shell-column") ?? null,
    column: box(column),
    desktop: matchMedia(query).matches,
    tab: document.querySelector("[data-tab-screen]") !== null,
    panel: document.querySelector("[data-room-panel-body]") !== null,
    rail: (() => {
      const r = document.querySelector("[data-app-rail]")?.getBoundingClientRect();
      return r ? r.width : 0;
    })(),
    scrollX: document.documentElement.scrollWidth - window.innerWidth,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    smallest: small ?? null,
  };
}

/** In-page: a live round's column, board, controls, header and world. */
function playProbe() {
  const box = (el: Element | null) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom };
  };
  const shell = document.querySelector(".game-screen");
  const column = document.querySelector("[data-shell-column='game']");
  const stage = document.querySelector("[data-game-stage]");
  const controls = [...(stage?.querySelectorAll("button, [data-game-controls]") ?? [])].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  });
  const slot = stage?.querySelector("[data-arena-slot]") ?? null;
  const arena = slot?.querySelector(":scope > [data-game-arena]") ?? stage?.querySelector("[data-game-arena]") ?? null;
  const canvas = arena?.querySelector("canvas") ?? null;
  const header = document.querySelector("[data-arcade-header]");
  // The arena (15 Nov 2026): the timer is in the side panel, the header not drawn.
  // Changed with Joe's approval, 22 Nov 2026 (K18, the Cabinet): the timer may be in the Cabinet's left panel.
  const arenaPanel = document.querySelector("[data-arena-panel-left]") ?? document.querySelector("[data-arena-panel], [data-arena-mount]");
  const timer = (arenaPanel ?? header)?.querySelector("[role='timer']") ?? null;
  const scene = shell?.querySelector(":scope > [data-arena-scene]") ?? null;
  const slotStyle = slot ? getComputedStyle(slot) : null;
  return {
    arcade: shell?.hasAttribute("data-arcade-play") ?? false,
    shell: box(shell),
    column: box(column),
    stage: box(stage),
    slot: box(slot),
    slotPad: slotStyle ? { l: parseFloat(slotStyle.paddingLeft), r: parseFloat(slotStyle.paddingRight) } : null,
    worldW: slot ? Number(getComputedStyle(slot).getPropertyValue("--arena-w")) : 0,
    worldH: slot ? Number(getComputedStyle(slot).getPropertyValue("--arena-h")) : 0,
    arena: box(arena),
    canvas: canvas ? { css: box(canvas), w: canvas.width, h: canvas.height } : null,
    header: box(header),
    arenaPanel: box(document.querySelector("[data-arena-panel]") ?? document.querySelector(".dk-room-panel")),
    // Changed with Joe's approval, 22 Nov 2026 (K18): the Cabinet's left panel, where there is one.
    arenaPanelLeft: box(document.querySelector("[data-arena-panel-left]")),
    timer: box(timer),
    ring: box(timer?.querySelector("svg") ?? null),
    seconds: timer?.querySelector("span") ? parseFloat(getComputedStyle(timer.querySelector("span")!).fontSize) : 0,
    timerLook: timer?.querySelector("[data-timer-look]")?.getAttribute("data-timer-look") ?? null,
    timerLabel: timer?.querySelector("[role='timer']")?.getAttribute("aria-label") ?? null,
    timerBar: box(timer?.querySelector(".game-timer-bar") ?? null),
    scene: box(scene),
    controls: controls.map((el) => ({ what: el.getAttribute("aria-label") ?? el.getAttribute("data-game-controls") ?? (el.textContent ?? "").trim().slice(0, 16), ...box(el)! })),
    scrollX: document.documentElement.scrollWidth - window.innerWidth,
    scrollY: (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight,
    dpr: window.devicePixelRatio,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
  };
}

/* ------------------------------------------------------------------ judges */

const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;
const fmt = (b: Box | null) => (b ? `${b.w.toFixed(1)}×${b.h.toFixed(1)} at ${b.x.toFixed(1)},${b.y.toFixed(1)}` : "missing");

function judgePage(m: ReturnType<typeof pageProbe>, problems: string[]) {
  if (!m.desktop) problems.push("the desktop query does not match");
  if (m.kind !== "page" || !m.column) return void problems.push(`no page column (${m.kind})`);
  const left = m.tab ? RAIL : RAIL_COMPACT;
  const right = m.panel ? m.innerW - ROOM_PANEL : m.innerW;
  if (!near(m.rail, left)) problems.push(`rail ${m.rail}px wide, want ${left}`);
  if (m.column.x < left - 0.5 || m.column.r > right + 0.5) problems.push(`page column ${m.column.x.toFixed(1)}..${m.column.r.toFixed(1)} not between the rail (${left}) and ${m.panel ? "the room panel" : "the edge"} (${right})`);
  if (!m.tab) {
    if (m.column.w > PAGE_MAX + 0.5) problems.push(`page column ${m.column.w.toFixed(1)}px wide (max ${PAGE_MAX})`);
    if (!near(m.column.x - left, right - m.column.r)) problems.push(`page column not centred beside the rail (${(m.column.x - left).toFixed(1)} | ${(right - m.column.r).toFixed(1)})`);
  }
  if (m.scrollX > 0) problems.push(`page scrolls sideways by ${m.scrollX}px`);
  if (m.smallest && m.smallest.size < 10) problems.push(`text "${m.smallest.text}" is ${m.smallest.size}px (under 10px, the phone's smallest)`);
}

function judgePlay(m: ReturnType<typeof playProbe>, arcade: boolean, problems: string[], type?: PuzzleType) {
  if (!m.column || !m.stage) return void problems.push("no live round");
  const mode = type ? DESKTOP_MODES[type].mode : "wide";
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the game frame restyle): the column sits between
  // the rail and the arena's side panel (which carries the header's timer, score and menu), centred there.
  const right = m.innerW - (m.arenaPanel ? m.arenaPanel.w : ARENA_PANEL);
  const left = RAIL_COMPACT + (m.arenaPanelLeft ? m.arenaPanelLeft.w : 0); // Changed with Joe's approval, 22 Nov 2026 (K18)
  const space = right - left;
  const maxW = arcade ? ARCADE_MAX_W[mode] : puzzleMaxW(m.innerH);
  const maxH = arcade ? m.innerH : PUZZLE_MAX_H;
  if (m.arcade !== arcade) problems.push(`arcade play screen ${m.arcade}, expected ${arcade}`);
  if (m.column.w > maxW + 0.5) problems.push(`column ${m.column.w.toFixed(1)}px wide (max ${maxW})`);
  if (m.column.w < Math.min(maxW, space) - 0.5) problems.push(`column ${m.column.w.toFixed(1)}px wide (should be ${Math.min(maxW, space)})`);
  if (m.column.h > maxH + 0.5) problems.push(`column ${m.column.h.toFixed(1)}px tall (max ${maxH})`);
  if (!m.arenaPanel || !near(m.arenaPanel.r, m.innerW)) problems.push(`no arena panel down the right edge (${fmt(m.arenaPanel)})`);
  // Changed with Joe's approval, 22 Nov 2026 (K18): centred between the Cabinet's left panel (or the rail) and the panel.
  if (!near(m.column.x - left, right - m.column.r)) problems.push(`column not centred between the ${m.arenaPanelLeft ? "Cabinet's left panel" : "rail"} and the panel (${(m.column.x - left).toFixed(1)} | ${(right - m.column.r).toFixed(1)})`);
  if (!near(m.column.y, m.innerH - m.column.b)) problems.push(`column not centred down (${m.column.y.toFixed(1)} | ${(m.innerH - m.column.b).toFixed(1)})`);
  if (m.column.y < -0.5 || m.column.b > m.innerH + 0.5) problems.push(`column off screen (${fmt(m.column)})`);
  if (m.scrollX > 0 || m.scrollY > 0) problems.push(`page scrolls (${m.scrollX}, ${m.scrollY})`);
  for (const c of m.controls) {
    if (c.x < m.column.x - 0.5 || c.r > m.column.r + 0.5 || c.y < m.column.y - 0.5 || c.b > m.innerH + 0.5) problems.push(`control "${c.what}" outside the column or screen (${fmt(c)})`);
  }
  if (m.arena && (m.arena.x < m.column.x - 0.5 || m.arena.r > m.column.r + 0.5 || m.arena.b > m.innerH + 0.5)) problems.push(`board outside the column (${fmt(m.arena)})`);
  if (!arcade) return;
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the game frame restyle): in the arena the header is
  // not drawn; the one timer is in the side panel (its seconds at least the phone's 15 px), never beside a header copy.
  if (m.header) problems.push("a header drawn in the arena (the panel carries it; no doubled timer)");
  // Changed with Joe's approval, 22 Nov 2026 (K18): an arcade round outside a room has the Cabinet's left panel once it is on.
  if (arcade && ARENA_CABINET_LEFT && mode !== "rotate" && !m.arenaPanelLeft) problems.push("no Cabinet left panel on an arcade round outside a room");
  // Changed with Joe's approval, 22 Nov 2026 (K18): the timer is in the Cabinet's left panel where there is one, else the arena panel.
  const timerPanel = m.arenaPanelLeft ?? m.arenaPanel;
  if (!m.timer || !timerPanel || m.timer.x < timerPanel.x - 0.5 || m.timer.r > timerPanel.r + 0.5) problems.push(`the timer is not in the ${m.arenaPanelLeft ? "Cabinet's left" : "arena"} panel (${fmt(m.timer)})`);
  // Changed with Joe's approval, 15 Nov 2026 (timer bar only by default): the default bar shows its seconds only in the
  // last 10 s, so it may instead show the bar with its accessible label ("N seconds remaining"); the ring and chip keep
  // their seconds (at least 15 px). Exactly one timer still.
  if (m.timerLook === "bar") {
    if (!m.timerLabel || !/\d+ seconds? remaining/.test(m.timerLabel)) problems.push(`the timer bar has no accessible label (${m.timerLabel})`);
    if (!m.timerBar || m.timerBar.w < 100 || m.timerBar.h < 4) problems.push(`the timer bar is not drawn (${fmt(m.timerBar)})`);
  } else if (m.seconds < 15 - 0.5) problems.push(`timer seconds ${m.seconds}px (at least 15)`);
  if (!m.slot || !m.arena || !m.worldW) return void problems.push("no arena slot / world");
  // A rotate game's world is turned in its rotor (desktop-layout-check and desktop-fairness-check judge it).
  if (mode === "rotate") return;
  const scale = Math.min(m.slot.w / m.worldW, m.slot.h / m.worldH);
  const fitW = m.worldW * scale;
  const fitH = m.worldH * scale;
  if (!near(m.arena.w, fitW, 2) || !near(m.arena.h, fitH, 2)) problems.push(`world ${m.arena.w}×${m.arena.h} is not the largest fit ${fitW.toFixed(1)}×${fitH.toFixed(1)} of its box ${m.slot.w}×${m.slot.h.toFixed(1)}`);
  if (Math.abs(m.arena.w / m.arena.h - m.worldW / m.worldH) * m.arena.h > 2) problems.push(`world shape ${m.arena.w}×${m.arena.h} is not ${m.worldW}:${m.worldH}`);
  if ([m.arena.x, m.arena.y, m.arena.w, m.arena.h].some((v) => v !== Math.round(v))) problems.push(`world ${fmt(m.arena)} not on whole CSS pixels`);
  if (m.canvas) {
    const wantW = Math.round(m.canvas.css!.w * Math.min(m.dpr, 2));
    if (Math.abs(m.canvas.w - wantW) > 1) problems.push(`canvas backing store ${m.canvas.w}px wide for ${m.canvas.css!.w}px CSS at DPR ${m.dpr} (want ${wantW})`);
  }
  if (m.scene && (m.scene.w < m.innerW - 0.5 || m.scene.h < m.innerH - 0.5)) problems.push(`fill ${fmt(m.scene)} does not cover the screen`);
}

/* ------------------------------------------------------------------ the run */

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-desktop-geometry", buildId: "desktop-geometry-check" });
const { chromium } = await import("playwright");
const browser: Browser = await chromium.launch({ executablePath: CHROMIUM });
const failures: string[] = [];
let judged = 0;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

/**
 * `game`: practice opens that game's round at once, as its ?game= link does (the harness's route search). Changed with
 * Joe's approval, 14 Nov 2026 (routine consequence of the Games catalogue, phase 2 step 3): a tile opens the game's
 * page, whose Play starts the intro counting down, so the round's full intro (keys, Ready) is opened by its link.
 */
async function open(mode: string, opts: { room?: unknown; size: readonly [number, number]; dpr?: number; touch?: boolean; game?: string }): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width: opts.size[0], height: opts.size[1] }, deviceScaleFactor: opts.dpr ?? 1, hasTouch: opts.touch ?? false });
  await context.addInitScript(
    (r) => {
      // Full effects, as every geometry proof: the low-end governor must not resize a canvas mid-proof.
      (window as unknown as { __duelzEffects: string }).__duelzEffects = "full";
      (window as unknown as { __harness: unknown }).__harness = { puzzles: r.puzzles, verdict: { isCorrect: true, score: 150 }, latencyMs: 50, submissions: [], verdictAt: null, room: r.room, ...(r.game ? { search: { game: r.game } } : {}) };
      try {
        localStorage.setItem(r.key, "1");
      } catch {
        /* ignore */
      }
    },
    { room: opts.room ?? null, puzzles: PUZZLE_DATA, key: ONBOARDING_KEY, game: opts.game ?? null },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => failures.push(`page error (${mode}): ${String(e.message ?? e).slice(0, 160)}`));
  const url = `${server.origin}/safe-area.html?mode=${mode}`;
  try {
    await page.goto(url, { timeout: 180_000 });
  } catch (error) {
    if (!/Timeout \d+ms exceeded/.test(String((error as Error).message))) throw error;
    await page.goto(url, { timeout: 90_000 });
  }
  await page.waitForSelector("#root *", { timeout: 60_000 });
  await page.waitForTimeout(600);
  return { page, close: () => context.close() };
}

async function report(where: string, problems: string[], page?: Page) {
  judged++;
  if (SHOTS && page) writeFileSync(`${SHOTS}/desktop-${where.replace(/\W+/g, "-")}.png`, await page.screenshot());
  for (const p of problems) failures.push(`${where}: ${p}`);
  if (problems.length || VERBOSE) console.log(`${problems.length ? "FAIL" : "PASS"} ${where}${problems.length ? `: ${problems[0]}` : ""}`);
}

/** Starts the live round of the game the page was opened on (open's `game`); checks the intro's keys on the way. */
async function startRound(page: Page, type: PuzzleType, problems: string[]) {
  // The page was opened on the game (open's `game`): its round's intro comes up at once.
  void type;
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(300);
  if (DESKTOP_KEYS[type]) {
    const keys = await page.locator("[data-desktop-keys]").count();
    if (!keys) problems.push("the intro does not show the game's keys");
  }
  const readyBox = await ready.boundingBox();
  const h = page.viewportSize()!.height;
  if (!readyBox || readyBox.y + readyBox.height > h + 0.5) problems.push("READY is not on screen");
  await ready.click();
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(4200); // the practice countdown, then a few frames of play
}

try {
  // Pages.
  const pages: { name: string; mode: string; room?: () => unknown }[] = [
    { name: "home", mode: "home" },
    { name: "practice list", mode: "practice" },
    { name: "tournaments", mode: "tournaments" },
    { name: "profile", mode: "profile" },
    { name: "room lobby, 10 players", mode: "room", room: () => roomNow("waiting", "starting") },
    { name: "round result, 10 players", mode: "room", room: () => roomNow("in_progress", "result") },
    { name: "standings, 10 players", mode: "room", room: () => roomNow("in_progress", "standings") },
    { name: "podium, 10 players", mode: "room", room: () => roomNow("finished", "result") },
  ];
  for (const p of pages) {
    const { page, close } = await open(p.mode, { room: p.room?.(), size: SIZES[0] });
    try {
      await page.waitForTimeout(p.mode === "room" ? 2500 : 300);
      for (const size of SIZES) {
        await page.setViewportSize({ width: size[0], height: size[1] });
        await page.waitForTimeout(200);
        const problems: string[] = [];
        judgePage(await page.evaluate(pageProbe, DESKTOP_LAYOUT_QUERY), problems);
        await report(`${p.name} ${size[0]}x${size[1]}`, problems, page);
      }
    } finally {
      await close();
    }
  }

  // Live rounds, each at every size (one page per game, resized), puzzles at DPR 1, arcade at DPR 1 and 2.
  for (const type of [...PUZZLES, ...ARCADE]) {
    const arcade = ARCADE.includes(type);
    for (const dpr of arcade && HIGH_DPI.includes(type) ? [1, 2] : [1]) {
      const { page, close } = await open("practice", { size: SIZES[0], dpr, game: type });
      try {
        const intro: string[] = [];
        await startRound(page, type, intro);
        await report(`${type} intro ${SIZES[0][0]}x${SIZES[0][1]} DPR ${dpr}`, intro);
        for (const size of SIZES) {
          await page.setViewportSize({ width: size[0], height: size[1] });
          await page.waitForTimeout(250);
          const problems: string[] = [];
          judgePlay(await page.evaluate(playProbe), arcade, problems, type);
          await report(`${type} live ${size[0]}x${size[1]} DPR ${dpr}`, problems, page);
        }
      } finally {
        await close();
      }
    }
  }

  // Resizing one arcade round through every size, a phone-layout window and back, frame by frame.
  {
    const { page, close } = await open("practice", { size: [1920, 1080], game: "burst" });
    try {
      await startRound(page, "burst", []);
      const steps: [number, number][] = [];
      for (let w = 1920, h = 1080; w >= 1280; w -= 80, h = Math.max(720, h - 45)) steps.push([w, h]);
      steps.push([1024, 768], [1000, 768], [1366, 768], [1440, 900]);
      for (const [w, h] of steps) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(120);
        const problems: string[] = [];
        const m = await page.evaluate(playProbe);
        if (w >= 1024) judgePlay(m, true, problems, "burst");
        else if (!m.column || m.column.w < w - 1) problems.push(`a ${w}px window should keep the phone layout (column ${m.column?.w ?? "missing"}px)`);
        await report(`resize burst ${w}x${h}`, problems);
      }
    } finally {
      await close();
    }
  }

  // Keys drive the games through their own handlers: Nucleus's letters and Backspace, Gemstone's cursor.
  {
    const { page, close } = await open("practice", { size: [1440, 900], game: "wordsmith" });
    const problems: string[] = [];
    try {
      await startRound(page, "wordsmith", []);
      const letter = ((await page.locator(".wordsmith-ring-letter").first().textContent()) ?? "").trim();
      const word = page.locator("[aria-label='Current word']");
      await page.keyboard.press(letter.toLowerCase());
      await page.waitForTimeout(150);
      if (((await word.textContent()) ?? "").trim() !== letter.toUpperCase()) problems.push(`Nucleus: typing "${letter}" did not tap its tile (word "${((await word.textContent()) ?? "").trim()}")`);
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(150);
      if (((await word.textContent()) ?? "").trim() !== "") problems.push("Nucleus: Backspace did not take the tile off");
    } finally {
      await close();
    }
    const gem = await open("practice", { size: [1440, 900], game: "matchup" });
    try {
      await startRound(gem.page, "matchup", []);
      if (await gem.page.locator("[data-key-cursor]").count()) problems.push("Gemstone: the key cursor shows before any key");
      await gem.page.keyboard.press("ArrowRight");
      await gem.page.waitForTimeout(150);
      if (!(await gem.page.locator("[data-key-cursor]").count())) problems.push("Gemstone: an arrow key did not show the cursor");
    } finally {
      await gem.close();
    }
    await report("keys drive Nucleus and Gemstone", problems);
  }

  // A touch screen of the same size: changed with Joe's approval, 15 Nov 2026 (sideways tablets get the arena): its live
  // round is the arena (no header; the column beside the panel; the timer in the panel) and it still takes no keys.
  {
    const { page, close } = await open("practice", { size: [1440, 900], touch: true, game: "matchup" });
    try {
      const problems: string[] = [];
      const ready = page.getByRole("button", { name: /^Ready/ }).first();
      await ready.waitFor({ timeout: 30_000 });
      if (await page.locator("[data-desktop-keys]").count()) problems.push("a touch screen shows the desktop keys");
      await ready.click();
      await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(4200);
      const m = await page.evaluate(playProbe);
      if (!m.arenaPanel || !near(m.arenaPanel.r, 1440)) problems.push(`no arena panel on the sideways tablet (${fmt(m.arenaPanel)})`);
      if (!m.column || (m.arenaPanel && m.column.r > m.arenaPanel.x + 0.5)) problems.push(`the column ${fmt(m.column)} runs under the arena panel`);
      if (m.header) problems.push("the sideways tablet's round still draws the header");
      if (!m.timer || !m.arenaPanel || m.timer.x < m.arenaPanel.x - 0.5) problems.push("the sideways tablet's timer is not in the arena panel");
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(150);
      if (await page.locator("[data-key-cursor]").count()) problems.push("a touch screen took a game key");
      await report("touch screen 1440x900 plays in the arena", problems, page);
    } finally {
      await close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

for (const f of failures) console.log(`  ${f}`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} problem(s) in the desktop layout`);
  process.exit(1);
}
console.log(
  `PASS: ${judged} desktop geometries at ${SIZES.map(([w, h]) => `${w}x${h}`).join(", ")} and while resizing: pages beside the rail (room pages a centred ≤${PAGE_MAX}px column), text ≥ 10px; puzzle rounds (${PUZZLES.join(", ")}) a centred ≤${PUZZLE_MAX_W}×${PUZZLE_MAX_H} column; arcade rounds (${ARCADE.join(", ")}; ${HIGH_DPI.join(", ")} at DPR 1 and 2 too) a centred column as wide as their desktop mode allows, the 60px frame header, 48px timer, the world its phone shape at the largest whole-pixel fit with a crisp canvas, the fill over the whole screen; intros show the keys; keys drive Nucleus and Gemstone; a touch screen keeps the phone layout and takes no keys.`,
);
