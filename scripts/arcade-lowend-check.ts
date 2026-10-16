/**
 * Low-end arcade performance check (16 Oct 2026, presentation only).
 *
 * Plays the heaviest arcade-stage games in practice in headless Chromium at 390 × 844 with the CPU
 * slowed 4× (CDP Emulation.setCPUThrottlingRate, a low-end Android stand-in) and fails if any
 * averages under 30 fps over 8 s of measured live play (requestAnimationFrame gaps, as
 * arcade-play-check measures them; scripts/arcade-perf.ts is the same measurement as a tool).
 * The reduced-effects governor (src/lib/fx/lowEnd.ts) is left to adapt, as it would on a phone:
 * measuring starts after 4 s of live play (WARMUP_MS), once it has settled.
 *
 * It also proves the governor:
 *  - its decision (framesRunLong): never at 60, 90 or 120 fps, nor with an occasional hitch; only
 *    after a sustained run of long frames;
 *  - unthrottled, a run never switches reduced effects on (a fast phone never sees it);
 *  - every arcade-stage canvas sizes its backing store through arcadeCanvasRatio (source scan), so
 *    reduced effects reach every game.
 *
 *   bun scripts/arcade-lowend-check.ts                   # the heavy games at 4×
 *   bun scripts/arcade-lowend-check.ts swing tilt        # only these
 *   bun scripts/arcade-lowend-check.ts --rate=6          # another slowdown (reported against the same floor)
 *   bun scripts/arcade-lowend-check.ts --url=http://127.0.0.1:5174
 *
 * Needs the pre-installed Chromium (/opt/pw-browsers/chromium, or PLAYWRIGHT_CHROMIUM).
 */
import { existsSync, readFileSync } from "node:fs";

import { framesRunLong, SLOW_GAP_MS, WINDOW } from "../src/lib/fx/lowEnd";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { warmUp } from "./browser-load";
import { measure, startServer } from "./arcade-perf";

/**
 * The five heaviest games at 4× before this change (scripts/arcade-perf.ts, 390 × 844, DPR 1: Tilt 65 ms,
 * Ball Tracker 50, Ink Bridge 45, Grappler 40, Orbit 31); docs/arcade-lowend-oct-2026.md has every
 * game's before → after.
 */
export const LOWEND_HEAVY_GAMES = ["tilt", "balltrack", "inkbridge", "swing", "orbit"];
/**
 * Live play before measuring: the governor's settling time and two steps of judging, as a slow phone's
 * first round goes (later rounds start at the level the tab kept). Frames are judged after it.
 */
const WARMUP_MS = 4000;
/** The fast-phone proof: a game played unthrottled must never switch reduced effects on. */
const FAST_GAME = "tilt";
const MIN_FPS = 30;

const args = process.argv.slice(2);
const RATE = Number(args.find((a) => a.startsWith("--rate="))?.slice(7) ?? 4);
const URL_ARG = args.find((a) => a.startsWith("--url="))?.slice(6);
const ONLY = args.filter((a) => !a.startsWith("--"));
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 5185;

const problems: string[] = [];
const fail = (msg: string) => problems.push(msg);

function decisionProofs(): void {
  const steady = (gap: number, n = 120) => Array.from({ length: n }, () => gap);
  for (const [hz, gap] of [[60, 16.7], [90, 11.1], [120, 8.3]] as const)
    if (framesRunLong(steady(gap))) fail(`governor: steps down at a steady ${hz} fps`);
  // A hitch every fifth frame (a GC, a sprite cache) is 6 of 30: not sustained.
  if (framesRunLong(Array.from({ length: 90 }, (_, i) => (i % 5 === 0 ? 50 : 16.7)))) fail("governor: steps down on an occasional hitch");
  // One slow second at the start then 60 fps: the window has moved on.
  if (framesRunLong([...steady(40, 30), ...steady(16.7, WINDOW)])) fail("governor: still judges frames that have left its window");
  if (!framesRunLong(steady(33.3, WINDOW))) fail("governor: does not step down at a sustained 30 fps");
  if (!framesRunLong(steady(SLOW_GAP_MS + 1, WINDOW))) fail(`governor: does not step down at a sustained ${SLOW_GAP_MS + 1} ms a frame`);
  if (framesRunLong(steady(33.3, WINDOW - 1))) fail("governor: steps down before a full window");
}

