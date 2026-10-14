/**
 * Safe areas on the non-game screens (14 Oct 2026). The app's viewport is
 * `viewport-fit=cover` (so the game screens can pad the home bar), which lets every page
 * draw under a phone's notch, status bar and home bar. This check draws the real screens
 * in headless Chromium with a notch and home bar emulated (CDP
 * Emulation.setSafeAreaInsetsOverride: 47 px top, 34 px bottom, as an iPhone 14 in
 * portrait) at 375 × 667 and 390 × 844, and fails if any text or control sits under
 * either inset: at the top of the page, and (for a page that scrolls) at the bottom of
 * its scroll; or if a control at the top of the page is covered by another element
 * (the room's sticky chat bar over READY, for one).
 *
 * Screens: home (room join), practice list, the sound settings popover, a practice
 * round intro, an in-game help sheet, and a room's lobby, link join, Prepare to Duel
 * (starting), round title, round intro, round result, standings, winner reveal and
 * podium. The room screens come from the real room route (src/routes/duel.$code.tsx)
 * through scripts/safe-area-harness.tsx with only the network edge stubbed (the same
 * stubs as beat-hold-browser-check).
 *
 *   bun scripts/safe-area-screens-check.tsx [--verbose] [--shots=.shots]
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "playwright";
import type { Plugin } from "vite";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData } from "../src/lib/duel/types";

const VERBOSE = process.argv.includes("--verbose");
/** --shots=<dir>: save each screen (a design aid; keep it in the gitignored .shots/). */
const SHOTS = process.argv.find((a) => a.startsWith("--shots="))?.slice(8);
/** --insets=T,B overrides the emulated notch and home bar (e.g. 0,0 to compare a plain phone). */
const INSET_ARG = process.argv
  .find((a) => a.startsWith("--insets="))
  ?.slice(9)
  .split(",")
  .map(Number);
const INSETS = { top: INSET_ARG?.[0] ?? 47, bottom: INSET_ARG?.[1] ?? 34 };
const SIZES = [
  [375, 667],
  [390, 844],
] as const;

const CHROMIUM = [
  process.env.PLAYWRIGHT_CHROMIUM,
  "/opt/pw-browsers/chromium",
  "/usr/bin/chromium",
].find((path): path is string => Boolean(path && existsSync(path)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

/* ------------------------------------------------- the stubbed network edge (as beat-hold) */

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
  useParams: () => ({ code: "SAFE" }),
  useSearch: () => ({}),
});
export const useNavigate = () => () => undefined;
export const useRouter = () => ({ navigate: () => undefined, invalidate: () => undefined });
export const Link = ({ children }) => children;
`;
const START_STUB = `
const builder = () => new Proxy(() => undefined, { get: () => builder, apply: () => builder() });
export const createServerFn = builder;
export const createMiddleware = builder;
export const useServerFn = (fn) => fn;
`;

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
    name: "safe-area-edge",
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
        if (!req.url?.startsWith("/safe-area.html")) return next();
        // The app's own viewport meta (src/routes/__root.tsx), so env(safe-area-inset-*) applies.
        const html = await server.transformIndexHtml(
          req.url,
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="/scripts/safe-area-harness.tsx"></script></body></html>`,
        );
        res.setHeader("content-type", "text/html");
        res.end(html);
      });
    },
  };
}

const rootMeta = readFileSync("src/routes/__root.tsx", "utf8");
if (!/viewport-fit=cover/.test(rootMeta)) {
  console.log(
    "FAIL: src/routes/__root.tsx viewport has no viewport-fit=cover (the harness assumes it)",
  );
  process.exit(1);
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
  define: { __DUELZ_BUILD_ID__: JSON.stringify("safe-area-check") },
  server: { host: "127.0.0.1", port: 0, hmr: false },
  optimizeDeps: { entries: ["scripts/safe-area-harness.tsx"] },
  cacheDir: "node_modules/.vite-safe-area",
});
await server.listen();
const address = server.httpServer!.address();
const origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

/* ---------------------------------------------------------------- the room states */

const PUZZLE = splitPuzzle(withSeededRandom(41, () => generatePuzzle("sudoku"))).pub as PuzzleData;
const iso = (ms: number) => new Date(ms).toISOString();

/** A room state, built when its screen loads so its phase clock and presence are current. */
const room =
  (status: "waiting" | "in_progress" | "finished", phase: string, opts: { join?: boolean } = {}) =>
  () =>
    roomNow(status, phase, opts);
