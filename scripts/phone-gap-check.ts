/**
 * The phone gap (phase 2 step 4 pass 3, 15 Nov 2026; polish-layout/game-fx.css "2d. phones: no dead band"): on a tall
 * phone a puzzle's board and its controls sit together at the bottom, in thumb reach, with no dead band between them.
 * Headless Chromium, practice rounds of grid, word keypad, number pad and drag games, each drawn at 360×780, 375×812,
 * 390×844 and 430×932 (touch). Fails unless, for each game and size:
 *  - the board (its tray, GameFrame useBoardTray) is placed, inside the game region, and never under the controls;
 *  - between the board's foot and the first control block below it, no empty band is taller than 24 px (the stage's
 *    own 12 px gap and the tray's 10 px padding; status lines and key strips between them are not empty);
 *  - the lowest control ends within 40 px of the screen's bottom (in thumb reach; bottom-clearance-check keeps its
 *    12 px floor), or, in a game with no controls below its board, the board (or a status row under it) does;
 *  - the empty band above the board is the one that takes the spare height: the band under the board is never the
 *    larger one by more than 24 px.
 *
 *   bun scripts/phone-gap-check.ts [game ids…]
 */
import { existsSync } from "node:fs";
import type { Browser } from "playwright";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS, fixThemeClock, openThemeScreen } from "./theme-screens";

/** Grid, word keypad, number pad, drag, and two with no controls below the board. */
const GAMES = [
  "sudoku",
  "unblock",
  "kakuro",
  "fillomino",
  "codeword",
  "strikeout",
  "wordslide",
  "equation",
  "numpyramid",
  "checkout",
  "tubes",
  "tilegrid",
  "flood",
  "nonogram",
  "flow",
];
const SIZES: [number, number][] = [
  [360, 780],
  [375, 812],
  [390, 844],
  [430, 932],
];
const MAX_BAND = 24;
const MAX_FOOT = 40;

const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const games = only.length ? only : GAMES;
const CHROMIUM = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

interface Seen {
  region: { top: number; bottom: number } | null;
  tray: { top: number; bottom: number } | null;
  dockTop: number | null;
  dockBottom: number | null;
  /** The foot of the lowest thing drawn in the stage (a status row under a board with no controls). */
  stageFoot: number | null;
  /** The largest empty band between the board's foot and the dock. */
  band: number;
  inner: number;
}

function probe(): Seen {
  const rect = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
  const region = rect(document.querySelector("[data-game-region]"));
  const tray = rect(document.querySelector("[data-game-tray][data-placed]"));
  const controls = [...document.querySelectorAll("[data-game-stage] [data-game-controls]")]
    .map((e) => e.getBoundingClientRect())
    .filter((b) => b.height > 0 && b.width > 0);
  const below = tray ? controls.filter((b) => b.top >= tray.bottom - 2) : controls;
  const dockTop = below.length ? Math.min(...below.map((b) => b.top)) : null;
  const dockBottom = below.length ? Math.max(...below.map((b) => b.bottom)) : null;
  const drawn = [...document.querySelectorAll<HTMLElement>("[data-game-stage] *")]
    .filter((el) => {
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0;
    })
    .map((el) => el.getBoundingClientRect())
    .filter((b) => b.height > 0 && b.width > 0);
  const stageFoot = drawn.length ? Math.max(...drawn.map((b) => b.bottom)) : null;
  let band = 0;
  if (tray && dockTop !== null) {
    // Every visible thing in the stage between the board's foot and the dock fills its rows; the band is the largest
    // run of rows nothing covers.
    const spans = [...document.querySelectorAll<HTMLElement>("[data-game-stage] *")]
      .filter((el) => {
        const s = getComputedStyle(el);
        return (
          s.visibility !== "hidden" &&
          s.display !== "none" &&
          Number(s.opacity) > 0 &&
          !el.querySelector("[data-game-controls]")
        );
      })
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.height > 0 && b.width > 0 && b.bottom > tray.bottom && b.top < dockTop)
      .map((b) => [Math.max(b.top, tray.bottom), Math.min(b.bottom, dockTop)] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    let at = tray.bottom;
    for (const [top, bottom] of spans) {
      if (top > at) band = Math.max(band, top - at);
      at = Math.max(at, bottom);
    }
    band = Math.max(band, dockTop - at);
  }
  return {
    region: region ? { top: region.top, bottom: region.bottom } : null,
    tray: tray ? { top: tray.top, bottom: tray.bottom } : null,
    dockTop,
    dockBottom,
    stageFoot,
    band,
    inner: innerHeight,
  };
}

