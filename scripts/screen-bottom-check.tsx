/**
 * Screen bottoms (16 Oct 2026, display only): every non-game screen is black (the screen
 * edge's #070709) all the way to the bottom of the screen, as an iPhone 11 home-screen app.
 *
 * Headless Chromium in the iPhone 11 home-screen app's geometry (scripts/device-emulation.ts:
 * 414 × 896, 48 / 34 px insets, laid out 414 × 848 as WebKit does, navigator.standalone) draws
 * the real screens through scripts/safe-area-harness.tsx (the home, practice and room routes,
 * network stubbed): home, the first-time intro, the practice list, tournaments and profile (the
 * app shell's tab screens, with the tab bar over the home-bar strip), a practice round intro,
 * and a room's lobby (2 and 10 players), link join, Prepare to Duel, round title, round intro,
 * round result, standings and podium (2 and 10 players) and winner reveal. For each screen, at
 * the top of the page and, when the page scrolls, half-way down and at the end of its scroll:
 *  - the page behind (html and body) is #070709: it is what shows below a page shorter than the
 *    screen, in the strip below the 848 px layout viewport down to the screen's bottom, and
 *    during an overscroll bounce (which headless Chromium cannot draw, so it is proved here);
 *  - the bottom 34 rows (the home-bar area) of the screen's own background, drawn with every
 *    piece of content hidden, are #070709 in every pixel (within 2 per channel);
 *  - the bottom 34 rows of the screen as drawn are #070709 in every pixel no content covers
 *    (text, controls, cards and other painted boxes, each grown by its shadow and 4 px of
 *    anti-aliasing), so no band or box paints the home-bar area another colour.
 *
 *   bun scripts/screen-bottom-check.tsx [screen name filter…] [--verbose] [--shots=.shots]
 */
import { existsSync, mkdirSync } from "node:fs";
import type { Page } from "playwright";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import { startSafeAreaServer } from "./safe-area-server";
import { DEVICE_INIT, IPHONE11_APP, emulateDevice } from "./device-emulation";
import { ONBOARDING_KEY } from "../src/lib/onboarding";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData } from "../src/lib/duel/types";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const SHOTS = args.find((a) => a.startsWith("--shots="))?.slice(8);
const ONLY = args.filter((a) => !a.startsWith("--"));
const CHROMIUM = [
  process.env.PLAYWRIGHT_CHROMIUM,
  "/opt/pw-browsers/chromium",
  "/usr/bin/chromium",
].find((path): path is string => Boolean(path && existsSync(path)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}
/** The screen edge's black (--screen-edge). */
const BLACK: [number, number, number] = [7, 7, 9];
const TOLERANCE = 2;
const DEVICE = IPHONE11_APP;

/* ---------------------------------------------------------------- the room states */

const PUZZLE = splitPuzzle(withSeededRandom(41, () => generatePuzzle("sudoku"))).pub as PuzzleData;
/** An arcade round (Gemstone): its result and standings are not puzzle screens. */
const ARCADE = splitPuzzle(withSeededRandom(41, () => generatePuzzle("matchup"))).pub as PuzzleData;
const iso = (ms: number) => new Date(ms).toISOString();
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
];

function roomNow(
  status: "waiting" | "in_progress" | "finished",
  phase: string,
  opts: { join?: boolean; players?: number; arcade?: boolean },
) {
  const now = Date.now();
  const count = opts.players ?? 2;
  const player = (slot: number) => ({
    id: `p${slot}`,
    duel_id: "duel-bottom",
    player_slot: slot,
    display_name: NAMES[slot - 1] ?? `Player ${slot}`,
    user_id: `u${slot}`,
    ready_round: 1,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: iso(now),
    status: "active",
    joined_at: iso(now - 60_000),
  });
  const result = (slot: number) => ({
    id: `r${slot}`,
    duel_id: "duel-bottom",
    player_slot: slot,
    round_number: 1,
    answer: "",
    is_correct: slot % 3 !== 0,
    ms_remaining: 20_000 - slot * 900,
    reaction_avg_ms: null,
    correct_count: null,
    errors: null,
    extra: null,
    score: 190 - slot * 13,
    submitted_at: iso(now - 5_000),
  });
  const scored = status === "finished" || ["result", "standings", "winner_reveal"].includes(phase);
  const players = Array.from({ length: count }, (_, i) => player(i + 1));
  if (opts.join) players[0] = { ...players[0]!, status: "left" };
  return {
    duel: {
      id: "duel-bottom",
      room_code: "SAFE",
      status,
      selected_categories: [],
      tournament_history: [],
      disbanded_at: null,
      host_user_id: "u1",
      max_players: 10,
      round_count: 1,
      round_order: [opts.arcade ? "matchup" : "sudoku"],
      no_maths: false,
      puzzles_public: [opts.arcade ? ARCADE : PUZZLE],
      current_round: status === "waiting" ? 0 : 1,
      phase,
      phase_started_at: iso(now + 500),
      round_started_at: iso(now + 500),
      next_duel_id: null,
      created_at: iso(now - 60_000),
    },
    players,
    results: scored ? players.map((p) => result(p.player_slot)) : [],
  };
}
const room =
  (
    status: "waiting" | "in_progress" | "finished",
    phase: string,
    opts: { join?: boolean; players?: number; arcade?: boolean } = {},
  ) =>
  () =>
    roomNow(status, phase, opts);

