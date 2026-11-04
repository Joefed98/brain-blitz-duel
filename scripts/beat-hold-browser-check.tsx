/**
 * The beat hold in a real browser (13 Oct 2026): headless Chromium at 390 × 700
 * runs the real practice screen and the real room screen (React, the app's CSS,
 * the real games and signature beat; scripts/beat-hold-harness.tsx), with only
 * the network edge stubbed: server functions, the room API, Supabase and the
 * room/chat hooks (a Vite plugin below swaps those modules). The stubbed server
 * grades each submission as the case says.
 *
 * Cases, in practice and in a room:
 * - solve (Box Six, graded correct): the board stays (practice) or stays bright
 *   with no Locked card (room) until the beat has finished, ~1.6 s after the
 *   solve and never past 2 s; the beat is drawn over the still board; then the
 *   reveal shows (practice) or the board dims as before (room);
 * - no-finish run of 120+ (Ballpark, 130): the same hold; in the room the run
 *   ends at the buzzer (msRemaining 0, the timeout path);
 * - unsolved (Box Six, graded wrong): no hold: the reveal (practice) or the dim
 *   and Locked card (room) follow the verdict at once, as before;
 * - practice, a tap during the hold goes to the reveal at once.
 * Every case also proves the submission left at the solve moment with the time
 * the screen measures there (phase start + prep + limit − solve time).
 *
 * Timing (3 Nov 2026): every deadline is measured on the page's fake clock (Playwright's
 * page.clock: Date, timers and animation frames), paused at the solve and stepped 20 ms at a
 * time, with the page left to render in real time between steps. Until then the windows were
 * wall-clock milliseconds, and four PRs (#241, #247, #243, #253) failed on a 2-core runner's
 * timing alone (submissions 156–177 ms against 150, a reveal 332 ms after the verdict against
 * 250). The ordering assertions are unchanged; the only wall-clock limit left is one generous
 * ceiling (REAL_SUBMIT_CEILING_MS, 1 s) that catches a grossly slow submission.
 *
 *   bun scripts/beat-hold-browser-check.tsx
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import {
  puzzleDef,
  puzzleDurationMs,
  puzzlePrepMs,
  puzzleTimeLimitMs,
} from "../src/lib/duel/registry";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { SIGNATURE_DELAY_MS, SIGNATURE_HOLD_MAX_MS, SIGNATURE_MS } from "../src/lib/fx/signature";
import { gotoRetried, warmUp } from "./browser-load";

const failures: string[] = [];
const ok = (cond: boolean, message: string) => {
  if (!cond) {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
};

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

/* ------------------------------------------------- the stubbed network edge */

const STUBBED = [
  /\/src\/lib\/.*\.functions\.ts$/,
  /\/src\/lib\/duel\/api\.ts$/,
  /\/src\/lib\/duel\/useDuel\.ts$/,
  /\/src\/lib\/duel\/useRoomChat\.ts$/,
  /\/src\/integrations\/supabase\/client\.ts$/,
];
const ROUTER_STUB = `
export const createFileRoute = () => (options) => ({
  options,
  useParams: () => ({ code: "BEAT" }),
  useSearch: () => ({}),
});
export const useNavigate = () => () => undefined;
export const useRouter = () => ({ navigate: () => undefined, invalidate: () => undefined });
export const Link = ({ children, to, ...rest }) => children;
`;
const START_STUB = `
const builder = () => new Proxy(() => undefined, { get: () => builder, apply: () => builder() });
export const createServerFn = builder;
export const createMiddleware = builder;
export const useServerFn = (fn) => fn;
`;

/** Each stubbed module keeps its export names; every export defers to window.__harness. */
function stubSource(file: string): string {
  const text = readFileSync(file, "utf8");
  const names = new Set<string>();
  const lines = [`const H = () => window.__harness;`];
  for (const m of text.matchAll(/^export\s+(?:async\s+)?(function|const|let|class)\s+(\w+)/gm)) {
    const [, kind, name] = m as unknown as [string, string, string];
    if (names.has(name)) continue;
    names.add(name);
    if (kind === "class") lines.push(`export class ${name} extends Error {}`);
    else if (name === "supabase")
      lines.push(
        `export const supabase = new Proxy({}, { get: (_t, k) => H().call(${JSON.stringify(file)}, "supabase", [])[k] });`,
      );
    else
      lines.push(
        `export function ${name}(...args) { return H().call(${JSON.stringify(file)}, ${JSON.stringify(name)}, args)(...args); }`,
      );
  }
  return lines.join("\n");
}

