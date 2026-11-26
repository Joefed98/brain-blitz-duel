/**
 * The Number games' bigger level boards, measured (D2, 22 Nov 2026; Joe: every cell at 36 px or more, at 375 × 667 and
 * 390 × 844). For each game and level it stores the level choice on the device (levelChoice.ts), opens the real practice
 * round (/practice?game=<id>), presses Ready, waits out the countdown and, on the live board, measures every tap target
 * the board is made of (its "cells"), then takes the screenshot. A tool, not a check.
 *
 *   bun scripts/shots/number-level-cells.ts [games…] [--url=http://127.0.0.1:5190] [--out=<dir>] [--webp=<dir>]
 *
 * Cells per game: Kakuro the white squares ([data-kakuro-cell]); Integer Pyramid the empty stones ([data-np-cell]) and
 * the tray's tiles; Counterweight the beam's notches (.balance-notch) and the tray's weights ([data-tray-cup]);
 * Operator the gaps (.opg-gap), the sign keys and the number chips, on each of its four lines in turn (Next moves on an
 * unsolved line; the other games keep one board size through a round). The report gives each kind's smallest width
 * and height and how many fall under 36 px; --webp writes each screenshot as a WebP for screenshots/ too.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const args = process.argv.slice(2);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ORIGIN = (opt("url") ?? process.env["DEMOS_URL"] ?? "http://127.0.0.1:5190").replace(/\/$/, "");
const OUT = opt("out") ?? "/tmp/claude-0/number-level-cells";
const WEBP = opt("webp");
const MIN = 36;

const CELLS = {
  kakuro: { "white squares": "[data-kakuro-cell]" },
  numpyramid: { stones: "[data-np-cell]", "tray tiles": "[data-np-tray-row] > div" },
  balance: { notches: ".balance-notch", weights: "[data-tray-cup]" },
  equation: { gaps: ".opg-gap", "sign keys": ".opg-key", "number chips": "[data-row='tray'] button" },
} as const;
type Game = keyof typeof CELLS;
/** Games whose lines differ in size: the Next button and how many lines a round has. */
const STEPS: Partial<Record<Game, { next: string; lines: number }>> = { equation: { next: ".opg-next", lines: 4 } };
const named = args.filter((a) => !a.startsWith("--")) as Game[];
const GAMES: Game[] = named.length ? named : (Object.keys(CELLS) as Game[]);
const LEVELS = ["easy", "normal", "hard", "expert"] as const;
const SIZES = [
  { w: 375, h: 667 },
  { w: 390, h: 844 },
] as const;

export interface CellRow {
  game: Game;
  level: (typeof LEVELS)[number];
  size: string;
  kind: string;
  /** The line measured (1-based; 1 for a game with one board size). */
  line: number;
  count: number;
  minW: number;
  minH: number;
  under: number;
}

async function measure(page: Page, game: Game, line: number): Promise<Omit<CellRow, "game" | "level" | "size">[]> {
  const out: Omit<CellRow, "game" | "level" | "size">[] = [];
  for (const [kind, selector] of Object.entries(CELLS[game])) {
    const boxes = await page.$$eval(selector, (els) =>
      els
        .filter((el) => !el.closest("[data-reveal-screen]") && (el as HTMLElement).offsetParent !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
        }),
    );
    out.push({
      kind,
      line,
      count: boxes.length,
      minW: boxes.length ? Math.min(...boxes.map((b) => b.w)) : 0,
      minH: boxes.length ? Math.min(...boxes.map((b) => b.h)) : 0,
      under: boxes.filter((b) => b.w < MIN || b.h < MIN).length,
    });
  }
  return out;
}

async function toWebp(png: string, webp: string) {
  const img = await loadImage(readFileSync(png));
  const canvas = createCanvas(img.width, img.height);
  canvas.getContext("2d").drawImage(img, 0, 0);
  writeFileSync(webp, await canvas.encode("webp", 82));
}

if (import.meta.main) {
  mkdirSync(OUT, { recursive: true });
  if (WEBP) mkdirSync(WEBP, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const rows: CellRow[] = [];
  let failed = 0;
  try {
    for (const game of GAMES)
      for (const level of LEVELS)
        for (const size of SIZES) {
          const tag = `${game}-${level}-${size.w}x${size.h}`;
          const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2 });
          await context.addInitScript(([t, l]) => localStorage.setItem("duelz-levels:v1", JSON.stringify({ catalogue: "normal", games: { [t!]: l } })), [game, level]);
          const page = await context.newPage();
          try {
            await page.goto(`${ORIGIN}/practice?game=${game}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
            await page.getByRole("button", { name: /^(Ready|Play)$/ }).first().click({ timeout: 120_000 });
            const first = Object.values(CELLS[game])[0]!;
            await page.locator(first).first().waitFor({ state: "visible", timeout: 30_000 });
            await page.waitForTimeout(1800);
            const steps = STEPS[game];
            for (let line = 1; line <= (steps?.lines ?? 1); line++) {
              if (line > 1) {
                await page.locator(steps!.next).click();
                await page.waitForTimeout(1800);
              }
              const shot = steps ? `${tag}-line${line}` : tag;
              const png = `${OUT}/${shot}.png`;
              await page.screenshot({ path: png });
              if (WEBP) await toWebp(png, `${WEBP}/${shot}.webp`);
              for (const m of await measure(page, game, line)) {
                rows.push({ game, level, size: `${size.w}x${size.h}`, ...m });
                console.log(`${shot} ${m.kind}: ${m.count}, smallest ${m.minW} × ${m.minH} px${m.under ? `, ${m.under} under ${MIN} px` : ""}`);
              }
            }
          } catch (error) {
            failed++;
            console.log(`FAIL ${tag}: ${(error as Error).message.split("\n")[0]}`);
            await page.screenshot({ path: `${OUT}/${tag}-fail.png` }).catch(() => undefined);
          } finally {
            await context.close();
          }
        }
  } finally {
    await browser.close();
  }
  writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1) + "\n");
  const under = rows.filter((r) => r.under > 0);
  console.log(under.length ? `${under.length} row(s) with cells under ${MIN} px` : `every cell ${MIN} px or more`);
  process.exit(failed ? 1 : 0);
}
