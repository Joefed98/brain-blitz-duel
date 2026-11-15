/**
 * Review frames for the Strategy overhaul (phase 2, step 4): each Strategy game's intro, a mid-play frame after some
 * scripted input, and (with --reveal) its answer reveal once the clock runs out, at one phone size. Practice rounds are
 * opened by `/practice?game=<id>` (the full intro with Ready). Frames are 2× WebP-ready PNGs
 * `<game>-<phase>-<tag>.png` in --out (default .shots/strategy/).
 *
 *   bun scripts/shots/strategy-shots.ts --url=<origin> [games…] [--tag=after] [--out=<dir>] [--reveal] [--size=390x844]
 *
 * Needs a running dev server (`npx vite dev --port 5192`); warm it with one page load first.
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const origin = opt("url") ?? "http://127.0.0.1:5192";
const tag = opt("tag") ?? "after";
const out = opt("out") ?? ".shots/strategy";
const [w, h] = (opt("size") ?? "390x844").split("x").map(Number) as [number, number];
const reveal = args.includes("--reveal");
const GAMES = args.filter((a) => !a.startsWith("--"));
const games = GAMES.length ? GAMES : ["tilt", "matchup", "bubble", "inkbridge", "balltrack"];

mkdirSync(out, { recursive: true });

/** A few plausible gestures on the arena for each game (enough to move something; not a solve). */
async function play(page: Page, game: string): Promise<void> {
  const box = await page.locator("[data-game-arena]").first().boundingBox();
  if (!box) return;
  const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
  const drag = async (a: { x: number; y: number }, b: { x: number; y: number }, steps = 12) => {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps });
    await page.mouse.up();
  };
  for (let i = 0; i < 6; i++) {
    if (game === "tilt") await drag(at(0.3, 0.5), at(0.7, 0.5), 20);
    else if (game === "matchup") await drag(at(0.3 + (i % 4) * 0.1, 0.4), at(0.4 + (i % 4) * 0.1, 0.4));
    else if (game === "bubble") await drag(at(0.5, 0.8), at(0.5 + (i % 2 ? 0.15 : -0.15), 0.95), 10);
    else if (game === "inkbridge") await drag(at(0.2, 0.3 + i * 0.05), at(0.7, 0.35 + i * 0.05));
    else await page.mouse.click(at(0.2 + (i % 5) * 0.15, 0.3 + (i % 3) * 0.2).x, at(0.2 + (i % 5) * 0.15, 0.3 + (i % 3) * 0.2).y);
    await page.waitForTimeout(700);
  }
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
try {
  for (const game of games) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: false });
    try {
      await page.goto(`${origin}/practice?game=${game}`, { waitUntil: "domcontentloaded" });
      const ready = page.getByRole("button", { name: /^Ready/ }).first();
      await ready.waitFor({ timeout: 180_000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${out}/${game}-intro-${tag}.png` });
      await ready.click();
      await page.locator("[data-game-stage]").first().waitFor({ timeout: 60_000 });
      await page.waitForTimeout(4500);
      await play(page, game);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${out}/${game}-play-${tag}.png` });
      if (reveal) {
        await page.locator("[data-reveal-screen], [data-practice-reveal-actions]").first().waitFor({ timeout: 200_000 });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${out}/${game}-reveal-${tag}.png` });
      }
      console.log(`${game}: ok`);
    } catch (error) {
      console.log(`${game}: ${(error as Error).message.split("\n")[0]}`);
      await page.screenshot({ path: `${out}/${game}-error-${tag}.png` }).catch(() => {});
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
