/**
 * demo-intro-check (23 Oct 2026, Prompt D; display only): every active game's round intro keeps one
 * layout from its first frame to its demo playing, with a demo and without one.
 *
 * The intro's demo box (src/components/duel/IntroStage.tsx) takes the height GOAL, HOW and SCORE leave
 * above READY, whatever is inside it: the game's still (its IntroExample) until a saved demo has drawn
 * its first frame, the demo after that, and the still for good when there is no demo. So nothing on
 * the screen may move when the demo loads or starts.
 *
 * Headless Chromium as an iPhone 11 home-screen app (414 × 848 laid out, 48 / 34 px insets,
 * navigator.standalone, applied before the intro's first frame), through scripts/safe-area-harness.tsx
 * (the real practice route, network stubbed). For each of the 73 active games it opens the practice
 * intro twice: once with a saved demo served 600 ms late (an engine game: a run on a generated puzzle;
 * a puzzle: taps over its fixed intro example, on today's layout and presentation revision) and once
 * with none. From the intro's first animation frame it records, every frame, the boxes of the title,
 * GOAL, HOW, the demo box, SCORE, the time line and READY, and fails if
 *   - any of them is ever more than 0.5 px from where it ends up (with a demo: until 700 ms after the
 *     demo is playing; without: 1.6 s); the intro enters with a fade only (animate-round-in, as the game
 *     screen), and the title's own pop-in scale is judged by its layout box,
 *   - the demo never plays, or plays outside its box, or (a puzzle) its stage never mounts,
 *   - the box shows nothing before the demo (no still), or is empty without a demo,
 *   - the box differs by more than 0.5 px between the two runs (one layout with and without a demo),
 *   - the demo box is under 110 px tall or overlaps READY, or the page scrolls or logs an error.
 *
 *   bun scripts/demo-intro-check.ts [games…] [--part=k/n] [--verbose] [--shots=<dir>]
 *
 * --shots saves the intro once the demo plays (and the still) for review.
 */
import { existsSync, mkdirSync } from "node:fs";
import type { Browser, Page } from "playwright";

import { startSafeAreaServer } from "./safe-area-server";
import { DEVICE_INIT, IPHONE11_APP } from "./device-emulation";
import { warmUp } from "./browser-load";
import { ONBOARDING_KEY } from "../src/lib/onboarding";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { bankedIntroExample } from "../src/lib/duel/puzzleBank.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { GAME_COLUMN_LAYOUT, INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import { puzzlePresentation } from "../src/components/puzzles/wordInput";
import { ACTIVE_PUZZLE_TYPES } from "../src/lib/duel/registry";
import { ARCADE_REVEAL_RENDERERS } from "../src/lib/arcade/revealRenderers";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const SHOTS = args.find((a) => a.startsWith("--shots="))?.slice(8);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const part = args.find((a) => a.startsWith("--part="))?.slice(7);
const named = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

let games: PuzzleType[] = named.length ? named : [...ACTIVE_PUZZLE_TYPES];
if (part) {
  const [k, n] = part.split("/").map(Number) as [number, number];
  games = games.filter((_, i) => i % n === k - 1);
}

const TOLERANCE_PX = 0.5;
const DEMO_DELAY_MS = 600;
const AFTER_PLAYING_MS = 700;
const NO_DEMO_MS = 1600;
const MIN_BOX_PX = 110;
const iso = (ms: number) => new Date(ms).toISOString();

const engine = (type: PuzzleType) => Boolean(ARCADE_REVEAL_RENDERERS[type]);
const pub = (p: PuzzleData) => splitPuzzle(p).pub as PuzzleData;

/** The round practice deals (any puzzle: the intro draws the same whatever it is). */
const practicePuzzle = (type: PuzzleType) => pub(withSeededRandom(41, () => generatePuzzle(type)));

/** A saved demo as getIntroDemoFn returns it: an engine run, or taps over the fixed intro example. */
function demoRow(type: PuzzleType): unknown {
  if (engine(type)) {
    const puzzle = pub(withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type)));
    const seed = "seed" in puzzle ? Number((puzzle as { seed: number }).seed) : 1;
    return { game_type: type, seed, puzzle, input_log: { run: `${seed}|0||0|` }, start_tick: 0, length_ticks: 480 };
  }
  const example = bankedIntroExample(type) ?? withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type));
  const t = (ms: number, x: number, y: number) => ({ t: ms, action: "tap", args: { at: { x, y } } });
  return {
    game_type: type,
    seed: 0,
    puzzle: pub(example),
    input_log: {
      actions: [t(500, 0.5, 0.45), t(1100, 0.35, 0.55), t(1700, 0.65, 0.35)],
      w: 390,
      h: 600,
      layout: GAME_COLUMN_LAYOUT,
      presentation: puzzlePresentation(type),
    },
    start_tick: 0,
    length_ticks: 0,
  };
}