interface Screen {
  name: string;
  mode: "home" | "practice" | "tournaments" | "profile" | "room";
  room?: () => ReturnType<typeof roomNow>;
  go?: (page: Page) => Promise<void>;
  waitMs?: number;
  fresh?: boolean;
  /**
   * Settles a timed screen: once the page is up, restarts the room's phase this long ago (ms), so it
   * is measured at the same point of its timeline however long the page took to load.
   */
  settleAt?: number;
  /** A selector that must still be on screen after the last screenshot (the screen didn't move on). */
  expect?: string;
}
const openGame = async (page: Page) => {
  await page.getByRole("button", { name: "Box Six", exact: true }).first().click();
  await page
    .getByRole("button", { name: /^Ready/ })
    .first()
    .waitFor({ timeout: 30_000 });
};
const ALL_SCREENS: Screen[] = [
  { name: "home (room join)", mode: "home" },
  { name: "first-time intro", mode: "home", fresh: true },
  { name: "practice list", mode: "practice" },
  { name: "tournaments", mode: "tournaments" },
  { name: "profile", mode: "profile" },
  { name: "practice round intro", mode: "practice", go: openGame },
  { name: "room lobby, 2 players", mode: "room", room: room("waiting", "starting") },
  {
    name: "room lobby, 10 players",
    mode: "room",
    room: room("waiting", "starting", { players: 10 }),
  },
  { name: "room link join", mode: "room", room: room("waiting", "starting", { join: true }) },
  { name: "Prepare to Duel", mode: "room", room: room("in_progress", "starting"), waitMs: 1200 },
  // The title runs ROUND_TITLE_MS (3 s) from the phase start, then the room shows the round intro. A
  // one-round room plays the Final Round moment, whose shock rings are done 1.8 s in (FINAL_SPEC);
  // measured from page load, a fast load caught the screen mid-moment and a slow one caught the intro
  // fading in (the CI flake, 85 px of #18181a at (165, 814)), so it is measured at 1.85 s, settled.
  {
    name: "round title",
    mode: "room",
    room: room("in_progress", "round_title"),
    settleAt: 1850,
    expect: '[aria-label="Round title"]',
  },
  { name: "room round intro", mode: "room", room: room("in_progress", "intro"), waitMs: 1500 },
  {
    name: "round result, 2 players",
    mode: "room",
    room: room("in_progress", "result"),
    waitMs: 2500,
  },
  {
    name: "round result, 10 players",
    mode: "room",
    room: room("in_progress", "result", { players: 10 }),
    waitMs: 2500,
  },
  {
    name: "standings, 2 players",
    mode: "room",
    room: room("in_progress", "standings"),
    waitMs: 2500,
  },
  {
    name: "standings, 10 players",
    mode: "room",
    room: room("in_progress", "standings", { players: 10 }),
    waitMs: 2500,
  },
  {
    name: "round result after an arcade round, 10 players",
    mode: "room",
    room: room("in_progress", "result", { players: 10, arcade: true }),
    waitMs: 2500,
  },
  {
    name: "standings after an arcade round, 10 players",
    mode: "room",
    room: room("in_progress", "standings", { players: 10, arcade: true }),
    waitMs: 2500,
  },
  { name: "winner reveal", mode: "room", room: room("in_progress", "winner_reveal"), waitMs: 3000 },
  {
    name: "final results (podium), 2 players",
    mode: "room",
    room: room("finished", "result"),
    waitMs: 3000,
  },
  {
    name: "final results (podium), 10 players",
    mode: "room",
    room: room("finished", "result", { players: 10 }),
    waitMs: 3000,
  },
];
const SCREENS = ONLY.length
  ? ALL_SCREENS.filter((s) => ONLY.some((o) => s.name.includes(o)))
  : ALL_SCREENS;

/* ---------------------------------------------------------------- the measurement */

