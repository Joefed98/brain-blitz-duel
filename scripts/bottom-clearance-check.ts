/**
 * Bottom clearance (14 Oct 2026, layout): every control of every active game is fully
 * inside the visible screen with at least 12 px to spare, at 375 × 667 and 390 × 844,
 * with and without an 80 px browser bottom toolbar.
 *
 * Headless Chromium against a `vite dev` server (or --url=<origin>), practice mode on the
 * fixed intro example with `Math.random` seeded (as scripts/shots/capture.ts). For each
 * game it opens the round intro, measures it, presses Ready and measures the live stage
 * at four viewports: 375×667, 375×587, 390×844 and 390×764. A browser's bottom toolbar
 * shortens the dynamic viewport (what `dvh` and the visible area report) by its height,
 * so "with an 80 px toolbar" is the same phone 80 px shorter. The shell must fill exactly
 * that visible height (its bottom = the dynamic viewport's bottom, never the large one).
 *
 * Measured: every visible button, link, input, [role=button] and [data-game-controls] row
 * inside the game stage (and the intro's Ready button): its bottom edge must sit at least
 * 12 px above the visible bottom (window.innerHeight minus env(safe-area-inset-bottom)),
 * and it must not be clipped by the game region (its bottom inside the region's bottom).
 * Controls inside their own scroller ([data-scrollable]) are skipped.
 *
 * Arcade play screens (15 Oct 2026: data-arcade-screen, the arcade games and the engine
 * games on the arcade stage) keep their pre-14 Oct size instead: the play column ends
 * exactly 8 px above the visible bottom, with or without a 34 px home bar emulated (CDP
 * Emulation.setSafeAreaInsetsOverride). Their controls must stay inside the column and
 * unclipped; one closer than 12 px to the bottom (or, with the home bar emulated, to the
 * home bar) is reported as a NOTE, not a failure. Their intros keep the 12 px rule.
 *
 * Seams (15 Oct 2026): every puzzle's intro, live stage and timed-out reveal is drawn with a
 * 47 px notch and 34 px home bar emulated at 375×667 and 390×844, and fails if the strips
 * (the notch's 47 px at the top, the home bar's 34 px + 16 px at the bottom, less any content
 * reaching into them) are not one colour with the screen's own background and with the page
 * behind it (html and body): the screen background's top and bottom rows must be the page
 * colour (within 2 per channel), no row step over 2 in either strip or at its edge, and
 * nothing painting a strip another colour (rows within 10 px of content, its glow, excepted).
 *
 *   bun scripts/bottom-clearance-check.ts [games…] [--part=k/n] [--url=<origin>] [--verbose]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

import type { Page } from "playwright";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import { ACTIVE_PUZZLE_TYPES, puzzleDef } from "../src/lib/duel/registry";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import type { PuzzleType } from "../src/lib/duel/types";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const VERBOSE = args.includes("--verbose");
/** --dump: print every measured control's clearance (to compare two trees). */
const DUMP = args.includes("--dump");
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 5195;
export const CLEARANCE_PX = 12;
export const TOOLBAR_PX = 80;
/** Arcade play screens end this far above the visible bottom (pre-14 Oct spacing, restored 15 Oct 2026). */
export const ARCADE_BOTTOM_PX = 8;
/** The emulated notch and home bar (an iPhone 14 in portrait), as safe-area-screens-check. */
const INSETS = { top: 47, bottom: 34, left: 0, right: 0 };
const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };
/** Most a colour may step between neighbouring rows, or differ from the page behind, per channel. */
const SEAM_TOLERANCE = 2;
const PHONES = [
  [375, 667],
  [390, 844],
] as const;
const VIEWPORTS = PHONES.flatMap(([w, h]) => [
  { w, h, toolbar: 0 },
  { w, h: h - TOOLBAR_PX, toolbar: TOOLBAR_PX },
]);

