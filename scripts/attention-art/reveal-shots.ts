/**
 * The Attention overhaul's reveal frames (docs/design/pages-review/attention/GALLERY.md): each game played part-way on
 * practice at 390 × 844 with the page clock installed, then fast-forwarded past time-up, so the answer reveal shows a
 * real mix of right, wrong and missed. A tool, not a check. Needs a dev server:
 *   bun scripts/attention-art/reveal-shots.ts --url=http://127.0.0.1:5317 --out=<dir> --tag=before|after [games…]
 * Writes <game>-reveal-<tag>.png (the screen) and <game>-reveal-<tag>-full.png (the whole scrolled reveal) at 2×.
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

const opt = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const url = opt("url") ?? "http://127.0.0.1:5317";
const out = opt("out") ?? "/tmp/attention-reveals";
const tag = opt("tag") ?? "after";
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
mkdirSync(out, { recursive: true });
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});

const PLAY: Record<string, (page: Page) => Promise<void>> = {
  symscan: async (p) => {
    for (const i of [1, 4, 8, 13, 17]) await p.locator(".eye-cell").nth(i).click({ force: true }).catch(() => undefined);
  },
  spotdiff: async (p) => {
    for (const i of [3, 10, 17, 22, 30, 41]) await p.locator("[data-dt-panel] rect[role=button]").nth(i).click({ force: true }).catch(() => undefined);
  },
  countup: async (p) => {
    for (const v of ["9", "12"]) {
      for (const ch of v) await p.getByRole("button", { name: ch, exact: true }).first().click().catch(() => undefined);
      await p.getByRole("button", { name: /enter/i }).first().click().catch(() => undefined);
      await p.clock.runFor(800);
    }
  },
  maze: async (p) => {
    for (let i = 0; i < 14; i++) {
      await p.keyboard.press(i % 3 ? "ArrowRight" : "ArrowDown");
      await p.clock.runFor(120);
    }
  },
  bomb: async (p) => {
    for (const r of [2, 5, 1]) await p.locator(`[data-bomb-wire-row='${r}'], button[aria-label^='Wire ${r},']`).first().click().catch(() => undefined);
  },
  pairmatch: async (p) => {
    const cards = p.locator("[data-pair-card]");
    for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7]]) {
      await cards.nth(a!).dispatchEvent("pointerdown");
      await p.clock.runFor(200);
      await cards.nth(b!).dispatchEvent("pointerdown");
      await p.clock.runFor(1000);
    }
  },
};

for (const game of Object.keys(PLAY).filter((g) => only.length === 0 || only.includes(g))) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.clock.install();
  await page.addInitScript(() => {
    try {
      localStorage.setItem("duelz-terms:v1", JSON.stringify({ at: Date.now() }));
    } catch {
      /* fine */
    }
  });
  try {
    await page.goto(`${url}/practice?game=${game}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.clock.runFor(4000);
    const ready = page.getByRole("button", { name: /ready/i });
    await ready.first().waitFor({ timeout: 90_000 });
    await ready.first().click();
    await page.clock.runFor(4500);
    await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
    await PLAY[game]!(page);
    await page.clock.fastForward(200_000);
    for (let i = 0; i < 20; i++) await page.clock.runFor(500);
    await page.locator("[data-reveal-score], [data-arcade-reveal]").first().waitFor({ timeout: 60_000 });
    await page.clock.runFor(2500);
    await page.screenshot({ path: `${out}/${game}-reveal-${tag}.png` });
    await page.screenshot({ path: `${out}/${game}-reveal-${tag}-full.png`, fullPage: true });
    console.log("saved", game);
  } catch (e) {
    console.log("FAILED", game, String(e).split("\n")[0]);
  }
  await page.close();
}
await browser.close();