function harnessEdge(): Plugin {
  return {
    name: "beat-hold-edge",
    enforce: "pre",
    async resolveId(source, importer) {
      if (source === "@tanstack/react-router") return "\0stub-router";
      if (source === "@tanstack/react-start") return "\0stub-start";
      if (source.startsWith("\0")) return null;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (resolved && STUBBED.some((re) => re.test(resolved.id.split("?")[0]!)))
        return `\0stub:${resolved.id.split("?")[0]}`;
      return null;
    },
    load(id) {
      if (id === "\0stub-router") return ROUTER_STUB;
      if (id === "\0stub-start") return START_STUB;
      if (id.startsWith("\0stub:")) return stubSource(id.slice("\0stub:".length));
      return null;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/beat-hold.html")) return next();
        const html = await server.transformIndexHtml(
          req.url,
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/beat-hold-harness.tsx"></script></body></html>`,
        );
        res.setHeader("content-type", "text/html");
        res.end(html);
      });
    },
  };
}

const { createServer } = await import("vite");
const react = (await import("@vitejs/plugin-react")).default;
const tailwind = (await import("@tailwindcss/vite")).default;
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: "error",
  plugins: [harnessEdge(), react(), tailwind()],
  resolve: { alias: { "@": resolve("src") } },
  define: { __DUELZ_BUILD_ID__: JSON.stringify("beat-hold-check") },
  server: { host: "127.0.0.1", port: 0, hmr: false },
  optimizeDeps: { entries: ["scripts/beat-hold-harness.tsx"] },
  cacheDir: "node_modules/.vite-beat-hold",
});
await server.listen();
const address = server.httpServer!.address();
const origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

/* --------------------------------------------------------------- the cases */

const pub = (type: PuzzleType, seed: number) =>
  splitPuzzle(withSeededRandom(seed, () => generatePuzzle(type))).pub as PuzzleData;
const SOLVE = pub("sudoku", 41);
const NO_FINISH = pub("numline", 42);
/** A no-finish run above the beat's threshold: 130 of 150, scaled to Ballpark's own maximum (173 at 200; roundMax.ts). */
const NO_FINISH_SCORE = Math.round((130 * roundMaxFor("numline")) / 150);
const BEAT_END = SIGNATURE_DELAY_MS + SIGNATURE_MS;
/**
 * The 100 ms screen ticker and the 20 ms fake-clock step: how far a sample may sit from the exact
 * moment, in fake-clock ms (not affected by how fast the runner renders).
 */
const SLACK = 250;
/** One fake-clock step between samples. */
const STEP_MS = 20;
/**
 * How far the submission may land from the solve moment (and its msRemaining from the time
 * measured there), in fake-clock ms. Both stamps come from the page's own Date.now(), which is
 * paused at the solve, so a submission sent straight from onSubmit lands at 0 however slowly the
 * runner renders. A real regression (the submission held for the beat, or queued behind a timer)
 * shows up as a step or more, up to SIGNATURE_DELAY_MS (1,000 ms); 50 ms catches any of them.
 */
const SUBMIT_WINDOW_MS = 50;
/**
 * The one wall-clock limit: the stubbed server must see the submission within this long, in real
 * time, after onSubmit is called (fake clock paused). It includes this script's own polling round
 * trips, so it measures the runner as much as the page; only a grossly slow page should trip it. A
 * submission held behind a timer needs page time to pass and fails SUBMIT_WINDOW_MS instead. 300 ms
 * (2x the old 150 ms CI window) tripped at 337 ms on a busy 2-core runner (#254, room unsolved, the
 * fake-clock submission at 0 ms), so it is about 6.7x.
 */
const REAL_SUBMIT_CEILING_MS = 1000;