function roomNow(
  status: "waiting" | "in_progress" | "finished",
  phase: string,
  opts: { join?: boolean },
) {
  const now = Date.now();
  const player = (slot: number, name: string) => ({
    id: `p${slot}`,
    duel_id: "duel-safe",
    player_slot: slot,
    display_name: name,
    user_id: `u${slot}`,
    ready_round: 1,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: iso(now),
    status: "active",
    joined_at: iso(now - 60_000),
  });
  const result = (slot: number, score: number) => ({
    id: `r${slot}`,
    duel_id: "duel-safe",
    player_slot: slot,
    round_number: 1,
    answer: "",
    is_correct: score > 100,
    ms_remaining: 20_000,
    reaction_avg_ms: null,
    correct_count: null,
    errors: null,
    extra: null,
    score,
    submitted_at: iso(now - 5_000),
  });
  const scored = status === "finished" || ["result", "standings", "winner_reveal"].includes(phase);
  return {
    duel: {
      id: "duel-safe",
      room_code: "SAFE",
      status,
      selected_categories: [],
      tournament_history: [],
      disbanded_at: null,
      host_user_id: "u1",
      max_players: 10,
      round_count: 1,
      round_order: ["sudoku"],
      no_maths: false,
      puzzles_public: [PUZZLE],
      current_round: status === "waiting" ? 0 : 1,
      phase,
      phase_started_at: iso(now + 500),
      round_started_at: iso(now + 500),
      next_duel_id: null,
      created_at: iso(now - 60_000),
    },
    // Link join: this phone's player row has left a lobby, so the room offers the name-only join.
    players: opts.join
      ? [
          { ...player(1, "Me with a long name"), status: "left" },
          player(2, "Another long player name"),
        ]
      : [player(1, "Me with a long name"), player(2, "Another long player name")],
    results: scored ? [result(1, 182), result(2, 140)] : [],
  };
}

interface Screen {
  name: string;
  mode: "home" | "practice" | "room";
  room?: () => ReturnType<typeof roomNow>;
  /** Steps after load (practice), then a settle wait. */
  go?: (page: Page) => Promise<void>;
  waitMs?: number;
  /** An open popover or sheet covers the screen's controls on purpose: skip the cover test. */
  overlay?: boolean;
  /** The screen must fit without scrolling (RoundIntro never scrolls; the shared-clock moments). */
  fits?: boolean;
}
const openGame = async (page: Page) => {
  await page.getByRole("button", { name: "Box Six", exact: true }).first().click();
  await page
    .getByRole("button", { name: /^Ready/ })
    .first()
    .waitFor({ timeout: 30_000 });
};
const ONLY = process.argv.filter((a) => !a.startsWith("--")).slice(2);
const ALL_SCREENS: Screen[] = [
  { name: "home (room join)", mode: "home" },
  { name: "practice list", mode: "practice" },
  {
    name: "sound settings",
    mode: "practice",
    overlay: true,
    go: async (page) => {
      await page.getByRole("button", { name: "Effects volume" }).first().click();
      await page.getByRole("dialog").first().waitFor({ timeout: 10_000 });
    },
  },
  { name: "practice round intro", mode: "practice", go: openGame, fits: true },
  {
    name: "help sheet",
    mode: "practice",
    overlay: true,
    go: async (page) => {
      await openGame(page);
      await page
        .getByRole("button", { name: /^Ready/ })
        .first()
        .click();
      await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
      await page.getByRole("button", { name: "Show puzzle instructions" }).first().click();
      await page.getByRole("button", { name: "Close help" }).first().waitFor({ timeout: 10_000 });
    },
  },
  { name: "room lobby", mode: "room", room: room("waiting", "starting") },
  { name: "room link join", mode: "room", room: room("waiting", "starting", { join: true }) },
  {
    name: "Prepare to Duel",
    mode: "room",
    room: room("in_progress", "starting"),
    waitMs: 1200,
    fits: true,
  },
  {
    name: "round title",
    mode: "room",
    room: room("in_progress", "round_title"),
    waitMs: 200,
    fits: true,
  },
  {
    name: "room round intro",
    mode: "room",
    room: room("in_progress", "intro"),
    waitMs: 1500,
    fits: true,
  },
  { name: "round result", mode: "room", room: room("in_progress", "result"), waitMs: 2500 },
  { name: "standings", mode: "room", room: room("in_progress", "standings"), waitMs: 2500 },
  {
    name: "winner reveal",
    mode: "room",
    room: room("in_progress", "winner_reveal"),
    waitMs: 3000,
    fits: true,
  },
  { name: "podium", mode: "room", room: room("finished", "result"), waitMs: 3000 },
];

