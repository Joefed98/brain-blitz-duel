/**
 * Screenshot tool: contact-sheet frames and layout measurements for any game at any
 * viewport. A design tool, not a check (CI never runs it). One tool for every polish
 * wave; it replaces the per-category copies (#44 Pattern, #45 Word, #47 Logic, #49 Number).
 *
 *   bun scripts/shots/capture.ts [games…] [--category=<id>] [--all] [--sizes=375x667,390x844]
 *       [--url=<origin>] [--out=<dir>] [--tag=after] [--phases=intro,play,solve,reveal]
 *       [--dpr=1] [--hold=2000] [--reduced-motion]
 *   bun scripts/shots/sheets.ts --in=<dir> --out=<dir>      (before/after contact sheets)
 *
 * Method (the October snapshots, #9): Playwright drives the pre-installed Chromium
 * (PLAYWRIGHT_CHROMIUM, default /opt/pw-browsers/chromium) against a `vite dev` server
 * (--url, or the tool starts its own on port 5190). Every game opens from /practice with
 * the generate request switched to the fixed intro example and `Math.random` seeded, so
 * two runs (say main in a worktree and a branch) show the same puzzle. Supabase is
 * unreachable from a cloud container, so intro demos show the static example and
 * Gridlock uses the built-in bank.
 *
 * Phases (frames are <out>/<game>-<w>x<h>-<phase>-<tag>.png):
 *   intro    the RoundIntro 2.5 s after it opens;
 *   play     mid-play: the driver's seed and partial inputs (none without a driver);
 *   solve    the driver solves the example; frames solve1… at its solveShotsMs after the
 *            solving input (the practice grade request is held --hold ms so the stage
 *            stays up). Without a solve, one `fx` frame: the driver's fx, or the dev
 *            preview hooks (window.__duelzFxPreview.<game>(), the duelz-dev-word-finish
 *            event) on the board as it stands;
 *   reveal   the AnswerReveal 1.5 s after the score lands: the solved round, or a run
 *            whose clock is fast-forwarded to time-up;
 *   timeout  a half-played run that times out (partial inputs, then time-up);
 *   full     the driver's full answer swapped into the grade request (a reveal at its fullest).
 *
 * Measurements go to <out>/report-<tag>.json: the painted play area's gaps to the game
 * region's top and the first control below (at the start and at mid-play), the driver
 * board's gaps when it names one, each reveal's scrolling, smallest text and lowest text
 * contrast, the named sound cues fired, and page errors.
 *
 * Drivers live in scripts/shots/drivers/ (registered in drivers/index.ts; see driver.ts).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Browser, Page } from "playwright";

import { GAME_DISPLAY_NAMES, gameDisplayName } from "../../src/lib/duel/gameNames";
import type { PuzzleType } from "../../src/lib/duel/types";
import type { Driver, DriverCtx, FullPuzzle } from "./driver";
import { DRIVERS } from "./drivers";
import { exampleFor } from "./examples";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name: string) => args.includes(`--${name}`);
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 5190;
const OUT = opt("out") ?? "/tmp/duelz-shots";
const TAG = opt("tag") ?? "after";
const DPR = Number(opt("dpr") ?? 1);
const HOLD_MS = Number(opt("hold") ?? 2000);
const PHASES = new Set((opt("phases") ?? "intro,play,solve,reveal").split(","));
const SIZES = (opt("sizes") ?? "375x667,390x844").split(",").map((s) => {
  const [w, h] = s.split("x").map(Number);
  if (!w || !h) throw new Error(`bad size ${s} (want WxH)`);
  return [w, h] as const;
});

async function pickGames(): Promise<PuzzleType[]> {
  const named = args.filter((a) => !a.startsWith("--"));
  for (const g of named) if (!(g in GAME_DISPLAY_NAMES)) throw new Error(`unknown game id ${g}`);
  const category = opt("category");
  if (!category && !flag("all")) {
    if (!named.length) throw new Error("name games, --category=<id> or --all");
    return named as PuzzleType[];
  }
  const { ACTIVE_PUZZLE_TYPES, puzzleDef } = await import("../../src/lib/duel/registry");
  const pool = ACTIVE_PUZZLE_TYPES.filter((t) => !category || puzzleDef(t).category === category);
  return [...new Set([...(named as PuzzleType[]), ...pool])];
}

/* ------------------------------------------------------------ in-page code */

