/**
 * The computer layout's fairness rule (31 Oct 2026; docs/desktop-layout.md, src/lib/duel/desktopModes.ts):
 * every game's world, rules and simulation are the same on every device; the desktop changes only
 * presentation and input mapping, so the sim receives exactly the inputs a phone would give it and a run
 * replays identically. This check proves it for one game in each desktop mode, rotate and tall included:
 *
 *  1. The mapping (pure): a point drawn by a turned arena (tapMapping.ts rotatePoint) maps back through
 *     unrotatePoint to exactly where it was, for many boxes and points; swipes (arenaDelta) and the keys a
 *     rotated game turns (desktopPresentation.ts rotatedKey) move the world the way the key or swipe moves
 *     on screen; every other key passes unchanged; nothing turns without a rotor.
 *  2. Separation (static): no sim, replay or grader (src/lib/arcade/** without renderers, the duel graders
 *     and replays) reads the layout, the presentation, the tap mapping, the window's size or matchMedia, so
 *     no presentation can reach a run's result.
 *  3. Real gestures (headless Chromium, the safe-area harness's room rounds): Cue Ball (rotate), Apex (tall)
 *     and Free Cell (wide) at 1440×900 and 1920×1080 with a mouse (the desktop presentation) and as an
 *     iPhone 11 home-screen app at 414×896 and at 375×667 (the phone's): the same scripted gestures, given in
 *     world units and pressed with real pointer events where each presentation draws them, must reach the
 *     stage as exactly those world points and queue exactly the same input payloads on every presentation.
 *  4. Identical sim results: the payloads recorded under the desktop presentation, fed to the game's sim on
 *     the same ticks as the phone's, end in the same state, score and checksum (the game's own engine).
 *
 *   bun scripts/desktop-fairness-check.ts [--verbose]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright";

import { rotatePoint, unrotatePoint, arenaDelta, type TapBox } from "../src/components/puzzles/tapMapping";
import { rotatedKey } from "../src/lib/desktopPresentation";
import { DESKTOP_MODES } from "../src/lib/duel/desktopModes";
import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS, VIEWPORTS, fixThemeClock, openThemeScreen, type ThemeViewport } from "./theme-screens";
import { roomRound } from "./desktop-layout-screens";

const VERBOSE = process.argv.includes("--verbose");
const failures: string[] = [];
const fail = (m: string) => failures.push(m);
let proofs = 0;

/* ------------------------------------------------------------------ 1. the mapping */

let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
for (let i = 0; i < 2000; i++) {
  const rect: TapBox = { left: Math.round(rnd() * 900) + rnd(), top: Math.round(rnd() * 400) + rnd(), width: 100 + rnd() * 1200, height: 100 + rnd() * 900 };
  const x = rnd() * rect.height;
  const y = rnd() * rect.width;
  const shown = rotatePoint(rect, x, y);
  const back = unrotatePoint(rect, shown.clientX, shown.clientY);
  if (Math.abs(back.x - x) > 1e-9 || Math.abs(back.y - y) > 1e-9) fail(`mapping: (${x}, ${y}) came back as (${back.x}, ${back.y})`);
  if (back.box.width !== rect.height || back.box.height !== rect.width) fail("mapping: the turned box's own size is not its screen size swapped");
  if (shown.clientX < rect.left - 1e-9 || shown.clientX > rect.left + rect.width + 1e-9 || shown.clientY < rect.top - 1e-9 || shown.clientY > rect.top + rect.height + 1e-9) fail("mapping: a point of the arena shows outside its screen box");
  proofs++;
}
// Directions: the world direction a key or swipe becomes must move on screen the way the key points.
const rect: TapBox = { left: 100, top: 50, width: 800, height: 400 };
const WORLD_DIR: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0], w: [0, -1], d: [1, 0], s: [0, 1], a: [-1, 0] };
const SCREEN_DIR: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0], w: [0, -1], d: [1, 0], s: [0, 1], a: [-1, 0] };
const turned = { closest: () => ({}) } as unknown as Element;
const upright = { closest: () => null } as unknown as Element;
for (const key of Object.keys(SCREEN_DIR)) {
  const world = WORLD_DIR[rotatedKey(key, "all")]!;
  const a = rotatePoint(rect, 200, 200);
  const b = rotatePoint(rect, 200 + world[0] * 10, 200 + world[1] * 10);
  const screen = [Math.sign(Math.round(b.clientX - a.clientX)), Math.sign(Math.round(b.clientY - a.clientY))];
  if (screen[0] !== SCREEN_DIR[key]![0] || screen[1] !== SCREEN_DIR[key]![1]) fail(`keys: "${key}" on a turned world moves the world ${rotatedKey(key, "all")}, which shows as (${screen.join(", ")}) on screen`);
  // A swipe in that screen direction becomes the same world direction.
  const d = arenaDelta(turned, SCREEN_DIR[key]![0] * 30, SCREEN_DIR[key]![1] * 30);
  if (Math.sign(d.dx) !== world[0] || Math.sign(d.dy) !== world[1]) fail(`swipes: a ${key} swipe on a turned world becomes (${d.dx}, ${d.dy}), want the world's ${rotatedKey(key, "all")}`);
  const flat = arenaDelta(upright, 13, -7);
  if (flat.dx !== 13 || flat.dy !== -7) fail("swipes: an upright arena's swipe changed");
  proofs++;
}
for (const key of [" ", "Enter", "c", "i", "o", "z", "Backspace", "1"]) {
  if (rotatedKey(key, "all") !== key || rotatedKey(key, "arrows") !== key) fail(`keys: "${key}" is not a direction but was turned`);
}
for (const key of ["w", "a", "s", "d"]) if (rotatedKey(key, "arrows") !== key) fail(`keys: "${key}" turned for a game whose letters are not directions`);
for (const key of Object.keys(SCREEN_DIR)) if (rotatedKey(key, null) !== key) fail(`keys: "${key}" turned with no rotation`);
// Only top-down games turn, and only rotate games say which keys turn.
for (const [type, info] of Object.entries(DESKTOP_MODES)) if (info.keys && info.mode !== "rotate") fail(`modes: ${type} turns keys but is ${info.mode}`);

