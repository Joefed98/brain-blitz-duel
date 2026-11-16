/**
 * Crazy Golf's gallery (the Crazy Golf overhaul, 15 Nov 2026; a design tool, not a check): the real app on a dev server,
 * practice on the fixed intro example at 390 × 844, captured on main (`--tag=before`, run against a worktree's server)
 * and on the branch (`--tag=after`):
 *
 *   intro          the round intro
 *   aim            pulling back on the first tee (the aim line / rubber band, the Captain beside the ball)
 *   chip-aim       (after) the Chip switch on and its arc to the landing
 *   play           a played run in progress (the near-perfect bot's log through the dev-only audit hook)
 *   uneven         (after) a later hole's uneven ground
 *   reveal         the answer reveal after the bot's run, and (after) with hole 3 chosen on the scorecard
 *   clip-*.webp    short animated clips: a putt, a chip (after) and a holed ball
 *
 *   bun scripts/shots/crazy-golf-gallery.ts --tag=after [--url=<origin>]
 *
 * Writes docs/design/pages-review/crazy-golf/<name>-<tag>.webp (stills ~585 px wide, clips 360 px), compressed WebP.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Browser, type Page } from "playwright";

import { startServer } from "../arcade-perf";
import { practiceGameUrl } from "../practice-side-lib";
import { exampleFor } from "./examples";
import { Human } from "../arcade-skill-bands/human";
import type { MinigolfPuzzleData } from "../../src/lib/duel/types";

const ROOT = join(import.meta.dir, "../..");
const OUT = join(ROOT, "docs/design/pages-review/crazy-golf");
mkdirSync(OUT, { recursive: true });
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const TAG = arg("tag") ?? "after";
const AFTER = TAG === "after";
const W = 390;
const H = 844;

const SEED_RANDOM = `(() => {
  let s = 20261013 >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { localStorage.setItem("duelz-terms:v1", JSON.stringify({ at: "2026-11-01T00:00:00Z" })); } catch { /* ignore */ }
})();`;

/** The example puzzle (the page deals the same) and the near-perfect bot's log on it. */
async function botLog(): Promise<{ puzzle: MinigolfPuzzleData; events: unknown[] }> {
  const { setDealPin } = await import("../../src/lib/duel/dealEra");
  if (!AFTER) setDealPin("minigolfPreCourse", true);
  const puzzle = exampleFor("minigolf") as MinigolfPuzzleData;
  const { minigolfGameForPuzzle } = await import("../../src/lib/duel/minigolf");
  const game = minigolfGameForPuzzle(puzzle);
  const human = new Human("minigolf", puzzle.seed, "near");
  const mod = AFTER ? await import("../arcade-skill-bands/bots/minigolfV3") : await import("../arcade-skill-bands/bots/minigolf");
  const bot = (AFTER ? (mod as { botV3: never }).botV3 : (mod as { bot: never }).bot) as (c: unknown) => { events: unknown[] };
  const { events } = bot({ game, seed: puzzle.seed, rev: puzzle.golfRev ?? null, human, fixes: true });
  return { puzzle, events };
}

async function open(browser: Browser, origin: string, audit: unknown[] | null): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(SEED_RANDOM);
  if (audit) await ctx.addInitScript(`window.__DUELZ_AUDIT_INPUT__ = { events: ${JSON.stringify(audit)} };`);
  const page = await ctx.newPage();
  await page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData() ?? "";
    // The deal request (its name is base64 in the URL): its data carries "type" and "example".
    if (body.includes(`"k":["type","example"]`))
      return route.continue({ postData: body.replace(/("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/, '$1{"t":2,"s":2}') });
    return route.continue();
  });
  await page.goto(practiceGameUrl(origin, "minigolf"), { waitUntil: "domcontentloaded", timeout: 240_000 });
  await page.getByRole("button", { name: /ready/i }).first().waitFor({ timeout: 240_000 });
  await page.waitForTimeout(1500);
  return page;
}

function webp(png: Buffer, name: string, width: number, quality = 72): number {
  const out = join(OUT, `${name}-${TAG}.webp`);
  const py = `import sys,io\nfrom PIL import Image\nim=Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGB")\nim=im.resize((${width}, round(im.height*${width}/im.width)), Image.LANCZOS)\nim.save("${out}","WEBP",quality=${quality},method=6)\n`;
  const r = Bun.spawnSync(["python3", "-c", py], { stdin: png });
  if (r.exitCode !== 0) throw new Error(String(r.stderr));
  return readFileSync(out).length;
}