const SEED_RANDOM = `(() => {
  let s = 20261013 >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { localStorage.setItem("duelz-arrow-control", "arrows"); } catch { /* ignore */ }
})();`;

/** Painted bounds of the play area (everything in the stage but its controls) and its gaps. */
function measurePlay() {
  const region = document.querySelector("[data-game-region]");
  const stage = region?.querySelector("[data-game-stage]");
  if (!region || !stage) return null;
  const r = region.getBoundingClientRect();
  const controls = Array.from(stage.querySelectorAll("[data-game-controls]"));
  const isControl = (el: Element) => controls.some((c) => c === el || c.contains(el));
  const shapes = new Set([
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "text",
    "image",
    "use",
    "CANVAS",
    "IMG",
  ]);
  const visible = (el: Element) => {
    for (let n: Element | null = el; n && n !== stage; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0)
        return false;
    }
    return true;
  };
  let top = Infinity,
    bottom = -Infinity,
    left = Infinity,
    right = -Infinity;
  for (const el of Array.from(stage.querySelectorAll("*"))) {
    if (isControl(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed") continue;
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1) continue;
    const bgOn =
      (cs.backgroundColor &&
        !/rgba\(.*,\s*0\)$/.test(cs.backgroundColor) &&
        cs.backgroundColor !== "transparent") ||
      cs.backgroundImage !== "none";
    const border = parseFloat(cs.borderTopWidth) > 0 && !/rgba\(.*,\s*0\)$/.test(cs.borderTopColor);
    const leafText = el.children.length === 0 && (el.textContent || "").trim().length > 0;
    if (!(bgOn || border || leafText || shapes.has(el.tagName))) continue;
    if (!visible(el)) continue;
    top = Math.min(top, b.top);
    bottom = Math.max(bottom, b.bottom);
    left = Math.min(left, b.left);
    right = Math.max(right, b.right);
  }
  const boxes = controls.map((c) => c.getBoundingClientRect()).filter((c) => c.height > 0);
  const below = boxes.filter((c) => c.top >= bottom - 2).sort((a, b) => a.top - b.top)[0];
  return {
    play: { top, bottom, left, right, width: right - left, height: bottom - top },
    above: Math.round(top - r.top),
    below: Math.round((below ? below.top : r.bottom) - bottom),
    belowTo: below ? "controls" : "region bottom",
    controlsClear: boxes.every((c) => c.bottom <= r.bottom + 0.5),
  };
}

/** Gap from a named board to the nearest thing above it and the first thing below it in the stage column. */
function measureBoard(selector: string) {
  const region = document.querySelector("[data-game-region]");
  const stage = document.querySelector("[data-game-stage]");
  const board = stage?.querySelector(selector) ?? null;
  if (!board || !region || !stage) return null;
  const regionBox = region.getBoundingClientRect();
  const b = board.getBoundingClientRect();
  let top = regionBox.top,
    bottom = regionBox.bottom,
    aboveFrom = "region top",
    belowTo = "region bottom";
  for (let node: Element | null = board; node && node !== stage; node = node.parentElement) {
    const parent = node.parentElement;
    if (!parent) break;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node) continue;
      const r = sibling.getBoundingClientRect();
      if (r.height < 1 || r.width < 1) continue;
      const style = getComputedStyle(sibling);
      if (
        style.position === "absolute" ||
        style.position === "fixed" ||
        style.visibility === "hidden"
      )
        continue;
      const label =
        sibling.getAttribute("data-game-controls") ?? sibling.className.toString().slice(0, 40);
      if (r.bottom <= b.top + 0.5 && r.bottom > top) {
        top = r.bottom;
        aboveFrom = label;
      }
      if (r.top >= b.bottom - 0.5 && r.top < bottom) {
        bottom = r.top;
        belowTo = label;
      }
    }
  }
  return {
    width: Math.round(b.width),
    height: Math.round(b.height),
    above: Math.round(b.top - top),
    below: Math.round(bottom - b.bottom),
    aboveFrom,
    belowTo,
  };
}