const SEED_RANDOM = `(() => {
  let s = 20261013 >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { localStorage.setItem("duelz-arrow-control", "arrows"); } catch { /* ignore */ }
})();`;

interface Measure {
  innerHeight: number;
  dvh: number;
  inset: number;
  arcade: boolean;
  /** Px from the visible bottom to the end of the play column's content box. */
  columnGap: number | null;
  shellBottom: number | null;
  worst: { label: string; bottom: number; clearance: number; clipped: boolean } | null;
  bad: { label: string; bottom: number; clearance: number; clipped: boolean }[];
  all: { label: string; bottom: number; clearance: number; clipped: boolean }[];
  count: number;
}

/** In-page: every visible control's clearance to the visible bottom. */
function measure(scope: "stage" | "intro"): Measure {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:0;top:0;width:1px;height:100dvh;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const dvh = probe.getBoundingClientRect().height;
  const inset = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  const visibleBottom = Math.min(window.innerHeight, dvh) - inset;
  const column = document.querySelector("[data-game-column]");
  const shell = column?.parentElement ?? null;
  const arcade = Boolean(shell?.hasAttribute("data-arcade-screen"));
  const columnGap = column
    ? Math.round(
        (Math.min(window.innerHeight, dvh) -
          (column.getBoundingClientRect().bottom -
            parseFloat(getComputedStyle(column).paddingBottom))) *
          10,
      ) / 10
    : null;
  const region = document.querySelector("[data-game-region]");
  const regionBottom = region ? region.getBoundingClientRect().bottom : Infinity;
  const root = scope === "stage" ? document.querySelector("[data-game-stage]") : document.body;
  const shown = (el: Element) => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0)
        return false;
    }
    return true;
  };
  const out: Measure["bad"] = [];
  const all: Measure["bad"] = [];
  let worst: Measure["worst"] = null;
  let count = 0;
  const nodes = root
    ? Array.from(
        root.querySelectorAll(
          scope === "stage"
            ? "button, a[href], input, select, textarea, [role='button'], [data-game-controls]"
            : "button",
        ),
      )
    : [];
  for (const el of nodes) {
    if (scope === "intro" && !/^Ready/.test((el.textContent ?? "").trim())) continue;
    if (el.closest("[data-scrollable]")) continue;
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1 || !shown(el)) continue;
    count++;
    const clipped = scope === "stage" && b.bottom > regionBottom + 0.5;
    const clearance = Math.round((visibleBottom - b.bottom) * 10) / 10;
    const label =
      el.getAttribute("aria-label") ??
      (el.getAttribute("data-game-controls")
        ? `[controls=${el.getAttribute("data-game-controls")}]`
        : null) ??
      ((el.textContent ?? "").trim().slice(0, 24) || el.tagName.toLowerCase());
    const row = { label, bottom: Math.round(b.bottom), clearance, clipped };
    all.push(row);
    if (!worst || clearance < worst.clearance) worst = row;
    // Arcade play screens: inside the column (ends 8 px up) and unclipped; nearer than 12 px is a note.
    const bad =
      scope === "stage" && arcade
        ? clipped || visibleBottom + inset - b.bottom < 8 - 0.5
        : clipped || clearance < 12;
    if (bad) out.push(row);
  }
  return {
    innerHeight: window.innerHeight,
    dvh: Math.round(dvh),
    inset,
    arcade,
    columnGap,
    shellBottom: shell ? Math.round(shell.getBoundingClientRect().bottom) : null,
    worst,
    bad: out,
    all,
    count,
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
  const proc = spawn(
    "npx",
    ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"],
    {
      stdio: "ignore",
      detached: true,
    },
  );
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

/** Contiguous-free split: every n-th game from k, so each part mixes categories. */
function partOf<T>(items: T[], k: number, n: number): T[] {
  return items.filter((_, i) => i % n === k - 1);
}

async function measureAll(
  page: Page,
  scope: "stage" | "intro",
  game: string,
  failures: string[],
  notes: string[],
) {
  for (const v of VIEWPORTS) {
    await page.setViewportSize({ width: v.w, height: v.h });
    await page.waitForTimeout(350);
    const m = await page.evaluate(measure, scope);
    const where = `${game} ${scope} ${v.w}x${v.h}${v.toolbar ? ` (${PHONES.find(([w]) => w === v.w)![1]} with ${v.toolbar}px toolbar)` : ""}`;
    if (scope === "stage" && m.shellBottom != null && Math.abs(m.shellBottom - m.dvh) > 1)
      failures.push(`${where}: shell ends at ${m.shellBottom}px, dynamic viewport at ${m.dvh}px`);
    if (scope === "stage" && m.arcade) {
      if (m.columnGap == null || Math.abs(m.columnGap - ARCADE_BOTTOM_PX) > 0.5)
        failures.push(
          `${where}: arcade play column ends ${m.columnGap}px above the bottom (want ${ARCADE_BOTTOM_PX})`,
        );
      for (const c of m.all)
        if (c.clearance < CLEARANCE_PX)
          notes.push(`${where}: "${c.label}" ${c.clearance}px above the visible bottom`);
    }
    if (scope === "intro" && m.count === 0) failures.push(`${where}: no Ready button found`);
    for (const b of m.bad)
      failures.push(
        `${where}: "${b.label}" bottom ${b.bottom}px, ${b.clearance}px clearance${b.clipped ? ", clipped by the game region" : ""}`,
      );
    if (VERBOSE)
      console.log(
        `  ${where}: ${m.count} controls, worst ${m.worst ? `"${m.worst.label}" ${m.worst.clearance}px` : "-"}`,
      );
    if (DUMP && scope === "stage" && !v.toolbar)
      for (const c of m.all)
        console.log(`  dump ${game} ${v.w}x${v.h} "${c.label}" ${c.clearance}`);
  }
}

/** Arcade stage with a 34 px home bar: the column still ends 8 px up; controls near the home bar are noted. */
async function homeBar(page: Page, game: string, failures: string[], notes: string[]) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: { ...NO_INSETS, bottom: INSETS.bottom } } as never);
    for (const [w, h] of PHONES) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(350);
      const m = await page.evaluate(measure, "stage" as const);
      const where = `${game} stage ${w}x${h} with a ${INSETS.bottom}px home bar`;
      if (m.inset !== INSETS.bottom) failures.push(`${where}: inset emulation not applied (${m.inset})`);
      if (m.columnGap == null || Math.abs(m.columnGap - ARCADE_BOTTOM_PX) > 0.5)
        failures.push(`${where}: arcade play column ends ${m.columnGap}px above the bottom (want ${ARCADE_BOTTOM_PX})`);
      for (const b of m.bad)
        failures.push(`${where}: "${b.label}" bottom ${b.bottom}px${b.clipped ? ", clipped by the game region" : ", below the play column"}`);
      for (const c of m.all)
        if (c.clearance < CLEARANCE_PX)
          notes.push(`${where}: "${c.label}" ${c.clearance < 0 ? `${-c.clearance}px under` : `${c.clearance}px above`} the home bar`);
    }
  } finally {
    await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: NO_INSETS } as never).catch(() => {});
    await cdp.detach().catch(() => {});
  }
}

