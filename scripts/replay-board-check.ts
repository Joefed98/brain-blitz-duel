/**
 * replay-board-check (23 Oct 2026, Prompt D; display only): a puzzle round's replay on the room's
 * results screen shows the real board.
 *
 * The bug it guards: the time-lapse's FitHeight box had no width inside its centred column, so it
 * scaled every board to 0 px and the panel showed only its move counter over an empty card.
 *
 * Through scripts/safe-area-harness.tsx (the real room route at its results screen, network stubbed;
 * roundReplayFn serves the closed round) as an iPhone 11 home-screen app (414 × 848 laid out, 48 / 34 px
 * insets), for every puzzle type in scripts/fixtures/puzzle-score-legacy.json.gz (45 puzzle types, stored
 * answers recorded on main: each type's best-scoring stored answer is the round winner's; its two engine
 * games, Tenfall and Mixed Signals, have the arcade highlight instead, replay-check's) plus a
 * Lightbender round on its timestamped action log (alogRev 1, built from the puzzle's own solution):
 *   - a time-lapse game (src/lib/replay/timelapse.ts) shows its panel with the game's own board at
 *     least 60 px each way, the board changes along the moves, the move counter reaches the last move,
 *     the stored score shows at the end, and it lasts at most about 8 s (8.5 s with timer slack);
 *     Lightbender's frames follow the log's own times;
 *   - every other puzzle shows the winner's real final board (at least 60 × 40 px) with
 *     "Replay not available for this game yet" and the stored score, never invented moves;
 *   - no page error, and Continue stays on screen.
 *
 *   bun scripts/replay-board-check.ts [types…] [--verbose] [--shots=<dir>]
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { Browser, Page } from "playwright";

import { startSafeAreaServer } from "./safe-area-server";
import { DEVICE_INIT, IPHONE11_APP } from "./device-emulation";
import { warmUp } from "./browser-load";
import { ONBOARDING_KEY } from "../src/lib/onboarding";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { encodeActionLog } from "../src/lib/duel/actionLog";
import { laserAction } from "../src/lib/duel/laserLog";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { GRID_GAMES, gridRoomPuzzle, gridSolvedAnswer } from "./grid-puzzles-lib";
import { canTimelapse, planTimelapse, TIMELAPSE_CAP_MS } from "../src/lib/replay/timelapse";
import { canReplay } from "../src/lib/replay/steppers";
import type { LaserPuzzleData, PuzzleData } from "../src/lib/duel/types";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const SHOTS = args.find((a) => a.startsWith("--shots="))?.slice(8);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const named = args.filter((a) => !a.startsWith("--"));
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

interface Case {
  key: string;
  puzzle: PuzzleData;
  answer: string;
  isCorrect: boolean;
  score: number;
}

const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/puzzle-score-legacy.json.gz")).toString("utf8")) as {
  cases: { type: string; label: string; puzzle: PuzzleData; entries: { answer: string; ms: number; score: number; isCorrect?: boolean }[] }[];
};
const cases: Case[] = [];
const seen = new Set<string>();
for (const c of legacy.cases) {
  if (seen.has(c.type) || (named.length && !named.includes(c.type))) continue;
  const best = c.entries.filter((e) => e.answer && e.answer.length > 0).sort((a, b) => b.score - a.score)[0];
  if (!best || !best.score || canReplay(c.type as never)) continue;
  seen.add(c.type);
  cases.push({ key: c.type, puzzle: c.puzzle, answer: best.answer, isCorrect: best.isCorrect ?? best.score >= 100, score: best.score });
}
// Lightbender on its action log: each solution piece placed a few seconds apart, then FIRE.
if (!named.length || named.includes("laser")) {
  const laser = withSeededRandom(41, () => generatePuzzle("laser")) as LaserPuzzleData;
  let t = 1200;
  const actions = (laser.solution ?? []).map((m, i) => ({ a: laserAction.place(m.cell, m.kind), t: (t += 900 + (i % 3) * 1700) }));
  actions.push({ a: laserAction.fire(), t: t + 2500 });
  cases.push({ key: "laser (action log)", puzzle: laser, answer: encodeActionLog(actions), isCorrect: true, score: 141 });
}

// The four grid puzzles born on the standard (1 Nov 2026): a finished room round of each (seeded deal, the solved board
// as the phone sends it); no stored rounds of them exist yet, so they are built here.
for (const type of GRID_GAMES) {
  if (named.length && !named.includes(type)) continue;
  const puzzle = gridRoomPuzzle(type, 6100);
  cases.push({ key: type, puzzle, answer: gridSolvedAnswer(puzzle), isCorrect: true, score: 180 });
}

const iso = (ms: number) => new Date(ms).toISOString();
function roomFor(c: Case) {
  const now = Date.now();
  const pub = splitPuzzle(c.puzzle).pub as PuzzleData;
  const players = ["Ana", "Bo"].map((name, i) => ({
    id: `p${i + 1}`,
    duel_id: "duel-replay",
    player_slot: i + 1,
    display_name: name,
    user_id: `u${i + 1}`,
    ready_round: 0,
    intro_ready_round: 2,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: iso(now),
    status: "active",
    joined_at: iso(now - 60_000),
  }));
  const result = (slot: number, score: number) => ({
    id: `r${slot}`,
    duel_id: "duel-replay",
    player_slot: slot,
    round_number: 2,
    answer: slot === 1 ? c.answer : "",
    is_correct: slot === 1 ? c.isCorrect : false,
    ms_remaining: slot === 1 ? 20_000 : 0,
    reaction_avg_ms: null,
    correct_count: null,
    errors: null,
    extra: null,
    score,
    submitted_at: iso(now - 5_000),
  });
  return {
    duel: {
      id: "duel-replay",
      room_code: "SAFE",
      status: "in_progress",
      selected_categories: [],
      tournament_history: [],
      disbanded_at: null,
      host_user_id: "u1",
      max_players: 10,
      round_count: 6,
      round_order: Array.from({ length: 6 }, () => c.puzzle.type),
      no_maths: false,
      puzzles_public: Array.from({ length: 6 }, () => pub),
      current_round: 2,
      phase: "result",
      // Well ahead: the results screen stays up (and the highlight's time budget full) however long the page takes to load.
      phase_started_at: iso(now + 60_000),
      round_started_at: iso(now - 60_000),
      next_duel_id: null,
      created_at: iso(now - 120_000),
    },
    players,
    results: [result(1, c.score), result(2, Math.max(0, c.score - 30))],
  };
}

function replayFor(c: Case) {
  return {
    round: 2,
    puzzle: c.puzzle,
    winner: { slot: 1, name: "Ana", score: c.score, isCorrect: c.isCorrect, answer: c.answer, extra: null, reactionAvgMs: null, msRemaining: 20_000 },
    runnerUp: Math.max(0, c.score - 30),
    answered: 2,
  };
}

/** In-page: the panel's state every 100 ms. */
const WATCH = `(() => {
  const samples = [];
  window.__replaySamples = samples;
  const started = performance.now();
  const id = setInterval(() => {
    const panel = document.querySelector("[data-replay-panel]");
    const board = document.querySelector(".replay-board");
    let boardBox = null, inner = 0, html = "";
    if (board) {
      // What the board drew, as FitHeight judges it (leaves and painted boxes), inside the panel's clip.
      const clip = board.parentElement.parentElement.getBoundingClientRect();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const el of board.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden") continue;
        const painted = el.children.length === 0 || cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.borderTopWidth !== "0px" || el.tagName === "svg" || el.tagName === "CANVAS";
        if (!painted) continue;
        x0 = Math.min(x0, Math.max(r.left, clip.left)); y0 = Math.min(y0, Math.max(r.top, clip.top));
        x1 = Math.max(x1, Math.min(r.right, clip.right)); y1 = Math.max(y1, Math.min(r.bottom, clip.bottom));
        inner = Math.max(inner, Math.min(r.width, r.height));
      }
      if (Number.isFinite(x0) && x1 > x0 && y1 > y0) boardBox = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      // The board as drawn: its markup and letters, without the reveal's own lines (hidden in a time-lapse).
      const copy = board.cloneNode(true);
      copy.querySelectorAll("p").forEach((el) => el.remove());
      const shape = copy.innerHTML;
      let hash = 0;
      for (let i = 0; i < shape.length; i++) hash = (hash * 31 + shape.charCodeAt(i)) | 0;
      html = String(hash);
    }
    const lapse = document.querySelector("[data-timelapse]");
    const cont = [...document.querySelectorAll("button")].find((b) => /continue/i.test(b.textContent || ""));
    samples.push({
      t: performance.now() - started,
      panel: panel ? panel.getAttribute("data-replay-panel") : null,
      frame: lapse ? Number(lapse.getAttribute("data-timelapse-frame")) : null,
      counter: (document.querySelector("[data-timelapse-counter]") || document.querySelector("[data-replay-unavailable]") || {}).textContent || null,
      board: boardBox,
      inner,
      html,
      continueBottom: cont ? cont.getBoundingClientRect().bottom : null,
    });
    if (performance.now() - started > 14000) clearInterval(id);
  }, 100);
})();`;

