/**
 * Records the seven Logic overhaul 2 intro demos (15 Nov 2026) into scripts/fixtures/logic-demos.json: each game's fixed
 * intro example, dealt on today's stamps, solved by a scripted player.
 *
 * A solve is a plan of touches on named targets (a cell, a number on the pad, a point on the board's SVG). The plan is
 * played twice in Chromium at 390 × 844:
 *   1. through the real practice screen, where the server grades it: the answer the stage sent, its clock and the score
 *      shown are kept, so logic-demos-check can prove the run scores exactly what the server's grading says;
 *   2. in the intro's own demo player (PuzzleDemo.tsx, through the safe-area harness), where each target's position is
 *      measured on the demo's stage. The intro lays its board out in its own box (the play screen's phone layout puts
 *      the board at the bottom, the demo player does not), so positions taken from the play screen would miss. The
 *      log is then played back there and must solve the board, or nothing is written.
 * Nothing is saved to the live database: the manual "Save intro demos" workflow does that after the final merge.
 *
 *   bun scripts/logic-demos-record.ts [games…] [--url=<practice dev server origin>]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { chromium, type Browser, type Page } from "playwright";

import { puzzlePresentation } from "../src/components/puzzles/wordInput";
import { bridgePairs } from "../src/lib/duel/bridges";
import { edgeDots } from "../src/lib/duel/fences";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { GAME_COLUMN_LAYOUT, INTRO_EXAMPLE_ID, type DemoAction, type PuzzleDemoLog } from "../src/lib/duel/puzzleDemo";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleType } from "../src/lib/duel/types";
import { ONBOARDING_KEY } from "../src/lib/onboarding";
import { LOGIC_DEMO_GAMES, LOGIC_DEMOS_FILE } from "./logic-demos-lib";
import { practiceGameUrl } from "./practice-side-lib";
import { startSafeAreaServer } from "./safe-area-server";
import { exampleFor } from "./shots/examples";

const SIZE = { width: 390, height: 844 };
const START_MS = 700;
const TAP_GAP_MS = 380;
const DRAG_MS = 320;
const PORT = 5391;
const CHROMIUM = existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const only = args.filter((a) => !a.startsWith("--"));
const GAMES = (only.length ? only : LOGIC_DEMO_GAMES) as PuzzleType[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Full = any;
type Pt = { x: number; y: number };

/**
 * A point on an element inside the stage: the nth match of `sel`, then a fraction of its box (`at`), a cell of a grid
 * drawn in it (`grid`) or a point in an SVG's viewBox drawn centred and uniformly scaled in it (`svg`).
 */
type Target = {
  sel: string;
  nth?: number;
  at?: [number, number];
  grid?: { cols: number; rows: number; gap?: number; cell: number };
  svg?: { w: number; h: number; x: number; y: number };
};
type Step = { kind: "tap"; a: Target } | { kind: "drag"; a: Target; b: Target };