/** Everything but the screen's own background layers hidden (and its drift still). */
const BACKGROUND_ONLY = `body * { visibility: hidden !important; transition: none !important; animation-play-state: paused !important; }
.screen-background, .screen-background *, .duel-start-screen { visibility: visible !important; }`;

/** In-page: the content boxes (each grown by its shadow and 4 px) and the page colours behind. */
function contentProbe() {
  const visible = (el: Element) => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0)
        return false;
    }
    return true;
  };
  const opaque = (c: string) => !/rgba\([^)]*,\s*0\)|transparent/.test(c);
  const shadowReach = (shadow: string) =>
    shadow === "none"
      ? 0
      : Math.min(
          48,
          Math.max(
            ...shadow
              .split(/,(?![^(]*\))/)
              .map((one) =>
                [...one.matchAll(/(-?[\d.]+)px/g)].reduce(
                  (sum, m) => sum + Math.abs(Number(m[1])),
                  0,
                ),
              ),
          ),
        );
  const rects: [number, number, number, number][] = [];
  const shell = document.querySelector(".screen-background")?.parentElement ?? null;
  for (const el of document.body.querySelectorAll("*")) {
    // The screen's own layers: what is being tested.
    if (
      el === shell ||
      el.matches(
        "#root, [data-game-column], .screen-background, .screen-background *, .duel-start-screen, .fx-layer",
      )
    )
      continue;
    const cs = getComputedStyle(el);
    const media = el.matches(
      "button, input, select, textarea, canvas, svg, img, [role='button'], .fx-layer > *",
    );
    const text = [...el.childNodes].some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim(),
    );
    const painted =
      opaque(cs.backgroundColor) ||
      cs.backgroundImage !== "none" ||
      cs.boxShadow !== "none" ||
      ["top", "bottom", "left", "right"].some(
        (side) =>
          parseFloat(cs.getPropertyValue(`border-${side}-width`)) > 0 &&
          opaque(cs.getPropertyValue(`border-${side}-color`)),
      );
    if (!media && !text && !painted) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || !visible(el)) continue;
    const grow = 4 + shadowReach(cs.boxShadow);
    rects.push([r.left - grow, r.top - grow, r.right + grow, r.bottom + grow]);
  }
  return {
    rects,
    html: getComputedStyle(document.documentElement).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor,
    innerHeight: window.innerHeight,
    scrollY: window.scrollY,
    maxScroll: document.documentElement.scrollHeight - window.innerHeight,
  };
}

const rgbOf = (c: string): [number, number, number] | null => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c);
  if (!m || (m[4] !== undefined && Number(m[4]) < 1)) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const off = (px: number[]) =>
  Math.max(Math.abs(px[0]! - BLACK[0]), Math.abs(px[1]! - BLACK[1]), Math.abs(px[2]! - BLACK[2]));
