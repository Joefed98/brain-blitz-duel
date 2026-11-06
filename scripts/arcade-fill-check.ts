/**
 * Arcade screen fill-ins and seamless arena edges (17 Oct 2026, display only).
 *
 * Every active arcade game's play screen, plus Pull! (item 26: its edges), Bonk (item 27: the scenery
 * under its field) and Mixed Signals (Polish batch S: its fill under the board) (arenaScene.renderer.ts, arenaFills.renderer.ts: each game's backdrop runs
 * from the world's edges out to the screen's) is opened in practice with its run frozen and drawn as an
 * iPhone 11 home-screen app (414 × 896, 48 / 34 px insets, laid out 414 × 848, then the window grown to
 * the whole screen, as arcade-device-bottom-check does) and at 390 × 844. It fails if
 *  - the backdrop canvas is missing, takes touches, or does not reach the screen's bottom and sides;
 *  - a black strip is left: any pixel row below the world (or, where the game fills its sides, any
 *    column beside it; and the gap above a centred world) whose uncovered pixels (controls and the
 *    header excepted) are 60 % or more the screen edge's black #06080F (within 3 per channel);
 *  - a border line or seam remains: on each world edge that meets a fill, the colour across the edge
 *    (the 4 px inside against the 4 px outside, averaged along it) steps by more than SEAM_MAX on
 *    average per channel, or a line runs along it: within 8 px of the edge, a 1 px row (or column)
 *    that differs from the rows 2 px either side, in the same direction, by more than LINE_MAX in
 *    luminance across 60 % or more of the edge. Meteor's border (#97) is exempt, as asked.
 * With prefers-reduced-motion the moving fills (Pinball, Rally, Tempo, Meteor, Jaywalk, Roofbound,
 * Fission) must hold still: the backdrop's pixels may not change over 1.5 s of the page's clock.
 *
 * Each game loads once (~15 s); --part=k/n checks every n-th game from the k-th (CI runs it in thirds).
 *
 *   bun scripts/arcade-fill-check.ts [games…] [--part=k/n] [--url=<origin>] [--shots=<dir>] [--verbose]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "playwright";
import { createCanvas, loadImage } from "@napi-rs/canvas";

import { ACTIVE_ARCADE_GAMES } from "../src/lib/arcade/arcadeFxGames.renderer";
import { ARENA_FILL_MOVING, ARENA_FILL_SIDES } from "../src/lib/arcade/arenaFills.renderer";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import type { PuzzleType } from "../src/lib/duel/types";
import { freezeClock, gotoRetried, warmUp } from "./browser-load";
import { BROWSER, DEVICE_INIT, IPHONE11_APP, emulateDevice, type DeviceConfig } from "./device-emulation";
import { showPracticeSide } from "./practice-side-lib";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const VERBOSE = args.includes("--verbose");
const SHOTS = opt("shots");
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 5199;
const EDGE: [number, number, number] = [6, 8, 15];
const BLACK_TOLERANCE = 3;
/** A row (or column) at least this share of the screen edge's black is a black strip. */
const BLACK_SHARE = 0.6;
/** Most the average colour may step across a world edge that meets a fill, per channel. */
export const SEAM_MAX = 30;
/** A 1 px line this much brighter or darker than both rows 2 px away, across LINE_SHARE of the edge, is a border. */
export const LINE_MAX = 28;
const LINE_SHARE = 0.6;
/** Edge lines kept on purpose (item 25): Meteor's pulsing border. */
const BORDER_KEPT = new Set(["snake"]);

const APP_WINDOW: DeviceConfig = { ...IPHONE11_APP, key: "iphone11-app-window", h: IPHONE11_APP.screenH };
const CONFIGS = [
  { key: "390", label: "390x844" },
  { key: "app", label: "iPhone 11 home-screen app 414x896" },
] as const;

const SEED_RANDOM = `(() => {
  let s = 20261013 >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { localStorage.setItem("duelz-arrow-control", "arrows"); } catch { /* ignore */ }
})();`;