const SCREENS = ONLY.length
  ? ALL_SCREENS.filter((x) => ONLY.some((o) => x.name.includes(o)))
  : ALL_SCREENS;

/* ---------------------------------------------------------------- the measurement */

interface Hit {
  edge: "top" | "bottom" | "covered";
  label: string;
  at: number;
}

/** In-page: text and controls whose visible part sits under the top or bottom inset. */
function underInsets(arg: {
  top: number;
  bottom: number;
  edge: "top" | "bottom" | "both";
  covers: boolean;
}): Hit[] {
  const out: Hit[] = [];
  const H = window.innerHeight;
  const hidden = (el: Element) => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      if (n.getAttribute("aria-hidden") === "true") return true;
      // Inside a closed <details> (other than its summary): not drawn.
      if (
        n.parentElement?.tagName === "DETAILS" &&
        !(n.parentElement as HTMLDetailsElement).open &&
        n.tagName !== "SUMMARY"
      )
        return true;
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05)
        return true;
    }
    return false;
  };
  const controls =
    "button, a[href], input, select, textarea, [role='button'], [role='slider'], [role='tab']";
  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    const isControl = el.matches(controls);
    const hasText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "",
    );
    if (!isControl && !hasText) continue;
    if (el.closest("svg") && !isControl) continue;
    if (hidden(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    // The part actually shown: clipped by every scrolling/clipping ancestor and the screen.
    let top = Math.max(r.top, 0);
    let bottom = Math.min(r.bottom, H);
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowY)) {
        const b = n.getBoundingClientRect();
        top = Math.max(top, b.top);
        bottom = Math.min(bottom, b.bottom);
      }
    }
    if (bottom - top < 1) continue;
    const label =
      (el.getAttribute("aria-label") ?? (el.textContent ?? "").trim()).slice(0, 32) ||
      el.tagName.toLowerCase();
    // A control drawn under another element (a sticky bar over READY, say) cannot be tapped.
    if (arg.covers && isControl) {
      const hit = document.elementFromPoint(
        (Math.max(r.left, 0) + Math.min(r.right, window.innerWidth)) / 2,
        (top + bottom) / 2,
      );
      if (hit && !el.contains(hit) && !hit.contains(el))
        out.push({ edge: "covered", label, at: Math.round((top + bottom) / 2) });
    }
    if (arg.edge !== "bottom" && top < arg.top - 0.5)
      out.push({ edge: "top", label, at: Math.round(top) });
    if (arg.edge !== "top" && bottom > H - arg.bottom + 0.5)
      out.push({ edge: "bottom", label, at: Math.round(H - bottom) });
  }
  return out;
}

const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const failures: string[] = [];

/**
 * A cold dev server compiles the whole app on the first request (about 30 s on a 2-core runner,
 * right at Playwright's default goto timeout), so the first screen measured used to time out
 * before it rendered. Load the harness once, unmeasured, before any screen; nothing is judged here.
 */
async function warmUp(): Promise<void> {
  const started = Date.now();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      (window as unknown as { __harness: unknown }).__harness = {
        puzzles: {},
        verdict: { isCorrect: true, score: 150 },
        latencyMs: 50,
        submissions: [],
        verdictAt: null,
        room: null,
      };
    });
    await page.goto(`${origin}/safe-area.html?mode=home`, { timeout: 180_000 });
    await page.waitForSelector("#root *", { timeout: 120_000 });
    if (VERBOSE) console.log(`  warm-up: harness loaded in ${Date.now() - started} ms`);
  } finally {
    await context.close();
  }
}

/** goto, retried once if the load itself times out (a slow first compile); any other error stands. */
async function gotoRetried(page: import("playwright").Page, url: string, where: string): Promise<void> {
  try {
    await page.goto(url);
  } catch (error) {
    if (!/Timeout \d+ms exceeded/.test(String((error as Error).message))) throw error;
    console.log(`  ${where}: first load timed out; retrying once`);
    await page.goto(url, { timeout: 90_000 });
  }
}

