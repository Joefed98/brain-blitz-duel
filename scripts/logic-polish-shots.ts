/**
 * Logic polish captures: intro, mid-play, the completion effect and the reveal for each
 * Logic game, plus measured gaps above and below the play area. A capture tool, not a
 * check (it needs Chromium and a dev server, like intro-ready-measure).
 *
 *   bun scripts/logic-polish-shots.ts --url=http://127.0.0.1:5175 --tag=before
 *   bun scripts/logic-polish-shots.ts --url=http://127.0.0.1:5176 --tag=after lightsout tower
 *
 * Every game opens from /practice with the generate request switched to the fixed intro
 * example (INTRO_EXAMPLE_SEED), and `Math.random` is seeded, so two runs show the same
 * puzzle. The script builds the same example with the server's own generator to know its
 * solution, then plays it through the real UI. The practice grade request is held 1.5 s
 * so the stage stays on screen long enough to photograph the completion effect (a room
 * keeps the stage up under its Locked overlay; practice swaps to the reveal as soon as
 * the local grade returns). Writes PNGs and `<tag>-measure.json` to the output folder.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { bankedIntroExample } from "../src/lib/duel/puzzleBank.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

const args = process.argv.slice(2);
const ORIGIN = (args.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://127.0.0.1:5175").replace(/\/$/, "");
const TAG = args.find((a) => a.startsWith("--tag="))?.slice(6) ?? "after";
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/polish-logic";
const ALL: PuzzleType[] = ["lightsout", "sudoku", "tower", "tubes", "safe", "bomb", "nonogram", "flood", "tents", "shikaku", "lightup"];
const picked = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
const GAMES = picked.length ? picked : ALL;
const SIZE_ARG = args.find((a) => a.startsWith("--sizes="))?.slice(8);
const SIZES: [number, number, boolean][] = SIZE_ARG
  ? SIZE_ARG.split(",").map((s) => { const [w, h] = s.split("x").map(Number); return [w!, h!, true]; })
  : [[375, 667, true], [390, 844, true], [430, 932, false]];

type Full = PuzzleData & Record<string, unknown>;
function example(type: PuzzleType): Full {
  return (bankedIntroExample(type) ?? withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type, { unblockRow: null }))) as Full;
}

const { chromium } = await import("playwright");
type Page = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>;

const STAGE = "[data-game-stage]";
const READY_SEL = `${STAGE} [data-game-arena], ${STAGE} .logic-nonogram-board, ${STAGE} .puzzle-board`;
const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

/** One input step per entry; the last step solves the puzzle. */
function steps(type: PuzzleType, p: Full): ((page: Page) => Promise<void>)[] {
  const click = (selector: string, nth = 0) => async (page: Page) => {
    await page.locator(`${STAGE} ${selector}`).nth(nth).click();
    await pause(page, 140);
  };
  const press = (selector: string, nth = 0) => async (page: Page) => {
    const box = await page.locator(`${STAGE} ${selector}`).nth(nth).boundingBox();
    if (!box) throw new Error(`${type}: no ${selector} #${nth}`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await pause(page, 140);
  };
  const gridCell = (board: string, size: number, cell: number) => async (page: Page) => {
    const box = await page.locator(`${STAGE} ${board}`).first().boundingBox();
    if (!box) throw new Error(`${type}: no board`);
    const x = box.x + ((cell % size) + 0.5) * (box.width / size);
    const y = box.y + (Math.floor(cell / size) + 0.5) * (box.height / size);
    return { x, y };
  };
  switch (type) {
    case "lightsout":
      return (p["solution"] as number[]).map((cell) => click(".lightsout-bulb", cell));
    case "sudoku": {
      const givens = p["givens"] as number[];
      const solution = p["solution"] as number[];
      return givens.flatMap((given, cell) =>
        given ? [] : [async (page: Page) => {
          await click(".sudoku-grid > button", cell)(page);
          await page.locator(`${STAGE} [data-game-controls="numbers"] .grid-cols-6 > button`).nth((solution[cell] ?? 1) - 1).click();
          await pause(page, 80);
        }],
      );
    }
    case "tower":
    case "tubes": {
      const label = type === "tower" ? "Post" : "Flask";
      return String(p["solution"]).split(",").map((move) => async (page: Page) => {
        const [from, to] = move.split(">").map(Number);
        await click(`button[aria-label="${label} ${from! + 1}"]`)(page);
        await click(`button[aria-label="${label} ${to! + 1}"]`)(page);
      });
    }
    case "safe": {
      const combination = p["combination"] as number[];
      const dials = combination.flatMap((digit, dial) =>
        Array.from({ length: digit }, () => press('button[aria-label="Up"]', dial)),
      );
      return [...dials, click("button:has-text('Try')")];
    }
    case "bomb":
      return [
        ...String(p["sequence"] ?? p["required"]).split(",").map((action) =>
          action.startsWith("w")
            ? click(`button[aria-label="Wire ${Number(action.slice(1)) + 1}"]`)
            : click(`button[aria-label="Button ${action.slice(1)}"]`),
        ),
        click("button:has-text('Defuse')"),
      ];
    case "nonogram": {
      const pattern = p["pattern"] as boolean[];
      const size = Math.round(Math.sqrt(pattern.length));
      return pattern.flatMap((on, cell) => (on ? [press(`button[aria-label="Row ${Math.floor(cell / size) + 1} column ${(cell % size) + 1}"]`)] : []));
    }
    case "flood": {
      const names = ["Magenta", "Blue", "Mint", "Yellow", "Orange"];
      return (p["solution"] as number[]).map((colour) => press(`button[aria-label="${names[colour]}"]`));
    }
    case "tents": {
      const size = p["size"] as number;
      // Buttons follow the cell order (trees are disabled buttons in place).
      return (p["solution"] as number[]).map((cell) => click(`[data-game-arena] button`, cell));
    }
    case "shikaku": {
      const size = p["size"] as number;
      return (p["solution"] as { r0: number; c0: number; r1: number; c1: number }[]).map((r) => async (page: Page) => {
        const a = await gridCell(".shikaku-board", size, r.r0 * size + r.c0)(page);
        const b = await gridCell(".shikaku-board", size, r.r1 * size + r.c1)(page);
        await page.mouse.move(a.x, a.y);
        await page.mouse.down();
        await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
        await page.mouse.move(b.x, b.y, { steps: 3 });
        await page.mouse.up();
        await pause(page, 160);
      });
    }
    case "lightup": {
      const size = p["size"] as number;
      return (p["solution"] as number[]).map((cell) => async (page: Page) => {
        const board = page.locator(`${STAGE} [data-game-arena] > div`).first();
        const box = await board.boundingBox();
        if (!box) throw new Error("lightup: no board");
        await page.mouse.move(box.x + ((cell % size) + 0.5) * (box.width / size), box.y + (Math.floor(cell / size) + 0.5) * (box.height / size));
        await page.mouse.down();
        await page.mouse.up();
        await pause(page, 140);
      });
    }
    default:
      return [];
  }
}

/** Bottom controls per game (play area ends above them); null = the region's bottom. */
const CONTROLS: Partial<Record<PuzzleType, string>> = {
  lightsout: '[data-game-controls="actions"]',
  sudoku: '[data-game-controls="numbers"]',
  tower: '[data-game-controls="actions"]',
  tubes: '[data-game-controls="actions"]',
  safe: '[data-game-controls="actions"]',
  bomb: '[data-game-controls="actions"]',
  flood: '[data-game-controls="colours"]',
};

async function measurePlay(page: Page, type: PuzzleType) {
  return page.evaluate(([controlsSel]) => {
    const region = document.querySelector("[data-game-region]")!.getBoundingClientRect();
    const stage = document.querySelector("[data-game-stage]")!;
    const controls = controlsSel ? stage.querySelector(controlsSel) : null;
    const bottom = controls ? controls.getBoundingClientRect().top : region.bottom;
    let top = Infinity, low = -Infinity, left = Infinity, right = -Infinity;
    for (const el of stage.querySelectorAll<HTMLElement>("*")) {
      if (el.closest("[data-game-controls]") && el.closest("[data-game-controls]") !== stage.querySelector('[data-game-controls="dial"]')) continue;
      if (el.closest("[data-logic-fx]")) continue;
      const style = getComputedStyle(el);
      // Leaves, plus any drawn surface (a panel's padding is part of what players see).
      const painted = style.backgroundImage !== "none" || !/rgba\(0, 0, 0, 0\)|transparent/.test(style.backgroundColor) || parseFloat(style.borderTopWidth) > 0;
      const leaf = el.children.length === 0 || el.tagName === "BUTTON" || el.tagName === "svg" || painted;
      if (!leaf) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (style.visibility === "hidden" || style.display === "none") continue;
      top = Math.min(top, r.top); low = Math.max(low, r.bottom); left = Math.min(left, r.left); right = Math.max(right, r.right);
    }
    const board = stage.querySelector<HTMLElement>("[data-game-arena]")?.getBoundingClientRect();
    return {
      regionTop: Math.round(region.top), regionBottom: Math.round(region.bottom), controlsTop: Math.round(bottom),
      playTop: Math.round(top), playBottom: Math.round(low), playWidth: Math.round(right - left), playHeight: Math.round(low - top),
      gapAbove: Math.round(top - region.top), gapBelow: Math.round(bottom - low),
      arena: board ? { w: Math.round(board.width), h: Math.round(board.height) } : null,
    };
  }, [CONTROLS[type] ?? null] as const);
}

async function measureReveal(page: Page) {
  return page.evaluate(() => {
    const content = document.querySelector<HTMLElement>(".answer-reveal-content");
    const scrolls = content ? content.scrollHeight > content.clientHeight + 1 : null;
    const pageScroll = document.scrollingElement!.scrollHeight > window.innerHeight + 1;
    const lum = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    // Normalise any CSS colour (oklch, color-mix…) to RGBA through a 1×1 canvas.
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const parse = (c: string): number[] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r!, g!, b!, a! / 255];
    };
    const bgOf = (el: Element | null): number[] => {
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if ((c[3] ?? 0) > 0.9) return c.slice(0, 3);
      }
      return parse(getComputedStyle(document.documentElement).getPropertyValue("--background") || "#0B0B0F").slice(0, 3);
    };
    let minFont = Infinity, minContrast = Infinity, worst = "";
    const root = content ?? document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const el = node.parentElement;
      if (!text || !el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1) continue;
      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      minFont = Math.min(minFont, size);
      const fg = parse(style.color);
      const opacity = Number(style.opacity);
      const bg = bgOf(el);
      const fgMix = fg.slice(0, 3).map((v, i) => v * (fg[3] ?? 1) * opacity + bg[i]! * (1 - (fg[3] ?? 1) * opacity));
      const [a, b] = [lum(fgMix), lum(bg)];
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < minContrast) { minContrast = ratio; worst = text.slice(0, 24); }
    }
    let clipped = 0;
    if (content) for (const el of content.querySelectorAll<HTMLElement>("*")) {
      const r = el.getBoundingClientRect();
      const c = content.getBoundingClientRect();
      if (r.height > 0 && (r.bottom > c.bottom + 1 || r.right > c.right + 1 || r.left < c.left - 1)) clipped++;
    }
    const svgs = content ? [...content.querySelectorAll(":scope > div")].map((n) => n.getBoundingClientRect()) : [];
    return { scrolls, pageScroll, clipped, minFont, minContrast: Math.round(minContrast * 100) / 100, worst, contentHeight: svgs[0]?.height ?? 0 };
  });
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
mkdirSync(OUT, { recursive: true });
const report: Record<string, unknown> = {};

