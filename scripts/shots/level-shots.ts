/**
 * Review pictures of the Logic overhaul's levels (session 1, stage 3): each of the seven games at Easy, Normal, Hard and
 * Expert, a real deal at each level (generatePuzzle with the level), its public half drawn by the game's real Stage
 * (scripts/shots/stage-mount.tsx) at 390 × 844, then a contact sheet. Not a check.
 *
 *   bun scripts/shots/level-shots.ts [--out=docs/design/pages-review/logic-1/img] [--url=http://127.0.0.1:5191]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { generatePuzzle } from "../../src/lib/duel/generate.server";
import { withSeededRandom } from "../../src/lib/duel/random";
import { splitPuzzle } from "../../src/lib/duel/secrets";

const args = process.argv.slice(2);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OUT = opt("out") ?? "/tmp/claude-0/level-shots";
const URL_ = opt("url") ?? "http://127.0.0.1:5191";
const ALL_GAMES = ["sudoku", "tubes", "tower", "safe", "nonogram", "flood", "minesweeper"] as const;
const named = args.filter((a) => !a.startsWith("--")) as (typeof ALL_GAMES)[number][];
const GAMES = named.length ? named : ALL_GAMES;
const LEVELS = ["easy", "normal", "hard", "expert"] as const;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.goto(`${URL_}/practice`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
for (const game of GAMES) {
  for (const level of LEVELS) {
    const seed = 4242;
    const full = withSeededRandom(seed, () => generatePuzzle(game, { bankSeed: seed, ...(level !== "normal" ? { level } : {}) }));
    const pub = splitPuzzle(full).pub;
    // A fresh page each shot (a stage keeps its state in the session).
    await page.evaluate(() => sessionStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.evaluate(
      async ({ game, pub }) => {
        const m = (await import(/* @vite-ignore */ "/scripts/shots/stage-mount.tsx")) as { mountStage: (t: string, p: unknown, w: number, h: number) => void };
        m.mountStage(game, pub, 390, 844);
      },
      { game, pub },
    );
    await page.waitForTimeout(game === "minesweeper" ? 1800 : 1200);
    await page.screenshot({ path: `${OUT}/${game}-${level}.png` });
    console.log(`${game} ${level}`);
  }
}
await browser.close();