interface Sample {
  t: number;
  panel: string | null;
  frame: number | null;
  counter: string | null;
  board: { x: number; y: number; w: number; h: number } | null;
  inner: number;
  html: string;
  continueBottom: number | null;
}

async function open(browser: Browser, origin: string, c: Case): Promise<{ page: Page; errors: string[]; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width: IPHONE11_APP.w, height: IPHONE11_APP.h }, hasTouch: true });
  await context.addInitScript(DEVICE_INIT);
  await context.addInitScript(
    ({ room, replay, onboarding }) => {
      (window as unknown as { __device: unknown }).__device = { standalone: true, w: 414, h: 896 };
      try {
        localStorage.setItem(onboarding, "1");
      } catch {
        /* ignore */
      }
      (window as unknown as { __harness: unknown }).__harness = { puzzles: {}, verdict: { isCorrect: true, score: 150 }, latencyMs: 50, submissions: [], verdictAt: null, room, replay };
    },
    { room: roomFor(c), replay: replayFor(c), onboarding: ONBOARDING_KEY },
  );
  await context.addInitScript(WATCH);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]!));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: { top: IPHONE11_APP.top, bottom: IPHONE11_APP.bottom, left: 0, right: 0 } } as never);
  await page.goto(`${origin}/safe-area.html?mode=room`, { timeout: 120_000 });
  return { page, errors, close: () => context.close() };
}

