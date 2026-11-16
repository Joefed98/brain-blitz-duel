/**
 * The levels' gallery frames (the Attention overhaul's stage 3): each Attention game's live stage at Easy, Hard and
 * Expert at 390×844, on a running dev server, as WebP in docs/design/pages-review/attention/img/levels/.
 *
 *   bun scripts/attention-art/level-shots.ts --url=http://127.0.0.1:5317 [games…]
 */
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const url = (process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://127.0.0.1:5317").replace(/\/$/, "");
const named = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const games = named.length ? named : ["symscan", "spotdiff", "countup", "maze", "bomb", "pairmatch"];
const OUT = "docs/design/pages-review/attention/img/levels";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const game of games) {
  for (const level of ["easy", "hard", "expert"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${url}/practice`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.evaluate(([g, l]) => localStorage.setItem("duelz-levels:v1", JSON.stringify({ catalogue: "normal", games: { [g!]: l } })), [game, level]);
    await page.evaluate((g) => {
      history.pushState({}, "", `/practice?game=${g}`);
      dispatchEvent(new PopStateEvent("popstate"));
    }, game);
    try {
      const stage = page.locator("[data-game-stage]");
      const play = page.locator("[data-game-page] button:has-text('Play')");
      for (let i = 0; i < 360 && !(await stage.count()); i++) {
        if (await play.count()) await play.first().click().catch(() => undefined);
        await page.waitForTimeout(500);
      }
      await stage.waitFor({ timeout: 10_000 });
      await page.waitForTimeout(2200);
      const png = `/tmp/attn-level-${game}-${level}.png`;
      await page.screenshot({ path: png });
      // WebP through Pillow (no cwebp here).
      execFileSync("python3", ["-c", "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2], 'WEBP', quality=72, method=6)", png, `${OUT}/${game}-${level}.webp`]);
      console.log(`OK ${game} ${level}`);
    } catch (e) {
      console.log(`FAIL ${game} ${level}: ${(e as Error).message.split("\n")[0]}`);
    }
    await page.close();
  }
}
await browser.close();
