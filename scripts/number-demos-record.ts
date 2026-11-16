/**
 * Records the intro demos of the eight Number games (the Number overhaul, 15 Nov 2026) into
 * scripts/fixtures/number-demos.json. Re-runnable per game: a game named on the command line is re-recorded and the
 * others in the fixture are kept as they are.
 *
 *   bun scripts/number-demos-record.ts [game ...] [--url=<origin>] [--verbose]
 *
 * For each game it opens /practice?game=<id> on a running dev server (default the shared one, DEMOS_URL or
 * http://127.0.0.1:5190; it never starts its own) in headless Chromium at 390 × 844, switches the deal request to the
 * fixed intro example exactly as the app's "Intro examples" mode asks for it (example: true, no level: Normal), and
 * refuses to record unless the page was dealt exactly the example this tree deals (exampleFor, the code
 * practiceGenerateFn runs). It then attaches the app's own DemoRecorder (src/lib/duel/puzzleDemo.ts, the module the
 * practice route records with) to the stage's region, as the route does, and a bot plays the example to the finish with
 * real pointer input on the live board, at a natural pace. The run's answer comes from the practice grade request the
 * page sends; the score is the server's own gradeAnswer on the example (the grade response is checked against it).
 *
 * The saved log carries what the app's Save demo button adds (the presentation for the games in REVISED_PUZZLE_DEMOS)
 * and NUMBER_DEMO_REV, which the server's stop rules require for these eight games (introDemo.functions.ts).
 * number-demos-check proves the fixture; number-demos-save puts it in the database.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Page, Request } from "playwright";

import { puzzlePresentation, REVISED_PUZZLE_DEMOS } from "../src/components/puzzles/wordInput";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { NUMBER_DEMO_GAMES, NUMBER_DEMO_REV } from "../src/lib/duel/introDemo.functions";
import { numlineShare, numlineValue } from "../src/lib/duel/numline";
import type { PuzzleDemoLog } from "../src/lib/duel/puzzleDemo";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData } from "../src/lib/duel/types";
import { exampleFor } from "./shots/examples";

export const FIXTURE = "scripts/fixtures/number-demos.json";

export interface NumberDemo {
  game: string;
  /** The public half of the intro example, as getIntroDemoFn returns it and the save stores it. */
  puzzle: PuzzleData;
  log: PuzzleDemoLog & { presentation?: string; numberDemoRev: number };
  /** The answer the run sent (practice's grade request) and its claim. */
  answer: string;
  msRemaining: number;
  extra?: unknown;
  /** gradeAnswer on the full example. */
  score: number;
  isCorrect: boolean;
}

export const readFixture = (): Record<string, NumberDemo> =>
  existsSync(FIXTURE) ? (JSON.parse(readFileSync(FIXTURE, "utf8")) as { demos: Record<string, NumberDemo> }).demos : {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Full = any;

/* ----------------------------------------------------------------- input */

const stage = (page: Page) => page.locator("[data-game-stage]");
const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

/** A finger's tap at an element's centre: down, a short hold, up, then the pace before the next move. */
async function tap(page: Page, loc: ReturnType<Page["locator"]>, after = 380) {
  await loc.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => undefined);
  const box = await loc.boundingBox();
  if (!box) throw new Error("no box to tap");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await pause(page, 70);
  await page.mouse.up();
  await pause(page, after);
}

async function tapText(page: Page, scope: ReturnType<Page["locator"]>, value: string | number, after?: number) {
  const want = String(value);
  const n = await scope.count();
  for (let i = 0; i < n; i++) {
    const t = scope.nth(i);
    if ((await t.innerText()).trim() === want) return tap(page, t, after);
  }
  throw new Error(`no control "${want}"`);
}

/* ----------------------------------------------------------------- bots */

