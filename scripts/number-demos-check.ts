/**
 * number-demos-check (the Number overhaul's intro demos, 15 Nov 2026): proves scripts/fixtures/number-demos.json, the
 * demos number-demos-record.ts recorded for the eight Number games and number-demos-save.ts saves.
 *
 *   bun scripts/number-demos-check.ts [game ...] [--no-browser] [--verbose]
 *
 *   1. Each demo's puzzle is, byte for byte, the public half of the intro example this tree deals (exampleFor: the code
 *      practiceGenerateFn runs with example: true, Normal).
 *   2. Its log is a puzzle demo on today's GAME_COLUMN_LAYOUT, carries NUMBER_DEMO_REV and, for the games the app keys
 *      by presentation, today's presentation, and passes the phone's own filter (puzzleInputDemoCompatible).
 *   3. gradeAnswer on the full example gives exactly the stored score, and the run finished.
 *   4. The stop rules (numberDemoPlays in introDemo.functions.ts): the fixture's demos play; a log without
 *      NUMBER_DEMO_REV, or an example below the game's minimum stamp, is stopped; other games are untouched; and every
 *      minimum stamp is the stamp the example deal carries today (a new Normal stamp fails here until its demo is
 *      re-recorded and the table moved on).
 *   5. In headless Chromium on its own Vite server, the log played over the game's real Stage the way the intro plays it
 *      (scripts/number-demos-mount.tsx) submits the stored answer (its draft timeline aside), and that answer grades
 *      to the stored score with the stored clock.
 *
 * A Number game with no demo in the fixture is printed as PENDING (its demo waits for its new Normal stamp), not failed.
 */
import { existsSync } from "node:fs";

import { puzzleInputDemoCompatible, puzzlePresentation, REVISED_PUZZLE_DEMOS } from "../src/components/puzzles/wordInput";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { NUMBER_DEMO_GAMES, NUMBER_DEMO_MIN_STAMPS, NUMBER_DEMO_REV, numberDemoPlays } from "../src/lib/duel/introDemo.functions";
import { GAME_COLUMN_LAYOUT, isPuzzleDemoLog, type PuzzleDemoLog } from "../src/lib/duel/puzzleDemo";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { splitTimeline } from "../src/lib/duel/standard/timeline";
import type { PuzzleData } from "../src/lib/duel/types";
import { readFixture, type NumberDemo } from "./number-demos-record";
import { canonical } from "./number-demos-save";
import { exampleFor } from "./shots/examples";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const BROWSER = !args.includes("--no-browser");
const named = args.filter((a) => !a.startsWith("--"));
const games = (named.length ? named : [...NUMBER_DEMO_GAMES]) as string[];

const failures: string[] = [];
const fail = (where: string, what: string) => failures.push(`${where}: ${what}`);
const demos = readFixture();
const pending = games.filter((g) => !demos[g]);
const present = games.filter((g) => demos[g]);
if (!present.length) fail("fixture", "no demos in scripts/fixtures/number-demos.json");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fullOf = new Map<string, any>();
for (const game of present) {
  const demo = demos[game]!;
  const full = exampleFor(game as never);
  fullOf.set(game, full);
  // 1. The example deal.
  const pub = splitPuzzle(full).pub as PuzzleData;
  if (JSON.stringify(pub) !== JSON.stringify(demo.puzzle)) fail(game, "the fixture's puzzle is not this tree's intro example (re-record: bun scripts/number-demos-record.ts " + game + ")");
  if (canonical(pub) !== canonical(demo.puzzle)) fail(game, "the fixture's puzzle differs from the example in content, not only key order");
  // 2. The log.
  const log = demo.log;
  if (!isPuzzleDemoLog(log)) fail(game, "the log is not a puzzle demo");
  if (log.layout !== GAME_COLUMN_LAYOUT) fail(game, `the log is on layout ${String(log.layout)}, not today's ${GAME_COLUMN_LAYOUT}`);
  if (log.numberDemoRev !== NUMBER_DEMO_REV) fail(game, "the log has no NUMBER_DEMO_REV");
  if (REVISED_PUZZLE_DEMOS.has(game) ? log.presentation !== puzzlePresentation(game) : log.presentation !== undefined) fail(game, `presentation ${String(log.presentation)}`);
  if (!puzzleInputDemoCompatible(game as never, log as PuzzleDemoLog)) fail(game, "the phone's demo filter refuses the log");
  if (log.w < 300 || log.h < 400) fail(game, `a small play area ${log.w} × ${log.h}`);
  const ts = log.actions.map((a) => a.t);
  if (ts.some((t, i) => i > 0 && t < ts[i - 1]!)) fail(game, "actions out of order");
  if (log.actions.some((a) => a.action !== "tap" && a.action !== "drag" && a.action !== "hold")) fail(game, "an action other than a touch");
  // 3. The grade.
  const graded = gradeAnswer(full, demo.answer, demo.msRemaining, demo.extra as never);
  if (graded.score !== demo.score) fail(game, `gradeAnswer gives ${graded.score}, the fixture ${demo.score}`);
  if (!graded.isCorrect || !demo.isCorrect) fail(game, "the run does not finish the example");
  if (VERBOSE) console.log(`${game}: ${log.actions.length} actions over ${(Math.max(...ts) / 1000).toFixed(1)} s, ${log.w} × ${log.h}, score ${demo.score}`);
}