/** Every arcade-stage canvas loop sizes its backing store through arcadeCanvasRatio. */
function sourceProofs(): void {
  const stages = ["ballTrack", "beat", "binToss", "breaker", "bubble", "bullseye", "clayShoot", "cross", "hover", "matchup", "pinball", "rally", "skyline", "slice", "snake", "snip", "tenDrop", "whack"];
  const files = [...stages.map((g) => `src/puzzles/${g}.tsx`), "src/components/puzzles/ArcadeCanvasStage.tsx"];
  for (const file of files) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    if (!src.includes("arcadeCanvasRatio()")) fail(`${file}: canvas not sized through arcadeCanvasRatio`);
    if (/devicePixelRatio/.test(src)) fail(`${file}: reads devicePixelRatio directly`);
  }
  const slot = readFileSync(new URL("../src/components/puzzles/ArcadeArenaSlot.tsx", import.meta.url), "utf8");
  if (!slot.includes("watchArcadeFrames()")) fail("ArcadeArenaSlot: does not watch frame gaps");
}

async function main() {
  decisionProofs();
  sourceProofs();
  if (!existsSync(CHROMIUM)) {
    console.log(`FAIL: environment: no Chromium at ${CHROMIUM} (set PLAYWRIGHT_CHROMIUM)`);
    process.exit(1);
  }
  const { chromium } = await import("playwright");
  const games = LOWEND_HEAVY_GAMES.filter((g) => ONLY.length === 0 || ONLY.includes(g));
  const { origin, proc } = await startServer(URL_ARG, PORT);
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  try {
    await warmUp(browser, `${origin}/practice`, (page) => page.getByRole("button", { name: gameDisplayName(FAST_GAME as never), exact: true }).first().waitFor({ timeout: 180_000 }));
    const fast = await measure(browser, origin, FAST_GAME, 1, { width: 390, height: 844, dpr: 1, seconds: 5 });
    console.log(`${FAST_GAME.padEnd(10)}  1× ${fast.frameMs.toFixed(1).padStart(5)} ms ${fast.fps.toFixed(1).padStart(5)} fps · reduced effects ${fast.reduced ?? "off"}`);
    if (fast.reduced) fail(`${FAST_GAME} unthrottled: reduced effects switched on (level ${fast.reduced})`);
    for (const game of games) {
      const r = await measure(browser, origin, game, RATE, { width: 390, height: 844, dpr: 1, seconds: 8, warmupMs: WARMUP_MS });
      const ok = r.fps >= MIN_FPS && r.frames >= 60;
      console.log(`${ok ? "ok  " : "FAIL"} ${game.padEnd(10)} ${RATE}× ${r.frameMs.toFixed(1).padStart(5)} ms ${r.fps.toFixed(1).padStart(5)} fps p95 ${r.p95Ms.toFixed(1)} · ${r.frames} frames ${r.runs} runs · ${r.canvases.join(", ")} · reduced effects ${r.reduced ?? "off"}`);
      if (r.frames < 60) fail(`${game} at ${RATE}×: only ${r.frames} frames of live play measured`);
      else if (r.fps < MIN_FPS) fail(`${game} at ${RATE}×: ${r.fps.toFixed(1)} fps (${r.frameMs.toFixed(1)} ms a frame), under ${MIN_FPS}`);
    }
  } catch (e) {
    fail(`harness: ${String((e as Error).message ?? e).split("\n")[0]}`);
  } finally {
    await browser.close();
    if (proc?.pid) try { process.kill(-proc.pid); } catch { /* gone */ }
  }
  if (problems.length) {
    for (const p of problems) console.log(`  ${p}`);
    console.log(`FAIL: arcade low-end: ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log(`Arcade low-end: ${games.length} heavy games at ${RATE}× held ${MIN_FPS} fps or better; the governor never stepped down unthrottled`);
}

await main();
