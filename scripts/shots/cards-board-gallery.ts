/**
 * The Cards & Board overhaul's gallery shots (15 Nov 2026; a tool, not a check): for Free Cell, Mahjong Solitaire,
 * Summit, Five Hands and Thirteen, a practice round at 390 × 844 (2×): the intro, the table after a few scripted taps,
 * a short clip of a move (frames every ~60 ms for 1.2 s, packed into an animated WebP by cards-board-gallery.py) and
 * the answer reveal once the clock runs out. Run it against main (`--tag=before`) and the branch (`--tag=after`).
 *
 *   bun scripts/shots/cards-board-gallery.ts --url=<origin> --tag=before|after --out=<dir> [games…] [--no-reveal] [--level=easy|hard|expert]
 *
 * `--level` (stage 3, the levels): the device's level choice set before the page loads (levelChoice.ts), so the round
 * is dealt at that level; on Easy a frame after 9 s untouched shows the hint's own glow (`-hint.png`).
 *
 * The origin needs practice deals (a dev server on the server-fn harness, as account-flow-check starts one).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const url = opt("url") ?? "http://127.0.0.1:5190";
const tag = opt("tag") ?? "after";
const out = opt("out") ?? ".shots/cards-board";
const reveal = !args.includes("--no-reveal");
const games = args.filter((a) => !a.startsWith("--"));
const level = opt("level");
mkdirSync(out, { recursive: true });

/** Taps as fractions of the game canvas: [x, y, wait ms]; the clip records after the tap marked `clip`. */
const TAPS: Record<string, { taps: [number, number, number][]; clip: number }> = {
  freecell: { taps: [[0.06, 0.42, 500], [0.19, 0.42, 500], [0.31, 0.42, 500], [0.44, 0.42, 500], [0.56, 0.42, 500], [0.69, 0.42, 500], [0.81, 0.42, 500], [0.94, 0.42, 500]], clip: 1 },
  tripeaks: { taps: [[0.06, 0.4, 400], [0.17, 0.4, 400], [0.28, 0.4, 400], [0.39, 0.6, 600], [0.5, 0.4, 400], [0.61, 0.4, 400], [0.72, 0.4, 400], [0.39, 0.6, 600]], clip: 3 },
  pyramid: { taps: [[0.3, 0.72, 600], [0.12, 0.5, 400], [0.27, 0.5, 400], [0.42, 0.5, 400], [0.3, 0.72, 600], [0.57, 0.5, 400]], clip: 0 },
  fivehands: { taps: [[0.3, 0.12, 500], [0.3, 0.23, 500], [0.3, 0.35, 500], [0.3, 0.46, 500], [0.3, 0.58, 500], [0.3, 0.12, 500]], clip: 2 },
  mahjong: { taps: [[0.1, 0.25, 300], [0.9, 0.25, 300], [0.1, 0.45, 300], [0.9, 0.45, 300], [0.1, 0.65, 300], [0.9, 0.65, 300], [0.1, 0.85, 300], [0.9, 0.85, 300]], clip: 1 },
};

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const game of games.length ? games : Object.keys(TAPS)) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  if (level) await page.addInitScript((lv) => localStorage.setItem("duelz-levels:v1", JSON.stringify({ catalogue: lv, games: {} })), level);
  const base = join(out, `${game}-${tag}`);
  try {
    await page.goto(`${url}/practice?game=${game}`, { waitUntil: "domcontentloaded" });
    const ready = page.getByRole("button", { name: /^Ready/ }).first();
    await ready.waitFor({ timeout: 180_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${base}-intro.png` });
    await ready.click();
    await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(4200);
    if (level === "easy") {
      await page.waitForTimeout(9000);
      await page.screenshot({ path: `${base}-hint.png` });
    }
    const box = (await page.locator("[data-game-stage] canvas").first().boundingBox())!;
    const plan = TAPS[game]!;
    for (let i = 0; i < plan.taps.length; i++) {
      const [fx, fy, wait] = plan.taps[i]!;
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      if (i === plan.clip) {
        const frames: Buffer[] = [];
        const t0 = Date.now();
        while (Date.now() - t0 < 1200) frames.push(await page.screenshot({ clip: { x: 0, y: 60, width: 390, height: 784 }, scale: "css", type: "png" }));
        mkdirSync(`${base}-clip`, { recursive: true });
        frames.forEach((f, k) => writeFileSync(join(`${base}-clip`, `${String(k).padStart(3, "0")}.png`), f));
      } else await page.waitForTimeout(wait);
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${base}-play.png` });
    if (reveal) {
      await page.locator("[data-reveal-score], [data-arcade-reveal]").first().waitFor({ timeout: 200_000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${base}-reveal.png` });
    }
    console.log(`${game} ${tag}: ok`);
  } catch (e) {
    console.log(`${game} ${tag}: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
  }
  await page.close();
}
await browser.close();
