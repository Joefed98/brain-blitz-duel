/**
 * Game frame probe and board-size check (Polish 2, 24 Oct 2026): opens each puzzle's live round in
 * practice at 414×896 and 375×667 and measures, per game:
 * - the board's box (src/lib/boardBox.ts, the same function the tray hugs, run in the page, so main
 *   and a branch are measured alike) and the tray's empty space above and below it;
 * - header, goal line and score text that is cut off or wraps;
 * - dock controls under 52px tall (Cryptogrid's own keypad excepted) and anything past the screen's
 *   sides or bottom.
 *
 *   bun scripts/shots/frame-probe.ts [games…] [--url=<origin>] [--json=<file>]
 *       [--record=<file>]   write each board's size (run against main)
 *       [--compare=<file>]  fail unless every board is at least main's width and height (0.5px) and the
 *                           tray's empty space above and below the board is at most 24px each
 *       [--table=<file>]    with --compare: a Markdown table of every board, main versus this tree
 *       [--fill]            lift every arena's height cap first (what BOARD_FILL does), to find the boards
 *                           that grow with the height
 *
 * A design tool and check the Polish 2 PR ran locally; CI does not run it. Without --url it needs a dev
 * server started like the contact sheet's (Supabase on a closed port), on 5391.
 */
import { readFileSync, writeFileSync } from "node:fs";

import type { Browser } from "playwright";