const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
// Compile the harness once, unmeasured, so the first case's load does not race the cold dev server.
await warmUp(
  browser,
  `${origin}/beat-hold.html?mode=practice`,
  (page) => page.waitForSelector("#root *", { timeout: 180_000 }),
  {
    init: () => {
      (window as unknown as { __harness: unknown }).__harness = {
        puzzles: {},
        verdict: { isCorrect: true, score: 150 },
        latencyMs: 50,
        submissions: [],
        verdictAt: null,
        room: null,
      };
    },
  },
);

interface Sample {
  t: number;
  board: boolean;
  dim: boolean;
  locked: boolean;
  beat: boolean;
}
interface Run {
  /** The solve moment (the Stage's own onSubmit call, or the buzzer), fake clock. */
  solveAt: number;
  /** Real (wall-clock) ms from the onSubmit call until the stubbed server held the submission; null on the buzzer path. */
  realSubmitMs: number | null;
  /** What the screen should have sent: phase start + prep + limit − solve time. */
  expectedMs: number;
  submissions: { at: number; msRemaining: number }[];
  verdictAt: number | null;
  samples: Sample[];
  /** When the board left (practice) or dimmed (room), from the solve; null if never. */
  releasedAt: number | null;
  /**
   * Tap case: when the page itself handled the tap (a capture pointerdown listener) and when the
   * board left the page (a MutationObserver), both from the solve on the page's own clock. A slow
   * runner can deliver the tap late; the reveal is judged from the tap's handling, not from 0.6 s.
   */
  tapHandledAt: number | null;
  boardGoneAt: number | null;
}