interface SeamProbe {
  html: string;
  body: string;
  /** Rows of the screen that hold content (text, controls, media), clipped to what is visible. */
  contentTop: number;
  contentBottom: number;
}

/** In-page: the page colours behind the shell and the span of the visible content. */
function seamProbe(): SeamProbe | null {
  const shell = document.querySelector("[data-puzzle-screen]");
  if (!shell) return null;
  const visible = (el: Element) => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    }
    return true;
  };
  let top = Infinity;
  let bottom = -Infinity;
  for (const el of shell.querySelectorAll("*")) {
    if (el.closest(".screen-background, .fx-layer")) continue;
    const media = el.matches("button, input, select, textarea, canvas, svg, img, [role='button'], [data-game-controls]");
    const text = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim());
    // A painted box (a card, a board) counts as content; a painted layer as tall as the
    // screen does not, so a full-screen backdrop painting the strips is caught as a seam.
    const cs = getComputedStyle(el);
    const opaque = (c: string) => !/rgba\([^)]*,\s*0\)|transparent/.test(c);
    const painted =
      (opaque(cs.backgroundColor) || cs.backgroundImage !== "none" ||
        ["Top", "Bottom", "Left", "Right"].some(
          (side) => parseFloat(cs.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 && opaque(cs.getPropertyValue(`border-${side.toLowerCase()}-color`)),
        )) &&
      el.getBoundingClientRect().height < window.innerHeight * 0.9;
    if (!media && !text && !painted) continue;
    let r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || !visible(el)) continue;
    let y0 = r.top;
    let y1 = r.bottom;
    // Clip to every scrolling or clipping ancestor (a reveal's own scroller).
    for (let n = el.parentElement; n && n !== shell.parentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowY === "visible" && cs.overflowX === "visible") continue;
      r = n.getBoundingClientRect();
      y0 = Math.max(y0, r.top);
      y1 = Math.min(y1, r.bottom);
    }
    if (y1 - y0 < 1) continue;
    top = Math.min(top, y0);
    bottom = Math.max(bottom, y1);
  }
  return {
    html: getComputedStyle(document.documentElement).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor,
    contentTop: Math.max(0, Math.floor(top)),
    contentBottom: Math.min(window.innerHeight, Math.ceil(bottom)),
  };
}

