/**
 * The Word levels' review shots (the Word overhaul, stage 3; docs/design/pages-review/word/GALLERY.md): every Word game
 * at Easy, Normal, Hard and Expert, its round intro (with the level's line) and its live board a moment in, at
 * 390×844 and 375×667, then one sheet a game (the four levels side by side). The level is the player's choice on the
 * device (levelChoice.ts), so practice deals it as rooms would. A design tool, not a check.
 *
 *   bun scripts/shots/word-levels-shots.ts --url=<origin> [games…] [--out=<dir>]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const url = (args.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/word-levels";
const GAMES = ["wordsmith", "tilegrid", "wordslide", "wordhunt", "wordsearch", "letterwheel", "strikeout", "codeword", "swapword"];
const games = args.filter((a) => !a.startsWith("--")).length ? args.filter((a) => !a.startsWith("--")) : GAMES;
const LEVELS = ["easy", "normal", "hard", "expert"] as const;
const SIZES: [number, number][] = [[390, 844], [375, 667]];
const CHROMIUM = process.env["PLAYWRIGHT_CHROMIUM"] ?? "/opt/pw-browsers/chromium";

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROMIUM });
for (const game of games) {
  for (const [w, h] of SIZES) {
    for (const level of LEVELS) {
      const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      await context.addInitScript(
        ([game, level]) => {
          try {
            localStorage.setItem("duelz-levels:v1", JSON.stringify({ catalogue: "normal", games: { [game!]: level } }));
            localStorage.setItem("duelz-level-intro:v1", "seen");
          } catch {
            /* none */
          }
        },
        [game, level],
      );
      const page = await context.newPage();
      try {
        await page.goto(`${url}/practice?game=${game}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
        const ready = page.getByRole("button", { name: /^Ready/ }).first();
        await ready.waitFor({ timeout: 90_000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${out}/${game}-${w}x${h}-${level}-intro.png` });
        await ready.click();
        await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
        await page.waitForTimeout(1800);
        await page.screenshot({ path: `${out}/${game}-${w}x${h}-${level}-play.png` });
        console.log(`shot ${game} ${w}x${h} ${level}`);
      } catch (error) {
        console.log(`MISS ${game} ${w}x${h} ${level}: ${String((error as Error).message).split("\n")[0]}`);
      } finally {
        await context.close();
      }
    }
    // One sheet a game and size: the four levels' boards side by side, labelled.
    for (const phase of ["intro", "play"]) {
      const scale = 0.5;
      const sheet = createCanvas(Math.round(w * scale * 4 + 50), Math.round(h * scale + 34));
      const ctx = sheet.getContext("2d");
      ctx.fillStyle = "#07070a";
      ctx.fillRect(0, 0, sheet.width, sheet.height);
      ctx.fillStyle = "#f5f5f7";
      ctx.font = "600 16px sans-serif";
      for (let i = 0; i < LEVELS.length; i++) {
        const x = 10 + i * (w * scale + 10);
        ctx.fillText(LEVELS[i]![0]!.toUpperCase() + LEVELS[i]!.slice(1), x, 22);
        try {
          const img = await loadImage(`${out}/${game}-${w}x${h}-${LEVELS[i]}-${phase}.png`);
          ctx.drawImage(img, x, 30, w * scale, h * scale);
        } catch {
          /* missing frame */
        }
      }
      writeFileSync(`${out}/${game}-${w}x${h}-${phase}-sheet.webp`, sheet.toBuffer("image/webp", 82));
    }
  }
}
await browser.close();
