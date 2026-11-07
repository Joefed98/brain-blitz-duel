/**
 * offline-check (31 Oct 2026): offline practice, end to end, on a production build in headless Chromium.
 *
 * Builds the app (`vite build`, Nitro's node-server preset, as standard-live-check does), starts it behind a small
 * proxy (so the check can publish a "new build" of /sw.js mid-run) and, at 414×896 (an iPhone 11) and 375×667:
 *
 *   1. opens Practice online; the service worker installs and every pack fills (each game's deals, the stamps a
 *      pack is tied to); reports the real offline storage (app files, sounds and music, packs);
 *   2. with the network off, reloads: the app opens from the worker's cache, Practice loads, the slim banner and the
 *      "Online only" marks show; Play, Tournaments (the tab bar), a room link, the daily and a challenge show the
 *      offline state with a way to Practice;
 *   3. plays Meteor (arcade), Poker Squares (cards) and Eagle Eye (puzzle) to the end offline from their packs: the
 *      arcade and card runs show a provisional score, the puzzle "Score pending", all with the clock;
 *   4. queues a tampered run (its deal changed on the phone) and an old-stamp run (an older Meteor stamp's pack the
 *      check seals as the server would; the next top-up must replace that pack), and lets the sign-in expire;
 *   5. reconnects: the sign-in is refreshed before anything is sent, the queue uploads oldest first, the server's
 *      scores are kept (each equal to grading the stored run here), bests update, the clocks clear, the tampered
 *      run shows "Couldn't be confirmed", the old-stamp run is graded on its own stamp, and the pack is replaced;
 *   6. starts a run, publishes a new build's worker: it installs and waits while the run plays on (no reload, same
 *      controller), and takes over once the run is over and the list is back.
 *
 *   7. (4 Nov 2026, src/lib/offline/packGrowth.ts) on a brand-new device: no pack download on app open; the first
 *      finished practice round starts the first top-up at PACK_FIRST_DEALS deals a game; the next visit grows each
 *      pack; Battery saver, Save-Data and a 2G connection each hold the top-up. Passes 1–6 run as a device that has
 *      started practising at the full target, so packs behave there exactly as before.
 *
 * Also proves the online-only list is exactly the games whose stage asks the server during play.
 *
 *   bun scripts/offline-check.ts [--no-build] [--shots=<dir>]
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import type { Browser, BrowserContext, Page } from "playwright";

import { gradeAnswer } from "../src/lib/duel/generate.server";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { mergePuzzle } from "../src/lib/duel/secrets";
import { PUZZLE_TYPES, isRetired } from "../src/lib/duel/registry";
import { currentPracticeStamp, stampSignature } from "../src/lib/duel/practiceStamps";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { ONLINE_ONLY_TYPES, PACK_MAX_DEALS } from "../src/lib/offline/offlineStatus";
import { PACK_FIRST_DEALS, PACK_GROWTH_STEP, PACK_LEVEL_KEY } from "../src/lib/offline/packGrowth";
import { showPracticeSide } from "./practice-side-lib";

const args = process.argv.slice(2);
const NO_BUILD = args.includes("--no-build");
const SHOTS = args.find((a) => a.startsWith("--shots="))?.slice(8);
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));
const OUT = ".output";
const SERVER_PORT = 4393;
const PROXY_PORT = 4394;
const ORIGIN = `http://127.0.0.1:${PROXY_PORT}`;
const SEAL_SECRET = "offline-check";
/** Games whose packs need the database (Unblock draws its boards from a table): no pack where a check runs. */
const NEEDS_DATABASE = new Set<PuzzleType>(["unblock"]);
/** The offline storage budget (MB). */
const BUDGET_MB = 60;
/** A pack level whose target is PACK_MAX_DEALS (packGrowth.ts: 3, 5, 7, 9, 10). */
const FULL_LEVEL = Math.ceil((PACK_MAX_DEALS - PACK_FIRST_DEALS) / PACK_GROWTH_STEP);

/** Init script: opt in to packs (navigator.webdriver checks are off otherwise); optionally a started device at a level. */
function allowPacks(opts: { started?: boolean; level?: number; saver?: boolean; connection?: { saveData?: boolean; effectiveType?: string } }): void {
  (window as unknown as { __DUELZ_ALLOW_PACKS__: boolean }).__DUELZ_ALLOW_PACKS__ = true;
  if (opts.started) localStorage.setItem("duelz-offline-started:v1", "1");
  if (opts.level !== undefined) localStorage.setItem("duelz-offline-pack-level:v1", String(opts.level));
  if (opts.saver) localStorage.setItem("duelz-battery-saver:v1", "1");
  if (opts.connection) Object.defineProperty(navigator, "connection", { configurable: true, get: () => opts.connection });
}
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const failures: string[] = [];
const passes: string[] = [];
const report: string[] = [];
function check(ok: boolean, name: string, detail = ""): void {
  if (ok) passes.push(name);
  else failures.push(`${name}${detail ? `: ${detail}` : ""}`);
}

