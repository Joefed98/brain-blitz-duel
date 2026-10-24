/**
 * Desktop browsers (17 Oct 2026, display only; docs/desktop-support.md, polish-layout/desktop.css).
 *
 * Headless Chromium as a PC or laptop browser (a mouse: hover and a fine pointer, DPR 1 and 2)
 * draws the real screens through scripts/safe-area-harness.tsx (home, practice and room routes,
 * network stubbed) at 1366×768, 1440×900, 1920×1080 and a short 1280×720 window, and fails if:
 *  - pages (home, practice list, room lobby, round result, standings, podium; 10 players) are not
 *    one centred column at most 480px wide, scroll sideways, or show text under 10px (the phone's
 *    smallest label; page text keeps its phone size);
 *  - a puzzle's live round (Box Six, Cryptogrid, Nucleus, Echo Maze) is not a centred column at most
 *    560px wide and 1000px tall, centred vertically, with its board and every control inside it and
 *    on screen, or the page scrolls;
 *  - an arcade live round (Breaker, Coral Pop, Tilt, Gemstone, Fission, Orbit; Breaker, Tilt and Gemstone at DPR 1 and 2) is not a centred column
 *    at most 640px wide and 1120px tall; its header not the game frame's 60px with its 48px timer ring
 *    and 15px seconds (Polish 2, 24 Oct 2026; 56px, 28px and 24px before), the timer not centred; its world not the game's phone shape (within 2px), not the
 *    largest uniform fit of its box (within 2px: an even whole-pixel width), not on whole CSS pixels, or its canvas backing
 *    store not the box × the pixel ratio (crisp at DPR 1 and 2); its fill (where the game has one)
 *    not covering the whole screen; a control off screen; the page scrolling;
 *  - while one arcade round is resized through every size (and down to a 1024×768 window, where
 *    the phone layout returns, and back) any of the above fails at any step;
 *  - the intro does not show the game's keys (DESKTOP_KEYS) with READY on screen;
 *  - keys do not drive a game through its own handlers (Nucleus: a typed letter taps its tile and
 *    Backspace takes it off; Gemstone: an arrow shows the board cursor);
 *  - the same 1440×900 window with a touch screen (a coarse pointer, as a tablet) does not keep the
 *    phone layout: the desktop rules must never reach a touch device.
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
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { DESKTOP_KEYS } from "../src/lib/desktopKeys";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

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
const PAGE_MAX = 480;
const PUZZLE_MAX_W = 560;
const PUZZLE_MAX_H = 1000;
const ARCADE_MAX_W = 640;
const ARCADE_MAX_H = 1120;
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
function pageProbe() {
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
    desktop: matchMedia("(min-width: 1180px) and (min-height: 560px) and (hover: hover) and (pointer: fine)").matches,
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
  const timer = header?.querySelector("[role='timer']") ?? null;
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
    timer: box(timer),
    ring: box(timer?.querySelector("svg") ?? null),
    seconds: timer?.querySelector("span") ? parseFloat(getComputedStyle(timer.querySelector("span")!).fontSize) : 0,
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
  if (m.column.w > PAGE_MAX + 0.5) problems.push(`page column ${m.column.w.toFixed(1)}px wide (max ${PAGE_MAX})`);
  if (!near(m.column.x, m.innerW - m.column.r)) problems.push(`page column not centred (${m.column.x.toFixed(1)} | ${(m.innerW - m.column.r).toFixed(1)})`);
  if (m.scrollX > 0) problems.push(`page scrolls sideways by ${m.scrollX}px`);
  if (m.smallest && m.smallest.size < 10) problems.push(`text "${m.smallest.text}" is ${m.smallest.size}px (under 10px, the phone's smallest)`);
}

function judgePlay(m: ReturnType<typeof playProbe>, arcade: boolean, problems: string[]) {
  if (!m.column || !m.stage) return void problems.push("no live round");
  const maxW = arcade ? ARCADE_MAX_W : PUZZLE_MAX_W;
  const maxH = arcade ? ARCADE_MAX_H : PUZZLE_MAX_H;
  if (m.arcade !== arcade) problems.push(`arcade play screen ${m.arcade}, expected ${arcade}`);
  if (m.column.w > maxW + 0.5) problems.push(`column ${m.column.w.toFixed(1)}px wide (max ${maxW})`);
  if (m.column.w < Math.min(maxW, m.innerW) - 0.5) problems.push(`column ${m.column.w.toFixed(1)}px wide (should be ${Math.min(maxW, m.innerW)})`);
  if (m.column.h > maxH + 0.5) problems.push(`column ${m.column.h.toFixed(1)}px tall (max ${maxH})`);
  if (!near(m.column.x, m.innerW - m.column.r)) problems.push(`column not centred across (${m.column.x.toFixed(1)} | ${(m.innerW - m.column.r).toFixed(1)})`);
  if (!near(m.column.y, m.innerH - m.column.b)) problems.push(`column not centred down (${m.column.y.toFixed(1)} | ${(m.innerH - m.column.b).toFixed(1)})`);
  if (m.column.y < -0.5 || m.column.b > m.innerH + 0.5) problems.push(`column off screen (${fmt(m.column)})`);
  if (m.scrollX > 0 || m.scrollY > 0) problems.push(`page scrolls (${m.scrollX}, ${m.scrollY})`);
  for (const c of m.controls) {
    if (c.x < m.column.x - 0.5 || c.r > m.column.r + 0.5 || c.y < m.column.y - 0.5 || c.b > m.innerH + 0.5) problems.push(`control "${c.what}" outside the column or screen (${fmt(c)})`);
  }
  if (m.arena && (m.arena.x < m.column.x - 0.5 || m.arena.r > m.column.r + 0.5 || m.arena.b > m.innerH + 0.5)) problems.push(`board outside the column (${fmt(m.arena)})`);
  if (!arcade) return;
  // The game frame (Polish 2): the same 60px header, 48px ring and 15px seconds as on a phone.
  if (!m.header || !near(m.header.h, 60, 0.5)) problems.push(`header ${m.header?.h ?? "missing"}px tall (want 60)`);
  if (!m.ring || !near(m.ring.w, 48, 0.5)) problems.push(`timer ring ${m.ring?.w ?? "missing"}px (want 48)`);
  if (!near(m.seconds, 15, 0.5)) problems.push(`timer seconds ${m.seconds}px (want 15)`);
  if (m.timer && m.header && !near(m.timer.x + m.timer.w / 2, m.header.x + m.header.w / 2, 24)) problems.push("timer not centred in the header");
  if (!m.slot || !m.arena || !m.worldW) return void problems.push("no arena slot / world");
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

async function open(mode: string, opts: { room?: unknown; size: readonly [number, number]; dpr?: number; touch?: boolean }): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width: opts.size[0], height: opts.size[1] }, deviceScaleFactor: opts.dpr ?? 1, hasTouch: opts.touch ?? false });
  await context.addInitScript(
    (r) => {
      // Full effects, as every geometry proof: the low-end governor must not resize a canvas mid-proof.
      (window as unknown as { __duelzEffects: string }).__duelzEffects = "full";
      (window as unknown as { __harness: unknown }).__harness = { puzzles: r.puzzles, verdict: { isCorrect: true, score: 150 }, latencyMs: 50, submissions: [], verdictAt: null, room: r.room };
      try {
        localStorage.setItem(r.key, "1");
      } catch {
        /* ignore */
      }
    },
    { room: opts.room ?? null, puzzles: PUZZLE_DATA, key: ONBOARDING_KEY },
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