async function play(opts: {
  mode: "practice" | "room";
  puzzle: PuzzleData;
  verdict: { isCorrect: boolean; score: number };
  /** Room only: the run ends at the buzzer instead of the Stage's own submit. */
  buzzer?: boolean;
  /** Practice only: tap the screen this long after the solve. */
  tapAfter?: number;
}): Promise<Run> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 700 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  // The fake clock: flowing like the real one until the solve, then paused and stepped.
  await page.clock.install();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const type = opts.puzzle.type;
  const prep = puzzlePrepMs(opts.puzzle);
  const limit = puzzleTimeLimitMs(opts.puzzle);
  const now = Date.now();
  // Room: the round has been running for a while; a buzzer case ends it 1.5 s from now.
  const phaseStart = opts.buzzer ? now - puzzleDurationMs(opts.puzzle) + 1500 : now - prep - 2000;
  const iso = (ms: number) => new Date(ms).toISOString();
  const player = (slot: number) => ({
    id: `p${slot}`,
    duel_id: "duel-beat",
    player_slot: slot,
    display_name: slot === 1 ? "Me" : "Them",
    user_id: `u${slot}`,
    ready_round: 1,
    intro_ready_round: 1,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: iso(now),
    status: "active",
    joined_at: iso(now - 60_000),
  });
  await page.addInitScript(
    (h) => {
      (window as unknown as { __harness: unknown }).__harness = h;
    },
    {
      puzzles: { [type]: opts.puzzle },
      verdict: opts.verdict,
      latencyMs: 150,
      submissions: [],
      verdictAt: null,
      room:
        opts.mode === "room"
          ? {
              duel: {
                id: "duel-beat",
                room_code: "BEAT",
                status: "in_progress",
                selected_categories: [],
                tournament_history: [],
                disbanded_at: null,
                host_user_id: "u1",
                max_players: 10,
                round_count: 3,
                round_order: [type, type, type],
                no_maths: false,
                puzzles_public: [opts.puzzle, opts.puzzle, opts.puzzle],
                current_round: 1,
                phase: "puzzle",
                phase_started_at: iso(phaseStart),
                round_started_at: iso(phaseStart),
                next_duel_id: null,
                created_at: iso(now - 60_000),
              },
              players: [player(1), player(2)],
              results: [],
            }
          : null,
    },
  );
  await gotoRetried(page, `${origin}/beat-hold.html?mode=${opts.mode}`, `${opts.mode} ${type}`);

  if (opts.mode === "practice") {
    await page.getByRole("button", { name: puzzleDef(type).name, exact: true }).click();
    await page.getByRole("button", { name: "Ready", exact: true }).click({ timeout: 20_000 });
  }
  await page.waitForSelector("[data-game-stage]", { timeout: 30_000 });
  await page.waitForTimeout(700);
  // Pause the page's clock: from here on, page time moves only by the steps below.
  // A little ahead, so the page clock (still flowing) has not passed it; pauseAt jumps there and stops.
  // On a very slow runner the round trip can outrun the margin: read the clock again with a bigger one.
  for (let margin = 250; ; margin *= 4) {
    const pageNow = await page.evaluate(() => Date.now());
    try {
      await page.clock.pauseAt(pageNow + margin);
      break;
    } catch (e) {
      if (margin > 60_000 || !String(e).includes("to the past")) throw e;
    }
  }
  /** Let React, the stubbed server's promises and effects run in real time, with page time still. */
  const settle = () =>
    page.evaluate(
      () =>
        new Promise<void>((done) => {
          // Two MessageChannel hops: React's scheduler queues its work the same way, so its renders run first.
          const c = new MessageChannel();
          let hops = 0;
          c.port1.onmessage = () => (++hops < 2 ? c.port2.postMessage(0) : done());
          c.port2.postMessage(0);
        }),
    );
  const step = async () => {
    await page.clock.runFor(STEP_MS);
    await settle();
  };
  // In-page stamps for the tap case: the tap's handling and the board leaving.
  await page.evaluate(() => {
    const w = window as unknown as { __tapAt: number | null; __boardGoneAt: number | null };
    w.__tapAt = null;
    w.__boardGoneAt = null;
    // The practice screen skips on a capture pointerdown on document; window's capture runs first.
    const stamp = () => {
      if (w.__tapAt === null) w.__tapAt = Date.now();
    };
    window.addEventListener("pointerdown", stamp, { capture: true });
    window.addEventListener("touchstart", stamp, { capture: true });
    new MutationObserver(() => {
      if (w.__boardGoneAt === null && !document.querySelector("[data-game-stage]")) w.__boardGoneAt = Date.now();
    }).observe(document.body, { childList: true, subtree: true });
  });

  // The solve: the Stage's own onSubmit (found on the React fiber under the board),
  // exactly as the game calls it when the board is solved.
  let solveAt = 0;
  let stageStart = 0;
  let realSubmitMs: number | null = null;
  if (!opts.buzzer) {
    const fired = await page.evaluate(() => {
      const host = document.querySelector("[data-game-stage]")!;
      const key = Object.keys(host).find((k) => k.startsWith("__reactFiber$"))!;
      type Fiber = { memoizedProps?: Record<string, unknown>; child?: Fiber; sibling?: Fiber };
      const queue: Fiber[] = [(host as unknown as Record<string, Fiber>)[key]!];
      while (queue.length) {
        const fiber = queue.shift()!;
        const props = fiber.memoizedProps;
        if (props && typeof props["onSubmit"] === "function" && "stateKey" in props) {
          const at = Date.now();
          (props["onSubmit"] as (a: string) => void)("beat-hold");
          return { at, start: props["phaseStartedAt"] as number };
        }
        if (fiber.child) queue.push(fiber.child);
        if (fiber.sibling) queue.push(fiber.sibling);
      }
      return null;
    });
    if (!fired) throw new Error(`${opts.mode} ${type}: no Stage onSubmit under the board`);
    solveAt = fired.at;
    stageStart = fired.start;
    // The one wall-clock ceiling: with page time paused, how long in real time until the stub holds the submission.
    const realStart = performance.now();
    while (performance.now() - realStart < REAL_SUBMIT_CEILING_MS * 4) {
      await settle();
      const count = await page.evaluate(
        () => (window as unknown as { __harness: { submissions: unknown[] } }).__harness.submissions.length,
      );
      if (count > 0) break;
    }
    realSubmitMs = performance.now() - realStart;
  }

  // Sample the screen every fake-clock step for 2.6 s from the solve (or the buzzer).
  const samples: Sample[] = [];
  const read = () =>
    page.evaluate(() => {
      const stage = document.querySelector("[data-game-stage]");
      return {
        now: Date.now(),
        board: stage !== null,
        dim: stage?.className.includes("opacity-30") ?? false,
        locked: [...document.querySelectorAll("span")].some((s) => s.textContent === "Locked"),
        beat: document.querySelector("[data-signature-beat]") !== null,
        submissions: (window as unknown as { __harness: { submissions: { at: number }[] } }).__harness
          .submissions.length,
      };
    });
  if (opts.buzzer) {
    // Step page time to the buzzer's own submission (the timeout path).
    for (let i = 0; i < 400; i++) {
      if ((await read()).submissions > 0) break;
      await step();
    }
  }
  let tapped = false;
  for (;;) {
    const s = await read();
    if (solveAt && s.now - solveAt > 2600) break;
    if (opts.buzzer && !solveAt) {
      solveAt = await page.evaluate(
        () => (window as unknown as { __harness: { submissions: { at: number }[] } }).__harness.submissions[0]!.at,
      );
    }
    samples.push({ t: s.now - solveAt, board: s.board, dim: s.dim, locked: s.locked, beat: s.beat });
    if (opts.tapAfter !== undefined && !tapped && s.now - solveAt >= opts.tapAfter) {
      tapped = true;
      await page.touchscreen.tap(195, 400);
      await settle();
    }
    await step();
  }
  const state = await page.evaluate(() => {
    const h = (window as unknown as {
      __harness: { submissions: { at: number; msRemaining: number }[]; verdictAt: number | null };
    }).__harness;
    const w = window as unknown as { __tapAt: number | null; __boardGoneAt: number | null };
    return { submissions: h.submissions, verdictAt: h.verdictAt, tapAt: w.__tapAt, goneAt: w.__boardGoneAt };
  });
  for (const e of errors) ok(false, `${opts.mode} ${type}: page error ${e}`);
  await context.close();

  const startMs = opts.mode === "practice" ? stageStart : phaseStart;
  const released = samples.find((s) => (opts.mode === "practice" ? !s.board : s.dim));
  return {
    solveAt,
    realSubmitMs,
    expectedMs: opts.buzzer ? 0 : startMs + prep + limit - solveAt,
    submissions: state.submissions,
    verdictAt: state.verdictAt,
    samples,
    releasedAt: released ? released.t : null,
    tapHandledAt: state.tapAt === null ? null : state.tapAt - solveAt,
    boardGoneAt: state.goneAt === null ? null : state.goneAt - solveAt,
  };
}