try {
  await warmUp();
  for (const [w, h] of SIZES) {
    for (const screen of SCREENS) {
      const context = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: INSETS } as never);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]!));
      await page.addInitScript(
        (r) => {
          (window as unknown as { __harness: unknown }).__harness = {
            puzzles: { sudoku: r.puzzle },
            verdict: { isCorrect: true, score: 150 },
            latencyMs: 50,
            submissions: [],
            verdictAt: null,
            room: r.room,
          };
        },
        { room: screen.room?.() ?? null, puzzle: PUZZLE },
      );
      const where = `${screen.name} ${w}x${h}`;
      try {
        await gotoRetried(page, `${origin}/safe-area.html?mode=${screen.mode}`, where);
        if (screen.mode === "practice")
          await page
            .getByRole("button", { name: "Box Six", exact: true })
            .first()
            .waitFor({ timeout: 60_000 });
        else await page.waitForSelector("#root *", { timeout: 60_000 });
        await page.waitForTimeout(800);
        if (screen.go) await screen.go(page);
        await page.waitForTimeout(screen.waitMs ?? 600);
        const insets = await page.evaluate(() => {
          const d = document.createElement("div");
          d.style.cssText =
            "position:fixed;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
          document.body.append(d);
          const cs = getComputedStyle(d);
          const v = [parseFloat(cs.paddingTop), parseFloat(cs.paddingBottom)];
          d.remove();
          return v;
        });
        if (insets[0] !== INSETS.top || insets[1] !== INSETS.bottom)
          failures.push(`${where}: inset emulation not applied (${insets.join("/")})`);
        // Does the page scroll? (Judged first, then back to the top.)
        const scroll = await page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
          const y = window.scrollY;
          window.scrollTo(0, 0);
          return { y, height: document.documentElement.scrollHeight };
        });
        const scrolls = scroll.y > 0;
        if (screen.fits && scrolls)
          failures.push(`${where}: scrolls ${scroll.y}px (it must fit the screen)`);
        await page.waitForTimeout(100);
        if (SHOTS)
          await page.screenshot({
            path: `${SHOTS}/safe-${screen.name.replace(/\W+/g, "-")}-${w}x${h}.png`,
          });
        // At the top: nothing under the notch; on a page that does not scroll, nothing under
        // the home bar and no control covered. A page that scrolls is judged at its scroll
        // end for the home bar, and for controls left covered in its lower half (content
        // above that scrolls out from under a fixed bar).
        const atTop = await page.evaluate(underInsets, {
          ...INSETS,
          edge: scrolls ? ("top" as const) : ("both" as const),
          covers: !scrolls && !screen.overlay,
        });
        let atEnd: Hit[] = [];
        if (scrolls) {
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await page.waitForTimeout(150);
          atEnd = (
            await page.evaluate(underInsets, {
              ...INSETS,
              edge: "bottom" as const,
              covers: !screen.overlay,
            })
          ).filter((x) => x.edge !== "covered" || x.at > h / 2);
        }
        if (VERBOSE)
          console.log(
            `  ${where}: ${scrolls ? `scrolls ${scroll.y}px (document ${scroll.height}px)` : "fits"}`,
          );
        const hits = [...atTop, ...atEnd];
        const seen = new Set<string>();
        for (const x of hits) {
          const key = `${x.edge}:${x.label}`;
          if (seen.has(key)) continue;
          seen.add(key);
          failures.push(
            x.edge === "covered"
              ? `${where}: "${x.label}" is covered by another element (at y ${x.at}px)`
              : `${where}: "${x.label}" under the ${x.edge === "top" ? "notch / status bar" : "home bar"} (${x.edge === "top" ? `top at ${x.at}px, inset ${INSETS.top}` : `${x.at}px from the bottom, inset ${INSETS.bottom}`})`,
          );
        }
        const mine = failures.filter((f) => f.startsWith(where)).length;
        console.log(
          `${mine ? "FAIL" : "PASS"} ${where}${mine ? `: ${mine} item(s) under an inset` : ": clear of the notch and home bar"}`,
        );
        if (VERBOSE && errors.length)
          console.log(`  page errors: ${[...new Set(errors)].slice(0, 2).join(" | ")}`);
      } catch (error) {
        failures.push(`${where}: ${String((error as Error).message ?? error).split("\n")[0]}`);
        console.log(`FAIL ${where}: did not render`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}
for (const f of failures) console.log(`  ${f}`);
if (failures.length) {
  console.log(
    `FAIL: ${failures.length} problem(s) on the non-game screens with a ${INSETS.top}px notch and ${INSETS.bottom}px home bar`,
  );
  process.exit(1);
}
console.log(
  `PASS: ${SCREENS.length} screens at 375x667 and 390x844 keep text and controls clear of a ${INSETS.top}px notch and a ${INSETS.bottom}px home bar`,
);