/** In-page: from the intro's first frame, every frame's boxes and the demo box's state. */
const RECORDER = `(() => {
  const frames = [];
  window.__introFrames = frames;
  const pick = {
    title: ".round-intro-title",
    goal: ".intro-goal",
    how: ".intro-how",
    stage: "[data-intro-stage]",
    score: ".intro-score",
    time: ".round-intro-time",
  };
  const started = performance.now();
  const tick = () => {
    const intro = document.querySelector(".round-intro");
    if (intro) {
      const boxes = {};
      for (const [k, sel] of Object.entries(pick)) {
        const el = intro.querySelector(sel);
        if (!el) continue;
        if (k === "title") {
          // The title's pop-in is a scale on the title alone (it moves nothing else): judged by its layout box.
          let x = 0, y = 0;
          for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
          boxes[k] = { x: x - window.scrollX, y: y - window.scrollY, w: el.offsetWidth, h: el.offsetHeight };
          continue;
        }
        const r = el.getBoundingClientRect();
        boxes[k] = { x: r.left, y: r.top, w: r.width, h: r.height };
      }
      const ready = [...intro.querySelectorAll("button")].find((b) => /ready|loading/i.test(b.textContent || ""));
      if (ready) { const r = ready.getBoundingClientRect(); boxes.ready = { x: r.left, y: r.top, w: r.width, h: r.height }; }
      const stage = intro.querySelector("[data-intro-stage]");
      const slot = intro.querySelector("[data-intro-demo-slot]");
      let slotBox = null;
      if (slot) { const r = slot.getBoundingClientRect(); slotBox = { x: r.left, y: r.top, w: r.width, h: r.height }; }
      const still = intro.querySelector("[data-intro-still] > div");
      let stillBox = null;
      if (still) { const r = still.getBoundingClientRect(); stillBox = { x: r.left, y: r.top, w: r.width, h: r.height }; }
      const puzzleStage = intro.querySelector('.intro-demo > div[aria-hidden="true"]');
      frames.push({
        t: performance.now() - started,
        scrollY: window.scrollY + (document.scrollingElement ? document.scrollingElement.scrollTop : 0),
        demo: stage ? stage.getAttribute("data-intro-demo") : null,
        slot: slotBox,
        still: stillBox,
        stillVisible: still ? getComputedStyle(still.parentElement).visibility === "visible" : false,
        puzzleStage: puzzleStage ? puzzleStage.children.length : -1,
        boxes,
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

interface Box { x: number; y: number; w: number; h: number }
interface Frame {
  t: number;
  scrollY: number;
  demo: string | null;
  slot: Box | null;
  still: Box | null;
  stillVisible: boolean;
  puzzleStage: number;
  boxes: Record<string, Box>;
}

const far = (a: Box, b: Box) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
const inside = (a: Box, b: Box) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
const fmt = (b: Box) => `(${b.x.toFixed(1)}, ${b.y.toFixed(1)}) ${b.w.toFixed(1)}×${b.h.toFixed(1)}`;

/** The harness's state for one run, carried across navigations in window.name. */
function harnessFor(type: PuzzleType, withDemo: boolean) {
  return {
    puzzles: { [type]: practicePuzzle(type) },
    verdict: { isCorrect: true, score: 150 },
    latencyMs: 50,
    submissions: [],
    verdictAt: null,
    room: null,
    search: { game: type },
    demos: withDemo ? { [type]: demoRow(type) } : {},
    demoDelayMs: DEMO_DELAY_MS,
  };
}

async function newPage(browser: Browser): Promise<{ page: Page; errors: string[]; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width: IPHONE11_APP.w, height: IPHONE11_APP.h }, hasTouch: true });
  await context.addInitScript(DEVICE_INIT);
  await context.addInitScript(
    ({ onboarding, screenH }) => {
      // The home-screen app from the first frame: navigator.standalone, the screen behind the short layout viewport.
      (window as unknown as { __device: unknown }).__device = { standalone: true, w: 414, h: screenH };
      try {
        localStorage.setItem(onboarding, "1");
      } catch {
        /* ignore */
      }
      try {
        (window as unknown as { __harness: unknown }).__harness = JSON.parse(window.name);
      } catch {
        (window as unknown as { __harness: unknown }).__harness = { puzzles: {}, verdict: { isCorrect: true, score: 0 }, latencyMs: 0, submissions: [], verdictAt: null, room: null };
      }
    },
    { onboarding: ONBOARDING_KEY, screenH: IPHONE11_APP.screenH },
  );
  await context.addInitScript(RECORDER);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]!));
  page.on("console", (m) => {
    if (m.type() === "error" && /\[intro demo\]/.test(m.text())) errors.push(m.text().split("\n")[0]!);
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: { top: IPHONE11_APP.top, bottom: IPHONE11_APP.bottom, left: 0, right: 0 } } as never);
  await cdp.send("Emulation.setEmulatedMedia" as never, { features: [{ name: "display-mode", value: "standalone" }] } as never).catch(() => {});
  return { page, errors, close: () => context.close() };
}

async function runIntro(page: Page, origin: string, type: PuzzleType, withDemo: boolean): Promise<Frame[]> {
  await page.evaluate((h) => {
    window.name = h;
  }, JSON.stringify(harnessFor(type, withDemo)));
  await page.goto(`${origin}/safe-area.html?mode=practice`, { timeout: 120_000 });
  await page.waitForSelector(".round-intro", { timeout: 60_000 });
  const done = await page
    .waitForFunction(
      ({ withDemo, after, plain }) => {
        const f = (window as unknown as { __introFrames?: { t: number; demo: string | null }[] }).__introFrames;
        if (!f || !f.length) return false;
        if (!withDemo) return f[f.length - 1]!.t - f[0]!.t >= plain;
        const playing = f.find((x) => x.demo === "playing");
        return Boolean(playing && f[f.length - 1]!.t - playing.t >= after);
      },
      { withDemo, after: AFTER_PLAYING_MS, plain: NO_DEMO_MS },
      { timeout: 20_000, polling: 100 },
    )
    .then(() => true)
    .catch(() => false);
  const frames = await page.evaluate(() => (window as unknown as { __introFrames: Frame[] }).__introFrames);
  if (!done && withDemo) (frames as Frame[] & { timedOut?: boolean }).timedOut = true;
  return frames;
}

function judge(type: PuzzleType, frames: Frame[], withDemo: boolean): string[] {
  const problems: string[] = [];
  if (frames.length < 3) return [`only ${frames.length} frame(s) recorded`];
  const last = frames[frames.length - 1]!;
  for (const key of ["title", "goal", "how", "stage", "score", "time", "ready"]) {
    const end = last.boxes[key];
    if (!end) {
      problems.push(`no ${key} on the intro`);
      continue;
    }
    for (const f of frames) {
      const b = f.boxes[key];
      if (!b) {
        problems.push(`${key} missing at ${Math.round(f.t - frames[0]!.t)} ms`);
        break;
      }
      if (far(b, end) > TOLERANCE_PX) {
        problems.push(`${key} at ${fmt(b)} at ${Math.round(f.t - frames[0]!.t)} ms (${f.demo}), ends at ${fmt(end)}`);
        break;
      }
    }
  }
  const stage = last.boxes["stage"];
  const ready = last.boxes["ready"];
  if (stage && stage.h < MIN_BOX_PX - 0.5) problems.push(`demo box ${stage.h.toFixed(1)} px tall (under ${MIN_BOX_PX})`);
  if (stage && ready && overlaps(stage, ready)) problems.push("demo box overlaps READY");
  const scrolled = frames.find((f) => f.scrollY !== 0);
  if (scrolled) problems.push(`page scrolled ${scrolled.scrollY} px`);
  // The still shows from the first frame until the demo plays (and for good without one), inside the box.
  const beforeDemo = frames.filter((f) => f.demo !== "playing");
  if (!beforeDemo.length) problems.push("the demo was playing on the first frame (no still first)");
  for (const f of beforeDemo) {
    if (!f.still || !f.stillVisible || f.still.w < 8 || f.still.h < 8) {
      problems.push(`no still in the box at ${Math.round(f.t - frames[0]!.t)} ms`);
      break;
    }
    if (stage && !inside(f.still, stage)) {
      problems.push(`still ${fmt(f.still)} outside the box ${fmt(stage)}`);
      break;
    }
  }
  if (withDemo) {
    if ((frames as Frame[] & { timedOut?: boolean }).timedOut || last.demo !== "playing") problems.push(`the demo never played (box state ${last.demo})`);
    else {
      if (!last.slot || last.slot.w < 8 || last.slot.h < 8) problems.push("the demo has no size");
      else if (stage && !inside(last.slot, stage)) problems.push(`demo ${fmt(last.slot)} outside the box ${fmt(stage)}`);
      else if (stage && Math.abs(last.slot.w - stage.w) > 0.5 && Math.abs(last.slot.h - stage.h) > 0.5) problems.push("the demo is not as large as the box allows");
      if (last.stillVisible) problems.push("the still stays visible under the playing demo");
      if (!engine(type) && last.puzzleStage <= 0) problems.push("the puzzle demo's stage never mounted");
    }
  } else if (frames.some((f) => f.demo !== "none")) problems.push("a demo box state other than none without a demo");
  return problems;
}

const failures: string[] = [];
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-demo-intro", buildId: "demo-intro-check" });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  await warmUp(browser, `${server.origin}/safe-area.html?mode=home`, (p) => p.waitForSelector("#root *", { timeout: 120_000 }), {
    init: () => {
      (window as unknown as { __harness: unknown }).__harness = { puzzles: {}, verdict: { isCorrect: true, score: 0 }, latencyMs: 0, submissions: [], verdictAt: null, room: null };
    },
    verbose: VERBOSE,
  });
  const withDemo = await newPage(browser);
  const without = await newPage(browser);
  // Insets and the standalone page apply from the next navigation's first frame.
  await Promise.all([withDemo.page.goto(`${server.origin}/safe-area.html?mode=home`), without.page.goto(`${server.origin}/safe-area.html?mode=home`)]);
  for (const type of games) {
    const where = `${gameDisplayName(type)} (${type})`;
    const fails: string[] = [];
    try {
      const [a, b] = await Promise.all([runIntro(withDemo.page, server.origin, type, true), runIntro(without.page, server.origin, type, false)]);
      for (const p of judge(type, a, true)) fails.push(`with a demo: ${p}`);
      for (const p of judge(type, b, false)) fails.push(`without a demo: ${p}`);
      const sa = a[a.length - 1]?.boxes["stage"];
      const sb = b[b.length - 1]?.boxes["stage"];
      if (sa && sb && far(sa, sb) > TOLERANCE_PX) fails.push(`the demo box differs with and without a demo: ${fmt(sa)} vs ${fmt(sb)}`);
      for (const key of ["title", "goal", "how", "score", "ready"]) {
        const x = a[a.length - 1]?.boxes[key];
        const y = b[b.length - 1]?.boxes[key];
        if (x && y && far(x, y) > TOLERANCE_PX) fails.push(`${key} differs with and without a demo: ${fmt(x)} vs ${fmt(y)}`);
      }
      for (const e of [...new Set([...withDemo.errors, ...without.errors])]) fails.push(`page error: ${e}`);
      if (SHOTS) {
        await withDemo.page.screenshot({ path: `${SHOTS}/intro-${type}-demo-414x896.png` });
        await without.page.screenshot({ path: `${SHOTS}/intro-${type}-still-414x896.png` });
      }
      if (VERBOSE) {
        const st = a[a.length - 1]?.boxes["stage"];
        const playing = a.find((f) => f.demo === "playing");
        console.log(`  ${type}: box ${st ? fmt(st) : "-"}, demo playing at ${playing ? Math.round(playing.t - a[0]!.t) : "-"} ms`);
      }
    } catch (error) {
      fails.push(String((error as Error).message ?? error).split("\n")[0]!);
    }
    withDemo.errors.length = 0;
    without.errors.length = 0;
    for (const f of fails) failures.push(`${where}: ${f}`);
    console.log(`${fails.length ? "FAIL" : "PASS"} ${where}${fails.length ? `: ${fails[0]}` : ""}`);
  }
  await withDemo.close();
  await without.close();
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.log(`FAIL: ${failures.length} problem(s) in ${games.length} intros`);
  for (const f of failures.slice(0, 60)) console.log(`  ${f}`);
  process.exit(1);
}
console.log(
  `PASS: ${games.length} intros keep one layout from the first frame to the demo playing (zero shift), with and without a demo, the still first and the demo inside its box`,
);