/** Reveal legibility: what scrolls, the smallest text, and the lowest text contrast against its painted background. */
function measureReveal() {
  const root =
    document.querySelector(".answer-reveal-content") ??
    document.querySelector("[data-arcade-reveal]") ??
    document.body;
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  // Any CSS colour (oklch, color-mix…) to sRGB + alpha through a 1 px canvas.
  const parse = (c: string) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r!, g!, b!, a! / 255];
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
  };
  // A gradient's stops (the worst counts) or the first opaque colour up the tree.
  const bgOf = (el: Element | null): number[][] => {
    for (let n = el; n; n = n.parentElement) {
      const style = getComputedStyle(n);
      const stops = style.backgroundImage.match(/(?:rgba?|oklab|oklch|lab|lch|color)\([^()]*\)/g);
      if (stops?.length) return stops.map(parse);
      const c = parse(style.backgroundColor);
      if ((c[3] ?? 0) > 0.5) return [c];
    }
    return [[10, 10, 15, 1]];
  };
  let minFont = Infinity,
    minContrast = Infinity,
    worst = "";
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== ""))
      continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || el.getBoundingClientRect().height === 0) continue;
    minFont = Math.min(minFont, parseFloat(style.fontSize));
    if (el.closest("svg")) continue;
    const fg = parse(style.color);
    if ((fg[3] ?? 0) < 0.05) continue;
    const a = lum(fg);
    const ratio = Math.min(
      ...bgOf(el).map((bg) => {
        const b = lum(bg);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }),
    );
    if (ratio < minContrast) {
      minContrast = ratio;
      worst = (el.textContent ?? "").trim().slice(0, 24);
    }
  }
  const scrolls = [document.scrollingElement, ...Array.from(document.querySelectorAll("*"))]
    .filter(
      (el): el is Element =>
        !!el &&
        (el === document.scrollingElement ||
          /(auto|scroll)/.test(getComputedStyle(el).overflowY)) &&
        el.scrollHeight > el.clientHeight + 1,
    )
    .map((el) => String((el as HTMLElement).className || el.tagName).slice(0, 60));
  return {
    fits: scrolls.length === 0,
    scrolls,
    overflow: Math.max(0, root.scrollHeight - root.clientHeight),
    minFont: Number.isFinite(minFont) ? minFont : null,
    minContrast: Number.isFinite(minContrast) ? Math.round(minContrast * 100) / 100 : null,
    worst,
  };
}

/* ------------------------------------------------------------- the runs */

/** Server-function name from a TanStack Start request URL. */
function serverFnName(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
  } catch {
    return id;
  }
}

interface Run {
  page: Page;
  close: () => Promise<void>;
  cues: string[];
  errors: string[];
  holdGrade: boolean;
}

async function newRun(
  browser: Browser,
  origin: string,
  game: PuzzleType,
  size: readonly [number, number],
  opts: { clock?: boolean; answer?: string | null; seed?: Record<string, unknown> },
): Promise<Run> {
  const context = await browser.newContext({
    viewport: { width: size[0], height: size[1] },
    deviceScaleFactor: DPR,
    reducedMotion: flag("reduced-motion") ? "reduce" : "no-preference",
  });
  await context.addInitScript(SEED_RANDOM);
  const page = await context.newPage();
  const run: Run = { page, close: () => context.close(), cues: [], errors: [], holdGrade: false };
  page.on("pageerror", (e) => run.errors.push(String(e.message ?? e).split("\n")[0]!));
  await page.exposeFunction("__shotCue", (cue: string) => run.cues.push(cue));
  await page.addInitScript(
    `window.addEventListener("duelz-sound", (e) => window.__shotCue && window.__shotCue(e.detail && e.detail.cue));`,
  );
  if (opts.clock) await page.clock.install();
  await page.route("**/_serverFn/**", async (route) => {
    const request = route.request();
    const name = serverFnName(request.url());
    const body = request.postData() ?? "";
    if (/practiceGenerate/.test(name)) {
      // Seroval: {"t":2,"s":3} is false, {"t":2,"s":2} is true.
      return route.continue({
        postData: body.replace(
          /("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/,
          '$1{"t":2,"s":2}',
        ),
      });
    }
    if (/practiceGrade/.test(name)) {
      if (opts.answer != null && body.includes('"answer"')) {
        // Seroval body: data's keys and values sit side by side; swap the answer string.
        const parsed = JSON.parse(body) as {
          t: { p: { v: { p: { k: string[]; v: unknown[] } }[] } };
        };
        const inner = parsed.t.p.v[0]!.p;
        const at = inner.k.indexOf("answer");
        if (at >= 0) inner.v[at] = { t: 1, s: opts.answer };
        return route.continue({ postData: JSON.stringify(parsed) });
      }
      if (run.holdGrade) await new Promise((done) => setTimeout(done, HOLD_MS));
    }
    return route.continue();
  });
  await page.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
  await button.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500); // hydration
  if (opts.seed) {
    await page.evaluate(async (values) => {
      const seed = (await import(/* @vite-ignore */ "/scripts/shots/seed.tsx")) as {
        seedStageState: (k: string[], v: Record<string, unknown>) => void;
      };
      seed.seedStageState(["practice-1", "practice-2", "practice-3"], values);
    }, opts.seed);
  }
  await button.click();
  await page
    .getByRole("button", { name: /^Ready/ })
    .first()
    .waitFor({ timeout: 90_000 });
  return run;
}

