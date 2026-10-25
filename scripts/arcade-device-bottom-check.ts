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
 *  - the page is not scrolled;
 *  - on the iPhone 11 home-screen pass, the screen is stable (16 Oct 2026, the bottom-flash
 *    fix-up): once settled, a window and a visualViewport resize are dispatched (what iOS fires
 *    when the root outgrows its short viewport) and for 3 s (real time, the page's clock frozen)
 *    the root, body and shell heights, --standalone-short and the scene canvas's size must not
 *    change, the root's style must not be rewritten and the scene must not be redrawn. A
 *    shortfall that fed back into itself would flip the root between 848 and 896 px.
 * Meteor's bottom edge (16 Oct 2026, the Meteor bottom-flash fix): after the stable pass above, Meteor
 * (`snake`) is played again as an iPhone 11 home-screen app at device pixel ratio 2, its clock frozen
 * and run frame by frame (page.clock.runFor, relative to the frozen time, never an absolute fake time).
 * A bot steers the meteor round the board with real swipes, and the harness (this check only, in
 * practice; app code unchanged) drops a falling rock and a three-rock meteor shower into the run's state
 * on the bottom row, timed from the run's own first sampled tick, so within 5 s of play a rock lands and
 * a shower lands. Headless Chromium composites only its layout viewport (and a capture beyond it drops
 * the page to DPR 1), so the play screen is laid out as the home-screen app (414 × 848) and the window
 * then grows to the whole 896 px screen, as the phone's window is: the arena box must not move. Every
 * frame, from the canvas's bottom 3 device rows down to the box's last device row, the composited
 * screen is compared with the canvas's own backing store; it fails if
 *  - the canvas is not whole CSS pixels at the box's top, ends past the box, or ends 1 px or more short
 *    of it (an offset edge), or its backing store is not 1:1 with device pixels;
 *  - any of the canvas's bottom 3 rows is not fully opaque (a transparent edge);
 *  - any composited pixel there differs from what the canvas painted, or, in the sub-pixel strip under
 *    the canvas, from the gap's own #070709 (a hairline of the parent, a resampled or clipped edge row):
 *    changes the scene itself paints are allowed;
 *  - the rock or the shower did not land, or the run ended, within the 5 s.
 * The cause it guards against: the canvas was rounded to the nearest CSS pixel (769 px over a 768.55 px
 * box at 414 px wide) and the world letterboxed inside it, leaving an edge row part bezel, part screen,
 * clipped mid-row by the box, which the drifting scanlines flickered every 90 ms.
 The same frames also judge the canvas's own bottom 48 device rows (the board's last cells, its border
 * and the margin under it) and the top border's first row, against the frame before (16 Oct 2026, the
 * Meteor border fix: the clock runs, so the scanlines drift as on the phone). It fails if
 *  - any of those rows changes across 90 % or more of the board's width between two frames (a blink),
 *    except rows inside the margin during a border pulse (meteorBorderLook: every 4 s, 0.6 s) and while
 *    the success layer's own edge effects (a streak, SHOWER DODGED!, timed from the frame that fires
 *    them) light the world's edges; the margin never changes in a pulse;
 *  - a margin row under the border is more than half lit outside those effects;
 *  - the border at rest is not its palette colour at 50 % (bottom edge, and the top edge, which no edge
 *    effect reaches), or the border never glows and steps colour within the 5 s.
 * The pass runs again with prefers-reduced-motion and with reduced effects pinned (level 1: a pixel
 * ratio of 1, so the composited comparison and the 1:1 rule are skipped there), where the border must
 * hold its first colour (#4BFF7A) with no pulse and the same blink rule holds. The cause it guards
 * against: the border was a 35 % stroke in the grid's cached raster under the scanlines, which drift a
 * pixel every 90 ms with a 3 px period, so one phase in three darkened the whole bottom line by 28 %.
 * It prints every game's box, world and bottom gap per configuration (--json=<path> saves them).
 *
 * Parts (--part=k/n): with n ≥ 4, parts 1…n−3 split the games' layout passes round-robin and parts n−2, n−1 and n
 * are the Meteor edge passes (full, reduced motion, reduced effects), one each; CI runs @1/6…@6/6 (.github/ci/shards.ts).
 * With n ≤ 3 the games are split round-robin and the Meteor passes follow Meteor's layout pass in its part.
 *
 *   bun scripts/arcade-device-bottom-check.ts [games…] [--part=k/n] [--url=<origin>] [--json=<path>] [--verbose]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

import { ACTIVE_PUZZLE_TYPES, puzzleDef } from "../src/lib/duel/registry";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import type { PuzzleType } from "../src/lib/duel/types";
import { freezeClock, gotoRetried, warmUp } from "./browser-load";
import { DEVICE_INIT, IPHONE11_APP, emulateDevice, type Clip, type DeviceConfig } from "./device-emulation";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const VERBOSE = args.includes("--verbose");
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 5197;
/**
 * The check's own time limit (25 Oct 2026): a stall (a page that never loads, a wait that never resolves, a
 * browser that stops answering) fails fast with the step it was on, stops its browser and dev server, and
 * exits, instead of hanging a CI job (PR #139's play8 sat 37 min on this check's part 5 before it was
 * cancelled; the same code had passed in 6 min half an hour earlier). Under run-checks' 300 s, so this
 * message, not a bare kill, is what a stall prints. Each part takes 40-190 s locally.
 */
const WATCHDOG_MS = Number(opt("watchdog-ms") ?? 270_000);
/** The step the check is on, for the watchdog's message. */
let phase = "starting the dev server";
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

/** Stability pass: counts scene redraws (each paint clears the scene canvas first). */
const STABILITY_INIT = `(() => {
  window.__sceneDraws = 0;
  const clear = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect = function (...a) {
    if (this.canvas instanceof HTMLCanvasElement && this.canvas.hasAttribute("data-arena-scene")) window.__sceneDraws++;
    return clear.apply(this, a);
  };
})();`;
/** How long the settled iPhone 11 home-screen play screen must hold still. */
const STABLE_MS = 3000;

interface Stability { short: string; html: number; body: number; shell: number; scene: string; draws: number; styleWrites: number }

/** In-page: what must hold still, and the counters since watchStability. */
function stability(): Stability {
  const w = window as unknown as { __sceneDraws: number; __styleWrites?: number };
  const root = document.documentElement;
  const scene = document.querySelector<HTMLCanvasElement>("[data-arcade-play] [data-arena-scene]");
  return {
    short: root.style.getPropertyValue("--standalone-short"),
    html: root.getBoundingClientRect().height,
    body: document.body.getBoundingClientRect().height,
    shell: document.querySelector("[data-arcade-play]")?.getBoundingClientRect().height ?? -1,
    scene: scene ? `${scene.width}x${scene.height}` : "-",
    draws: w.__sceneDraws,
    styleWrites: w.__styleWrites ?? 0,
  };
}

/** In-page: start counting root style writes, then fire the resizes iOS may send when the root outgrows its viewport. */
function watchStability() {
  const w = window as unknown as { __styleWrites: number; __styleWatch?: MutationObserver };
  w.__styleWrites = 0;
  w.__styleWatch?.disconnect();
  w.__styleWatch = new MutationObserver((records) => (w.__styleWrites += records.length));
  w.__styleWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  window.dispatchEvent(new Event("resize"));
  window.visualViewport?.dispatchEvent(new Event("resize"));
}

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
  // Arena scenes (15 Oct 2026; since 17 Oct 2026 on the play screen itself, to the screen's bottom).
  const scene = shell?.querySelector(":scope > [data-arena-scene]") ?? null;
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

/**
 * Meteor bottom-edge pass: the page's per-frame probe (arcadeFeedback's __arcadeProbe) records the run
 * and, once window.__meteorPlan is set, drops one falling rock and one meteor shower into the live
 * state at fixed ticks after the run's first sampled tick (harness only: practice, display test).
 */
const METEOR_INIT = `(() => {
  window.__meteor = null;
  globalThis.__arcadeProbe = (s, over) => {
    if (!s || !Array.isArray(s.body)) return;
    const p = window.__meteorPlan;
    if (p && !over && !s.dead) {
      if (p.t0 == null) p.t0 = s.tick;
      const rel = s.tick - p.t0;
      if (!p.rock && rel >= p.rockAt) { s.rockWarn = p.rockCell; s.rockLandTick = s.tick + p.warn; p.rock = s.tick; }
      if (!p.shower && rel >= p.showerAt) {
        s.showerCells = p.showerCells.slice(); s.showerWarn = p.showerCells.slice();
        s.showerLandTick = s.tick + p.warn; s.showerDone = 1; p.shower = s.tick;
      }
    }
    // The success layer's edge effects (arcadeFxGames.renderer.ts SNAKE_FX: a streak every 10 stars and
    // for a meteor shower, its edge glow and sweep; SHOWER DODGED!, its edge glow and neon border) light
    // all four edges for up to 900 ms: game effects, timed here from the frame that fires them.
    const dodged = (s.showerCells ?? []).length > 0 && (s.rocks ?? []).includes(s.showerCells[0]) ? 1 : 0;
    const fxKey = (s.showerDone ?? 0) + ":" + Math.floor((s.eaten ?? 0) / 10) + ":" + dodged;
    if (window.__meteorFxKey !== undefined && window.__meteorFxKey !== fxKey) window.__meteorFxAt = performance.now();
    window.__meteorFxKey = fxKey;
    window.__meteor = { tick: s.tick, head: s.body[0], nextDir: s.nextDir, rows: s.rows ?? 20, cols: s.cols ?? 15, rocks: (s.rocks ?? []).length, dead: !!s.dead, over: !!over, t0: p ? p.t0 : null, fxAt: window.__meteorFxAt ?? null };
  };
})();`;
const METEOR_DPR = 2;
/** The iPhone 11 home-screen app with the window the whole screen (see meteorEdgePass). */
const METEOR_WINDOW: DeviceConfig = { ...IPHONE11_APP, key: "iphone11-app-window", h: IPHONE11_APP.screenH };
const METEOR_PLAY_TICKS = 300; // 5 s of sim ticks
const METEOR_EDGE_ROWS = 3;
/** Per-channel tolerance between the composited screen and the canvas's own pixels. */
const METEOR_TOLERANCE = 3;

interface MeteorFrame {
  dpr: number;
  box: { left: number; top: number; bottom: number; width: number };
  canvas: { top: number; bottom: number; left: number; right: number; w: number; h: number };
  /** The canvas's bottom METEOR_EDGE_ROWS backing rows, RGBA. */
  rows: number[];
}

/** In-page: the world box, the canvas and its bottom backing rows. */
function meteorFrame(edgeRows: number): MeteorFrame | null {
  const world = document.querySelector("[data-arcade-play] [data-arena-slot] > [data-game-arena]");
  const canvas = world?.querySelector("canvas");
  if (!world || !canvas) return null;
  const b = world.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  const data = canvas.getContext("2d")!.getImageData(0, canvas.height - edgeRows, canvas.width, edgeRows).data;
  return {
    dpr: window.devicePixelRatio,
    box: { left: b.left, top: b.top, bottom: b.bottom, width: b.width },
    canvas: { top: c.top, bottom: c.bottom, left: c.left, right: c.right, w: canvas.width, h: canvas.height },
    rows: Array.from(data),
  };
}

/** The bottom device rows of Meteor's canvas judged for the border (its frame, the glow inside it, the margin under it). */
const BORDER_ROWS = 48;
/** A row "changes across the width" when at least this share of its pixels changed since the last frame. */
const WIDE_CHANGE = 0.9;
/** Slack (ms of page time) round a border pulse: the frame was drawn up to one 16 ms step before it was read. */
const PULSE_SLACK_MS = 40;
/** How long the success layer's edge effects light the world's edges (arcadeFx.renderer.ts: glow 600, sweep 800, neon 900 ms). */
const EDGE_FX_MS = 900;
/** The top border lies on the grid's own top line (7 % green), which shows through the frame's 50 %. */
const TOP_BORDER_TOLERANCE = 14;

interface BorderFrame {
  /** Page time (ms, the frozen clock) when read: the frame was drawn at most one step earlier. */
  now: number;
  /** Per row, bottom BORDER_ROWS rows top to bottom: the share of its pixels across the board's width changed since the previous frame (-1: first frame). */
  changed: number[];
  /** Per row, the colour at the board's horizontal middle. */
  mid: [number, number, number][];
  /** Per row, the share of pixels that are not black. */
  lit: number[];
  /** The top border's first device row, at the board's horizontal middle (no edge effect reaches it). */
  topMid: [number, number, number];
}

/** In-page: the canvas's bottom rows against the previous frame's (kept on window.__meteorRows). */
function meteorBorderFrame({ k, top, x0, x1 }: { k: number; top: number; x0: number; x1: number }): BorderFrame | null {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-arcade-play] [data-arena-slot] > [data-game-arena] canvas");
  if (!canvas) return null;
  const w = canvas.width;
  const data = canvas.getContext("2d")!.getImageData(0, canvas.height - k, w, k).data;
  const store = window as unknown as { __meteorRows?: { w: number; data: Uint8ClampedArray } };
  const prev = store.__meteorRows && store.__meteorRows.w === w ? store.__meteorRows.data : null;
  const changed: number[] = [];
  const mid: [number, number, number][] = [];
  const lit: number[] = [];
  for (let y = 0; y < k; y++) {
    let diff = 0;
    let on = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i]! > 3 || data[i + 1]! > 3 || data[i + 2]! > 3) on++;
      if (prev && x >= x0 && x < x1 && (Math.abs(data[i]! - prev[i]!) > 3 || Math.abs(data[i + 1]! - prev[i + 1]!) > 3 || Math.abs(data[i + 2]! - prev[i + 2]!) > 3)) diff++;
    }
    const m = (y * w + (w >> 1)) * 4;
    changed.push(prev ? diff / (x1 - x0) : -1);
    mid.push([data[m]!, data[m + 1]!, data[m + 2]!]);
    lit.push(on / w);
  }
  store.__meteorRows = { w, data: data.slice() };
  const t = canvas.getContext("2d")!.getImageData(w >> 1, top, 1, 1).data;
  return { now: performance.now(), changed, mid, lit, topMid: [t[0]!, t[1]!, t[2]!] };
}

