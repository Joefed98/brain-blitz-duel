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
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { SIGNATURE_DELAY_MS, SIGNATURE_HOLD_MAX_MS, SIGNATURE_MS } from "../src/lib/fx/signature";

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
const BEAT_END = SIGNATURE_DELAY_MS + SIGNATURE_MS;
/** Rendering and the 100 ms screen ticker: how far a sample may sit from the exact moment. */
const SLACK = 250;
/**
 * How far the submission may land from the solve moment (and its msRemaining from the time
 * measured there). Both stamps already come from the page's own Date.now(), so the gap is
 * only the main thread getting from the Stage's onSubmit to the (stubbed) server call:
 * React's state update and render, with the dev server's modules and the beat starting.
 * That is 0-2 ms in practice and 17-25 ms in a room on a dev machine, but a 2-core GitHub runner has measured 53 ms
 * (#54, #56). CI therefore gets 150 ms; locally the tight 50 ms stays. A real regression
 * (the submission held for the beat, or queued behind a timer) shows up as
 * SIGNATURE_DELAY_MS (1,000 ms) or more, which both windows still catch.
 */
const SUBMIT_WINDOW_MS = process.env.CI === "true" ? 150 : 50;

const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });

interface Sample {
  t: number;
  board: boolean;
  dim: boolean;
  locked: boolean;
  beat: boolean;
}
interface Run {
  /** The solve moment (the Stage's own onSubmit call, or the buzzer). */
  solveAt: number;
  /** What the screen should have sent: phase start + prep + limit − solve time. */
  expectedMs: number;
  submissions: { at: number; msRemaining: number }[];
  verdictAt: number | null;
  samples: Sample[];
  /** When the board left (practice) or dimmed (room), from the solve; null if never. */
  releasedAt: number | null;
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
  await page.goto(`${origin}/beat-hold.html?mode=${opts.mode}`);

  if (opts.mode === "practice") {
    await page.getByRole("button", { name: puzzleDef(type).name, exact: true }).click();
    await page.getByRole("button", { name: "Ready", exact: true }).click({ timeout: 20_000 });
  }
  await page.waitForSelector("[data-game-stage]", { timeout: 30_000 });
  await page.waitForTimeout(700);

  // The solve: the Stage's own onSubmit (found on the React fiber under the board),
  // exactly as the game calls it when the board is solved.
  let solveAt = 0;
  let stageStart = 0;
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
  }

  // Sample the screen every ~40 ms for 2.6 s from the solve (or the buzzer).
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
    // Wait for the buzzer's own submission (the timeout path).
    for (let i = 0; i < 100; i++) {
      if ((await read()).submissions > 0) break;
      await page.waitForTimeout(40);
    }
  }
  let tapped = false;
  const until = Date.now() + 2600;
  while (Date.now() < until) {
    const s = await read();
    if (opts.buzzer && !solveAt) {
      solveAt = await page.evaluate(
        () => (window as unknown as { __harness: { submissions: { at: number }[] } }).__harness.submissions[0]!.at,
      );
    }
    samples.push({ t: s.now - solveAt, board: s.board, dim: s.dim, locked: s.locked, beat: s.beat });
    if (opts.tapAfter !== undefined && !tapped && s.now - solveAt >= opts.tapAfter) {
      tapped = true;
      await page.touchscreen.tap(195, 400);
    }
    await page.waitForTimeout(40);
  }
  const state = await page.evaluate(() => {
    const h = (window as unknown as {
      __harness: { submissions: { at: number; msRemaining: number }[]; verdictAt: number | null };
    }).__harness;
    return { submissions: h.submissions, verdictAt: h.verdictAt };
  });
  for (const e of errors) ok(false, `${opts.mode} ${type}: page error ${e}`);
  await context.close();

  const startMs = opts.mode === "practice" ? stageStart : phaseStart;
  const released = samples.find((s) => (opts.mode === "practice" ? !s.board : s.dim));
  return {
    solveAt,
    expectedMs: opts.buzzer ? 0 : startMs + prep + limit - solveAt,
    submissions: state.submissions,
    verdictAt: state.verdictAt,
    samples,
    releasedAt: released ? released.t : null,
  };
}

function submittedAtSolve(tag: string, run: Run) {
  const sub = run.submissions[0];
  if (sub) console.log(`     ${tag}: submission ${sub.at - run.solveAt} ms after the solve (window ${SUBMIT_WINDOW_MS} ms)`);
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
      verdict: { isCorrect: false, score: 130 },
      buzzer: mode === "room",
    });
    report.push(`${mode} Ballpark 130: released at ${held(`${mode} no-finish 130`, mode, run)} ms`);

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
  ok(
    tap.releasedAt !== null && tap.releasedAt >= 600 && tap.releasedAt <= 600 + SLACK,
    `practice tap: a tap at 0.6 s goes to the reveal at once (${tap.releasedAt} ms)`,
  );
  report.push(`practice tap at 600 ms: reveal at ${tap.releasedAt} ms`);
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
  "PASS: beat hold in Chromium (390 × 700, real practice and room screens): solve and Ballpark 130 held until the beat ends (≤ 2 s) with the beat over the bright board, then reveal / dim + Locked as before; unsolved rounds released straight after the verdict; a tap skips the practice wait; every submission at the solve moment with its time unchanged",
);
process.exit(0);