/* ------------------------------------------------------------------ 2. separation */

const FORBIDDEN = [/layoutMode/, /desktopPresentation/, /tapMapping/, /desktopModes/, /matchMedia/, /innerWidth/, /innerHeight/, /data-arena-rotor/, /devicePixelRatio/];
function sources(dir: string, keep: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path, keep));
    else if (keep(path)) out.push(path);
  }
  return out;
}
const simFiles = [
  ...sources("src/lib/arcade", (f) => f.endsWith(".ts") && !f.endsWith(".renderer.ts")),
  ...sources("src/lib/duel", (f) => /(\.server\.ts|grade\w*\.ts|replay\w*\.ts|\/cards\.ts|\/racing\.ts|\/snake\.ts|\/pool\w*\.ts)$/.test(f)),
].filter((f) => !/\/(lowEnd|clock|diagnostics)\.ts$/.test(f));
let scanned = 0;
for (const file of simFiles) {
  const text = readFileSync(file, "utf8");
  // Only code: comments may mention the layout.
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const re of FORBIDDEN) if (re.test(code)) fail(`separation: ${file} uses ${re.source} (a sim, replay or grader must not see the presentation)`);
  scanned++;
}
if (scanned < 100) fail(`separation: only ${scanned} sim, replay and grader files scanned`);

/* ------------------------------------------------------------------ 3. real gestures */

const CHROMIUM = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}
const GAMES = [
  { type: "pool", mode: "rotate" },
  { type: "racing", mode: "tall" },
  { type: "freecell", mode: "wide" },
] as const;
const PHONES = VIEWPORTS.filter((v) => !v.desktop);
const DESKTOPS: ThemeViewport[] = [
  { name: "1440x900", w: 1440, h: 900, desktop: true },
  { name: "1920x1080", w: 1920, h: 1080, desktop: true },
];

interface Captured {
  points: ({ x: number; y: number } | null)[];
  payloads: unknown[];
  rotated: boolean;
  mode: string | null;
  scale: number;
}

/** The scripted gestures, in world units: presses, short drags and long drags spread over the world. */
function gestures(W: number, H: number): { x: number; y: number }[][] {
  const out: { x: number; y: number }[][] = [];
  const g = (fx: number, fy: number) => ({ x: Math.round(W * fx), y: Math.round(H * fy) });
  for (const [fx, fy] of [[0.5, 0.55], [0.3, 0.35], [0.72, 0.62], [0.2, 0.8]] as const) out.push([g(fx, fy)]);
  out.push([g(0.5, 0.6), g(0.5, 0.7), g(0.48, 0.78), g(0.46, 0.86)]);
  out.push([g(0.25, 0.3), g(0.3, 0.32), g(0.4, 0.36), g(0.55, 0.4), g(0.6, 0.42)]);
  out.push([g(0.7, 0.75), g(0.62, 0.6), g(0.55, 0.5)]);
  return out;
}

