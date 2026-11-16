/**
 * The Attention overhaul's gallery frames (docs/design/pages-review/attention/GALLERY.md): each game mid-play on
 * practice at 390 × 844, plus a few states (Double Take's Done, Tally's marks, Matchmaker's face-up cards). A tool, not a
 * check. Needs a dev server: bun scripts/attention-art/gallery-shots.ts --url=http://127.0.0.1:5317 [--out=<dir>]; writes
 * PNGs at 2× (convert to WebP for the gallery).
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

const url = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://127.0.0.1:5317";
const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "/tmp/attention-gallery";
mkdirSync(out, { recursive: true });
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});

async function open(game: string): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("duelz-terms:v1", JSON.stringify({ at: Date.now() }));
    } catch {
      /* fine */
    }
  });
  await page.goto(`${url}/practice?game=${game}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1500);
  const ready = page.getByRole("button", { name: /ready/i });
  if (await ready.count()) await ready.first().click();
  await page.waitForTimeout(4200);
  return page;
}

async function save(page: Page, name: string) {
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("saved", name);
}

const tapAll = async (page: Page, selector: string, n: number, step = 3) => {
  const items = page.locator(selector);
  const count = await items.count();
  for (let i = 0; i < Math.min(n, count); i++) await items.nth((i * step) % count).click({ force: true }).catch(() => undefined);
};

{
  const p = await open("symscan");
  await save(p, "symscan-start");
  await tapAll(p, ".eye-cell", 5, 4);
  await p.waitForTimeout(400);
  await save(p, "symscan-mid");
  await p.close();
}
{
  const p = await open("spotdiff");
  await tapAll(p, "[data-dt-panel] rect[role=button]", 4, 7);
  await p.waitForTimeout(500);
  await save(p, "spotdiff-mid");
  await p.close();
}
{
  const p = await open("countup");
  await save(p, "countup-start");
  await tapAll(p, "[data-tally-shape]", 8, 5);
  await p.waitForTimeout(300);
  await save(p, "countup-marks");
  await p.close();
}
{
  const p = await open("maze");
  for (let i = 0; i < 8; i++) {
    await p.keyboard.press(i % 2 ? "ArrowDown" : "ArrowRight");
    await p.waitForTimeout(80);
  }
  await save(p, "maze-mid");
  await p.locator("[data-game-menu-button], button[aria-label*='menu' i]").first().click().catch(() => undefined);
  await p.waitForTimeout(700);
  await save(p, "maze-menu");
  await p.close();
}
{
  const p = await open("bomb");
  await p.locator("[data-bomb-wire-row='2']").click().catch(() => undefined);
  await p.waitForTimeout(500);
  await save(p, "bomb-mid");
  await p.close();
}
{
  const p = await open("pairmatch");
  await save(p, "pairmatch-start");
  const cards = p.locator("[data-pair-card]");
  await cards.nth(0).dispatchEvent("pointerdown");
  await p.waitForTimeout(250);
  await cards.nth(7).dispatchEvent("pointerdown");
  await p.waitForTimeout(250);
  await save(p, "pairmatch-mid");
  await p.close();
}
await browser.close();
