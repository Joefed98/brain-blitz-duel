/**
 * pattern-demos-record (15 Nov 2026): how scripts/fixtures/pattern-demos.json was made. A tool, not a check.
 *
 *   bun scripts/pattern-demos-serve.ts [port]                       a dev server on a local database (below)
 *   INTRO_DEMO_KEY=… bun scripts/pattern-demos-record.ts record <unblock|laser> --url=<origin> [--out=<dir>]
 *   INTRO_DEMO_KEY=… bun scripts/pattern-demos-record.ts replay <game> --url=<origin> [--out=<dir>]
 *   bun scripts/pattern-demos-record.ts assemble [--out=<dir>]
 *
 * record: real play in headless Chromium (390 × 844) of the game's fixed intro example in dev practice (Intro examples
 * on, the dev demo key): Gridlock's par route with one car slid the wrong way and Undo giving it back; Lightbender's nine
 * pieces placed, one mirror turned the wrong way and one moved off its square, each taken back by Undo, then Fire.
 * replay: a bundled demo's own touches (src/lib/duel/bundledDemos/<game>.json) played back into the real practice
 * stage at their recorded places and rhythm. Both press "Save as intro demo" on the reveal and keep the exact request
 * the Save button sends (aborted, so nothing is stored), practice's grade request and the server's grade answer, in
 * `<out>/<game>-<mode>.json`.
 * assemble: writes the recorded games' bundled rows (the Save request's touch log on the deal's public half, the 3-2-1's
 * idle trimmed so the first touch is at 0.6 s, as the five bundled before) and the fixture (every game's row and run).
 *
 * The dev server must have a database: Gridlock's intro example is the unblock_bank table's first row, and the
 * practice deal and grade count against rate limits. pattern-demos-serve.ts starts one on the server-function harness
 * (every migration, unblock_bank in the fallback bank's order, INTRO_DEMO_KEY "localdemokey" unless set).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { fromCrossJSON, fromJSON } from "seroval";

import { expandActions, INTRO_EXAMPLE_ID, type PuzzleDemoLog } from "../src/lib/duel/puzzleDemo";
import { PATTERN_DEMO_GAMES, patternDemosPath } from "./pattern-demos-lib";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const [mode, game] = args.filter((a) => !a.startsWith("--")) as ["record" | "replay" | "assemble", string];
const OUT = flag("out") ?? ".shots/pattern-demos";
mkdirSync(OUT, { recursive: true });

const STAMPS: Record<string, [string, number]> = {
  blockparty: ["blockRev", 4],
  pipes: ["pipesRev", 5],
  flow: ["flowRev", 3],
  iceslide: ["slideRev", 5],
  gravity: ["gravityRev", 9], // Changed with Joe's approval, 22 Nov 2026: gravityRev 9 since D4
  unblock: ["unblockRev", 4],
  laser: ["laserRev", 4],
};
const RECORDED = new Set(["unblock", "laser"]);

if (mode === "assemble") {
  const games = [];
  for (const g of PATTERN_DEMO_GAMES) {
    const how = RECORDED.has(g) ? "record" : "replay";
    const got = JSON.parse(readFileSync(`${OUT}/${g}-${how}.json`, "utf8"));
    let row;
    if (how === "record") {
      const log = got.save.log as PuzzleDemoLog;
      const lead = Math.min(...log.actions.map((a) => a.t)) - 600;
      for (const a of log.actions) a.t -= lead;
      // The stored row keeps the public half the server opened from the seal (savePuzzleDemoFn), never the reveal's
      // full puzzle the request carries.
      row = { game_type: g, seed: 0, puzzle: got.deal.puzzle, input_log: log, example_id: INTRO_EXAMPLE_ID, start_tick: 0, length_ticks: Math.round(Math.max(0, ...log.actions.map((a) => a.t))) };
      writeFileSync(`src/lib/duel/bundledDemos/${g}.json`, JSON.stringify(row));
    } else row = JSON.parse(readFileSync(`src/lib/duel/bundledDemos/${g}.json`, "utf8"));
    const [key, rev] = STAMPS[g]!;
    const req = got.gradeRequest;
    games.push({
      game: g,
      stamp: { key, rev },
      how: how === "record" ? "recorded by play" : "the bundled demo's own touches replayed",
      row,
      run: { answer: req.answer, msRemaining: req.msRemaining, ...(req.extra && Object.keys(req.extra).length ? { extra: req.extra } : {}), score: got.grade.score, isCorrect: got.grade.isCorrect, storedMs: got.grade.msRemaining },
    });
  }
  const about =
    "The Pattern overhaul's intro demos on today's stamps (15 Nov 2026): each game's intro_demos row as the reveal's Save button sends it (the fixed intro example's public half and the touch log), and the answer the same touches sent to practice's grader in the real practice stage, with the score the dev server's grader gave it. Proved by scripts/pattern-demos-check.ts; saved live by scripts/pattern-demos-save.ts.";
  writeFileSync(patternDemosPath(), JSON.stringify({ about, games }, null, 1) + "\n");
  console.log(`wrote ${patternDemosPath()} (${games.length} games)`);
  process.exit(0);
}

const ORIGIN = flag("url") ?? "";
const KEY = process.env["INTRO_DEMO_KEY"] ?? "";
if (!ORIGIN || !KEY || !game || (mode !== "record" && mode !== "replay")) {
  console.log("usage: INTRO_DEMO_KEY=… bun scripts/pattern-demos-record.ts record|replay <game> --url=<origin> [--out=<dir>]");
  process.exit(2);
}

const decode = (text: string) => (fromCrossJSON(JSON.parse(text), { refs: new Map() } as never) as { result: unknown }).result;
const payloadOf = (body: string) => (fromJSON(JSON.parse(body)) as { data: unknown }).data;
const fnName = (url: string) => {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return (JSON.parse(Buffer.from(id, "base64url").toString()) as { export: string }).export.replace("_createServerFn_handler", "");
  } catch {
    return id;
  }
};

const browser = await chromium.launch({ executablePath: process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })).newPage();
page.on("pageerror", (e) => console.log("pageerror", String(e.message).split("\n")[0]));
const got: Record<string, unknown> = {};
await page.route("**/_serverFn/**", async (route) => {
  const req = route.request();
  const name = fnName(req.url());
  if (req.method() === "POST" && name === "savePuzzleDemoFn") {
    got["save"] = payloadOf(req.postData() ?? "");
    return route.abort();
  }
  if (req.method() === "POST" && (name === "practiceGenerateFn" || name === "practiceGradeFn")) {
    const res = await route.fetch();
    const text = await res.text();
    if (name === "practiceGenerateFn") got["deal"] = decode(text);
    else {
      got["gradeRequest"] = payloadOf(req.postData() ?? "");
      got["grade"] = decode(text);
    }
    return route.fulfill({ response: res, body: text });
  }
  return route.continue();
});

await page.goto(`${ORIGIN}/practice?dev=1&key=${encodeURIComponent(KEY)}`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.getByRole("switch").first().waitFor({ timeout: 240000 });
await page.waitForTimeout(1500);
await page.getByRole("switch").first().check();
await page.locator(`[data-practice-game="${game}"] button, [data-practice-game="${game}"] a`).first().click();
await page.locator(`[data-game-page-play="${game}"]`).click({ timeout: 60000 });
await page.locator("[data-game-stage]").first().waitFor({ timeout: 60000 });
// The 3-2-1 and the clock starting.
await page.waitForTimeout(4500);
const wait = (ms: number) => page.waitForTimeout(ms);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deal = got["deal"] as { puzzle: any };

async function press(name: string) {
  const b = page.getByRole("button", { name, exact: true }).first();
  await b.waitFor();
  for (let i = 0; i < 80 && (await b.isDisabled()); i++) await wait(50);
  await wait(150);
  const box = (await b.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await wait(50);
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8);
    await wait(30);
  }
  await wait(60);
  await page.mouse.up();
}

const PLAY: Record<string, () => Promise<void>> = {
  // Gridlock: the par route (the bank row's stored shortest solution), with the fourth move's car first slid the other
  // way and Undo giving it back.
  async unblock() {
    const { UNBLOCK_BANK } = await import("../src/lib/duel/unblockBank.server");
    const { generateUnblock } = await import("../src/lib/duel/unblock.server");
    const { decodeMoves } = await import("../src/lib/duel/unblock");
    const p = deal.puzzle as { vehicles: { id: number; axis: "h" | "v"; len: number; row: number; col: number }[]; cols?: number };
    const n = p.cols ?? 7;
    // The bank row the server dealt (the table's first row): the one whose board is the dealt board.
    const dealt = UNBLOCK_BANK.map((e) => e.split("|")).map(([layout, min, solution]) => generateUnblock({ layout: layout!, min_moves: Number(min), solution: solution! }))
      .find((b) => JSON.stringify(b.vehicles) === JSON.stringify(p.vehicles));
    if (!dealt) throw new Error("the dealt board is in no bank row");
    const route = decodeMoves(dealt.solution);
    const state = new Map(p.vehicles.map((v) => [v.id, { ...v }]));
    const grid = () =>
      page.evaluate((cols) => {
        const board = (document.querySelector('[data-unblock-car="0"]') as HTMLElement).parentElement!.getBoundingClientRect();
        return { x: board.left, y: board.top, cell: board.width / cols };
      }, n);
    const slide = async (id: number, to: number) => {
      const v = state.get(id)!;
      const g = await grid();
      const from = v.axis === "h" ? v.col : v.row;
      const cx = g.x + (v.col + (v.axis === "h" ? v.len / 2 : 0.5)) * g.cell;
      const cy = g.y + (v.row + (v.axis === "v" ? v.len / 2 : 0.5)) * g.cell;
      const d = (to - from) * g.cell;
      await drag({ x: cx, y: cy }, { x: v.axis === "h" ? cx + d : cx, y: v.axis === "v" ? cy + d : cy });
      if (v.axis === "h") v.col = to;
      else v.row = to;
      await wait(380);
    };
    for (let i = 0; i < route.length; i++) {
      if (i === 3) {
        const m = route[i]!;
        const v = state.get(m.id)!;
        const pos = v.axis === "h" ? v.col : v.row;
        const back = m.to > pos ? pos - 1 : pos + 1;
        const before = { ...v };
        await slide(m.id, back);
        await wait(250);
        await press("Undo");
        state.set(m.id, before);
        await wait(450);
      }
      await slide(route[i]!.id, route[i]!.to);
    }
  },
  // Lightbender: each piece of the generator's solution placed (a tap places the selected piece, a tap on it turns
  // it), the second mirror turned the wrong way and the fifth moved off its square, each taken back by Undo, then Fire.
  async laser() {
    const { generatePuzzle } = await import("../src/lib/duel/generate.server");
    const { withSeededRandom } = await import("../src/lib/duel/random");
    const { INTRO_EXAMPLE_SEED } = await import("../src/lib/duel/puzzleDemo");
    const solution = (withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle("laser")) as { solution: { cell: number; kind: string }[] }).solution;
    const centre = (cell: number) =>
      page.evaluate((c) => {
        const r = (document.querySelector("[data-laser-cell]")!.parentElement!.children[c] as HTMLElement).getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, cell);
    const tap = async (cell: number) => {
      const { x, y } = await centre(cell);
      await page.mouse.click(x, y);
      await wait(260);
    };
    const p = deal.puzzle as { blocks: number[]; gems: number[]; bombs: number[]; source: number };
    let mirrors = 0;
    for (const piece of solution) {
      if (piece.kind.startsWith("S")) {
        await press("Select splitter");
        await wait(200);
        await tap(piece.cell);
        if (piece.kind !== "S-") await tap(piece.cell);
        await press("Select mirror");
        await wait(200);
        continue;
      }
      await tap(piece.cell);
      if (piece.kind !== "/") await tap(piece.cell);
      mirrors++;
      if (mirrors === 2) {
        await tap(piece.cell);
        await wait(200);
        await press("Undo");
        await wait(350);
      }
      if (mirrors === 5) {
        const free = [piece.cell - 10, piece.cell + 10, piece.cell - 1, piece.cell + 1].find(
          (c) => c >= 0 && c < 100 && !solution.some((s) => s.cell === c) && !p.blocks.includes(c) && !p.gems.includes(c) && !p.bombs.includes(c) && c !== p.source,
        )!;
        await drag(await centre(piece.cell), await centre(free));
        await wait(350);
        await press("Undo");
        await wait(350);
      }
    }
    await wait(300);
    await press("Fire");
  },
};

async function replay() {
  const row = JSON.parse(readFileSync(`src/lib/duel/bundledDemos/${game}.json`, "utf8")) as { input_log: PuzzleDemoLog };
  const events = expandActions(row.input_log.actions);
  const t0 = Date.now() - (events[0]!.t - 200);
  for (const e of events) {
    const due = t0 + e.t - Date.now();
    if (due > 0) await wait(due);
    if (e.kind === "type" || e.kind === "select") throw new Error(`unexpected ${e.kind}`);
    const r = (await page.locator("[data-game-region]").first().boundingBox())!;
    const x = r.x + e.x * r.width;
    const y = r.y + e.y * r.height;
    await page.mouse.move(x, y);
    if (e.kind === "down") await page.mouse.down();
    else if (e.kind === "up") await page.mouse.up();
  }
}

if (mode === "record") await PLAY[game]!();
else await replay();
await page.locator("[data-practice-reveal-actions], [data-reveal-screen]").first().waitFor({ timeout: 60000 });
await wait(2500);
await page.screenshot({ path: `${OUT}/${game}-${mode}-reveal.png` }).catch(() => {});
await page.getByRole("button", { name: "Save as intro demo" }).click({ timeout: 30000 });
await wait(1500);
if (!got["save"]) throw new Error("no save request seen");
writeFileSync(`${OUT}/${game}-${mode}.json`, JSON.stringify(got, null, 1));
console.log(game, mode, "score", (got["grade"] as { score?: number })?.score, "solved", (got["grade"] as { isCorrect?: boolean })?.isCorrect);
await browser.close();
