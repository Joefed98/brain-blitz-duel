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
 * It also proves the governor (it judges each frame's own work, not the gap between frames):
 *  - its decision (workRunsLong) on synthetic frames: never with quick frames at 30, 60, 90 or 120 Hz,
 *    never on stalls over STALL_MS, only after WINDOW_MS of mostly slow frames, never on too few frames;
 *  - at normal speed in Chromium a run never switches reduced effects on: plain, with
 *    requestAnimationFrame capped at 30 Hz (iPhone Low Power Mode, Android battery savers), and
 *    with one injected 500 ms main-thread stall;
 *  - every arcade-stage canvas sizes its backing store through arcadeCanvasRatio (source scan), so
 *    reduced effects reach every game.
 *
 * A CI runner can itself run short of CPU for a few seconds (a 2-core VM shared with the dev server,
 * this script and whatever else the runner does); the page's frames then really do take over
 * SLOW_WORK_MS and the governor rightly steps down. So the normal-speed proofs also read, from Linux's
 * /proc, the CPU that every process outside the browser used (arcade-perf.ts procCpu: none of the
 * page's work is in it). A step down is put down to the runner only when, through the governor's
 * judging window before it, those other processes left the browser less than BROWSER_CORES of the
 * machine's cores (runnerShortOfCpu, proved on synthetic samples below). Such a case is printed with
 * the evidence and played once more, and that second play must keep full effects whatever the runner
 * did; a step down on a machine with CPU to spare fails at once, as before.
 *
 *   bun scripts/arcade-lowend-check.ts                   # the heavy games at 4×
 *   bun scripts/arcade-lowend-check.ts swing tilt        # only these
 *   bun scripts/arcade-lowend-check.ts --rate=6          # another slowdown (reported against the same floor)
 *   bun scripts/arcade-lowend-check.ts --url=http://127.0.0.1:5174
 *
 * Needs the pre-installed Chromium (/opt/pw-browsers/chromium, or PLAYWRIGHT_CHROMIUM).
 */
import { existsSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";

import { MIN_FRAMES, SETTLE_MS, SLOW_SHARE, SLOW_WORK_MS, STALL_MS, WINDOW_MS, workRunsLong, type FrameWork } from "../src/lib/fx/lowEnd";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { warmUp } from "./browser-load";
import { measure, startServer, type StepDown } from "./arcade-perf";
import { showPracticeSide } from "./practice-side-lib";

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
/** The normal-speed proofs: a game played unthrottled (plain, 30 Hz, one stall) must never switch reduced effects on. */
const FAST_GAME = "tilt";
const MIN_FPS = 30;
/** The browser was short of CPU when other processes left it less than this many cores (it runs on about one). */
const BROWSER_CORES = 1.25;

const args = process.argv.slice(2);
const RATE = Number(args.find((a) => a.startsWith("--rate="))?.slice(7) ?? 4);
const URL_ARG = args.find((a) => a.startsWith("--url="))?.slice(6);
const ONLY = args.filter((a) => !a.startsWith("--"));
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 5185;

const problems: string[] = [];
const fail = (msg: string) => problems.push(msg);

/** Frames every `everyMs` from 0 to `ms` with the given work (or a function of the frame's start). */
function frames(ms: number, everyMs: number, work: number | ((at: number) => number)): FrameWork[] {
  const out: FrameWork[] = [];
  for (let at = 0; at <= ms; at += everyMs) out.push({ at, workMs: typeof work === "number" ? work : work(at) });
  return out;
}
const decide = (f: FrameWork[]) => workRunsLong(f, f[f.length - 1]!.at);

/**
 * Whether a step down came while the machine itself was short of CPU: through the governor's judging
 * window (the WINDOW_MS before the step down) processes outside the browser used so much CPU that
 * less than BROWSER_CORES of the machine's `cores` were left.
 */
export function runnerShortOfCpu(step: StepDown, cores = availableParallelism()): { short: boolean; why: string } {
  const inWindow = step.probe.filter(([at]) => at >= step.at - WINDOW_MS - 150 && at <= step.at + 150);
  if (inWindow.length < 2) return { short: false, why: "no CPU readings around the step down" };
  const [t0, c0] = inWindow[0]!;
  const [t1, c1] = inWindow.at(-1)!;
  const others = (c1 - c0) / Math.max(0.001, (t1 - t0) / 1000);
  const left = cores - others;
  return { short: left < BROWSER_CORES, why: `other processes used ${others.toFixed(2)} of ${cores} cores in the ${WINDOW_MS} ms before the step down, leaving the browser ${left.toFixed(2)}` };
}

function probeProofs(): void {
  // CPU-seconds used by others, read every 100 ms, at a steady `cores` of use, for a step down at 5000.
  const readings = (use: (at: number) => number): StepDown => {
    const probe: [number, number][] = [];
    let total = 0;
    for (let at = 5000 - WINDOW_MS - SETTLE_MS; at <= 5000; at += 100) {
      probe.push([at, total]);
      total += use(at) * 0.1;
    }
    return { at: 5000, probe };
  };
  if (runnerShortOfCpu(readings(() => 0.1), 2).short) fail("probe: a quiet 2-core runner read as short of CPU");
  if (runnerShortOfCpu(readings(() => 0.6), 2).short) fail("probe: a 2-core runner leaving 1.4 cores read as short of CPU");
  if (!runnerShortOfCpu(readings(() => 1.2), 2).short) fail("probe: a 2-core runner with 1.2 cores busy elsewhere not read as short of CPU");
  if (runnerShortOfCpu(readings(() => 2), 4).short) fail("probe: a 4-core machine leaving 2 cores read as short of CPU");
  // Only the WINDOW_MS that decided counts: a busy spell in the settle before it is not enough.
  if (runnerShortOfCpu(readings((at) => (at < 5000 - WINDOW_MS ? 2 : 0.1)), 2).short) fail("probe: a busy spell before the judging window read as short of CPU");
  if (runnerShortOfCpu({ at: 5000, probe: [] }, 2).short) fail("probe: no readings (no /proc) read as short of CPU");
}

function decisionProofs(): void {
  // Quick frames never step down, whatever the screen's rate: 30 Hz (Low Power Mode, battery savers), 60, 90, 120.
  for (const [hz, every] of [[30, 33.3], [60, 16.7], [90, 11.1], [120, 8.3]] as const)
    if (decide(frames(5000, every, 8))) fail(`governor: steps down at ${hz} Hz with 8 ms of work a frame`);
  // A 30 Hz screen whose frames take 18 ms (under SLOW_WORK_MS) is still not slow.
  if (decide(frames(5000, 33.3, SLOW_WORK_MS - 2))) fail("governor: steps down on a 30 Hz screen with work under the limit");
  // Stalls: one 500 ms frame, and a stall every half second, are ignored.
  if (decide(frames(5000, 16.7, (at) => (Math.abs(at - 2000) < 8 ? 500 : 8)))) fail("governor: steps down on one 500 ms stall");
  if (decide(frames(5000, 16.7, (at) => (at % 500 < 16.7 ? STALL_MS + 50 : 8)))) fail("governor: steps down on repeated stalls over STALL_MS");
  // Slow work must persist for the whole window.
  if (decide(frames(WINDOW_MS - 100, 33.3, 40))) fail("governor: steps down before WINDOW_MS of slow work");
  if (!decide(frames(WINDOW_MS + 100, 33.3, 40))) fail("governor: does not step down after WINDOW_MS of 40 ms frames");
  if (!decide(frames(WINDOW_MS + 100, 50, SLOW_WORK_MS + 1))) fail(`governor: does not step down at a sustained ${SLOW_WORK_MS + 1} ms of work`);
  // Mostly quick with some slow frames (under SLOW_SHARE) is not sustained.
  if (decide(frames(5000, 16.7, (at) => (Math.floor(at / 16.7) % 2 ? 30 : 8)))) fail("governor: steps down with half its frames slow");
  // Too few frames to judge (a frozen tab coming back, a page that barely draws).
  if (decide(frames(WINDOW_MS + 100, 150, 40))) fail("governor: steps down on fewer than MIN_FRAMES frames");
  if (MIN_FRAMES > 20 || SLOW_SHARE < 0.5 || SETTLE_MS < 1000) fail("governor: thresholds moved below the documented rule");
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
  probeProofs();
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
    await warmUp(browser, `${origin}/practice`, (page) => showPracticeSide(page, FAST_GAME, 180_000).then(() => page.getByRole("button", { name: gameDisplayName(FAST_GAME as never), exact: true }).first().waitFor({ timeout: 180_000 })));
    // Normal speed must never switch reduced effects on: plain, on a screen capped at 30 Hz, and with one 500 ms stall.
    for (const [what, extra] of [
      ["unthrottled", {}],
      ["30 Hz screen", { raf30: true }],
      ["one 500 ms stall", { stallMs: 500 }],
    ] as const) {
      // A second play only when the first step down came while the runner itself was short of CPU.
      for (let attempt = 1; attempt <= 2; attempt++) {
        const r = await measure(browser, origin, FAST_GAME, 1, { width: 390, height: 844, dpr: 1, seconds: 5, stallProbe: true, ...extra });
        const runner = r.reduced && r.stepDown ? runnerShortOfCpu(r.stepDown) : null;
        const retry = attempt === 1 && runner?.short === true;
        console.log(`${!r.reduced ? "ok  " : retry ? "note" : "FAIL"} ${FAST_GAME.padEnd(10)} 1× ${what.padEnd(17)} ${r.frameMs.toFixed(1).padStart(5)} ms ${r.fps.toFixed(1).padStart(5)} fps · work median ${r.workMedianMs.toFixed(1)} ms, max ${r.workMaxMs.toFixed(0)} ms · reduced effects ${r.reduced ?? "off"} · others used ${r.otherCores?.toFixed(2) ?? "-"} cores${runner ? ` · ${runner.why}` : ""}`);
        if (retry) {
          console.log(`     the runner was short of CPU when the governor stepped down; playing this case once more, which must keep full effects`);
          continue;
        }
        if (r.reduced) fail(`${FAST_GAME} at normal speed (${what}${attempt === 2 ? ", second play after a runner stall" : ""}): reduced effects switched on (level ${r.reduced})${runner ? `; ${runner.why}` : ""}`);
        if (r.frames < 60) fail(`${FAST_GAME} at normal speed (${what}): only ${r.frames} frames measured`);
        break;
      }
    }
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
  console.log(`Arcade low-end: ${games.length} heavy games at ${RATE}× held ${MIN_FPS} fps or better; at normal speed (plain, 30 Hz screen, one 500 ms stall) reduced effects never switched on`);
}

await main();
