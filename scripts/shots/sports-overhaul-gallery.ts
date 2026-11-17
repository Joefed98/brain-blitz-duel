/**
 * The Home Run and Top Bins gallery's side-by-side sheets (a design tool, 15 Nov 2026): panels scaled to one height
 * with a label over each, written as WebP into docs/design/pages-review/home-run-top-bins/.
 *
 *   bun scripts/shots/sports-overhaul-gallery.ts <out.webp> "<label>=<image>[@col/cols]" …
 *   (an image may be a strip of equal frames: @2/5 takes the second of five)
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";

const [out, ...specs] = process.argv.slice(2);
const H = 640;
const LABEL = 34;
const GAP = 12;
const panels = await Promise.all(
  specs.map(async (spec) => {
    const [label, src] = spec.split("=") as [string, string];
    const [path, part] = src.split("@") as [string, string | undefined];
    const img = await loadImage(path);
    let sx = 0;
    let sw = img.width;
    if (part) {
      const [k, n] = part.split("/").map(Number) as [number, number];
      sw = img.width / n;
      sx = sw * (k - 1);
    }
    const w = Math.round((sw * H) / img.height);
    return { label, img, sx, sw, w };
  }),
);
const W = panels.reduce((t, p) => t + p.w, 0) + GAP * (panels.length + 1);
const c = createCanvas(W, H + LABEL + GAP);
const ctx = c.getContext("2d");
ctx.fillStyle = "#07070A";
ctx.fillRect(0, 0, c.width, c.height);
let x = GAP;
for (const p of panels) {
  ctx.fillStyle = "#F3F1EC";
  ctx.font = "700 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(p.label, x + p.w / 2, 24);
  ctx.drawImage(p.img, p.sx, 0, p.sw, p.img.height, x, LABEL, p.w, H);
  x += p.w + GAP;
}
writeFileSync(out!, c.toBuffer("image/webp", 78));
console.log(`wrote ${out} (${W}×${c.height})`);
