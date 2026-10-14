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
 *   bun scripts/bottom-clearance-check.ts [games…] [--part=k/n] [--url=<origin>] [--verbose]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

import type { Page } from "playwright";

import { ACTIVE_PUZZLE_TYPES } from "../src/lib/duel/registry";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import type { PuzzleType } from "../src/lib/duel/types";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const VERBOSE = args.includes("--verbose");
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 5195;
export const CLEARANCE_PX = 12;
export const TOOLBAR_PX = 80;
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
  shellBottom: number | null;
  worst: { label: string; bottom: number; clearance: number; clipped: boolean } | null;
  bad: { label: string; bottom: number; clearance: number; clipped: boolean }[];
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
  const shell = document.querySelector("[data-game-column]")?.parentElement ?? null;
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
    if (!worst || clearance < worst.clearance) worst = row;
    if (clipped || clearance < 12) out.push(row);
  }
  return {
    innerHeight: window.innerHeight,
    dvh: Math.round(dvh),
    shellBottom: shell ? Math.round(shell.getBoundingClientRect().bottom) : null,
    worst,
    bad: out,
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

async function measureAll(page: Page, scope: "stage" | "intro", game: string, failures: string[]) {
  for (const v of VIEWPORTS) {
    await page.setViewportSize({ width: v.w, height: v.h });
    await page.waitForTimeout(350);
    const m = await page.evaluate(measure, scope);
    const where = `${game} ${scope} ${v.w}x${v.h}${v.toolbar ? ` (${PHONES.find(([w]) => w === v.w)![1]} with ${v.toolbar}px toolbar)` : ""}`;
    if (scope === "stage" && m.shellBottom != null && Math.abs(m.shellBottom - m.dvh) > 1)
      failures.push(`${where}: shell ends at ${m.shellBottom}px, dynamic viewport at ${m.dvh}px`);
    if (scope === "intro" && m.count === 0) failures.push(`${where}: no Ready button found`);
    for (const b of m.bad)
      failures.push(
        `${where}: "${b.label}" bottom ${b.bottom}px, ${b.clearance}px clearance${b.clipped ? ", clipped by the game region" : ""}`,
      );
    if (VERBOSE)
      console.log(
        `  ${where}: ${m.count} controls, worst ${m.worst ? `"${m.worst.label}" ${m.worst.clearance}px` : "-"}`,
      );
  }
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
  let measured = 0;
  try {
    for (const game of games) {
      const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
      await context.addInitScript(SEED_RANDOM);
      const page = await context.newPage();
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
        await measureAll(page, "intro", game, failures);
        await page.setViewportSize({ width: 375, height: 667 });
        await readyButton.click();
        await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
        await page.waitForTimeout(1500);
        await measureAll(page, "stage", game, failures);
        measured++;
      } catch (error) {
        failures.push(`${game}: ${String((error as Error).message ?? error).split("\n")[0]}`);
      } finally {
        await context.close();
      }
      const mine = failures.length - before;
      console.log(
        `${mine ? "FAIL" : "PASS"} ${game} (${gameDisplayName(game)}): ${mine ? `${mine} problem(s)` : `every control ≥ ${CLEARANCE_PX}px clear at 4 viewports`}`,
      );
      if (errors.length && VERBOSE)
        console.log(`  page errors: ${[...new Set(errors)].slice(0, 3).join(" | ")}`);
    }
  } finally {
    await browser.close();
    if (proc?.pid) process.kill(-proc.pid);
  }
  for (const f of failures) console.log(`  ${f}`);
  if (failures.length) {
    console.log(
      `FAIL: ${failures.length} control(s) under ${CLEARANCE_PX}px clearance or clipped (${measured}/${games.length} games measured)`,
    );
    process.exit(1);
  }
  console.log(
    `PASS: ${measured} games, every control at least ${CLEARANCE_PX}px above the visible bottom at 375x667, 390x844 and both with an ${TOOLBAR_PX}px toolbar`,
  );
}

await main();
