/**
 * Depth batch 4 review screenshots (docs/depth/d4-pattern.md): each of the eight games mid-play at 414×896 in
 * practice on its new stamp (a bank draw, not the fixed example, so the banked games show their new boards),
 * with a few moves made so every new feature shows: the par meter, Skid's gems (one or more collected), Heave's
 * gold crate, Lightbender's spare mirrors and elegant-beam par, Tessellate's 7×7 board.
 *
 *   bun scripts/shots/depth4-shots.ts [--url=<origin>] [--out=screenshots/depth4-oct-2026]
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { gameDisplayName } from "../../src/lib/duel/gameNames";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5391").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/depth4-oct-2026";
const ALL = ["unblock", "blockparty", "pipes", "flow", "iceslide", "push", "laser", "rings"] as const;
const NAMED = args.filter((a) => !a.startsWith("--"));
const GAMES = ALL.filter((g) => !NAMED.length || NAMED.includes(g));
mkdirSync(OUT, { recursive: true });

const pause = (page: Page, ms: number) => page.waitForTimeout(ms);
const press = async (page: Page, name: string) => {
  await page.getByRole("button", { name, exact: true }).first().tap();
  await pause(page, 1500);
};
const gems = (page: Page) => page.locator("[data-d4-gem][data-got]").count();

async function play(page: Page, game: (typeof ALL)[number]): Promise<void> {
  if (game === "unblock") {
    // Slide a few blocks: each drag one cell along the block's own axis.
    const cars = page.locator(".unblock-car:not(.unblock-car--gold)");
    const count = await cars.count();
    for (let i = 0, made = 0; i < count && made < 3; i++) {
      const box = await cars.nth(i).boundingBox();
      if (!box) continue;
      const vertical = box.height > box.width;
      const before = await page.locator("[data-live-summary]").textContent();
      for (const sign of [1, -1]) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + (vertical ? 0 : sign * 58), box.y + box.height / 2 + (vertical ? sign * 58 : 0), { steps: 8 });
        await page.mouse.up();
        await pause(page, 400);
        if ((await page.locator("[data-live-summary]").textContent()) !== before) {
          made++;
          break;
        }
      }
    }
  }
  if (game === "pipes") {
    const tiles = page.locator(".pipes-play-board .pipe-tile");
    for (const i of [0, 1, 7, 8, 9, 14, 15]) {
      await tiles.nth(i).click();
      await pause(page, 120);
    }
  }
  if (game === "rings") {
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Rotate selected ring clockwise" }).click();
  }
  if (game === "push") {
    for (const d of ["Up", "Left", "Down", "Right", "Up"]) await press(page, d);
  }
  if (game === "iceslide") {
    // Greedy: keep a slide that collects a new gem, otherwise undo it; stop once a gem is collected.
    for (let step = 0; step < 14 && (await gems(page)) < 1; step++) {
      let kept = false;
      for (const d of ["Up", "Left", "Down", "Right"]) {
        const before = await gems(page);
        await press(page, d);
        if ((await gems(page)) > before) {
          kept = true;
          break;
        }
        const undo = page.getByRole("button", { name: "Undo", exact: true }).first();
        if (await undo.isEnabled()) {
          await undo.click();
          await pause(page, 300);
        }
      }
      if (!kept) await press(page, ["Down", "Right", "Up", "Left"][step % 4]!);
    }
  }
  if (game === "blockparty") {
    // Drag two tray pieces onto the board's empty corner area.
    const board = await page.locator(".bp-board").first().boundingBox();
    const pieces = page.locator(".block-party-tray [aria-label^='Piece'] div[style*='touch-action']").first();
    if (board && (await pieces.count())) {
      const from = await pieces.boundingBox();
      if (from) {
        await page.mouse.move(from.x + 8, from.y + 8);
        await page.mouse.down();
        await page.mouse.move(board.x + board.width * 0.5, board.y + board.height * 0.5, { steps: 12 });
        await page.mouse.up();
      }
    }
  }
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const game of GAMES) {
  const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded" });
    const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
    await button.waitFor({ timeout: 90_000 });
    await pause(page, 1000);
    await button.click();
    const ready = page.getByRole("button", { name: /^Ready/ }).first();
    await ready.waitFor({ timeout: 60_000 });
    await page.screenshot({ path: `${OUT}/${game}-intro-414x896.png` });
    await ready.click();
    await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
    await pause(page, 2500);
    await play(page, game);
    await pause(page, 900);
    await page.screenshot({ path: `${OUT}/${game}-play-414x896.png` });
    console.log(`${game}: shot`);
  } catch (error) {
    console.log(`${game}: ${String((error as Error).message).split("\n")[0]}`);
  } finally {
    await context.close();
  }
}
await browser.close();
