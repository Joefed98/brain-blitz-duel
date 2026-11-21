// node render.mjs <name>:<file.html?query>:<phone|desktop|WxH> ...   -> out/<name>.png
import { createServer } from "node:http";
import { readFile, mkdir, realpath } from "node:fs/promises";
import { extname, join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = new URL(".", import.meta.url).pathname;
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".json": "application/json" };
const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = await realpath(join(root, p));
    const data = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end("no"); }
});
await new Promise((r) => server.listen(0, r));
const origin = `http://127.0.0.1:${server.address().port}`;
await mkdir(join(root, "out"), { recursive: true });
const browser = await chromium.launch();
for (const job of process.argv.slice(2)) {
  const i = job.indexOf(":"), j = job.lastIndexOf(":");
  const name = job.slice(0, i), url = job.slice(i + 1, j), size = job.slice(j + 1);
  const vp = size === "phone" ? { w: 390, h: 844, s: 2 } : size === "desktop" ? { w: 1440, h: 900, s: 1 } : { w: +size.split("x")[0], h: +size.split("x")[1], s: 2 };
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.s });
  const page = await ctx.newPage();
  page.on("requestfailed", (r) => console.log("  failed", r.url()));
  page.on("response", (r) => { if (r.status() >= 400) console.log("  ", r.status(), r.url()); });
  await page.goto(`${origin}/${url}`);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(root, "out", `${name}.png`) });
  console.log("ok", name);
  await ctx.close();
}
await browser.close();
server.close();