async function ready(run: Run) {
  await run.page
    .getByRole("button", { name: /^Ready/ })
    .first()
    .click();
  await run.page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  await run.page.waitForTimeout(1200);
}

const REVEAL = "[data-reveal-score], [data-arcade-reveal]";

/** Time runs out: jump the page clock past the round, stepping it for games whose loop needs frames. */
async function timeUp(page: Page) {
  await page.clock.fastForward(200_000);
  for (let i = 0; i < 400 && !(await page.locator(REVEAL).count()); i++)
    await page.clock.runFor(500);
  await page.locator(REVEAL).first().waitFor({ timeout: 60_000 });
  await page.clock.runFor(1500);
  await page.waitForTimeout(600);
}

async function startServer(): Promise<{ origin: string; proc: ChildProcess | null }> {
  const url = opt("url");
  if (url) return { origin: url.replace(/\/$/, ""), proc: null };
  const proc = spawn(
    "npx",
    ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"],
    { stdio: "ignore", detached: true },
  );
  const origin = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${origin}/practice`)).ok) return { origin, proc };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

async function captureOne(
  browser: Browser,
  origin: string,
  game: PuzzleType,
  size: readonly [number, number],
  driver: Driver | undefined,
  full: FullPuzzle,
) {
  const [w, h] = size;
  const file = (phase: string) => join(OUT, `${game}-${w}x${h}-${phase}-${TAG}.png`);
  const entry: Record<string, unknown> = {
    driver: Boolean(driver),
    solves: Boolean(driver?.solve),
  };
  const ctx = (page: Page): DriverCtx => ({
    page,
    puzzle: full,
    wait: (ms) => page.waitForTimeout(ms),
  });
  const wantPlay = PHASES.has("intro") || PHASES.has("play") || PHASES.has("solve");
  const errors: string[] = [];

  if (wantPlay || (PHASES.has("reveal") && driver?.solve)) {
    let run = await newRun(browser, origin, game, size, { seed: driver?.seedMid?.(full) });
    try {
      await run.page.waitForTimeout(2500);
      if (PHASES.has("intro")) await run.page.screenshot({ path: file("intro") });
      await ready(run);
      entry["gapsStart"] = await run.page.evaluate(measurePlay);
      if (driver?.partial) await driver.partial(ctx(run.page));
      await run.page.waitForTimeout(500);
      entry["gapsPlay"] = await run.page.evaluate(measurePlay);
      if (driver?.board) entry["board"] = await run.page.evaluate(measureBoard, driver.board);
      if (PHASES.has("play")) await run.page.screenshot({ path: file("play") });

      if (driver?.solve && (PHASES.has("solve") || PHASES.has("reveal"))) {
        if (driver.seedNearSolved || driver.solveFromStart) {
          errors.push(...run.errors);
          await run.close();
          run = await newRun(browser, origin, game, size, { seed: driver.seedNearSolved?.(full) });
          await ready(run);
        }
        run.holdGrade = true;
        run.cues.length = 0;
        await driver.solve(ctx(run.page));
        const t0 = Date.now();
        for (const [i, at] of (driver.solveShotsMs ?? [150, 500, 900]).entries()) {
          await run.page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
          if (PHASES.has("solve")) await run.page.screenshot({ path: file(`solve${i + 1}`) });
        }
        await run.page.locator(REVEAL).first().waitFor({ timeout: 150_000 });
        await run.page.waitForTimeout(1500);
        entry["cuesAfterSolve"] = [...new Set(run.cues)];
        entry["reveal"] = await run.page.evaluate(measureReveal);
        entry["score"] = await run.page
          .locator("[data-reveal-score]")
          .first()
          .getAttribute("data-reveal-score")
          .catch(() => null);
        if (PHASES.has("reveal")) await run.page.screenshot({ path: file("reveal") });
      } else if (PHASES.has("solve")) {
        // No scripted solve: the completion effect on the board as it stands.
        if (driver?.fx) await driver.fx(ctx(run.page));
        else
          await run.page.evaluate((id) => {
            const preview = (window as unknown as { __duelzFxPreview?: Record<string, () => void> })
              .__duelzFxPreview?.[id];
            if (preview) preview();
            else window.dispatchEvent(new CustomEvent("duelz-dev-word-finish"));
          }, game);
        await run.page.waitForTimeout(350);
        await run.page.screenshot({ path: file("fx") });
      }
      entry["cues"] = [...new Set(run.cues)];
    } finally {
      errors.push(...run.errors);
      await run.close();
    }
  }

  const clockRun = async (
    phase: "reveal" | "timeout" | "full",
    key: string,
    partial: boolean,
    answer: string | null,
  ) => {
    const run = await newRun(browser, origin, game, size, {
      clock: true,
      answer,
      seed: partial ? driver?.seedMid?.(full) : undefined,
    });
    try {
      await ready(run);
      if (partial && driver?.partial) await driver.partial(ctx(run.page));
      await timeUp(run.page);
      entry[key] = await run.page.evaluate(measureReveal);
      await run.page.screenshot({ path: file(phase) });
    } finally {
      errors.push(...run.errors);
      await run.close();
    }
  };
  if (PHASES.has("reveal") && !driver?.solve) await clockRun("reveal", "reveal", false, null);
  if (PHASES.has("timeout")) await clockRun("timeout", "revealTimeout", true, null);
  if (PHASES.has("full") && driver?.answer)
    await clockRun("full", "revealFull", false, driver.answer(full));
  if (errors.length) entry["pageErrors"] = [...new Set(errors)].slice(0, 5);
  return entry;
}

async function main() {
  if (!existsSync(CHROMIUM)) {
    console.log(`environment: no Chromium at ${CHROMIUM} (set PLAYWRIGHT_CHROMIUM)`);
    process.exit(1);
  }
  const games = await pickGames();
  mkdirSync(OUT, { recursive: true });
  const { origin, proc } = await startServer();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const report: Record<string, unknown> = {};
  try {
    for (const game of games) {
      const driver = DRIVERS[game];
      const full = exampleFor(game);
      for (const size of SIZES) {
        const key = `${game}@${size[0]}x${size[1]}`;
        try {
          report[key] = await captureOne(browser, origin, game, size, driver, full);
        } catch (error) {
          report[key] = { error: String((error as Error).message ?? error).split("\n")[0] };
        }
        const e = report[key] as {
          error?: string;
          gapsPlay?: { above: number; below: number };
          board?: { above: number; below: number };
        };
        const gaps = e.board ?? e.gapsPlay;
        console.log(
          `${TAG} ${key}: ${e.error ? `ERROR ${e.error}` : gaps ? `gaps ${gaps.above}/${gaps.below}` : "done"}`,
        );
      }
    }
  } finally {
    await browser.close();
    if (proc?.pid) process.kill(-proc.pid);
  }
  writeFileSync(join(OUT, `report-${TAG}.json`), JSON.stringify(report, null, 1));
  console.log(`frames and report-${TAG}.json in ${OUT}`);
}

await main();
