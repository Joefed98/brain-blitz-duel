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
 * real pointer input on the live board, at a natural pace. The log is then replayed into a fresh round the way the
 * intro plays it (number-demos-play.ts), and that round's practice grade request gives the stored answer; the score is
 * gradeAnswer on the example (the server's grade response must agree).
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
import { decodeCheckoutDarts, CHECKOUT_BULL } from "../src/lib/duel/checkout";
import { numlineShare, numlineValue } from "../src/lib/duel/numline";
import type { PuzzleDemoLog } from "../src/lib/duel/puzzleDemo";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData } from "../src/lib/duel/types";
import { PLAY } from "./number-demos-play";
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
      await page.getByText(new RegExp(`(Stage|Pyramid) ${index + 1} of ${puzzle.pyramids.length}`)).filter({ visible: true }).first().waitFor({ timeout: 10_000 }); // Changed with Joe's approval, 22 Nov 2026
      await pause(page, 500);
    }
    const board = puzzle.pyramids[index];
    const solution: number[] = puzzle.solutions[index];
    const empties = (board.givens as (number | null)[]).map((g, i) => (g == null ? i : -1)).filter((i) => i >= 0);
    // Bottom row first, as a person builds a pyramid.
    empties.sort((a, b) => b - a);
    for (const cell of empties) {
      const tile = stage(page).locator("[data-np-tray] .pyramid-tray-tile").filter({ hasText: new RegExp(`^\\s*${solution[cell]}\\s*$`) }).first();
      await tap(page, tile, 110);
      await tap(page, stage(page).locator(`[data-np-cell="${cell}"]`).last(), 150);
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
        await pause(page, 25);
      }
      await pause(page, 60);
      await page.mouse.up();
      await pause(page, 160);
      await tap(page, stage(page).getByRole("button", { name: /^place$/i }), 260);
    }
  }
}

/** A tap inside an element's own shape (an SVG wedge's box centre can lie in its neighbour): the drawn point nearest
 * the box's centre that the element itself receives. */
async function tapInside(page: Page, loc: ReturnType<Page["locator"]>, after = 380) {
  const point = await loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    let best: { x: number; y: number; d: number } | null = null;
    for (let i = 1; i < 24; i++)
      for (let j = 1; j < 24; j++) {
        const x = r.left + (r.width * i) / 24;
        const y = r.top + (r.height * j) / 24;
        const hit = document.elementFromPoint(x, y);
        if (hit !== el) continue;
        const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        if (!best || d < best.d) best = { x, y, d };
      }
    return best;
  });
  if (!point) throw new Error("no visible point to tap");
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await pause(page, 70);
  await page.mouse.up();
  await pause(page, after);
}

/** Counterweight: each tray weight, then the notch of its solution peg. */
async function balanceBot(page: Page, puzzle: Full) {
  const total = puzzle.scales.length;
  for (let s = 0; s < total; s++) {
    if (s > 0) {
      await page.locator("[data-game-stage], [data-goal-line]").getByText(new RegExp(`scale ${s + 1} (/|of) ${total}`, "i")).first().waitFor({ timeout: 10_000 });
      await pause(page, 500);
    }
    const scale = puzzle.scales[s] as { tray: number[]; pegs?: number };
    const half = (scale.pegs ?? 8) / 2;
    for (const [i, w] of scale.tray.entries()) {
      const peg = puzzle.solutions[s][i] as number;
      const name = peg < half ? `Place at distance ${half - peg} on the left` : `Place at distance ${peg - half + 1} on the right`;
      await tap(page, stage(page).locator(`button[aria-label="Select weight ${w}"]:not(.balance-instrument button)`).first(), 300);
      await tap(page, stage(page).getByRole("button", { name, exact: true }), 450);
    }
  }
}

/** Brimful: each board's shortest solution, F<i> fill, E<i> empty, P<i>-<j> pour (tap a jug, then the action or jug). */
async function brimfulBot(page: Page, puzzle: Full) {
  const jug = (i: number) => stage(page).getByRole("button", { name: new RegExp(`^Jug ${i + 1}:`) }).first();
  const boards = puzzle.solutions as string[];
  for (const [b, line] of boards.entries()) {
    if (b > 0) {
      await page.getByText(new RegExp(`(Stage|Puzzle) ${b + 1} of`)).first().waitFor({ timeout: 10_000 });
      await pause(page, 500);
    }
    for (const token of line.split(",")) {
      let m: RegExpExecArray | null;
      if ((m = /^([FE])(\d)$/.exec(token))) {
        await tap(page, jug(Number(m[2])), 260);
        await tap(page, stage(page).getByRole("button", { name: m[1] === "F" ? "Fill" : "Empty", exact: true }), 520);
      } else if ((m = /^P(\d)-(\d)$/.exec(token))) {
        await tap(page, jug(Number(m[1])), 260);
        await tap(page, jug(Number(m[2])), 620);
      } else throw new Error(`Brimful: unknown move ${token}`);
    }
  }
}

