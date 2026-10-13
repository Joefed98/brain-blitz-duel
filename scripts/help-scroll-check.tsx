/**
 * In-game "?" help sheets (13 Oct 2026): for every registered game, puzzles and
 * arcade, the sheet opened over the real round screen at 375 × 667 keeps its
 * close button fully on screen, and a sheet taller than the screen scrolls by
 * touch inside itself only: the page and the game behind never move, and the
 * game's touch-action none (html.game-lock and the arena) does not block it.
 *
 * No dev server: the app's real CSS is compiled from src/styles.css with the
 * Tailwind compiler, the real PhoneShell / GameLayout / PuzzleHelp markup is
 * rendered on the server, and headless Chromium plays touch scroll gestures
 * (CDP touch events through the input pipeline, which honour touch-action) on each sheet. One
 * extra case pads a sheet past the screen so the scroll path is always tested.
 *
 *   bun scripts/help-scroll-check.tsx            # every game
 *   bun scripts/help-scroll-check.tsx tower orbit
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { GameLayout, PhoneShell } from "../src/components/duel/PhoneShell";
import { PuzzleHelp, PuzzleHelpButton } from "../src/components/duel/PuzzleInstructions";
import { TimerBar } from "../src/components/duel/TimerBar";
import { PUZZLE_TYPES, puzzleDef } from "../src/lib/duel/registry";
import type { PuzzleType } from "../src/lib/duel/types";

const WIDTH = 375;
const HEIGHT = 667;
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const GAMES = (args.length ? args : PUZZLE_TYPES) as PuzzleType[];

const failures: string[] = [];
const fail = (message: string) => {
  failures.push(message);
  console.log(`FAIL ${message}`);
};

// Static: the sheet body is its own scroll container that the game screen's touch blockers exempt.
const css = readFileSync("src/styles.css", "utf8");
const source = readFileSync("src/components/duel/PuzzleInstructions.tsx", "utf8");
if (
  !/\.help-sheet-scroll \{[^}]*overflow-y: auto;[^}]*touch-action: pan-y;[^}]*overscroll-behavior: contain;/.test(
    css,
  )
)
  fail(
    "styles.css: .help-sheet-scroll must be overflow-y auto, touch-action pan-y, overscroll-behavior contain",
  );
if (!/data-help-scroll data-scrollable className="help-sheet-scroll/.test(source))
  fail("PuzzleHelp: the scrolling body must carry data-scrollable and help-sheet-scroll");
const shell = readFileSync("src/components/duel/PhoneShell.tsx", "utf8");
const noScroll = readFileSync("src/components/puzzles/noScroll.ts", "utf8");
if (!/closest\("\[data-scrollable\]"\)\) return/.test(shell))
  fail("PhoneShell's touchstart blocker no longer exempts [data-scrollable]");
if (!/closest\("\[data-scrollable\]"\)\) return/.test(noScroll))
  fail("useNoTouchScroll no longer exempts [data-scrollable]");

const CHROMIUM = [
  process.env.PLAYWRIGHT_CHROMIUM,
  "/opt/pw-browsers/chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((path): path is string => Boolean(path && existsSync(path)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

// The app's own CSS, compiled the way the Vite plugin does.
const { compile } = await import("@tailwindcss/node");
const { Scanner } = await import("@tailwindcss/oxide");
const compiler = await compile(css, { base: resolve("src"), onDependency: () => undefined });
const scanner = new Scanner({ sources: compiler.sources.map((s) => ({ ...s })) });
const builtCss = compiler.build(scanner.scan());

function screen(type: PuzzleType): string {
  return renderToStaticMarkup(
    <PhoneShell constrained gameScreen gameType={type}>
      <GameLayout
        label="PRACTICE"
        title={puzzleDef(type).name}
        help={<PuzzleHelpButton onClick={() => undefined} />}
        timer={<TimerBar msRemaining={30_000} totalMs={60_000} active />}
        overlay={<PuzzleHelp type={type} open onClose={() => undefined} />}
      >
        <div data-stage-column="2" className="flex min-h-0 flex-1 flex-col gap-2">
          <div
            data-play-area=""
            data-game-arena="board"
            className="puzzle-board flex-1 bg-card"
            style={{ touchAction: "none" }}
          />
          <div data-game-controls="actions" className="h-12 shrink-0" />
        </div>
      </GameLayout>
    </PhoneShell>,
  );
}

// Entrance animations (animate-phase-in…) would move the screen while it is measured.
const SETTLED =
  "*, *::before, *::after { animation: none !important; transition: none !important; }";

const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
let overflowing = 0;
let checked = 0;

interface Measure {
  close: { x: number; y: number; w: number; h: number } | null;
  scroller: {
    x: number;
    y: number;
    w: number;
    h: number;
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
  } | null;
  pageScroll: number;
  arenaTop: number;
  covered: boolean;
}
const measure = (): Promise<Measure> =>
  page.evaluate(() => {
    const rect = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height };
    };
    const scroller = document.querySelector<HTMLElement>("[data-help-scroll]");
    const arena = document.querySelector<HTMLElement>("[data-play-area]")!;
    const a = arena.getBoundingClientRect();
    const hit = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2);
    return {
      close: rect(document.querySelector("[data-help-close]")),
      scroller: scroller
        ? {
            ...rect(scroller)!,
            scrollTop: scroller.scrollTop,
            scrollHeight: scroller.scrollHeight,
            clientHeight: scroller.clientHeight,
          }
        : null,
      pageScroll: (document.scrollingElement?.scrollTop ?? 0) + window.scrollY,
      arenaTop: a.top,
      covered: Boolean(hit?.closest("[data-help-sheet]")),
    };
  });

const onScreen = (r: { x: number; y: number; w: number; h: number } | null) =>
  r !== null &&
  r.w >= 44 &&
  r.h >= 44 &&
  r.x >= 0 &&
  r.y >= 0 &&
  r.x + r.w <= WIDTH &&
  r.y + r.h <= HEIGHT;

async function run(type: PuzzleType, pad: boolean) {
  const tag = pad ? `${type} (padded past the screen)` : type;
  await page.setContent(
    `<!doctype html><html class="game-lock" data-game-locks="1"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${builtCss}</style><style>${SETTLED}</style></head><body class="game-lock">${screen(type)}</body></html>`,
  );
  if (pad)
    await page.evaluate(() => {
      const filler = document.createElement("div");
      filler.style.height = "1200px";
      document.querySelector("[data-help-scroll]")!.appendChild(filler);
    });
  const before = await measure();
  checked++;
  if (!before.scroller) return fail(`${tag}: no help sheet body`);
  if (!onScreen(before.close))
    return fail(`${tag}: close button not fully on screen (${JSON.stringify(before.close)})`);
  if (!before.covered) fail(`${tag}: the game behind the sheet still takes taps`);
  const s = before.scroller;
  if (s.y + s.h > HEIGHT + 0.5)
    fail(`${tag}: sheet runs off the bottom (${Math.round(s.y + s.h)} px)`);
  if (s.scrollHeight <= s.clientHeight + 1) {
    console.log(
      `ok   ${tag}: fits (${s.scrollHeight}/${s.clientHeight} px), close button on screen`,
    );
    return;
  }
  overflowing++;
  // A finger swipe up the sheet: real touch events through Chromium's input pipeline.
  const x = Math.round(s.x + s.w / 2);
  const from = Math.round(s.y + s.h * 0.8);
  const travel = Math.min(320, Math.round(s.h * 0.6));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: from, id: 1 }],
  });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: from - Math.round((travel * i) / 12), id: 1 }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(300);
  const after = await measure();
  if (!after.scroller || after.scroller.scrollTop <= 0)
    fail(
      `${tag}: overflowing sheet did not scroll by touch (${s.scrollHeight}/${s.clientHeight} px)`,
    );
  if (!onScreen(after.close)) fail(`${tag}: close button left the screen after scrolling`);
  if (after.pageScroll !== 0) fail(`${tag}: the page scrolled behind the sheet`);
  if (after.arenaTop !== before.arenaTop)
    fail(
      `${tag}: the game behind the sheet moved (${before.arenaTop} → ${after.arenaTop}; page ${after.pageScroll})`,
    );
  console.log(
    `ok   ${tag}: overflows (${s.scrollHeight}/${s.clientHeight} px), touch scroll moved it ${Math.round(after.scroller?.scrollTop ?? 0)} px, close button on screen, page and game still`,
  );
}

try {
  for (const type of GAMES) await run(type, false);
  await run(GAMES[0]!, true);
} finally {
  await browser.close();
}

if (overflowing === 0) fail("no sheet overflowed: the scroll path was never exercised");
if (failures.length) {
  console.log(`FAIL: ${failures.length} help-sheet problem(s)`);
  process.exit(1);
}
console.log(
  `PASS: ${checked} help sheets at ${WIDTH}×${HEIGHT} (${GAMES.length} games + 1 padded): close button always on screen, ${overflowing} overflowing sheet(s) scroll by touch inside the sheet only`,
);