type MeteorMode = "full" | "reduced-motion" | "reduced-effects";
const METEOR_MODES: readonly MeteorMode[] = ["full", "reduced-motion", "reduced-effects"];

/**
 * Meteor on the iPhone 11 home-screen app at DPR 2: 5 s of scripted play, the arena's bottom 3 device rows every
 * frame against the canvas, and the canvas's bottom BORDER_ROWS rows judged for the border (see the header). In
 * the "reduced-motion" and "reduced-effects" modes the border must hold its first colour with no pulse; reduced
 * effects render at a pixel ratio of 1, so there the composited comparison and the 1:1 rule are skipped.
 */
async function meteorEdgePass(browser: import("playwright").Browser, origin: string, failures: string[], mode: MeteorMode = "full"): Promise<void> {
  const { loadImage, createCanvas } = await import("@napi-rs/canvas");
  const { snakeBoardXOf, snakeWorldWOf, snakeWorldHFor } = await import("../src/lib/arcade/snake");
  const { meteorBorderLook, meteorBorderRect, METEOR_BORDER_COLOURS, METEOR_BORDER_PERIOD_MS, METEOR_BORDER_PULSE_MS, METEOR_BORDER_REST_ALPHA } = await import("../src/lib/arcade/snake.renderer");
  const where = `snake iphone11-app bottom edge${mode === "full" ? "" : ` (${mode})`}`;
  const hold = mode !== "full";
  const composited = mode !== "reduced-effects";
  const context = await browser.newContext({
    viewport: { width: IPHONE11_APP.w, height: IPHONE11_APP.h },
    deviceScaleFactor: METEOR_DPR,
    ...(mode === "reduced-motion" ? { reducedMotion: "reduce" as const } : {}),
  });
  await context.addInitScript(SEED_INIT);
  await context.addInitScript(DEVICE_INIT);
  if (mode === "reduced-effects") await context.addInitScript("window.__duelzEffects = 1;");
  await context.addInitScript(METEOR_INIT);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  try {
    await gotoRetried(page, `${origin}/practice`, "snake", { waitUntil: "domcontentloaded" });
    const button = page.getByRole("button", { name: gameDisplayName("snake"), exact: true }).first();
    await button.waitFor({ timeout: 90_000 });
    await page.waitForTimeout(1200);
    await button.click();
    const ready = page.getByRole("button", { name: /^Ready/ }).first();
    await ready.waitFor({ timeout: 90_000 });
    await emulateDevice(page, IPHONE11_APP);
    await ready.click();
    await page.locator("[data-arcade-play] [data-game-stage] canvas").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    // Headless Chromium composites only the layout viewport, which in the home-screen emulation ends 48 px
    // above the screen's bottom (and any capture beyond it drops the page to DPR 1 and lays it out again).
    // So the box is laid out as the home-screen app first, then the window grows to the whole screen, as
    // the phone's window is, with the insets, navigator.standalone and DPR unchanged: the arena box must
    // not move by so much as a layout unit, and every sampled pixel is then composited.
    const boxOf = () => page.evaluate(() => {
      const r = document.querySelector("[data-arcade-play] [data-arena-slot] > [data-game-arena]")?.getBoundingClientRect();
      return r ? `${r.left},${r.top} ${r.width}x${r.height}` : "none";
    });
    const appBox = await boxOf();
    await emulateDevice(page, METEOR_WINDOW);
    // The phone's window never grows: its play screen is 896 px (848 + the 48 px shortfall). The grown window
    // is already 896 px, so the shortfall PhoneShell keeps for this screen size (it measures once per size,
    // never feeding back) is taken off here, as the phone's geometry has it: the play screen stays 896 px and
    // a centred world (Meteor since 17 Oct 2026, the screen fill-ins) stays where it was laid out.
    await page.evaluate(() => document.documentElement.style.setProperty("--standalone-short", "0px"));
    await page.waitForTimeout(200);
    const windowBox = await boxOf();
    if (windowBox !== appBox) {
      failures.push(`${where}: the arena box moved when the window grew to the whole screen (${appBox} as laid out, ${windowBox} with the whole window)`);
      return;
    }
    await freezeClock(page);
    const step = () => page.clock.runFor(16);
    for (let i = 0; i < 6; i++) await step();
    const start = await page.evaluate(() => (window as unknown as { __meteor: { tick: number; rows: number; cols: number } | null }).__meteor);
    if (!start) {
      failures.push(`${where}: the run never reported a tick`);
      return;
    }
    const rows = start.rows;
    // snakeRev 9 (expansion E2): the wider grid's columns, world width and board edge.
    const SNAKE_COLS = start.cols;
    const SNAKE_WORLD_W = snakeWorldWOf({ cols: SNAKE_COLS === 15 ? undefined : SNAKE_COLS });
    const boardX = snakeBoardXOf({ cols: SNAKE_COLS === 15 ? undefined : SNAKE_COLS });
    const bottomRow = rows - 1;
    const cell = (r: number, c: number) => r * SNAKE_COLS + c;
    // The rock lands at 2.3 s and the shower at 3.7 s (each after Meteor's 2 s warning), on the bottom row, clear of the bot's loop.
    await page.evaluate((plan) => ((window as unknown as { __meteorPlan: unknown }).__meteorPlan = plan), {
      t0: null, rockAt: 18, showerAt: 102, warn: 120, rockCell: cell(bottomRow, 7), showerCells: [cell(bottomRow, 2), cell(bottomRow, 5), cell(bottomRow, 11)],
    });
    let lastHead = -1;
    let frames = 0;
    let bad = 0;
    let firstBad = "";
    let rocksBefore = -1;
    let rocksMax = 0;
    let t0: number | null = null;
    let ticks = 0;
    // The border: frames read, frames in a pulse that showed it glowing, the border colours seen at rest.
    let prevBorder: BorderFrame | null = null;
    let pulseFrames = 0;
    let edgeFxFrames = 0;
    let glowFrames = 0;
    const restColours = new Set<string>();
    const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const inPulse = (t: number) => {
      const phase = ((t % METEOR_BORDER_PERIOD_MS) + METEOR_BORDER_PERIOD_MS) % METEOR_BORDER_PERIOD_MS;
      return phase < METEOR_BORDER_PULSE_MS + PULSE_SLACK_MS || phase > METEOR_BORDER_PERIOD_MS - PULSE_SLACK_MS;
    };
    const note = (what: string) => {
      if (VERBOSE) console.log(`  ${where}: ${what}`);
      bad++;
      if (!firstBad) firstBad = what;
    };
    for (let guard = 0; guard < 600 && ticks < METEOR_PLAY_TICKS; guard++) {
      await step();
      const m = await page.evaluate(() => (window as unknown as { __meteor: { tick: number; head: number; nextDir: number; rows: number; rocks: number; dead: boolean; over: boolean; t0: number | null; fxAt: number | null } }).__meteor);
      if (m.dead || m.over) {
        failures.push(`${where}: the scripted run ended at tick ${m.tick} (${m.dead ? "crashed" : "over"}) before ${METEOR_PLAY_TICKS / 60} s of play`);
        break;
      }
      if (t0 == null && m.t0 != null) {
        t0 = m.t0;
        rocksBefore = m.rocks;
      }
      if (t0 != null) ticks = m.tick - t0;
      rocksMax = Math.max(rocksMax, m.rocks);
      // Steer: round the board clockwise, two cells in from the sides and top, five rows clear of the bottom.
      if (m.head !== lastHead) {
        lastHead = m.head;
        const r = Math.trunc(m.head / SNAKE_COLS);
        const c = m.head % SNAKE_COLS;
        const [dr, dc] = [[-1, 0], [0, 1], [1, 0], [0, -1]][m.nextDir] ?? [0, 0];
        const nr = r + dr!;
        const nc = c + dc!;
        if (nr < 2 || nr > rows - 6 || nc < 2 || nc > SNAKE_COLS - 3) {
          const turn = (m.nextDir + 1) % 4;
          const [sx, sy] = [[0, -40], [40, 0], [0, 40], [-40, 0]][turn]!;
          const box = await page.locator("[data-arcade-play] [data-game-arena] canvas").first().boundingBox();
          if (box) {
            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + sx!, y + sy!);
            await page.mouse.up();
          }
        }
      }
      // The arena's bottom edge, from the canvas's bottom 3 device rows down to the box's last device row:
      // the composited screen against the canvas's own pixels. The page's clock is frozen, so nothing
      // redraws while the compositor presents the frame just drawn (a short real-time wait first).
      await page.waitForTimeout(40);
      const f = await page.evaluate(meteorFrame, METEOR_EDGE_ROWS);
      if (!f) {
        note(`frame ${frames}: no arena canvas`);
        continue;
      }
      frames++;
      const dpr = f.dpr;
      // The border and the margin under it, from the canvas's own pixels (see the header).
      const r = meteorBorderRect(f.canvas.w / SNAKE_WORLD_W, f.canvas.h / snakeWorldHFor(rows), 0, 0, rows, SNAKE_COLS, boardX);
      const bf = await page.evaluate(meteorBorderFrame, { k: BORDER_ROWS, top: r.y0, x0: r.x0, x1: r.x1 });
      if (bf) {
        const top = f.canvas.h - BORDER_ROWS;
        const border = [r.y1 - r.w - top, r.y1 - top];
        const pulse = !hold && (inPulse(bf.now) || inPulse(bf.now - 16));
        const edgeFx = m.fxAt != null && bf.now - m.fxAt <= EDGE_FX_MS + PULSE_SLACK_MS;
        if (edgeFx) edgeFxFrames++;
        if (border[0]! < 4 * r.w) note(`frame ${frames}: the border (device rows ${r.y1 - r.w}-${r.y1 - 1}) is not inside the canvas's bottom ${BORDER_ROWS} rows`);
        for (let y = 0; y < BORDER_ROWS && prevBorder; y++) {
          const margin = y >= border[1]!;
          if (bf.changed[y]! < WIDE_CHANGE || (pulse && !margin) || edgeFx) continue;
          note(`frame ${frames} (t ${Math.round(bf.now)} ms): device row ${top + y} (${margin ? "the margin under the border" : y >= border[0]! ? "the border" : "inside the border"}) changed across ${Math.round(bf.changed[y]! * 100)} % of its width${hold ? " with the border held" : " outside a border pulse"}: a blink`);
        }
        for (let y = border[1]!; y < BORDER_ROWS && !edgeFx; y++) {
          if (bf.lit[y]! > 0.5) note(`frame ${frames}: device row ${top + y} of the margin under the border is ${Math.round(bf.lit[y]! * 100)} % lit (want the screen's black)`);
        }
        // The border's colour: the bottom edge (unless an edge effect lights it) and the top edge, which no
        // edge effect reaches, so a pulse under an effect is still seen.
        const steady = !inPulse(bf.now) && !inPulse(bf.now - 16);
        const sides: [string, [number, number, number], number][] = [["top", bf.topMid, TOP_BORDER_TOLERANCE]];
        if (!edgeFx) sides.push(["bottom", bf.mid[border[0]!]!, METEOR_TOLERANCE]);
        if (hold || steady) {
          const look = meteorBorderLook(bf.now, hold);
          const before = meteorBorderLook(bf.now - 16, hold);
          if (look.colour === before.colour) {
            const want = hex(look.colour).map((c) => Math.round(c * METEOR_BORDER_REST_ALPHA));
            for (const [side, mid, tolerance] of sides) {
              if (mid.some((c, i) => Math.abs(c - want[i]!) > tolerance)) note(`frame ${frames} (t ${Math.round(bf.now)} ms): the ${side} border at rest is ${mid.join(",")}, want ${want.join(",")} (${look.colour} at ${METEOR_BORDER_REST_ALPHA})`);
              else restColours.add(look.colour);
            }
          }
        } else {
          pulseFrames++;
          const rest = METEOR_BORDER_COLOURS.map((c) => hex(c).map((v) => Math.round(v * METEOR_BORDER_REST_ALPHA)));
          if (!rest.some((w) => w.every((v, i) => Math.abs(v - bf.topMid[i]!) <= TOP_BORDER_TOLERANCE))) glowFrames++;
        }
        prevBorder = bf;
      }
      if (dpr !== METEOR_DPR) note(`frame ${frames}: the page is at DPR ${dpr}, not ${METEOR_DPR}`);
      const cssW = f.canvas.right - f.canvas.left;
      const cssH = f.canvas.bottom - f.canvas.top;
      const boxBottom = Math.round(f.box.bottom * dpr);
      const canvasTop = Math.round(f.canvas.top * dpr);
      const canvasBottom = canvasTop + Math.round(cssH * dpr);
      if (!Number.isInteger(cssW) || !Number.isInteger(cssH) || Math.abs(f.canvas.top - f.box.top) > 0.01)
        note(`frame ${frames}: canvas ${cssW}x${cssH} px at ${f.canvas.top} px is not whole pixels at the box's top (${f.box.top} px)`);
      if (f.canvas.bottom > f.box.bottom + 0.01 || f.box.bottom - f.canvas.bottom >= 1)
        note(`frame ${frames}: canvas ends at ${f.canvas.bottom} px, box at ${f.box.bottom} px (want the canvas inside the box, under 1 px short: an offset edge)`);
      if (composited && (f.canvas.w !== Math.round(cssW * dpr) || f.canvas.h !== Math.round(cssH * dpr)))
        note(`frame ${frames}: backing store ${f.canvas.w}x${f.canvas.h} is not 1:1 with the canvas's ${Math.round(cssW * dpr)}x${Math.round(cssH * dpr)} device pixels`);
      let transparent = 0;
      for (let i = 3; i < f.rows.length; i += 4) if (f.rows[i] !== 255) transparent++;
      if (transparent) note(`frame ${frames}: ${transparent} pixel(s) of the canvas's bottom ${METEOR_EDGE_ROWS} rows not opaque`);
      if (!composited) continue;
      const firstRow = canvasBottom - METEOR_EDGE_ROWS;
      const lastRow = Math.max(boxBottom, canvasBottom);
      const shot = await page.screenshot({
        clip: { x: f.box.left, y: firstRow / dpr, width: f.box.width, height: (lastRow - firstRow) / dpr },
        scale: "device",
        animations: "allow",
        caret: "initial",
      });
      const img = await loadImage(shot);
      const scratch = createCanvas(img.width, img.height);
      const sctx = scratch.getContext("2d");
      sctx.drawImage(img, 0, 0);
      const px = sctx.getImageData(0, 0, img.width, img.height).data;
      const canvasLeft = Math.round(f.canvas.left * dpr) - Math.round(f.box.left * dpr);
      const close = (s: number, r: number, g: number, b: number) =>
        Math.abs(px[s]! - r) <= METEOR_TOLERANCE && Math.abs(px[s + 1]! - g) <= METEOR_TOLERANCE && Math.abs(px[s + 2]! - b) <= METEOR_TOLERANCE;
      let differ = 0;
      let sample = "";
      for (let y = 0; y < img.height; y++) {
        const deviceRow = firstRow + y;
        const canvasRow = deviceRow - (canvasBottom - METEOR_EDGE_ROWS);
        for (let x = 0; x < img.width; x++) {
          const s = (y * img.width + x) * 4;
          const cx = x - canvasLeft;
          let ok: boolean;
          let want: string;
          if (canvasRow < METEOR_EDGE_ROWS && cx >= 0 && cx < f.canvas.w) {
            const c = (canvasRow * f.canvas.w + cx) * 4;
            ok = close(s, f.rows[c]!, f.rows[c + 1]!, f.rows[c + 2]!);
            want = `canvas ${f.rows[c]},${f.rows[c + 1]},${f.rows[c + 2]}`;
          } else {
            // Under the canvas (less than 1 px) or beside it: the gap's own black, as under every world.
            ok = close(s, 7, 7, 9);
            want = "the #070709 gap";
          }
          if (ok) continue;
          differ++;
          if (!sample) sample = `device row ${deviceRow}, x ${x}: screen ${px[s]},${px[s + 1]},${px[s + 2]}, want ${want}`;
        }
      }
      if (differ) note(`frame ${frames} (tick ${m.tick}): ${differ} pixel(s) of the arena's bottom edge differ from what the canvas painted; first at ${sample}`);
    }
    if (ticks < METEOR_PLAY_TICKS && !failures.some((f) => f.startsWith(where))) failures.push(`${where}: only ${ticks} ticks played`);
    if (rocksBefore < 0 || rocksMax < rocksBefore + 4) failures.push(`${where}: the scripted rock and shower did not both land (${rocksBefore < 0 ? "never started" : `${rocksMax - rocksBefore} of 4 rocks`})`);
    if (bad) failures.push(`${where}: the bottom edge changed in ${bad} of ${frames} frame(s) in a way the scene did not paint; first: ${firstBad}`);
    if (hold && (pulseFrames || restColours.size !== 1 || !restColours.has(METEOR_BORDER_COLOURS[0])))
      failures.push(`${where}: the border did not hold ${METEOR_BORDER_COLOURS[0]} (${[...restColours].join(", ") || "none"} seen at rest, ${pulseFrames} pulse frame(s))`);
    if (!hold && (!glowFrames || restColours.size < 2))
      failures.push(`${where}: the border did not pulse and step colour (${glowFrames} glowing frame(s) of ${pulseFrames} in a pulse; ${[...restColours].join(", ") || "none"} seen at rest)`);
    for (const e of errors) failures.push(`${where}: page error: ${e}`);
    const borderNote = hold
      ? `the border held ${[...restColours].join(", ")} with no pulse`
      : `the border stepped ${[...restColours].join(" → ")} with ${glowFrames} glowing pulse frame(s)`;
    console.log(`${failures.some((f) => f.startsWith(where)) ? "FAIL" : "PASS"} ${where.replace(" iphone11-app", "")} (iPhone 11 home-screen app, DPR ${METEOR_DPR}): ${frames} frames over ${ticks} ticks, ${Math.max(0, rocksMax - rocksBefore)} rock(s) landed (1 rock, 3-rock shower); ${bad ? `${bad} bad frame(s)` : `${composited ? "the bottom edge matched what the canvas painted every frame (opaque, whole pixels, 1:1, only the gap's black below); " : ""}no bottom row blinked across the width (margin, border, inside it) outside a border pulse`}; ${borderNote}; ${edgeFxFrames} frame(s) under the success layer's edge effects (streak, SHOWER DODGED!) not judged`);
  } catch (error) {
    failures.push(`${where}: ${String((error as Error).message ?? error).split("\n")[0]}`);
  } finally {
    await context.close();
  }
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
  // The Meteor edge passes (full, reduced motion, reduced effects) run after the games when Meteor is among them.
  let meteorModes: MeteorMode[] = games.includes("snake") ? [...METEOR_MODES] : [];
  const part = opt("part");
  if (part) {
    const [k, n] = part.split("/").map(Number) as [number, number];
    if (!(n >= 1 && k >= 1 && k <= n)) {
      console.log(`FAIL: bad --part=${part}`);
      process.exit(1);
    }
    if (n > METEOR_MODES.length && meteorModes.length) {
      // Parts 1…n−3 share the games' layout passes round-robin; each of the last three parts is one Meteor edge
      // pass on its own (17 Oct 2026: the three together pushed a half past run-checks' 300 s on CI).
      const gameParts = n - METEOR_MODES.length;
      if (k <= gameParts) {
        games = games.filter((_, i) => i % gameParts === k - 1);
        meteorModes = [];
      } else {
        games = [];
        meteorModes = [METEOR_MODES[k - gameParts - 1]!];
      }
    } else {
      games = games.filter((_, i) => i % n === k - 1);
      if (!games.includes("snake")) meteorModes = [];
    }
    console.log(`part ${k}/${n}: ${[...games, ...meteorModes.map((m) => `snake bottom edge (${m})`)].join(", ")}`);
  }
  let proc: ChildProcess | null = null;
  const stopServer = (signal: NodeJS.Signals = "SIGTERM") => {
    try {
      if (proc?.pid) process.kill(-proc.pid, signal);
    } catch {
      /* already gone (a port another server held, or a stall's cleanup) */
    }
  };
  const watchdog = setTimeout(() => {
    console.log(`FAIL: arcade-device-bottom-check stalled: no result after ${WATCHDOG_MS / 1000} s (last step: ${phase}); stopping its browser and dev server`);
    // SIGKILL to the whole group: the process exits at once, so npm gets no time to pass a SIGTERM on to vite.
    stopServer("SIGKILL");
    process.exit(1);
  }, WATCHDOG_MS);
  const started = await startServer();
  proc = started.proc;
  const origin = started.origin;
  phase = "launching Chromium";
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const failures: string[] = [];
  const rows: Row[] = [];
  let measured = 0;
  try {
    const first = games[0] ?? (meteorModes.length ? "snake" : undefined);
    if (first)
      await warmUp(browser, `${origin}/practice`, (page) => page.getByRole("button", { name: gameDisplayName(first), exact: true }).first().waitFor({ timeout: 180_000 }), { verbose: VERBOSE });
    for (const game of games) {
      phase = `${game}'s layout pass`;
      const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
      await context.addInitScript(SEED_INIT);
      await context.addInitScript(DEVICE_INIT);
      await context.addInitScript(STABILITY_INIT);
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
        // Freeze the run where it stands (freezeClock: relative to the page's own clock, never a time already past).
        await freezeClock(page);
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
          // The game frame's header (Polish 2, 24 Oct 2026) starts at the top inset, or 0 (4px down before).
          const headerTop = config.top;
          if (Math.abs(g.header.top - headerTop) > 0.5) failures.push(`${where}: header starts ${g.header.top}px down (want ${headerTop})`);
          if (game === "tilt" && Math.abs(above - below) > 1) failures.push(`${where}: Tilt's world is not centred in its box (${above}px above, ${below}px below)`);
          for (const c of g.clips)
            if (c.clip.bottom < c.bottom - 0.5) failures.push(`${where}: ${c.what} (ends ${c.bottom.toFixed(1)}px down) is cut ${(c.bottom - c.clip.bottom).toFixed(1)}px short by ${c.clip.by} (ends ${c.clip.bottom.toFixed(1)}px down)`);
          if (config === IPHONE11_APP) {
            const before = await page.evaluate(stability);
            await page.evaluate(watchStability);
            await page.waitForTimeout(STABLE_MS);
            const after = await page.evaluate(stability);
            for (const k of ["short", "html", "body", "shell", "scene"] as const)
              if (before[k] !== after[k]) failures.push(`${where}: not stable: ${k} changed from ${before[k]} to ${after[k]} within ${STABLE_MS / 1000} s of settling`);
            if (after.draws !== before.draws) failures.push(`${where}: not stable: the arena scene was redrawn ${after.draws - before.draws} time(s) within ${STABLE_MS / 1000} s of settling`);
            if (after.styleWrites) failures.push(`${where}: not stable: the root's style was rewritten ${after.styleWrites} time(s) after a resize that changed nothing`);
            if (VERBOSE) console.log(`  ${where}: stable for ${STABLE_MS / 1000} s (short ${after.short || "0"}, root ${after.html}px, scene ${after.scene}, ${after.draws} scene paint(s) in all)`);
          }
          if (VERBOSE) console.log(`  ${where}: box ${fmt(g.slot)} at ${g.slot.top}-${g.slot.bottom}, world ${fmt(g.world)}, column ${columnGap}px, bottom ${bottomGap}px, spare ${above}/${below}`);
        }
        measured++;
      } catch (error) {
        failures.push(`${game}: ${String((error as Error).message ?? error).split("\n")[0]}`);
      } finally {
        await context.close();
      }
      const mine = failures.length - before;
      console.log(`${mine ? "FAIL" : "PASS"} ${game} (${gameDisplayName(game)}): ${mine ? `${mine} problem(s)` : `column and lowest control (or box) ${BOTTOM_PX}px above the bottom of the screen, nothing clipped, in all ${CONFIGS.length} configurations; stable for ${STABLE_MS / 1000} s as an iPhone 11 home-screen app`}`);
    }
    for (const mode of meteorModes) {
      phase = `Meteor's bottom-edge pass (${mode})`;
      await meteorEdgePass(browser, origin, failures, mode);
    }
    phase = "closing Chromium";
  } finally {
    await browser.close();
    stopServer();
    clearTimeout(watchdog);
  }
  const json = opt("json");
  if (json) writeFileSync(json, JSON.stringify(rows, null, 1));
  for (const f of failures) console.log(`  ${f}`);
  if (failures.length) {
    console.log(`FAIL: ${failures.length} problem(s) (${measured}/${games.length} games measured)`);
    process.exit(1);
  }
  if (games.length) console.log(`PASS: ${measured} arcade play screens end ${BOTTOM_PX}px above the bottom of the screen with nothing clipped: ${CONFIGS.map((c) => c.key).join(", ")}`);
  if (meteorModes.length) console.log(`PASS: Meteor's bottom edge held on the iPhone 11 home-screen app (${meteorModes.join(", ")})`);
}

if (import.meta.main) await main();
