/**
 * Game frame probe (Polish 2, 24 Oct 2026): opens each puzzle's live round in practice at 414×896 and
 * 375×667 and reports, per game: header, goal line and score text that is cut off or wraps; board
 * content past the tray (its border box, or into its 14px padding); dock controls under 52px tall;
 * anything past the screen's sides or bottom. A design tool, not a check (CI never runs it).
 *
 *   bun scripts/shots/frame-probe.ts [games…] [--url=<origin>] [--json=<file>]
 *
 * Without --url it needs a dev server started like the contact sheet's (Supabase on a closed port).
 */
import { writeFileSync } from "node:fs";

import type { Browser } from "playwright";

import { gameDisplayName } from "../../src/lib/duel/gameNames";
import { ACTIVE_PUZZLE_TYPES, puzzleDef } from "../../src/lib/duel/registry";
import type { PuzzleType } from "../../src/lib/duel/types";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5391").replace(/\/$/, "");
const SIZES: [number, number][] = [[414, 896], [375, 667]];
const SEED = `(() => { let s = 20261013 >>> 0; Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

interface Probe {
  cut: string[];
  overBorder: string[];
  intoPadding: string[];
  smallDock: string[];
  offScreen: string[];
  tray: { w: number; h: number } | null;
}

async function probe(browser: Browser, game: PuzzleType, [w, h]: [number, number]): Promise<Probe | string> {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await context.addInitScript(SEED);
  const page = await context.newPage();
  try {
    await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded" });
    const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
    await button.waitFor({ timeout: 90_000 });
    await page.waitForTimeout(1200);
    await button.click();
    const ready = page.getByRole("button", { name: /^Ready/ }).first();
    await ready.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(500);
    await ready.click();
    await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    return await page.evaluate(() => {
      const out = { cut: [] as string[], overBorder: [] as string[], intoPadding: [] as string[], smallDock: [] as string[], offScreen: [] as string[], tray: null as { w: number; h: number } | null };
      const label = (el: Element) => `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""}${(el.textContent ?? "").trim() ? ` "${(el.textContent ?? "").trim().slice(0, 18)}"` : ""}`;
      for (const sel of [".game-frame-name", ".game-frame-context-text", ".game-goal-text", ".game-goal-progress", ".game-frame-score-value", ".game-frame-score-note", ".game-frame-score-label"]) {
        for (const el of document.querySelectorAll<HTMLElement>(sel)) {
          if (el.scrollWidth > el.clientWidth + 0.5 || el.scrollHeight > el.clientHeight + 1) out.cut.push(`${sel} "${el.textContent}"`);
        }
      }
      const arena = document.querySelector<HTMLElement>("[data-game-stage] [data-game-arena]");
      const tray = arena && getComputedStyle(arena).paddingTop === "14px" ? arena : null;
      if (tray) {
        const r = tray.getBoundingClientRect();
        out.tray = { w: Math.round(r.width), h: Math.round(r.height) };
        const inner = { l: r.left + 15, t: r.top + 15, r: r.right - 15, b: r.bottom - 15 };
        for (const el of tray.querySelectorAll<HTMLElement>("*")) {
          const b = el.getBoundingClientRect();
          if (b.width < 2 || b.height < 2) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.opacity === "0" || cs.position === "fixed") continue;
          if (b.left < r.left - 1 || b.right > r.right + 1 || b.top < r.top - 1 || b.bottom > r.bottom + 1) out.overBorder.push(`${label(el)} ${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}`);
          else if (b.left < inner.l - 3 || b.right > inner.r + 3 || b.top < inner.t - 3 || b.bottom > inner.b + 3) out.intoPadding.push(label(el));
        }
        // Controls after the tray: the dock.
        const stage = document.querySelector("[data-game-stage]")!;
        for (const el of stage.querySelectorAll<HTMLElement>("button, [role='button']")) {
          if (tray.contains(el)) continue;
          const b = el.getBoundingClientRect();
          if (b.top < r.bottom - 1 || b.width < 2) continue;
          if (b.height < 51.5) out.smallDock.push(`${label(el)} ${Math.round(b.height)}px`);
        }
      }
      for (const el of document.querySelectorAll<HTMLElement>("[data-game-column] *")) {
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.height < 2 || getComputedStyle(el).visibility === "hidden") continue;
        if (el.closest("[data-fx-layer], .fx-layer, [data-radix-popper-content-wrapper]")) continue;
        if (b.left < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1) out.offScreen.push(`${label(el)} ${Math.round(b.left)}..${Math.round(b.right)} / ${Math.round(b.bottom)}`);
      }
      out.overBorder = out.overBorder.slice(0, 6);
      out.intoPadding = [...new Set(out.intoPadding)].slice(0, 6);
      out.smallDock = [...new Set(out.smallDock)].slice(0, 8);
      out.offScreen = out.offScreen.slice(0, 6);
      return out;
    });
  } catch (error) {
    return String((error as Error).message ?? error).split("\n")[0]!;
  } finally {
    await context.close();
  }
}

const named = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
const games = (named.length ? named : ACTIVE_PUZZLE_TYPES).filter((t) => {
  const d = puzzleDef(t);
  return d.category !== "arcade" && !d.arcadeRun;
});
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const results: Record<string, Record<string, Probe | string>> = {};
try {
  for (const game of games) {
    results[game] = {};
    for (const size of SIZES) {
      const r = await probe(browser, game, size);
      results[game]![size.join("x")] = r;
      if (typeof r === "string") console.log(`${game} ${size.join("x")}: ERROR ${r}`);
      else {
        const parts = [
          r.tray ? `tray ${r.tray.w}x${r.tray.h}` : "no tray",
          r.cut.length ? `CUT ${r.cut.join("; ")}` : "",
          r.overBorder.length ? `OVER ${r.overBorder.length}: ${r.overBorder.slice(0, 2).join("; ")}` : "",
          r.intoPadding.length ? `pad ${r.intoPadding.length}` : "",
          r.smallDock.length ? `dock<52 ${r.smallDock.length}: ${r.smallDock.slice(0, 3).join("; ")}` : "",
          r.offScreen.length ? `OFF ${r.offScreen.slice(0, 2).join("; ")}` : "",
        ].filter(Boolean);
        console.log(`${game} ${size.join("x")}: ${parts.join(" | ")}`);
      }
    }
  }
} finally {
  await browser.close();
}
const json = opt("json");
if (json) writeFileSync(json, JSON.stringify(results, null, 1));