async function open(page: Page, type: PuzzleType, holdGrade: boolean) {
  await page.addInitScript(() => {
    let s = 20261013 >>> 0;
    Math.random = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData() ?? "";
    if (body.includes('"example"')) {
      await route.continue({ postData: body.replace(/("k":\["type","example"\],"v":\[\{"t":1,"s":"[a-z]+"\},)\{"t":2,"s":3\}/, '$1{"t":2,"s":2}') });
      return;
    }
    if (holdGrade && body.includes('"msRemaining"')) await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: gameDisplayName(type), exact: true }).first().click({ timeout: 60_000 });
  await page.getByRole("button", { name: /ready/i }).first().waitFor({ timeout: 60_000 });
}

for (const [width, height, shots] of SIZES) {
  for (const type of GAMES) {
    const key = `${type}@${width}x${height}`;
    const puzzle = example(type);
    const plan = steps(type, puzzle);
    const file = (name: string) => `${OUT}/${type}-${width}x${height}-${name}-${TAG}.png`;
    const entry: Record<string, unknown> = { steps: plan.length };
    try {
      // Solved run: intro, mid-play, completion frames, solved reveal.
      const page = await browser.newPage({ viewport: { width, height } });
      page.on("console", (m) => { if (m.type() === "error" && !/supabase|Failed to load resource|ERR_/i.test(m.text())) console.log(`  console(${key}): ${m.text().slice(0, 160)}`); });
      const cues: string[] = [];
      await page.exposeFunction("__cue", (cue: string) => cues.push(cue));
      await page.addInitScript(() => window.addEventListener("duelz-sound", (e) => (window as unknown as { __cue: (c: string) => void }).__cue((e as CustomEvent<{ cue: string }>).detail.cue)));
      await open(page, type, true);
      await pause(page, 2500);
      if (shots) await page.screenshot({ path: file("intro") });
      await page.getByRole("button", { name: /ready/i }).first().click();
      await page.locator(READY_SEL).first().waitFor({ timeout: 20_000 });
      await pause(page, 900);
      entry["playEmpty"] = await measurePlay(page, type);
      const half = Math.max(1, Math.floor(plan.length / 2));
      for (const step of plan.slice(0, half)) await step(page);
      await pause(page, 500);
      entry["play"] = await measurePlay(page, type);
      if (shots) await page.screenshot({ path: file("play") });
      for (const step of plan.slice(half, -1)) await step(page);
      await pause(page, 300);
      const last = plan.at(-1);
      if (last) await last(page);
      const solvedAt = Date.now();
      for (const at of [120, 450, 850]) {
        await pause(page, Math.max(0, at - (Date.now() - solvedAt)));
        if (shots) await page.screenshot({ path: file(`fx${at}`) });
      }
      await page.locator("[data-reveal-score]").first().waitFor({ timeout: 20_000 });
      await pause(page, 1800);
      entry["revealSolved"] = await measureReveal(page);
      entry["solvedScore"] = await page.locator("[data-reveal-score]").first().getAttribute("data-reveal-score");
      if (shots) await page.screenshot({ path: file("reveal") });
      entry["cues"] = [...new Set(cues)];
      await page.close();

      // Partial run (375x667 only): half the moves, then the clock runs out.
      if (width === 375) {
        const partial = await browser.newPage({ viewport: { width, height } });
        await partial.clock.install();
        await open(partial, type, false);
        await partial.getByRole("button", { name: /ready/i }).first().click();
        await partial.locator(READY_SEL).first().waitFor({ timeout: 20_000 });
        await pause(partial, 600);
        for (const step of plan.slice(0, Math.max(1, Math.floor(plan.length / 2)))) await step(partial);
        await partial.clock.fastForward(200_000);
        await partial.locator("[data-reveal-score]").first().waitFor({ timeout: 30_000 });
        await partial.clock.fastForward(2_000);
        await pause(partial, 1200);
        entry["revealPartial"] = await measureReveal(partial);
        await partial.screenshot({ path: file("reveal-partial") });
        await partial.close();
      }
    } catch (error) {
      entry["error"] = String(error).slice(0, 300);
      console.log(`FAIL ${key}: ${entry["error"]}`);
    }
    report[key] = entry;
    const play = entry["play"] as { gapAbove: number; gapBelow: number } | undefined;
    console.log(`${key}: gaps ${play ? `${play.gapAbove}/${play.gapBelow}` : "-"}`);
  }
}
writeFileSync(`${OUT}/${TAG}-measure.json`, JSON.stringify(report, null, 2));
await browser.close();