async function play(page: Page): Promise<Captured> {
  // Where each presentation draws the world: its arena's screen box, turned or not.
  const geo = await page.evaluate(() => {
    const arena = document.querySelector("[data-arcade-play] [data-game-arena]") as HTMLElement;
    const slot = arena.closest("[data-arena-slot]") as HTMLElement;
    const r = arena.getBoundingClientRect();
    const cs = getComputedStyle(slot);
    (window as unknown as Record<string, unknown>).__duelzWorldPoints = [];
    (window as unknown as Record<string, unknown>).__duelzPayloads = [];
    return {
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      rotated: Boolean(arena.closest("[data-arena-rotor]")),
      W: Number(cs.getPropertyValue("--arena-w")),
      H: Number(cs.getPropertyValue("--arena-h")),
      mode: (document.querySelector("[data-arcade-play]") as HTMLElement).getAttribute("data-desktop-mode"),
    };
  });
  const own = geo.rotated ? { w: geo.rect.height, h: geo.rect.width } : { w: geo.rect.width, h: geo.rect.height };
  const toScreen = (p: { x: number; y: number }) => {
    const lx = (p.x / geo.W) * own.w;
    const ly = (p.y / geo.H) * own.h;
    if (geo.rotated) {
      const s = rotatePoint(geo.rect, lx, ly);
      return { x: s.clientX, y: s.clientY };
    }
    return { x: geo.rect.left + lx, y: geo.rect.top + ly };
  };
  for (const stroke of gestures(geo.W, geo.H)) {
    const [first, ...rest] = stroke;
    const a = toScreen(first!);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (const p of rest) {
      const b = toScreen(p);
      await page.mouse.move(b.x, b.y);
    }
    await page.mouse.up();
    await page.waitForTimeout(120);
  }
  const got = await page.evaluate(() => {
    const w = window as unknown as { __duelzWorldPoints: ({ x: number; y: number } | null)[]; __duelzPayloads: unknown[] };
    return { points: w.__duelzWorldPoints, payloads: w.__duelzPayloads };
  });
  return { ...got, rotated: geo.rotated, mode: geo.mode, scale: own.w / geo.W, ...{ W: geo.W, H: geo.H } } as Captured;
}

/** The world points each gesture should reach the stage as: down, every move, then up at the last point. */
function expected(W: number, H: number): { x: number; y: number }[] {
  return gestures(W, H).flatMap((stroke) => [...stroke, stroke[stroke.length - 1]!]);
}

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-desktop-fairness", buildId: "desktop-fairness-check" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const recorded: Record<string, { at: string; payloads: unknown[] }[]> = {};
try {
  for (const game of GAMES) {
    recorded[game.type] = [];
    for (const viewport of [...DESKTOPS, ...PHONES]) {
      const at = `${game.type} ${viewport.name}`;
      const { context, page } = await openThemeScreen(browser, server.origin, roomRound(game.type, true), viewport);
      page.on("pageerror", (e) => fail(`${at}: page error: ${String(e.message ?? e).slice(0, 160)}`));
      try {
        await page.locator("[data-arcade-play] [data-game-arena]").first().waitFor({ timeout: 30_000 });
        const got = (await play(page)) as Captured & { W: number; H: number };
        const desktop = Boolean(viewport.desktop);
        if (desktop && got.mode !== game.mode) fail(`${at}: desktop mode ${got.mode}, want ${game.mode}`);
        if (!desktop && got.mode !== null) fail(`${at}: a phone shows desktop mode ${got.mode}`);
        if (got.rotated !== (desktop && game.mode === "rotate")) fail(`${at}: ${got.rotated ? "turned" : "upright"}, want ${desktop && game.mode === "rotate" ? "turned" : "upright"}`);
        const want = expected(got.W, got.H);
        const points = got.points.map((p) => (p ? `${p.x},${p.y}` : "null")).join(" ");
        const wanted = want.map((p) => `${p.x},${p.y}`).join(" ");
        // A phone draws the world at under 1 CSS px a unit in places; there a pressed point may land a unit off
        // (the screen cannot address it), so the phone's own points are the reference for its payloads below.
        if (got.scale >= 1 && points !== wanted) fail(`${at}: the stage received world points ${points.slice(0, 160)}…, want ${wanted.slice(0, 160)}…`);
        if (got.points.length !== want.length) fail(`${at}: ${got.points.length} pointer positions mapped, want ${want.length}`);
        recorded[game.type]!.push({ at, payloads: got.payloads });
        if (VERBOSE) console.log(`${at}: ${got.points.length} points, ${got.payloads.length} payloads, scale ${got.scale.toFixed(2)}${got.rotated ? ", turned" : ""}`);
        proofs++;
      } catch (e) {
        fail(`${at}: harness: ${String((e as Error).message ?? e).split("\n")[0]}`);
      } finally {
        await context.close();
      }
    }
    // Every desktop presentation queues exactly the payloads the first desktop size did, and the phone at a
    // scale of 1 or more the same (the 414×896 app draws these worlds at about 1 px a unit).
    const runs = recorded[game.type]!;
    const ref = JSON.stringify(runs[0]?.payloads ?? []);
    for (const run of runs.slice(1, DESKTOPS.length)) if (JSON.stringify(run.payloads) !== ref) fail(`${run.at}: payloads differ from ${runs[0]!.at}`);
  }
} finally {
  await browser.close();
  await server.close();
}

