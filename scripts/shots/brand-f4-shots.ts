/**
 * Design foundation F4's review images (a tool, not a check): the share card drawn by the real card
 * code (src/lib/share/resultCard.ts) in Chromium, beside copies of the new app icon, the solve burst's
 * logo, two launch screens and the link preview, plus one contact sheet. Writes
 * screenshots/brand-f4-nov-2026/ (or --out=<dir>).
 *
 *   bun scripts/shots/brand-f4-shots.ts
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { BRAND_INK } from "../../src/components/brand/logoGeometry";
import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, VIEWPORTS, openThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/brand-f4-nov-2026";
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });

const COPIES: [string, string][] = [
  ["public/app-icon-512.png", "app-icon-512.png"],
  ["public/app-icon-maskable-512.png", "app-icon-maskable-512.png"],
  ["public/icon-512.png", "solve-burst-logo-512.png"],
  ["public/splash/splash-828x1792.png", "splash-828x1792.png"],
  ["public/splash/splash-1179x2556.png", "splash-1179x2556.png"],
  ["public/og-image.png", "og-image-1200x630.png"],
];
for (const [from, to] of COPIES) copyFileSync(from, join(OUT, to));

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-brand-f4-shots", buildId: "brand-f4-shots" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const practice = THEME_SCREENS.find((s) => s.name === "practice list")!;
  const { context, page } = await openThemeScreen(browser, server.origin, practice, { ...VIEWPORTS[0]!, scale: 1 });
  const url = await page.evaluate(async () => {
    const { drawResultCard, loadCardFonts, CARD_W, CARD_H } = await import(/* @vite-ignore */ "/src/lib/share/resultCard.ts");
    const { gameIconImages } = await import(/* @vite-ignore */ "/src/components/share/gameIconImages.tsx");
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
        roomCode: "K7QM",
        duelId: "shots",
        gameIndex: 0,
      },
      icons,
    );
    return canvas.toDataURL("image/png");
  });
  writeFileSync(join(OUT, "share-card-1080x1350.png"), Buffer.from(url.split(",")[1]!, "base64"));
  await context.close();

  // One sheet: the icon, the burst logo, a launch screen, the share card and the link preview.
  const img = (file: string, style: string) =>
    `<img src="data:image/png;base64,${readFileSync(join(OUT, file)).toString("base64")}" style="${style}">`;
  const sheet = await browser.newContext({ viewport: { width: 1480, height: 640 }, deviceScaleFactor: 1 });
  const sp = await sheet.newPage();
  await sp.setContent(`<body style="margin:0;background:${BRAND_INK};display:flex;gap:32px;align-items:center;justify-content:center;height:100vh;font:600 14px system-ui;color:#8F9BBF">
    <div style="display:flex;flex-direction:column;gap:20px;align-items:center">${img("app-icon-512.png", "width:160px;flex:none")}${img("solve-burst-logo-512.png", "width:160px;flex:none;border-radius:22%")}</div>
    ${img("splash-828x1792.png", "height:560px;flex:none;border:1px solid #1E2640;border-radius:24px")}
    ${img("share-card-1080x1350.png", "height:560px;flex:none;border-radius:12px")}
    ${img("og-image-1200x630.png", "width:400px;flex:none;border:1px solid #1E2640")}
  </body>`);
  await sp.screenshot({ path: join(OUT, "sheet.png") });
  await sheet.close();
  console.log(`wrote ${OUT}/`);
} finally {
  await browser.close();
  await server.close();
}