/* ------------------------------------------------------------------------------------------------------------ */
/*  Static: the online-only list                                                                                 */
/* ------------------------------------------------------------------------------------------------------------ */

{
  // A stage that asks the server during play takes checkWord or checkMoves; exactly those games are online only.
  const registry = readFileSync("src/lib/duel/registry.ts", "utf8");
  const asking = new Set<string>();
  for (const file of readdirSync("src/puzzles").filter((f) => f.endsWith(".tsx"))) {
    const src = readFileSync(`src/puzzles/${file}`, "utf8");
    if (!/\bcheck(Word|Moves)\b/.test(src)) continue;
    const id = /\btype:\s*"([a-z0-9]+)"/.exec(src)?.[1];
    if (id) asking.add(id);
  }
  const online = [...ONLINE_ONLY_TYPES].sort();
  check(JSON.stringify([...asking].sort()) === JSON.stringify(online), "online-only list = the stages that ask the server", `${[...asking].sort().join(",")} vs ${online.join(",")}`);
  check(registry.length > 0 && PUZZLE_TYPES.every((t) => typeof t === "string"), "registry read");
}

/* ------------------------------------------------------------------------------------------------------------ */
/*  Build, server and proxy                                                                                      */
/* ------------------------------------------------------------------------------------------------------------ */

function build(): void {
  const res = spawnSync("bunx", ["vite", "build"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NITRO_PRESET: "node-server" },
    encoding: "utf8",
    timeout: 600_000,
  });
  if (res.status !== 0 || !existsSync(`${OUT}/server/index.mjs`) || !existsSync(`${OUT}/public/sw.js`)) {
    console.log(`${res.stdout?.slice(-2000) ?? ""}\n${res.stderr?.slice(-2000) ?? ""}`);
    throw new Error("production build failed (or wrote no sw.js)");
  }
}

async function startServer(): Promise<ChildProcess> {
  const proc = spawn("node", [`${OUT}/server/index.mjs`], {
    stdio: "ignore",
    env: { ...process.env, PORT: String(SERVER_PORT), HOST: "127.0.0.1", NITRO_PORT: String(SERVER_PORT), NITRO_HOST: "127.0.0.1", SUPABASE_SERVICE_ROLE_KEY: SEAL_SECRET },
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${SERVER_PORT}/practice`)).ok) return proc;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error("production server did not start");
}

/** The worker as built, and the "next build" the proxy serves once `publishNext` is set. */
const BUILT_SW = () => readFileSync(`${OUT}/public/sw.js`, "utf8");
const builtVersion = () => JSON.parse(/const CONFIG = (\{.*?\});\n/s.exec(BUILT_SW())![1]!).version as string;
let publishNext = false;
const NEXT_SUFFIX = "-next";

function startProxy(): { stop: () => void } {
  const server = Bun.serve({
    port: PROXY_PORT,
    hostname: "127.0.0.1",
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/sw.js") {
        let text = BUILT_SW();
        if (publishNext) text = text.replace(/"version":"([^"]+)"/, `"version":"$1${NEXT_SUFFIX}"`);
        return new Response(text, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" } });
      }
      const target = `http://127.0.0.1:${SERVER_PORT}${url.pathname}${url.search}`;
      const headers = new Headers(request.headers);
      headers.delete("host");
      const response = await fetch(target, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
        redirect: "manual",
      });
      const out = new Headers(response.headers);
      out.delete("content-encoding");
      out.delete("content-length");
      return new Response(await response.arrayBuffer(), { status: response.status, headers: out });
    },
  });
  return { stop: () => server.stop(true) };
}

/* ------------------------------------------------------------------------------------------------------------ */
/*  The server's seal, as practice.functions.ts makes it (the check holds the secret, as the server does)        */
/* ------------------------------------------------------------------------------------------------------------ */

type Loose = Record<string, unknown>;

async function sealKey(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SEAL_SECRET));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
async function unseal(sealed: string): Promise<Loose> {
  const [iv, cipher] = sealed.split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv!, "base64") }, await sealKey(), Buffer.from(cipher!, "base64"));
  return JSON.parse(new TextDecoder().decode(plain)) as Loose;
}
async function seal(payload: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await sealKey(), new TextEncoder().encode(JSON.stringify(payload))));
  return `${b64(iv)}.${b64(cipher)}`;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonical(v))).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Loose)
      .filter(([, v]) => v !== undefined && typeof v !== "function")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}
async function pubDigest(pub: unknown): Promise<string> {
  return b64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(pub)))));
}

/* ------------------------------------------------------------------------------------------------------------ */
/*  Browser helpers                                                                                              */
/* ------------------------------------------------------------------------------------------------------------ */

interface AuthLog {
  signups: number[];
  refreshes: number[];
}