type Rect = { left: number; top: number; right: number; bottom: number };
interface Probe {
  W: number;
  H: number;
  world: Rect | null;
  slot: Rect | null;
  backdrop: (Rect & { events: string }) | null;
  covered: Rect[];
  centred: boolean;
}

/** In-page: the world, the backdrop canvas and every box whose pixels are content (controls, header text). */
function probe(): Probe {
  const r = (el: Element | null | undefined): Rect | null => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
  };
  const shell = document.querySelector("[data-arcade-play]");
  const slot = shell?.querySelector("[data-arena-slot]");
  const world = slot?.querySelector(":scope > [data-game-arena]");
  const backdrop = shell?.querySelector("[data-arena-scene]");
  const covered: Rect[] = [];
  const shown = (el: Element) => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    }
    return true;
  };
  for (const el of shell?.querySelectorAll("[data-arcade-header] *, [data-game-stage] :is(button, [role='button'], [data-game-controls], p, span), .fx-layer > *") ?? []) {
    if (slot?.contains(el) && !el.closest("[data-game-controls]")) continue;
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1 || !shown(el)) continue;
    covered.push({ left: b.left - 4, top: b.top - 4, right: b.right + 4, bottom: b.bottom + 4 });
  }
  const shellBox = shell?.getBoundingClientRect();
  return {
    W: shellBox?.width ?? window.innerWidth,
    H: shellBox?.bottom ?? window.innerHeight,
    world: r(world),
    slot: r(slot),
    backdrop: backdrop ? { ...r(backdrop)!, events: getComputedStyle(backdrop).pointerEvents } : null,
    covered,
    centred: Boolean(slot?.hasAttribute("data-arena-centred")),
  };
}

function serverFnName(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
  } catch {
    return id;
  }
}