// 4. The stop rules.
for (const game of NUMBER_DEMO_GAMES) {
  const full = fullOf.get(game) ?? exampleFor(game as never);
  const pub = splitPuzzle(full).pub as unknown as Record<string, unknown>;
  const stamp = NUMBER_DEMO_MIN_STAMPS[game];
  if (stamp && Number(pub[stamp.field] ?? 0) !== stamp.min)
    fail(`${game} stop rule`, `the example deals ${stamp.field} ${String(pub[stamp.field])} but the demos' minimum is ${stamp.min}: record the demo on the new Normal and move NUMBER_DEMO_MIN_STAMPS on`);
  const demo = demos[game];
  if (!demo) continue;
  if (!numberDemoPlays(game, { puzzle: demo.puzzle, input_log: demo.log })) fail(`${game} stop rule`, "the fixture's demo is stopped");
  const { numberDemoRev: _rev, ...older } = demo.log;
  if (numberDemoPlays(game, { puzzle: demo.puzzle, input_log: older })) fail(`${game} stop rule`, "a demo recorded before the overhaul (no NUMBER_DEMO_REV) plays");
  if (numberDemoPlays(game, { puzzle: demo.puzzle, input_log: { ...demo.log, numberDemoRev: NUMBER_DEMO_REV + 1 } })) fail(`${game} stop rule`, "a demo of another revision plays");
  if (stamp && numberDemoPlays(game, { puzzle: { ...demo.puzzle, [stamp.field]: stamp.min - 1 }, input_log: demo.log })) fail(`${game} stop rule`, `a demo on ${stamp.field} ${stamp.min - 1} plays`);
  if (numberDemoPlays(game, { puzzle: { ...demo.puzzle, type: "kakuro" === game ? "balance" : "kakuro" }, input_log: demo.log })) fail(`${game} stop rule`, "a demo of another game's puzzle plays");
}
const required: Record<string, [string, number]> = { balance: ["balanceRev", 4], equation: ["gapsRev", 2], checkout: ["checkoutRev", 3], kakuro: ["kakuroRev", 2] };
for (const [game, [field, min]] of Object.entries(required)) {
  const s = NUMBER_DEMO_MIN_STAMPS[game as (typeof NUMBER_DEMO_GAMES)[number]];
  if (!s || s.field !== field || s.min < min) fail(`${game} stop rule`, `must stop demos below ${field} ${min}`);
}
const anyGame = { puzzle: { type: "maze" }, input_log: { actions: [] } };
if (!numberDemoPlays("maze", anyGame)) fail("stop rule", "a game outside the Number overhaul is stopped");

// 5. The replay in a browser.
if (BROWSER && present.length) {
  const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p): p is string => Boolean(p && existsSync(p)));
  if (!CHROMIUM) fail("environment", "no Chromium (set PLAYWRIGHT_CHROMIUM)");
  else {
    const { startSafeAreaServer } = await import("./safe-area-server");
    const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-number-demos", buildId: "number-demos-check" });
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ executablePath: CHROMIUM });
    try {
      for (const game of present) {
        const demo: NumberDemo = demos[game]!;
        const context = await browser.newContext({ viewport: { width: demo.log.w + 20, height: demo.log.h + 20 }, hasTouch: true });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(String(e.message).split("\n")[0]!));
        try {
          await page.goto(`${server.origin}/safe-area.html?mode=home`, { timeout: 180_000 });
          await page.waitForSelector("#root *", { timeout: 180_000 }).catch(() => undefined);
          const last = Math.max(...demo.log.actions.map((a) => a.t));
          const played = (await page.evaluate(
            async ({ puzzle, log, timeoutMs }) => {
              const mount = (await import(/* @vite-ignore */ "/scripts/number-demos-mount.tsx")) as {
                playDemo: (p: unknown, l: unknown, t: number) => Promise<{ answer: string | null; ms: number }>;
              };
              return mount.playDemo(puzzle, log, timeoutMs);
            },
            { puzzle: demo.puzzle, log: demo.log, timeoutMs: last + 15_000 },
          )) as { answer: string | null; ms: number };
          if (played.answer === null) fail(game, "the demo played over the real Stage never submitted");
          else {
            const body = splitTimeline(played.answer).body;
            if (body !== splitTimeline(demo.answer).body) fail(game, `the demo submits ${JSON.stringify(body)}, the fixture ${JSON.stringify(splitTimeline(demo.answer).body)}`);
            const regraded = gradeAnswer(fullOf.get(game), played.answer, demo.msRemaining, demo.extra as never);
            if (regraded.score !== demo.score) fail(game, `the replayed answer grades ${regraded.score}, the fixture ${demo.score}`);
            if (VERBOSE) console.log(`${game}: replay submitted after ${(played.ms / 1000).toFixed(1)} s, score ${regraded.score}`);
          }
          for (const e of errors) fail(game, `page error: ${e}`);
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
      await server.close();
    }
  }
}

for (const g of pending) console.log(`PENDING ${g}: no demo yet (recorded once its new Normal stamp is in the tree)`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL: number-demos-check, ${failures.length} problem(s)`);
  process.exit(1);
}
console.log(`PASS: number-demos-check (${present.length} demo(s)${BROWSER ? ", replayed in Chromium" : ""}; ${pending.length} pending)`);