/** Exact: each solution step, a tile, the operator, the other tile; the last step hits the target. */
async function exactBot(page: Page, puzzle: Full) {
  const tiles = () => stage(page).locator('[data-game-controls="numbers"] button:not([disabled])');
  for (const s of puzzle.solution as { a: number; b: number; operator: string }[]) {
    // A merge leaves its result picked: a step that starts from it goes straight to the operator.
    const picked = stage(page).locator('[data-game-controls="numbers"] button[aria-pressed="true"]');
    const startsPicked = (await picked.count()) > 0 && (await picked.first().innerText()).trim() === String(s.a);
    if (!startsPicked) await tapText(page, tiles(), s.a, 300);
    const label = s.operator === "-" ? "−" : s.operator;
    await tap(page, stage(page).locator('[data-game-controls="operators"] button', { hasText: label }).first(), 300);
    // The second tile: the same value as the first is the one not already picked.
    const all = tiles();
    const n = await all.count();
    let skipped = s.a !== s.b;
    let done = false;
    for (let i = 0; i < n && !done; i++) {
      const t = all.nth(i);
      if ((await t.innerText()).trim() !== String(s.b)) continue;
      const picked = (await t.getAttribute("aria-pressed")) === "true" || (await t.getAttribute("data-selected")) != null;
      if (!skipped && picked) {
        skipped = true;
        continue;
      }
      await tap(page, t, 420);
      done = true;
    }
    if (!done) throw new Error(`Exact: no second tile ${s.b}`);
    // The step merges; hitting the target locks the answer at once (no Lock tap: Lock ends the round). The merge
    // slides the result in: wait for it before the next step's first tap.
    await pause(page, 700);
  }
}

/** Operator's gaps: each equation's fills in reading order, a sign key or an unused tray number. */
async function operatorBot(page: Page, puzzle: Full) {
  for (const [i, answer] of (puzzle.gapAnswers as string[]).entries()) {
    if (i > 0) await pause(page, 1300);
    for (const f of answer.split(",")) {
      const sign = ["+", "-", "×", "÷"].includes(f);
      const keys = stage(page).locator(`[data-equation-pad] button[data-kind="${sign ? "sign" : "number"}"]:not([data-used])`);
      await tapText(page, keys, sign ? (f === "-" ? "−" : f) : f, 420);
    }
  }
}

/** Integer Pyramid: for each empty stone, its number from the tray, then the stone. */
async function pyramidBot(page: Page, puzzle: Full) {
  for (let index = 0; index < puzzle.pyramids.length; index++) {
    if (index > 0) {
      await page.getByText(new RegExp(`(Stage|Pyramid) ${index + 1} of ${puzzle.pyramids.length}`)).first().waitFor({ timeout: 10_000 });
      await pause(page, 500);
    }
    const board = puzzle.pyramids[index];
    const solution: number[] = puzzle.solutions[index];
    const empties = (board.givens as (number | null)[]).map((g, i) => (g == null ? i : -1)).filter((i) => i >= 0);
    // Bottom row first, as a person builds a pyramid.
    empties.sort((a, b) => b - a);
    for (const cell of empties) {
      const tile = stage(page).locator("[data-np-tray] .pyramid-tray-tile").filter({ hasText: new RegExp(`^\\s*${solution[cell]}\\s*$`) }).first();
      await tap(page, tile, 200);
      await tap(page, stage(page).locator(`[data-np-cell="${cell}"]`).last(), 240);
    }
  }
}

/** Ballpark: a short drag to each value's true place on the line, then Place. */
async function ballparkBot(page: Page, puzzle: Full) {
  const SIDE = 22;
  let k = 0;
  for (const [si, s] of (puzzle.stages as { lo: number; hi: number }[]).entries()) {
    if (si > 0) await pause(page, 900);
    for (const v of puzzle.values[si]) {
      const share = numlineShare(s, numlineValue(v));
      const arena = stage(page).locator('[data-game-arena="board"]').first();
      const box = await arena.boundingBox();
      if (!box) throw new Error("Ballpark: no arena");
      const x = box.x + SIDE + share * (box.width - 2 * SIDE);
      const y = box.y + box.height / 2;
      const from = x + (k++ % 2 ? -36 : 36);
      await page.mouse.move(from, y);
      await page.mouse.down();
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(from + ((x - from) * i) / 6, y);
        await pause(page, 35);
      }
      await pause(page, 90);
      await page.mouse.up();
      await pause(page, 260);
      await tap(page, stage(page).getByRole("button", { name: /^place$/i }), 380);
    }
  }
}

export const BOTS: Record<string, (page: Page, puzzle: Full) => Promise<void>> = {
  target: exactBot,
  equation: operatorBot,
  numpyramid: pyramidBot,
  numline: ballparkBot,
};

/* ----------------------------------------------------------------- the run */

function serverFnName(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
  } catch {
    return id;
  }
}