/** Per-row median colour of a screenshot, for the rows in [from, to) of each span (others left empty). */
async function rowMedians(png: Buffer, spans: [number, number][]): Promise<[number, number, number][]> {
  const img = await loadImage(png);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
  const rows: [number, number, number][] = [];
  const mid = (xs: number[]) => xs.sort((a, b) => a - b)[xs.length >> 1]!;
  for (let y = 0; y < height; y++) {
    if (!spans.some(([from, to]) => y >= from && y < to)) continue;
    const ch: number[][] = [[], [], []];
    for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) ch[c]!.push(data[(y * width + x) * 4 + c]!);
    rows[y] = [mid(ch[0]!), mid(ch[1]!), mid(ch[2]!)];
  }
  return rows;
}

const rgbOf = (css: string): [number, number, number] | null => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(css);
  if (!m || (m[4] !== undefined && Number(m[4]) < 1)) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const step = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
const hex = (c: number[]) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** Only the screen's own background (and its page): content, overlays and effects hidden. */
const BACKGROUND_ONLY = `body * { visibility: hidden !important; transition: none !important; }
[data-puzzle-screen], [data-puzzle-screen] > .screen-background, [data-puzzle-screen] > .screen-background * { visibility: visible !important; }
.screen-drift { animation: none !important; }`;

