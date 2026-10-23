/**
 * The hero game icons for review (Prompt H2, 23 Oct 2026; a design tool, not a check): Practice's
 * Arcade shelf at 414×896 as an iPhone 11 home-screen app, scrolled to each of Grappler, Jaywalk
 * and Roofbound, a close-up of the three 104 px tiles side by side, and a room's share card whose
 * rounds include all three (the real resultCard and gameIconImages in the browser), shown at
 * 414 px wide and saved at its full 1080×1350. JPEG at 2× unless noted.
 *
 *   bun scripts/shots/hero-icons-shots.ts [--out=screenshots/hero-icons-oct-2026] [--scale=2]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, VIEWPORTS, openThemeScreen } from "../theme-screens";

const OUT =
  process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/hero-icons-oct-2026";
const SCALE = Number(process.argv.find((a) => a.startsWith("--scale="))?.slice(8) ?? 2);
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });

const HERO_GAMES = ["swing", "cross", "flip"] as const;
const viewport = { ...VIEWPORTS[0]!, scale: SCALE };
const jpeg = { type: "jpeg" as const, quality: 85 };
const server = await startSafeAreaServer({
  cacheDir: "node_modules/.vite-hero-icons-shots",
  buildId: "hero-icons-shots",
});
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const practice = THEME_SCREENS.find((s) => s.name === "practice list")!;
  const { context, page } = await openThemeScreen(browser, server.origin, practice, viewport);
  try {
    const order = await page.evaluate(() =>
      [...document.querySelectorAll("[data-practice-shelf='arcade'] [data-game-icon]")].map((el) =>
        el.getAttribute("data-game-icon"),
      ),
    );
    console.log(`arcade shelf: ${order.join(", ")}`);
    for (const type of HERO_GAMES) {
      await page.evaluate((t) => {
        const icon = document.querySelector(
          `[data-practice-shelf='arcade'] [data-game-icon='${t}']`,
        );
        const shelf = icon?.closest("[data-practice-shelf]") as HTMLElement | null;
        if (!icon || !shelf) return;
        const tile = icon.getBoundingClientRect();
        const box = shelf.getBoundingClientRect();
        shelf.scrollLeft += tile.left - box.left - (box.width - tile.width) / 2;
        window.scrollTo(0, box.top + window.scrollY - 300);
      }, type);
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `practice-shelf-${type}-414x896.jpg`), ...jpeg });
      const tile = page.locator(`[data-practice-shelf='arcade'] [data-game-icon='${type}']`);
      await tile.screenshot({ path: join(OUT, `tile-${type}-104.png`) });
    }
  } finally {
    await context.close();
  }

  // The three 104 px tiles side by side, at 4× for a close look.
  const tiles = HERO_GAMES.map(
    (t) =>
      `<img src="data:image/png;base64,${readFileSync(join(OUT, `tile-${t}-104.png`)).toString("base64")}" style="width:208px;height:208px;image-rendering:pixelated">`,
  ).join("");
  const close = await browser.newContext({
    viewport: { width: 720, height: 260 },
    deviceScaleFactor: 2,
  });
  const cp = await close.newPage();
  await cp.setContent(
    `<body style="margin:0;display:flex;gap:24px;align-items:center;justify-content:center;height:100vh;background:#07070A">${tiles}</body>`,
  );
  await cp.screenshot({ path: join(OUT, "tiles-closeup.png") });
  await close.close();

  // A share card whose six rounds include the three hero games, drawn by the real card code.
  const { context: ctx, page: page2 } = await openThemeScreen(
    browser,
    server.origin,
    practice,
    viewport,
  );
  const url = await page2.evaluate(async () => {
    const { drawResultCard, loadCardFonts, CARD_W, CARD_H } = await import(
      /* @vite-ignore */ "/src/lib/share/resultCard.ts"
    );
    const { gameIconImages } = await import(
      /* @vite-ignore */ "/src/components/share/gameIconImages.tsx"
    );
    const games = ["swing", "sudoku", "cross", "flip", "matchup", "hover"];
    await loadCardFonts();
    const icons = await gameIconImages(games);
    const canvas = document.createElement("canvas");
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    drawResultCard(
      canvas.getContext("2d")!,
      {
        title: "Joulz",
        lines: [],
        link: "",
        place: 1,
        total: 742,
        players: 4,
        rounds: 6,
        top: [
          { place: 1, name: "Sam", total: 742 },
          { place: 2, name: "Ali", total: 688 },
          { place: 3, name: "Jo", total: 612 },
        ],
        games,
        roomCode: "HERO",
        duelId: "shots",
        gameIndex: 0,
      },
      icons,
    );
    return canvas.toDataURL("image/png");
  });
  writeFileSync(join(OUT, "share-card-1080x1350.png"), Buffer.from(url.split(",")[1]!, "base64"));
  await page2.setContent(
    `<body style="margin:0;background:#07070A;display:flex;align-items:center;justify-content:center;height:100vh"><img src="${url}" style="width:390px;height:auto;border-radius:12px"></body>`,
  );
  await page2.screenshot({ path: join(OUT, "share-card-414x896.jpg"), ...jpeg });
  await ctx.close();
} finally {
  await browser.close();
  await server.close();
}
console.log(`screenshots in ${OUT}`);