const failures: string[] = [];
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-replay-board", buildId: "replay-board-check" });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
let lapses = 0;
let finals = 0;
try {
  await warmUp(browser, `${server.origin}/safe-area.html?mode=home`, (p) => p.waitForSelector("#root *", { timeout: 120_000 }), {
    init: () => {
      (window as unknown as { __harness: unknown }).__harness = { puzzles: {}, verdict: { isCorrect: true, score: 0 }, latencyMs: 0, submissions: [], verdictAt: null, room: null };
    },
    verbose: VERBOSE,
  });
  // Two rounds at a time: each mostly waits on its own clock.
  const queue = [...cases];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const where = `${gameDisplayName(c.puzzle.type)} (${c.key})`;
      const fails: string[] = [];
      const plan = planTimelapse(c.puzzle, c.answer, c.isCorrect);
      const lapse = canTimelapse(c.puzzle.type) && plan !== null;
      const { page, errors, close } = await open(browser, server.origin, c);
      try {
        await page.waitForSelector("[data-replay-panel]", { timeout: 60_000 });
        const until = Math.min(9_000, lapse ? plan!.atMs[plan!.atMs.length - 1]! + plan!.frameMs + 1200 : 1500);
        // Mid-way (a time-lapse) or once drawn (a final board), a screenshot for review.
        const mid = lapse ? Math.round(until / 2) : until;
        await page.waitForTimeout(mid);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/replay-${c.key.replace(/\W+/g, "-")}-${lapse ? "midway" : "final"}-414x896.png` });
        if (lapse)
          await page
            .waitForFunction((n) => Number(document.querySelector("[data-timelapse]")?.getAttribute("data-timelapse-frame")) === n, plan!.frames.length - 1, { timeout: 15_000, polling: 100 })
            .then(() => page.waitForTimeout(300))
            .catch((error) => fails.push(`the last frame never showed (${String((error as Error).message).split("\n")[0]})`));
        else await page.waitForTimeout(until - mid);
        const samples = await page.evaluate(() => (window as unknown as { __replaySamples: Sample[] }).__replaySamples);
        const shown = samples.filter((s) => s.panel);
        if (!shown.length) fails.push("no replay panel");
        const first = shown[0];
        if (lapse) {
          lapses++;
          if (first?.panel !== "timelapse") fails.push(`panel ${first?.panel}, want the time-lapse`);
          const frames = shown.filter((s) => s.frame !== null);
          const last = frames[frames.length - 1];
          const big = frames.filter((s) => s.board && s.board.w >= 60 && s.board.h >= 60);
          if (big.length < frames.length * 0.9) fails.push(`the board is not drawn (${frames.length - big.length} of ${frames.length} samples under 60 px: ${JSON.stringify(frames[0]?.board)})`);
          if (new Set(frames.map((s) => s.html)).size < 2) fails.push("the board never changes along the moves");
          if (!last || last.frame !== plan!.frames.length - 1) fails.push(`ended on frame ${last?.frame}, want ${plan!.frames.length - 1}`);
          if (!last?.counter?.includes(`${c.score} pts`)) fails.push(`no stored score at the end ("${last?.counter}")`);
          const reached = frames.find((s) => s.frame === plan!.frames.length - 1);
          if (reached && frames[0] && reached.t - frames[0].t > TIMELAPSE_CAP_MS + 500) fails.push(`took ${Math.round(reached.t - frames[0].t)} ms (cap ${TIMELAPSE_CAP_MS})`);
          if (c.key.startsWith("laser") && !plan!.timed) fails.push("Lightbender's frames ignore the log's times");
        } else {
          finals++;
          if (first?.panel !== "final-board") fails.push(`panel ${first?.panel}, want the final board`);
          const s = shown[shown.length - 1];
          if (!s?.counter?.includes("No replay for this game yet")) fails.push(`no "not available" line ("${s?.counter}")`);
          if (!s?.counter?.includes(`${c.score} pts`)) fails.push("no stored score");
          // Some reveals are mostly lines (Exact's pool and value): drawn, at a readable size.
          if (!s?.board || s.board.w < 60 || s.board.h < 40) fails.push(`the final board is not drawn (${JSON.stringify(s?.board)}, inner ${s?.inner})`);
        }
        const cont = shown[shown.length - 1]?.continueBottom;
        if (cont !== null && cont !== undefined && cont > IPHONE11_APP.h + 0.5) fails.push(`Continue pushed off screen (${cont})`);
        for (const e of [...new Set(errors)]) fails.push(`page error: ${e}`);
        if (VERBOSE) {
          console.log(`  ${where}: ${first?.panel}, ${shown.length} samples, board ${JSON.stringify(shown[shown.length - 1]?.board)}`);
          console.log(`    frames: ${shown.map((x) => `${Math.round(x.t)}:${x.frame}`).join(" ")}`);
        }
      } catch (error) {
        fails.push(String((error as Error).message ?? error).split("\n")[0]!);
      } finally {
        await close();
      }
      for (const f of fails) failures.push(`${where}: ${f}`);
      console.log(`${fails.length ? "FAIL" : "PASS"} ${where}${fails.length ? `: ${fails[0]}` : ""}`);
    }
  };
  await Promise.all([worker(), worker()]);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.log(`FAIL: ${failures.length} problem(s) in ${cases.length} replays`);
  for (const f of failures.slice(0, 60)) console.log(`  ${f}`);
  process.exit(1);
}
console.log(`PASS: ${lapses} time-lapses play the real board to the stored score within about 8 s; ${finals} games without a move history show the real final board with "Replay not available for this game yet"`);