function clip(frames: Buffer[], name: string, fps = 10, width = 360): number {
  const dir = join("/tmp", `cg-gallery-${process.pid}-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  frames.forEach((f, i) => writeFileSync(join(dir, `${String(i).padStart(3, "0")}.png`), f));
  const out = join(OUT, `clip-${name}-${TAG}.webp`);
  const r = Bun.spawnSync(["python3", join(ROOT, "scripts/cosmetic-redraws/clip.py"), dir, out, String(fps), String(width)]);
  if (r.exitCode !== 0) throw new Error(String(r.stderr));
  rmSync(dir, { recursive: true, force: true });
  return readFileSync(out).length;
}

async function pull(page: Page, dy: number, hold = false): Promise<void> {
  const canvas = page.locator("[data-game-stage] canvas").first();
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + i * 2.5, y + (i * dy) / 8);
  if (!hold) await page.mouse.up();
}

const sizes: string[] = [];
const note = (name: string, bytes: number) => sizes.push(`${name}-${TAG}: ${(bytes / 1024).toFixed(0)} KB`);

const { origin, proc } = await startServer(arg("url"), 5240);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
try {
  const { events } = await botLog();
  // Stills on our own input: the intro, the aim, the chip's aim.
  {
    const page = await open(browser, origin, null);
    note("intro", webp(await page.screenshot(), "intro", 585));
    await page.getByRole("button", { name: /ready/i }).first().click();
    await page.locator("[data-game-stage] canvas").first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(4500);
    note("start", webp(await page.screenshot(), "start", 585));
    if (AFTER) {
      // The Captain's stroke (round 2): addressing the ball, the backswing growing with the pull, then the strike.
      const canvas = page.locator("[data-game-stage] canvas").first();
      const box = (await canvas.boundingBox())!;
      const x = box.x + box.width * 0.5;
      const y = box.y + box.height * 0.5;
      const sf: Buffer[] = [];
      await page.mouse.move(x, y);
      sf.push(await page.screenshot({ scale: "css" }));
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) {
        await page.mouse.move(x + i * 1.6, y + i * 7.5);
        await page.waitForTimeout(60);
        sf.push(await page.screenshot({ scale: "css" }));
      }
      note("aim", webp(await page.screenshot(), "aim", 585));
      await page.mouse.up();
      for (let i = 0; i < 18; i++) {
        sf.push(await page.screenshot({ scale: "css" }));
        await page.waitForTimeout(60);
      }
      note("clip-stroke", clip(sf, "stroke"));
      await page.waitForTimeout(6000);
    }
    await pull(page, 90, true);
    await page.waitForTimeout(200);
    if (!AFTER) note("aim", webp(await page.screenshot(), "aim", 585));
    // A putt clip: the release and the roll.
    const frames: Buffer[] = [];
    await page.mouse.up();
    for (let i = 0; i < 28; i++) {
      frames.push(await page.screenshot({ scale: "css" }));
      await page.waitForTimeout(70);
    }
    note("clip-putt", clip(frames, "putt"));
    if (AFTER) {
      await page.waitForTimeout(2500);
      await page.locator("[data-shot='chip']").click();
      await pull(page, 110, true);
      await page.waitForTimeout(200);
      note("chip-aim", webp(await page.screenshot(), "chip-aim", 585));
      const cf: Buffer[] = [];
      await page.mouse.up();
      for (let i = 0; i < 26; i++) {
        cf.push(await page.screenshot({ scale: "css" }));
        await page.waitForTimeout(60);
      }
      note("clip-chip", clip(cf, "chip"));
    }
    await page.context().close();
  }
  // A played run (the near-perfect bot): mid-play, a later hole, the reveal.
  {
    const page = await open(browser, origin, events);
    await page.getByRole("button", { name: /ready/i }).first().click();
    await page.locator("[data-game-stage] canvas").first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(3500);
    const hole: Buffer[] = [];
    const t0 = Date.now();
    let mid = false;
    let late = false;
    while (Date.now() - t0 < 140_000) {
      const reveal = await page.locator("[data-answer-reveal]").count();
      if (reveal) break;
      const shot = await page.screenshot({ scale: "css" });
      const el = Date.now() - t0;
      if (!mid && el > 9000) {
        mid = true;
        note("play", webp(await page.screenshot(), "play", 585));
      }
      if (!late && el > 26_000) {
        late = true;
        note("later-hole", webp(await page.screenshot(), "later-hole", 585));
      }
      if (el > 3000 && el < 9000) hole.push(shot);
      await page.waitForTimeout(250);
    }
    note("clip-play", clip(hole.filter((_, i) => i % 1 === 0), "play", 6));
    await page.locator("[data-answer-reveal]").first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2500);
    note("reveal", webp(await page.screenshot({ fullPage: true }), "reveal", 585));
    if (AFTER) {
      const cell = page.locator("[data-minigolf-reveal] [data-scorecard] button").nth(2);
      await cell.scrollIntoViewIfNeeded();
      await cell.click();
      await page.waitForTimeout(500);
      note("reveal-hole3", webp(await page.screenshot({ fullPage: true }), "reveal-hole3", 585));
    }
    await page.context().close();
  }
} finally {
  await browser.close();
  if (proc?.pid) process.kill(-proc.pid);
}
console.log(sizes.join("\n"));