/** A person's solve of the intro example as a plan of touches. */
function plan(type: PuzzleType, p: Full): Step[] {
  const tap = (a: Target): Step => ({ kind: "tap", a });
  switch (type) {
    case "tents":
      // Buttons follow the cell order (trees are disabled buttons in place).
      return (p.solution as number[]).map((cell) => tap({ sel: "[data-game-arena] button", nth: cell }));
    case "shikaku": {
      const size = p.size as number;
      const rows = (p.height as number | undefined) ?? size;
      const cell = (n: number): Target => ({ sel: ".shikaku-board", grid: { cols: size, rows, cell: n } });
      return (p.solution as { r0: number; c0: number; r1: number; c1: number }[]).map((r) => ({
        kind: "drag",
        a: cell(r.r0 * size + r.c0),
        b: cell(r.r1 * size + r.c1),
      }));
    }
    case "lightup": {
      const size = p.size as number;
      const rows = (p.height as number | undefined) ?? size;
      return (p.solution as number[]).map((cell) => tap({ sel: "[data-game-arena] > div", grid: { cols: size, rows, cell } }));
    }
    case "trail": {
      const solution: number[] = p.solution;
      return solution
        .slice(1)
        .filter((c) => p.givens[c] == null)
        .map((cell) => tap({ sel: "[data-game-arena]", grid: { cols: 6, rows: 6, gap: 4, cell } }));
    }
    case "fences": {
      const size = p.size as number;
      const vb = size * 100 + 44;
      const xy = (d: number) => [22 + (d % (size + 1)) * 100, 22 + Math.floor(d / (size + 1)) * 100] as const;
      return (p.solution as number[]).map((edge) => {
        const [a, b] = edgeDots(size, edge);
        const [ax, ay] = xy(a);
        const [bx, by] = xy(b);
        return tap({ sel: "[data-logic-stage='fences'] svg", svg: { w: vb, h: vb, x: (ax + bx) / 2, y: (ay + by) / 2 } });
      });
    }
    case "fillomino": {
      const blanks = (p.givens as number[]).flatMap((g, i) => (g ? [] : [i]));
      const byNumber = new Map<number, number[]>();
      for (const cell of blanks) byNumber.set(p.solution[cell], [...(byNumber.get(p.solution[cell]) ?? []), cell]);
      return [...byNumber]
        .sort((a, b) => a[0] - b[0])
        .flatMap(([n, cells]) => [
          tap({ sel: `[data-fillomino-tool="${n}"]` }),
          ...cells.map((cell) => tap({ sel: `[data-logic-stage='fillomino'] [data-cell="${cell}"]` })),
        ]);
    }
    case "bridges": {
      const size = p.size as number;
      const pairs = bridgePairs(p.islands, size);
      const at = (cell: number): Target => ({
        sel: "[data-logic-stage='bridges'] svg",
        svg: { w: size * 100, h: size * 100, x: (cell % size) * 100 + 50, y: Math.floor(cell / size) * 100 + 50 },
      });
      return (p.solution as number[]).flatMap((times, i) => {
        const pair = pairs[i]!;
        const a = at(p.islands[pair.a].cell);
        const b = at(p.islands[pair.b].cell);
        return Array.from({ length: times }, (): Step => ({ kind: "drag", a, b }));
      });
    }
    default:
      throw new Error(`no plan for ${type}`);
  }
}

/** Every target's point in client pixels, inside `root` (the play area or the demo's stage). */
async function resolve(page: Page, root: string, targets: Target[]): Promise<Pt[]> {
  return page.evaluate(
    ({ root, targets }) => {
      const base = document.querySelector(root);
      if (!base) throw new Error(`no ${root}`);
      return targets.map((t) => {
        const el = base.querySelectorAll(t.sel)[t.nth ?? 0];
        if (!el) throw new Error(`no ${t.sel} #${t.nth ?? 0}`);
        const r = el.getBoundingClientRect();
        if (t.grid) {
          // A transformed stage (the demo's) scales the gap with the board: measure it in the board's own units.
          const k = r.width / ((el as HTMLElement).offsetWidth || r.width);
          const gap = (t.grid.gap ?? 0) * k;
          const pitchX = (r.width + gap) / t.grid.cols;
          const pitchY = (r.height + gap) / t.grid.rows;
          const col = t.grid.cell % t.grid.cols;
          const row = Math.floor(t.grid.cell / t.grid.cols);
          return { x: r.left + col * pitchX + (pitchX - gap) / 2, y: r.top + row * pitchY + (pitchY - gap) / 2 };
        }
        if (t.svg) {
          const s = Math.min(r.width / t.svg.w, r.height / t.svg.h);
          return { x: r.left + (r.width - t.svg.w * s) / 2 + t.svg.x * s, y: r.top + (r.height - t.svg.h * s) / 2 + t.svg.y * s };
        }
        const [fx, fy] = t.at ?? [0.5, 0.5];
        return { x: r.left + fx * r.width, y: r.top + fy * r.height };
      });
    },
    { root, targets },
  );
}