async function startServer(): Promise<{ origin: string; proc: ChildProcess | null }> {
  const url = opt("url");
  if (url) return { origin: url.replace(/\/$/, ""), proc: null };
  const proc = spawn("npx", ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore", detached: true });
  const origin = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${origin}/practice`)).ok) return { origin, proc };
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("dev server did not start");
}

interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

async function grab(page: Page, H: number): Promise<Pixels> {
  const W = page.viewportSize()!.width;
  const img = await loadImage(await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } }));
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
  return { data: data as unknown as Uint8ClampedArray, width, height };
}

const inside = (x: number, y: number, rects: Rect[]) => rects.some((c) => x >= c.left && x < c.right && y >= c.top && y < c.bottom);
const at = (p: Pixels, x: number, y: number) => (y * p.width + x) * 4;
const isEdge = (p: Pixels, i: number) =>
  Math.abs(p.data[i]! - EDGE[0]) <= BLACK_TOLERANCE && Math.abs(p.data[i + 1]! - EDGE[1]) <= BLACK_TOLERANCE && Math.abs(p.data[i + 2]! - EDGE[2]) <= BLACK_TOLERANCE;
const lum = (p: Pixels, i: number) => 0.2126 * p.data[i]! + 0.7152 * p.data[i + 1]! + 0.0722 * p.data[i + 2]!;

/** The black strips left in a region: rows (or columns) mostly the screen edge's black. */
function blackLines(p: Pixels, region: Rect, covered: Rect[], vertical: boolean): number[] {
  const out: number[] = [];
  const x0 = Math.max(0, Math.round(region.left)), x1 = Math.min(p.width, Math.round(region.right));
  const y0 = Math.max(0, Math.round(region.top)), y1 = Math.min(p.height, Math.round(region.bottom));
  const [a0, a1, b0, b1] = vertical ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
  for (let a = a0; a < a1; a++) {
    let tested = 0;
    let black = 0;
    for (let b = b0; b < b1; b++) {
      const [x, y] = vertical ? [a, b] : [b, a];
      if (inside(x, y, covered)) continue;
      tested++;
      if (isEdge(p, at(p, x, y))) black++;
    }
    if (tested >= 12 && black / tested >= BLACK_SHARE) out.push(a);
  }
  return out;
}

/**
 * One world edge meeting a fill: the step across it and any 1 px line along it. `side` is which edge;
 * `span` the run along the edge to sample.
 */
function edgeProblems(p: Pixels, world: Rect, side: "bottom" | "top" | "left" | "right", covered: Rect[], border: boolean): string[] {
  const problems: string[] = [];
  const horizontal = side === "bottom" || side === "top";
  const edge = Math.round(side === "bottom" ? world.bottom : side === "top" ? world.top : side === "left" ? world.left : world.right);
  const inward = side === "bottom" || side === "right" ? -1 : 1;
  const s0 = Math.max(0, Math.ceil(horizontal ? world.left : world.top));
  const s1 = Math.min(horizontal ? p.width : p.height, Math.floor(horizontal ? world.right : world.bottom));
  const pixel = (along: number, across: number) => (horizontal ? at(p, along, across) : at(p, across, along));
  const ok = (along: number, across: number) => {
    const [x, y] = horizontal ? [along, across] : [across, along];
    return x >= 0 && y >= 0 && x < p.width && y < p.height && !inside(x, y, covered);
  };
  // The step across the edge: 4 px each side (1 px clear of the edge itself).
  const mean = (from: number, to: number) => {
    const sum = [0, 0, 0];
    let n = 0;
    for (let across = Math.min(from, to); across <= Math.max(from, to); across++)
      for (let along = s0; along < s1; along++) {
        if (!ok(along, across)) continue;
        const i = pixel(along, across);
        sum[0] += p.data[i]!;
        sum[1] += p.data[i + 1]!;
        sum[2] += p.data[i + 2]!;
        n++;
      }
    return n ? sum.map((v) => v / n) : null;
  };
  // Pixel rows: inside the world are edge+inward*k (k ≥ 1 for bottom/right where edge is exclusive).
  const inRow = (k: number) => (inward < 0 ? edge - k : edge + k - 1);
  const outRow = (k: number) => (inward < 0 ? edge + k - 1 : edge - k);
  const a = mean(inRow(2), inRow(5));
  const b = mean(outRow(2), outRow(5));
  if (a && b) {
    const step = (Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!)) / 3;
    if (step > SEAM_MAX)
      problems.push(`seam at the world's ${side} edge: the colour steps ${step.toFixed(0)} per channel across it (inside rgb(${a.map((v) => v.toFixed(0)).join(",")}), outside rgb(${b.map((v) => v.toFixed(0)).join(",")}); most ${SEAM_MAX})`);
  }
  if (border) return problems;
  // A line along the edge: rows from 8 px inside to 2 px outside.
  for (let k = -2; k <= 8; k++) {
    const row = k >= 1 ? inRow(k) : outRow(1 - k);
    let tested = 0;
    let line = 0;
    for (let along = s0; along < s1; along++) {
      if (!ok(along, row) || !ok(along, row - 2) || !ok(along, row + 2)) continue;
      tested++;
      const here = lum(p, pixel(along, row));
      const d1 = here - lum(p, pixel(along, row - 2));
      const d2 = here - lum(p, pixel(along, row + 2));
      if ((d1 > LINE_MAX && d2 > LINE_MAX) || (d1 < -LINE_MAX && d2 < -LINE_MAX)) line++;
    }
    if (tested >= 40 && line / tested >= LINE_SHARE) {
      problems.push(`border line along the world's ${side} edge, ${k >= 1 ? `${k}px inside` : `${1 - k}px outside`} (${Math.round((100 * line) / tested)}% of it)`);
      break;
    }
  }
  return problems;
}

async function openGame(page: Page, origin: string, game: PuzzleType): Promise<void> {
  await gotoRetried(page, `${origin}/practice`, game, { waitUntil: "domcontentloaded" });
  await showPracticeSide(page, game);
  const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
  await button.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1200);
  await button.click();
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 90_000 });
  return ready.click();
}