/** Supabase's auth endpoints answered here (no project is reachable from a check): an anonymous session. */
async function stubAuth(ctx: BrowserContext, log: AuthLog): Promise<void> {
  await ctx.route("**/auth/v1/**", (route) => {
    const url = route.request().url();
    if (url.includes("grant_type=refresh_token")) log.refreshes.push(Date.now());
    else if (url.includes("/signup")) log.signups.push(Date.now());
    const now = Math.floor(Date.now() / 1000);
    const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const token = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: "offline-check", exp: now + 3600, role: "authenticated", aud: "authenticated" })}.c2ln`;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: token,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: `r-${Date.now()}`,
        user: { id: "offline-check", aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: {}, user_metadata: {} },
      }),
    });
  });
  // Nothing else leaves the machine (Supabase's REST and realtime, error reporting): refused, as with no project.
  await ctx.route(/supabase\.co\/(rest|realtime|storage)/, (route) => route.abort());
}

interface IdbRun {
  id: string;
  type: PuzzleType;
  stamp: string;
  packSeed: number | null;
  puzzle: PuzzleData;
  sealed: string;
  answer: string;
  msRemaining: number;
  playedAt: number;
  provisional: number | null;
  status: "queued" | "confirmed" | "rejected";
  score?: number;
  isCorrect?: boolean;
  reason?: string;
}
interface IdbPack {
  type: PuzzleType;
  stamp: string;
  builtFor: string;
  deals: { id: number; puzzle: PuzzleData; sealed: string }[];
  updatedAt: number;
}

async function idbAll<T>(page: Page, store: "packs" | "runs"): Promise<T[]> {
  return page.evaluate(
    (name) =>
      new Promise<T[]>((res) => {
        const open = indexedDB.open("joulz-offline");
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains(name)) return res([]);
          const q = db.transaction(name).objectStore(name).getAll();
          q.onsuccess = () => res(q.result as T[]);
          q.onerror = () => res([]);
        };
        open.onerror = () => res([]);
      }),
    store,
  );
}

async function idbPut(page: Page, store: "packs" | "runs", value: unknown): Promise<void> {
  await page.evaluate(
    ([name, v]) =>
      new Promise<void>((res, rej) => {
        const open = indexedDB.open("joulz-offline");
        open.onsuccess = () => {
          const tx = open.result.transaction(name as string, "readwrite");
          tx.objectStore(name as string).put(v);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        };
        open.onerror = () => rej(open.error);
      }),
    [store, value] as const,
  );
}

async function controllerVersion(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      new Promise<string | null>((res) => {
        const sw = navigator.serviceWorker.controller;
        if (!sw) return res(null);
        const ch = new MessageChannel();
        const timer = setTimeout(() => res(null), 2000);
        ch.port1.onmessage = (e) => {
          clearTimeout(timer);
          res((e.data as { version?: string })?.version ?? null);
        };
        sw.postMessage({ type: "VERSION" }, [ch.port2]);
      }),
  );
}

async function until(what: string, test: () => Promise<boolean>, timeoutMs: number, stepMs = 500): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await test().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  failures.push(`timed out: ${what}`);
  return false;
}

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`) });
}

/** Opens a game from the Practice list and presses Ready (the list must be showing). */
async function startGame(page: Page, game: PuzzleType): Promise<void> {
  await showPracticeSide(page, game);
  // A retired game (Full House since 1 Nov 2026) keeps its pack and is opened from the list's Retired section.
  if (isRetired(game)) await page.locator("[data-practice-retired]").first().evaluate((d) => ((d as HTMLDetailsElement).open = true));
  const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
  await button.waitFor({ timeout: 30_000 });
  await button.click();
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 30_000 });
  await ready.click();
  await page.locator("[data-game-stage], [data-arcade-play]").first().waitFor({ timeout: 30_000 });
}

/** Poker Squares: tap all 25 squares (the run ends when the grid is full). World 414×772, grid at (8, 44), cells 62×86, gap 6. */
async function playPokerSquares(page: Page): Promise<void> {
  const canvas = page.locator("[data-arcade-play] canvas").first();
  await canvas.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(800);
  // The world's own canvas: the largest one inside the arena (the scene canvas sits behind it).
  const box = await page.evaluate(() => {
    const list = [...document.querySelectorAll("[data-game-arena] canvas, [data-arcade-play] canvas")] as HTMLCanvasElement[];
    const best = list
      .map((c) => ({ c, r: c.getBoundingClientRect() }))
      .filter(({ r, c }) => r.width > 100 && getComputedStyle(c).pointerEvents !== "none")
      .sort((a, b) => Math.abs(a.r.width / a.r.height - 414 / 772) - Math.abs(b.r.width / b.r.height - 414 / 772))[0];
    return best ? { x: best.r.x, y: best.r.y, w: best.r.width, h: best.r.height } : null;
  });
  if (!box) throw new Error("no Poker Squares canvas");
  const scale = box.w / 414;
  for (let sq = 0; sq < 25; sq++) {
    const r = Math.floor(sq / 5);
    const c = sq % 5;
    const x = box.x + (8 + c * 68 + 31) * scale;
    const y = box.y + (44 + r * 92 + 43) * scale;
    await page.mouse.click(x, y);
    await page.waitForTimeout(140);
  }
}

