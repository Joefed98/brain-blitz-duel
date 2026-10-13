/**
 * Word polish screenshots and measurements (a design tool, not a routine check:
 * it needs Chromium and a dev server, like arcade-play-check). Same method as the
 * October snapshots (#9): practice mode, the generate request rewritten to the
 * fixed intro example, Math.random seeded, Playwright driving the pre-installed
 * Chromium at device scale 1.
 *
 * For each game and size it saves five frames to --out:
 *   <game>-<w>x<h>-intro.png   the round intro, 2.5 s after it opens
 *   <game>-<w>x<h>-play.png    mid-play after a few scripted taps
 *   <game>-<w>x<h>-finish.png  the completion effect, ~350 ms in (dev trigger:
 *                              the `duelz-dev-word-finish` window event plays it on the
 *                              board as it stands; main has no effect, so before = board)
 *   <game>-<w>x<h>-reveal.png  timed out with nothing entered (as #9)
 *   <game>-<w>x<h>-full.png    the reveal for a full answer (layout stress test: the
 *                              grade request carries scripts/word-polish-answers.ts)
 * and prints the gaps above and below the play area, and the reveal's overflow,
 * smallest font sizes and lowest text contrast, as JSON lines.
 *
 *   bun scripts/word-polish-shots.ts --url=http://127.0.0.1:5181 --out=/tmp/shots --label=before
 *   bun scripts/word-polish-shots.ts --sizes=375x667 strikeout codeword
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import type { Page } from "playwright";

import { gameDisplayName } from "../src/lib/duel/gameNames";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5181").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/polish-word/raw";
const LABEL = opt("label") ?? "after";
const SIZES = (opt("sizes") ?? "375x667,390x844").split(",").map((s) => s.split("x").map(Number) as [number, number]);
const ALL = ["wordsmith", "wordhunt", "tilegrid", "wordslide", "wordsearch", "letterwheel", "strikeout", "codeword", "swapword", "wordfall"];
const picked = args.filter((a) => !a.startsWith("--"));
const GAMES = picked.length ? picked : ALL;
/** --gaps: mid-play frame and gap measurements only (fast layout iterations). */
const GAPS_ONLY = args.includes("--gaps");
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const ANSWERS = JSON.parse(execFileSync("bun", ["scripts/word-polish-answers.ts"], { encoding: "utf8" }).trim().split("\n").at(-1)!) as Record<string, string>;

/** The drawn play area of each game (union of matches). */
const BOARD: Record<string, string> = {
  wordsmith: "[data-game-stage] .wordsmith-ring",
  wordhunt: "[data-game-stage] .puzzle-board",
  tilegrid: '[data-game-stage] [aria-label="Interlock board"]',
  wordslide: '[data-game-stage] [data-game-arena="fixed"]',
  wordsearch: "[data-game-stage] [data-play-area]",
  letterwheel: '[data-game-stage] [data-arena-part="letterwheel-board"] > div, [data-game-stage] [data-play-area]',
  strikeout: '[data-game-stage] [data-game-arena="strikeout"] > div',
  codeword: '[data-game-stage] [data-game-arena="codeword"] > div',
  swapword: '[data-game-stage] [aria-label="Swapword board"]',
  wordfall: "[data-game-stage] canvas",
};

