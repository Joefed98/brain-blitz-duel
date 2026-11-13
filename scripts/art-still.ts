/**
 * Re-exports an item's approved still from its source (13 Nov 2026, docs/cosmetics-review): the item's `.html` drawn in
 * headless Chromium under Reduce Motion at 2×, the item's box ([data-item]) plus a 16 px margin, as the other stills in
 * docs/art/wave-2/items were exported. The page's Google Fonts link is answered with the self-hosted Archivo and
 * Silkscreen in public/fonts, so the still is the same on any machine. Use it after redrawing an item's source.
 *
 *   bun scripts/art-still.ts docs/art/wave-2/items/frame/top-500.html [more.html…]   (writes each .png beside it)
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

const files = process.argv.slice(2).filter((a) => a.endsWith(".html"));
if (!files.length) {
  console.log("art-still: name the item .html files");
  process.exit(1);
}
const FONTS_CSS = `@font-face{font-family:"Archivo";font-style:normal;font-weight:100 900;font-stretch:62% 125%;src:url("http://still.test/fonts/archivo-var-latin.woff2") format("woff2")}
@font-face{font-family:"Silkscreen";font-style:normal;font-weight:400 700;src:url("http://still.test/fonts/silkscreen-700-latin.woff2") format("woff2")}`;
const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 600, height: 400 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "fonts.googleapis.com") return route.fulfill({ body: FONTS_CSS, contentType: "text/css" });
    if (url.hostname === "still.test") return route.fulfill({ body: readFileSync(join("public", url.pathname)), contentType: "font/woff2" });
    if (url.hostname === "item.test") return route.fulfill({ body: (globalThis as { __page?: string }).__page ?? "", contentType: "text/html" });
    return route.abort();
  });
  const page = await context.newPage();
  for (const file of files) {
    (globalThis as { __page?: string }).__page = readFileSync(file, "utf8");
    await page.goto("http://item.test/");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(100);
    const box = (await page.locator("[data-item]").first().boundingBox())!;
    const out = file.replace(/\.html$/, ".png");
    await page.screenshot({ path: out, clip: { x: box.x - 16, y: box.y - 16, width: box.width + 32, height: box.height + 32 } });
    console.log(`art-still: ${out}`);
  }
} finally {
  await browser.close();
}