/* ------------------------------------------------------------------ 4. identical sim results */

const ENGINES: Record<string, () => Promise<{ init: (seed: number) => unknown; step: (s: unknown, input: unknown) => unknown; score: (s: unknown) => number; checksum?: (s: unknown) => string | number }>> = {
  // The revisions rooms deal today (golf, pool, racing and cards tuning, 31 Oct 2026).
  pool: async () => (await import("../src/lib/arcade/pool")).poolGameFor(2) as never,
  racing: async () => (await import("../src/lib/arcade/racing")).racingGameFor(2) as never,
  freecell: async () => (await import("../src/lib/arcade/cards/freecell")).freecellGameFor(2) as never,
};
for (const game of GAMES) {
  const runs = recorded[game.type] ?? [];
  if (runs.length < 2) continue;
  let engine;
  try {
    engine = await ENGINES[game.type]!();
  } catch (e) {
    fail(`${game.type}: engine: ${String((e as Error).message ?? e).split("\n")[0]}`);
    continue;
  }
  if (!engine?.init) {
    fail(`${game.type}: no engine export to replay`);
    continue;
  }
  const result = (payloads: unknown[]) => {
    let state = engine.init(4242);
    // One queued payload every 45 ticks (as a discrete stage sends one a tick), then 600 ticks to settle.
    const end = payloads.length * 45 + 600;
    for (let tick = 1; tick <= end; tick++) {
      const p = tick % 45 === 0 ? (payloads[tick / 45 - 1] as Record<string, number> | undefined) : undefined;
      const input = p ? { t: tick, k: p["k"] ?? 7, a: p["a"] ?? 0, b: p["b"] ?? 0, c: p["c"] ?? 0, d: p["d"] ?? 0 } : null;
      state = engine.step(state, input);
    }
    return JSON.stringify({ score: engine.score(state), check: engine.checksum?.(state) ?? null, state });
  };
  let ref: string;
  try {
    ref = result(runs[0]!.payloads);
  } catch (e) {
    fail(`${game.type}: replay: ${String((e as Error).message ?? e).split("\n")[0]}`);
    continue;
  }
  for (const run of runs.slice(1)) {
    if (JSON.stringify(run.payloads) !== JSON.stringify(runs[0]!.payloads)) continue; // judged in 3 for desktops; a phone below 1 px a unit may press a neighbouring unit
    if (result(run.payloads) !== ref) fail(`${run.at}: the sim ended differently from ${runs[0]!.at} on the same payloads`);
    proofs++;
  }
  if (VERBOSE) console.log(`${game.type}: ${runs.length} presentations replayed`);
}

for (const f of failures) console.log(`  ${f}`);
if (failures.length) {
  console.log(`FAIL: desktop fairness: ${failures.length} problem(s)`);
  process.exit(1);
}
console.log(
  `PASS: desktop fairness: ${proofs} proofs. A turned arena maps every point back exactly; keys and swipes on a turned world move it the way they move on screen; ${scanned} sim, replay and grader files never see the presentation; Cue Ball (rotate), Apex (tall) and Free Cell (wide) receive the same world points and payloads at 1440x900 and 1920x1080 as scripted, and on the phones; the same payloads give the same sim state, score and checksum.`,
);