const SEED_RANDOM = `(() => { let a = 20261013; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

async function center(page: Page, selector: string, index = 0): Promise<[number, number] | null> {
  const box = await page.locator(selector).nth(index).boundingBox();
  return box ? [box.x + box.width / 2, box.y + box.height / 2] : null;
}
async function tap(page: Page, selector: string, index = 0) {
  const c = await center(page, selector, index);
  if (c) await page.mouse.click(c[0], c[1]);
  await page.waitForTimeout(160);
}

/** A few honest inputs so mid-play shows a board in use (no answers needed). */
async function midPlay(page: Page, game: string) {
  switch (game) {
    case "wordsmith":
      for (const i of [4, 0, 2]) await tap(page, `[data-wordsmith-tile="${i}"]`);
      break;
    case "wordhunt":
      await tap(page, "[data-cell]", 0);
      await tap(page, "[data-cell]", 1);
      break;
    case "tilegrid": {
      // Place the example solution's first across word (a real word, so it can light up).
      const grid = ANSWERS["tilegrid"] ?? "";
      const m = /[A-Z]{3,}/.exec(grid.replace(/\./g, " ").match(/.{7}/g)?.find((row) => /[A-Z]{3,}/.test(row)) ?? "");
      const row = grid.match(/.{7}/g)?.findIndex((r) => /[A-Z]{3,}/.test(r)) ?? -1;
      if (m && row >= 0)
        for (let i = 0; i < m[0].length; i++) {
          const tray = page.locator('[data-game-controls="tray"] .word-letter-tile', { hasText: new RegExp(`^${m[0][i]}$`) }).first();
          await tray.click();
          await page.waitForTimeout(120);
          await tap(page, ".interlock-cell", row * 7 + m.index + i);
        }
      await page.waitForTimeout(800);
      break;
    }
    case "wordslide": {
      const c = await center(page, "[data-cell]", 7);
      if (c) {
        await page.mouse.move(c[0], c[1]);
        await page.mouse.down();
        await page.mouse.move(c[0] + 60, c[1], { steps: 4 });
        await page.mouse.up();
      }
      break;
    }
    case "wordsearch": {
      // Drag out the example's first hidden word.
      const [a, b] = (ANSWERS["wordsearch"] ?? "").split(",")[0]!.split(".").map(Number);
      const from = await center(page, "[data-game-stage] [data-play-area] > div", a!);
      const to = await center(page, "[data-game-stage] [data-play-area] > div", b!);
      if (from && to) {
        await page.mouse.move(from[0], from[1]);
        await page.mouse.down();
        await page.mouse.move(to[0], to[1], { steps: 8 });
        await page.mouse.up();
      }
      await page.waitForTimeout(800);
      break;
    }
    case "letterwheel":
      await tap(page, "[data-play-area]");
      break;
    case "strikeout":
      for (const k of ["E", "A", "R"]) await tap(page, `[data-key="${k}"]`);
      await page.waitForTimeout(600);
      break;
    case "codeword":
      await tap(page, "[data-cw-cell]", 3);
      break;
    case "swapword":
      await tap(page, "[data-sw-tile]", 1);
      break;
    case "wordfall":
      for (const [x, y] of [[0.3, 0.85], [0.45, 0.85], [0.45, 0.75]] as const) {
        const box = await page.locator("[data-game-stage] canvas").boundingBox();
        if (box) await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
        await page.waitForTimeout(200);
      }
      break;
  }
  await page.waitForTimeout(500);
}

/** Gaps between the play area and the nearest drawn thing above and below it. */
function measureGaps(selector: string) {
  const boards = [...document.querySelectorAll(selector)].filter((el) => el.getBoundingClientRect().height > 0);
  if (!boards.length) return null;
  const rects = boards.map((b) => b.getBoundingClientRect());
  const top = Math.min(...rects.map((r) => r.top));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const layout = document.querySelector("[data-round-layout]");
  const region = document.querySelector("[data-game-region]")?.getBoundingClientRect();
  let above = -Infinity;
  let below = Infinity;
  const drawn = (el: Element) => {
    if (["BUTTON", "CANVAS", "svg", "IMG", "INPUT"].includes(el.tagName)) return true;
    if ([...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "")) return true;
    const style = getComputedStyle(el);
    return style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.borderTopWidth !== "0px" || style.backgroundImage !== "none";
  };
  for (const el of layout?.querySelectorAll("*") ?? []) {
    if (boards.some((b) => b.contains(el) || el.contains(b))) continue;
    const r = el.getBoundingClientRect();
    // The whole width counts: the top bar and timer above, the control rows below.
    if (r.height < 1 || r.width < 1) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || Number(style.opacity) === 0 || !drawn(el)) continue;
    if (r.bottom <= top + 1) above = Math.max(above, r.bottom);
    else if (r.top >= bottom - 1) below = Math.min(below, r.top);
  }
  if (!Number.isFinite(below)) below = region?.bottom ?? window.innerHeight;
  return {
    board: { top: Math.round(top), bottom: Math.round(bottom), width: Math.round(Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left))), height: Math.round(bottom - top) },
    above: Math.round(top - above),
    below: Math.round(below - bottom),
  };
}

/** Reveal: overflow, smallest text, lowest contrast against the nearest painted background. */
function measureReveal() {
  const root = document.querySelector(".answer-reveal-content") ?? document.querySelector("[data-arcade-reveal]") ?? document.body;
  // Any CSS colour (oklab, color-mix…) to sRGB + alpha through a 1 px canvas.
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const parse = (c: string) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r!, g!, b!, a! / 255];
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
  };
  // The painted background: a gradient's stops (worst one counts) or the first opaque colour up the tree.
  const bgOf = (el: Element | null): number[][] => {
    for (let n = el; n; n = n.parentElement) {
      const style = getComputedStyle(n);
      const stops = style.backgroundImage.match(/(?:rgba?|oklab|oklch|lab|lch|color)\([^()]*\)/g);
      if (stops?.length) return stops.map(parse);
      const c = parse(style.backgroundColor);
      if ((c[3] ?? 0) > 0.5) return [c];
    }
    return [[10, 10, 15, 1]];
  };
  let minFont = Infinity;
  let minContrast = Infinity;
  let worst = "";
  for (const el of root.querySelectorAll("*")) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
    if (!own) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || el.getBoundingClientRect().height === 0) continue;
    const size = parseFloat(style.fontSize);
    minFont = Math.min(minFont, size);
    const fg = parse(style.color);
    if ((fg[3] ?? 0) < 0.05) continue;
    const a = lum(fg);
    const ratio = Math.min(...bgOf(el).map((bg) => {
      const b = lum(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }));
    if (ratio < minContrast) {
      minContrast = ratio;
      worst = (el.textContent ?? "").trim().slice(0, 24);
    }
  }
  return {
    overflow: Math.max(0, root.scrollHeight - root.clientHeight),
    minFont: Number.isFinite(minFont) ? minFont : null,
    minContrast: Number.isFinite(minContrast) ? Math.round(minContrast * 100) / 100 : null,
    worst,
  };
}

async function open(page: Page, game: string, answer: string | null) {
  await page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData() ?? "";
    if (body.includes('"k":["type","example"]')) {
      return route.continue({ postData: body.replace(/("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/, '$1{"t":2,"s":2}') });
    }
    if (answer !== null && body.includes('"answer"') && body.includes('"msRemaining"')) {
      // Seroval request body: data's keys and values sit side by side; swap the answer string.
      const parsed = JSON.parse(body) as { t: { p: { v: { p: { k: string[]; v: unknown[] } }[] } } };
      const inner = parsed.t.p.v[0]!.p;
      const at = inner.k.indexOf("answer");
      if (at >= 0) inner.v[at] = { t: 1, s: answer };
      return route.continue({ postData: JSON.stringify(parsed) });
    }
    return route.continue();
  });
  await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: gameDisplayName(game as never), exact: true }).first();
  await button.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1200);
  await button.click();
  await page.getByRole("button", { name: /^Ready/ }).waitFor({ timeout: 60_000 });
}

async function toPlay(page: Page) {
  await page.getByRole("button", { name: /^Ready/ }).click();
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(4200);
}

async function toReveal(page: Page, game: string) {
  // Time runs out: jump the page clock past the round (the arcade loop needs its frames run).
  if (game === "wordfall") {
    // Step until the reveal ("Round 1 of …") is up, without running past its 8 s.
    for (let i = 0; i < 400; i++) {
      await page.clock.runFor(500);
      if (/round 1 of/i.test(await page.evaluate(() => document.body.innerText))) break;
    }
  }
  else await page.clock.fastForward(200_000);
  await page.waitForFunction(() => !document.body.innerText.includes("Scoring…") && !!document.querySelector("[data-verdict]:not([data-verdict=pending]), [data-arcade-reveal], canvas"), null, { timeout: 60_000 });
  await page.waitForTimeout(1800);
}

if (!existsSync(CHROMIUM)) {
  console.log(`FAIL: environment: no Chromium at ${CHROMIUM}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const report: unknown[] = [];