function submittedAtSolve(tag: string, run: Run) {
  const sub = run.submissions[0];
  if (sub)
    console.log(
      `     ${tag}: submission ${sub.at - run.solveAt} ms after the solve on the page clock (window ${SUBMIT_WINDOW_MS} ms)${run.realSubmitMs === null ? "" : `, ${Math.round(run.realSubmitMs)} ms real (ceiling ${REAL_SUBMIT_CEILING_MS} ms)`}`,
    );
  ok(run.submissions.length === 1, `${tag}: one submission (${run.submissions.length})`);
  if (!sub) return;
  ok(
    Math.abs(sub.at - run.solveAt) <= SUBMIT_WINDOW_MS,
    `${tag}: submitted at the solve moment (${sub.at - run.solveAt} ms, window ${SUBMIT_WINDOW_MS} ms)`,
  );
  ok(
    Math.abs(sub.msRemaining - run.expectedMs) <= SUBMIT_WINDOW_MS,
    `${tag}: submitted time unchanged (${sub.msRemaining} ms vs ${run.expectedMs} ms measured at the solve)`,
  );
  if (run.realSubmitMs !== null)
    ok(
      run.realSubmitMs <= REAL_SUBMIT_CEILING_MS,
      `${tag}: the submission reached the server within ${REAL_SUBMIT_CEILING_MS} ms of real time (${Math.round(run.realSubmitMs)} ms)`,
    );
}

function held(tag: string, mode: "practice" | "room", run: Run) {
  submittedAtSolve(tag, run);
  const before = run.samples.filter((s) => s.t < BEAT_END - SLACK);
  ok(before.length > 10, `${tag}: sampled the hold (${before.length})`);
  if (mode === "practice")
    ok(before.every((s) => s.board), `${tag}: the board stays until the beat has finished`);
  else
    ok(
      before.every((s) => s.board && !s.dim && !s.locked),
      `${tag}: the board stays bright with no Locked card until the beat has finished`,
    );
  ok(
    run.samples.some((s) => s.beat && s.board && !s.dim),
    `${tag}: the beat is drawn over the still, bright board`,
  );
  ok(
    run.releasedAt !== null && run.releasedAt >= BEAT_END - SLACK && run.releasedAt <= SIGNATURE_HOLD_MAX_MS + SLACK,
    `${tag}: ${mode === "practice" ? "reveal" : "dim"} at the beat's end, 2 s at most (${run.releasedAt} ms)`,
  );
  if (mode === "room")
    ok(
      run.samples.filter((s) => s.t > SIGNATURE_HOLD_MAX_MS + SLACK).every((s) => s.dim && s.locked),
      `${tag}: dimmed with the Locked card after the hold, as before`,
    );
  return run.releasedAt;
}

