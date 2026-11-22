/**
 * The goal line is never cut short (22 Nov 2026; GameFrame's GoalLine, polish-layout/game-frame.css "the goal line").
 * The goal reads at 19 px since the Word and Number look (#458), which ran 20 goals past their row with an "…" at
 * 375 × 667 or 390 × 844 (Integer Pyramid, Kakuro, Trail, Counterweight, Measure, Number Line, Regions…). GoalLine now
 * steps a goal too long for its row down to 17 px, then 15 px (`data-fit`), and Integer Pyramid's and Trail's goals were
 * shortened because they ran past even at 15 px.
 *
 * Headless Chromium, the practice round of every active puzzle with a goal line, at 375×667 and 390×844 (touch). Fails
 * unless, wherever the goal line is shown (the phone status panel hides it where it carries the goal itself):
 *  - the goal's text is no wider than its box (no "…");
 *  - the goal sits inside the row, and the progress beside it ends inside the row too;
 *  - a goal that fits at 19 px keeps 19 px (`data-fit` only when it is needed).
 *
 *   bun scripts/goal-line-check.ts [game ids…] [--part=k/n] [--report]
 *
 * In halves on CI (~3 min each with its dev server), both on play17.
 */
import { existsSync } from "node:fs";
import type { Browser, Page } from "playwright";

import { ACTIVE_PUZZLE_TYPES, PUZZLE_CATALOGUE } from "../src/lib/duel/catalogue";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import type { PuzzleType } from "../src/lib/duel/types";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS, fixThemeClock, openThemeScreen, partOf } from "./theme-screens";

/** The puzzles played on the arcade stage have no goal line (their play header is the arcade one). */
const NO_GOAL_LINE = new Set(["minesweeper", "whack", "tendrop", "clayshoot"]);
const SIZES: [number, number][] = [
  [375, 667],
  [390, 844],
];

const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const games = partOf(
  only.length ? only : ACTIVE_PUZZLE_TYPES.filter((t) => PUZZLE_CATALOGUE[t].category !== "arcade" && !NO_GOAL_LINE.has(t)),
  process.argv,
);
const CHROMIUM = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

interface Seen {
  name: string;
  line: boolean;
  shown: boolean;
  text: string;
  progress: string | null;
  scroll: number;
  client: number;
  fit: string | null;
  fontPx: number;
  /** Would the goal fit at 19 px with no step? (measured on a clone of the row without `data-fit`) */
  fitsAt19: boolean;
  textOut: boolean;
  progressOut: boolean;
}

function probe(): Seen {
  const row = document.querySelector<HTMLElement>("[data-puzzle-play] [data-goal-line] .game-goal-row");
  const text = row?.querySelector<HTMLElement>("[data-goal-text]") ?? null;
  if (!row || !text) {
    return { name: "", line: false, shown: false, text: "", progress: null, scroll: 0, client: 0, fit: null, fontPx: 0, fitsAt19: true, textOut: false, progressOut: false };
  }
  const prog = row.querySelector<HTMLElement>("[data-goal-progress]");
  const r = row.getBoundingClientRect();
  const t = text.getBoundingClientRect();
  const p = prog?.getBoundingClientRect();
  // The same row at full size, off screen: does its goal fit with no step?
  const clone = row.cloneNode(true) as HTMLElement;
  clone.removeAttribute("data-fit");
  clone.style.cssText = `position:fixed;left:-10000px;top:0;width:${r.width}px`;
  row.parentElement!.appendChild(clone);
  const cloneText = clone.querySelector<HTMLElement>("[data-goal-text]")!;
  const fitsAt19 = cloneText.scrollWidth <= cloneText.clientWidth;
  clone.remove();
  return {
    name: (document.querySelector("[data-frame-name]")?.textContent ?? "").trim(),
    line: true,
    shown: getComputedStyle(text).visibility !== "hidden",
    text: (text.textContent ?? "").trim(),
    progress: prog ? (prog.textContent ?? "").trim() : null,
    scroll: text.scrollWidth,
    client: text.clientWidth,
    fit: row.getAttribute("data-fit"),
    fontPx: Number.parseFloat(getComputedStyle(text).fontSize),
    fitsAt19,
    textOut: t.left < r.left - 0.5 || t.right > r.right + 0.5,
    progressOut: p ? p.left < r.left - 0.5 || p.right > r.right + 0.5 : false,
  };
}