try {
  for (const [width, height] of SIZES) {
    for (const game of GAMES) {
      const name = `${OUT}/${game}-${width}x${height}`;
      const entry: Record<string, unknown> = { label: LABEL, game, size: `${width}x${height}` };
      try {
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
        await context.addInitScript(SEED_RANDOM);
        const page = await context.newPage();
        await page.clock.install();
        await open(page, game, null);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${name}-intro.png` });
        await toPlay(page);
        await midPlay(page, game);
        entry["gaps"] = await page.evaluate(measureGaps, BOARD[game]!);
        await page.screenshot({ path: `${name}-play.png` });
        if (GAPS_ONLY) {
          await context.close();
          report.push(entry);
          console.log(JSON.stringify(entry));
          continue;
        }
        await page.evaluate(() => window.dispatchEvent(new CustomEvent("duelz-dev-word-finish")));
        if (game === "wordfall") for (let i = 0; i < 21; i++) await page.clock.runFor(17);
        else await page.waitForTimeout(350);
        await page.screenshot({ path: `${name}-finish.png` });
        await page.waitForTimeout(1200);
        await toReveal(page, game);
        entry["reveal"] = await page.evaluate(measureReveal);
        await page.screenshot({ path: `${name}-reveal.png` });
        await context.close();

        if (ANSWERS[game] !== undefined) {
          const full = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
          await full.addInitScript(SEED_RANDOM);
          const fp = await full.newPage();
          await fp.clock.install();
          await open(fp, game, ANSWERS[game]!);
          await toPlay(fp);
          await toReveal(fp, game);
          entry["full"] = await fp.evaluate(measureReveal);
          await fp.screenshot({ path: `${name}-full.png` });
          await full.close();
        }
      } catch (error) {
        entry["error"] = String(error).split("\n")[0];
        for (const ctx of browser.contexts()) for (const p of ctx.pages()) await p.screenshot({ path: `${name}-error.png` }).catch(() => undefined);
      }
      report.push(entry);
      console.log(JSON.stringify(entry));
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/report-${LABEL}.json`, JSON.stringify(report, null, 1));