/** A puzzle screen with the notch and home bar emulated: one colour from the content's edge to the screen's edge and beyond. */
async function seams(page: Page, game: string, screen: string, failures: string[]) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: INSETS } as never);
    for (const [w, h] of PHONES) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(400);
      const where = `${game} ${screen} ${w}x${h} (${INSETS.top}px notch, ${INSETS.bottom}px home bar)`;
      const probe = await page.evaluate(seamProbe);
      if (!probe) {
        failures.push(`${where}: no puzzle screen ([data-puzzle-screen])`);
        continue;
      }
      // The strips: the notch's inset at the top, the home bar's inset + 16 px at the bottom,
      // less any content reaching into them; one row beyond each, so a step at a strip's edge counts.
      const topEnd = Math.max(1, Math.min(probe.contentTop, INSETS.top));
      const bottomStart = Math.min(h - 1, Math.max(probe.contentBottom, h - INSETS.bottom - 16));
      const spans: [number, number][] = [
        [0, topEnd + 1],
        [bottomStart - 1, h],
      ];
      const full = await rowMedians(await page.screenshot(), spans);
      const style = await page.addStyleTag({ content: BACKGROUND_ONLY });
      await page.waitForTimeout(120);
      const bg = await rowMedians(await page.screenshot(), spans);
      await style.evaluate((el) => el.remove());
      // The canvas takes html's background, or body's when html has none (CSS propagation);
      // with both set, body's own box must match html's.
      const transparent = /rgba\(0, 0, 0, 0\)|transparent/.test(probe.html);
      const page_ = rgbOf(transparent ? probe.body : probe.html);
      if (!page_ || (!transparent && probe.body !== probe.html)) {
        failures.push(`${where}: page behind the screen is html ${probe.html}, body ${probe.body} (want one opaque colour)`);
        continue;
      }
      const problems: string[] = [];
      for (const [edge, y] of [["top", 0], ["bottom", h - 1]] as const)
        if (step(bg[y]!, page_) > SEAM_TOLERANCE)
          problems.push(`${edge} edge ${hex(bg[y]!)} against the page behind ${hex(page_)}`);
      const strips = [
        ["top", 0, topEnd + 1, probe.contentTop],
        ["bottom", bottomStart - 1, h, probe.contentBottom],
      ] as const;
      for (const [edge, from, to, content] of strips) {
        for (let y = from + 1; y < to; y++)
          if (step(bg[y]!, bg[y - 1]!) > SEAM_TOLERANCE) {
            problems.push(`${edge} strip steps ${hex(bg[y - 1]!)} → ${hex(bg[y]!)} at y=${y}`);
            break;
          }
        // Rows clear of the content's own glow (10 px) must show the screen background.
        for (let y = from; y < to; y++) {
          if (Math.abs(y - content) < 10) continue;
          if (step(full[y]!, bg[y]!) > SEAM_TOLERANCE) {
            problems.push(`${edge} strip painted ${hex(full[y]!)} over the screen's ${hex(bg[y]!)} at y=${y}`);
            break;
          }
        }
      }
      for (const p of problems) failures.push(`${where}: seam: ${p}`);
      if (VERBOSE)
        console.log(
          `  ${where}: page ${hex(page_)}, edges ${hex(bg[0]!)} / ${hex(bg[h - 1]!)}, strips 0-${topEnd} and ${bottomStart}-${h}${problems.length ? ` (${problems.length} seam problem(s))` : ""}`,
        );
    }
  } finally {
    await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: NO_INSETS } as never).catch(() => {});
    await cdp.detach().catch(() => {});
  }
}

const REVEAL = "[data-reveal-score], [data-arcade-reveal]";

/** Time runs out (as scripts/shots/capture.ts): jump the page clock past the round, stepping it for games whose loop needs frames. */
async function timeUp(page: Page) {
  await page.clock.fastForward(200_000);
  for (let i = 0; i < 400 && !(await page.locator(REVEAL).count()); i++) await page.clock.runFor(500);
  await page.locator(REVEAL).first().waitFor({ timeout: 60_000 });
  await page.clock.runFor(1500);
  await page.waitForTimeout(600);
}