/** Plays a game to the end offline from its pack and returns the result screen's state. */
async function playOffline(page: Page, game: PuzzleType, timeoutMs: number): Promise<string> {
  await startGame(page, game);
  if (game === "pokersquares") await playPokerSquares(page);
  await page.locator("[data-offline-result]").waitFor({ timeout: timeoutMs });
  return (await page.locator("[data-offline-result]").getAttribute("data-offline-result")) ?? "";
}

async function backToList(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Back", exact: true }).first().click();
  await page.locator("[data-practice-switch]").waitFor({ timeout: 10_000 });
}

/* ------------------------------------------------------------------------------------------------------------ */
/*  The run                                                                                                      */
/* ------------------------------------------------------------------------------------------------------------ */

/**
 * The lazy, smaller first top-up (4 Nov 2026, packGrowth.ts) on a brand-new device: nothing is downloaded on app open;
 * the first finished practice round starts it, at PACK_FIRST_DEALS deals a game; the next visit grows the target; and
 * Battery saver, Save-Data and a 2G connection each hold the top-up. Reports the server's deals for a new device.
 */
async function lazyPass(browser: Browser): Promise<void> {
  const tag = "new device";
  const wanted = PUZZLE_TYPES.filter((t) => !ONLINE_ONLY_TYPES.has(t) && !NEEDS_DATABASE.has(t));
  const dealsIn = (packs: IdbPack[]) => packs.reduce((a, p) => a + p.deals.length, 0);
  const fresh = async (opts: Parameters<typeof allowPacks>[0]) => {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(allowPacks, opts);
    await stubAuth(ctx, { signups: [], refreshes: [] });
    const page = await ctx.newPage();
    let packCalls = 0;
    // A pack request (practicePackFn's input is { types, count }; production builds hash server-function ids).
    page.on("request", (req) => {
      const body = req.postData() ?? "";
      if (req.url().includes("/_serverFn/") && body.includes('"types"') && body.includes('"count"')) packCalls += 1;
    });
    return { ctx, page, packCalls: () => packCalls };
  };

  // App open: no top-up at all.
  {
    const { ctx, page, packCalls } = await fresh({});
    await page.goto(`${ORIGIN}/practice`);
    await until(`${tag}: worker controls the page`, async () => (await controllerVersion(page)) !== null, 120_000);
    await page.waitForTimeout(8_000);
    check(packCalls() === 0 && (await idbAll<IdbPack>(page, "packs")).length === 0, `${tag}: no packs downloaded on app open`, `${packCalls()} pack calls`);
    // The first finished practice round (Meteor, online, no input) starts the first top-up: PACK_FIRST_DEALS a game.
    await startGame(page, "snake");
    await page.locator("[data-practice-reveal-actions]").waitFor({ timeout: 120_000 });
    // A round on screen holds a top-up (the app updater's gate): it starts back on the list.
    await page.waitForTimeout(3_000);
    check(packCalls() === 0, `${tag}: no top-up while the finished round is on screen`, `${packCalls()} pack calls`);
    await backToList(page);
    const first = await until(
      `${tag}: first top-up`,
      async () => {
        const packs = await idbAll<IdbPack>(page, "packs");
        return wanted.every((t) => packs.some((p) => p.type === t && p.deals.length >= PACK_FIRST_DEALS));
      },
      180_000,
      1000,
    );
    const packs = await idbAll<IdbPack>(page, "packs");
    check(first && packs.every((p) => p.deals.length === PACK_FIRST_DEALS), `${tag}: the first finished round fills ${PACK_FIRST_DEALS} deals a game`, packs.filter((p) => p.deals.length !== PACK_FIRST_DEALS).map((p) => `${p.type}:${p.deals.length}`).join(","));
    const level = await page.evaluate((k) => localStorage.getItem(k), PACK_LEVEL_KEY);
    check(level === "1", `${tag}: the next visit's target grows`, `level ${level}`);
    check(packCalls() > 0, `${tag}: the pack requests are seen`, `${packCalls()} pack calls`);
    report.push(`${tag}: server deals: 0 on app open; ${dealsIn(packs)} (${PACK_FIRST_DEALS} a game, ${packs.length} games) after the first finished round, over ${packCalls()} calls; until 4 Nov 2026 ${packs.length * PACK_MAX_DEALS} (${PACK_MAX_DEALS} a game), starting 3 s after the app opened`);
    // The next visit: the target grows to PACK_FIRST_DEALS + PACK_GROWTH_STEP.
    await page.reload();
    const grown = PACK_FIRST_DEALS + PACK_GROWTH_STEP;
    const second = await until(
      `${tag}: second visit's top-up`,
      async () => {
        const all = await idbAll<IdbPack>(page, "packs");
        return wanted.every((t) => all.some((p) => p.type === t && p.deals.length >= grown));
      },
      180_000,
      1000,
    );
    check(second && (await idbAll<IdbPack>(page, "packs")).every((p) => p.deals.length === grown), `${tag}: the next visit grows each pack to ${grown}`);
    await ctx.close();
  }

  // Battery saver, Save-Data and a 2G connection hold the top-up (a started device).
  for (const [name, opts] of [
    ["Battery saver", { started: true, saver: true }],
    ["Save-Data", { started: true, connection: { saveData: true, effectiveType: "4g" } }],
    ["a 2G connection", { started: true, connection: { effectiveType: "2g" } }],
  ] as const) {
    const { ctx, page, packCalls } = await fresh(opts);
    await page.goto(`${ORIGIN}/practice`);
    await until(`${tag}: worker controls the page (${name})`, async () => (await controllerVersion(page)) !== null, 120_000);
    await page.waitForTimeout(8_000);
    check(packCalls() === 0 && (await idbAll<IdbPack>(page, "packs")).length === 0, `${tag}: no top-up with ${name}`, `${packCalls()} pack calls`);
    await ctx.close();
  }
}