const hex = (px: number[]) =>
  `#${px
    .slice(0, 3)
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;

/** The bottom `rows` rows of a screenshot: pixels off black, outside `covered` boxes. */
async function bottomRows(png: Buffer, rows: number, covered: [number, number, number, number][]) {
  const img = await loadImage(png);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
  let tested = 0;
  let bad = 0;
  let first: { x: number; y: number; px: number[] } | null = null;
  for (let y = height - rows; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (covered.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1)) continue;
      tested++;
      const i = (y * width + x) * 4;
      const px = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (off(px) > TOLERANCE) {
        bad++;
        first ??= { x, y, px };
      }
    }
  return { tested, bad, first };
}

/* ---------------------------------------------------------------- the run */

const server = await startSafeAreaServer({
  cacheDir: "node_modules/.vite-screen-bottom",
  buildId: "screen-bottom-check",
});
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const failures: string[] = [];
const checked: string[] = [];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

async function settle(page: Page, at: number) {
  await page.evaluate((ms) => {
    const h = (window as unknown as { __harness: { update: (f: (r: { duel: { phase_started_at: string } }) => void) => void } }).__harness;
    h.update((r) => {
      r.duel.phase_started_at = new Date(Date.now() - ms).toISOString();
    });
  }, at);
  await page.waitForTimeout(200);
}

async function goto(page: Page, url: string, where: string) {
  try {
    await page.goto(url, { timeout: 180_000 });
  } catch (error) {
    if (!/Timeout \d+ms exceeded/.test(String((error as Error).message))) throw error;
    console.log(`  ${where}: first load timed out; retrying once`);
    await page.goto(url, { timeout: 90_000 });
  }
}

try {
  for (const screen of SCREENS) {
    const where = `${screen.name} (414x896 home-screen app)`;
    const context = await browser.newContext({ viewport: { width: DEVICE.w, height: DEVICE.h } });
    await context.addInitScript(DEVICE_INIT);
    await context.addInitScript(
      (r) => {
        (window as unknown as { __harness: unknown }).__harness = {
          puzzles: { sudoku: r.puzzle },
          verdict: { isCorrect: true, score: 150 },
          latencyMs: 50,
          submissions: [],
          verdictAt: null,
          room: r.room,
        };
        try {
          if (r.seen) localStorage.setItem(r.key, "1");
        } catch {
          /* ignore */
        }
      },
      { room: screen.room?.() ?? null, puzzle: PUZZLE, seen: !screen.fresh, key: ONBOARDING_KEY },
    );
    const page = await context.newPage();
    const problems: string[] = [];
    const positions: string[] = [];
    try {
      await goto(page, `${server.origin}/safe-area.html?mode=${screen.mode}`, where);
      if (screen.mode === "practice")
        await page
          .getByRole("button", { name: "Box Six", exact: true })
          .first()
          .waitFor({ timeout: 60_000 });
      else await page.waitForSelector("#root *", { timeout: 60_000 });
      await emulateDevice(page, DEVICE);
      await page.waitForTimeout(800);
      if (screen.go) await screen.go(page);
      if (screen.settleAt !== undefined) await settle(page, screen.settleAt);
      else await page.waitForTimeout(screen.waitMs ?? 600);
      const first = await page.evaluate(contentProbe);
      const stops =
        first.maxScroll > 0 ? [0, Math.round(first.maxScroll / 2), first.maxScroll] : [0];
      for (const y of stops) {
        await page.evaluate((to) => window.scrollTo(0, to), y);
        await page.waitForTimeout(150);
        const at =
          stops.length === 1
            ? "fits the screen"
            : y === 0
              ? "scroll top"
              : y === first.maxScroll
                ? `scroll end (${y}px)`
                : `mid-scroll (${y}px)`;
        positions.push(at);
        const probe = await page.evaluate(contentProbe);
        for (const [name, colour] of [
          ["html", probe.html],
          ["body", probe.body],
        ] as const) {
          const rgb = rgbOf(colour);
          if (!rgb || off(rgb) > TOLERANCE)
            problems.push(
              `${at}: the page behind (${name}) is ${colour}, not ${hex(BLACK)} (shows below the layout viewport and on overscroll)`,
            );
        }
        const full = await page.screenshot();
        const style = await page.addStyleTag({ content: BACKGROUND_ONLY });
        await page.waitForTimeout(80);
        const bg = await page.screenshot();
        await style.evaluate((el) => el.remove());
        if (SHOTS) {
          const tag = `${screen.name.replace(/\W+/g, "-")}-${y}`;
          const { writeFileSync } = await import("node:fs");
          writeFileSync(`${SHOTS}/bottom-${tag}.png`, full);
        }
        const background = await bottomRows(bg, DEVICE.bottom, []);
        if (background.bad)
          problems.push(
            `${at}: the screen background's home-bar strip has ${background.bad} pixel(s) off black, first ${hex(background.first!.px)} at (${background.first!.x}, ${background.first!.y})`,
          );
        const drawn = await bottomRows(full, DEVICE.bottom, probe.rects);
        if (drawn.bad)
          problems.push(
            `${at}: ${drawn.bad} uncovered pixel(s) in the home-bar strip off black, first ${hex(drawn.first!.px)} at (${drawn.first!.x}, ${drawn.first!.y})`,
          );
        if (VERBOSE)
          console.log(
            `  ${where} ${at}: ${background.tested} background and ${drawn.tested} uncovered pixels tested`,
          );
      }
      if (screen.expect && !(await page.locator(screen.expect).count()))
        problems.push(`the screen moved on (no ${screen.expect}) before it was measured`);
    } catch (error) {
      problems.push(String((error as Error).message ?? error).split("\n")[0]!);
    } finally {
      await context.close();
    }
    for (const p of problems) failures.push(`${where}: ${p}`);
    checked.push(`${screen.name} (${positions.join(", ") || "not drawn"})`);
    console.log(
      `${problems.length ? "FAIL" : "PASS"} ${where}: ${problems.length ? problems[0] : `black to the bottom at ${positions.join(", ")}`}`,
    );
  }
} finally {
  await browser.close();
  await server.close();
}

for (const f of failures) console.log(`  ${f}`);
if (failures.length) {
  console.log(
    `FAIL: ${failures.length} problem(s): a non-game screen is not black to the bottom of the screen`,
  );
  process.exit(1);
}
console.log(
  `PASS: ${SCREENS.length} non-game screens black (${hex(BLACK)}) to the screen's bottom as an iPhone 11 home-screen app: ${checked.join("; ")}`,
);