const targetsOf = (steps: Step[]) => steps.flatMap((s) => (s.kind === "tap" ? [s.a] : [s.a, s.b]));

/** Plays the plan with real input on the practice screen, one touch at a time. */
async function playOnPage(page: Page, steps: Step[]) {
  for (const step of steps) {
    const [a, b] = await resolve(page, "[data-game-region]", step.kind === "tap" ? [step.a] : [step.a, step.b]);
    await page.mouse.move(a!.x, a!.y);
    await page.mouse.down();
    if (step.kind === "drag") {
      for (let i = 1; i <= 8; i++) {
        await page.mouse.move(a!.x + ((b!.x - a!.x) * i) / 8, a!.y + ((b!.y - a!.y) * i) / 8);
        await page.waitForTimeout(DRAG_MS / 8);
      }
    } else await page.waitForTimeout(60);
    await page.mouse.up();
    await page.waitForTimeout(TAP_GAP_MS);
  }
}

/** The demo log: the plan's touches at the demo stage's positions, on a steady rhythm. */
function demoLog(steps: Step[], points: Pt[], w: number, h: number): PuzzleDemoLog {
  const round3 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
  const norm = (p: Pt) => ({ x: round3(p.x), y: round3(p.y) });
  const actions: DemoAction[] = [];
  let t = START_MS;
  let i = 0;
  for (const step of steps) {
    if (step.kind === "tap") {
      actions.push({ t, action: "tap", args: { at: norm(points[i++]!) } });
      t += TAP_GAP_MS;
    } else {
      const from = norm(points[i++]!);
      const to = norm(points[i++]!);
      const path: [number, number, number][] = [1, 2, 3, 4, 5, 6, 7].map((k) => [
        round3(from.x + ((to.x - from.x) * k) / 8),
        round3(from.y + ((to.y - from.y) * k) / 8),
        Math.round((DRAG_MS * k) / 8),
      ]);
      actions.push({ t, action: "drag", args: { from, to, ms: DRAG_MS, path } });
      t += DRAG_MS + TAP_GAP_MS;
    }
  }
  return { actions, w, h, verdicts: [], layout: GAME_COLUMN_LAYOUT };
}

