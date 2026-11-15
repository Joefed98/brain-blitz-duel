/**
 * Renders the redraws' 3D pieces (scenes.ts through render.html, the art kit's raymarcher) to WebP in
 * public/cosmetics/redrawn/<name>.webp (quality 86; the whole-card fields 70, to stay under 80 KB). Slow on a software GPU (~10–40 s a piece); re-run for one piece with its name.
 *
 *   bun docs/design/cosmetics-redraws/source/render.ts [name,…]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { chromium } from "playwright";
import { JOBS } from "./scenes";

const OUT = join(import.meta.dir, "../../../../public/cosmetics/redrawn");
mkdirSync(OUT, { recursive: true });
const only = (process.argv[2] ?? "").split(",").filter(Boolean);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("file://" + join(import.meta.dir, "render.html"));
await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready, null, { timeout: 60000 });
for (const [name, job] of Object.entries(JOBS)) {
  if (only.length && !only.includes(name)) continue;
  const cols = [...Array(8)].map((_, i) => job.cols[i] || "#808080");
  const url: string = await page.evaluate((o) => (window as unknown as { renderArt: (o: unknown) => string }).renderArt(o), { ...job, cols, style: 1 });
  const img = await loadImage(Buffer.from(url.split(",")[1]!, "base64"));
  const c = createCanvas(job.w, job.h);
  c.getContext("2d").drawImage(img, 0, 0);
  writeFileSync(join(OUT, `${name}.webp`), await c.encode("webp", job.w >= 900 ? 70 : 86));
  console.log(name);
}
await browser.close();
