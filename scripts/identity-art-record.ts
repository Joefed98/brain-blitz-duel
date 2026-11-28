/**
 * Records identity-art-check's reference (S5 PR A): every rendered avatar's tinted composite as Chromium draws the
 * app's own markup (avatarMarkup, nothing equipped) on black, for a few player colours, averaged into 10 × 10 px
 * blocks (28 × 28 a picture). The check composes the same three files itself and compares.
 *
 *     bun scripts/identity-art-record.ts      writes scripts/fixtures/identity-art-reference.json.gz
 *
 * Re-record only after re-publishing the avatar art (scripts/identity-art/publish_avatars.py).
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { chromium } from "playwright";

import { AVATARS, avatarMarkup } from "../src/design/identity/avatars";
import { AVATAR_ART } from "../src/design/identity/avatarArt.data";
import { REFERENCE_COLOURS, REFERENCE_PATH, blocksOf } from "./identity-art-lib";

const server = Bun.serve({
  port: 0,
  fetch(req) {
    const path = new URL(req.url).pathname;
    if (path === "/") return new Response("<!doctype html><html><body style='margin:0;background:#000'></body></html>", { headers: { "content-type": "text/html" } });
    return new Response(Bun.file(join("public", path)));
  },
});

const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 280, height: 280 }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:${server.port}/`);
const out: Record<string, Record<string, string>> = {};
for (const a of AVATARS) {
  if (!AVATAR_ART[a.id]) continue;
  for (const colour of REFERENCE_COLOURS) {
    const markup = avatarMarkup({ id: a.id, colour, gem: null }, "r-");
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#000"><div style="width:280px;height:280px">${markup}</div></body></html>`);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete) && [...document.querySelectorAll("image")].length > 0);
    await page.evaluate(() => Promise.all([...document.querySelectorAll("image")].map((i) => new Promise((r) => { const im = new Image(); im.onload = r; im.onerror = r; im.src = i.getAttribute("href")!; }))));
    await page.waitForTimeout(50);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 280, height: 280 } });
    (out[a.id] ??= {})[String(colour)] = Buffer.from(await blocksOf(png)).toString("base64");
  }
  process.stdout.write(".");
}
await browser.close();
server.stop();
writeFileSync(REFERENCE_PATH, gzipSync(JSON.stringify({ size: 28, colours: REFERENCE_COLOURS, avatars: out })));
console.log(`\nwrote ${REFERENCE_PATH}: ${Object.keys(out).length} avatars × ${REFERENCE_COLOURS.length} colours`);