import { boardBox } from "../../src/lib/boardBox";
import { gameDisplayName } from "../../src/lib/duel/gameNames";
import { ACTIVE_PUZZLE_TYPES, puzzleDef } from "../../src/lib/duel/registry";
import type { PuzzleType } from "../../src/lib/duel/types";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5391").replace(/\/$/, "");
const SIZES: [number, number][] = [[414, 896], [375, 667]];
const SEED = `(() => { let s = 20261013 >>> 0; Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;
const BOARD_BOX = boardBox.toString();
/** The tray's empty space above and below the board, at most. */
const TRAY_GAP_MAX = 24;

interface Probe {
  board: { x: number; y: number; w: number; h: number } | null;
  tray: { x: number; y: number; w: number; h: number } | null;
  cut: string[];
  smallDock: string[];
  offScreen: string[];
}

async function probe(browser: Browser, game: PuzzleType, [w, h]: [number, number]): Promise<Probe | string> {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await context.addInitScript(SEED);
  const page = await context.newPage();
  // The fixed intro example, as the contact sheet deals it, so main and a branch measure the same puzzle.
  await page.route("**/_serverFn/**", async (route) => {
    const id = route.request().url().split("/_serverFn/")[1]?.split("?")[0] ?? "";
    let name = id;
    try {
      name = Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
    } catch {
      /* keep the id */
    }
    const body = route.request().postData() ?? "";
    if (/practiceGenerate/.test(name))
      return route.continue({ postData: body.replace(/("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/, '$1{"t":2,"s":2}') });
    return route.continue();
  });
  try {
    await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded" });
    const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
    await button.waitFor({ timeout: 90_000 });
    await page.waitForTimeout(1200);
    await button.click();
    const ready = page.getByRole("button", { name: /^Ready/ }).first();
    await ready.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(500);
    await ready.click();
    await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    if (args.includes("--fill")) await page.addStyleTag({ content: "[data-game-stage] [data-game-arena] { --arena-max: none !important; max-height: none !important; }" });
    await page.waitForTimeout(1500);
    return await page.evaluate(async (src) => {
      const measure = new Function(`return ${src}`)() as (a: Element) => { left: number; top: number; right: number; bottom: number };
      const out: Probe = { board: null, tray: null, cut: [], smallDock: [], offScreen: [] };
      const label = (el: Element) => `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""}${(el.textContent ?? "").trim() ? ` "${(el.textContent ?? "").trim().slice(0, 18)}"` : ""}`;
      const round = (r: { left: number; top: number; right: number; bottom: number }) => ({ x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +(r.right - r.left).toFixed(1), h: +(r.bottom - r.top).toFixed(1) });
      for (const sel of [".game-frame-name", ".game-frame-context-text", ".game-goal-text", ".game-goal-progress", ".game-frame-score-value", ".game-frame-score-note", ".game-frame-score-label"]) {
        for (const el of document.querySelectorAll<HTMLElement>(sel)) {
          if (el.scrollWidth > el.clientWidth + 0.5 || el.scrollHeight > el.clientHeight + 1) out.cut.push(`${sel} "${el.textContent}"`);
        }
      }
      const arena = document.querySelector<HTMLElement>("[data-game-stage] [data-game-arena]");
      if (arena) out.board = round(measure(arena));
      // A board that settles in its first seconds (a shuffle, a sweep, a fit): read until it holds still.
      for (let i = 0; arena && i < 16; i++) {
        await new Promise((done) => setTimeout(done, 350));
        const next = round(measure(arena));
        const same = ["x", "y", "w", "h"].every((k) => Math.abs(next[k as "x"] - out.board![k as "x"]) < 0.5);
        out.board = next;
        if (same) break;
      }
      const tray = document.querySelector("[data-game-tray]");
      if (tray && getComputedStyle(tray).display !== "none") out.tray = round(tray.getBoundingClientRect());
      const stage = document.querySelector("[data-game-stage]");
      if (arena && stage && !document.querySelector("[data-puzzle-surface='codeword']")) {
        const bottom = arena.getBoundingClientRect().bottom;
        for (const el of stage.querySelectorAll<HTMLElement>("button, [role='button']")) {
          if (arena.contains(el)) continue;
          const b = el.getBoundingClientRect();
          if (b.top < bottom - 1 || b.width < 2) continue;
          if (b.height < 51.5) out.smallDock.push(`${label(el)} ${Math.round(b.height)}px`);
        }
      }
      for (const el of document.querySelectorAll<HTMLElement>("[data-game-column] *")) {
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.height < 2 || getComputedStyle(el).visibility === "hidden") continue;
        if (el.closest(".fx-layer, [data-radix-popper-content-wrapper]")) continue;
        if (b.left < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1) out.offScreen.push(`${label(el)} ${Math.round(b.left)}..${Math.round(b.right)} / ${Math.round(b.bottom)}`);
      }
      out.smallDock = [...new Set(out.smallDock)].slice(0, 8);
      out.offScreen = out.offScreen.slice(0, 6);
      return out;
    }, BOARD_BOX);
  } catch (error) {
    return String((error as Error).message ?? error).split("\n")[0]!;
  } finally {
    await context.close();
  }
}

type Sizes = Record<string, Record<string, { w: number; h: number }>>;
const named = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
const games = (named.length ? named : ACTIVE_PUZZLE_TYPES).filter((t) => {
  const d = puzzleDef(t);
  return d.category !== "arcade" && !d.arcadeRun;
});
const compareFile = opt("compare");
const main: Sizes | null = compareFile ? JSON.parse(readFileSync(compareFile, "utf8")) : null;
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const results: Record<string, Record<string, Probe | string>> = {};
const sizes: Sizes = {};
const failures: string[] = [];
const rows: string[] = [];
try {
  for (const game of games) {
    results[game] = {};
    sizes[game] = {};
    const cells: string[] = [];
    for (const size of SIZES) {
      const key = size.join("x");
      let r = await probe(browser, game, size);
      if (typeof r === "string") r = await probe(browser, game, size); // one retry on a load failure
      results[game]![key] = r;
      if (typeof r === "string") {
        failures.push(`${game} ${key}: ${r}`);
        console.log(`${game} ${key}: ERROR ${r}`);
        cells.push("error", "");
        continue;
      }
      if (r.board) sizes[game]![key] = { w: r.board.w, h: r.board.h };
      const was = main?.[game]?.[key];
      const problems: string[] = [];
      if (main) {
        if (!was || !r.board) problems.push("no board measured");
        else {
          if (r.board.w < was.w - 0.5) problems.push(`board ${r.board.w}px wide, main ${was.w}`);
          if (r.board.h < was.h - 0.5) problems.push(`board ${r.board.h}px tall, main ${was.h}`);
        }
        if (r.tray && r.board) {
          const above = r.board.y - r.tray.y;
          const below = r.tray.y + r.tray.h - (r.board.y + r.board.h);
          if (above > TRAY_GAP_MAX + 0.5 || below > TRAY_GAP_MAX + 0.5) problems.push(`tray ${above.toFixed(0)}px above and ${below.toFixed(0)}px below the board (max ${TRAY_GAP_MAX})`);
          if (above < -0.5 || below < -0.5 || r.board.x < r.tray.x - 0.5 || r.board.x + r.board.w > r.tray.x + r.tray.w + 0.5) problems.push("board outside its tray");
        }
        if (r.cut.length) problems.push(`cut: ${r.cut.join("; ")}`);
        cells.push(was ? `${was.w}×${was.h}` : "–", r.board ? `${r.board.w}×${r.board.h}` : "–");
      }
      for (const p of problems) failures.push(`${game} ${key}: ${p}`);
      const parts = [
        r.board ? `board ${r.board.w}x${r.board.h}` : "no board",
        was ? `main ${was.w}x${was.h}` : "",
        r.tray && r.board ? `tray +${(r.board.y - r.tray.y).toFixed(0)}/+${(r.tray.y + r.tray.h - r.board.y - r.board.h).toFixed(0)}` : r.tray ? "tray" : "no tray",
        r.cut.length ? `CUT ${r.cut.join("; ")}` : "",
        r.smallDock.length ? `dock<52 ${r.smallDock.length}: ${r.smallDock.slice(0, 3).join("; ")}` : "",
        r.offScreen.length ? `OFF ${r.offScreen.slice(0, 2).join("; ")}` : "",
        problems.length ? `FAIL ${problems.join("; ")}` : "",
      ].filter(Boolean);
      console.log(`${game} ${key}: ${parts.join(" | ")}`);
    }
    if (main) rows.push(`| ${gameDisplayName(game)} | ${cells.join(" | ")} |`);
  }
} finally {
  await browser.close();
}
const json = opt("json");
if (json) writeFileSync(json, JSON.stringify(results, null, 1));
const record = opt("record");
if (record) writeFileSync(record, `${JSON.stringify(sizes, null, 1)}\n`);
const table = opt("table");
if (table && main)
  writeFileSync(table, ["| Game | 414×896 main | 414×896 branch | 375×667 main | 375×667 branch |", "|---|---|---|---|---|", ...rows, ""].join("\n"));
if (main) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(failures.length ? `FAIL: ${failures.length} problem(s)` : `PASS: ${games.length} puzzles at 414x896 and 375x667: every board at least main's width and height, every tray within ${TRAY_GAP_MAX}px of its board above and below, no cut header or goal-line text`);
  if (failures.length) process.exitCode = 1;
}