async function fullPass(browser: Browser): Promise<void> {
  const W = 414;
  const H = 896;
  const tag = `${W}x${H}`;
  const auth: AuthLog = { signups: [], refreshes: [] };
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  // Automated browsers top up packs only on request (topUpAllowed in src/lib/offline/packs.ts): this check opts in.
  // A device that has already started practising, at the full pack target (packGrowth.ts): packs as before.
  await ctx.addInitScript(allowPacks, { started: true, level: FULL_LEVEL });
  await stubAuth(ctx, auth);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const gradeRequests: { at: number; body: string }[] = [];
  page.on("request", (req) => {
    const body = req.postData() ?? "";
    if (req.url().includes("/_serverFn/") && body.includes("sealed") && body.includes("answer")) gradeRequests.push({ at: Date.now(), body });
  });
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations += 1;
  });

  // 1. Online: the worker installs and the packs fill.
  await page.goto(`${ORIGIN}/practice`);
  await until("service worker controls the page", async () => (await controllerVersion(page)) === builtVersion(), 120_000);
  const wanted = PUZZLE_TYPES.filter((t) => !ONLINE_ONLY_TYPES.has(t) && !NEEDS_DATABASE.has(t));
  await until(
    "every pack full",
    async () => {
      const packs = await idbAll<IdbPack>(page, "packs");
      const full = new Set(packs.filter((p) => p.deals.length >= PACK_MAX_DEALS).map((p) => p.type));
      return wanted.every((t) => full.has(t));
    },
    180_000,
    1000,
  );
  const packs = await idbAll<IdbPack>(page, "packs");
  check(packs.every((p) => !ONLINE_ONLY_TYPES.has(p.type)), "no pack for an online-only game");
  check(
    packs.every((p) => p.builtFor === currentPracticeStamp(p.type) && p.deals.every((d) => stampSignature(d.puzzle) === p.stamp)),
    "each pack is tied to its game's stamps",
  );
  // A pack carries what the phone plays: no solution field in the clear (every secret key stays sealed).
  const { splitPuzzle } = await import("../src/lib/duel/secrets");
  const leaks = packs.flatMap((p) =>
    p.deals.filter((d) => Object.keys(splitPuzzle({ ...(d.puzzle as object), type: p.type } as PuzzleData).priv).length > 1).map(() => p.type),
  );
  check(leaks.length === 0, "packs hold no solution in the clear", [...new Set(leaks)].join(","));
  const opened = await unseal(packs.find((p) => p.type === "symscan")!.deals[0]!.sealed);
  check(typeof opened["__pub"] === "string" && typeof opened["__pack"] === "number", "a pack deal's sealed half carries its deal digest and pack seed");
  const estimate = await page.evaluate(() => navigator.storage.estimate());
  const details = (estimate as { usageDetails?: Record<string, number> }).usageDetails ?? {};
  const usedMb = (estimate.usage ?? 0) / 1024 / 1024;
  report.push(
    `offline storage at ${tag}: ${usedMb.toFixed(1)} MB (caches ${((details["caches"] ?? 0) / 1048576).toFixed(1)} MB, IndexedDB ${((details["indexedDB"] ?? 0) / 1048576).toFixed(1)} MB; ${packs.reduce((a, p) => a + p.deals.length, 0)} deals in ${packs.length} packs)`,
  );
  check(usedMb > 1 && usedMb < BUDGET_MB, `offline storage under ${BUDGET_MB} MB`, `${usedMb.toFixed(1)} MB`);

  // 2. Offline: the app opens from the cache.
  await ctx.setOffline(true);
  await page.reload();
  await page.locator("[data-practice-switch]").waitFor({ timeout: 30_000 });
  check(await page.locator("[data-offline-banner]").isVisible(), `${tag}: offline banner on Practice`);
  check((await page.locator("[data-offline-banner]").innerText()).includes("You’re offline. Practice still works."), "banner text");
  await showPracticeSide(page, "wordsmith");
  check((await page.locator('[data-practice-game="wordsmith"] [data-online-only]').count()) === 1, "Nucleus marked online only");
  await shot(page, `offline-banner-${tag}`);

  // 3. Play an arcade, a card and a puzzle game offline.
  const meteor = await playOffline(page, "snake", 90_000);
  check(meteor === "queued", "Meteor offline: queued");
  check(/^\d+$/.test((await page.locator("[data-offline-score]").innerText()).trim()), "Meteor offline: provisional score shown");
  check((await page.locator("[data-offline-result] [data-pending-clock]").count()) === 1, "Meteor offline: pending clock");
  await shot(page, `pending-arcade-${tag}`);
  await backToList(page);
  const poker = await playOffline(page, "pokersquares", 90_000);
  check(poker === "queued" && /^\d+$/.test((await page.locator("[data-offline-score]").innerText()).trim()), "Poker Squares offline: provisional score");
  await backToList(page);
  const eagle = await playOffline(page, "symscan", 90_000);
  check(eagle === "queued" && (await page.locator("[data-offline-score]").innerText()).includes("Score pending"), "Eagle Eye offline: score pending");
  check((await page.locator("[data-offline-result] [data-pending-clock]").count()) === 1, "Eagle Eye offline: pending clock");
  await shot(page, `pending-puzzle-${tag}`);
  await backToList(page);

  // 4a. A tampered run: another Meteor run whose deal is changed on the phone before it is sent.
  await playOffline(page, "snake", 90_000);
  await backToList(page);
  let runs = await idbAll<IdbRun>(page, "runs");
  const tampered = runs.filter((r) => r.type === "snake").sort((a, b) => b.playedAt - a.playedAt)[0]!;
  await idbPut(page, "runs", { ...tampered, puzzle: { ...(tampered.puzzle as object), seed: (Number((tampered.puzzle as Loose)["seed"]) || 0) + 1 } });

  // 4b. An old-stamp pack (Meteor's previous stamp, sealed as the server would) and a run played from it.
  const meteorPack = (await idbAll<IdbPack>(page, "packs")).find((p) => p.type === "snake")!;
  const deal = meteorPack.deals[0]!;
  const rev = Number((deal.puzzle as Loose)["snakeRev"]);
  const oldPuzzle = { ...(deal.puzzle as Loose), snakeRev: rev - 1 } as unknown as PuzzleData;
  const priv = await unseal(deal.sealed);
  const oldSealed = await seal({ ...priv, __pub: await pubDigest(oldPuzzle) });
  await idbPut(page, "packs", { type: "snake", stamp: stampSignature(oldPuzzle), builtFor: "an older build", deals: [{ id: deal.id, puzzle: oldPuzzle, sealed: oldSealed }], updatedAt: Date.now() });
  await playOffline(page, "snake", 90_000);
  await backToList(page);
  runs = await idbAll<IdbRun>(page, "runs");
  const oldRun = runs.find((r) => r.type === "snake" && Number((r.puzzle as Loose)["snakeRev"]) === rev - 1);
  check(!!oldRun && oldRun.stamp === stampSignature(oldPuzzle), "a run from an old-stamp pack keeps its stamp");
  check(runs.length === 5 && runs.every((r) => r.status === "queued"), "five runs queued offline", `${runs.length}`);
  check(runs.every((r) => r.answer.length > 0 && r.sealed && r.packSeed !== null && r.playedAt > 0), "each queued run holds its game, stamp, pack seed, input log and time played");
  check((await page.locator("[data-offline-runs] [data-run-status='queued']").count()) === 5, "Played offline lists the five runs as pending");
  check((await page.locator('[data-card-best][data-pending], [data-none][data-pending]').count()) > 0 || (await page.locator("[data-pending] [data-pending-clock]").count()) > 0, "pending clock on a game's best");

  // 2b. The online-only screens, still offline.
  await page.locator('[data-tab="play"], a[href="/"]').first().click();
  await page.locator("[data-offline-state]").waitFor({ timeout: 10_000 });
  check((await page.locator("[data-offline-state] [data-offline-practice]").count()) === 1, "Play: offline state with Go to Practice");
  await shot(page, `offline-play-${tag}`);
  await page.locator('a[href="/tournaments"]').first().click();
  await page.locator("[data-offline-state]").waitFor({ timeout: 10_000 });
  check(await page.locator("[data-offline-state]").isVisible(), "Tournaments: offline state");
  for (const path of ["/duel/ABCD", "/daily", "/challenge?code=ABCDEF"]) {
    await page.goto(`${ORIGIN}${path}`);
    const shown = await page.locator("[data-offline-page], [data-offline-state]").first().waitFor({ timeout: 15_000 }).then(() => true, () => false);
    check(shown, `${path}: offline state with a way to Practice`);
  }
  await page.locator("[data-offline-practice]").first().click();
  await page.locator("[data-practice-switch]").waitFor({ timeout: 15_000 });
  check(true, "offline page's button opens Practice");

  // 4c. The sign-in expires while offline.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (!/^sb-.*-auth-token$/.test(key)) continue;
      const session = JSON.parse(localStorage.getItem(key)!) as { expires_at: number };
      session.expires_at = Math.floor(Date.now() / 1000) - 60;
      localStorage.setItem(key, JSON.stringify(session));
    }
  });
  const refreshesBefore = auth.refreshes.length;

  // 5. Reconnect.
  gradeRequests.length = 0;
  const reconnectAt = Date.now();
  await ctx.setOffline(false);
  await until("the queue is answered", async () => (await idbAll<IdbRun>(page, "runs")).every((r) => r.status !== "queued"), 60_000);
  runs = await idbAll<IdbRun>(page, "runs");
  const firstGrade = gradeRequests[0]?.at ?? 0;
  const refresh = auth.refreshes.slice(refreshesBefore).find((t) => t >= reconnectAt) ?? 0;
  check(refresh > 0 && refresh <= firstGrade, "the expired sign-in is refreshed before the queue uploads");
  const order = gradeRequests.map((g) => runs.find((r) => g.body.includes(r.sealed.slice(0, 24)))?.playedAt ?? -1);
  check(order.length === 5 && order.every((t, i) => i === 0 || t >= order[i - 1]!), "uploads oldest first", order.join(","));
  const bad = runs.find((r) => r.id === tampered.id)!;
  check(bad.status === "rejected" && bad.score === undefined, "the tampered run is rejected, with no score", bad.status);
  for (const run of runs.filter((r) => r.id !== tampered.id)) {
    const full = mergePuzzle(run.puzzle, (({ __pack: _a, __pub: _b, ...rest }) => rest)(await unseal(run.sealed)));
    const expected = gradeAnswer(full as PuzzleData, run.answer, run.msRemaining).score;
    check(run.status === "confirmed" && run.score === expected, `${run.type} run confirmed with the server's score`, `${run.status} ${run.score} vs ${expected}`);
  }
  // The server takes a pack run only when the sealed digest matches the deal it is sent (the tampered run above is
  // refused for that), so a confirmed old-stamp run was graded on the old-stamp deal; its score is that deal's grade.
  const oldGraded = runs.find((r) => r.id === oldRun?.id);
  const oldExpected = oldGraded
    ? gradeAnswer(mergePuzzle(oldPuzzle, (({ __pack: _a, __pub: _b, ...rest }) => rest)(priv)) as PuzzleData, oldGraded.answer, oldGraded.msRemaining).score
    : -1;
  check(
    !!oldGraded && oldGraded.status === "confirmed" && Number((oldGraded.puzzle as Loose)["snakeRev"]) === rev - 1 && oldGraded.score === oldExpected,
    "the old-stamp run is graded on its own stamp",
    `${oldGraded?.status} ${oldGraded?.score} vs ${oldExpected}`,
  );
  // Bests, markers, the rejected line.
  await page.reload();
  await page.locator("[data-practice-switch]").waitFor({ timeout: 30_000 });
  await showPracticeSide(page, "snake");
  const meteorBest = Math.max(...runs.filter((r) => r.type === "snake" && r.status === "confirmed" && r.stamp === stampSignature(deal.puzzle)).map((r) => r.score ?? 0));
  check(Number(await page.locator('[data-practice-game="snake"] [data-card-best]').getAttribute("data-card-best")) === meteorBest, "Meteor's best is the server's", String(meteorBest));
  check((await page.locator("[data-pending-clock]").count()) === 0, "pending clocks clear");
  check((await page.locator("[data-offline-runs] [data-run-status='rejected']").innerText()).includes("Couldn’t be confirmed"), "the rejected run shows Couldn't be confirmed");
  check((await page.locator("[data-offline-runs] [data-run-status='confirmed']").count()) === 4, "four confirmed runs listed");
  await shot(page, `confirmed-${tag}`);
  await until(
    "the old-stamp pack is replaced",
    async () => {
      const p = (await idbAll<IdbPack>(page, "packs")).find((x) => x.type === "snake");
      return !!p && p.builtFor === currentPracticeStamp("snake") && p.deals.length === PACK_MAX_DEALS && p.deals.every((d) => Number((d.puzzle as Loose)["snakeRev"]) === rev);
    },
    60_000,
  );

  // 6. A new build's worker never interrupts a run in progress.
  const before = builtVersion();
  await startGame(page, "pokersquares");
  const navsAtStart = navigations;
  publishNext = true;
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
  const waited = await until(
    "the new build's worker installs and waits",
    () => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r?.waiting)),
    120_000,
    1000,
  );
  await page.waitForTimeout(4000);
  check(waited && navigations === navsAtStart, "no reload while the run plays");
  check((await controllerVersion(page)) === before, "the old worker stays in control during the run");
  check((await page.locator("[data-arcade-play]").count()) === 1, "the run is still on screen");
  await playPokerSquares(page);
  await page.getByRole("button", { name: "Back", exact: true }).first().waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Back", exact: true }).first().click();
  await until("the new worker takes over on the list", async () => (await controllerVersion(page)) === `${before}${NEXT_SUFFIX}`, 30_000);
  await page.locator("[data-practice-switch]").waitFor({ timeout: 30_000 });
  check(true, "Practice list after the takeover");
  await ctx.setOffline(true);
  await page.reload();
  check(await page.locator("[data-practice-switch]").waitFor({ timeout: 30_000 }).then(() => true, () => false), "offline open on the new build's worker");
  await ctx.setOffline(false);
  publishNext = false;

  check(errors.length === 0, `${tag}: no page errors`, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

/** 375×667: offline open, banner, a pending result and the online-only screens; the install card at both sizes. */
async function smallPass(browser: Browser): Promise<void> {
  const W = 375;
  const H = 667;
  const tag = `${W}x${H}`;
  const auth: AuthLog = { signups: [], refreshes: [] };
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  // Automated browsers top up packs only on request (topUpAllowed in src/lib/offline/packs.ts): this check opts in.
  // A device that has already started practising, at the full pack target (packGrowth.ts): packs as before.
  await ctx.addInitScript(allowPacks, { started: true, level: FULL_LEVEL });
  await stubAuth(ctx, auth);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${ORIGIN}/practice`);
  await until(`${tag}: worker controls the page`, async () => (await controllerVersion(page)) !== null, 120_000);
  await until(`${tag}: Meteor's pack`, async () => (await idbAll<IdbPack>(page, "packs")).some((p) => p.type === "snake" && p.deals.length > 0), 120_000);
  await ctx.setOffline(true);
  await page.reload();
  await page.locator("[data-practice-switch]").waitFor({ timeout: 30_000 });
  check(await page.locator("[data-offline-banner]").isVisible(), `${tag}: offline banner on Practice`);
  const bannerBox = await page.locator("[data-offline-banner]").boundingBox();
  check(!!bannerBox && bannerBox.x >= 0 && bannerBox.x + bannerBox.width <= W && bannerBox.height <= 40, `${tag}: banner one slim line`, JSON.stringify(bannerBox));
  await shot(page, `offline-banner-${tag}`);
  const meteor = await playOffline(page, "snake", 90_000);
  check(meteor === "queued", `${tag}: Meteor offline queued`);
  const actions = await page.locator("[data-practice-reveal-actions]").boundingBox();
  check(!!actions && actions.y + actions.height <= H, `${tag}: result's buttons on screen`);
  await shot(page, `pending-arcade-${tag}`);
  await backToList(page);
  await page.locator('a[href="/"]').first().click();
  check(await page.locator("[data-offline-state]").waitFor({ timeout: 10_000 }).then(() => true, () => false), `${tag}: Play offline state`);
  const go = await page.locator("[data-offline-practice]").boundingBox();
  check(!!go && go.y + go.height <= H, `${tag}: Go to Practice on screen`);
  await shot(page, `offline-play-${tag}`);
  await ctx.setOffline(false);
  check(errors.length === 0, `${tag}: no page errors`, errors.slice(0, 3).join(" | "));
  await ctx.close();

  // The install card: iPhone Safari outside a home-screen app, at both sizes; dismissed for good.
  for (const [w, h] of [
    [414, 896],
    [375, 667],
  ] as const) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, userAgent: IPHONE_UA, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await stubAuth(c, { signups: [], refreshes: [] });
    const p = await c.newPage();
    await p.goto(`${ORIGIN}/practice`);
    await p.locator("[data-practice-switch]").waitFor({ timeout: 30_000 });
    const card = p.locator("[data-offline-install-card]");
    check(await card.isVisible(), `${w}x${h}: install card on iPhone Safari`);
    const box = await card.boundingBox();
    check(!!box && box.x >= 0 && box.x + box.width <= w, `${w}x${h}: install card fits`);
    await shot(p, `install-card-${w}x${h}`);
    await card.getByRole("button", { name: "Dismiss" }).click();
    check(!(await card.isVisible()), `${w}x${h}: install card dismissed`);
    await p.reload();
    await p.locator("[data-practice-switch]").waitFor({ timeout: 30_000 });
    check(!(await card.isVisible()), `${w}x${h}: install card stays dismissed`);
    await c.close();
  }
  // Not on a desktop browser or a home-screen app.
  const desktop = await browser.newContext({ viewport: { width: 414, height: 896 } });
  await stubAuth(desktop, { signups: [], refreshes: [] });
  const dp = await desktop.newPage();
  await dp.goto(`${ORIGIN}/practice`);
  await dp.locator("[data-practice-switch]").waitFor({ timeout: 30_000 });
  check(!(await dp.locator("[data-offline-install-card]").isVisible()), "no install card off iPhone Safari");
  await desktop.close();
}

let server: ChildProcess | null = null;
let proxy: { stop: () => void } | null = null;
try {
  if (!NO_BUILD || !existsSync(`${OUT}/public/sw.js`)) build();
  server = await startServer();
  proxy = startProxy();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  try {
    await fullPass(browser);
    await smallPass(browser);
    await lazyPass(browser);
  } finally {
    await browser.close();
  }
} catch (error) {
  failures.push(`crashed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
} finally {
  proxy?.stop();
  server?.kill();
}

for (const name of passes) console.log(`PASS ${name}`);
for (const line of report) console.log(line);
for (const failure of failures) console.log(`FAIL ${failure}`);
console.log(`offline-check: ${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
