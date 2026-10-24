/**
 * Game contact sheet (Prompt C, 24 Oct 2026): one mid-play frame of every active game at one
 * viewport (default 414×896, Joe's iPhone 11), then one sheet per category and an overview of
 * all of them. A design tool, not a check (CI never runs it).
 *
 *   bun scripts/shots/contact-sheet.ts [games…] [--url=<origin>]
 *       [--out=screenshots/contact-sheet-oct-2026] [--size=414x896] [--scale=0.25] [--sheets-only]
 *
 * Each game opens from /practice the way scripts/shots/capture.ts does (the fixed intro example,
 * `Math.random` seeded). After Ready it plays a few seconds: the game's capture driver (seedMid,
 * partial) where it has one; otherwise seeded taps and swipes on the arena (arcade and engine
 * games, as arcade-play-check plays them) or taps on the stage's buttons and board cells
 * (the remaining puzzles). The frame is taken while the round is still live. The dev server it
 * starts points Supabase at a closed port, so server calls fail fast instead of hanging
 * (pass --url to a server started the same way).
 *
 * Frames: <out>/<category>/<game>.png. Sheets: <out>/sheet-<category>.png and <out>/overview.png
 * (each frame at --scale with the game's display name under it).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { createCanvas, loadImage } from "@napi-rs/canvas";
import type { Browser, Page } from "playwright";

import { gameDisplayName } from "../../src/lib/duel/gameNames";
import { ACTIVE_PUZZLE_TYPES, puzzleDef } from "../../src/lib/duel/registry";
import type { PuzzleType } from "../../src/lib/duel/types";
import { DRIVERS } from "./drivers";
import { exampleFor } from "./examples";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 5191;
const OUT = opt("out") ?? "screenshots/contact-sheet-oct-2026";
const [W, H] = (opt("size") ?? "414x896").split("x").map(Number) as [number, number];
const SCALE = Number(opt("scale") ?? 0.25);
const CATEGORIES = ["word", "number", "speed", "attention", "pattern", "logic", "arcade"] as const;
const CATEGORY_NAMES: Record<string, string> = {
  word: "Word",
  number: "Number",
  speed: "Speed",
  attention: "Attention",
  pattern: "Pattern",
  logic: "Logic",
  arcade: "Arcade",
};

const SEED_RANDOM = `(() => {
  let s = 20261013 >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { localStorage.setItem("duelz-arrow-control", "arrows"); } catch { /* ignore */ }
})();`;

/** A small seeded PRNG for the tool's own taps (the page's Math.random is seeded separately). */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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

/** Engine games outside the Arcade category (arcade-play-check's ENGINE_PLAY_GAMES). */
const ENGINE_GAMES = new Set<string>(["tendrop", "stroop", "whack", "clayshoot"]);

const REVEAL = "[data-reveal-score], [data-arcade-reveal]";

async function openGame(browser: Browser, origin: string, game: PuzzleType) {
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(SEED_RANDOM);
  const page = await context.newPage();
  await page.route("**/_serverFn/**", async (route) => {
    const name = serverFnName(route.request().url());
    const body = route.request().postData() ?? "";
    if (/practiceGenerate/.test(name))
      return route.continue({
        postData: body.replace(
          /("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/,
          '$1{"t":2,"s":2}',
        ),
      });
    // Hold any grade request so a finished board stays on screen for the frame.
    if (/practiceGrade/.test(name)) await new Promise((done) => setTimeout(done, 15_000));
    return route.continue();
  });
  await page.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
  await button.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500); // hydration
  const seed = DRIVERS[game]?.seedMid?.(exampleFor(game));
  if (seed) {
    await page.evaluate(async (values) => {
      const mod = (await import(/* @vite-ignore */ "/scripts/shots/seed.tsx")) as {
        seedStageState: (k: string[], v: Record<string, unknown>) => void;
      };
      mod.seedStageState(["practice-1", "practice-2", "practice-3"], values);
    }, seed);
  }
  await button.click();
  const ready = page.getByRole("button", { name: /^Ready/ }).first();
  await ready.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(800);
  await ready.click();
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  return { page, close: () => context.close() };
}

/** Seeded taps and swipes on the arena, as arcade-play-check plays, for about `ms`. */
async function pokeArena(page: Page, game: string, ms: number) {
  const rand = seeded(game.length * 7919 + 17);
  const arena = await page.locator("[data-game-arena]").first().boundingBox();
  if (!arena) return;
  const start = Date.now();
  while (Date.now() - start < ms && !(await page.locator(REVEAL).count())) {
    const x = arena.x + arena.width * (0.15 + rand() * 0.7);
    const y = arena.y + arena.height * (0.2 + rand() * 0.65);
    if (rand() < 0.5) await page.mouse.click(x, y);
    else {
      const angle = Math.floor(rand() * 4) * (Math.PI / 2) + (rand() - 0.5) * 0.6;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let k = 1; k <= 5; k++)
        await page.mouse.move(x + Math.cos(angle) * 16 * k, y + Math.sin(angle) * 16 * k);
      await page.mouse.up();
    }
    await page.waitForTimeout(150 + Math.floor(rand() * 200));
  }
}

/** Driverless puzzles: a few taps on the stage's own buttons and board cells (never Done / Give up). */
async function pokeStage(page: Page, game: string, taps: number) {
  const rand = seeded(game.length * 104729 + 3);
  for (let i = 0; i < taps && !(await page.locator(REVEAL).count()); i++) {
    const targets = await page.evaluate(() => {
      const stage = document.querySelector("[data-game-stage]");
      if (!stage) return [];
      const skip = /done|give up|submit|skip|quit|help|sound|\?|clear|undo|reset/i;
      return Array.from(
        stage.querySelectorAll("button, [role=button], rect[aria-label], [data-cell], [data-card]"),
      )
        .filter((el) => !skip.test(el.getAttribute("aria-label") ?? el.textContent ?? ""))
        .map((el) => el.getBoundingClientRect())
        .filter((b) => b.width >= 8 && b.height >= 8 && b.top >= 0 && b.bottom <= innerHeight)
        .map((b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 }));
    });
    if (targets.length) {
      const t = targets[Math.floor(rand() * targets.length)]!;
      await page.mouse.click(t.x, t.y);
    } else {
      const box = await page.locator("[data-game-stage]").first().boundingBox();
      if (box)
        await page.mouse.click(
          box.x + box.width * (0.3 + rand() * 0.4),
          box.y + box.height * (0.3 + rand() * 0.4),
        );
    }
    await page.waitForTimeout(250 + Math.floor(rand() * 250));
  }
}

/** Flash: random taps are all false starts, so wait for the gold cue and tap it twice (the readout shows). */
async function pokeFlash(page: Page) {
  const area = page.locator("[data-flash-cue]").first();
  let hits = 0;
  for (let i = 0; hits < 2 && i < 400; i++) {
    if ((await area.getAttribute("data-flash-cue")) === "gold") {
      await page.waitForTimeout(220);
      const box = await area.boundingBox();
      if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      hits++;
      await page.waitForTimeout(hits < 2 ? 600 : 0);
    } else await page.waitForTimeout(60);
  }
  return hits;
}

async function shoot(browser: Browser, origin: string, game: PuzzleType, file: string) {
  const run = await openGame(browser, origin, game);
  const { page } = run;
  try {
    await page.waitForTimeout(1200);
    const driver = DRIVERS[game];
    // Arcade worlds and the engine games that draw their own board take taps and swipes on the arena.
    const arena =
      (puzzleDef(game).category === "arcade" || ENGINE_GAMES.has(game)) &&
      (await page.locator("[data-game-arena]").count()) > 0;
    let how: string;
    if (driver?.partial) {
      await driver.partial({
        page,
        puzzle: exampleFor(game),
        wait: (ms) => page.waitForTimeout(ms),
      });
      how = "driver";
    } else if (driver?.seedMid) how = "seeded";
    else if (game === "reaction") {
      how = `${await pokeFlash(page)} gold taps`;
    } else if (arena) {
      await pokeArena(page, game, 3500);
      how = "arena taps";
    } else {
      await pokeStage(page, game, 6);
      how = "stage taps";
    }
    // Flash's readout shows for under a second after the tap.
    await page.waitForTimeout(game === "reaction" ? 150 : 400);
    const over = (await page.locator(REVEAL).count()) > 0;
    await page.screenshot({ path: file });
    return `${how}${over ? " (round already over)" : ""}`;
  } finally {
    await run.close();
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
      // Supabase is unreachable from a cloud container: point the server's admin client at a closed
      // port so its calls fail at once (Gridlock's example then comes from the built-in bank).
      env: {
        ...process.env,
        SUPABASE_URL: "http://127.0.0.1:9",
        SUPABASE_SERVICE_ROLE_KEY: "offline",
      },
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

/* ---------------------------------------------------------------- sheets */

const BG = "#070709";
const TEXT = "#F5F5F7";
const MUTED = "#BDBDCC";

async function sheet(title: string, games: PuzzleType[], file: string, cols: number) {
  const tw = Math.round(W * SCALE),
    th = Math.round(H * SCALE);
  const pad = 10,
    label = 30,
    head = 44;
  const rows = Math.ceil(games.length / cols);
  const cw = tw + pad,
    ch = th + label + pad;
  const canvas = createCanvas(pad + cols * cw, head + rows * ch + pad);
  const g = canvas.getContext("2d");
  g.fillStyle = BG;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = TEXT;
  g.font = "bold 20px sans-serif";
  g.textBaseline = "middle";
  g.fillText(title, pad, head / 2);
  for (const [i, game] of games.entries()) {
    const x = pad + (i % cols) * cw;
    const y = head + Math.floor(i / cols) * ch;
    const src = join(OUT, puzzleDef(game).category, `${game}.png`);
    g.strokeStyle = "#2a2a33";
    g.lineWidth = 1;
    g.strokeRect(x - 0.5, y - 0.5, tw + 1, th + 1);
    if (existsSync(src)) g.drawImage(await loadImage(src), x, y, tw, th);
    g.textAlign = "center";
    g.fillStyle = TEXT;
    g.font = "bold 11px sans-serif";
    const name = gameDisplayName(game);
    g.fillText(name.length > 18 ? `${name.slice(0, 17)}…` : name, x + tw / 2, y + th + 10);
    g.fillStyle = MUTED;
    g.font = "9px sans-serif";
    g.fillText(game, x + tw / 2, y + th + 22);
    g.textAlign = "left";
  }
  writeFileSync(file, canvas.toBuffer("image/png"));
}

async function main() {
  const named = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
  const games = named.length ? named : [...ACTIVE_PUZZLE_TYPES];
  for (const c of CATEGORIES) mkdirSync(join(OUT, c), { recursive: true });
  if (!args.includes("--sheets-only")) {
    if (!existsSync(CHROMIUM)) throw new Error(`no Chromium at ${CHROMIUM}`);
    const { origin, proc } = await startServer();
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ executablePath: CHROMIUM });
    try {
      // Warm the cold dev server once, unmeasured.
      const warm = await browser.newPage();
      await warm.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" }).catch(() => {});
      await warm.waitForTimeout(5000);
      await warm.close();
      for (const game of games) {
        const file = join(OUT, puzzleDef(game).category, `${game}.png`);
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(`${game}: ${await shoot(browser, origin, game, file)}`);
            break;
          } catch (error) {
            console.log(
              `${game}: attempt ${attempt} failed: ${String((error as Error).message ?? error).split("\n")[0]}`,
            );
          }
        }
      }
    } finally {
      await browser.close();
      if (proc?.pid) process.kill(-proc.pid);
    }
  }
  const all: PuzzleType[] = [];
  for (const c of CATEGORIES) {
    const list = ACTIVE_PUZZLE_TYPES.filter((t) => puzzleDef(t).category === c);
    all.push(...list);
    await sheet(
      `${CATEGORY_NAMES[c]} · ${list.length} games`,
      list,
      join(OUT, `sheet-${c}.png`),
      Math.min(list.length, 6),
    );
  }
  await sheet(
    `All ${all.length} active games · ${W}×${H} mid-play, practice`,
    all,
    join(OUT, "overview.png"),
    12,
  );
  console.log(`frames and sheets in ${OUT} (${readdirSync(OUT).length} entries)`);
}

await main();