/** Checkout: each board's stored fewest-darts route: the wedge (unless still picked), the ring, then Throw. */
async function checkoutBot(page: Page, puzzle: Full) {
  const ringLabel = (wedge: number, ring: number) => (wedge === CHECKOUT_BULL ? (ring === 2 ? "Bull 50" : "25") : ["", "Single", "Double", "Treble", "×4"][ring] ?? `×${ring}`);
  for (const [i, st] of (puzzle.stages as { maxDarts: number }[]).entries()) {
    if (i > 0) await pause(page, 1300);
    const tab = stage(page).getByRole("tab").nth(i);
    if ((await tab.count()) && (await tab.getAttribute("aria-selected")) !== "true") await tap(page, tab, 300);
    let held: number | null = null;
    for (const d of decodeCheckoutDarts(puzzle.routes[i], st.maxDarts)) {
      if (held !== d.wedge) await tapInside(page, stage(page).locator(`[data-checkout-hits] [data-puzzle-cell="${d.wedge === CHECKOUT_BULL ? "bull" : `w${d.wedge}`}"]`), 300);
      held = d.wedge;
      await tap(page, stage(page).locator('[data-game-controls="rings"] button', { hasText: ringLabel(d.wedge, d.ring) }).first(), 420);
    }
    await tap(page, stage(page).getByRole("button", { name: "Throw", exact: true }), 400);
  }
}

/** Kakuro: run by run (across first, top to bottom), each empty square then its digit. */
async function kakuroBot(page: Page, puzzle: Full) {
  const white = [...(puzzle.white as number[])].sort((a, b) => a - b);
  for (const cell of white) {
    const box = stage(page).locator(`[data-kakuro-cell="${cell}"]`).first();
    if (!/empty/.test((await box.getAttribute("aria-label")) ?? "")) continue;
    if (!/kakuro-selected/.test((await box.getAttribute("class")) ?? "")) await tap(page, box, 220);
    const digit = puzzle.solution[cell] as number;
    await tapText(page, stage(page).locator('[data-game-controls="numbers"] button'), digit, 360);
  }
}

export const BOTS: Record<string, (page: Page, puzzle: Full) => Promise<void>> = {
  target: exactBot,
  equation: operatorBot,
  numpyramid: pyramidBot,
  numline: ballparkBot,
  balance: balanceBot,
  measure: brimfulBot,
  checkout: checkoutBot,
  kakuro: kakuroBot,
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
  const openRound = async () => {
    dealt = null;
    graded = null;
    await page.goto(`${origin}/practice?game=${encodeURIComponent(game)}`, { waitUntil: "domcontentloaded" });
    const start = page.getByRole("button", { name: /^(Ready|Play)$/ }).first();
    await start.waitFor({ timeout: 240_000 });
    await pause(page, 1500);
    await start.click();
    await page.locator("[data-game-stage]").first().waitFor({ timeout: 60_000 });
    if (JSON.stringify(dealt) !== JSON.stringify(pub)) throw new Error(`the page was not dealt this tree's example:\n page ${JSON.stringify(dealt)}\n tree ${JSON.stringify(pub)}`);
  };
  const answerSent = async () => {
    for (let i = 0; i < 150 && !graded; i++) await pause(page, 100);
    if (!graded) throw new Error("the run never sent its answer");
    return graded as { data: Record<string, unknown>; result: Record<string, unknown> };
  };
  await openRound();
  // The stage is live once the round clock runs: attach the app's recorder to the region, as the practice route does.
  await pause(page, 1200);
  await page.evaluate(async () => {
    const url = "/src/lib/duel/puzzleDemo.ts";
    const mod = (await import(/* @vite-ignore */ url)) as typeof import("../src/lib/duel/puzzleDemo");
    const region = document.querySelector("[data-game-region]") as HTMLElement;
    const rec = new mod.DemoRecorder(Date.now());
    rec.attach(region);
    (window as unknown as { __rec: unknown }).__rec = rec;
  });
  await pause(page, 600);
  await bot(page, full);
  if (verbose) await page.screenshot({ path: `/tmp/number-demo-${game}-end.png` });
  await answerSent();
  const log = (await page.evaluate(() => (window as unknown as { __rec: { finish: () => unknown } }).__rec.finish())) as PuzzleDemoLog;
  // The demo's own answer: the log replayed into a fresh round the way the intro plays it (the recorder keeps touches
  // to 1/1000 of the play area, so a drag can land a hair from the bot's; this is the answer the demo really makes).
  await openRound();
  await pause(page, 1200);
  await page.evaluate(`(${PLAY})(${JSON.stringify({ log })})`);
  const g = await answerSent();
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
  const origin = (args.find((a) => a.startsWith("--url="))?.slice(6) ?? process.env["DEMOS_URL"] ?? "http://127.0.0.1:5190").replace(/\/$/, "");
  const verbose = args.includes("--verbose");
  const named = args.filter((a) => !a.startsWith("--"));
  const games = named.length ? named : Object.keys(BOTS);
  for (const g of games) if (!(NUMBER_DEMO_GAMES as readonly string[]).includes(g)) throw new Error(`${g} is not a Number game`);
  const { chromium } = await import("playwright");
  const executablePath = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p): p is string => Boolean(p && existsSync(p)));
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
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
