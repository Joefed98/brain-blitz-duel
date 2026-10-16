/**
 * Arcade play screens on real iPhone geometry (15 Oct 2026, display only).
 *
 * On a real iPhone 11 (414 × 896 CSS px, a 48 px status-bar / notch inset at the top and a
 * 34 px home bar at the bottom) the home-screen app's arcade play screens ended about 65 px
 * above the bottom of the screen, not 16. The cause is WebKit's standalone layout viewport:
 * with viewport-fit=cover and a black-translucent status bar, a home-screen app is laid out
 * in a viewport short by the top inset (https://bugs.webkit.org/show_bug.cgi?id=254868), drawn
 * from the top of the screen. window.innerHeight and 100dvh are 848, not 896, so the 100dvh
 * shell ended 48 px early and the play column 16 px above that: 896 − 848 + 16 = 64 px.
 *
 * Headless Chromium reproduces that geometry (scripts/device-emulation.ts): the page is laid
 * out in a 414 × 848 viewport (WebKit's short layout viewport) while the screen is 414 × 896,
 * with the 48 / 34 px insets emulated (CDP Emulation.setSafeAreaInsetsOverride), navigator.standalone
 * true (what iOS reports in a home-screen app, and what the app keys on) and display-mode:
 * standalone answered in-page (Chromium cannot emulate that media feature). The physical bottom
 * of the screen is then y = 896, below the viewport; layout boxes are still measured there.
 * The same phone in Safari is a 414 × 896 viewport with the same insets (toolbars collapsed)
 * and a 414 × 715 one with no insets (status bar, address bar and tab bar shown), where the
 * bottom is the visible bottom. An iPhone 14 home-screen app (390 × 844, 47 / 34 px insets,
 * laid out 390 × 797) and the plain 390 × 844 and 375 × 667 viewports run too.
 *
 * For every arcade game and engine game on the arcade stage (the live round in practice, its
 * run frozen), at each of those configurations it fails unless:
 *  - the play column ends exactly 16 px above the physical bottom (inset or not);
 *  - the lowest control under the arena box ends exactly 16 px above it, or, with no controls,
 *    the arena box does;
 *  - the header row starts max(4 px, top inset) down;
 *  - Tilt's world sits centred vertically in its box (its spare height split evenly);
 *  - nothing clips the arena box, the world, the scene canvas (ARENA_SCENE_GAMES) or any control above its own bottom: every
 *    ancestor that clips (overflow other than visible, html and body included) reaches at
 *    least as far down (fix-up of 15 Oct 2026: html and body, 100% of the short viewport and
 *    overflow hidden under game-lock, cut tall worlds and the lowest controls at 848 px);
 *  - the page is not scrolled.
 * It prints every game's box, world and bottom gap per configuration (--json=<path> saves them).
 *
 *   bun scripts/arcade-device-bottom-check.ts [games…] [--part=k/n] [--url=<origin>] [--json=<path>] [--verbose]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

import { ACTIVE_PUZZLE_TYPES, puzzleDef } from "../src/lib/duel/registry";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import type { PuzzleType } from "../src/lib/duel/types";
import { gotoRetried, warmUp } from "./browser-load";
import { DEVICE_INIT, IPHONE11_APP, emulateDevice, type Clip, type DeviceConfig } from "./device-emulation";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const VERBOSE = args.includes("--verbose");
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 5197;
/** The play column and its lowest control end exactly this far above the physical bottom. */
const BOTTOM_PX = 16;

export const CONFIGS: DeviceConfig[] = [
  IPHONE11_APP,
  { key: "iphone11-safari", label: "iPhone 11 Safari, toolbars collapsed (414x896, 48/34 px insets)", w: 414, h: 896, screenH: 896, top: 48, bottom: 34, standalone: false },
  { key: "iphone11-safari-bars", label: "iPhone 11 Safari, toolbars shown (414x715 visible, no insets)", w: 414, h: 715, screenH: 715, top: 0, bottom: 0, standalone: false },
  { key: "iphone14-app", label: "iPhone 14 home-screen app (390x844, 47/34 px insets, laid out 390x797)", w: 390, h: 797, screenH: 844, top: 47, bottom: 34, standalone: true },
  { key: "390x844", label: "390x844, no insets", w: 390, h: 844, screenH: 844, top: 0, bottom: 0, standalone: false },
  { key: "375x667", label: "375x667, no insets", w: 375, h: 667, screenH: 667, top: 0, bottom: 0, standalone: false },
];

/** Seeded Math.random and the arrow control, as bottom-clearance-check; the device comes from DEVICE_INIT. */
const SEED_INIT = `(() => {
  let s = 20261013 >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { localStorage.setItem("duelz-arrow-control", "arrows"); } catch { /* ignore */ }
})();`;