/** The deal request's data, switched to the fixed intro example at Normal (as the app's Intro examples mode asks). */
export function exampleBody(body: string): string {
  const parsed = JSON.parse(body) as { t: { p: { v: { p: { k: string[]; v: unknown[] } }[] } } };
  const inner = parsed.t.p.v[0]!.p;
  const at = inner.k.indexOf("example");
  if (at < 0) throw new Error("deal request has no example field");
  inner.v[at] = { t: 2, s: 2 };
  const level = inner.k.indexOf("level");
  if (level >= 0) {
    inner.k.splice(level, 1);
    inner.v.splice(level, 1);
  }
  return JSON.stringify(parsed);
}

/** Seroval's JSON nodes for plain data (the server functions' bodies and replies): numbers, strings, constants, arrays,
 * objects and back-references. Anything else is refused. */
export function decode(text: string): unknown {
  const refs = new Map<number, unknown>();
  const CONST = [null, undefined, true, false, -0, Infinity, -Infinity, NaN];
  type Node = { t: number; s?: unknown; i?: number; a?: (Node | null)[]; p?: { k: string[]; v: Node[] } };
  // seroval's own string escapes, inside the JSON's (deserializeString).
  const ESC: Record<string, string> = { "\\\\": "\\", '\\"': '"', "\\n": "\n", "\\r": "\r", "\\b": "\b", "\\t": "\t", "\\f": "\f", "\\u2028": "\u2028", "\\u2029": "\u2029", "\\x3C": "<" };
  const unesc = (str: string) => (str.includes("\\") ? str.replace(/(\\\\|\\"|\\n|\\r|\\b|\\t|\\f|\\u2028|\\u2029|\\x3C)/g, (m) => ESC[m]!) : str);
  const walk = (n: Node | null): unknown => {
    if (n === null) return undefined;
    switch (n.t) {
      case 0: return n.s;
      case 1: return unesc(n.s as string);
      case 2: return CONST[n.s as number];
      case 4: return refs.get(n.i!);
      case 9: {
        const out: unknown[] = [];
        refs.set(n.i!, out);
        for (const x of n.a ?? []) out.push(walk(x));
        return out;
      }
      case 10:
      case 11: {
        const out: Record<string, unknown> = {};
        refs.set(n.i!, out);
        n.p?.k.forEach((k, j) => {
          const v = walk(n.p!.v[j]!);
          if (v !== undefined) out[k] = v;
        });
        return out;
      }
      default:
        throw new Error(`unsupported seroval node ${n.t}`);
    }
  };
  const top = JSON.parse(text) as { t: Node } | Node;
  return walk(("t" in top && typeof top.t === "object" ? top.t : top) as Node);
}

async function recordGame(page: Page, origin: string, game: string, verbose: boolean): Promise<NumberDemo> {
  const bot = BOTS[game];
  if (!bot) throw new Error(`no bot for ${game} yet`);
  const full = exampleFor(game as never) as Full;
  const pub = splitPuzzle(full).pub as PuzzleData;
  let dealt: unknown = null;
  let graded: { data: Record<string, unknown>; result: Record<string, unknown> } | null = null;
  const onDone = async (request: Request) => {
    const name = serverFnName(request.url());
    if (verbose && name.includes("export")) console.log("  fn", name.replace(/.*"export":"/, "").slice(0, 60));
    if (!/practiceGenerate|practiceGrade/.test(name)) return;
    const response = await request.response();
    if (!response) return;
    const result = decode(await response.text()) as Record<string, unknown>;
    if (/practiceGenerate/.test(name)) dealt = (result as { result?: { puzzle?: unknown } }).result?.puzzle ?? (result as { puzzle?: unknown }).puzzle;
    else {
      const data = (decode(request.postData() ?? "") as { data: Record<string, unknown> }).data;
      graded = { data, result: ((result as { result?: unknown }).result ?? result) as Record<string, unknown> };
    }
  };
  page.on("requestfinished", (r) => void onDone(r).catch((e) => console.log(`  (${serverFnName(r.url()).slice(0, 90)}: ${(e as Error).message})`)));
  // The shared dev server is edited by other sessions: its hot-reload socket is answered here and never forwarded, so
  // no reload lands mid-recording.
  await page.routeWebSocket(() => true, () => undefined);
  await page.route("**/_serverFn/**", async (route) => {
    const request = route.request();
    if (/practiceGenerate/.test(serverFnName(request.url()))) return route.continue({ postData: exampleBody(request.postData() ?? "") });
    return route.continue();
  });
  // A game's page (?page=<id>, where ?game= lands today) deals on Play and opens the round in its 3-2-1; an older
  // build's ?game= link opens the full intro with Ready. Either way the deal is the example (the request above).
  await page.goto(`${origin}/practice?game=${encodeURIComponent(game)}`, { waitUntil: "domcontentloaded" });
  const start = page.getByRole("button", { name: /^(Ready|Play)$/ }).first();
  await start.waitFor({ timeout: 240_000 });
  await pause(page, 1500);
  await start.click();
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 60_000 });
  if (JSON.stringify(dealt) !== JSON.stringify(pub)) throw new Error(`the page was not dealt this tree's example:\n page ${JSON.stringify(dealt)}\n tree ${JSON.stringify(pub)}`);
  // The stage is live once the round clock runs: attach the app's recorder to the region, as the practice route does.
  await pause(page, 1200);
  await page.evaluate(async () => {
    const mod = (await import(/* @vite-ignore */ "/src/lib/duel/puzzleDemo.ts")) as typeof import("../src/lib/duel/puzzleDemo");
    const region = document.querySelector("[data-game-region]") as HTMLElement;
    const rec = new mod.DemoRecorder(Date.now());
    rec.attach(region);
    (window as unknown as { __rec: unknown }).__rec = rec;
  });
  await pause(page, 600);
  await bot(page, full);
  if (verbose) await page.screenshot({ path: `/tmp/number-demo-${game}-end.png` });
  for (let i = 0; i < 100 && !graded; i++) await pause(page, 100);
  if (!graded) throw new Error("the run never sent its answer");
  const log = (await page.evaluate(() => (window as unknown as { __rec: { finish: () => unknown } }).__rec.finish())) as PuzzleDemoLog;
  const g = graded as { data: Record<string, unknown>; result: Record<string, unknown> };
  const answer = String(g.data["answer"]);
  const msRemaining = Number(g.data["msRemaining"]);
  const extra = g.data["extra"];
  const mine = gradeAnswer(full, answer, msRemaining, extra as never);
  if (verbose) console.log(game, "server", g.result["score"], "gradeAnswer", mine.score);
  if (Number(g.result["score"]) !== mine.score) throw new Error(`the server scored ${String(g.result["score"])}, gradeAnswer ${mine.score}`);
  const saved = {
    ...log,
    ...(REVISED_PUZZLE_DEMOS.has(game) ? { presentation: puzzlePresentation(game) } : {}),
    numberDemoRev: NUMBER_DEMO_REV,
  };
  return { game, puzzle: pub, log: saved, answer, msRemaining, ...(extra !== undefined ? { extra } : {}), score: mine.score, isCorrect: mine.isCorrect };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const origin = (args.find((a) => a.startsWith("--url="))?.slice(6) ?? process.env.DEMOS_URL ?? "http://127.0.0.1:5190").replace(/\/$/, "");
  const verbose = args.includes("--verbose");
  const named = args.filter((a) => !a.startsWith("--"));
  const games = named.length ? named : Object.keys(BOTS);
  for (const g of games) if (!(NUMBER_DEMO_GAMES as readonly string[]).includes(g)) throw new Error(`${g} is not a Number game`);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p)) });
  const demos = readFixture();
  let failed = 0;
  try {
    for (const game of games) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e.message).split("\n")[0]!));
      try {
        const demo = await recordGame(page, origin, game, verbose);
        demos[game] = demo;
        const last = Math.max(...demo.log.actions.map((a) => a.t));
        console.log(`OK ${game}: ${demo.log.actions.length} actions, ${(last / 1000).toFixed(1)} s, score ${demo.score}${demo.isCorrect ? " (finished)" : ""}`);
        if (errors.length) console.log(`  page errors: ${errors.join(" | ")}`);
      } catch (error) {
        failed++;
        console.log(`FAIL ${game}: ${(error as Error).message}`);
        await page.screenshot({ path: `/tmp/number-demo-${game}.png` }).catch(() => undefined);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const ordered = Object.fromEntries(NUMBER_DEMO_GAMES.filter((g) => demos[g]).map((g) => [g, demos[g]!]));
  writeFileSync(FIXTURE, JSON.stringify({ note: "Intro demos of the eight Number games; bun scripts/number-demos-record.ts [game ...] re-records.", demos: ordered }, null, 1) + "\n");
  process.exit(failed ? 1 : 0);
}