async function main() {
  if (!existsSync(CHROMIUM)) {
    console.log(`FAIL: environment: no Chromium at ${CHROMIUM} (set PLAYWRIGHT_CHROMIUM)`);
    process.exit(1);
  }
  const named = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
  let games: PuzzleType[] = named.length ? named : [...ACTIVE_PUZZLE_TYPES];
  const part = opt("part");
  if (part) {
    const [k, n] = part.split("/").map(Number) as [number, number];
    if (!(n >= 1 && k >= 1 && k <= n)) {
      console.log(`FAIL: bad --part=${part}`);
      process.exit(1);
    }
    games = partOf(games, k, n);
    console.log(`part ${k}/${n}: ${games.join(", ")}`);
  }
  const { origin, proc } = await startServer();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const failures: string[] = [];
  const notes: string[] = [];
  let measured = 0;
  try {
    for (const game of games) {
      const definition = puzzleDef(game);
      const arcade = Boolean(definition.arcadeRun || definition.category === "arcade");
      const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
      await context.addInitScript(SEED_RANDOM);
      const page = await context.newPage();
      // A controllable clock (flowing normally): arcade runs are frozen while measured, puzzles time out to their reveal.
      await page.clock.install();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e.message ?? e).split("\n")[0]!));
      await page.route("**/_serverFn/**", async (route) => {
        const request = route.request();
        const body = request.postData() ?? "";
        // Gridlock keeps its normal draw: its fixed example reads the stored bank with no
        // fallback timeout, which stalls where Supabase is unreachable; the draw falls back.
        if (game !== "unblock" && /practiceGenerate/.test(serverFnName(request.url())))
          return route.continue({
            postData: body.replace(
              /("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/,
              '$1{"t":2,"s":2}',
            ),
          });
        return route.continue();
      });
      const before = failures.length;
      try {
        await page.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" });
        const button = page
          .getByRole("button", { name: gameDisplayName(game), exact: true })
          .first();
        await button.waitFor({ timeout: 90_000 });
        await page.waitForTimeout(1200); // hydration
        await button.click();
        const readyButton = page.getByRole("button", { name: /^Ready/ }).first();
        await readyButton.waitFor({ timeout: 90_000 });
        await page.waitForTimeout(800);
        await measureAll(page, "intro", game, failures, notes);
        if (!arcade) await seams(page, game, "intro", failures);
        await page.setViewportSize({ width: 375, height: 667 });
        await readyButton.click();
        await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
        // Freeze an arcade run where it stands, so it cannot end (Hover can within 1.5 s) while it is measured.
        if (arcade) await page.clock.pauseAt(Date.now() + 200);
        await page.waitForTimeout(1500);
        await measureAll(page, "stage", game, failures, notes);
        if (arcade) await homeBar(page, game, failures, notes);
        else {
          await seams(page, game, "stage", failures);
          await page.setViewportSize({ width: 375, height: 667 });
          await timeUp(page);
          await seams(page, game, "reveal", failures);
        }
        measured++;
      } catch (error) {
        failures.push(`${game}: ${String((error as Error).message ?? error).split("\n")[0]}`);
      } finally {
        await context.close();
      }
      const mine = failures.length - before;
      console.log(
        `${mine ? "FAIL" : "PASS"} ${game} (${gameDisplayName(game)}): ${
          mine
            ? `${mine} problem(s)`
            : arcade
              ? `play column ends ${ARCADE_BOTTOM_PX}px up with and without a home bar, intro Ready ≥ ${CLEARANCE_PX}px clear`
              : `every control ≥ ${CLEARANCE_PX}px clear at 4 viewports; no seam on intro, stage or reveal`
        }`,
      );
      if (errors.length && VERBOSE)
        console.log(`  page errors: ${[...new Set(errors)].slice(0, 3).join(" | ")}`);
    }
  } finally {
    await browser.close();
    if (proc?.pid) process.kill(-proc.pid);
  }
  for (const n of notes) console.log(`  NOTE ${n}`);
  for (const f of failures) console.log(`  ${f}`);
  if (failures.length) {
    console.log(
      `FAIL: ${failures.length} problem(s): a control under ${CLEARANCE_PX}px clearance or clipped, an arcade column not ${ARCADE_BOTTOM_PX}px up, or a seam (${measured}/${games.length} games measured)`,
    );
    process.exit(1);
  }
  console.log(
    `PASS: ${measured} games: puzzle controls at least ${CLEARANCE_PX}px above the visible bottom and no seam (notch and home bar emulated); arcade play columns ${ARCADE_BOTTOM_PX}px up (${notes.length} control(s) noted nearer than ${CLEARANCE_PX}px); at 375x667, 390x844 and both with an ${TOOLBAR_PX}px toolbar`,
  );
}

await main();