interface Box { top: number; bottom: number; left: number; right: number; width: number; height: number }
interface Geometry {
  shell: Box | null;
  columnEnd: number | null;
  header: Box | null;
  slot: Box | null;
  world: Box | null;
  lowestControl: number | null;
  /** The box, the world and every control, each with the lowest point an ancestor lets it draw to. */
  clips: { what: string; bottom: number; clip: Clip }[];
  scrolled: number;
  standalone: boolean;
  displayMode: string;
  innerHeight: number;
  safeTop: number;
  safeBottom: number;
}

/** In-page: the play screen's boxes. */
function geometry(): Geometry {
  const box = (el: Element | null): Box | null => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const round = (v: number) => Math.round(v * 10) / 10;
    return { top: round(r.top), bottom: round(r.bottom), left: round(r.left), right: round(r.right), width: round(r.width), height: round(r.height) };
  };
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  const safeBottom = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  const shell = document.querySelector("[data-arcade-play]");
  const column = shell?.querySelector(":scope > [data-game-column]") ?? null;
  const columnEnd = column ? column.getBoundingClientRect().bottom - parseFloat(getComputedStyle(column).paddingBottom) : null;
  const shown = (el: Element) => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    }
    return true;
  };
  const clipBottom = (window as unknown as { __clipBottom: (el: Element) => Clip }).__clipBottom;
  const clips: Geometry["clips"] = [];
  const label = (el: Element) => el.getAttribute("aria-label") ?? (el.getAttribute("data-game-controls") ? `[controls=${el.getAttribute("data-game-controls")}]` : null) ?? ((el.textContent ?? "").trim().slice(0, 24) || el.tagName.toLowerCase());
  let lowest = -Infinity;
  for (const el of shell?.querySelectorAll("[data-game-stage] :is(button, a[href], input, select, textarea, [role='button'], [data-game-controls])") ?? []) {
    if (el.closest("[data-arena-slot], [data-scrollable]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || !shown(el)) continue;
    lowest = Math.max(lowest, r.bottom);
    clips.push({ what: `control "${label(el)}"`, bottom: r.bottom, clip: clipBottom(el) });
  }
  const slot = shell?.querySelector("[data-arena-slot]") ?? null;
  const world = slot?.querySelector(":scope > [data-game-arena]") ?? null;
  if (slot) clips.push({ what: "arena box", bottom: slot.getBoundingClientRect().bottom, clip: clipBottom(slot) });
  if (world) clips.push({ what: "world", bottom: world.getBoundingClientRect().bottom, clip: clipBottom(world) });
  // Arena scenes (15 Oct 2026): the game's scenery canvas fills the box, so its bottom is the box's.
  const scene = slot?.querySelector(":scope > [data-arena-scene]") ?? null;
  if (scene) clips.push({ what: "scene canvas", bottom: scene.getBoundingClientRect().bottom, clip: clipBottom(scene) });
  return {
    shell: box(shell),
    columnEnd: columnEnd == null ? null : Math.round(columnEnd * 10) / 10,
    header: box(shell?.querySelector("[data-arcade-header]") ?? null),
    slot: box(slot),
    world: box(world),
    lowestControl: lowest > -Infinity ? Math.round(lowest * 10) / 10 : null,
    clips,
    scrolled: document.scrollingElement?.scrollTop ?? 0,
    standalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
    displayMode: matchMedia("(display-mode: standalone)").matches ? "standalone" : "browser",
    innerHeight: window.innerHeight,
    safeTop,
    safeBottom,
  };
}

export interface Row {
  game: string;
  config: string;
  box: string;
  world: string;
  /** Px from the lowest control (or the box, with no controls) to the physical bottom. */
  bottomGap: number | null;
  columnGap: number | null;
  /** Px of spare box height above and below the world. */
  above: number | null;
  below: number | null;
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
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

const fmt = (b: Box | null) => (b ? `${Math.round(b.width)}x${Math.round(b.height)}` : "-");

async function main() {
  if (!existsSync(CHROMIUM)) {
    console.log(`FAIL: environment: no Chromium at ${CHROMIUM} (set PLAYWRIGHT_CHROMIUM)`);
    process.exit(1);
  }
  const named = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
  let games: PuzzleType[] = named.length
    ? named
    : ACTIVE_PUZZLE_TYPES.filter((t) => {
        const d = puzzleDef(t);
        return Boolean(d.arcadeRun || d.category === "arcade");
      });
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
  const { origin, proc } = await startServer();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const failures: string[] = [];
  const rows: Row[] = [];
  let measured = 0;
  try {
    if (games.length)
      await warmUp(browser, `${origin}/practice`, (page) => page.getByRole("button", { name: gameDisplayName(games[0]!), exact: true }).first().waitFor({ timeout: 180_000 }), { verbose: VERBOSE });
    for (const game of games) {
      const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
      await context.addInitScript(SEED_INIT);
      await context.addInitScript(DEVICE_INIT);
      const page = await context.newPage();
      await page.clock.install();
      await page.route("**/_serverFn/**", async (route) => {
        const request = route.request();
        const body = request.postData() ?? "";
        // The fixed intro example, as bottom-clearance-check.
        if (game !== "unblock" && /practiceGenerate/.test(serverFnName(request.url())))
          return route.continue({ postData: body.replace(/("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/, '$1{"t":2,"s":2}') });
        return route.continue();
      });
      const before = failures.length;
      try {
        await gotoRetried(page, `${origin}/practice`, game, { waitUntil: "domcontentloaded" });
        const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
        await button.waitFor({ timeout: 90_000 });
        await page.waitForTimeout(1200);
        await button.click();
        const ready = page.getByRole("button", { name: /^Ready/ }).first();
        await ready.waitFor({ timeout: 90_000 });
        await page.waitForTimeout(600);
        await ready.click();
        await page.locator("[data-arcade-play] [data-game-stage]").first().waitFor({ timeout: 30_000 });
        await page.clock.pauseAt(Date.now() + 200);
        await page.waitForTimeout(1200);
        for (const config of CONFIGS) {
          await emulateDevice(page, config);
          const g = await page.evaluate(geometry);
          const where = `${game} ${config.key}`;
          if (g.safeTop !== config.top || g.safeBottom !== config.bottom) failures.push(`${where}: inset emulation not applied (${g.safeTop}/${g.safeBottom})`);
          if (g.innerHeight !== config.h) failures.push(`${where}: viewport ${g.innerHeight}px tall (want ${config.h})`);
          if (g.standalone !== config.standalone || g.displayMode !== (config.standalone ? "standalone" : "browser")) failures.push(`${where}: home-screen app emulation not applied (standalone ${g.standalone}, display-mode ${g.displayMode})`);
          if (g.scrolled) failures.push(`${where}: page scrolled by ${g.scrolled}px`);
          if (!g.shell || !g.slot || !g.world || !g.header || g.columnEnd == null) {
            failures.push(`${where}: no arcade play screen, arena box or world`);
            continue;
          }
          const columnGap = Math.round((config.screenH - g.columnEnd) * 10) / 10;
          const lowest = g.lowestControl ?? g.slot.bottom;
          const bottomGap = Math.round((config.screenH - lowest) * 10) / 10;
          const above = Math.round((g.world.top - g.slot.top) * 10) / 10;
          const below = Math.round((g.slot.bottom - g.world.bottom) * 10) / 10;
          rows.push({ game, config: config.key, box: fmt(g.slot), world: fmt(g.world), bottomGap, columnGap, above, below });
          if (Math.abs(columnGap - BOTTOM_PX) > 0.5) failures.push(`${where}: play column ends ${columnGap}px above the bottom of the screen (want ${BOTTOM_PX})`);
          if (Math.abs(bottomGap - BOTTOM_PX) > 0.5)
            failures.push(`${where}: ${g.lowestControl != null ? "lowest control" : "arena box"} ends ${bottomGap}px above the bottom of the screen (want ${BOTTOM_PX})`);
          const headerTop = Math.max(4, config.top);
          if (Math.abs(g.header.top - headerTop) > 0.5) failures.push(`${where}: header starts ${g.header.top}px down (want ${headerTop})`);
          if (game === "tilt" && Math.abs(above - below) > 1) failures.push(`${where}: Tilt's world is not centred in its box (${above}px above, ${below}px below)`);
          for (const c of g.clips)
            if (c.clip.bottom < c.bottom - 0.5) failures.push(`${where}: ${c.what} (ends ${c.bottom.toFixed(1)}px down) is cut ${(c.bottom - c.clip.bottom).toFixed(1)}px short by ${c.clip.by} (ends ${c.clip.bottom.toFixed(1)}px down)`);
          if (VERBOSE) console.log(`  ${where}: box ${fmt(g.slot)} at ${g.slot.top}-${g.slot.bottom}, world ${fmt(g.world)}, column ${columnGap}px, bottom ${bottomGap}px, spare ${above}/${below}`);
        }
        measured++;
      } catch (error) {
        failures.push(`${game}: ${String((error as Error).message ?? error).split("\n")[0]}`);
      } finally {
        await context.close();
      }
      const mine = failures.length - before;
      console.log(`${mine ? "FAIL" : "PASS"} ${game} (${gameDisplayName(game)}): ${mine ? `${mine} problem(s)` : `column and lowest control (or box) ${BOTTOM_PX}px above the bottom of the screen, nothing clipped, in all ${CONFIGS.length} configurations`}`);
    }
  } finally {
    await browser.close();
    if (proc?.pid) process.kill(-proc.pid);
  }
  const json = opt("json");
  if (json) writeFileSync(json, JSON.stringify(rows, null, 1));
  for (const f of failures) console.log(`  ${f}`);
  if (failures.length) {
    console.log(`FAIL: ${failures.length} problem(s) (${measured}/${games.length} games measured)`);
    process.exit(1);
  }
  console.log(`PASS: ${measured} arcade play screens end ${BOTTOM_PX}px above the bottom of the screen with nothing clipped: ${CONFIGS.map((c) => c.key).join(", ")}`);
}

if (import.meta.main) await main();