const failures: string[] = [];
const rows: string[] = [];
let proofs = 0;
const server = await startSafeAreaServer({
  cacheDir: "node_modules/.vite-phone-gap",
  buildId: "phone-gap-check",
});
fixThemeClock();
const { chromium } = await import("playwright");
const browser: Browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const game of games) {
    const pub = splitPuzzle(withSeededRandom(41, () => generatePuzzle(game as never))).pub;
    // One page a game, opened at the first size and resized through the rest (the layout is CSS and resize observers,
    // so a resize draws what a fresh open at that size does).
    const [w0, h0] = SIZES[0]!;
    const { context, page } = await openThemeScreen(
      browser,
      server.origin,
      {
        name: game,
        mode: "practice",
        search: { page: game },
        plain: true,
        go: async (p) => {
          await p.locator("[data-game-page-play]").first().click({ timeout: 30_000 });
          await p.locator("[data-game-stage]").waitFor({ timeout: 30_000 });
          await p
            .locator("[data-game-tray][data-placed]")
            .waitFor({ state: "attached", timeout: 30_000 });
          await p.waitForTimeout(1500);
        },
      },
      { name: `${w0}x${h0}`, w: w0, h: h0, scale: 1 },
      async (ctx) => {
        await ctx.addInitScript(
          ([g, p]) => {
            let held: { puzzles?: Record<string, unknown> } | undefined;
            Object.defineProperty(window, "__harness", {
              configurable: true,
              get: () => held,
              set: (v) => {
                held = v;
                if (held?.puzzles) held.puzzles[g as string] = p;
              },
            });
          },
          [game, pub] as const,
        );
      },
    );
    for (const [w, h] of SIZES) {
      const where = `${game} at ${w}×${h}`;
      try {
        if (w !== w0 || h !== h0) {
          await page.setViewportSize({ width: w, height: h });
          await page.waitForTimeout(800);
        }
        const s = await page.evaluate(probe);
        if (!s.region || !s.tray) {
          failures.push(`${where}: no board placed`);
          continue;
        }
        if (s.tray.top < s.region.top - 0.5 || s.tray.bottom > s.region.bottom + 0.5)
          failures.push(`${where}: the board runs out of the game region`);
        const above = s.tray.top - s.region.top;
        if (s.dockTop !== null && s.dockBottom !== null) {
          if (s.tray.bottom > s.dockTop + 0.5)
            failures.push(`${where}: the board runs under the controls`);
          if (s.band > MAX_BAND)
            failures.push(
              `${where}: a ${s.band.toFixed(0)} px empty band between the board and the controls (at most ${MAX_BAND})`,
            );
          const foot = s.inner - s.dockBottom;
          if (foot > MAX_FOOT)
            failures.push(
              `${where}: the controls end ${foot.toFixed(0)} px above the bottom (at most ${MAX_FOOT}: thumb reach)`,
            );
          if (s.band > above + MAX_BAND)
            failures.push(
              `${where}: the spare height is under the board (${s.band.toFixed(0)} px) rather than above it (${above.toFixed(0)} px)`,
            );
          rows.push(
            `${where}: above ${above.toFixed(0)}, band ${s.band.toFixed(0)}, foot ${foot.toFixed(0)}`,
          );
        } else {
          const foot = s.inner - Math.max(s.tray.bottom, s.stageFoot ?? 0);
          if (foot > MAX_FOOT)
            failures.push(
              `${where}: no controls below, and the board ends ${foot.toFixed(0)} px above the bottom (at most ${MAX_FOOT})`,
            );
          rows.push(
            `${where}: above ${above.toFixed(0)}, no controls below, foot ${foot.toFixed(0)}`,
          );
        }
        proofs++;
      } catch (e) {
        failures.push(`${where}: harness: ${String((e as Error).message ?? e).split("\n")[0]}`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}

if (process.argv.includes("--report")) for (const r of rows) console.log(`  ${r}`);
if (failures.length) {
  for (const f of failures) console.log(`  ${f}`);
  console.log(`FAIL: phone-gap-check: ${failures.length} problem(s)`);
  process.exit(1);
}
console.log(
  `PASS: phone-gap-check: ${games.length} games × ${SIZES.length} phone sizes (${proofs} draws): the board and its controls together at the bottom, no empty band over ${MAX_BAND} px between them, the controls within ${MAX_FOOT} px of the bottom.`,
);
process.exit(0);