async function main() {
  if (!existsSync(CHROMIUM)) {
    console.log(`FAIL: environment: no Chromium at ${CHROMIUM} (set PLAYWRIGHT_CHROMIUM)`);
    process.exit(1);
  }
  const named = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
  // Every active arcade game, plus Pull! (item 26: its edges) and Bonk (item 27: the scenery below its field).
  let games: PuzzleType[] = named.length ? named : [...(ACTIVE_ARCADE_GAMES as readonly string[] as PuzzleType[]), "clayshoot", "whack", "stroop"];
  const part = opt("part");
  if (part) {
    const [k, n] = part.split("/").map(Number) as [number, number];
    if (!(n >= 1 && k >= 1 && k <= n)) {
      console.log(`FAIL: bad --part=${part}`);
      process.exit(1);
    }
    games = games.filter((_, i) => i % n === k - 1);
    console.log(`part ${k}/${n}: ${games.join(", ")}`);
  }
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const { origin, proc } = await startServer();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const failures: string[] = [];
  try {
    await warmUp(browser, `${origin}/practice`, (page) => showPracticeSide(page, games[0]!, 180_000).then(() => page.getByRole("button", { name: gameDisplayName(games[0]!), exact: true }).first().waitFor({ timeout: 180_000 })), { verbose: VERBOSE });
    for (const game of games) {
      const mine: string[] = [];
      // One page per game, its run frozen: 390x844 first, then the iPhone 11 home-screen app, then (moving
      // fills only) the same with prefers-reduced-motion, where the page's clock runs 1.5 s.
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
      await context.addInitScript(SEED_RANDOM);
      await context.addInitScript(DEVICE_INIT);
      const page = await context.newPage();
      await page.clock.install();
      page.on("pageerror", (e) => mine.push(`${game}: page error ${String(e.message ?? e).split("\n")[0]}`));
      await page.route("**/_serverFn/**", async (route) => {
        const request = route.request();
        const body = request.postData() ?? "";
        if (/practiceGenerate/.test(serverFnName(request.url())))
          return route.continue({ postData: body.replace(/("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/, '$1{"t":2,"s":2}') });
        return route.continue();
      });
      try {
        await openGame(page, origin, game);
        await page.locator("[data-arcade-play] [data-arena-slot] > [data-game-arena]").first().waitFor({ timeout: 30_000 });
        await freezeClock(page);
        await page.waitForTimeout(700);
        const configs = [...CONFIGS, ...(ARENA_FILL_MOVING.includes(game as never) ? [{ key: "still", label: "iPhone 11 home-screen app, prefers-reduced-motion" } as const] : [])];
        for (const config of configs) {
          const where = `${game} (${gameDisplayName(game)}) ${config.label}`;
          if (config.key === "app") {
            await emulateDevice(page, IPHONE11_APP);
            await page.waitForTimeout(300);
            await emulateDevice(page, APP_WINDOW);
            // A resized canvas is blank until the game's next frame: let a few frames run (the run barely moves).
            await page.clock.runFor(50);
          } else if (config.key === "still") {
            await page.emulateMedia({ reducedMotion: "reduce" });
            await page.clock.runFor(100);
          }
          await page.waitForTimeout(300);
          const m = await page.evaluate(probe);
          if (!m.world || !m.slot) {
            mine.push(`${where}: no arcade play screen`);
            break;
          }
          if (SHOTS) writeFileSync(join(SHOTS, `${game}-${config.key}.png`), await page.screenshot({ clip: { x: 0, y: 0, width: m.W, height: m.H } }));
          if (!m.backdrop) {
            mine.push(`${where}: no backdrop canvas ([data-arcade-play] > [data-arena-scene])`);
            continue;
          }
          if (m.backdrop.events !== "none") mine.push(`${where}: the backdrop takes touches (pointer-events ${m.backdrop.events})`);
          if (m.backdrop.bottom < m.H - 0.5 || m.backdrop.left > 0.5 || m.backdrop.right < m.W - 0.5)
            mine.push(`${where}: the backdrop (${m.backdrop.left},${m.backdrop.top}–${m.backdrop.right},${m.backdrop.bottom}) does not reach the screen's edges (${m.W}x${m.H})`);
          const pixels = await grab(page, m.H);
          if (config.key === "still") {
            await page.clock.runFor(1500);
            await page.waitForTimeout(200);
            const after = await page.evaluate(probe);
            if (!after.world) break;
            const later = await grab(page, m.H);
            let changed = 0;
            for (let y = Math.ceil(m.world.bottom) + 1; y < pixels.height; y++)
              for (let x = 0; x < pixels.width; x++) {
                if (inside(x, y, m.covered) || inside(x, y, after.covered)) continue;
                const i = at(pixels, x, y);
                if (Math.abs(pixels.data[i]! - later.data[i]!) + Math.abs(pixels.data[i + 1]! - later.data[i + 1]!) + Math.abs(pixels.data[i + 2]! - later.data[i + 2]!) > 6) changed++;
              }
            if (changed) mine.push(`${where}: the fill moved under reduced motion (${changed} pixel(s) changed over 1.5 s)`);
            continue;
          }
          const w = m.world;
          // Below the world, to the screen's bottom.
          const below = blackLines(pixels, { left: 0, top: w.bottom + 1, right: m.W, bottom: m.H }, m.covered, false);
          if (below.length) mine.push(`${where}: black strip below the world: ${below.length} row(s) mostly #06080F, first at y ${below[0]}`);
          // Above a centred world (between the header and the world).
          if (m.centred && w.top - m.slot.top > 2) {
            const above = blackLines(pixels, { left: 0, top: m.slot.top, right: m.W, bottom: w.top - 1 }, m.covered, false);
            if (above.length) mine.push(`${where}: black strip above the centred world: ${above.length} row(s), first at y ${above[0]}`);
          }
          if (ARENA_FILL_SIDES.includes(game as never)) {
            const cols = [
              ...blackLines(pixels, { left: 0, top: w.top, right: w.left - 1, bottom: w.bottom }, m.covered, true),
              ...blackLines(pixels, { left: w.right + 1, top: w.top, right: m.W, bottom: w.bottom }, m.covered, true),
            ];
            if (cols.length) mine.push(`${where}: black strip beside the world: ${cols.length} column(s) mostly #06080F, first at x ${cols[0]}`);
          }
          const border = BORDER_KEPT.has(game);
          if (m.H - w.bottom > 3) for (const p of edgeProblems(pixels, w, "bottom", m.covered, border)) mine.push(`${where}: ${p}`);
          if (m.centred && w.top - m.slot.top > 3) for (const p of edgeProblems(pixels, w, "top", m.covered, border)) mine.push(`${where}: ${p}`);
          if (w.left > 3) for (const p of edgeProblems(pixels, w, "left", m.covered, border)) mine.push(`${where}: ${p}`);
          if (m.W - w.right > 3) for (const p of edgeProblems(pixels, w, "right", m.covered, border)) mine.push(`${where}: ${p}`);
          if (VERBOSE) console.log(`  ${where}: world ${w.left},${w.top}–${w.right},${w.bottom} on ${m.W}x${m.H}`);
        }
      } catch (error) {
        mine.push(`${game}: ${String((error as Error).message ?? error).split("\n")[0]}`);
      } finally {
        await emulateDevice(page, BROWSER).catch(() => {});
        await context.close();
      }
      console.log(`${mine.length ? "FAIL" : "PASS"} ${game} (${gameDisplayName(game)}): ${mine.length ? `${mine.length} problem(s)` : "no black strip, no border line or seam at 414x896 (home-screen app) and 390x844"}`);
      for (const f of mine) console.log(`  ${f}`);
      failures.push(...mine);
    }
  } finally {
    await browser.close();
    if (proc?.pid) process.kill(-proc.pid);
  }
  if (failures.length) {
    console.log(`FAIL: ${failures.length} problem(s): a black strip, a border line or seam, or a fill that moves under reduced motion`);
    process.exit(1);
  }
  console.log(`PASS: ${games.length} arcade games: backdrops to the screen's edges, no black strip below (or beside, where filled) the world, no border line or seam at its edges; moving fills hold still under reduced motion`);
}

await main();
