/**
 * First paint (16 Oct 2026, display only): a puzzle round's board is drawn in its final
 * place from its very first frame, in practice and in a room.
 *
 * The bug it guards: GameLayout's entrance animation (phase-in: a fade plus a 10 px rise)
 * started its clock before a slow first frame was drawn, so a phone painted the board
 * several px low and then snapped it up; and the game screen's scroll reset ran after the
 * first frame of a round that starts on a timer (a room's server deadline), so a scrolled
 * intro page drew the round offset for a frame. GameLayout now fades only (animate-round-in)
 * and the scroll reset runs before paint (PhoneShell useRootSelectionLock).
 *
 * Headless Chromium as an iPhone 11 home-screen app (scripts/device-emulation.ts: 414 × 896,
 * 48 / 34 px insets, laid out 414 × 848, navigator.standalone), the CPU slowed 4× so the
 * first frame is slow as on a phone, through scripts/safe-area-harness.tsx (the real practice
 * and room routes, network stubbed). For a sample of puzzle games (two or more per category)
 * it opens the round intro, scrolls the intro page to its end and starts the round: in
 * practice with Ready, in a room by the server moving the phase on (no input, as the shared
 * deadline does). From the first animation frame the game stage exists it records, every
 * frame for 1.2 s, the box of the stage, of every [data-game-arena] and of the board (the
 * stage's largest descendant), and fails if any of them is ever more than 0.5 px from where
 * it ends up, or if the page is scrolled while the round is up.
 *
 * Standalone, late geometry (17 Oct 2026, fix-up after #95): an iOS home-screen app reopened
 * after being closed settles its geometry after the round's first frame: it lays the page out
 * full height with no safe-area insets, then short by the top inset (the 48 px shortfall of
 * WebKit bug 254868) with the 48 / 34 px insets. A second pass opens a sample of the same
 * rounds as a home-screen app (navigator.standalone) laid out 414 × 896 with no insets and,
 * from the stage's first animation frame, applies the 414 × 848 layout viewport and the insets
 * (CDP, as iOS does, a frame or two late). A round must not be seen to move: frames where the
 * game column is held hidden (PhoneShell's geometry hold, data-geometry-hold) are not judged,
 * every visible one is, and the late geometry must have landed.
 *
 *   bun scripts/first-paint-check.ts [games…] [--verbose] [--late-only]
 */
import { existsSync } from "node:fs";
import type { Page } from "playwright";