async function startServer(): Promise<{ origin: string; proc: ChildProcess | null }> {
  const url = opt("url");
  if (url) return { origin: url.replace(/\/$/, ""), proc: null };
  const proc = spawn("npx", ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], {
    stdio: "ignore",
    detached: true,
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" },
  });
  const origin = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 180; i++) {
    try {
      if ((await fetch(`${origin}/practice`)).ok) return { origin, proc };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

function serverFnName(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
  } catch {
    return id;
  }
}

/** Seroval writes strings with JavaScript escapes (quotes, backslashes, \n, \xHH, \uHHHH); this undoes them. */
function unescapeJs(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = text[++i]!;
    if (n === "x") {
      out += String.fromCharCode(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else if (n === "u") {
      out += String.fromCharCode(parseInt(text.slice(i + 1, i + 5), 16));
      i += 4;
    } else out += ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0" } as Record<string, string>)[n] ?? n;
  }
  return out;
}

/** The practice grade request's fields (seroval: keys beside values; strings t 1, numbers t 0). */
function gradeFields(body: string): { answer: string; msRemaining: number } {
  const parsed = JSON.parse(body) as { t: { p: { v: { p: { k: string[]; v: { t: number; s: unknown }[] } }[] } } };
  const inner = parsed.t.p.v[0]!.p;
  const value = (key: string) => inner.v[inner.k.indexOf(key)];
  const answer = value("answer");
  const ms = value("msRemaining");
  if (!answer || answer.t !== 1 || !ms || ms.t !== 0) throw new Error(`unexpected grade body: ${body.slice(0, 300)}`);
  return { answer: unescapeJs(String(answer.s)), msRemaining: Number(ms.s) };
}

/** Phase 1: the plan on the real practice screen, graded by the server. */
async function practiceRun(browser: Browser, origin: string, type: PuzzleType, steps: Step[]) {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e.message).split("\n")[0]!));
  let sent: { answer: string; msRemaining: number } | null = null;
  await page.route("**/_serverFn/**", async (route) => {
    const request = route.request();
    const name = serverFnName(request.url());
    const body = request.postData() ?? "";
    if (/practiceGenerate/.test(name))
      return route.continue({ postData: body.replace(/("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/, '$1{"t":2,"s":2}') });
    if (/practiceGrade/.test(name) && body.includes('"answer"')) {
      try {
        sent = gradeFields(body);
      } catch (error) {
        errors.push(String(error));
      }
    }
    return route.continue();
  });
  try {
    await page.goto(practiceGameUrl(origin, type), { waitUntil: "domcontentloaded" });
    const ready = page.getByRole("button", { name: /^Ready/ }).first();
    await ready.waitFor({ timeout: 120_000 });
    await page.waitForTimeout(1500);
    await ready.click();
    await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(900);
    const region = await page.locator("[data-game-region]").first().boundingBox();
    if (!region) throw new Error(`${type}: no play area`);
    await playOnPage(page, steps);
    const SCORE = '[data-reveal-score]:not([data-reveal-score="pending"])';
    await page.locator(SCORE).first().waitFor({ timeout: 30_000 });
    const score = Number(await page.locator(SCORE).first().getAttribute("data-reveal-score"));
    if (!sent) throw new Error(`${type}: no grade request seen`);
    if (!Number.isFinite(score)) throw new Error(`${type}: no score on the reveal`);
    if (errors.length) throw new Error(`${type}: page errors: ${errors.join("; ")}`);
    const graded = sent as { answer: string; msRemaining: number };
    return { ...graded, score, w: Math.round(region.width), h: Math.round(region.height) };
  } catch (error) {
    await page.screenshot({ path: `/tmp/logic-demo-${type}-fail.png` }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

const DEMO_STAGE = '.intro-demo > div[aria-hidden="true"]';
const SOLVED: Record<string, string> = { trail: ".tr-lit" };
const EMPTY_HARNESS = { puzzles: {}, verdict: { isCorrect: true, score: 0 }, latencyMs: 0, submissions: [], verdictAt: null, room: null };

/** Opens the intro (safe-area harness, the real practice route) with `demo` as the game's saved demo. */
async function openIntro(browser: Browser, origin: string, type: PuzzleType, demo: unknown) {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1 });
  await context.addInitScript(
    ({ k, empty }) => {
      try {
        localStorage.setItem(k, "1");
      } catch {
        /* ignore */
      }
      try {
        (window as unknown as { __harness: unknown }).__harness = JSON.parse(window.name);
      } catch {
        (window as unknown as { __harness: unknown }).__harness = empty;
      }
    },
    { k: ONBOARDING_KEY, empty: EMPTY_HARNESS },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e.message).split("\n")[0]!));
  const harness = {
    ...EMPTY_HARNESS,
    puzzles: { [type]: splitPuzzle(withSeededRandom(41, () => generatePuzzle(type))).pub },
    verdict: { isCorrect: true, score: 150 },
    latencyMs: 50,
    search: { game: type },
    demos: { [type]: demo },
    demoDelayMs: 0,
  };
  await page.goto(`${origin}/safe-area.html?mode=home`, { timeout: 120_000 });
  await page.evaluate((h) => {
    window.name = h;
  }, JSON.stringify(harness));
  await page.goto(`${origin}/safe-area.html?mode=practice`, { timeout: 120_000 });
  await page.waitForSelector('[data-intro-stage][data-intro-demo="playing"]', { timeout: 60_000 });
  await page.waitForSelector(`${DEMO_STAGE} [data-game-arena]`, { timeout: 30_000 });
  return { page, errors, close: () => context.close() };
}

/** Phase 2: each target's place on the demo stage, then the log played back to a solved board. */
async function demoRun(browser: Browser, origin: string, type: PuzzleType, puzzle: unknown, steps: Step[], w: number, h: number) {
  const row = (log: PuzzleDemoLog) => ({
    game_type: type,
    seed: 0,
    puzzle,
    input_log: { ...log, presentation: puzzlePresentation(type) },
    example_id: INTRO_EXAMPLE_ID,
    start_tick: 0,
    length_ticks: Math.max(0, ...log.actions.map((a) => a.t)),
  });
  // A still demo (one touch, long after) to measure on: its stage is the one the real demo plays on.
  const still: PuzzleDemoLog = { actions: [{ t: 600_000, action: "tap", args: { at: { x: 0.999, y: 0.001 } } }], w, h, verdicts: [], layout: GAME_COLUMN_LAYOUT };
  const measure = await openIntro(browser, origin, type, row(still));
  let points: Pt[];
  try {
    const client = await resolve(measure.page, DEMO_STAGE, targetsOf(steps));
    const box = await measure.page.locator(DEMO_STAGE).first().boundingBox();
    if (!box) throw new Error(`${type}: no demo stage`);
    points = client.map((p) => ({ x: (p.x - box.x) / box.width, y: (p.y - box.y) / box.height }));
  } finally {
    await measure.close();
  }
  const log = demoLog(steps, points, w, h);
  const play = await openIntro(browser, origin, type, row(log));
  try {
    const solved = `${DEMO_STAGE} ${SOLVED[type] ?? "[data-logic-solved]"}`;
    await play.page.waitForSelector(solved, { timeout: (log.actions.at(-1)?.t ?? 0) + 15_000, state: "attached" });
    if (play.errors.length) throw new Error(`${type}: demo page errors: ${play.errors.join("; ")}`);
  } catch (error) {
    await play.page.screenshot({ path: `/tmp/logic-demo-${type}-demo-fail.png` }).catch(() => {});
    throw new Error(`${type}: the demo did not solve the board in the intro (${String(error).split("\n")[0]})`);
  } finally {
    await play.close();
  }
  return row(log);
}

async function main() {
  const { origin, proc } = await startServer();
  const harness = await startSafeAreaServer({ cacheDir: "node_modules/.vite-logic-demos", buildId: "logic-demos-record" });
  const browser = await chromium.launch(CHROMIUM);
  const out: Record<string, unknown> = existsSync(LOGIC_DEMOS_FILE) ? (JSON.parse(readFileSync(LOGIC_DEMOS_FILE, "utf8")) as Record<string, unknown>) : {};
  try {
    for (const type of GAMES) {
      const full = exampleFor(type);
      const steps = plan(type, full);
      const graded = await practiceRun(browser, origin, type, steps);
      const demo = await demoRun(browser, harness.origin, type, splitPuzzle(full).pub, steps, graded.w, graded.h);
      out[type] = { ...demo, answer: graded.answer, msRemaining: graded.msRemaining, score: graded.score };
      console.log(`${type}: ${steps.length} touches, ${(demo.length_ticks / 1000).toFixed(1)} s, score ${graded.score}, solves in the intro`);
    }
  } finally {
    await browser.close();
    await harness.close();
    if (proc?.pid) process.kill(-proc.pid);
  }
  const ordered = Object.fromEntries(LOGIC_DEMO_GAMES.filter((g) => out[g]).map((g) => [g, out[g]]));
  writeFileSync(LOGIC_DEMOS_FILE, `${JSON.stringify(ordered, null, 1)}\n`);
  console.log(`wrote ${LOGIC_DEMOS_FILE}`);
}

if (import.meta.main) await main();