/** Opens a game from the practice list and starts its live round; checks the intro's keys on the way. */
async function startRound(page: Page, type: PuzzleType, problems: string[]) {
  await page.getByRole("button", { name: gameDisplayName(type), exact: true }).first().click();
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
        judgePage(await page.evaluate(pageProbe), problems);
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
      const { page, close } = await open("practice", { size: SIZES[0], dpr });
      try {
        await page.getByRole("button", { name: gameDisplayName(type), exact: true }).first().waitFor({ timeout: 60_000 });
        const intro: string[] = [];
        await startRound(page, type, intro);
        await report(`${type} intro ${SIZES[0][0]}x${SIZES[0][1]} DPR ${dpr}`, intro);
        for (const size of SIZES) {
          await page.setViewportSize({ width: size[0], height: size[1] });
          await page.waitForTimeout(250);
          const problems: string[] = [];
          judgePlay(await page.evaluate(playProbe), arcade, problems);
          await report(`${type} live ${size[0]}x${size[1]} DPR ${dpr}`, problems, page);
        }
      } finally {
        await close();
      }
    }
  }

  // Resizing one arcade round through every size, a phone-layout window and back, frame by frame.
  {
    const { page, close } = await open("practice", { size: [1920, 1080] });
    try {
      await page.getByRole("button", { name: gameDisplayName("burst"), exact: true }).first().waitFor({ timeout: 60_000 });
      await startRound(page, "burst", []);
      const steps: [number, number][] = [];
      for (let w = 1920, h = 1080; w >= 1280; w -= 80, h = Math.max(720, h - 45)) steps.push([w, h]);
      steps.push([1024, 768], [1366, 768], [1440, 900]);
      for (const [w, h] of steps) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(120);
        const problems: string[] = [];
        const m = await page.evaluate(playProbe);
        if (w >= 1180) judgePlay(m, true, problems);
        else if (!m.column || m.column.w < w - 1) problems.push(`a ${w}px window should keep the phone layout (column ${m.column?.w ?? "missing"}px)`);
        await report(`resize burst ${w}x${h}`, problems);
      }
    } finally {
      await close();
    }
  }

  // Keys drive the games through their own handlers: Nucleus's letters and Backspace, Gemstone's cursor.
  {
    const { page, close } = await open("practice", { size: [1440, 900] });
    const problems: string[] = [];
    try {
      await page.getByRole("button", { name: gameDisplayName("wordsmith"), exact: true }).first().waitFor({ timeout: 60_000 });
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
    const gem = await open("practice", { size: [1440, 900] });
    try {
      await gem.page.getByRole("button", { name: gameDisplayName("matchup"), exact: true }).first().waitFor({ timeout: 60_000 });
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

  // A touch screen of the same size keeps the phone layout.
  {
    const { page, close } = await open("practice", { size: [1440, 900], touch: true });
    try {
      await page.getByRole("button", { name: gameDisplayName("matchup"), exact: true }).first().waitFor({ timeout: 60_000 });
      const problems: string[] = [];
      await page.getByRole("button", { name: gameDisplayName("matchup"), exact: true }).first().click();
      const ready = page.getByRole("button", { name: /^Ready/ }).first();
      await ready.waitFor({ timeout: 30_000 });
      if (await page.locator("[data-desktop-keys]").count()) problems.push("a touch screen shows the desktop keys");
      await ready.click();
      await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(4200);
      const m = await page.evaluate(playProbe);
      if (!m.column || m.column.w < 1440 - 1) problems.push(`the column is ${m.column?.w ?? "missing"}px (a touch screen keeps the full-width phone layout)`);
      if (!m.header || !near(m.header.h, 60, 0.5)) problems.push(`the header is ${m.header?.h ?? "missing"}px (a touch screen keeps the 60px phone header)`);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(150);
      if (await page.locator("[data-key-cursor]").count()) problems.push("a touch screen took a game key");
      await report("touch screen 1440x900 keeps the phone layout", problems, page);
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
  `PASS: ${judged} desktop geometries at ${SIZES.map(([w, h]) => `${w}x${h}`).join(", ")} and while resizing: pages a centred ≤${PAGE_MAX}px column, text ≥ 10px; puzzle rounds (${PUZZLES.join(", ")}) a centred ≤${PUZZLE_MAX_W}×${PUZZLE_MAX_H} column; arcade rounds (${ARCADE.join(", ")}; ${HIGH_DPI.join(", ")} at DPR 1 and 2 too) a centred ≤${ARCADE_MAX_W}×${ARCADE_MAX_H} column, the 60px frame header, 48px timer, the world its phone shape at the largest whole-pixel fit with a crisp canvas, the fill over the whole screen; intros show the keys; keys drive Nucleus and Gemstone; a touch screen keeps the phone layout and takes no keys.`,
);