function notHeld(tag: string, mode: "practice" | "room", run: Run) {
  submittedAtSolve(tag, run);
  const verdict = run.verdictAt === null ? null : run.verdictAt - run.solveAt;
  ok(verdict !== null, `${tag}: verdict landed`);
  ok(
    run.releasedAt !== null && verdict !== null && run.releasedAt - verdict <= SLACK,
    `${tag}: ${mode === "practice" ? "reveal" : "dim"} straight after the verdict, as before (${run.releasedAt} ms, verdict at ${verdict} ms)`,
  );
  ok(!run.samples.some((s) => s.beat), `${tag}: no beat`);
  if (mode === "room")
    ok(
      run.samples.filter((s) => verdict !== null && s.t > verdict + SLACK).every((s) => s.dim && s.locked),
      `${tag}: dimmed with the Locked card, as before`,
    );
}

const report: string[] = [];
try {
  for (const mode of ["practice", "room"] as const) {
    const solve = await play({ mode, puzzle: SOLVE, verdict: { isCorrect: true, score: 140 } });
    report.push(`${mode} solve: released at ${held(`${mode} solve`, mode, solve)} ms`);

    const run = await play({
      mode,
      puzzle: NO_FINISH,
      verdict: { isCorrect: false, score: NO_FINISH_SCORE },
      buzzer: mode === "room",
    });
    report.push(`${mode} Ballpark ${NO_FINISH_SCORE}: released at ${held(`${mode} no-finish ${NO_FINISH_SCORE}`, mode, run)} ms`);

    const unsolved = await play({ mode, puzzle: SOLVE, verdict: { isCorrect: false, score: 60 } });
    notHeld(`${mode} unsolved`, mode, unsolved);
    report.push(`${mode} unsolved: released at ${unsolved.releasedAt} ms (verdict ${unsolved.verdictAt! - unsolved.solveAt} ms)`);
  }
  const tap = await play({
    mode: "practice",
    puzzle: SOLVE,
    verdict: { isCorrect: true, score: 140 },
    tapAfter: 600,
  });
  submittedAtSolve("practice tap", tap);
  // Judged from the tap's own handling: the tap must land inside the beat (from 0.6 s, before the
  // beat ends), the board must still be up until then, and the reveal must follow within SLACK.
  const tapAt = tap.tapHandledAt;
  const goneAt = tap.boardGoneAt;
  ok(
    tapAt !== null && tapAt >= 600 && tapAt < BEAT_END - SLACK,
    `practice tap: the tap was handled during the beat, from 0.6 s (${tapAt} ms; beat ends ${BEAT_END} ms)`,
  );
  ok(
    tapAt !== null && goneAt !== null && goneAt >= tapAt && goneAt - tapAt <= SLACK,
    `practice tap: the tap goes to the reveal at once (board gone ${goneAt} ms, ${tapAt === null || goneAt === null ? "?" : goneAt - tapAt} ms after the tap was handled)`,
  );
  report.push(
    `practice tap: handled at ${tapAt} ms, board gone at ${goneAt} ms (${tapAt === null || goneAt === null ? "?" : goneAt - tapAt} ms after the tap); sampled reveal at ${tap.releasedAt} ms`,
  );
} finally {
  await browser.close();
  await server.close();
}

for (const line of report) console.log(`ok   ${line}`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} beat-hold browser problem(s)`);
  process.exit(1);
}
console.log(
  `PASS: beat hold in Chromium (390 × 700, real practice and room screens): solve and Ballpark ${NO_FINISH_SCORE} held until the beat ends (≤ 2 s) with the beat over the bright board, then reveal / dim + Locked as before; unsolved rounds released straight after the verdict; a tap skips the practice wait; every submission at the solve moment with its time unchanged`,
);
process.exit(0);
