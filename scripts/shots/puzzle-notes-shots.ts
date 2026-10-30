/**
 * Review frames for Joe's puzzle notes (28 Oct 2026, docs/puzzle-notes-oct-2026.md): Slider's last-row swap,
 * Strikeout's solved words, Integer Pyramid's gold rows, Flash's summary line and Tally's second tray, at 414×896
 * (and 375×667 with --sizes). A design tool, not a check.
 *
 *   bun scripts/shots/puzzle-notes-shots.ts --url=<origin> --tag=before|after [--out=<dir>] [--sizes=414x896,375x667]
 *
 * Every game opens from /practice on its fixed intro example with Math.random seeded (as capture.ts does), so main
 * in a worktree and the branch show the same boards. Slider starts from a seeded position: the example solved by a
 * bidirectional search, rows 1–4 locked and the last row turned one step, then (after) one tile picked to swap.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Browser, type Page } from "playwright";

import { gameDisplayName } from "../../src/lib/duel/gameNames";
import type { PuzzleType } from "../../src/lib/duel/types";
import { applyShift, shiftToken, WS_SIZE, type SlideShift } from "../../src/lib/duel/wordSlide";
import { exampleFor } from "./examples";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5190").replace(/\/$/, "");
const TAG = opt("tag") ?? "after";
const OUT = opt("out") ?? ".shots/puzzle-notes";
const SIZES = (opt("sizes") ?? "414x896").split(",").map((s) => s.split("x").map(Number) as [number, number]);
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

const SEED_RANDOM = `(() => {
  let s = 20261013 >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();`;

function serverFnName(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
  } catch {
    return id;
  }
}

/** Slider: the shortest shift list from the example's grid to its five words (meet in the middle, 4 + 4). */
function solveSlider(grid: string[], words: string[]): string[] {
  const all: SlideShift[] = [];
  for (const axis of ["r", "c"] as const) for (let index = 0; index < WS_SIZE; index++) for (const dir of [1, -1] as const) all.push({ axis, index, dir });
  const goal = words.join("");
  const expand = (from: string, depth: number) => {
    const seen = new Map<string, SlideShift[]>([[from, []]]);
    let frontier = [from];
    for (let d = 0; d < depth; d++) {
      const next: string[] = [];
      for (const key of frontier) for (const s of all) {
        const g = applyShift([...key], s).join("");
        if (!seen.has(g)) { seen.set(g, [...seen.get(key)!, s]); next.push(g); }
      }
      frontier = next;
    }
    return seen;
  };
  const fwd = expand(grid.join(""), 4);
  const back = expand(goal, 4);
  for (const [key, path] of fwd) {
    const tail = back.get(key);
    if (!tail) continue;
    const undo = [...tail].reverse().map((s) => ({ ...s, dir: -s.dir as 1 | -1 }));
    return [...path, ...undo].map(shiftToken);
  }
  throw new Error("Slider example: no solution within 8 shifts");
}

async function open(browser: Browser, game: PuzzleType, size: [number, number], seed?: Record<string, unknown>) {
  const context = await browser.newContext({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 2 });
  await context.addInitScript(SEED_RANDOM);
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(`  page error: ${String(e.message).split("\n")[0]}`));
  await page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData() ?? "";
    if (/practiceGenerate/.test(serverFnName(route.request().url())))
      return route.continue({ postData: body.replace(/("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/, '$1{"t":2,"s":2}') });
    return route.continue();
  });
  await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
  await button.waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1500);
  if (seed) {
    await page.evaluate(async (values) => {
      const mod = (await import(/* @vite-ignore */ "/scripts/shots/seed.tsx")) as { seedStageState: (k: string[], v: Record<string, unknown>) => void };
      mod.seedStageState(["practice-1", "practice-2", "practice-3"], values);
    }, seed);
  }
  await button.click();
  await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 120_000 });
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  return { page, close: () => context.close() };
}

async function tapCentre(page: Page, selector: string, index = 0) {
  const box = await page.locator(selector).nth(index).boundingBox();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(180);
}

const shot = (page: Page, name: string, size: [number, number]) =>
  page.screenshot({ path: join(OUT, `${name}-${size[0]}x${size[1]}-${TAG}.png`) });

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  for (const size of SIZES) {
    // 1. Slider: four rows locked, the last row turned one step; after, its second tile picked.
    {
      const p = exampleFor("wordslide") as { grid: string[]; words: string[] };
      const tokens = [...solveSlider(p.grid, p.words), "L0", "L1", "L2", "L3", "r4+"];
      const { page, close } = await open(browser, "wordslide", size, { slideTokens: tokens });
      await page.waitForTimeout(1200);
      await shot(page, "slider", size);
      await tapCentre(page, "[data-cell]", 21);
      await page.waitForTimeout(300);
      await shot(page, "slider-picked", size);
      await close();
    }
    // 2. Strikeout: the first two words solved with Solve.
    {
      const p = exampleFor("strikeout") as { words?: string[]; givens?: string[] };
      const { page, close } = await open(browser, "strikeout", size);
      for (let w = 0; w < 2; w++) {
        const word = p.words?.[w];
        if (!word) break;
        await page.getByRole("button", { name: "Solve" }).click();
        await page.waitForTimeout(200);
        for (let i = 0; i < word.length; i++) if ((p.givens?.[w]?.[i] ?? "_") === "_") await tapCentre(page, `[data-key="${word[i]}"]`);
        await page.getByRole("button", { name: "Solve" }).click();
        await page.waitForTimeout(1400);
      }
      await shot(page, "strikeout", size);
      await close();
    }
    // 3. Integer Pyramid: the first pyramid completed, mid CORRECT hold.
    {
      const p = exampleFor("numpyramid") as { pyramids: { givens: (number | null)[] }[]; solutions: number[][] };
      const { page, close } = await open(browser, "numpyramid", size);
      const stage = page.locator("[data-game-stage]");
      const empties = p.pyramids[0]!.givens.map((g, i) => (g == null ? i : -1)).filter((i) => i >= 0);
      for (const cell of empties) {
        await stage.locator("[data-np-tray] .pyramid-tray-tile").filter({ hasText: new RegExp(`^\\s*${p.solutions[0]![cell]}\\s*$`) }).first().click();
        await stage.locator(`[data-np-cell="${cell}"]`).last().click();
        await page.waitForTimeout(120);
      }
      await page.waitForTimeout(600);
      await shot(page, "pyramid-correct", size);
      await close();
    }
    // 4. Flash: the first gold flash tapped.
    {
      const { page, close } = await open(browser, "reaction", size);
      await page.locator('[data-flash-cue="gold"]').waitFor({ timeout: 30_000 });
      await page.waitForTimeout(220);
      await tapCentre(page, '[data-flash-cue]');
      await page.waitForTimeout(1500);
      await shot(page, "flash", size);
      await close();
    }
    // 5. Tally: the first tray answered, the second tray's question showing.
    {
      const { page, close } = await open(browser, "countup", size);
      await page.getByRole("button", { name: "9", exact: true }).dispatchEvent("pointerdown");
      await page.getByRole("button", { name: "Enter", exact: true }).dispatchEvent("pointerdown");
      await page.waitForTimeout(1200);
      await shot(page, "tally-tray2", size);
      await close();
    }
    console.log(`${size[0]}x${size[1]} done`);
  }
  await browser.close();
}

void main();