import { startSafeAreaServer } from "./safe-area-server";
import { DEVICE_INIT, IPHONE11_APP, emulateDevice, type DeviceConfig } from "./device-emulation";
import { ONBOARDING_KEY } from "../src/lib/onboarding";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { showPracticeSide } from "./practice-side-lib";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
/** Only the standalone late-geometry pass. */
const LATE_ONLY = args.includes("--late-only");
const CHROMIUM = [
  process.env.PLAYWRIGHT_CHROMIUM,
  "/opt/pw-browsers/chromium",
  "/usr/bin/chromium",
].find((path): path is string => Boolean(path && existsSync(path)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

/** Two or more puzzle games from each category: word, number, speed, attention, pattern, logic. */
const PRACTICE_GAMES: PuzzleType[] = [
  "wordsmith",
  "wordsearch",
  "codeword",
  "wordslide",
  "target",
  "numpyramid",
  "balance",
  "numhunt",
  "stopwatch",
  "symscan",
  "maze",
  "pipes",
  "flow",
  "rings",
  "blockparty",
  "sudoku",
  "flood",
  "bomb",
];
/** Rooms share GameLayout; a few of them through the room route's server-timed start. */
const ROOM_GAMES: PuzzleType[] = ["wordsmith", "target", "flow", "sudoku"];
const named = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
const practiceGames = named.length ? named : PRACTICE_GAMES;
const roomGames = named.length ? named : ROOM_GAMES;
/** The standalone late-geometry pass: a game or more per category, practice and room. */
const LATE_PRACTICE_GAMES: PuzzleType[] = [
  "wordsmith",
  "target",
  "stopwatch",
  "symscan",
  "flow",
  "sudoku",
  "bomb",
];
const LATE_ROOM_GAMES: PuzzleType[] = ["wordsmith", "flow"];
const latePracticeGames = named.length ? named : LATE_PRACTICE_GAMES;
const lateRoomGames = named.length ? named : LATE_ROOM_GAMES;
/** A reopened home-screen app's first geometry: laid out the whole screen, no insets yet. */
const LATE_START: DeviceConfig = {
  ...IPHONE11_APP,
  key: "iphone11-app-late",
  label: "iPhone 11 home-screen app reopened (414x896, insets and shortfall late)",
  h: IPHONE11_APP.screenH,
  top: 0,
  bottom: 0,
};
/** Allowed drift from the final box, in CSS px. */
const TOLERANCE_PX = 0.5;
const RECORD_MS = 1200;
const CPU_SLOWDOWN = 4;

const puzzles: Record<string, PuzzleData> = {};
for (const type of new Set([
  ...practiceGames,
  ...roomGames,
  ...latePracticeGames,
  ...lateRoomGames,
]))
  puzzles[type] = splitPuzzle(withSeededRandom(41, () => generatePuzzle(type))).pub as PuzzleData;

const iso = (ms: number) => new Date(ms).toISOString();
function roomState(type: PuzzleType) {
  const now = Date.now();
  const player = (slot: number, name: string) => ({
    id: `p${slot}`,
    duel_id: "duel-paint",
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
  return {
    duel: {
      id: "duel-paint",
      room_code: "SAFE",
      status: "in_progress",
      selected_categories: [],
      tournament_history: [],
      disbanded_at: null,
      host_user_id: "u1",
      max_players: 10,
      round_count: 6,
      round_order: Array.from({ length: 6 }, () => type),
      no_maths: false,
      puzzles_public: Array.from({ length: 6 }, () => puzzles[type]),
      current_round: 1,
      phase: "intro",
      phase_started_at: iso(now),
      round_started_at: iso(now),
      next_duel_id: null,
      created_at: iso(now - 60_000),
    },
    players: [player(1, "Me"), player(2, "Another player")],
    results: [],
  };
}

/**
 * In-page: from the first frame the stage exists, every frame's boxes, whether the game column
 * is held hidden, and (late pass) the late geometry asked for on that first frame.
 */
const RECORDER = (late: boolean) => `(() => {
  const late = ${late};
  let asked = false;
  const frames = [];
  window.__paintFrames = frames;
  const ids = new WeakMap();
  let next = 0;
  const id = (el) => { if (!ids.has(el)) ids.set(el, next++); return ids.get(el); };
  const started = performance.now();
  const tick = () => {
    const stage = document.querySelector("[data-game-stage]");
    if (stage) {
      if (late && !asked) {
        asked = true;
        window.__applyLate();
      }
      const boxes = {};
      const put = (el, kind) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        boxes[id(el)] = { kind, x: r.left, y: r.top, w: r.width, h: r.height, area: r.width * r.height };
      };
      put(stage, "stage");
      for (const el of stage.querySelectorAll("[data-game-arena]")) put(el, "arena");
      for (const el of stage.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width * r.height >= 4000) put(el, "board");
      }
      const hidden = !stage.checkVisibility({ visibilityProperty: true });
      frames.push({ t: performance.now() - started, scrollY: window.scrollY, hidden, innerH: window.innerHeight, boxes });
    }
    if (performance.now() - started < 30000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

interface Frame {
  t: number;
  scrollY: number;
  /** The game column held hidden (not drawn): not judged. */
  hidden: boolean;
  innerH: number;
  boxes: Record<string, { kind: string; x: number; y: number; w: number; h: number; area: number }>;
}

/** Judge a recording: the stage, the arenas and the board never away from their final boxes. */
function judge(recorded: Frame[], late = false): string[] {
  const problems: string[] = [];
  if (late && recorded[recorded.length - 1]?.innerH !== IPHONE11_APP.h)
    problems.push(
      `the late geometry never landed (innerHeight ${recorded[recorded.length - 1]?.innerH})`,
    );
  const frames = recorded.filter((f) => !f.hidden);
  if (frames.length < 3) return [...problems, `only ${frames.length} visible frame(s) recorded`];
  const last = frames[frames.length - 1]!;
  // The board: the largest descendant box that is not the stage itself and is narrower than it
  // or shorter (the column wrappers span the stage; the board is the largest thing in it).
  const stage = Object.entries(last.boxes).find(([, b]) => b.kind === "stage");
  const tracked = new Set<string>(
    Object.entries(last.boxes)
      .filter(([, b]) => b.kind !== "board")
      .map(([k]) => k),
  );
  const boards = Object.entries(last.boxes)
    .filter(
      ([, b]) => b.kind === "board" && stage && (b.w < stage[1].w - 1 || b.h < stage[1].h - 1),
    )
    .sort((a, b) => b[1].area - a[1].area);
  if (boards[0]) tracked.add(boards[0][0]);
  const first = frames[0]!;
  for (const key of tracked) {
    const end = last.boxes[key]!;
    if (!first.boxes[key]) {
      // Mounted after the stage's first frame: judged from its own first frame.
    }
    let worst = 0;
    let at: Frame | null = null;
    for (const f of frames) {
      const b = f.boxes[key];
      if (!b) continue;
      const d = Math.max(
        Math.abs(b.x - end.x),
        Math.abs(b.y - end.y),
        Math.abs(b.w - end.w),
        Math.abs(b.h - end.h),
      );
      if (d > worst) {
        worst = d;
        at = f;
      }
    }
    if (VERBOSE && worst > TOLERANCE_PX) {
      let prev = "";
      for (const f of frames) {
        const b = f.boxes[key];
        const k = b
          ? `(${b.x.toFixed(1)}, ${b.y.toFixed(1)}) ${b.w.toFixed(1)}×${b.h.toFixed(1)}`
          : "absent";
        if (k !== prev) console.log(`    ${end.kind} ${key} ${Math.round(f.t - first.t)} ms ${k}`);
        prev = k;
      }
    }
    if (worst > TOLERANCE_PX && at) {
      const b = at.boxes[key]!;
      problems.push(
        `${end.kind === "board" ? "board" : end.kind} at (${b.x.toFixed(1)}, ${b.y.toFixed(1)}) ${b.w.toFixed(1)}×${b.h.toFixed(1)} at ${Math.round(at.t - first.t)} ms, ends at (${end.x.toFixed(1)}, ${end.y.toFixed(1)}) ${end.w.toFixed(1)}×${end.h.toFixed(1)}`,
      );
    }
  }
  const scrolled = frames.find((f) => f.scrollY !== 0);
  if (scrolled)
    problems.push(`page scrolled ${scrolled.scrollY}px at ${Math.round(scrolled.t - first.t)} ms`);
  return problems;
}

async function record(page: Page): Promise<Frame[]> {
  await page.waitForFunction(
    (ms) => {
      const f = (window as unknown as { __paintFrames?: { t: number }[] }).__paintFrames;
      return Boolean(f && f.length && f[f.length - 1]!.t - f[0]!.t >= ms);
    },
    RECORD_MS,
    { timeout: 60_000 },
  );
  return page.evaluate(() => {
    const frames = (window as unknown as { __paintFrames: Frame[] }).__paintFrames;
    const t0 = frames[0]!.t;
    return frames.filter((f) => f.t - t0 <= 1200);
  });
}

const server = await startSafeAreaServer({
  cacheDir: "node_modules/.vite-first-paint",
  buildId: "first-paint-check",
});
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const failures: string[] = [];

async function open(
  mode: "practice" | "room",
  room: unknown,
  where: string,
  late = false,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const device = late ? LATE_START : IPHONE11_APP;
  const context = await browser.newContext({
    viewport: { width: device.w, height: device.h },
  });
  await context.addInitScript(DEVICE_INIT);
  if (late) {
    // The geometry iOS settles late: the short layout viewport and the insets, sent (not
    // awaited by the page) from the stage's first frame.
    await context.exposeBinding("__applyLate", async ({ page }) => {
      const cdp = await page.context().newCDPSession(page);
      await Promise.all([
        cdp.send(
          "Emulation.setSafeAreaInsetsOverride" as never,
          {
            insets: { top: IPHONE11_APP.top, bottom: IPHONE11_APP.bottom, left: 0, right: 0 },
          } as never,
        ),
        page.setViewportSize({ width: IPHONE11_APP.w, height: IPHONE11_APP.h }),
      ]);
      await cdp.detach().catch(() => {});
    });
  }
  await context.addInitScript(
    (r) => {
      (window as unknown as { __harness: unknown }).__harness = {
        puzzles: r.puzzles,
        verdict: { isCorrect: true, score: 150 },
        latencyMs: 50,
        submissions: [],
        verdictAt: null,
        room: r.room,
      };
      try {
        localStorage.setItem(r.key, "1");
      } catch {
        /* ignore */
      }
    },
    { puzzles, room, key: ONBOARDING_KEY },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]!));
  try {
    await page.goto(`${server.origin}/safe-area.html?mode=${mode}`, { timeout: 180_000 });
  } catch (error) {
    if (!/Timeout \d+ms exceeded/.test(String((error as Error).message))) throw error;
    console.log(`  ${where}: first load timed out; retrying once`);
    await page.goto(`${server.origin}/safe-area.html?mode=${mode}`, { timeout: 90_000 });
  }
  await page.waitForSelector("#root *", { timeout: 120_000 });
  await emulateDevice(page, device);
  return {
    page,
    close: async () => {
      if (VERBOSE && errors.length)
        console.log(`  ${where} page errors: ${[...new Set(errors)].slice(0, 2).join(" | ")}`);
      await context.close();
    },
  };
}

async function slow(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
}

/** The intro page scrolled to its end (a player who scrolled to Ready, or a chat bar below it). */
async function scrollIntro(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(100);
}

function report(where: string, problems: string[], frames: Frame[]) {
  const held = frames.filter((f) => f.hidden).length;
  for (const p of problems) failures.push(`${where}: ${p}`);
  console.log(
    `${problems.length ? "FAIL" : "PASS"} ${where}: ${
      problems.length
        ? problems[0]
        : `stage, arenas and board in their final place from the first of ${frames.filter((f) => !f.hidden).length} visible frames (${RECORD_MS} ms${held ? `, the first ${held} held hidden` : ""})`
    }`,
  );
}

async function practiceRound(game: PuzzleType, late: boolean) {
  const where = `${late ? "standalone late " : ""}practice ${game} (${gameDisplayName(game)})`;
  const { page, close } = await open("practice", null, where, late);
  try {
    await showPracticeSide(page, game);
    const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
    await button.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(600);
    await button.click();
    const ready = page.getByRole("button", { name: /^Ready/ }).first();
    await ready.waitFor({ timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    await scrollIntro(page);
    await slow(page);
    await page.evaluate(RECORDER(late));
    await ready.click();
    const frames = await record(page);
    report(where, judge(frames, late), frames);
  } catch (error) {
    failures.push(`${where}: ${String((error as Error).message ?? error).split("\n")[0]}`);
    console.log(`FAIL ${where}: did not run`);
  } finally {
    await close();
  }
}

async function roomRound(game: PuzzleType, late: boolean) {
  const where = `${late ? "standalone late " : ""}room ${game} (${gameDisplayName(game)})`;
  const { page, close } = await open("room", roomState(game), where, late);
  try {
    await page
      .getByRole("button", { name: /^Ready/ })
      .first()
      .waitFor({ timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    await scrollIntro(page);
    await slow(page);
    await page.evaluate(RECORDER(late));
    // The server moves the phase on at its deadline: no input on this phone.
    await page.evaluate(() => {
      const H = (window as unknown as { __harness: { room: { duel: Record<string, unknown> } } })
        .__harness;
      const now = new Date(Date.now()).toISOString();
      H.room.duel = {
        ...H.room.duel,
        phase: "puzzle",
        phase_started_at: now,
        round_started_at: now,
      };
    });
    const frames = await record(page);
    report(where, judge(frames, late), frames);
  } catch (error) {
    failures.push(`${where}: ${String((error as Error).message ?? error).split("\n")[0]}`);
    console.log(`FAIL ${where}: did not run`);
  } finally {
    await close();
  }
}

try {
  if (!LATE_ONLY) {
    for (const game of practiceGames) await practiceRound(game, false);
    for (const game of roomGames) await roomRound(game, false);
  }
  for (const game of latePracticeGames) await practiceRound(game, true);
  for (const game of lateRoomGames) await roomRound(game, true);
} finally {
  await browser.close();
  await server.close();
}

for (const f of failures) console.log(`  ${f}`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} problem(s): a puzzle round moved after its first paint`);
  process.exit(1);
}
console.log(
  `PASS: ${LATE_ONLY ? 0 : practiceGames.length} practice and ${LATE_ONLY ? 0 : roomGames.length} room puzzle rounds hold their stage, arenas and board in place from the first painted frame (414x896 home-screen app, CPU ${CPU_SLOWDOWN}x slower), and ${latePracticeGames.length} practice and ${lateRoomGames.length} room rounds from their first visible frame with the shortfall and insets settling late (reopened home-screen app)`,
);