const failures: string[] = [];
const rows: string[] = [];
let shown = 0;
let hidden = 0;
let stepped = 0;
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-goal-line", buildId: "goal-line-check" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser: Browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  // One context for every game (the app's modules stay in its cache): each game's dealt puzzle is ready in the harness,
  // and the game to open is read from sessionStorage as each page loads.
  const pubs = Object.fromEntries(games.map((g) => [g, splitPuzzle(withSeededRandom(41, () => generatePuzzle(g as never))).pub]));
  const [w0, h0] = SIZES[0]!;
  const open = async (p: Page) => {
    await p.locator("[data-game-page-play]").first().click({ timeout: 30_000 });
    await p.locator("[data-game-stage]").waitFor({ timeout: 30_000 });
    await p.locator("[data-puzzle-play] [data-goal-line]").waitFor({ state: "attached", timeout: 30_000 });
    await p.waitForTimeout(500);
  };
  const { context, page } = await openThemeScreen(
    browser,
    server.origin,
    { name: games[0]!, mode: "practice", search: { page: games[0]! }, plain: true, go: open, waitMs: 0 },
    { name: `${w0}x${h0}`, w: w0, h: h0, scale: 1 },
    async (ctx) => {
      await ctx.addInitScript(
        ([all, first]) => {
          const g = sessionStorage.getItem("goal-line-game") ?? (first as string);
          let held: { puzzles?: Record<string, unknown>; search?: Record<string, string> } | undefined;
          Object.defineProperty(window, "__harness", {
            configurable: true,
            get: () => held,
            set: (v) => {
              held = v;
              if (held?.puzzles) held.puzzles[g] = (all as Record<string, unknown>)[g];
              if (held) held.search = { page: g };
            },
          });
        },
        [pubs, games[0]] as const,
      );
    },
  );
  const url = page.url();
  for (const [i, game] of games.entries()) {
    try {
      if (i > 0) {
        await page.setViewportSize({ width: w0, height: h0 });
        await page.evaluate((g) => sessionStorage.setItem("goal-line-game", g), game);
        await page.goto(url, { timeout: 90_000 });
        await page.locator("[data-game-page]").first().waitFor({ timeout: 60_000 });
        await open(page);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
      }
    } catch (e) {
      failures.push(`${game}: harness: ${String((e as Error).message ?? e).split("\n")[0]}`);
      continue;
    }
    for (const [w, h] of SIZES) {
      const where = `${game} at ${w}×${h}`;
      try {
        if (w !== w0 || h !== h0) {
          await page.setViewportSize({ width: w, height: h });
          await page.waitForTimeout(400);
        }
        const s = await page.evaluate(probe);
        if (!s.line) {
          failures.push(`${where}: no goal line on the live round`);
          continue;
        }
        // The page that opened is this game's (the header names it).
        if (s.name !== gameDisplayName(game as PuzzleType)) failures.push(`${where}: opened "${s.name}", not ${gameDisplayName(game as PuzzleType)}`);
        if (s.text === "") failures.push(`${where}: no goal text`);
        if (!s.shown) {
          hidden++;
          rows.push(`${where}: goal line hidden (the phone status panel carries the goal)`);
          continue;
        }
        shown++;
        if (s.fit) stepped++;
        const beside = s.progress ? ` beside "${s.progress}"` : "";
        if (s.scroll > s.client) failures.push(`${where}: "${s.text}" is cut short (${s.scroll} px in ${s.client} px at ${s.fontPx} px${beside})`);
        if (s.textOut) failures.push(`${where}: the goal runs out of its row`);
        if (s.progressOut) failures.push(`${where}: the progress "${s.progress}" runs out of the row`);
        if (s.fit && s.fitsAt19) failures.push(`${where}: "${s.text}" stepped down (${s.fit}) though it fits at 19 px`);
        rows.push(`${where}: "${s.text}" ${s.fontPx} px${s.fit ? ` (${s.fit})` : ""}, ${s.client}/${s.scroll} px${beside}`);
      } catch (e) {
        failures.push(`${where}: harness: ${String((e as Error).message ?? e).split("\n")[0]}`);
      }
    }
  }
  await context.close();
} finally {
  await browser.close();
  await server.close();
}

if (process.argv.includes("--report")) for (const r of rows) console.log(`  ${r}`);
if (failures.length) {
  for (const f of failures) console.log(`  ${f}`);
  console.log(`FAIL: goal-line-check: ${failures.length} problem(s)`);
  process.exit(1);
}
console.log(
  `PASS: goal-line-check: ${games.length} games × ${SIZES.length} sizes: ${shown} goal lines shown, none cut short (${stepped} stepped down to fit, none needlessly); ${hidden} hidden under the phone status panel.`,
);
process.exit(0);
